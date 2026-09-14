// Tasa de interés de plazo fijo tradicional, publicada por el BCRA (Banco
// Central de la República Argentina) vía su API pública de Estadísticas
// Monetarias — sin autenticación, gratuita, mantenida por el propio BCRA.
// Serie oficial usada: "Tasa de interés de depósitos a 30 días de plazo en
// entidades financieras" (idVariable 12), en % nominal anual — es el
// indicador de referencia que reporta el BCRA para el plazo fijo tradicional.
// Fuente: https://api.bcra.gob.ar/estadisticas/v4.0/monetarias/12

const BCRA_URL = 'https://api.bcra.gob.ar/estadisticas/v4.0/monetarias/12?limit=10';
const ID_VARIABLE_TASA_PF = 12;

// Devuelve { tasaAnual: decimal (ej. 0.2151), fecha: 'YYYY-MM-DD' } con el
// último dato publicado por el BCRA para la tasa de plazo fijo a 30 días.
async function obtenerTasaPlazoFijoBCRA() {
  const res = await fetch(BCRA_URL, { headers: { 'Accept-Language': 'es-AR' } });
  if (!res.ok) throw new Error(`BCRA respondió HTTP ${res.status}`);
  const json = await res.json();
  if (json.status !== 200) {
    throw new Error(json.errorMessages?.[0] || `BCRA respondió con estado ${json.status}`);
  }

  const detalle = json.results?.find((r) => r.idVariable === ID_VARIABLE_TASA_PF)?.detalle;
  if (!detalle || detalle.length === 0) {
    throw new Error('El BCRA no devolvió datos para la tasa de plazo fijo.');
  }

  // No se asume ningún orden particular en la respuesta: se toma el registro
  // de fecha más reciente, sea cual sea su posición en el array.
  const ultimo = detalle.reduce((max, d) => (d.fecha > max.fecha ? d : max));
  return { tasaAnual: ultimo.valor / 100, fecha: ultimo.fecha };
}

module.exports = { obtenerTasaPlazoFijoBCRA };
