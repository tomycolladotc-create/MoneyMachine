// Una misma empresa puede aparecer dos veces en una lista de oportunidades:
// una vez como CEDEAR y otra como acción de Wall Street (comparten el mismo
// ticker "pelado", ej. "MU"). Para mostrarla una sola vez en pantalla, se
// agrupan por ese ticker — la Calidad y los fundamentals son los mismos en
// las dos (vienen de la misma empresa), pero el Timing puede diferir porque
// cada una cotiza en un mercado distinto con su propio precio.
//
// El grupo resultante tiene la forma de una oportunidad normal (se puede leer
// `.ticker`, `.calidad`, `.timing`, etc. sin cambiar el código existente) más
// un array `instancias` con cada versión disponible (CEDEAR/Acción/Cripto),
// para poder elegir cuál mirar en el detalle.
export function agruparPorTicker(lista) {
  const grupos = new Map();
  for (const op of lista) {
    if (!grupos.has(op.ticker)) grupos.set(op.ticker, []);
    grupos.get(op.ticker).push(op);
  }
  return [...grupos.values()].map((instancias) => {
    // Representativa: la de mejor Timing, o sea la mejor oportunidad de
    // entrada disponible hoy entre las formas de comprar esta empresa.
    const representativa = instancias.reduce((mejor, i) => (
      (i.timing?.score ?? 0) > (mejor.timing?.score ?? 0) ? i : mejor
    ));
    return { ...representativa, instancias };
  });
}
