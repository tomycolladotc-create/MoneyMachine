const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('path');
const store = require('./lib/store');
const { analizarUniverso, analizarCartera, hoyISO, obtenerHistorico } = require('./lib/analysis');
const { puntuarCalidad } = require('./lib/scoring');
const { detectarNovedades } = require('./lib/notificaciones');
const { construirResumenTexto, enviarEmail, debeEnviarResumen } = require('./lib/resumenPeriodico');
const { fetchChart, buscarSimbolos, closePriceOnOrBefore } = require('./lib/yahoo');
const { obtenerInflacionMensualINDEC } = require('./lib/indec');

app.setAppUserModelId('com.tomycollado.panelcedears');

let mainWindow = null;
let refreshTimer = null;
let refreshing = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0a0d12',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  if (!app.isPackaged) {
    mainWindow.webContents.on('console-message', (_evt, level, message, line, sourceId) => {
      console.log(`[renderer] ${message} (${sourceId}:${line})`);
    });
    mainWindow.webContents.on('did-fail-load', (_evt, code, desc) => {
      console.log(`[renderer] did-fail-load ${code} ${desc}`);
    });
  }
}

function registrarHistorial(total, fecha) {
  store.registrarPuntoHistorial({
    fecha,
    capitalInvertido: total.capitalInvertido,
    valorHoyTotal: total.valorHoyTotal,
    gananciaCedear: total.gananciaCedear,
    gananciaPF: total.gananciaPF,
    gananciaPFUva: total.gananciaPFUva,
    gananciaBenchmark: total.gananciaBenchmark,
  });
}

function mostrarNotificaciones(anterior, nuevo, config) {
  if (!config.NOTIFICACIONES_ACTIVADAS || !Notification.isSupported()) return;
  for (const aviso of detectarNovedades(anterior, nuevo)) {
    const notif = new Notification({ title: aviso.titulo, body: aviso.cuerpo });
    notif.on('click', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
    });
    notif.show();
  }
}

function datosSmtp(config) {
  return {
    host: config.RESUMEN_EMAIL_SMTP_HOST,
    port: config.RESUMEN_EMAIL_SMTP_PORT,
    usuario: config.RESUMEN_EMAIL_USUARIO,
    password: config.RESUMEN_EMAIL_PASSWORD,
    destinatario: config.RESUMEN_EMAIL_DESTINATARIO,
  };
}

async function verificarYEnviarResumenEmail(config, snapshot) {
  if (!config.RESUMEN_EMAIL_ACTIVADO) return;
  if (!config.RESUMEN_EMAIL_USUARIO || !config.RESUMEN_EMAIL_PASSWORD || !config.RESUMEN_EMAIL_DESTINATARIO) return;

  const ultimoEnvio = store.getUltimoEnvioResumen();
  const hoy = new Date();
  const hoyStr = hoyISO();
  if (!debeEnviarResumen(config.RESUMEN_EMAIL_FRECUENCIA, config.RESUMEN_EMAIL_HORA, ultimoEnvio, hoyStr, hoy)) return;

  const historial = store.getHistorialCartera();
  const texto = construirResumenTexto(snapshot, config.RESUMEN_EMAIL_FRECUENCIA, historial, ultimoEnvio);
  await enviarEmail(datosSmtp(config), 'Panel CEDEARs — resumen de tu cartera', texto);
  store.registrarUltimoEnvioResumen(hoyStr);
}

// Trae la inflación real publicada por INDEC (vía datos.gob.ar) y la aplica
// entera — no es editable a mano. El estimado para el mes en curso (que INDEC
// todavía no publicó) se fija automáticamente en el último dato real conocido,
// en vez de depender de un número que el usuario tenga que mantener él mismo.
async function actualizarInflacionDesdeIndec(config) {
  const inflacionIndec = await obtenerInflacionMensualINDEC();
  const ultimoMes = Object.keys(inflacionIndec).sort().pop();
  const nuevoConfig = {
    ...config,
    INFLACION_MENSUAL: inflacionIndec,
    INFLACION_MENSUAL_ESTIMADA_DEFAULT: ultimoMes ? inflacionIndec[ultimoMes] : config.INFLACION_MENSUAL_ESTIMADA_DEFAULT,
  };
  store.saveConfig(nuevoConfig);
  return nuevoConfig;
}

function sendProgress(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('refresh-progress', payload);
  }
}

async function runRefresh() {
  if (refreshing) return store.getSnapshot();
  refreshing = true;
  try {
    let config = store.getConfig();
    try {
      config = await actualizarInflacionDesdeIndec(config);
    } catch (e) {
      if (!app.isPackaged) console.log('[indec]', e.message);
    }
    const cartera = store.getCartera();
    const universo = store.getUniverso();
    const snapshotAnterior = store.getSnapshot();

    sendProgress({ etapa: 'universo', done: 0, total: 0 });
    const { datos, fallaron, oportunidades } = await analizarUniverso(config, universo, (p) => {
      sendProgress({ etapa: 'universo', done: p.done, total: p.total, ticker: p.ticker });
      if (!app.isPackaged && (p.done % 10 === 0 || p.done === p.total)) {
        console.log(`[refresh] ${p.done}/${p.total} (${p.ticker})`);
      }
    });

    sendProgress({ etapa: 'cartera', done: 0, total: 0 });
    const carteraResultado = await analizarCartera(cartera, datos, config);

    const snapshot = {
      timestamp: new Date().toISOString(),
      fecha: hoyISO(),
      fallaron: [...fallaron, ...carteraResultado.fallaron],
      oportunidades,
      cartera: { posiciones: carteraResultado.posiciones, total: carteraResultado.total },
      // se guarda sin `bars` (historial diario) para no inflar el JSON:
      // alcanza con precio/fundamentals para recalcular la cartera sin pedirle todo a Yahoo de nuevo.
      datos: datos.map(({ bars, ...resto }) => resto),
    };
    store.saveSnapshot(snapshot);
    registrarHistorial(carteraResultado.total, snapshot.fecha);
    try {
      mostrarNotificaciones(snapshotAnterior, snapshot, config);
    } catch (e) {
      if (!app.isPackaged) console.log('[notificaciones]', e.message);
    }
    try {
      await verificarYEnviarResumenEmail(config, snapshot);
    } catch (e) {
      if (!app.isPackaged) console.log('[resumen-email]', e.message);
    }
    sendProgress({ etapa: 'listo' });
    return snapshot;
  } catch (e) {
    sendProgress({ etapa: 'error', mensaje: e.message });
    throw e;
  } finally {
    refreshing = false;
  }
}

function scheduleAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  const config = store.getConfig();
  const minutos = Math.max(1, Number(config.AUTO_REFRESH_MIN) || 15);
  refreshTimer = setInterval(() => {
    runRefresh().catch(() => {});
  }, minutos * 60 * 1000);
}

ipcMain.handle('get-snapshot', () => store.getSnapshot());
ipcMain.handle('refresh', () => runRefresh());
ipcMain.handle('get-config', () => store.getConfig());
ipcMain.handle('save-config', (_evt, config) => {
  const saved = store.saveConfig(config);
  scheduleAutoRefresh();
  return saved;
});
ipcMain.handle('get-cartera', () => store.getCartera());
ipcMain.handle('get-universo', () => store.getUniverso());
ipcMain.handle('save-universo', (_evt, universo) => store.saveUniverso(universo));

ipcMain.handle('get-historico', async (_evt, tickerBA) => {
  try {
    return { bars: await obtenerHistorico(tickerBA) };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('simular-cartera', (_evt, { perfil, tickers }) => {
  const snapshot = store.getSnapshot();
  const datos = snapshot?.datos || [];
  const porTicker = new Map(datos.map((d) => [d.ticker, d]));

  const encontrados = [];
  const noEncontrados = [];
  for (const t of tickers) {
    const d = porTicker.get(t);
    if (d) encontrados.push(d);
    else noEncontrados.push(t);
  }

  const puntuados = puntuarCalidad(encontrados, perfil);
  return { resultado: puntuados, noEncontrados };
});
ipcMain.handle('save-cartera', async (_evt, cartera) => {
  store.saveCartera(cartera);
  const config = store.getConfig();
  const snapshot = store.getSnapshot();
  const datos = snapshot?.datos || [];
  const carteraResultado = await analizarCartera(cartera, datos, config);
  const nuevoSnapshot = {
    ...(snapshot || { timestamp: new Date().toISOString(), fecha: hoyISO(), fallaron: [], oportunidades: { AGRESIVO: [], CONSERVADOR: [] }, datos: [] }),
    cartera: { posiciones: carteraResultado.posiciones, total: carteraResultado.total },
  };
  store.saveSnapshot(nuevoSnapshot);
  registrarHistorial(carteraResultado.total, nuevoSnapshot.fecha || hoyISO());
  return nuevoSnapshot;
});

ipcMain.handle('get-historial-cartera', () => store.getHistorialCartera());

ipcMain.handle('buscar-ticker', async (_evt, query) => {
  if (!query || query.trim().length < 2) return [];
  try {
    return await buscarSimbolos(query.trim());
  } catch (e) {
    return [];
  }
});

ipcMain.handle('validar-ticker-ba', async (_evt, tickerBA) => {
  try {
    const chart = await fetchChart(tickerBA, { range: '5d', interval: '1d' });
    const precio = chart.regularMarketPrice ?? chart.bars[chart.bars.length - 1]?.close ?? null;
    return { ok: true, precio };
  } catch (e) {
    let sugerencias = [];
    try {
      const bare = tickerBA.replace(/\.BA$/i, '');
      sugerencias = (await buscarSimbolos(bare)).slice(0, 5);
    } catch (e2) {
      // sin sugerencias, no pasa nada
    }
    return { ok: false, sugerencias };
  }
});

ipcMain.handle('resolver-precio-fecha', async (_evt, { tickerBA, fecha }) => {
  const precio = await closePriceOnOrBefore(tickerBA, fecha);
  if (precio != null) return { ok: true, precio };

  let sugerencias = [];
  try {
    const bare = tickerBA.replace(/\.BA$/i, '');
    sugerencias = (await buscarSimbolos(bare)).filter((s) => s.exchange === 'BUE').slice(0, 5);
  } catch (e) {
    // sin sugerencias, no pasa nada
  }
  return { ok: false, sugerencias };
});

ipcMain.handle('actualizar-inflacion-indec', async () => {
  try {
    const config = await actualizarInflacionDesdeIndec(store.getConfig());
    return { ok: true, config };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('probar-resumen-email', async (_evt, config) => {
  try {
    const snapshot = store.getSnapshot();
    if (!snapshot) return { error: 'Todavía no hay datos de la cartera para armar un resumen.' };
    const historial = store.getHistorialCartera();
    const ultimoEnvio = store.getUltimoEnvioResumen();
    const texto = construirResumenTexto(snapshot, config.RESUMEN_EMAIL_FRECUENCIA, historial, ultimoEnvio);
    await enviarEmail(datosSmtp(config), 'Panel CEDEARs — resumen de prueba', texto);
    return { ok: true };
  } catch (e) {
    return { error: e.message };
  }
});

app.whenReady().then(() => {
  store.init(app.getPath('userData'));
  createWindow();
  scheduleAutoRefresh();
  runRefresh().catch(() => {});

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
