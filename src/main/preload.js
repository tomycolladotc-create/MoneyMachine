const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getSnapshot: () => ipcRenderer.invoke('get-snapshot'),
  refresh: () => ipcRenderer.invoke('refresh'),
  onRefreshProgress: (callback) => {
    const listener = (_evt, payload) => callback(payload);
    ipcRenderer.on('refresh-progress', listener);
    return () => ipcRenderer.removeListener('refresh-progress', listener);
  },
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  getCartera: () => ipcRenderer.invoke('get-cartera'),
  saveCartera: (cartera) => ipcRenderer.invoke('save-cartera', cartera),
  getUniverso: () => ipcRenderer.invoke('get-universo'),
  saveUniverso: (universo) => ipcRenderer.invoke('save-universo', universo),
  simularCartera: (payload) => ipcRenderer.invoke('simular-cartera', payload),
  getHistorico: (tickerBA) => ipcRenderer.invoke('get-historico', tickerBA),
  getHistorialCartera: () => ipcRenderer.invoke('get-historial-cartera'),
  probarResumenEmail: (config) => ipcRenderer.invoke('probar-resumen-email', config),
  actualizarInflacionIndec: () => ipcRenderer.invoke('actualizar-inflacion-indec'),
  actualizarTasaPfBcra: () => ipcRenderer.invoke('actualizar-tasa-pf-bcra'),
  buscarTicker: (query) => ipcRenderer.invoke('buscar-ticker', query),
  validarTickerBA: (tickerBA) => ipcRenderer.invoke('validar-ticker-ba', tickerBA),
  resolverPrecioFecha: (tickerBA, fecha) => ipcRenderer.invoke('resolver-precio-fecha', { tickerBA, fecha }),
});
