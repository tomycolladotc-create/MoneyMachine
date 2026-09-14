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

function formatUSD(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
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
  // Solo CEDEARs (pesos): plazo fijo, inflación y concentración no se pueden
  // comparar en la misma cuenta contra posiciones en dólares.
  const posiciones = (snapshot?.cartera?.posiciones || []).filter((p) => p.posicionAbierta && !p.esAccion);
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
  const totalUsdInicial = snapshot?.cartera?.totalUsd;
  const totalCryptoInicial = snapshot?.cartera?.totalCrypto;
  const posiciones = snapshot?.cartera?.posiciones || [];
  const fecha = snapshot?.fecha || '';
  const etiqueta = t(idioma, `frecuencia.${frecuencia}`) || frecuencia;

  const hayArs = total && total.capitalInvertido > 0;
  const hayUsd = totalUsdInicial && totalUsdInicial.capitalInvertido > 0;
  const hayCrypto = totalCryptoInicial && totalCryptoInicial.capitalInvertido > 0;
  if (!hayArs && !hayUsd && !hayCrypto) {
    return `${t(idioma, 'resumen.encabezado', { etiqueta, fecha })}\n\n${t(idioma, 'resumen.sinMovimientos')}`;
  }

  const lineas = [t(idioma, 'resumen.encabezado', { etiqueta, fecha })];

  if (hayArs) {
    const gananciaPct = total.capitalInvertido ? (total.gananciaCedear / total.capitalInvertido) * 100 : 0;
    lineas.push(
      '',
      `💰 ${t(idioma, 'resumen.invertido')}: ${formatARS(total.capitalInvertido)}`,
      `📈 ${t(idioma, 'resumen.valorHoy')}: ${formatARS(total.valorHoyTotal)}`,
      `${total.gananciaCedear >= 0 ? '✅' : '🔻'} ${t(idioma, 'resumen.ganancia')}: ${formatARS(total.gananciaCedear)} (${signo(gananciaPct)}${gananciaPct.toFixed(1)}%)`,
    );

    const lineaEvolucion = lineaEvolucionDesdeUltimoEnvio(total, historial, ultimoEnvioISO, idioma);
    if (lineaEvolucion) lineas.push(lineaEvolucion);

    lineas.push('');
    lineas.push(`${t(idioma, 'resumen.vsPf')}: ${signo(total.diferenciaPF)}${formatARS(total.diferenciaPF)}`);
    lineas.push(`${t(idioma, 'resumen.vsPfUva')}: ${signo(total.diferenciaPFUva)}${formatARS(total.diferenciaPFUva)}`);
    if (total.diferenciaBenchmark != null) {
      lineas.push(`${t(idioma, 'resumen.vsSp500')}: ${signo(total.diferenciaBenchmark)}${formatARS(total.diferenciaBenchmark)}`);
    }
  }

  const posicionesAbiertas = posiciones.filter((p) => p.posicionAbierta && !p.esAccion);
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

  // Acciones de Wall Street (dólares): sección aparte, sin mezclar con los
  // totales en pesos de arriba ni convertir a un tipo de cambio.
  const totalUsd = snapshot?.cartera?.totalUsd;
  const posicionesUsdAbiertas = posiciones.filter((p) => p.posicionAbierta && p.tipo === 'ACCION');
  if (totalUsd && totalUsd.capitalInvertido > 0) {
    const gananciaPctUsd = totalUsd.capitalInvertido ? (totalUsd.gananciaCedear / totalUsd.capitalInvertido) * 100 : 0;
    lineas.push('');
    lineas.push(t(idioma, 'resumen.tituloAcciones'));
    lineas.push(`💰 ${t(idioma, 'resumen.invertido')}: ${formatUSD(totalUsd.capitalInvertido)}`);
    lineas.push(`📈 ${t(idioma, 'resumen.valorHoy')}: ${formatUSD(totalUsd.valorHoyTotal)}`);
    lineas.push(`${totalUsd.gananciaCedear >= 0 ? '✅' : '🔻'} ${t(idioma, 'resumen.ganancia')}: ${formatUSD(totalUsd.gananciaCedear)} (${signo(gananciaPctUsd)}${gananciaPctUsd.toFixed(1)}%)`);
    if (totalUsd.diferenciaBenchmark != null) {
      lineas.push(`${t(idioma, 'resumen.vsSp500')}: ${signo(totalUsd.diferenciaBenchmark)}${formatUSD(totalUsd.diferenciaBenchmark)}`);
    }
    if (posicionesUsdAbiertas.length > 0) {
      for (const p of posicionesUsdAbiertas.sort((a, b) => b.gananciaCedear - a.gananciaCedear)) {
        const pct = p.capitalInvertido ? (p.gananciaCedear / p.capitalInvertido) * 100 : 0;
        lineas.push(`${nombreTicker(p.ticker)}: ${signo(p.gananciaCedear)}${formatUSD(p.gananciaCedear)} (${signo(pct)}${pct.toFixed(1)}%) — ${traducirRecomendacion(idioma, p.recomendacion)}`);
      }
    }
  }

  // Cripto (dólares): tercer bloque aparte, ni con los pesos ni con las
  // acciones — cada tipo de activo con su propio total, sin mezclar.
  const totalCrypto = snapshot?.cartera?.totalCrypto;
  const posicionesCryptoAbiertas = posiciones.filter((p) => p.posicionAbierta && p.tipo === 'CRYPTO');
  if (totalCrypto && totalCrypto.capitalInvertido > 0) {
    const gananciaPctCrypto = totalCrypto.capitalInvertido ? (totalCrypto.gananciaCedear / totalCrypto.capitalInvertido) * 100 : 0;
    lineas.push('');
    lineas.push(t(idioma, 'resumen.tituloCripto'));
    lineas.push(`💰 ${t(idioma, 'resumen.invertido')}: ${formatUSD(totalCrypto.capitalInvertido)}`);
    lineas.push(`📈 ${t(idioma, 'resumen.valorHoy')}: ${formatUSD(totalCrypto.valorHoyTotal)}`);
    lineas.push(`${totalCrypto.gananciaCedear >= 0 ? '✅' : '🔻'} ${t(idioma, 'resumen.ganancia')}: ${formatUSD(totalCrypto.gananciaCedear)} (${signo(gananciaPctCrypto)}${gananciaPctCrypto.toFixed(1)}%)`);
    if (totalCrypto.diferenciaBenchmark != null) {
      lineas.push(`${t(idioma, 'resumen.vsBtc')}: ${signo(totalCrypto.diferenciaBenchmark)}${formatUSD(totalCrypto.diferenciaBenchmark)}`);
    }
    if (posicionesCryptoAbiertas.length > 0) {
      for (const p of posicionesCryptoAbiertas.sort((a, b) => b.gananciaCedear - a.gananciaCedear)) {
        const pct = p.capitalInvertido ? (p.gananciaCedear / p.capitalInvertido) * 100 : 0;
        lineas.push(`${nombreTicker(p.ticker)}: ${signo(p.gananciaCedear)}${formatUSD(p.gananciaCedear)} (${signo(pct)}${pct.toFixed(1)}%) — ${traducirRecomendacion(idioma, p.recomendacion)}`);
      }
    }
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
