'use strict';

// ==================== STATE ====================
class StateManager {
  #s = {};
  #ls = new Map();
  constructor(init) { this.#s = { ...init }; }
  subscribe(k, cb) {
    if (!this.#ls.has(k)) this.#ls.set(k, new Set());
    this.#ls.get(k).add(cb);
    return () => this.#ls.get(k).delete(cb);
  }
  set(k, v) { const old = this.#s[k]; this.#s[k] = v; this.#notify(k, v, old); }
  get(k) { return this.#s[k]; }
  getState() { return { ...this.#s }; }
  #notify(k, nv, ov) { this.#ls.get(k)?.forEach(cb => { try { cb(nv, ov); } catch(e) { console.error(e); } }); }
}

// ==================== ANTENNA PATTERNS ====================
const AntennaPatterns = {
  dipole: ({ length }) => {
    const L = length * Math.PI;
    return {
      azimuth: () => 1.0,
      elevation: (theta) => {
        const sinT = Math.sin(theta);
        if (Math.abs(sinT) < 1e-6) return 0;
        return Math.abs((Math.cos(L * Math.cos(theta)) - Math.cos(L)) / sinT);
      }
    };
  },
  monopole: ({ length, tilt }) => {
    const L = length * Math.PI * 2;
    const tR = (tilt * Math.PI) / 180;
    return {
      azimuth: (phi) => 0.9 + 0.1 * Math.cos(phi - tR),
      elevation: (theta) => {
        if (theta > Math.PI) return 0;
        const sinT = Math.sin(theta);
        if (Math.abs(sinT) < 1e-6) return 0;
        return Math.abs((Math.cos(L * Math.cos(theta)) - Math.cos(L)) / sinT);
      }
    };
  },
  array: ({ spacing, phase }) => {
    const d = spacing * 2 * Math.PI;
    const psi0 = (phase * Math.PI) / 180;
    const AF = (phi) => Math.abs(Math.cos((d * Math.cos(phi) + psi0) / 2));
    return {
      azimuth: (phi) => AF(phi),
      elevation: (theta) => {
        const sinT = Math.sin(theta);
        if (Math.abs(sinT) < 1e-6) return 0;
        const el = Math.abs((Math.cos(Math.PI * Math.cos(theta)) - Math.cos(Math.PI)) / sinT);
        return el * AF(0);
      }
    };
  },
  yagi: ({ directors, spacing }) => {
    const n = directors + 2;
    const d = spacing * 2 * Math.PI;
    const AF = (angle) => {
      let s = 0;
      for (let i = 0; i < n; i++) s += Math.cos(i * (d * Math.cos(angle) - 1.8));
      return Math.abs(s / n);
    };
    return {
      azimuth: (phi) => AF(phi),
      elevation: (theta) => AF(theta)
    };
  }
};

// ==================== COLOR MAP ====================
const ColorUtils = {
  map: (t) => {
    const stops = [
      [0,    [13, 71, 161]],
      [0.25, [0, 150, 200]],
      [0.5,  [0, 200, 100]],
      [0.75, [255, 180, 0]],
      [1.0,  [255, 23, 68]]
    ];
    let lo = stops[0], hi = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (t >= stops[i][0] && t <= stops[i+1][0]) { lo = stops[i]; hi = stops[i+1]; break; }
    }
    const f = lo[0] === hi[0] ? 0 : (t - lo[0]) / (hi[0] - lo[0]);
    return `rgb(${Math.round(lo[1][0]+f*(hi[1][0]-lo[1][0]))},${Math.round(lo[1][1]+f*(hi[1][1]-lo[1][1]))},${Math.round(lo[1][2]+f*(hi[1][2]-lo[1][2]))})`;
  }
};

// ==================== CANVAS HELPER ====================
function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = rect.width || canvas.offsetWidth || parseInt(canvas.getAttribute('width'));
  const h = rect.height || canvas.offsetHeight || parseInt(canvas.getAttribute('height'));
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.scale(dpr, dpr);
  return { ctx, w, h, dpr };
}

// ==================== POLAR RENDERER ====================
class PolarRenderer {
  #canvas; #ctx; #w; #h; #mode;
  constructor(id, mode = 'dbi') {
    this.#canvas = document.getElementById(id);
    const s = setupCanvas(this.#canvas);
    this.#ctx = s.ctx; this.#w = s.w; this.#h = s.h;
    this.#mode = mode;
  }
  setMode(m) { this.#mode = m; }

  render(fn) {
    const ctx = this.#ctx, w = this.#w, h = this.#h;
    const cx = w/2, cy = h/2, R = Math.min(cx,cy) - 22;

    // BG
    ctx.fillStyle = '#020810';
    ctx.fillRect(0, 0, w, h);
    const bg = ctx.createRadialGradient(cx,cy,0,cx,cy,R);
    bg.addColorStop(0,'rgba(13,31,56,0.9)'); bg.addColorStop(1,'rgba(1,10,20,1)');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(cx,cy,R,0,2*Math.PI); ctx.fill();

    this.#grid(ctx, cx, cy, R);
    this.#pattern(ctx, fn, cx, cy, R);
  }

  #grid(ctx, cx, cy, R) {
    [0.25,0.5,0.75,1.0].forEach(lv => {
      ctx.beginPath(); ctx.arc(cx,cy,R*lv,0,2*Math.PI);
      ctx.strokeStyle = lv===1 ? 'rgba(0,229,255,0.28)' : 'rgba(0,229,255,0.1)';
      ctx.lineWidth = lv===1 ? 1 : 0.5; ctx.stroke();
      if (lv < 1) {
        const label = this.#mode==='dbi' ? `${Math.round((lv-1)*30)}dB` : `${Math.round(lv*100)}%`;
        ctx.fillStyle='rgba(96,128,160,0.65)'; ctx.font='8px "Share Tech Mono"';
        ctx.fillText(label, cx+R*lv+3, cy-3);
      }
    });
    for (let i=0; i<12; i++) {
      const a = (i/12)*2*Math.PI;
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+R*Math.cos(a), cy+R*Math.sin(a));
      ctx.strokeStyle='rgba(0,229,255,0.07)'; ctx.lineWidth=0.5; ctx.stroke();
      const deg = i*30;
      const lx = cx+(R+15)*Math.cos(a-Math.PI/2), ly = cy+(R+15)*Math.sin(a-Math.PI/2);
      ctx.fillStyle='rgba(96,128,160,0.8)'; ctx.font='8px "Share Tech Mono"';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(deg+'°', lx, ly);
    }
  }

  #toDisp(v) {
    if (this.#mode==='dbi') { const d=20*Math.log10(Math.max(v,1e-10)); return Math.max(0,1+d/30); }
    if (this.#mode==='power') return v*v;
    return v;
  }

  #pattern(ctx, fn, cx, cy, R) {
    const N=720, vals=[], pts=[];
    let max=0;
    for (let i=0;i<N;i++) { const v=Math.abs(fn((i/N)*2*Math.PI)); vals.push(v); if(v>max) max=v; }
    for (let i=0;i<N;i++) {
      const norm=max>0?vals[i]/max:0, disp=this.#toDisp(norm);
      const r=R*Math.max(disp,0), a=(i/N)*2*Math.PI-Math.PI/2;
      pts.push([cx+r*Math.cos(a), cy+r*Math.sin(a), norm]);
    }
    // Fill
    for (let i=0;i<N;i++) {
      const [x1,y1,n]=pts[i], [x2,y2]=pts[(i+1)%N];
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(x1,y1); ctx.lineTo(x2,y2); ctx.closePath();
      ctx.fillStyle=ColorUtils.map(n)+'99'; ctx.fill();
    }
    // Outline
    ctx.beginPath();
    pts.forEach(([x,y],i)=>{ i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); });
    ctx.closePath();
    ctx.strokeStyle='#00e5ff'; ctx.lineWidth=1.5;
    ctx.shadowColor='#00e5ff'; ctx.shadowBlur=8; ctx.stroke(); ctx.shadowBlur=0;
    // Center
    ctx.beginPath(); ctx.arc(cx,cy,3,0,2*Math.PI);
    ctx.fillStyle='#00e5ff'; ctx.fill();
  }
}

// ==================== IMPROVED 3D RENDERER ====================
class Renderer3D {
  #canvas; #ctx; #w; #h; #mode;
  // Rotation state
  #rotX = 0.55; // elevation angle (radians)
  #rotZ = 0.45; // azimuth angle (radians)
  #zoom = 1.0;
  #isDragging = false;
  #lastMx = 0; #lastMy = 0;
  #lastPattern = null;
  #animFrame = null;
  #needsRender = false;

  constructor(id, mode='dbi') {
    this.#canvas = document.getElementById(id);
    const s = setupCanvas(this.#canvas);
    this.#ctx = s.ctx; this.#w = s.w; this.#h = s.h;
    this.#mode = mode;
    this.#initInteraction();
  }

  setMode(m) { this.#mode = m; }

  #initInteraction() {
    const wrap = document.getElementById('wrap3d');

    wrap.addEventListener('mousedown', (e) => {
      this.#isDragging = true;
      this.#lastMx = e.clientX;
      this.#lastMy = e.clientY;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.#isDragging) return;
      const dx = e.clientX - this.#lastMx;
      const dy = e.clientY - this.#lastMy;
      this.#rotZ -= dx * 0.01;
      this.#rotX -= dy * 0.008;
      this.#rotX = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.#rotX));
      this.#lastMx = e.clientX;
      this.#lastMy = e.clientY;
      this.#scheduleRender();
    });
    window.addEventListener('mouseup', () => { this.#isDragging = false; });

    // Touch support
    wrap.addEventListener('touchstart', (e) => {
      this.#isDragging = true;
      this.#lastMx = e.touches[0].clientX;
      this.#lastMy = e.touches[0].clientY;
      e.preventDefault();
    }, { passive: false });
    window.addEventListener('touchmove', (e) => {
      if (!this.#isDragging) return;
      const dx = e.touches[0].clientX - this.#lastMx;
      const dy = e.touches[0].clientY - this.#lastMy;
      this.#rotZ -= dx * 0.01;
      this.#rotX -= dy * 0.008;
      this.#rotX = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.#rotX));
      this.#lastMx = e.touches[0].clientX;
      this.#lastMy = e.touches[0].clientY;
      this.#scheduleRender();
    }, { passive: true });
    window.addEventListener('touchend', () => { this.#isDragging = false; });

    // Zoom
    wrap.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.#zoom *= e.deltaY > 0 ? 0.93 : 1.08;
      this.#zoom = Math.max(0.3, Math.min(2.5, this.#zoom));
      this.#scheduleRender();
    }, { passive: false });
  }

  setPreset(preset) {
    const presets = {
      iso:   { rotX: 0.55, rotZ: 0.45, zoom: 1.0 },
      top:   { rotX: Math.PI/2, rotZ: 0, zoom: 1.1 },
      front: { rotX: 0, rotZ: 0, zoom: 1.1 },
      side:  { rotX: 0, rotZ: Math.PI/2, zoom: 1.1 },
      reset: { rotX: 0.55, rotZ: 0.45, zoom: 1.0 }
    };
    const p = presets[preset] || presets.iso;
    this.#rotX = p.rotX; this.#rotZ = p.rotZ; this.#zoom = p.zoom;
    if (this.#lastPattern) this.render(this.#lastPattern);
  }

  #scheduleRender() {
    if (this.#animFrame) cancelAnimationFrame(this.#animFrame);
    this.#animFrame = requestAnimationFrame(() => {
      if (this.#lastPattern) this.render(this.#lastPattern);
    });
  }

  // 3D rotation matrix (rotX then rotZ)
  #rotate(x, y, z) {
    // Rotate around X axis (elevation tilt)
    const cosX = Math.cos(this.#rotX), sinX = Math.sin(this.#rotX);
    const y1 = y * cosX - z * sinX;
    const z1 = y * sinX + z * cosX;
    // Rotate around Z axis (azimuth)
    const cosZ = Math.cos(this.#rotZ), sinZ = Math.sin(this.#rotZ);
    const x2 = x * cosZ - y1 * sinZ;
    const y2 = x * sinZ + y1 * cosZ;
    return [x2, y2, z1];
  }

  // Project to screen using perspective
  #project(x3, y3, z3) {
    const [rx, ry, rz] = this.#rotate(x3, y3, z3);
    const scale = this.#w * 0.28 * this.#zoom;
    const perspective = 4.5; // distance factor
    const fov = perspective / (perspective + ry);
    const sx = this.#w / 2 + rx * scale * fov;
    const sy = this.#h * 0.52 - rz * scale * fov;
    return [sx, sy, ry]; // return depth for sorting
  }

  render(pattern) {
    this.#lastPattern = pattern;
    const ctx = this.#ctx, w = this.#w, h = this.#h;

    ctx.fillStyle = '#01090f';
    ctx.fillRect(0, 0, w, h);

    // Subtle radial bg glow
    const grd = ctx.createRadialGradient(w/2,h/2,0,w/2,h/2,Math.min(w,h)*0.6);
    grd.addColorStop(0, 'rgba(7,21,37,0.9)');
    grd.addColorStop(1, 'rgba(1,9,15,1)');
    ctx.fillStyle = grd;
    ctx.fillRect(0,0,w,h);

    this.#drawGrid(ctx);
    this.#drawSurface(ctx, pattern);
    this.#drawAxes(ctx);
  }

  #drawGrid(ctx) {
    ctx.strokeStyle = 'rgba(0,229,255,0.07)';
    ctx.lineWidth = 0.5;
    const steps = 10;
    for (let i = -steps; i <= steps; i++) {
      const t = i / steps;
      const [x1,y1] = this.#project(t,-1,0);
      const [x2,y2] = this.#project(t,1,0);
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      const [x3,y3] = this.#project(-1,t,0);
      const [x4,y4] = this.#project(1,t,0);
      ctx.beginPath(); ctx.moveTo(x3,y3); ctx.lineTo(x4,y4); ctx.stroke();
    }
  }

  #toDisp(v) {
    if (this.#mode==='dbi') { const d=20*Math.log10(Math.max(v,1e-10)); return Math.max(0,1+d/30); }
    if (this.#mode==='power') return v*v;
    return v;
  }

  #drawSurface(ctx, pattern) {
    const NTheta = 50, NPhi = 90; // Higher resolution
    const pts = [];
    let maxR = 0;

    // Compute raw values
    for (let ti = 0; ti <= NTheta; ti++) {
      const theta = (ti / NTheta) * Math.PI;
      for (let pi = 0; pi <= NPhi; pi++) {
        const phi = (pi / NPhi) * 2 * Math.PI;
        const el = Math.abs(pattern.elevation(theta));
        const az = Math.abs(pattern.azimuth(phi));
        const r = el * az;
        if (r > maxR) maxR = r;
        pts.push({ theta, phi, r });
      }
    }

    // Build faces with depth
    const faces = [];
    for (let ti = 0; ti < NTheta; ti++) {
      for (let pi = 0; pi < NPhi; pi++) {
        const idx = (t, p) => t * (NPhi + 1) + p;
        const toVec = ({ r, theta, phi }) => {
          const rn = maxR > 0 ? r / maxR : 0;
          const disp = this.#toDisp(rn) * 0.88;
          return {
            x: disp * Math.sin(theta) * Math.cos(phi),
            y: disp * Math.sin(theta) * Math.sin(phi),
            z: disp * Math.cos(theta),
            rn
          };
        };

        const v00 = toVec(pts[idx(ti, pi)]);
        const v10 = toVec(pts[idx(ti+1, pi)]);
        const v11 = toVec(pts[idx(ti+1, pi+1)]);
        const v01 = toVec(pts[idx(ti, pi+1)]);

        const avgNorm = (v00.rn + v10.rn + v11.rn + v01.rn) / 4;

        const [sx0,sy0,d0] = this.#project(v00.x,v00.y,v00.z);
        const [sx1,sy1,d1] = this.#project(v10.x,v10.y,v10.z);
        const [sx2,sy2,d2] = this.#project(v11.x,v11.y,v11.z);
        const [sx3,sy3,d3] = this.#project(v01.x,v01.y,v01.z);

        const avgDepth = (d0+d1+d2+d3)/4;

        faces.push({ pts:[[sx0,sy0],[sx1,sy1],[sx2,sy2],[sx3,sy3]], norm:avgNorm, depth:avgDepth });
      }
    }

    // Sort back-to-front for correct rendering (painter's algorithm)
    faces.sort((a,b) => b.depth - a.depth);

    for (const f of faces) {
      const color = ColorUtils.map(f.norm);
      ctx.beginPath();
      ctx.moveTo(f.pts[0][0], f.pts[0][1]);
      ctx.lineTo(f.pts[1][0], f.pts[1][1]);
      ctx.lineTo(f.pts[2][0], f.pts[2][1]);
      ctx.lineTo(f.pts[3][0], f.pts[3][1]);
      ctx.closePath();
      // Shading: brighter faces facing viewer, dimmer ones facing away
      const bright = Math.max(0.35, Math.min(1, 0.5 + f.norm * 0.7));
      ctx.fillStyle = color + Math.round(bright * 180).toString(16).padStart(2,'0');
      ctx.fill();
      ctx.strokeStyle = color + '30';
      ctx.lineWidth = 0.25;
      ctx.stroke();
    }
  }

  #drawAxes(ctx) {
    const axies = [
      { end:[1.2,0,0], color:'rgba(255,80,80,0.75)', label:'X' },
      { end:[0,1.2,0], color:'rgba(80,255,80,0.75)', label:'Y' },
      { end:[0,0,1.3], color:'rgba(100,140,255,0.9)', label:'Z' }
    ];

    axies.forEach(({ end, color, label }) => {
      const [ox,oy] = this.#project(0,0,0);
      const [ex,ey] = this.#project(...end);
      ctx.beginPath(); ctx.moveTo(ox,oy); ctx.lineTo(ex,ey);
      ctx.strokeStyle = color; ctx.lineWidth = 1.2;
      ctx.setLineDash([5,3]); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = color;
      ctx.font = '11px "Share Tech Mono"';
      ctx.textAlign = 'center';
      ctx.fillText(label, ex, ey - 9);
    });
  }
}

// ==================== METRICS ====================
class Metrics {
  static calculate(pattern, type, params) {
    const N = 3600;
    const azVals = Array.from({length:N},(_,i)=>Math.abs(pattern.azimuth((i/N)*2*Math.PI)));
    const maxAz = Math.max(...azVals);
    const hpbwAz = Math.round((azVals.filter(v=>v>=maxAz/Math.SQRT2).length/N)*360);
    const elVals = Array.from({length:N},(_,i)=>Math.abs(pattern.elevation((i/N)*Math.PI)));
    const maxEl = Math.max(...elVals);
    const hpbwEl = Math.round((elVals.filter(v=>v>=maxEl/Math.SQRT2).length/N)*180);
    const gMap = { dipole:2.15+(params.dipole.length-0.5)*1.5, monopole:5.15+(params.monopole.length-0.25)*2, array:3.5+(params.array.spacing*2), yagi:2.15+params.yagi.directors*1.8 };
    const gain = Math.max(0, gMap[type]).toFixed(2);
    const fv = pattern.azimuth(0), bv = pattern.azimuth(Math.PI);
    const fb = Math.abs(bv)<1e-6 ? '40.0' : Math.abs(20*Math.log10(Math.abs(fv)/Math.abs(bv))).toFixed(1);
    return { gain, hpbwAz, hpbwEl, fb };
  }
}

// ==================== APP CONTROLLER ====================
class App {
  #state; #az; #el; #r3d;

  constructor() {
    this.#state = new StateManager({
      antennaType: 'dipole', displayMode: 'dbi',
      params: {
        dipole:   { length: 0.5 },
        monopole: { length: 0.25, tilt: 0 },
        array:    { spacing: 0.5, phase: 0 },
        yagi:     { directors: 3, spacing: 0.35 }
      }
    });

    this.#az  = new PolarRenderer('canvas-azimut', 'dbi');
    this.#el  = new PolarRenderer('canvas-elevation', 'dbi');
    this.#r3d = new Renderer3D('canvas-3d', 'dbi');

    this.#bindEvents();
    this.#bindState();
    this.render();
  }

  #bindEvents() {
    // Sidebar antenna buttons
    document.querySelectorAll('.ant-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const t = e.currentTarget.dataset.type;
        this.#activateAntenna(t);
      });
    });

