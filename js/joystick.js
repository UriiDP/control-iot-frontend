/* ==========================================================================
   Módulo Joystick Virtual (Pointer Events Táctil / Mouse)
   ========================================================================== */

export class JoystickController {
  /**
   * @param {HTMLElement} zoneElement Elemento contenedor del joystick (#joystick-zone)
   * @param {HTMLElement} knobElement Elemento perilla del joystick (#joystick-knob)
   * @param {Function} onCommandCallback Callback emitido al cambiar dirección/comando (idComando)
   * @param {Function} onStatusCallback Callback para actualizar el texto visual de dirección
   */
  constructor(zoneElement, knobElement, onCommandCallback, onStatusCallback) {
    this.zone = zoneElement;
    this.knob = knobElement;
    this.onCommandCallback = onCommandCallback;
    this.onStatusCallback = onStatusCallback;

    this.activePointerId = null;
    this.isDragging = false;
    this.currentCommand = 0;

    // Mapeo de comandos de dirección según el catálogo real en Amazon RDS
    this.COMMANDS = {
      NEUTRAL: 0,
      AVANZAR: 11,
      RETROCEDER: 12,
      GIRAR_IZQUIERDA: 13,
      GIRAR_DERECHA: 14
    };

    this.initEvents();
  }

  initEvents() {
    if (!this.zone || !this.knob) return;

    this.zone.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    window.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', (e) => this.onPointerUp(e));
    window.addEventListener('pointercancel', (e) => this.onPointerUp(e));
  }

  onPointerDown(e) {
    if (this.isDragging) return;
    this.isDragging = true;
    this.activePointerId = e.pointerId;
    this.zone.setPointerCapture(e.pointerId);
    this.updatePosition(e);
  }

  onPointerMove(e) {
    if (!this.isDragging || e.pointerId !== this.activePointerId) return;
    this.updatePosition(e);
  }

  onPointerUp(e) {
    if (!this.isDragging || (e && e.pointerId !== this.activePointerId)) return;
    this.isDragging = false;
    if (this.activePointerId !== null && this.zone.hasPointerCapture(this.activePointerId)) {
      this.zone.releasePointerCapture(this.activePointerId);
    }
    this.activePointerId = null;
    this.resetKnob();
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
      nuevoComando = this.COMMANDS.GIRAR_DERECHA;
      etiqueta = 'GIRAR DERECHA';
    } else if (angleDeg >= 45 && angleDeg < 135) {
      nuevoComando = this.COMMANDS.RETROCEDER;
      etiqueta = 'RETROCEDER';
    } else {
      nuevoComando = this.COMMANDS.GIRAR_IZQUIERDA;
      etiqueta = 'GIRAR IZQUIERDA';
    }

    this.setCommand(nuevoComando, etiqueta);
  }

  setCommand(comando, etiqueta) {
    if (this.currentCommand !== comando) {
      this.currentCommand = comando;
      if (this.onStatusCallback) this.onStatusCallback(etiqueta);
      if (this.onCommandCallback) this.onCommandCallback(comando);
    }
  }

  resetKnob() {
    this.knob.style.transform = 'translate(-50%, -50%)';
    this.setCommand(this.COMMANDS.NEUTRAL, 'NEUTRAL');
  }
}