/* ==========================================================================
   Módulo WebSocket (Gestión de Estado WSS en Tiempo Real)
   ========================================================================== */

const WS_URL = 'wss://control-iot-uriel.duckdns.org/ws/1';

export class WebSocketService {
  constructor(onMessageCallback, onStatusChangeCallback) {
    this.socket = null;
    this.onMessageCallback = onMessageCallback;
    this.onStatusChangeCallback = onStatusChangeCallback;
    this.reconnectInterval = 3000;
    this.isExplicitlyClosed = false;
  }

  /**
   * Inicia la conexión WebSocket con el servidor AWS.
   */
  conectar() {
    this.isExplicitlyClosed = false;
    this.actualizarEstado('CONECTANDO');

    try {
      this.socket = new WebSocket(WS_URL);

      this.socket.onopen = () => {
        console.log('[WebSocket] Conexión establecida con el servidor AWS');
        this.actualizarEstado('ONLINE');
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (this.onMessageCallback) {
            this.onMessageCallback(data);
          }
        } catch (e) {
          console.warn('[WebSocket] Mensaje recibido no JSON:', event.data);
        }
      };

      this.socket.onerror = (error) => {
        console.error('[WebSocket] Error de socket:', error);
        this.actualizarEstado('ERROR');
      };

      this.socket.onclose = () => {
        console.warn('[WebSocket] Conexión cerrada');
        this.actualizarEstado('OFFLINE');
        
        // Reintento automático si no fue un cierre intencional
        if (!this.isExplicitlyClosed) {
          setTimeout(() => this.conectar(), this.reconnectInterval);
        }
      };
    } catch (e) {
      console.error('[WebSocket] Fallo al instanciar WebSocket:', e);
      this.actualizarEstado('OFFLINE');
    }
  }

  /**
   * Cierra manualmente la sesión.
   */
  desconectar() {
    this.isExplicitlyClosed = true;
    if (this.socket) {
      this.socket.close();
    }
  }

  /**
   * Notifica el cambio de estado de la sesión.
   */
  actualizarEstado(estado) {
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback(estado);
    }
  }
}