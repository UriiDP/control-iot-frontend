import { JoystickController } from './joystick.js';
import { Excavator3DManager } from './excavator3d.js';

document.addEventListener('DOMContentLoaded', () => {
    const BASE_URL = 'https://control-iot-uriel.duckdns.org';
    const WS_URL = 'wss://control-iot-uriel.duckdns.org/ws/1';
    const ID_VEHICULO = 1;

    // =========================================================
    // 1. INICIALIZAR MOTOR 3D REAL (THREE.JS)
    // =========================================================
    const sim3D = new Excavator3DManager([
        document.getElementById('preview-3d-container'),
        document.getElementById('full-3d-canvas-container')
    ]);

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

            // Si responde el servidor FastAPI, EC2 está arriba
            apiOnline = true;
            setBadgeState('api-status-bar', 'api-status-icon', 'api-status', 'online', 'EC2 Activa', 'bx bx-check-circle');

            if (resp.ok) {
                const data = await resp.json();
                // Si no hay error de base de datos, Amazon RDS respondió correctamente
                if (data && data.status !== 'error') {
                    rdsOnline = true;
                    setBadgeState('rds-status-bar', 'rds-status-icon', 'rds-status', 'online', 'RDS Conectada', 'bx bx-check-circle');
                } else {
                    rdsOnline = false;
                    setBadgeState('rds-status-bar', 'rds-status-icon', 'rds-status', 'offline', 'Error en RDS', 'bx bx-x-circle');
                }
            } else {
                rdsOnline = false;
                setBadgeState('rds-status-bar', 'rds-status-icon', 'rds-status', 'offline', `Error HTTP ${resp.status}`, 'bx bx-x-circle');
            }
        } catch (err) {
            clearTimeout(timeoutId);
            apiOnline = false;
            rdsOnline = false;
            setBadgeState('api-status-bar', 'api-status-icon', 'api-status', 'offline', 'Sin respuesta EC2', 'bx bx-x-circle');
            setBadgeState('rds-status-bar', 'rds-status-icon', 'rds-status', 'offline', 'Sin conexión RDS', 'bx bx-x-circle');
        }
    }

    // =========================================================
    // 3. CONEXIÓN WEBSOCKET REAL (SIN FALSOS POSITIVOS)
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
            };

            socket.onerror = () => {
                wsOnline = false;
                setBadgeState('ws-status-bar', 'ws-status-icon', 'ws-status', 'offline', 'Error de conexión', 'bx bx-wifi-off');
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
    conectarWebSocket();

    const btnRefresh = document.getElementById('btn-refresh-status');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', () => {
            verificarSaludBackend();
            if (!wsOnline) conectarWebSocket();
        });
    }

    // =========================================================
    // 4. ENVÍO DE COMANDOS REALES A FASTAPI + SIMULACIÓN 3D
    // =========================================================
    async function enviarComando(idComando, etiqueta) {
        sim3D.aplicarComando(etiqueta);
        if (hudState) hudState.textContent = etiqueta;
        if (directionBadge) directionBadge.textContent = etiqueta;
        registrarEvento(`Comando [${idComando}]: ${etiqueta}`);

        try {
            const resp = await fetch(`${BASE_URL}/vehiculos/movimiento`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_vehiculo: ID_VEHICULO,
                    id_comando: Number(idComando),
                    origen: 'WEB'
                })
            });
            if (!resp.ok) {
                registrarEvento(`Aviso API (${resp.status}) al ejecutar ${etiqueta}`);
            }
        } catch (err) {
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
                const mapEtiquetas = { 0: 'NEUTRAL', 11: 'AVANZAR', 12: 'RETROCEDER', 13: 'IZQUIERDA', 14: 'DERECHA' };
                enviarComando(idComando, mapEtiquetas[idComando] || 'MOVIMIENTO');
            },
            (etiqueta) => {
                if (directionBadge) directionBadge.textContent = etiqueta;
                if (hudState) hudState.textContent = etiqueta;
                sim3D.aplicarComando(etiqueta);
            }
        );
    }

    // Botones de actuadores y STOP
    document.querySelectorAll('.actuator-btn').forEach((btn) => {
        btn.addEventListener('click', () => enviarComando(btn.dataset.cmd, btn.dataset.label));
    });

    const btnStop = document.getElementById('btn-stop');
    if (btnStop) {
        btnStop.addEventListener('click', () => enviarComando(0, 'STOP EMERGENCIA'));
    }

    // Ejecutar DEMO real en RDS + WebSocket
    const btnRunSeq = document.getElementById('btn-run-sequence');
    const seqSelect = document.getElementById('sequence-select');
    if (btnRunSeq && seqSelect) {
        btnRunSeq.addEventListener('click', async () => {
            const idDemo = seqSelect.value;
            const nombre = seqSelect.options[seqSelect.selectedIndex].text;
            registrarEvento(`Iniciando secuencia: ${nombre}...`);
            try {
                await fetch(`${BASE_URL}/demos/${idDemo}/ejecutar?id_vehiculo=${ID_VEHICULO}`, { method: 'POST' });
            } catch (_) {
                registrarEvento(`No se pudo iniciar ${nombre}: servidor fuera de línea.`);
            }
        });
    }

    // =========================================================
    // 5. BARRA INFERIOR LIQUID GLASS + CAMBIO DE PESTAÑAS
    // =========================================================
    const dock = document.getElementById('liquid-dock');
    const dockItems = document.querySelectorAll('.dock-item');
    const lens = document.getElementById('liquid-lens');
    const views = document.querySelectorAll('.view');

    function moveLiquidLens(targetBtn) {
        if (!dock || !lens || !targetBtn) return;
        const dockRect = dock.getBoundingClientRect();
        const btnRect = targetBtn.getBoundingClientRect();
        const offsetX = btnRect.left - dockRect.left;

        lens.style.width = `${btnRect.width}px`;
        lens.style.transform = `translateX(${offsetX - 9}px)`;
    }

    const initialActive = document.querySelector('.dock-item.active');
    if (initialActive) requestAnimationFrame(() => moveLiquidLens(initialActive));
    window.addEventListener('resize', () => {
        const current = document.querySelector('.dock-item.active');
        if (current) moveLiquidLens(current);
    });

    dockItems.forEach((btn) => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            if (btn.classList.contains('active')) return;

            dockItems.forEach((item) => item.classList.remove('active'));
            btn.classList.add('active');
            moveLiquidLens(btn);

            views.forEach((view) => {
                if (view.id === targetId) {
                    view.style.display = 'block';
                    requestAnimationFrame(() => view.classList.add('active'));
                } else {
                    view.classList.remove('active');
                    setTimeout(() => {
                        if (!view.classList.contains('active')) view.style.display = 'none';
                    }, 360);
                }
            });
        });
    });

    // Botones de expansión y centrado 3D
    document.getElementById('btn-expand-3d')?.addEventListener('click', () => {
        document.querySelector('.dock-item[data-target="view-3d"]')?.click();
    });
    document.getElementById('btn-reset-3d')?.addEventListener('click', () => sim3D.reset());
    document.getElementById('btn-reset-3d-full')?.addEventListener('click', () => sim3D.reset());

    // =========================================================
    // 6. MODO CLARO / OSCURO
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