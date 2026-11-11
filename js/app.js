/* ==========================================================================
   Módulo Principal (Orquestador de la Aplicación de Control)
   ========================================================================== */

import { ApiService } from './api.js';
import { WebSocketService } from './websocket.js';
import { JoystickController } from './joystick.js';

document.addEventListener('DOMContentLoaded', () => {
  // ------------------------------------------------------------------------
  // Elementos del DOM
  // ------------------------------------------------------------------------
  const badgeWs = document.getElementById('badge-ws');
  const badgeApi = document.getElementById('badge-api');
  const badgeRds = document.getElementById('badge-rds');

  const estadoJoystickText = document.getElementById('estado-joystick');
  const joystickZone = document.getElementById('joystick-zone');
  const joystickKnob = document.getElementById('joystick-knob');

  const btnStopGlobal = document.getElementById('btn-stop-global');
  const selectDemo = document.getElementById('select-demo');
  const btnEjecutarDemo = document.getElementById('btn-ejecutar-demo');

  const statusMessage = document.getElementById('status-message');
  const statusTimestamp = document.getElementById('status-timestamp');
  const btnThemeToggle = document.getElementById('btn-theme-toggle');

  const ID_VEHICULO = 1;
  let ejecucionDemoEnProceso = false;

  // ------------------------------------------------------------------------
  // 1. Mensajes de Estado en Pantalla
  // ------------------------------------------------------------------------
  function logMensaje(texto, esError = false) {
    const ahora = new Date();
    const horaStr = ahora.toLocaleTimeString();

    statusMessage.textContent = texto;
    statusMessage.className = esError ? 'text-danger fw-bold' : 'text-secondary';
    statusTimestamp.textContent = horaStr;
  }

  // ------------------------------------------------------------------------
  // 2. Inicialización de WebSocket y Badge de Conectividad
  // ------------------------------------------------------------------------
  const wsService = new WebSocketService(
    // Callback cuando llega un mensaje de WebSocket
    (data) => {
      console.log('[WebSocket Event Received]:', data);
      if (data.evento === 'MOVIMIENTO_INDIVIDUAL') {
        logMensaje(`Evento WSS recibido: Comando #${data.id_comando}`);
      } else if (data.evento === 'MOVIMIENTO_DEMO') {
        logMensaje(`DEMO WSS: ${data.comando} (${data.duracion_ms}ms)`);
      }
    },
    // Callback de cambio de estado del socket
    (estado) => {
      if (estado === 'ONLINE') {
        badgeWs.className = 'badge bg-success text-white mt-1';
        badgeWs.innerHTML = '<i class="bi bi-wifi"></i> En línea';
        logMensaje('WebSocket conectado exitosamente.');
      } else if (estado === 'CONECTANDO') {
        badgeWs.className = 'badge bg-warning text-dark mt-1';
        badgeWs.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Conectando...';
      } else {
        badgeWs.className = 'badge bg-danger text-white mt-1';
        badgeWs.innerHTML = '<i class="bi bi-wifi-off"></i> Desconectado';
        logMensaje('Conexión WebSocket perdida.', true);
      }
    }
  );

  wsService.conectar();

  // ------------------------------------------------------------------------
  // 3. Verificación Periódica de API AWS y Amazon RDS
  // ------------------------------------------------------------------------
  async function verificarSaludServicios() {
    badgeApi.className = 'badge bg-warning text-dark mt-1';
    badgeApi.innerHTML = '<i class="bi bi-hourglass-split spin"></i> Comprobando';

    const apiDisponible = await ApiService.comprobarSaludApi();

    if (apiDisponible) {
      badgeApi.className = 'badge bg-success text-white mt-1';
      badgeApi.innerHTML = '<i class="bi bi-check-circle-fill"></i> Disponible';
      
      // Si la API responde correctamente a /status, la base de datos MySQL en RDS está operativa
      badgeRds.className = 'badge bg-success text-white mt-1';
      badgeRds.innerHTML = '<i class="bi bi-database-check"></i> Disponible';
    } else {
      badgeApi.className = 'badge bg-danger text-white mt-1';
      badgeApi.innerHTML = '<i class="bi bi-x-circle-fill"></i> No disponible';

      badgeRds.className = 'badge bg-secondary mt-1';
      badgeRds.innerHTML = '<i class="bi bi-database-dash"></i> Sin verificar';
    }
  }

  verificarSaludServicios();
  setInterval(verificarSaludServicios, 15000); // Comprobar cada 15s

  // ------------------------------------------------------------------------
  // 4. Envío de Movimiento Generico
  // ------------------------------------------------------------------------
  async function enviarMovimiento(idComando, etiqueta = '') {
    try {
      logMensaje(`Solicitando comando #${idComando} ${etiqueta}...`);
      await ApiService.registrarMovimiento(idComando, ID_VEHICULO, 'JOYSTICK_WEB');
    } catch (e) {
      logMensaje(`Error enviando comando #${idComando}`, true);
    }
  }

  // ------------------------------------------------------------------------
  // 5. Joystick Virtual
  // ------------------------------------------------------------------------
  new JoystickController(
    joystickZone,
    joystickKnob,
    (idComando) => {
      enviarMovimiento(idComando);
    },
    (etiqueta) => {
      estadoJoystickText.textContent = etiqueta;
      estadoJoystickText.className = etiqueta === 'NEUTRAL' 
        ? 'badge bg-secondary' 
        : 'badge bg-warning text-dark fw-bold';
    }
  );

  // ------------------------------------------------------------------------
  // 6. Botón DETENER Prioritario (STOP)
  // ------------------------------------------------------------------------
  btnStopGlobal.addEventListener('click', () => {
    logMensaje('¡PARADA DE EMERGENCIA ENVIADA!');
    enviarMovimiento(0, '(STOP)');
  });

  // ------------------------------------------------------------------------
  // 7. Botones Auxiliares (Garra, Giros, etc.)
  // ------------------------------------------------------------------------
  document.querySelectorAll('.btn-cmd').forEach((btn) => {
    btn.addEventListener('click', () => {
      const comandoId = parseInt(btn.getAttribute('data-comando'), 10);
      const textoBtn = btn.innerText.trim();

      btn.classList.add('enviando');
      enviarMovimiento(comandoId, `(${textoBtn})`);

      setTimeout(() => btn.classList.remove('enviando'), 300);
    });
  });

  // ------------------------------------------------------------------------
  // 8. Carga y Ejecución de DEMOs
  // ------------------------------------------------------------------------
  async function cargarDemosDisponibles() {
    try {
      const demos = await ApiService.obtenerDemos(ID_VEHICULO);
      selectDemo.innerHTML = '';

      if (Array.isArray(demos) && demos.length > 0) {
        demos.forEach((d) => {
          const option = document.createElement('option');
          option.value = d.id_demo || d[0];
          option.textContent = d.nombre || `DEMO #${option.value}`;
          selectDemo.appendChild(option);
        });
        btnEjecutarDemo.disabled = false;
      } else {
        selectDemo.innerHTML = '<option value="">Sin DEMOs disponibles</option>';
        btnEjecutarDemo.disabled = true;
      }
    } catch (e) {
      selectDemo.innerHTML = '<option value="">Error al cargar DEMOs</option>';
      btnEjecutarDemo.disabled = true;
    }
  }

  cargarDemosDisponibles();

  btnEjecutarDemo.addEventListener('click', async () => {
    const idDemo = selectDemo.value;
    if (!idDemo || ejecucionDemoEnProceso) return;

    ejecucionDemoEnProceso = true;
    btnEjecutarDemo.disabled = true;
    logMensaje(`Iniciando ejecución de DEMO #${idDemo}...`);

    try {
      await ApiService.ejecutarDemo(idDemo, ID_VEHICULO);
      logMensaje(`DEMO #${idDemo} enviada al servidor con éxito.`);
    } catch (e) {
      logMensaje(`Fallo al ejecutar DEMO #${idDemo}`, true);
    } finally {
      ejecucionDemoEnProceso = false;
      btnEjecutarDemo.disabled = false;
    }
  });

  // ------------------------------------------------------------------------
  // 9. Alternar Tema Claro / Oscuro (Bootstrap 5)
  // ------------------------------------------------------------------------
  if (btnThemeToggle) {
    btnThemeToggle.addEventListener('click', () => {
      const htmlEl = document.documentElement;
      const temaActual = htmlEl.getAttribute('data-bs-theme');
      const nuevoTema = temaActual === 'dark' ? 'light' : 'dark';

      htmlEl.setAttribute('data-bs-theme', nuevoTema);
      btnThemeToggle.innerHTML = nuevoTema === 'dark' 
        ? '<i class="bi bi-sun-fill"></i>' 
        : '<i class="bi bi-moon-stars-fill"></i>';
    });
  }
});