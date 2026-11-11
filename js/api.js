/* ==========================================================================
   Módulo de Cliente REST API (AWS FastAPI)
   ========================================================================== */

// Configuración de la URL Base de tu API en AWS
const API_BASE_URL = 'http://54.144.155.231:8000';

export const ApiService = {
  
  /**
   * Comprueba si la API de AWS responde correctamente (indicador API AWS).
   */
  async comprobarSaludApi() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(`${API_BASE_URL}/status`, {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      return response.ok;
    } catch (error) {
      console.warn('[API AWS] Comprobación de salud fallida:', error);
      return false;
    }
  },

  /**
   * Obtiene la lista de comandos disponibles para un vehículo.
   */
  async obtenerComandos(idVehiculo = 1) {
    try {
      const response = await fetch(`${API_BASE_URL}/vehiculos/${idVehiculo}/comandos`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('[API AWS] Error al obtener comandos:', error);
      throw error;
    }
  },

  /**
   * Obtiene el catálogo de secuencias DEMO registradas.
   */
  async obtenerDemos(idVehiculo = 1) {
    try {
      const response = await fetch(`${API_BASE_URL}/demos?id_vehiculo=${idVehiculo}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('[API AWS] Error al obtener DEMOs:', error);
      return [];
    }
  },

  /**
   * Registra un movimiento individual por POST en RDS + WebSocket.
   */
  async registrarMovimiento(idComando, idVehiculo = 1, origen = 'WEB_CONTROL') {
    try {
      const response = await fetch(`${API_BASE_URL}/vehiculos/movimiento`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id_vehiculo: idVehiculo,
          id_comando: idComando,
          origen: origen
        })
      });

      if (!response.ok) throw new Error(`Error en POST movimiento: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('[API AWS] Error registrando movimiento:', error);
      throw error;
    }
  },

  /**
   * Ejecuta una secuencia DEMO por POST.
   */
  async ejecutarDemo(idDemo, idVehiculo = 1) {
    try {
      const response = await fetch(`${API_BASE_URL}/demos/${idDemo}/ejecutar?id_vehiculo=${idVehiculo}`, {
        method: 'POST'
      });

      if (!response.ok) throw new Error(`Error al ejecutar DEMO ${idDemo}: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('[API AWS] Error ejecutando DEMO:', error);
      throw error;
    }
  }
};