import { JoystickController } from './joystick.js';
import { Excavator3DManager } from './excavator3d.js';

document.addEventListener('DOMContentLoaded', () => {
    const BASE_URL = 'https://control-iot-uriel.duckdns.org';
    const WS_URL = 'wss://control-iot-uriel.duckdns.org/ws/1';
    const ID_VEHICULO = 1;

    const NOMBRES_COMANDOS = {
        0: 'DETENER (STOP)',
        11: 'AVANZAR',
        12: 'RETROCEDER',
        13: 'IZQUIERDA',
        14: 'DERECHA',
        15: 'SUBIR GARRA',
        16: 'BAJAR GARRA',
        17: 'GIRO IZQ 90°',
        18: 'GIRO DER 90°',
        20: 'EJECUCIÓN DEMO'
    };

    // Mapa de íconos representativos para cada movimiento en Monitoreo
    function obtenerIconoMovimiento(codigo, texto = '') {
        const c = Number(codigo);
        const upper = String(texto).toUpperCase();

        if (c === 0 || upper.includes('STOP') || upper.includes('DETENER')) {
            return { icon: 'bx bxs-octagon', theme: 'stop-mode' };
        }
        if (c === 11 || upper.includes('AVANZAR')) {
            return { icon: 'bx bx-up-arrow-alt', theme: 'move-mode' };
        }
        if (c === 12 || upper.includes('RETROCEDER')) {
            return { icon: 'bx bx-down-arrow-alt', theme: 'move-mode' };
        }
        if (c === 13 || upper === 'IZQUIERDA') {
            return { icon: 'bx bx-left-arrow-alt', theme: 'turn-mode' };
        }
        if (c === 14 || upper === 'DERECHA') {
            return { icon: 'bx bx-right-arrow-alt', theme: 'turn-mode' };
        }
        if (c === 15 || upper.includes('SUBIR')) {
            return { icon: 'bx bx-up-arrow-circle', theme: '' };
        }
        if (c === 16 || upper.includes('BAJAR')) {
            return { icon: 'bx bx-down-arrow-circle', theme: '' };
        }
        if (c === 17 || upper.includes('GIRO IZQ')) {
            return { icon: 'bx bx-undo', theme: 'turn-mode' };
        }
        if (c === 18 || upper.includes('GIRO DER')) {
            return { icon: 'bx bx-redo', theme: 'turn-mode' };
        }
        if (c === 20 || upper.includes('DEMO')) {
            return { icon: 'bx bx-play-circle', theme: '' };
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
    // 2. GESTIÓN AUTÉNTICA DE INDICADORES (WSS, API AWS, RDS)
    // =========================================================
    const logText = document.getElementById('last-log-text');
    const logTime = document.getElementById('last-log-time');

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
            globalText.textContent = 'Conexión Parcial';
        } else {
            globalBadge.className = 'connection-badge offline';
            globalText.textContent = 'Servidor Desconectado';
        }
    }

    async function verificarSaludBackend() {
        setBadgeState('api-status-bar', 'api-status-icon', 'api-status', 'checking', 'Verificando...', 'bx bx-loader-alt bx-spin');
        setBadgeState('rds-status-bar', 'rds-status-icon', 'rds-status', 'checking', 'Verificando...', 'bx bx-loader-alt bx-spin');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
            const resp = await fetch(`${BASE_URL}/vehiculos`, { signal: controller.signal });
            clearTimeout(timeoutId);

            apiOnline = true;
            setBadgeState('api-status-bar', 'api-status-icon', 'api-status', 'online', 'EC2 Activa', 'bx bx-check-circle');

            if (resp.ok) {
                const data = await resp.json();
                if (data && data.status !== 'error') {
                    rdsOnline = true;
                    setBadgeState('rds-status-bar', 'rds-status-icon', 'rds-status', 'online', 'RDS Conectada', 'bx bx-check-circle');
                } else {
                    rdsOnline = false;
                    setBadgeState('rds-status-bar', 'rds-status-icon', 'rds-status', 'offline', 'Error RDS', 'bx bx-x-circle');
                }
            } else {
                rdsOnline = false;
                setBadgeState('rds-status-bar', 'rds-status-icon', 'rds-status', 'offline', `HTTP ${resp.status}`, 'bx bx-x-circle');
            }
        } catch (err) {
            clearTimeout(timeoutId);
            apiOnline = false;
            rdsOnline = false;
            setBadgeState('api-status-bar', 'api-status-icon', 'api-status', 'offline', 'Sin EC2', 'bx bx-x-circle');
            setBadgeState('rds-status-bar', 'rds-status-icon', 'rds-status', 'offline', 'Sin RDS', 'bx bx-x-circle');
        }
    }

    // Cargar DEMOs reales (Demo Principal y Demo Personalizada)
    async function cargarDemosDisponibles() {
        const seqSelect = document.getElementById('sequence-select');
        if (!seqSelect) return;

        try {
            const resp = await fetch(`${BASE_URL}/demos`);
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
        } catch (_) {}
    }

    // =========================================================
    // 3. PESTAÑA DE MONITOREO E HISTORIAL RDS CON ÍCONO DINÁMICO
    // =========================================================
    function actualizarPanelUltimoMovimiento(codigo, nombreAccion, origen = 'WEB') {
        const now = new Date();
        const actionEl = document.getElementById('mon-last-action');
        const codeEl = document.getElementById('mon-codigo');
        const dateEl = document.getElementById('mon-fecha');
        const timeEl = document.getElementById('mon-hora');
        const originEl = document.getElementById('mon-origin-text');
        const iconBox = document.getElementById('mon-action-icon-box');
        const iconEl = document.getElementById('mon-action-icon');

        const etiquetaFinal = nombreAccion || NOMBRES_COMANDOS[codigo] || `COMANDO #${codigo}`;
        const visual = obtenerIconoMovimiento(codigo, etiquetaFinal);

        if (actionEl) actionEl.textContent = etiquetaFinal;
        if (codeEl) codeEl.textContent = codigo !== undefined ? `#${codigo}` : '—';
        if (dateEl) dateEl.textContent = now.toLocaleDateString('es-MX');
        if (timeEl) timeEl.textContent = now.toLocaleTimeString('es-MX');
        if (originEl) originEl.textContent = `Origen: ${origen} • Sincronizado en tiempo real`;

        if (iconBox) iconBox.className = `pulse-wave-icon ${visual.theme}`.trim();
        if (iconEl) iconEl.className = visual.icon;
    }

    async function cargarHistorialRDS() {
        const tbody = document.getElementById('history-table-body');
        if (!tbody) return;

        try {
            const resp = await fetch(`${BASE_URL}/vehiculos/${ID_VEHICULO}/historial`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            const registros = Array.isArray(data) ? data : (data.historial || data.datos || []);

            if (registros.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="table-empty-msg">Sin movimientos individuales registrados aún en RDS.</td></tr>';
                return;
            }

            tbody.innerHTML = registros.slice(0, 10).map((item, index) => {
                const cod = item.id_comando ?? item.codigo ?? '—';
                const mov = item.nombre_comando || item.movimiento || NOMBRES_COMANDOS[cod] || `Comando ${cod}`;
                const orig = item.origen || 'WEB';
                const visual = obtenerIconoMovimiento(cod, mov);
                const rawFecha = item.fecha_hora || item.fecha || '';
                let fechaStr = 'Hoy';
                let horaStr = '—';

                if (rawFecha) {
                    const parsed = new Date(rawFecha.endsWith('Z') ? rawFecha : `${rawFecha}Z`);
                    if (!isNaN(parsed)) {
                        fechaStr = parsed.toLocaleDateString('es-MX');
                        horaStr = parsed.toLocaleTimeString('es-MX');
                    } else {
                        fechaStr = rawFecha;
                    }
                }

                if (index === 0) {
                    actualizarPanelUltimoMovimiento(cod, mov, orig);
                }

                return `
                    <tr>
                        <td>${index + 1}</td>
                        <td><i class="${visual.icon} text-amber" style="vertical-align: middle; margin-right: 4px;"></i><strong>${mov}</strong></td>
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
    // 4. CONEXIÓN WEBSOCKET REAL
    // =========================================================
    let socket = null;
    let reconnectTimer = null;

    function conectarWebSocket() {
        if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

        wsOnline = false;
        setBadgeState('ws-status-bar', 'ws-status-icon', 'ws-status', 'checking', 'Conectando...', 'bx bx-loader-alt bx-spin');

        try {
            socket = new WebSocket(WS_URL);

            socket.onopen = () => {
                wsOnline = true;
                setBadgeState('ws-status-bar', 'ws-status-icon', 'ws-status', 'online', 'En línea', 'bx bx-broadcast');
                registrarEvento('WebSocket WSS conectado en tiempo real.');
            };

            socket.onmessage = (event) => {
                registrarEvento(`WSS ← ${event.data}`);
                try {
                    const payload = JSON.parse(event.data);
                    if (payload && payload.id_comando !== undefined) {
                        const etiqueta = NOMBRES_COMANDOS[payload.id_comando] || `CMD ${payload.id_comando}`;
                        sim3D.aplicarComando(etiqueta);
                        actualizarPanelUltimoMovimiento(payload.id_comando, etiqueta, payload.origen || 'WSS');
                        cargarHistorialRDS();
                    }
                } catch (_) {}
            };

            socket.onerror = () => {
                wsOnline = false;
                setBadgeState('ws-status-bar', 'ws-status-icon', 'ws-status', 'offline', 'Error WSS', 'bx bx-wifi-off');
            };

            socket.onclose = () => {
                wsOnline = false;
                setBadgeState('ws-status-bar', 'ws-status-icon', 'ws-status', 'offline', 'Desconectado', 'bx bx-wifi-off');
                registrarEvento('WebSocket desconectado. Reintentando en 5s...');
                clearTimeout(reconnectTimer);
                reconnectTimer = setTimeout(conectarWebSocket, 5000);
            };
        } catch (err) {
            wsOnline = false;
            setBadgeState('ws-status-bar', 'ws-status-icon', 'ws-status', 'offline', 'No disponible', 'bx bx-wifi-off');
        }
    }

    verificarSaludBackend();
    cargarDemosDisponibles();
    conectarWebSocket();
    cargarHistorialRDS();

    document.getElementById('btn-refresh-status')?.addEventListener('click', () => {
        verificarSaludBackend();
        cargarDemosDisponibles();
        cargarHistorialRDS();
        if (!wsOnline) conectarWebSocket();
    });

    // =========================================================
    // 5. ENVÍO DE COMANDOS A FASTAPI + SIMULACIÓN 3D
    // =========================================================
    async function enviarComando(idComando, etiqueta, origen = 'WEB') {
        sim3D.aplicarComando(etiqueta);
        if (hudState) hudState.textContent = etiqueta;
        if (directionBadge) directionBadge.textContent = etiqueta;
        registrarEvento(`Comando [${idComando}]: ${etiqueta}`);
        actualizarPanelUltimoMovimiento(idComando, etiqueta, origen);

        try {
            const resp = await fetch(`${BASE_URL}/vehiculos/movimiento`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_vehiculo: ID_VEHICULO,
                    id_comando: Number(idComando),
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

    // Joystick Virtual
    const zoneEl = document.getElementById('joystick-zone');
    const knobEl = document.getElementById('joystick-knob');

    if (zoneEl && knobEl) {
        new JoystickController(
            zoneEl,
            knobEl,
            (idComando) => {
                enviarComando(idComando, NOMBRES_COMANDOS[idComando] || 'MOVIMIENTO', 'JOYSTICK');
            },
            (etiqueta) => {
                if (directionBadge) directionBadge.textContent = etiqueta;
                if (hudState) hudState.textContent = etiqueta;
                sim3D.aplicarComando(etiqueta);
            }
        );
    }

    document.querySelectorAll('.actuator-btn').forEach((btn) => {
        btn.addEventListener('click', () => enviarComando(btn.dataset.cmd, btn.dataset.label, 'BOTON_WEB'));
    });

    document.getElementById('btn-stop')?.addEventListener('click', () => enviarComando(0, 'DETENER (STOP)', 'STOP_WEB'));

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
    // 6. PERMISOS REALES DE MICRÓFONO Y RECONOCIMIENTO DE VOZ IA
    // =========================================================
    const btnVoiceMic = document.getElementById('btn-voice-mic');
    const micWrapper = document.getElementById('mic-orb-wrapper');
    const voiceStatusLabel = document.getElementById('voice-status-label');
    const voiceTranscriptText = document.getElementById('voice-transcript-text');
    let recognition = null;
    let isListening = false;

    if (btnVoiceMic) {
        btnVoiceMic.addEventListener('click', async () => {
            if (isListening && recognition) {
                recognition.stop();
                return;
            }

            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach((track) => track.stop());

                const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
                if (!SpeechRec) {
                    voiceStatusLabel.textContent = 'Permiso concedido • API de voz no soportada en este navegador';
                    voiceTranscriptText.textContent = 'Tu micrófono tiene permiso, pero usa Chrome/Edge/Safari actualizado para transcribir.';
                    return;
                }

                recognition = new SpeechRec();
                recognition.lang = 'es-MX';
                recognition.continuous = false;
                recognition.interimResults = true;

                recognition.onstart = () => {
                    isListening = true;
                    micWrapper?.classList.add('listening');
                    voiceStatusLabel.textContent = 'Escuchando en vivo...';
                    voiceTranscriptText.textContent = 'Habla ahora...';
                };

                recognition.onresult = (event) => {
                    const texto = Array.from(event.results)
                        .map((r) => r[0].transcript)
                        .join('')
                        .toLowerCase();
                    voiceTranscriptText.textContent = `"${texto}"`;

                    if (event.results[0].isFinal) {
                        if (texto.includes('avanza') || texto.includes('adelante')) enviarComando(11, 'AVANZAR', 'VOZ_IA');
                        else if (texto.includes('retrocede') || texto.includes('atrás')) enviarComando(12, 'RETROCEDER', 'VOZ_IA');
                        else if (texto.includes('izquierda')) enviarComando(13, 'IZQUIERDA', 'VOZ_IA');
                        else if (texto.includes('derecha')) enviarComando(14, 'DERECHA', 'VOZ_IA');
                        else if (texto.includes('subir') || texto.includes('arriba')) enviarComando(15, 'SUBIR GARRA', 'VOZ_IA');
                        else if (texto.includes('bajar') || texto.includes('abajo')) enviarComando(16, 'BAJAR GARRA', 'VOZ_IA');
                        else if (texto.includes('detener') || texto.includes('alto') || texto.includes('stop')) enviarComando(0, 'DETENER (STOP)', 'VOZ_IA');
                    }
                };

                recognition.onerror = (e) => {
                    voiceStatusLabel.textContent = `Aviso de voz: ${e.error}`;
                };

                recognition.onend = () => {
                    isListening = false;
                    micWrapper?.classList.remove('listening');
                    voiceStatusLabel.textContent = 'Micrófono listo • Toca para hablar de nuevo';
                };

                recognition.start();
            } catch (err) {
                voiceStatusLabel.textContent = 'Permiso de micrófono denegado o bloqueado';
                voiceTranscriptText.textContent = 'Habilita el acceso al micrófono en los ajustes de tu navegador.';
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
});