import { JoystickController } from './joystick.js';
import { Excavator3DManager } from './excavator3d.js';

document.addEventListener('DOMContentLoaded', () => {
    const BASE_URL = 'https://control-iot-uriel.duckdns.org';
    const WS_URL = 'wss://control-iot-uriel.duckdns.org/ws/1';
    const ID_VEHICULO = 1;

    // Catálogo idéntico a la tabla `comandos` en Amazon RDS (IDs 11 al 21)
    const NOMBRES_COMANDOS = {
        11: 'AVANZAR',
        12: 'RETROCEDER',
        13: 'GIRAR IZQUIERDA',
        14: 'GIRAR DERECHA',
        15: 'GIRA CABINA IZQUIERDA',
        16: 'GIRA CABINA DERECHA',
        17: 'ELEVAR GARRA',
        18: 'BAJAR GARRA',
        19: 'VELOCIDAD',
        20: 'ENC/APAG',
        21: 'SONIDO'
    };

    function normalizarIdComando(rawCodigo) {
        if (rawCodigo === null || rawCodigo === undefined || rawCodigo === '') return null;
        const num = Number(rawCodigo);
        if (isNaN(num)) return null;
        // Convierte códigos 101..111 de RDS a sus IDs reales 11..21
        if (num >= 101 && num <= 111) return num - 90;
        return num;
    }

    function obtenerIconoMovimiento(codigo, texto = '') {
        const c = normalizarIdComando(codigo);
        const upper = String(texto).toUpperCase();

        if (c === 11 || upper.includes('AVANZAR')) {
            return { icon: 'bx bx-up-arrow-alt', theme: 'move-mode' };
        }
        if (c === 12 || upper.includes('RETROCEDER')) {
            return { icon: 'bx bx-down-arrow-alt', theme: 'move-mode' };
        }
        if (c === 13 || upper === 'GIRAR IZQUIERDA' || upper === 'IZQUIERDA') {
            return { icon: 'bx bx-left-arrow-alt', theme: 'turn-mode' };
        }
        if (c === 14 || upper === 'GIRAR DERECHA' || upper === 'DERECHA') {
            return { icon: 'bx bx-right-arrow-alt', theme: 'turn-mode' };
        }
        if (c === 15 || upper.includes('CABINA IZQ')) {
            return { icon: 'bx bx-undo', theme: 'turn-mode' };
        }
        if (c === 16 || upper.includes('CABINA DER')) {
            return { icon: 'bx bx-redo', theme: 'turn-mode' };
        }
        if (c === 17 || upper.includes('ELEVAR') || upper.includes('SUBIR')) {
            return { icon: 'bx bx-up-arrow-circle', theme: '' };
        }
        if (c === 18 || upper.includes('BAJAR')) {
            return { icon: 'bx bx-down-arrow-circle', theme: '' };
        }
        if (c === 19 || upper.includes('VELOCIDAD')) {
            return { icon: 'bx bx-tachometer', theme: '' };
        }
        if (c === 20 || upper.includes('ENC/APAG') || upper.includes('STOP') || upper.includes('DETENER')) {
            return { icon: 'bx bxs-octagon', theme: 'stop-mode' };
        }
        if (c === 21 || upper.includes('SONIDO')) {
            return { icon: 'bx bx-volume-full', theme: 'turn-mode' };
        }
        return { icon: 'bx bx-radio-circle-marked', theme: '' };
    }

    // =========================================================
    // 1. INICIALIZAR MOTOR 3D REAL (THREE.JS) + TOGGLE MÓVIL
    // =========================================================
    const sim3D = new Excavator3DManager([
        document.getElementById('preview-3d-container'),
        document.getElementById('full-3d-canvas-container')
    ]);

    const btnMobileToggle3D = document.getElementById('btn-mobile-toggle-3d');
    const mobileSimCard = document.getElementById('mobile-sim-card');
    const mobileToggleText = document.getElementById('mobile-3d-toggle-text');
    const mobileToggleIcon = document.getElementById('mobile-3d-toggle-icon');

    if (btnMobileToggle3D && mobileSimCard) {
        btnMobileToggle3D.addEventListener('click', () => {
            const isExpanded = mobileSimCard.classList.toggle('expanded');
            if (mobileToggleText) {
                mobileToggleText.textContent = isExpanded ? 'Ocultar Simulación 3D' : 'Mostrar Simulación 3D';
            }
            if (mobileToggleIcon) {
                mobileToggleIcon.className = isExpanded ? 'bx bx-chevron-up' : 'bx bx-chevron-down';
            }
        });
    }

    const hudAngle = document.getElementById('hud-angle');
    const hudArm = document.getElementById('hud-arm');
    const hudState = document.getElementById('hud-state');
    const hudAngleFull = document.getElementById('hud-angle-full');
    const hudArmFull = document.getElementById('hud-arm-full');
    const hudPosFull = document.getElementById('hud-pos-full');
    const directionBadge = document.getElementById('joystick-direction');

    setInterval(() => {
        const t = sim3D.getTelemetry();
        if (hudAngle) hudAngle.textContent = `${t.angleDeg}°`;
        if (hudArm) hudArm.textContent = `${t.armPct}%`;
        if (hudAngleFull) hudAngleFull.textContent = `${t.angleDeg}°`;
        if (hudArmFull) hudArmFull.textContent = `${t.armPct}%`;
        if (hudPosFull) hudPosFull.textContent = `${t.posX}, ${t.posZ}`;
    }, 100);

    // =========================================================
    // 2. VERIFICACIÓN REAL DE AWS EC2, AMAZON RDS Y WEBSOCKET
    // =========================================================
    const logText = document.getElementById('last-log-text');
    const logTime = document.getElementById('last-log-time');
    const btnWsToggle = document.getElementById('btn-ws-toggle');

    let wsOnline = false;
    let apiOnline = false;
    let rdsOnline = false;

    function registrarEvento(mensaje) {
        if (logText) logText.textContent = mensaje;
        if (logTime) logTime.textContent = new Date().toLocaleTimeString();
    }

    function setBadgeState(barId, iconId, textId, state, label, iconClass) {
        const bar = document.getElementById(barId);
        const icon = document.getElementById(iconId);
        const text = document.getElementById(textId);
        if (bar) bar.className = `status-pill-bar ${state}`;
        if (icon) icon.className = iconClass;
        if (text) text.textContent = label;
        actualizarBadgeGlobal();
    }

    function actualizarBadgeGlobal() {
        const globalBadge = document.getElementById('global-conn-badge');
        const globalText = document.getElementById('global-conn-text');
        if (!globalBadge || !globalText) return;

        if (wsOnline && apiOnline && rdsOnline) {
            globalBadge.className = 'connection-badge online';
            globalText.textContent = 'Sistema 100% En Línea';
        } else if (apiOnline || wsOnline) {
            globalBadge.className = 'connection-badge checking';
            globalText.textContent = wsOnline ? 'WSS Activo • Revisar RDS' : 'API Activa • WSS Off';
        } else {
            globalBadge.className = 'connection-badge offline';
            globalText.textContent = 'Servidor Desconectado';
        }
    }

    async function verificarSaludBackend() {
        setBadgeState('api-status-bar', 'api-status-icon', 'api-status', 'checking', 'Verificando...', 'bx bx-loader-alt bx-spin');
        setBadgeState('rds-status-bar', 'rds-status-icon', 'rds-status', 'checking', 'Verificando...', 'bx bx-loader-alt bx-spin');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4500);

        try {
            const resp = await fetch(`${BASE_URL}/vehiculos/1/historial?_t=${Date.now()}`, {
                cache: 'no-store',
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (resp.status < 500) {
                apiOnline = true;
                setBadgeState('api-status-bar', 'api-status-icon', 'api-status', 'online', 'EC2 Activa', 'bx bx-check-circle');
            } else {
                apiOnline = false;
                rdsOnline = false;
                setBadgeState('api-status-bar', 'api-status-icon', 'api-status', 'offline', `HTTP ${resp.status}`, 'bx bx-x-circle');
                setBadgeState('rds-status-bar', 'rds-status-icon', 'rds-status', 'offline', 'Sin RDS', 'bx bx-x-circle');
                return;
            }

            if (resp.ok) {
                const data = await resp.json();
                const tieneEstructuraReal = Array.isArray(data) || Array.isArray(data.historial) || Array.isArray(data.datos);
                if (tieneEstructuraReal && data.status !== 'error') {
                    rdsOnline = true;
                    setBadgeState('rds-status-bar', 'rds-status-icon', 'rds-status', 'online', 'RDS Conectada', 'bx bx-check-circle');
                } else {
                    rdsOnline = false;
                    setBadgeState('rds-status-bar', 'rds-status-icon', 'rds-status', 'offline', 'Error RDS', 'bx bx-x-circle');
                }
            } else {
                rdsOnline = false;
                setBadgeState('rds-status-bar', 'rds-status-icon', 'rds-status', 'offline', 'Sin respuesta DB', 'bx bx-x-circle');
            }
        } catch (err) {
            clearTimeout(timeoutId);
            apiOnline = false;
            rdsOnline = false;
            setBadgeState('api-status-bar', 'api-status-icon', 'api-status', 'offline', 'Sin EC2', 'bx bx-x-circle');
            setBadgeState('rds-status-bar', 'rds-status-icon', 'rds-status', 'offline', 'Sin RDS', 'bx bx-x-circle');
        }
    }

    async function cargarDemosDisponibles() {
        const seqSelect = document.getElementById('sequence-select');
        if (!seqSelect) return;

        try {
            const resp = await fetch(`${BASE_URL}/demos?_t=${Date.now()}`, { cache: 'no-store' });
            if (!resp.ok) return;
            const data = await resp.json();
            const lista = Array.isArray(data) ? data : (data.demos || data.datos || []);
            if (lista.length > 0) {
                seqSelect.innerHTML = lista.map((d, idx) => {
                    const id = d.id_demo ?? d.id ?? (idx + 1);
                    const nombre = d.nombre || (idx === 0 ? 'Demo Principal' : 'Demo Personalizada');
                    return `<option value="${id}">${nombre}</option>`;
                }).join('');
            }
        } catch (_) { }
    }

    // =========================================================
    // 3. PESTAÑA DE MONITOREO E HISTORIAL RDS (IDs 11 AL 21)
    // =========================================================
    function actualizarPanelUltimoMovimiento(codigo, nombreAccion, origen = 'WEB', fechaCustom = null, horaCustom = null) {
        const now = new Date();
        const actionEl = document.getElementById('mon-last-action');
        const codeEl = document.getElementById('mon-codigo');
        const dateEl = document.getElementById('mon-fecha');
        const timeEl = document.getElementById('mon-hora');
        const originEl = document.getElementById('mon-origin-text');
        const iconBox = document.getElementById('mon-action-icon-box');
        const iconEl = document.getElementById('mon-action-icon');

        const idReal = normalizarIdComando(codigo);
        const nombreLimpio = ((idReal !== null && NOMBRES_COMANDOS[idReal]) || nombreAccion || 'MOVIMIENTO').toUpperCase();
        const visual = obtenerIconoMovimiento(idReal ?? codigo, nombreLimpio);

        if (actionEl) actionEl.textContent = nombreLimpio;
        if (codeEl) codeEl.textContent = idReal !== null ? `#${idReal}` : '—';
        if (dateEl) dateEl.textContent = fechaCustom || now.toLocaleDateString('es-MX');
        if (timeEl) timeEl.textContent = horaCustom || now.toLocaleTimeString('es-MX');
        if (originEl) originEl.textContent = `Origen: ${origen} • Sincronizado con RDS`;

        if (iconBox) iconBox.className = `pulse-wave-icon ${visual.theme}`.trim();
        if (iconEl) iconEl.className = visual.icon;
    }

    async function cargarHistorialRDS() {
        const tbody = document.getElementById('history-table-body');
        if (!tbody) return;

        try {
            const resp = await fetch(`${BASE_URL}/vehiculos/${ID_VEHICULO}/historial?_t=${Date.now()}`, { cache: 'no-store' });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            const registros = Array.isArray(data) ? data : (data.historial || data.datos || []);

            if (registros.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="table-empty-msg">Sin movimientos individuales registrados aún en RDS.</td></tr>';
                return;
            }

            tbody.innerHTML = registros.slice(0, 10).map((item, index) => {
                const rawCod = item.id_comando ?? item.codigo;
                const idReal = normalizarIdComando(rawCod);
                const nombre = ((idReal !== null && NOMBRES_COMANDOS[idReal]) || item.comando || item.nombre || item.nombre_comando || 'MOVIMIENTO').toUpperCase();
                const orig = item.origen || 'WEB';
                const visual = obtenerIconoMovimiento(idReal ?? rawCod, nombre);
                const rawFecha = item.fecha_hora || item.fecha || '';
                let fechaStr = 'Hoy';
                let horaStr = '—';

                if (rawFecha) {
                    const parsed = new Date(rawFecha);
                    if (!isNaN(parsed)) {
                        fechaStr = parsed.toLocaleDateString('es-MX');
                        horaStr = parsed.toLocaleTimeString('es-MX');
                    } else {
                        fechaStr = rawFecha;
                    }
                }

                if (index === 0) {
                    actualizarPanelUltimoMovimiento(idReal, nombre, orig, fechaStr, horaStr);
                }

                const etiquetaTabla = idReal !== null ? `#${idReal} • ${nombre}` : nombre;

                return `
                    <tr>
                        <td>${index + 1}</td>
                        <td><i class="${visual.icon} text-amber" style="vertical-align: middle; margin-right: 4px;"></i><strong>${etiquetaTabla}</strong></td>
                        <td>${orig}</td>
                        <td>${fechaStr}</td>
                        <td>${horaStr}</td>
                    </tr>
                `;
            }).join('');
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="5" class="table-empty-msg">No se pudo leer el historial de RDS (${err.message}).</td></tr>`;
        }
    }

    document.getElementById('btn-reload-history')?.addEventListener('click', cargarHistorialRDS);

    // =========================================================
    // 4. CONEXIÓN WEBSOCKET REAL (MANUAL + VALIDACIÓN DE HANDSHAKE)
    // =========================================================
    let socket = null;

    function desconectarWebSocket() {
        if (socket) {
            socket.close();
            socket = null;
        }
        wsOnline = false;
        btnWsToggle?.classList.remove('connected');
        setBadgeState('ws-status-bar', 'ws-status-icon', 'ws-status', 'offline', 'Desconectado', 'bx bx-wifi-off');
        registrarEvento('Túnel WebSocket cerrado manualmente.');
    }

    function conectarWebSocket() {
        if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
            desconectarWebSocket();
            return;
        }

        wsOnline = false;
        setBadgeState('ws-status-bar', 'ws-status-icon', 'ws-status', 'checking', 'Conectando...', 'bx bx-loader-alt bx-spin');
        registrarEvento('Solicitando apertura de túnel WebSocket...');

        try {
            socket = new WebSocket(WS_URL);

            socket.onopen = () => {
                registrarEvento('Socket abierto, esperando saludo JSON del servidor...');
            };

            socket.onmessage = (event) => {
                if (!wsOnline && socket && socket.readyState === WebSocket.OPEN) {
                    wsOnline = true;
                    btnWsToggle?.classList.add('connected');
                    setBadgeState('ws-status-bar', 'ws-status-icon', 'ws-status', 'online', 'En línea', 'bx bx-broadcast');
                }
                registrarEvento(`WSS ← ${event.data}`);

                try {
                    const payload = JSON.parse(event.data);
                    if (payload && payload.id_comando !== undefined) {
                        const cmdNum = normalizarIdComando(payload.id_comando);
                        const etiqueta = NOMBRES_COMANDOS[cmdNum] || `CMD ${cmdNum}`;
                        sim3D.aplicarComando(cmdNum, etiqueta);
                        if (hudState) hudState.textContent = etiqueta;
                        if (directionBadge) directionBadge.textContent = etiqueta;
                        actualizarPanelUltimoMovimiento(cmdNum, etiqueta, payload.origen || 'WSS');
                        cargarHistorialRDS();
                    }
                } catch (_) { }
            };

            socket.onerror = () => {
                wsOnline = false;
                btnWsToggle?.classList.remove('connected');
                setBadgeState('ws-status-bar', 'ws-status-icon', 'ws-status', 'offline', 'Error WSS', 'bx bx-wifi-off');
                registrarEvento('Fallo al conectar WebSocket WSS.');
            };

            socket.onclose = () => {
                wsOnline = false;
                btnWsToggle?.classList.remove('connected');
                setBadgeState('ws-status-bar', 'ws-status-icon', 'ws-status', 'offline', 'Desconectado', 'bx bx-wifi-off');
                registrarEvento('Conexión WebSocket cerrada.');
                socket = null;
            };
        } catch (err) {
            wsOnline = false;
            setBadgeState('ws-status-bar', 'ws-status-icon', 'ws-status', 'offline', 'No disponible', 'bx bx-wifi-off');
        }
    }

    btnWsToggle?.addEventListener('click', conectarWebSocket);

    verificarSaludBackend();
    cargarDemosDisponibles();
    cargarHistorialRDS();

    document.getElementById('btn-refresh-status')?.addEventListener('click', () => {
        verificarSaludBackend();
        cargarDemosDisponibles();
        cargarHistorialRDS();
    });

    // =========================================================
    // 5. ENVÍO DE COMANDOS A FASTAPI + SIMULACIÓN 3D
    // =========================================================
    async function enviarComando(idComando, etiquetaPersonalizada = null, origen = 'WEB') {
        const cmdNum = normalizarIdComando(idComando);
        const etiqueta = NOMBRES_COMANDOS[cmdNum] || etiquetaPersonalizada || `CMD ${cmdNum}`;

        sim3D.aplicarComando(cmdNum, etiqueta);
        if (hudState) hudState.textContent = etiqueta;
        if (directionBadge) directionBadge.textContent = etiqueta;
        registrarEvento(`Comando [#${cmdNum}]: ${etiqueta}`);
        actualizarPanelUltimoMovimiento(cmdNum, etiqueta, origen);

        try {
            const resp = await fetch(`${BASE_URL}/vehiculos/movimiento`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_vehiculo: ID_VEHICULO,
                    id_comando: cmdNum,
                    origen
                })
            });
            if (resp.ok) {
                cargarHistorialRDS();
            } else {
                registrarEvento(`Aviso API (${resp.status}) al ejecutar ${etiqueta}`);
            }
        } catch (_) {
            registrarEvento(`Modo 3D local (sin conexión a EC2): ${etiqueta}`);
        }
    }

    // Joystick Virtual (11=Avanzar, 12=Retroceder, 13=Girar Izq, 14=Girar Der, 0=Soltar/Neutral)
    const zoneEl = document.getElementById('joystick-zone');
    const knobEl = document.getElementById('joystick-knob');

    if (zoneEl && knobEl) {
        new JoystickController(
            zoneEl,
            knobEl,
            (idComando) => {
                if (idComando > 0) {
                    enviarComando(idComando, NOMBRES_COMANDOS[idComando], 'JOYSTICK');
                }
            },
            (etiqueta) => {
                if (directionBadge) directionBadge.textContent = etiqueta;
                if (hudState) hudState.textContent = etiqueta;
                if (etiqueta === 'NEUTRAL') {
                    sim3D.aplicarComando(0, 'NEUTRAL');
                }
            }
        );
    }

    // Botones de actuadores: 1 comando al presionar, 1 STOP instantáneo al soltar
    document.querySelectorAll('.actuator-btn').forEach((btn) => {
        let activo = false;
        btn.style.touchAction = 'none';

        const iniciarPulsacion = (e) => {
            e.preventDefault();
            if (activo) return;
            activo = true;
            enviarComando(btn.dataset.cmd, btn.dataset.label, 'BOTON_WEB');
        };

        const terminarPulsacion = () => {
            if (!activo) return;
            activo = false;
            enviarComando(0, 'DETENER (STOP)', 'BOTON_WEB');
        };

        btn.addEventListener('pointerdown', iniciarPulsacion);
        btn.addEventListener('pointerup', terminarPulsacion);
        btn.addEventListener('pointerleave', terminarPulsacion);
        btn.addEventListener('pointercancel', terminarPulsacion);
    });

    // Botón Stop / Enc-Apag (ID 20 real de RDS)
    document.getElementById('btn-stop')?.addEventListener('click', () => {
        enviarComando(20, 'ENC/APAG', 'STOP_WEB');
    });

    const btnRunSeq = document.getElementById('btn-run-sequence');
    const seqSelect = document.getElementById('sequence-select');
    if (btnRunSeq && seqSelect) {
        btnRunSeq.addEventListener('click', async () => {
            const idDemo = seqSelect.value;
            const nombre = seqSelect.options[seqSelect.selectedIndex].text;
            registrarEvento(`Iniciando secuencia: ${nombre}...`);
            actualizarPanelUltimoMovimiento(20, nombre.toUpperCase(), 'DEMO_WEB');
            try {
                await fetch(`${BASE_URL}/demos/${idDemo}/ejecutar?id_vehiculo=${ID_VEHICULO}`, { method: 'POST' });
            } catch (_) {
                registrarEvento(`No se pudo iniciar ${nombre}: servidor fuera de línea.`);
            }
        });
    }

    // =========================================================
    // 6. RECONOCIMIENTO DE VOZ HÍBRIDO (PC EN VIVO + MÓVIL WHISPER)
    // =========================================================
    const btnVoiceMic = document.getElementById('btn-voice-mic');
    const micWrapper = document.getElementById('mic-orb-wrapper');
    const voiceStatusLabel = document.getElementById('voice-status-label');
    const voiceTranscriptText = document.getElementById('voice-transcript-text');

    let recognition = null;
    let isListening = false;
    let textoCapturado = '';
    let comandoEnviado = false;

    let mediaRecorder = null;
    let audioChunks = [];
    let isRecordingMobile = false;
    let autoStopTimer = null;

    const esDispositivoMovil = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    async function animarPasosEn3D(pasos) {
        for (const paso of pasos) {
            const etiqueta = paso.comando || `CMD ${paso.id_comando}`;
            sim3D.aplicarComando(etiqueta);
            if (hudState) hudState.textContent = etiqueta;
            if (directionBadge) directionBadge.textContent = etiqueta;
            if (typeof actualizarPanelUltimoMovimiento === 'function') {
                actualizarPanelUltimoMovimiento(paso.id_comando, etiqueta, 'VOZ_IA');
            }
            await new Promise((r) => setTimeout(r, (paso.duracion_ms || 800) + (paso.pausa_ms || 150)));
        }
        sim3D.aplicarComando('NEUTRAL');
        if (hudState) hudState.textContent = 'NEUTRAL';
        if (directionBadge) directionBadge.textContent = 'NEUTRAL';
    }

    function manejarRespuestaIA(frase, data) {
        const pasos = Array.isArray(data.pasos) ? data.pasos : [];

        if (pasos.length > 0) {
            voiceTranscriptText.textContent = `"${frase}" → 🤖 ${data.respuesta}`;
            registrarEvento(`IA Voz [${pasos.length} paso${pasos.length > 1 ? 's' : ''}]: ${data.respuesta}`);
            animarPasosEn3D(pasos);
        } else if (data.id_comando) {
            const etiqueta = data.comando || `CMD ${data.id_comando}`;
            animarPasosEn3D([{ id_comando: data.id_comando, comando: etiqueta, duracion_ms: 1000, pausa_ms: 150 }]);
            voiceTranscriptText.textContent = `"${frase}" → 🤖 ${data.respuesta}`;
            registrarEvento(`IA Voz [${data.id_comando}]: ${etiqueta} (${data.respuesta})`);
        } else {
            const aviso = data.respuesta || data.detail || 'No se reconoció una acción válida';
            voiceTranscriptText.textContent = `"${frase}" → 🤖 ${aviso}`;
            registrarEvento(`IA Voz: ${aviso}`);
        }
    }

    // --- MODO PC: Texto en vivo -> /ia/interpretar-voz ---
    async function procesarTextoConIA(textoFinal) {
        const frase = textoFinal.trim();
        if (!frase || comandoEnviado) return;
        comandoEnviado = true;

        voiceStatusLabel.textContent = 'Interpretando con IA OpenAI...';
        try {
            const resp = await fetch(`${BASE_URL}/ia/interpretar-voz`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    texto: frase,
                    id_vehiculo: ID_VEHICULO
                })
            });

            const data = await resp.json();
            if (resp.ok) {
                manejarRespuestaIA(frase, data);
            } else {
                const aviso = data.detail || 'Error al procesar orden con IA';
                voiceTranscriptText.textContent = `"${frase}" → 🤖 ${aviso}`;
                registrarEvento(`IA Voz: ${aviso}`);
            }
        } catch (err) {
            voiceTranscriptText.textContent = `"${frase}" → Error de conexión con IA`;
            registrarEvento('Error al conectar con /ia/interpretar-voz en EC2.');
        } finally {
            voiceStatusLabel.textContent = 'Micrófono listo • Toca para hablar de nuevo';
        }
    }

    // --- MODO MÓVIL: Grabación de audio -> /ia/interpretar-audio (Whisper) ---
    async function enviarAudioAOpenAI(audioBlob, mimeType) {
        voiceStatusLabel.textContent = 'Procesando voz con OpenAI...';
        voiceTranscriptText.textContent = 'Analizando orden...';

        try {
            const base64Audio = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result.split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(audioBlob);
            });

            const resp = await fetch(`${BASE_URL}/ia/interpretar-audio`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    audio_base64: base64Audio,
                    mime_type: mimeType || 'audio/mp4',
                    id_vehiculo: ID_VEHICULO
                })
            });

            const data = await resp.json();
            const frase = data.texto || '(audio sin texto)';

            if (resp.ok) {
                manejarRespuestaIA(frase, data);
            } else {
                const aviso = data.detail || 'No se pudo interpretar el audio';
                voiceTranscriptText.textContent = `"${frase}" → 🤖 ${aviso}`;
                registrarEvento(`IA Voz: ${aviso}`);
            }
        } catch (err) {
            voiceTranscriptText.textContent = 'Error de conexión con la IA en EC2';
            registrarEvento('Error al enviar audio a /ia/interpretar-audio.');
        } finally {
            voiceStatusLabel.textContent = 'Micrófono listo • Toca para hablar de nuevo';
        }
    }

    async function iniciarGrabacionMovil() {
        if (isRecordingMobile && mediaRecorder && mediaRecorder.state === 'recording') {
            clearTimeout(autoStopTimer);
            mediaRecorder.stop();
            return;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') {
            voiceStatusLabel.textContent = 'Grabación no disponible en este navegador';
            voiceTranscriptText.textContent = 'Abre la página en Safari o Chrome actualizado.';
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            let options = undefined;
            if (MediaRecorder.isTypeSupported('audio/mp4')) {
                options = { mimeType: 'audio/mp4' };
            } else if (MediaRecorder.isTypeSupported('audio/webm')) {
                options = { mimeType: 'audio/webm' };
            }

            audioChunks = [];
            mediaRecorder = options ? new MediaRecorder(stream, options) : new MediaRecorder(stream);

            mediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) audioChunks.push(e.data);
            };

            mediaRecorder.onstop = () => {
                isRecordingMobile = false;
                micWrapper?.classList.remove('listening');
                stream.getTracks().forEach((t) => t.stop());

                const tipoFinal = mediaRecorder.mimeType || (options && options.mimeType) || 'audio/mp4';
                const blob = new Blob(audioChunks, { type: tipoFinal });

                if (blob.size > 400) {
                    enviarAudioAOpenAI(blob, tipoFinal);
                } else {
                    voiceStatusLabel.textContent = 'Audio muy corto • Intenta hablar más cerca';
                }
            };

            mediaRecorder.start(250);
            isRecordingMobile = true;
            micWrapper?.classList.add('listening');
            voiceStatusLabel.textContent = 'Escuchando en vivo... (toca para enviar)';
            voiceTranscriptText.textContent = 'Habla ahora...';

            autoStopTimer = setTimeout(() => {
                if (isRecordingMobile && mediaRecorder && mediaRecorder.state === 'recording') {
                    mediaRecorder.stop();
                }
            }, 4500);
        } catch (err) {
            isRecordingMobile = false;
            micWrapper?.classList.remove('listening');
            voiceStatusLabel.textContent = 'Permiso de micrófono bloqueado';
            voiceTranscriptText.textContent = 'Revisa los permisos de micrófono de tu navegador.';
        }
    }

    if (btnVoiceMic) {
        btnVoiceMic.addEventListener('click', () => {
            const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

            // En celulares o navegadores sin SpeechRecognition usa grabación de audio directa
            if (esDispositivoMovil || !SpeechRec) {
                iniciarGrabacionMovil();
                return;
            }

            // En PC usa reconocimiento en tiempo real
            if (isListening && recognition) {
                recognition.stop();
                return;
            }

            textoCapturado = '';
            comandoEnviado = false;

            recognition = new SpeechRec();
            recognition.lang = 'es-MX';
            recognition.continuous = false;
            recognition.interimResults = true;

            isListening = true;
            micWrapper?.classList.add('listening');
            voiceStatusLabel.textContent = 'Escuchando en vivo...';
            voiceTranscriptText.textContent = 'Habla ahora...';

            recognition.onresult = (event) => {
                let transcripcion = '';
                let esFinal = false;

                for (let i = 0; i < event.results.length; i++) {
                    transcripcion += event.results[i][0].transcript;
                    if (event.results[i].isFinal) esFinal = true;
                }

                textoCapturado = transcripcion.trim();
                if (textoCapturado) {
                    voiceTranscriptText.textContent = `"${textoCapturado}"`;
                }

                if (esFinal && textoCapturado) {
                    procesarTextoConIA(textoCapturado);
                }
            };

            recognition.onerror = (e) => {
                isListening = false;
                micWrapper?.classList.remove('listening');
                if (e.error === 'service-not-allowed') {
                    iniciarGrabacionMovil();
                } else if (e.error === 'no-speech') {
                    voiceStatusLabel.textContent = 'No se escuchó voz • Revisa tu micrófono';
                } else if (e.error === 'not-allowed') {
                    voiceStatusLabel.textContent = 'Permiso de micrófono bloqueado en el navegador';
                } else {
                    voiceStatusLabel.textContent = `Aviso de voz: ${e.error}`;
                }
            };

            recognition.onend = () => {
                isListening = false;
                micWrapper?.classList.remove('listening');
                if (textoCapturado && !comandoEnviado) {
                    procesarTextoConIA(textoCapturado);
                } else if (!comandoEnviado) {
                    voiceStatusLabel.textContent = 'Micrófono listo • Toca para hablar de nuevo';
                }
            };

            try {
                recognition.start();
            } catch (err) {
                isListening = false;
                micWrapper?.classList.remove('listening');
                iniciarGrabacionMovil();
            }
        });
    }

    // =========================================================
    // 7. PERMISOS REALES DE CÁMARA Y DETECCIÓN DE GESTOS
    // =========================================================
    const btnToggleCamera = document.getElementById('btn-toggle-camera');
    const gestureVideo = document.getElementById('gesture-video');
    const cameraPlaceholder = document.getElementById('camera-placeholder');
    const gestureHud = document.getElementById('gesture-hud-overlay');
    const gestureLabel = document.getElementById('gesture-detected-label');
    let cameraStream = null;

    if (btnToggleCamera && gestureVideo) {
        btnToggleCamera.addEventListener('click', async () => {
            if (cameraStream) {
                cameraStream.getTracks().forEach((t) => t.stop());
                cameraStream = null;
                gestureVideo.style.display = 'none';
                if (gestureHud) gestureHud.style.display = 'none';
                if (cameraPlaceholder) cameraPlaceholder.style.display = 'block';
                btnToggleCamera.innerHTML = '<i class="bx bx-video"></i> <span>Activar Cámara</span>';
                return;
            }

            try {
                cameraStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
                    audio: false
                });
                gestureVideo.srcObject = cameraStream;
                await gestureVideo.play();

                if (cameraPlaceholder) cameraPlaceholder.style.display = 'none';
                gestureVideo.style.display = 'block';
                if (gestureHud) gestureHud.style.display = 'flex';
                if (gestureLabel) gestureLabel.textContent = 'CÁMARA ACTIVA • LISTO PARA GESTOS';
                btnToggleCamera.innerHTML = '<i class="bx bx-video-off"></i> <span>Apagar Cámara</span>';
            } catch (err) {
                if (cameraPlaceholder) cameraPlaceholder.style.display = 'block';
                const titleEl = document.getElementById('camera-placeholder-title');
                const descEl = document.getElementById('camera-placeholder-desc');
                if (titleEl) titleEl.textContent = 'Permiso de cámara denegado';
                if (descEl) descEl.textContent = 'Autoriza el uso de la cámara en el candado de la barra de direcciones de tu navegador.';
            }
        });
    }

    // =========================================================
    // 8. BARRA INFERIOR LIQUID GLASS SIN SOLAPAMIENTO NI SALTOS
    // =========================================================
    const dock = document.getElementById('liquid-dock');
    const dockItems = document.querySelectorAll('.dock-item');
    const lens = document.getElementById('liquid-lens');
    const views = document.querySelectorAll('.view');
    let slideTimeout = null;

    function moveLiquidLens(targetBtn, animate = true) {
        if (!dock || !lens || !targetBtn) return;
        const dockRect = dock.getBoundingClientRect();
        const btnRect = targetBtn.getBoundingClientRect();
        const offsetX = btnRect.left - dockRect.left;

        if (animate) {
            lens.classList.add('sliding');
            clearTimeout(slideTimeout);
            slideTimeout = setTimeout(() => lens.classList.remove('sliding'), 440);
        }

        lens.style.width = `${btnRect.width}px`;
        lens.style.transform = `translateX(${offsetX}px)`;
    }

    const initialActive = document.querySelector('.dock-item.active');
    if (initialActive) requestAnimationFrame(() => moveLiquidLens(initialActive, false));
    window.addEventListener('resize', () => {
        const current = document.querySelector('.dock-item.active');
        if (current) moveLiquidLens(current, false);
    });

    dockItems.forEach((btn) => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            if (btn.classList.contains('active')) return;

            dockItems.forEach((item) => item.classList.remove('active'));
            btn.classList.add('active');
            moveLiquidLens(btn, true);

            views.forEach((view) => {
                if (view.id === targetId) {
                    view.classList.add('active');
                } else {
                    view.classList.remove('active');
                }
            });

            if (targetId === 'view-monitoring') {
                cargarHistorialRDS();
            }
        });
    });

    document.getElementById('btn-expand-3d')?.addEventListener('click', () => {
        document.querySelector('.dock-item[data-target="view-3d"]')?.click();
    });
    document.getElementById('btn-reset-3d')?.addEventListener('click', () => sim3D.reset());
    document.getElementById('btn-reset-3d-full')?.addEventListener('click', () => sim3D.reset());

    // =========================================================
    // 9. MODO CLARO / OSCURO
    // =========================================================
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    const rootHtml = document.documentElement;

    const savedTheme = localStorage.getItem('iot-theme') || 'dark';
    rootHtml.setAttribute('data-theme', savedTheme);
    if (themeIcon) themeIcon.className = savedTheme === 'light' ? 'bx bx-moon' : 'bx bx-sun';

    themeToggle?.addEventListener('click', () => {
        const next = rootHtml.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        rootHtml.setAttribute('data-theme', next);
        localStorage.setItem('iot-theme', next);
        if (themeIcon) themeIcon.className = next === 'light' ? 'bx bx-moon' : 'bx bx-sun';
    });

    // =========================================================
    // SECUENCIA DE IA DINÁMICA PARA ANIMACIÓN 3D Y AUDIO
    // =========================================================
    async function ejecutarSecuencia3D(pasos) {
        for (const paso of pasos) {
            const etiqueta = paso.comando || `CMD ${paso.id_comando}`;
            sim3D.aplicarComando(etiqueta);
            if (hudState) hudState.textContent = etiqueta;
            if (directionBadge) directionBadge.textContent = etiqueta;
            if (typeof actualizarPanelUltimoMovimiento === 'function') {
                actualizarPanelUltimoMovimiento(paso.id_comando, etiqueta, 'VOZ_IA');
            }
            await new Promise((r) => setTimeout(r, (paso.duracion_ms || 800) + (paso.pausa_ms || 150)));
        }
        sim3D.aplicarComando('NEUTRAL');
        if (hudState) hudState.textContent = 'NEUTRAL';
        if (directionBadge) directionBadge.textContent = 'NEUTRAL';
    }
});