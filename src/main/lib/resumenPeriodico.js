// Resumen periódico de la cartera enviado por mail (SMTP, vía nodemailer) con
// la frecuencia que el usuario elija. No depende de ningún servicio de
// terceros: usa la propia cuenta de mail del usuario (ej. Gmail con una
// "contraseña de aplicación").

const nodemailer = require('nodemailer');
const { t, traducirRecomendacion, traducirPerfil } = require('./i18n');

function diasEntreFechas(fechaIniISO, fechaFinISO) {
  const a = new Date(fechaIniISO + 'T00:00:00Z').getTime();
  const b = new Date(fechaFinISO + 'T00:00:00Z').getTime();
  return Math.round((b - a) / 86400000);
}

// hoy: objeto Date (hora local); horaHHMM: 'HH:MM'. True si ya pasó esa hora hoy.
function horaCumplida(hoy, horaHHMM) {
  const [h, m] = (horaHHMM || '09:00').split(':').map(Number);
  return hoy.getHours() > h || (hoy.getHours() === h && hoy.getMinutes() >= m);
}

// ultimoEnvioISO: 'YYYY-MM-DD' de la última vez que se mandó, o null si nunca.
// hoyISO: 'YYYY-MM-DD' de hoy. hoy: Date de ahora (para chequear la hora).
function debeEnviarResumen(frecuencia, horaHHMM, ultimoEnvioISO, hoyISO, hoy) {
  if (!horaCumplida(hoy, horaHHMM)) return false;
  if (!ultimoEnvioISO) return true;
  if (ultimoEnvioISO === hoyISO) return false; // ya se mandó hoy, no repetir

  if (frecuencia === 'semanal') return diasEntreFechas(ultimoEnvioISO, hoyISO) >= 7;
  if (frecuencia === 'mensual') return ultimoEnvioISO.slice(0, 7) !== hoyISO.slice(0, 7);
  return true; // 'diario': alcanza con que no sea el mismo día
}

function formatARS(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}

function signo(n) {
  return n >= 0 ? '+' : '';
}

function nombreTicker(tickerBA) {
  return (tickerBA || '').replace(/\.BA$/i, '');
}

// Busca en `historial` (array ordenado por fecha) el punto correspondiente a
// `fechaISO`, o el más cercano anterior si ese día exacto no quedó guardado.
function puntoHistorialEnFecha(historial, fechaISO) {
  if (!historial || !fechaISO) return null;
  let mejor = null;
  for (const p of historial) {
    if (p.fecha > fechaISO) break;
    mejor = p;
  }
  return mejor;
}

// Compara el estado actual contra el del último envío para mostrar cuánto
// cambió la ganancia desde la última vez que se mandó un resumen.
function lineaEvolucionDesdeUltimoEnvio(total, historial, ultimoEnvioISO, idioma) {
  if (!ultimoEnvioISO) return null;
  const puntoAnterior = puntoHistorialEnFecha(historial, ultimoEnvioISO);
  if (!puntoAnterior) return null;
  const delta = total.gananciaCedear - puntoAnterior.gananciaCedear;
  if (Math.abs(delta) < 1) return null;
  return t(idioma, 'resumen.evolucionDesdeUltimo', { fecha: ultimoEnvioISO, valor: `${signo(delta)}${formatARS(delta)}` });
}

// Diagnóstico breve en criollo: si vamos bien, y si no, qué mirar. Son
// observaciones automáticas sobre datos que ya calculó la app (lo mismo que
// ya se ve en Cartera/Resumen) — no es asesoramiento financiero personalizado.
function generarDiagnostico(snapshot, idioma) {
  const total = snapshot?.cartera?.total;
  const posiciones = (snapshot?.cartera?.posiciones || []).filter((p) => p.posicionAbierta);
  if (!total || total.capitalInvertido === 0 || posiciones.length === 0) return null;

  const comparaciones = [total.diferenciaPF, total.diferenciaPFUva, total.diferenciaBenchmark].filter((v) => v != null);
  const leGanaATodas = comparaciones.length > 0 && comparaciones.every((v) => v >= 0);
  const lePierdeATodas = comparaciones.length > 0 && comparaciones.every((v) => v < 0);
  const gananciaPositiva = total.gananciaCedear >= 0;

  const lineas = [];

  if (gananciaPositiva && leGanaATodas) {
    lineas.push(t(idioma, 'resumen.diagVaBien'));
  } else if (gananciaPositiva) {
    lineas.push(t(idioma, 'resumen.diagGanandoParcial'));
  } else if (lePierdeATodas) {
    lineas.push(t(idioma, 'resumen.diagPerdiendoTodas'));
  } else {
    lineas.push(t(idioma, 'resumen.diagPerdiendo'));
  }

  const enStopLoss = posiciones.filter((p) => p.recomendacion === 'STOP_LOSS');
  if (enStopLoss.length > 0) {
    lineas.push(t(idioma, 'resumen.diagStopLoss', { tickers: enStopLoss.map((p) => nombreTicker(p.ticker)).join(', '), plural: enStopLoss.length > 1 }));
  }

  const conTakeProfit = posiciones.filter((p) => p.recomendacion === 'TAKE_PROFIT_HOLD' || p.recomendacion === 'TAKE_PROFIT_SELL');
  if (conTakeProfit.length > 0) {
    lineas.push(t(idioma, 'resumen.diagTakeProfit', { tickers: conTakeProfit.map((p) => nombreTicker(p.ticker)).join(', ') }));
  }

  if (posiciones.length === 1) {
    lineas.push(t(idioma, 'resumen.diagUnSoloTicker'));
  } else {
    const mayor = posiciones.reduce((max, p) => (p.valorHoyTotal > (max?.valorHoyTotal ?? -1) ? p : max), null);
    const concentracionPct = total.valorHoyTotal ? (mayor.valorHoyTotal / total.valorHoyTotal) * 100 : 0;
    if (concentracionPct >= 50) {
      lineas.push(t(idioma, 'resumen.diagConcentracion', { ticker: nombreTicker(mayor.ticker), pct: concentracionPct.toFixed(0) }));
    }
  }

  if (lineas.length === 1 && gananciaPositiva && leGanaATodas) {
    lineas.push(t(idioma, 'resumen.diagSinAlertas'));
  }

  return lineas.join('\n');
}

