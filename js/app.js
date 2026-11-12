import { JoystickController } from './joystick.js';

document.addEventListener('DOMContentLoaded', () => {
    const BASE_URL = 'https://control-iot-uriel.duckdns.org';
    const WS_URL = 'wss://control-iot-uriel.duckdns.org/ws/1';

    // =========================================================
    // 1. LOGS Y SIMULACIÓN VISUAL EN TIEMPO REAL
    // =========================================================
    const logText = document.getElementById('last-log-text');
    const logTime = document.getElementById('last-log-time');
    const hudAngle = document.getElementById('hud-angle');
    const hudArm = document.getElementById('hud-arm');
    const hudState = document.getElementById('hud-state');
    const rigCabin = document.getElementById('excavator-rig');
    const rigArm = document.getElementById('rig-arm');
    const directionBadge = document.getElementById('joystick-direction');

    let currentYaw = 0;
    let currentArmPct = 50;

    function registrarEvento(mensaje) {
        if (logText) logText.textContent = mensaje;
        if (logTime) {
            const ahora = new Date();
            logTime.textContent = ahora.toLocaleTimeString();
        }
    }

    function actualizarSimulacion(etiqueta) {
        if (hudState) hudState.textContent = etiqueta;
        if (directionBadge) directionBadge.textContent = etiqueta;

        if (etiqueta === 'SUBIR GARRA') {
            currentArmPct = Math.min(100, currentArmPct + 25);
        } else if (etiqueta === 'BAJAR GARRA') {
            currentArmPct = Math.max(0, currentArmPct - 25);
        } else if (etiqueta === 'GIRO IZQ 90°' || etiqueta === 'IZQUIERDA') {
            currentYaw -= 30;
        } else if (etiqueta === 'GIRO DER 90°' || etiqueta === 'DERECHA') {
            currentYaw += 30;
        }

        if (hudAngle) hudAngle.textContent = `${currentYaw}°`;
        if (hudArm) hudArm.textContent = `${currentArmPct}%`;

        if (rigArm) {
            const deg = (50 - currentArmPct) * 0.45;
            rigArm.style.transform = `rotate(${deg}deg)`;
        }
        if (rigCabin) {
            const shiftX = etiqueta === 'AVANZAR' ? 10 : etiqueta === 'RETROCEDER' ? -10 : 0;
            const tilt = etiqueta === 'IZQUIERDA' ? -4 : etiqueta === 'DERECHA' ? 4 : 0;
            rigCabin.style.transform = `translateX(${shiftX}px) rotate(${tilt}deg)`;
        }
    }

    // =========================================================
    // 2. CONEXIÓN WEBSOCKET EN VIVO
    // =========================================================
    let socket = null;
    const wsStatusEl = document.getElementById('ws-status');

    function conectarWebSocket() {
        try {
            socket = new WebSocket(WS_URL);
            socket.onopen = () => {
                if (wsStatusEl) wsStatusEl.textContent = 'En línea';
                registrarEvento('WebSocket WSS conectado a control-iot-uriel.duckdns.org');
            };
            socket.onmessage = (event) => {
                registrarEvento(`Evento recibido: ${event.data}`);
            };
            socket.onclose = () => {
                if (wsStatusEl) wsStatusEl.textContent = 'Reconectando...';
                setTimeout(conectarWebSocket, 3500);
            };
        } catch (err) {
            registrarEvento('Modo simulación local activo.');
        }
    }
    conectarWebSocket();

    async function enviarComando(idComando, etiqueta) {
        actualizarSimulacion(etiqueta);
        registrarEvento(`Comando enviado [${idComando}]: ${etiqueta}`);

        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ id_vehiculo: 1, id_comando: Number(idComando), accion: etiqueta }));
        }

        try {
            await fetch(`${BASE_URL}/comandos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id_vehiculo: 1, id_comando: Number(idComando) })
            });
        } catch (_) {
            // Silencioso si el endpoint usa otra ruta; WSS ya transmitió
        }
    }

    // =========================================================
    // 3. INICIALIZAR JOYSTICK VIRTUAL (js/joystick.js)
    // =========================================================
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
            }
        );
    }

    // Botones de actuadores, secuencias y STOP
    document.querySelectorAll('.actuator-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            enviarComando(btn.dataset.cmd, btn.dataset.label);
        });
    });

    const btnStop = document.getElementById('btn-stop');
    if (btnStop) {
        btnStop.addEventListener('click', () => enviarComando(0, 'STOP EMERGENCIA'));
    }

    const btnRunSeq = document.getElementById('btn-run-sequence');
    const seqSelect = document.getElementById('sequence-select');
    if (btnRunSeq && seqSelect) {
        btnRunSeq.addEventListener('click', () => {
            const nombre = seqSelect.options[seqSelect.selectedIndex].text;
            enviarComando(20, `SECUENCIA: ${nombre.toUpperCase()}`);
        });
    }

    // =========================================================
    // 4. BARRA LIQUID GLASS Y CAMBIO DE PESTAÑAS
    // =========================================================
    const dock = document.getElementById('liquid-dock');
    const dockItems = document.querySelectorAll('.dock-item');
    const activePill = document.getElementById('liquid-active-pill');
    const views = document.querySelectorAll('.view');

    function moveLiquidPill(targetBtn) {
        if (!dock || !activePill || !targetBtn) return;
        const dockRect = dock.getBoundingClientRect();
        const btnRect = targetBtn.getBoundingClientRect();
        const offsetX = btnRect.left - dockRect.left;

        activePill.style.width = `${btnRect.width}px`;
        activePill.style.transform = `translateX(${offsetX - 10}px)`;
    }

    const initialActive = document.querySelector('.dock-item.active');
    if (initialActive) requestAnimationFrame(() => moveLiquidPill(initialActive));
    window.addEventListener('resize', () => {
        const current = document.querySelector('.dock-item.active');
        if (current) moveLiquidPill(current);
    });

    dockItems.forEach((btn) => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            if (btn.classList.contains('active')) return;

            dockItems.forEach((item) => item.classList.remove('active'));
            btn.classList.add('active');
            moveLiquidPill(btn);

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

    const btnExpand3d = document.getElementById('btn-expand-3d');
    if (btnExpand3d) {
        btnExpand3d.addEventListener('click', () => {
            const tab3d = document.querySelector('.dock-item[data-target="view-3d"]');
            if (tab3d) tab3d.click();
        });
    }

    // =========================================================
    // 5. MODO CLARO / OSCURO
    // =========================================================
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    const rootHtml = document.documentElement;

    const savedTheme = localStorage.getItem('iot-theme') || 'dark';
    rootHtml.setAttribute('data-theme', savedTheme);
    if (themeIcon) themeIcon.className = savedTheme === 'light' ? 'bx bx-moon' : 'bx bx-sun';

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const next = rootHtml.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            rootHtml.setAttribute('data-theme', next);
            localStorage.setItem('iot-theme', next);
            if (themeIcon) themeIcon.className = next === 'light' ? 'bx bx-moon' : 'bx bx-sun';
        });
    }
});