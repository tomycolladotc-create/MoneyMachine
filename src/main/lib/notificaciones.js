// Detecta qué cambió entre dos snapshots para armar avisos de escritorio.
// Función pura: no toca Electron ni el sistema operativo, solo compara datos.
// La idea es avisar en el momento en que algo CAMBIA, no en cada refresco
// mientras la condición sigue igual (para no repetir el mismo aviso cada 15 min).

const PALABRAS_DE_ALERTA = ['Stop Loss', 'Take Profit', 'MANTENER'];

function esRecomendacionDeAlerta(recomendacion) {
  return PALABRAS_DE_ALERTA.some((palabra) => recomendacion?.includes(palabra));
}

function formatearLista(items, max = 8) {
  if (items.length <= max) return items.join(', ');
  return `${items.slice(0, max).join(', ')} y ${items.length - max} más`;
}

// anterior/nuevo: snapshots completos (o null si es el primer refresco de la app).
function detectarNovedades(anterior, nuevo) {
  if (!anterior) return []; // primer refresco de la app: es la línea de base, no "noticias"

  const avisos = [];

  const recomendacionAnteriorPorTicker = new Map(
    (anterior.cartera?.posiciones || []).map((p) => [p.ticker, p.recomendacion]),
  );
  const alertasCartera = (nuevo.cartera?.posiciones || []).filter((p) => {
    const antes = recomendacionAnteriorPorTicker.get(p.ticker);
    return esRecomendacionDeAlerta(p.recomendacion) && p.recomendacion !== antes;
  });
  if (alertasCartera.length > 0) {
    const detalle = alertasCartera.map((p) => `${p.ticker.replace(/\.BA$/i, '')}: ${p.recomendacion}`);
    avisos.push({
      titulo: alertasCartera.length === 1 ? 'Tu cartera necesita atención' : `${alertasCartera.length} posiciones necesitan atención`,
      cuerpo: formatearLista(detalle, 5),
    });
  }

  const NOMBRE_PERFIL = { AGRESIVO: 'Agresivo', CONSERVADOR: 'Conservador' };
  for (const perfil of ['AGRESIVO', 'CONSERVADOR']) {
    const antes = new Set((anterior.oportunidades?.[perfil] || []).map((t) => t.ticker));
    const nuevos = (nuevo.oportunidades?.[perfil] || []).filter((t) => !antes.has(t.ticker));
    if (nuevos.length > 0) {
      avisos.push({
        titulo: `Nueva${nuevos.length > 1 ? 's' : ''} oportunidad${nuevos.length > 1 ? 'es' : ''} — ${NOMBRE_PERFIL[perfil]}`,
        cuerpo: formatearLista(nuevos.map((t) => t.ticker)),
      });
    }
  }

  return avisos;
}

module.exports = { detectarNovedades, esRecomendacionDeAlerta };