// snapshot: el snapshot completo de la app. frecuencia: para el título del
// mensaje. historial/ultimoEnvioISO (opcionales): para mostrar cuánto cambió
// desde el resumen anterior. idioma: 'es' | 'en'.
function construirResumenTexto(snapshot, frecuencia, historial, ultimoEnvioISO, idioma) {
  const total = snapshot?.cartera?.total;
  const posiciones = snapshot?.cartera?.posiciones || [];
  const fecha = snapshot?.fecha || '';
  const etiqueta = t(idioma, `frecuencia.${frecuencia}`) || frecuencia;

  if (!total || total.capitalInvertido === 0) {
    return `${t(idioma, 'resumen.encabezado', { etiqueta, fecha })}\n\n${t(idioma, 'resumen.sinMovimientos')}`;
  }

  const gananciaPct = total.capitalInvertido ? (total.gananciaCedear / total.capitalInvertido) * 100 : 0;
  const lineas = [
    t(idioma, 'resumen.encabezado', { etiqueta, fecha }),
    '',
    `💰 ${t(idioma, 'resumen.invertido')}: ${formatARS(total.capitalInvertido)}`,
    `📈 ${t(idioma, 'resumen.valorHoy')}: ${formatARS(total.valorHoyTotal)}`,
    `${total.gananciaCedear >= 0 ? '✅' : '🔻'} ${t(idioma, 'resumen.ganancia')}: ${formatARS(total.gananciaCedear)} (${signo(gananciaPct)}${gananciaPct.toFixed(1)}%)`,
  ];

  const lineaEvolucion = lineaEvolucionDesdeUltimoEnvio(total, historial, ultimoEnvioISO, idioma);
  if (lineaEvolucion) lineas.push(lineaEvolucion);

  lineas.push('');
  lineas.push(`${t(idioma, 'resumen.vsPf')}: ${signo(total.diferenciaPF)}${formatARS(total.diferenciaPF)}`);
  lineas.push(`${t(idioma, 'resumen.vsPfUva')}: ${signo(total.diferenciaPFUva)}${formatARS(total.diferenciaPFUva)}`);
  if (total.diferenciaBenchmark != null) {
    lineas.push(`${t(idioma, 'resumen.vsSp500')}: ${signo(total.diferenciaBenchmark)}${formatARS(total.diferenciaBenchmark)}`);
  }

  const posicionesAbiertas = posiciones.filter((p) => p.posicionAbierta);
  if (posicionesAbiertas.length > 0) {
    lineas.push('');
    lineas.push(t(idioma, 'resumen.comoVienenPosiciones'));
    for (const p of posicionesAbiertas.sort((a, b) => b.gananciaCedear - a.gananciaCedear)) {
      const pct = p.capitalInvertido ? (p.gananciaCedear / p.capitalInvertido) * 100 : 0;
      lineas.push(`${nombreTicker(p.ticker)}: ${signo(p.gananciaCedear)}${formatARS(p.gananciaCedear)} (${signo(pct)}${pct.toFixed(1)}%) — ${traducirRecomendacion(idioma, p.recomendacion)}`);
    }
  }

  const diagnostico = generarDiagnostico(snapshot, idioma);
  if (diagnostico) {
    lineas.push('');
    lineas.push(t(idioma, 'resumen.comoVieneLaCosa'));
    lineas.push(diagnostico);
  }

  const agresivo = (snapshot.oportunidades?.AGRESIVO || []).slice(0, 5).map((x) => x.ticker);
  const conservador = (snapshot.oportunidades?.CONSERVADOR || []).slice(0, 5).map((x) => x.ticker);
  if (agresivo.length || conservador.length) {
    lineas.push('');
    lineas.push(t(idioma, 'resumen.comprarAhora'));
    if (agresivo.length) lineas.push(`${traducirPerfil(idioma, 'AGRESIVO')}: ${agresivo.join(', ')}`);
    if (conservador.length) lineas.push(`${traducirPerfil(idioma, 'CONSERVADOR')}: ${conservador.join(', ')}`);
  }

  return lineas.join('\n');
}

async function enviarEmail({ host, port, usuario, password, destinatario }, asunto, texto) {
  if (!host || !port || !usuario || !password || !destinatario) {
    throw new Error('Falta completar el servidor SMTP, usuario, contraseña o destinatario.');
  }
  const transporte = nodemailer.createTransport({
    host,
    port: Number(port),
    secure: Number(port) === 465,
    auth: { user: usuario, pass: password },
  });
  await transporte.sendMail({
    from: usuario,
    to: destinatario,
    subject: asunto,
    text: texto,
  });
}

module.exports = { construirResumenTexto, generarDiagnostico, enviarEmail, debeEnviarResumen, horaCumplida, diasEntreFechas };
