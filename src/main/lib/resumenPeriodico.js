// Resumen periódico de la cartera enviado por mail (SMTP, vía nodemailer) con
// la frecuencia que el usuario elija. No depende de ningún servicio de
// terceros: usa la propia cuenta de mail del usuario (ej. Gmail con una
// "contraseña de aplicación").

const nodemailer = require('nodemailer');

const NOMBRE_FRECUENCIA = { diario: 'diario', semanal: 'semanal', mensual: 'mensual' };

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
function lineaEvolucionDesdeUltimoEnvio(t, historial, ultimoEnvioISO) {
  if (!ultimoEnvioISO) return null;
  const puntoAnterior = puntoHistorialEnFecha(historial, ultimoEnvioISO);
  if (!puntoAnterior) return null;
  const delta = t.gananciaCedear - puntoAnterior.gananciaCedear;
  if (Math.abs(delta) < 1) return null;
  return `📊 Desde tu último resumen (${ultimoEnvioISO}): ${signo(delta)}${formatARS(delta)}`;
}

// Diagnóstico breve en criollo: si vamos bien, y si no, qué mirar. Son
// observaciones automáticas sobre datos que ya calculó la app (lo mismo que
// ya se ve en Cartera/Resumen) — no es asesoramiento financiero personalizado.
function generarDiagnostico(snapshot) {
  const t = snapshot?.cartera?.total;
  const posiciones = (snapshot?.cartera?.posiciones || []).filter((p) => p.posicionAbierta);
  if (!t || t.capitalInvertido === 0 || posiciones.length === 0) return null;

  const comparaciones = [t.diferenciaPF, t.diferenciaPFUva, t.diferenciaBenchmark].filter((v) => v != null);
  const leGanaATodas = comparaciones.length > 0 && comparaciones.every((v) => v >= 0);
  const lePierdeATodas = comparaciones.length > 0 && comparaciones.every((v) => v < 0);
  const gananciaPositiva = t.gananciaCedear >= 0;

  const lineas = [];

  if (gananciaPositiva && leGanaATodas) {
    lineas.push('🟢 Vas por buen camino: tu cartera está en ganancia y le está ganando a todas las alternativas con las que se compara (plazo fijo y el mercado americano).');
  } else if (gananciaPositiva) {
    lineas.push('🟡 Vas ganando plata en general, pero no le estás ganando a todas las alternativas — mirá el detalle de "vs." de arriba para ver contra cuál te está costando más.');
  } else if (lePierdeATodas) {
    lineas.push('🔴 Tu cartera está en pérdida y por ahora rinde peor que todas las alternativas de comparación.');
  } else {
    lineas.push('🔴 Tu cartera está en pérdida por ahora.');
  }

  const enStopLoss = posiciones.filter((p) => p.recomendacion.includes('Stop Loss'));
  if (enStopLoss.length > 0) {
    lineas.push(`⚠️ Recomendación: ${enStopLoss.map((p) => nombreTicker(p.ticker)).join(', ')} está${enStopLoss.length > 1 ? 'n' : ''} en zona de Stop Loss — vale la pena revisar${enStopLoss.length > 1 ? 'los' : 'lo'} con atención.`);
  }

  const conTakeProfit = posiciones.filter((p) => p.recomendacion.includes('MANTENER') || p.recomendacion.includes('Take Profit'));
  if (conTakeProfit.length > 0) {
    lineas.push(`💎 ${conTakeProfit.map((p) => nombreTicker(p.ticker)).join(', ')} ya superó tu umbral de Take Profit — podrías evaluar asegurar parte de esa ganancia.`);
  }

  if (posiciones.length === 1) {
    lineas.push('⚠️ Toda la cartera está en un solo ticker — diversificar en más empresas reduce el riesgo de que un mal día de una sola te pegue fuerte a todo el capital.');
  } else {
    const mayor = posiciones.reduce((max, p) => (p.valorHoyTotal > (max?.valorHoyTotal ?? -1) ? p : max), null);
    const concentracionPct = t.valorHoyTotal ? (mayor.valorHoyTotal / t.valorHoyTotal) * 100 : 0;
    if (concentracionPct >= 50) {
      lineas.push(`⚠️ ${nombreTicker(mayor.ticker)} concentra ${concentracionPct.toFixed(0)}% del valor de tu cartera — podría convenir diversificar un poco más para no depender tanto de una sola empresa.`);
    }
  }

  if (lineas.length === 1 && gananciaPositiva && leGanaATodas) {
    lineas.push('No hay ninguna alerta puntual por ahora — seguí como venís.');
  }

  return lineas.join('\n');
}

