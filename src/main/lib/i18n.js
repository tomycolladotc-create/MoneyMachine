// Textos bilingües para lo que genera el proceso principal fuera de la UI:
// avisos de escritorio y el mail de resumen periódico. Los códigos estables
// (clasificacion, timing.signal, recomendacion) se traducen acá; el resto de
// la app (renderer) tiene su propio diccionario en src/renderer/js/i18n.js.

const DICT = {
  es: {
    recomendacion: {
      CLOSED: 'posición cerrada', STOP_LOSS: '🚨 VENDER (Stop Loss)',
      TAKE_PROFIT_HOLD: '💎 MANTENER', TAKE_PROFIT_SELL: '💰 VENDER (Take Profit)', HOLD: '✅ Mantener',
    },
    perfil: { AGRESIVO: 'Agresivo', CONSERVADOR: 'Conservador' },
    frecuencia: { diario: 'diario', semanal: 'semanal', mensual: 'mensual' },
    notif: {
      carteraAtencion: 'Tu cartera necesita atención',
      posicionesAtencion: ({ n }) => `${n} posiciones necesitan atención`,
      nuevaOportunidad: ({ n, perfil }) => `Nueva${n > 1 ? 's' : ''} oportunidad${n > 1 ? 'es' : ''} — ${perfil}`,
      yMas: ({ n }) => `y ${n} más`,
    },
    resumen: {
      asuntoPeriodico: 'Panel CEDEARs — resumen de tu cartera',
      asuntoPrueba: 'Panel CEDEARs — resumen de prueba',
      sinDatosParaResumen: 'Todavía no hay datos de la cartera para armar un resumen.',
      encabezado: ({ etiqueta, fecha }) => `📊 Panel CEDEARs — resumen ${etiqueta} (${fecha})`,
      sinMovimientos: 'Todavía no tenés movimientos cargados en tu cartera.',
      tituloAcciones: '💵 Acciones (Wall Street, en dólares):',
      tituloCripto: '🪙 Cripto (en dólares):',
      invertido: 'Invertido', valorHoy: 'Valor hoy', ganancia: 'Ganancia',
      evolucionDesdeUltimo: ({ fecha, valor }) => `📊 Desde tu último resumen (${fecha}): ${valor}`,
      vsPf: 'vs. Plazo fijo', vsPfUva: 'vs. Plazo fijo UVA', vsSp500: 'vs. S&P 500', vsBtc: 'vs. Bitcoin',
      comoVienenPosiciones: '📋 Cómo vienen tus posiciones:',
      comoVieneLaCosa: '— Cómo viene la cosa —',
      comprarAhora: '⭐ Comprar ahora:',
      diagVaBien: '🟢 Vas por buen camino: tu cartera está en ganancia y le está ganando a todas las alternativas con las que se compara (plazo fijo y el mercado americano).',
      diagGanandoParcial: '🟡 Vas ganando plata en general, pero no le estás ganando a todas las alternativas — mirá el detalle de "vs." de arriba para ver contra cuál te está costando más.',
      diagPerdiendoTodas: '🔴 Tu cartera está en pérdida y por ahora rinde peor que todas las alternativas de comparación.',
      diagPerdiendo: '🔴 Tu cartera está en pérdida por ahora.',
      diagStopLoss: ({ tickers, plural }) => `⚠️ Recomendación: ${tickers} está${plural ? 'n' : ''} en zona de Stop Loss — vale la pena revisar${plural ? 'los' : 'lo'} con atención.`,
      diagTakeProfit: ({ tickers }) => `💎 ${tickers} ya superó tu umbral de Take Profit — podrías evaluar asegurar parte de esa ganancia.`,
      diagUnSoloTicker: '⚠️ Toda la cartera está en un solo ticker — diversificar en más empresas reduce el riesgo de que un mal día de una sola te pegue fuerte a todo el capital.',
      diagConcentracion: ({ ticker, pct }) => `⚠️ ${ticker} concentra ${pct}% del valor de tu cartera — podría convenir diversificar un poco más para no depender tanto de una sola empresa.`,
      diagSinAlertas: 'No hay ninguna alerta puntual por ahora — seguí como venís.',
    },
  },
  en: {
    recomendacion: {
      CLOSED: 'closed position', STOP_LOSS: '🚨 SELL (Stop Loss)',
      TAKE_PROFIT_HOLD: '💎 HOLD', TAKE_PROFIT_SELL: '💰 SELL (Take Profit)', HOLD: '✅ Hold',
    },
    perfil: { AGRESIVO: 'Aggressive', CONSERVADOR: 'Conservative' },
    frecuencia: { diario: 'daily', semanal: 'weekly', mensual: 'monthly' },
    notif: {
      carteraAtencion: 'Your portfolio needs attention',
      posicionesAtencion: ({ n }) => `${n} positions need attention`,
      nuevaOportunidad: ({ n, perfil }) => `New opportunit${n > 1 ? 'ies' : 'y'} — ${perfil}`,
      yMas: ({ n }) => `and ${n} more`,
    },
    resumen: {
      asuntoPeriodico: 'Panel CEDEARs — your portfolio summary',
      asuntoPrueba: 'Panel CEDEARs — test summary',
      sinDatosParaResumen: 'There\'s no portfolio data yet to build a summary.',
      encabezado: ({ etiqueta, fecha }) => `📊 Panel CEDEARs — ${etiqueta} summary (${fecha})`,
      sinMovimientos: 'You don\'t have any transactions in your portfolio yet.',
      tituloAcciones: '💵 Stocks (Wall Street, in dollars):',
      tituloCripto: '🪙 Crypto (in dollars):',
      invertido: 'Invested', valorHoy: 'Value today', ganancia: 'Gain',
      evolucionDesdeUltimo: ({ fecha, valor }) => `📊 Since your last summary (${fecha}): ${valor}`,
      vsPf: 'vs. Time deposit', vsPfUva: 'vs. UVA time deposit', vsSp500: 'vs. S&P 500', vsBtc: 'vs. Bitcoin',
      comoVienenPosiciones: '📋 How your positions are doing:',
      comoVieneLaCosa: '— How things are going —',
      comprarAhora: '⭐ Buy now:',
      diagVaBien: '🟢 You\'re on the right track: your portfolio is in profit and beating every alternative it\'s compared against (time deposit and the US market).',
      diagGanandoParcial: '🟡 You\'re making money overall, but not beating every alternative — check the "vs." detail above to see which one is costing you the most.',
      diagPerdiendoTodas: '🔴 Your portfolio is at a loss and currently underperforming every comparison alternative.',
      diagPerdiendo: '🔴 Your portfolio is at a loss right now.',
      diagStopLoss: ({ tickers, plural }) => `⚠️ Heads up: ${tickers} ${plural ? 'are' : 'is'} in Stop Loss territory — worth reviewing ${plural ? 'them' : 'it'} closely.`,
      diagTakeProfit: ({ tickers }) => `💎 ${tickers} already passed your Take Profit threshold — you could consider locking in some of that gain.`,
      diagUnSoloTicker: '⚠️ Your whole portfolio is in a single ticker — diversifying into more companies reduces the risk of one bad day hitting all your capital.',
      diagConcentracion: ({ ticker, pct }) => `⚠️ ${ticker} makes up ${pct}% of your portfolio's value — it might be worth diversifying a bit more so you don't depend so much on a single company.`,
      diagSinAlertas: 'No specific alerts right now — keep it up.',
    },
  },
};

function idiomaValido(idioma) {
  return idioma === 'en' ? 'en' : 'es';
}

function t(idioma, path, vars) {
  const dict = DICT[idiomaValido(idioma)];
  const val = path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), dict);
  if (val == null) return path;
  if (typeof val === 'function') return val(vars || {});
  return val;
}

function traducirRecomendacion(idioma, codigo) {
  return t(idioma, `recomendacion.${codigo}`) || codigo || '';
}

function traducirPerfil(idioma, codigo) {
  return t(idioma, `perfil.${codigo}`) || codigo || '';
}

module.exports = { t, traducirRecomendacion, traducirPerfil };
