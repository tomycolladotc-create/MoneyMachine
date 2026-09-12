// Detecta qué cambió entre dos snapshots para armar avisos de escritorio.
// Función pura: no toca Electron ni el sistema operativo, solo compara datos.
// La idea es avisar en el momento en que algo CAMBIA, no en cada refresco
// mientras la condición sigue igual (para no repetir el mismo aviso cada 15 min).

const { t, traducirRecomendacion, traducirPerfil } = require('./i18n');

// Códigos estables devueltos por portfolio.js (calcularRecomendacion) — ver
// comentario sobre señalDeTiming en scoring.js.
const CODIGOS_DE_ALERTA = new Set(['STOP_LOSS', 'TAKE_PROFIT_SELL', 'TAKE_PROFIT_HOLD']);

function esRecomendacionDeAlerta(codigo) {
  return CODIGOS_DE_ALERTA.has(codigo);
}

function formatearLista(items, max = 8, idioma) {
  if (items.length <= max) return items.join(', ');
  return `${items.slice(0, max).join(', ')} ${t(idioma, 'notif.yMas', { n: items.length - max })}`;
}

// anterior/nuevo: snapshots completos (o null si es el primer refresco de la app).
function detectarNovedades(anterior, nuevo, idioma) {
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
    const detalle = alertasCartera.map((p) => `${p.ticker.replace(/\.BA$/i, '')}: ${traducirRecomendacion(idioma, p.recomendacion)}`);
    avisos.push({
      titulo: alertasCartera.length === 1 ? t(idioma, 'notif.carteraAtencion') : t(idioma, 'notif.posicionesAtencion', { n: alertasCartera.length }),
      cuerpo: formatearLista(detalle, 5, idioma),
    });
  }

  for (const perfil of ['AGRESIVO', 'CONSERVADOR']) {
    const antes = new Set((anterior.oportunidades?.[perfil] || []).map((t) => t.ticker));
    const nuevos = (nuevo.oportunidades?.[perfil] || []).filter((t) => !antes.has(t.ticker));
    if (nuevos.length > 0) {
      avisos.push({
        titulo: t(idioma, 'notif.nuevaOportunidad', { n: nuevos.length, perfil: traducirPerfil(idioma, perfil) }),
        cuerpo: formatearLista(nuevos.map((tk) => tk.ticker), 8, idioma),
      });
    }
  }

  return avisos;
}

module.exports = { detectarNovedades, esRecomendacionDeAlerta };
