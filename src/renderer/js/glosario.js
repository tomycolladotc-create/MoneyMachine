// Diccionario de términos, en criollo, con un ejemplo corto cada uno. Cada
// vista arma su propio glosario eligiendo solo las claves que le sirven.

const TERMINOS = {
  calidad: {
    titulo: 'Calidad (0 a 100)',
    texto: 'Qué tan buena es la empresa como negocio de fondo: si gana plata, si crece, si no está endeudada, y qué opinan los analistas que la siguen. No tiene nada que ver con el momento justo para comprar.',
    ejemplo: 'Una empresa con Calidad 90 factura mucho, crece rápido y casi no tiene deuda. Una con Calidad 20 factura poco, casi no crece y está bastante endeudada.',
  },
  entrada: {
    titulo: 'Entrada / Timing (0 a 100)',
    texto: 'No mide si la empresa es buena, sino si HOY es un buen momento para comprarla según cómo viene moviéndose el precio últimamente.',
    ejemplo: 'Una acción que subió 50% en dos semanas puede tener Calidad alta pero Entrada baja: la empresa es buena, pero comprarla "recién ahora, ya disparada" es más arriesgado.',
  },
  potencial: {
    titulo: 'Potencial',
    texto: 'El % de suba que en promedio esperan los analistas de Wall Street, según el "precio objetivo" que le pusieron a la acción.',
    ejemplo: 'Si la acción cotiza a USD 100 y el precio objetivo promedio es USD 130, el potencial es +30%.',
  },
  volatilidad: {
    titulo: 'Volatilidad (ATR)',
    texto: 'Cuánto se mueve el precio de un día para el otro, en promedio. Más volatilidad no es "mejor" ni "peor": es más riesgo e incertidumbre de corto plazo, para bien o para mal.',
    ejemplo: 'Con un ATR de 5%, un día cualquiera el precio se puede mover ±5%. Una acción con ATR de 1% suele moverse mucho menos de un día al otro.',
  },
  crecimiento: {
    titulo: 'Crecimiento de ingresos',
    texto: 'Cuánto más (o menos) facturó la empresa este último año comparado con el año anterior.',
    ejemplo: '+20% significa que este año vendió un 20% más que el año pasado.',
  },
  roe: {
    titulo: 'ROE (retorno sobre el patrimonio)',
    texto: 'Por cada $100 que los dueños tienen invertidos en la empresa, cuánta ganancia generó en el año.',
    ejemplo: 'Un ROE de 25% significa que la empresa ganó $25 por cada $100 de patrimonio propio.',
  },
  deuda: {
    titulo: 'Deuda / Patrimonio',
    texto: 'Cuánta deuda tiene la empresa comparada con lo que vale su patrimonio propio. Cuanto más bajo, menos comprometida está con bancos y bonistas.',
    ejemplo: 'Un 50% significa que por cada $100 de patrimonio propio, la empresa debe $50 más.',
  },
  rating: {
    titulo: 'Rating de analistas',
    texto: 'El resumen de qué recomiendan en promedio los bancos y casas de research que siguen esa acción: comprar, mantener o vender.',
  },
  rsi: {
    titulo: 'RSI (14)',
    texto: 'Mide si una acción está "sobrecomprada" (todo el mundo comprándola, puede estar cara) o "sobrevendida" (todo el mundo vendiéndola, puede estar barata). Va de 0 a 100; cerca de 50 es zona neutral.',
    ejemplo: 'Un RSI de 80 sugiere que subió mucho y muy rápido; uno de 20 sugiere que cayó mucho y muy rápido.',
  },
  momentum: {
    titulo: 'Momentum (ROC)',
    texto: 'Cuánto subió o bajó el precio en las últimas 20 ruedas, más o menos un mes de bolsa.',
    ejemplo: 'Un ROC de +15% significa que la acción subió 15% en el último mes.',
  },
  tendencia: {
    titulo: 'Tendencia (EMA50 / EMA200)',
    texto: 'Compara el promedio del precio de los últimos 50 días contra el de los últimos 200 días. Si el de 50 días está arriba, la tendencia de mediano plazo es alcista; si está abajo, es bajista.',
  },
  clasificacion: {
    titulo: 'Clasificación',
    texto: 'El resumen final que combina Calidad y Entrada. "⭐ Comprar ahora" = buena empresa y buen momento. "⏳ Esperar mejor entrada" = buena empresa pero está cara/recalentada. "✓ Vigilar" u "○ Esperar" = todavía no convence del todo.',
  },
  costoPromedio: {
    titulo: 'Costo promedio',
    texto: 'El precio promedio al que compraste, contando todas tus compras de ese ticker (no solo la última). Sirve para saber si en conjunto estás ganando o perdiendo.',
    ejemplo: 'Si compraste la mitad a $100 y la otra mitad a $120, tu costo promedio es $110, aunque el precio de mercado hoy sea otro.',
  },
  stopLossTakeProfit: {
    titulo: 'Stop Loss / Take Profit',
    texto: 'Reglas simples para no dejarte llevar por la emoción del momento: si el precio cae mucho desde tu costo promedio (Stop Loss), la app sugiere vender para cortar la pérdida; si sube mucho (Take Profit), sugiere considerar tomar ganancia.',
    ejemplo: 'Con Stop Loss en -15%: si compraste a $100 y cae a $84, la app te avisa que evalúes vender.',
  },
  plazoFijoTradicional: {
    titulo: 'Plazo fijo tradicional',
    texto: 'Poner la misma plata en el banco a una tasa fija en pesos. Sirve como punto de comparación: ¿invertir en CEDEARs rindió más que dejarla quieta en el banco?',
  },
  plazoFijoUva: {
    titulo: 'Plazo fijo UVA',
    texto: 'Un plazo fijo que ajusta el capital por la inflación real y encima paga una tasa chica adicional. Protege mejor contra la inflación que uno tradicional, pero puede rendir menos si la inflación baja fuerte.',
  },
  rendimientoEsperado: {
    titulo: 'Rendimiento esperado',
    texto: 'Una cuenta hipotética de cuánto valdría la cartera si cada acción llegara exactamente a su precio objetivo de analistas dentro de 12 meses.',
    ejemplo: 'Es una expectativa de consenso, no algo garantizado: el precio real puede terminar muy por debajo o por arriba de esa cuenta.',
  },
  marketCapIngresos: {
    titulo: 'Market cap e ingresos (USD)',
    texto: '"Market cap" es cuánto vale la empresa entera en la bolsa (precio de la acción × cantidad de acciones). "Ingresos" es cuánto facturó en el último año. Se muestran en dólares para poder comparar empresas de distintos países en la misma unidad.',
  },
  cedear: {
    titulo: '¿Qué es un CEDEAR?',
    texto: 'Un certificado que representa una acción extranjera (por ejemplo, de una empresa de EE.UU.) pero que cotiza en pesos en la bolsa de Buenos Aires, para poder comprarla desde acá sin sacar la plata del país.',
  },
  perfiles: {
    titulo: 'Perfil Agresivo vs. Conservador',
    texto: 'Dos formas de filtrar oportunidades. Agresivo acepta empresas más chicas y de mayor riesgo/potencial. Conservador exige empresas grandes y más golpeadas, priorizando seguridad por sobre potencial.',
  },
  comision: {
    titulo: 'Comisión del broker',
    texto: 'El % que cobra el broker por comprar o vender. Se descuenta automáticamente al calcular ganancias y pérdidas.',
  },
  sp500: {
    titulo: 'S&P 500',
    texto: 'El índice de las 500 empresas más grandes de EE.UU. — el termómetro más usado para saber "cómo viene el mercado americano" en general. Se compara simulando que hubieras puesto la misma plata, en las mismas fechas, en el CEDEAR que sigue a ese índice (SPY.BA) en vez de en tu cartera.',
    ejemplo: 'Si "Vs. S&P 500" da positivo, tu selección de acciones le ganó al promedio del mercado; si da negativo, te hubiera ido mejor comprando el índice entero en lugar de elegir acciones puntuales.',
  },
  repartoCalidad: {
    titulo: 'Reparto por Calidad',
    texto: 'En vez de repartir el presupuesto en partes iguales entre todos los tickers elegidos, se le asigna más plata a los que tienen mejor Calidad relativa dentro del grupo que elegiste.',
  },
};

function item(key) {
  const t = TERMINOS[key];
  if (!t) return '';
  return `
    <div class="glosario-item">
      <dt>${t.titulo}</dt>
      <dd>${t.texto}${t.ejemplo ? `<span class="glosario-ejemplo">Ejemplo: ${t.ejemplo}</span>` : ''}</dd>
    </div>`;
}

export function renderGlosario(keys, titulo = '¿Qué significan estos números?') {
  const validas = keys.filter((k) => TERMINOS[k]);
  if (validas.length === 0) return '';
  return `
    <details class="glosario">
      <summary>${titulo}</summary>
      <dl class="glosario-lista">${validas.map(item).join('')}</dl>
    </details>`;
}