// snapshot: el snapshot completo de la app. frecuencia: para el título del
// mensaje. historial/ultimoEnvioISO (opcionales): para mostrar cuánto cambió
// desde el resumen anterior.
function construirResumenTexto(snapshot, frecuencia, historial, ultimoEnvioISO) {
  const t = snapshot?.cartera?.total;
  const posiciones = snapshot?.cartera?.posiciones || [];
  const fecha = snapshot?.fecha || '';
  const etiqueta = NOMBRE_FRECUENCIA[frecuencia] || frecuencia;

  if (!t || t.capitalInvertido === 0) {
    return `📊 Panel CEDEARs — resumen ${etiqueta} (${fecha})\n\nTodavía no tenés movimientos cargados en tu cartera.`;
  }

  const gananciaPct = t.capitalInvertido ? (t.gananciaCedear / t.capitalInvertido) * 100 : 0;
  const lineas = [
    `📊 Panel CEDEARs — resumen ${etiqueta} (${fecha})`,
    '',
    `💰 Invertido: ${formatARS(t.capitalInvertido)}`,
    `📈 Valor hoy: ${formatARS(t.valorHoyTotal)}`,
    `${t.gananciaCedear >= 0 ? '✅' : '🔻'} Ganancia: ${formatARS(t.gananciaCedear)} (${signo(gananciaPct)}${gananciaPct.toFixed(1)}%)`,
  ];

  const lineaEvolucion = lineaEvolucionDesdeUltimoEnvio(t, historial, ultimoEnvioISO);
  if (lineaEvolucion) lineas.push(lineaEvolucion);

  lineas.push('');
  lineas.push(`vs. Plazo fijo: ${signo(t.diferenciaPF)}${formatARS(t.diferenciaPF)}`);
  lineas.push(`vs. Plazo fijo UVA: ${signo(t.diferenciaPFUva)}${formatARS(t.diferenciaPFUva)}`);
  if (t.diferenciaBenchmark != null) {
    lineas.push(`vs. S&P 500: ${signo(t.diferenciaBenchmark)}${formatARS(t.diferenciaBenchmark)}`);
  }

  const posicionesAbiertas = posiciones.filter((p) => p.posicionAbierta);
  if (posicionesAbiertas.length > 0) {
    lineas.push('');
    lineas.push('📋 Cómo vienen tus posiciones:');
    for (const p of posicionesAbiertas.sort((a, b) => b.gananciaCedear - a.gananciaCedear)) {
      const pct = p.capitalInvertido ? (p.gananciaCedear / p.capitalInvertido) * 100 : 0;
      lineas.push(`${nombreTicker(p.ticker)}: ${signo(p.gananciaCedear)}${formatARS(p.gananciaCedear)} (${signo(pct)}${pct.toFixed(1)}%) — ${p.recomendacion}`);
    }
  }

  const diagnostico = generarDiagnostico(snapshot);
  if (diagnostico) {
    lineas.push('');
    lineas.push('— Cómo viene la cosa —');
    lineas.push(diagnostico);
  }

  const agresivo = (snapshot.oportunidades?.AGRESIVO || []).slice(0, 5).map((x) => x.ticker);
  const conservador = (snapshot.oportunidades?.CONSERVADOR || []).slice(0, 5).map((x) => x.ticker);
  if (agresivo.length || conservador.length) {
    lineas.push('');
    lineas.push('⭐ Comprar ahora:');
    if (agresivo.length) lineas.push(`Agresivo: ${agresivo.join(', ')}`);
    if (conservador.length) lineas.push(`Conservador: ${conservador.join(', ')}`);
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