    // Nav dropdown antenna buttons
    document.querySelectorAll('[data-nav-type]').forEach(btn => {
      btn.addEventListener('click', e => {
        const t = e.currentTarget.dataset['nav-type'] || e.currentTarget.dataset.navType;
        this.#activateAntenna(t);
      });
    });

    // Nav dropdown display mode
    document.querySelectorAll('[data-display-mode]').forEach(btn => {
      btn.addEventListener('click', e => {
        const m = e.currentTarget.dataset.displayMode;
        this.#state.set('displayMode', m);
        // sync radio
        const radio = document.getElementById(`mode-${m}`);
        if (radio) radio.checked = true;
      });
    });

    // Sliders
    const sliders = {
      'dipole-length':   (v) => this.#setParam('dipole','length',v,'val-dipole-length'),
      'monopole-length': (v) => this.#setParam('monopole','length',v,'val-monopole-length'),
      'monopole-tilt':   (v) => this.#setParam('monopole','tilt',v,'val-monopole-tilt'),
      'array-spacing':   (v) => this.#setParam('array','spacing',v,'val-array-spacing'),
      'array-phase':     (v) => this.#setParam('array','phase',v,'val-array-phase'),
      'yagi-directors':  (v) => this.#setParam('yagi','directors',v,'val-yagi-directors'),
      'yagi-spacing':    (v) => this.#setParam('yagi','spacing',v,'val-yagi-spacing'),
    };
    Object.entries(sliders).forEach(([id, fn]) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', e => { fn(e.target.value); this.render(); });
    });

    // Display mode radios
    document.querySelectorAll('input[name="display-mode"]').forEach(r => {
      r.addEventListener('change', e => this.#state.set('displayMode', e.target.value));
    });

    // Screenshot buttons
    const screenshotFn = () => this.#screenshot();
    document.getElementById('btn-screenshot').addEventListener('click', screenshotFn);
    const ddSS = document.getElementById('dd-screenshot');
    if (ddSS) ddSS.addEventListener('click', screenshotFn);

    // 3D preset buttons
    document.querySelectorAll('[data-preset]').forEach(btn => {
      btn.addEventListener('click', e => {
        const p = e.currentTarget.dataset.preset;
        document.querySelectorAll('[data-preset]').forEach(b => b.classList.remove('view3d-btn--active'));
        e.currentTarget.classList.add('view3d-btn--active');
        this.#r3d.setPreset(p);
      });
    });

    // Hamburger menu
    const ham = document.getElementById('hamburger');
    const nav = document.getElementById('nav-menu');
    ham.addEventListener('click', () => {
      const open = nav.classList.toggle('navbar__nav--open');
      ham.setAttribute('aria-expanded', open);
      ham.textContent = open ? '✕' : '☰';
    });

    // Dropdown toggles accessible click
    document.querySelectorAll('[aria-haspopup]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        // close all
        document.querySelectorAll('[aria-haspopup]').forEach(b => b.setAttribute('aria-expanded','false'));
        btn.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      });
    });

    // Close dropdowns on outside click
    document.addEventListener('click', e => {
      if (!e.target.closest('.nav-item')) {
        document.querySelectorAll('[aria-haspopup]').forEach(b => b.setAttribute('aria-expanded','false'));
      }
    });

    // Resize
    let rt;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => { this.render(); }, 180);
    });
  }

  #activateAntenna(type) {
    // Sidebar buttons
    document.querySelectorAll('.ant-btn').forEach(b => {
      b.classList.remove('ant-btn--active');
      b.setAttribute('aria-pressed','false');
    });
    const sb = document.querySelector(`.ant-btn[data-type="${type}"]`);
    if (sb) { sb.classList.add('ant-btn--active'); sb.setAttribute('aria-pressed','true'); }

    // Dropdown items
    document.querySelectorAll('[data-nav-type]').forEach(b => b.classList.remove('dropdown__item--active'));
    const nb = document.querySelector(`[data-nav-type="${type}"]`);
    if (nb) nb.classList.add('dropdown__item--active');

    this.#state.set('antennaType', type);

    // Show params
    document.querySelectorAll('.param-group').forEach(g => g.classList.remove('param-group--visible'));
    const grp = document.getElementById(`params-${type}`);
    if (grp) grp.classList.add('param-group--visible');
  }

  #bindState() {
    this.#state.subscribe('displayMode', (m) => {
      this.#az.setMode(m); this.#el.setMode(m); this.#r3d.setMode(m);
      this.render();
    });
  }

  #setParam(type, key, val, outId) {
    const params = this.#state.get('params');
    params[type][key] = parseFloat(val);
    this.#state.set('params', params);
    const out = document.getElementById(outId);
    if (out) out.textContent = parseFloat(val).toFixed(['directors','phase','tilt'].includes(key)?0:2);
  }

  getPattern() {
    const t = this.#state.get('antennaType');
    return AntennaPatterns[t](this.#state.get('params')[t]);
  }

  render() {
    const p = this.getPattern();
    requestAnimationFrame(() => {
      this.#az.render(p.azimuth);
      this.#el.render(p.elevation);
      this.#r3d.render(p);
      this.#updateMetrics(p);
    });
  }

  #updateMetrics(p) {
    const t = this.#state.get('antennaType');
    const params = this.#state.get('params');
    const m = Metrics.calculate(p, t, params);
    document.getElementById('res-gain').textContent = m.gain;
    document.getElementById('res-hpbw-az').textContent = m.hpbwAz + '°';
    document.getElementById('res-hpbw-el').textContent = m.hpbwEl + '°';
    document.getElementById('res-fb').textContent = m.fb;
  }

  #screenshot() {
    const W=1440, H=920;
    const c = document.createElement('canvas');
    c.width=W; c.height=H;
    const ctx = c.getContext('2d');
    ctx.fillStyle='#020810'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#00e5ff';
    ctx.font='bold 22px "Exo 2", sans-serif';
    ctx.fillText(`Patrón de Radiación — ${this.#state.get('antennaType').toUpperCase()} | Modo: ${this.#state.get('displayMode')}`, 20, 38);
    ctx.fillStyle='rgba(0,229,255,0.4)';
    ctx.font='13px "Share Tech Mono"';
    ctx.fillText('Ing. Yanileidi Hechavarria Vaillant · Visualizador de Patrones de Radiación', 20, 60);

    const az = document.getElementById('canvas-azimut');
    const el = document.getElementById('canvas-elevation');
    const d3 = document.getElementById('canvas-3d');

    ctx.drawImage(az, 20, 80, 450, 450);
    ctx.drawImage(el, 490, 80, 450, 450);
    ctx.drawImage(d3, 20, 550, 1400, 350);

    const a = document.createElement('a');
    a.download = `patron_radiacion_${this.#state.get('antennaType')}_${Date.now()}.png`;
    a.href = c.toDataURL('image/png');
    a.click();
  }
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
  try {
    window.app = new App();
  } catch(e) {
    console.error('Error al inicializar:', e);
  }
});
