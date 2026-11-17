/* ==========================================================================
   Módulo Joystick Virtual (Pointer Events Táctil / Mouse - Inicio/Parada Instantánea)
   ========================================================================== */

export class JoystickController {
  constructor(zoneElement, knobElement, onCommandCallback, onStatusCallback) {
    this.zone = zoneElement;
    this.knob = knobElement;
    this.onCommandCallback = onCommandCallback;
    this.onStatusCallback = onStatusCallback;

    this.activePointerId = null;
    this.isDragging = false;
    this.currentCommand = 0;

    this.COMMANDS = {
      NEUTRAL: 0,
      AVANZAR: 11,
      RETROCEDER: 12,
      IZQUIERDA: 13,
      DERECHA: 14
    };

    this.initEvents();
  }

  initEvents() {
    if (!this.zone || !this.knob) return;

    this.zone.style.touchAction = 'none';
    this.zone.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    window.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', (e) => this.onPointerUp(e));
    window.addEventListener('pointercancel', (e) => this.onPointerUp(e));
    this.zone.addEventListener('lostpointercapture', () => this.forzarSoltado());
    this.zone.addEventListener('touchend', () => this.forzarSoltado());
    this.zone.addEventListener('touchcancel', () => this.forzarSoltado());
    window.addEventListener('blur', () => this.forzarSoltado());
  }

  onPointerDown(e) {
    if (this.isDragging) return;
    e.preventDefault();
    this.isDragging = true;
    this.activePointerId = e.pointerId;
    try {
      this.zone.setPointerCapture?.(e.pointerId);
    } catch (_) {}
    this.updatePosition(e);
  }

  onPointerMove(e) {
    if (!this.isDragging || e.pointerId !== this.activePointerId) return;
    e.preventDefault();
    this.updatePosition(e);
  }

  forzarSoltado() {
    if (!this.isDragging && this.currentCommand === this.COMMANDS.NEUTRAL) return;
    this.isDragging = false;
    this.activePointerId = null;
    this.resetKnob();
  }

  onPointerUp(e) {
    if (!this.isDragging) return;
    if (e && this.activePointerId !== null && e.pointerId !== this.activePointerId) return;
    if (this.activePointerId !== null && this.zone.hasPointerCapture?.(this.activePointerId)) {
      try {
        this.zone.releasePointerCapture(this.activePointerId);
      } catch (_) {}
    }
    this.forzarSoltado();
  }

  updatePosition(e) {
    const rect = this.zone.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxRadius = (rect.width / 2) - 15;

    let deltaX = e.clientX - centerX;
    let deltaY = e.clientY - centerY;
    const distance = Math.hypot(deltaX, deltaY);

    if (distance > maxRadius) {
      const angle = Math.atan2(deltaY, deltaX);
      deltaX = Math.cos(angle) * maxRadius;
      deltaY = Math.sin(angle) * maxRadius;
    }

    this.knob.style.transform = `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px))`;

    const deadzone = 20;
    if (distance < deadzone) {
      this.setCommand(this.COMMANDS.NEUTRAL, 'NEUTRAL');
    } else {
      this.evaluarDireccion(deltaX, deltaY);
    }
  }

  evaluarDireccion(x, y) {
    const angleDeg = Math.atan2(y, x) * (180 / Math.PI);

    let nuevoComando = this.COMMANDS.NEUTRAL;
    let etiqueta = 'NEUTRAL';

    if (angleDeg >= -135 && angleDeg < -45) {
      nuevoComando = this.COMMANDS.AVANZAR;
      etiqueta = 'AVANZAR';
    } else if (angleDeg >= -45 && angleDeg < 45) {
      nuevoComando = this.COMMANDS.DERECHA;
      etiqueta = 'DERECHA';
    } else if (angleDeg >= 45 && angleDeg < 135) {
      nuevoComando = this.COMMANDS.RETROCEDER;
      etiqueta = 'RETROCEDER';
    } else {
      nuevoComando = this.COMMANDS.IZQUIERDA;
      etiqueta = 'IZQUIERDA';
    }

    this.setCommand(nuevoComando, etiqueta);
  }

  setCommand(comando, etiqueta) {
    if (this.currentCommand !== comando) {
      const comandoAnterior = this.currentCommand;
      this.currentCommand = comando;

      if (this.onStatusCallback) this.onStatusCallback(etiqueta);

      if (this.onCommandCallback) {
        if (comando !== this.COMMANDS.NEUTRAL) {
          this.onCommandCallback(comando);
        } else if (comandoAnterior !== this.COMMANDS.NEUTRAL) {
          // Envía 1 solo STOP instantáneo al soltar o volver al centro
          this.onCommandCallback(0);
        }
      }
    }
  }

  resetKnob() {
    this.knob.style.transform = 'translate(-50%, -50%)';
    this.setCommand(this.COMMANDS.NEUTRAL, 'NEUTRAL');
  }
}