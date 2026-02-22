================================================================================
VISUALIZADOR DE PATRONES DE RADIACIÓN DE ANTENAS
================================================================================
Versión: 3.1.0
Autor: Ing. Yanileidi Hechavarria Vaillant
Fecha: 2025
Licencia: MIT
================================================================================

DESCRIPCIÓN
--------------------------------------------------------------------------------
Aplicación web interactiva para la visualización de patrones de radiación de 
antenas. Permite simular diferentes tipos de antenas (dipolo, monopolo, arreglo 
2E, Yagi-Uda) con visualización en tiempo real de patrones polares 2D y 
representaciones 3D interactivas.

ESTRUCTURA DE ARCHIVOS
--------------------------------------------------------------------------------
1. index.html    - Estructura HTML5, semántica y accesible (WCAG 2.1 AA)
2. styles.css    - Hojas de estilo CSS con diseño responsive y temática oscura
3. app.js        - Lógica JavaScript (ES2022+) para simulación y renderizado
4. readme.txt    - Este archivo de documentación

CARACTERÍSTICAS TÉCNICAS
--------------------------------------------------------------------------------
• HTML5 semántico con atributos ARIA para accesibilidad
• CSS Grid y Flexbox para layouts responsivos
• JavaScript modular con clases ES6 (StateManager, PolarRenderer, Renderer3D)
• Canvas API para renderizado 2D/3D sin dependencias externas
• Soporte para interacción táctil y mouse
• Modos de visualización: dBi, Densidad de Potencia, Escala Lineal
• Cálculo de métricas: Ganancia, HPBW (Half-Power Beamwidth), F/B Ratio

TIPOS DE ANTENA SOPORTADAS
--------------------------------------------------------------------------------
1. Dipolo (λ/2)      - Antena de referencia omnidireccional
2. Monopolo (λ/4)    - Antena vertical con plano de tierra
3. Arreglo 2E        - Arreglo de dos elementos con control de fase
4. Yagi-Uda          - Antena directiva con directores y reflector

INSTRUCCIONES DE USO
--------------------------------------------------------------------------------
1. Coloque los tres archivos (index.html, styles.css, app.js) en el mismo 
   directorio
2. Abra index.html en un navegador web moderno (Chrome, Firefox, Edge, Safari)
3. Seleccione el tipo de antena desde el panel lateral o menú de navegación
4. Ajuste los parámetros usando los controles deslizantes
5. Interactúe con la vista 3D arrastrando para rotar y usando la rueda del 
   ratón para zoom
6. Use el botón "Capturar Imagen" para guardar una captura de pantalla

REQUISITOS DEL NAVEGADOR
--------------------------------------------------------------------------------
• Soporte para ES2022 (JavaScript moderno)
• Canvas 2D Context
• CSS Variables (Custom Properties)
• Preferiblemente: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

CRÉDITOS
--------------------------------------------------------------------------------
Diseño y Desarrollo: Ing. Yanileidi Hechavarria Vaillant
Ing. Yeslei M. Causse Viñals
Ingeniería de Telecomunicaciones

Recursos externos referenciados:
• Antenna Theory Online (antenna-theory.com)
• ITU Recomendaciones
• ARRL Antenna Design

NOTAS DE IMPLEMENTACIÓN
--------------------------------------------------------------------------------
• El código JavaScript utiliza campos privados (#) de ES2022
• Se implementa el patrón de diseño Observer para gestión de estado
• Los cálculos de patrones de radiación utilizan aproximaciones matemáticas
  estándar de teoría de antenas
• El renderizado 3D utiliza el algoritmo del pintor (painter's algorithm) para
  ordenamiento de superficies

================================================================================
© 2025 Ing. Yanileidi Hechavarria Vaillant. Todos los derechos reservados.
================================================================================
