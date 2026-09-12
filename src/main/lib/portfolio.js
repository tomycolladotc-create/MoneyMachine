// Cálculo de cartera propia vs. plazo fijo tradicional y plazo fijo UVA.
// Todas las funciones son puras: reciben datos ya resueltos (precios, fechas)
// y devuelven números, sin tocar red ni disco.

const MS_DIA = 86400000;

function diasEntre(fechaIni, fechaFin) {
  const a = new Date(fechaIni + 'T00:00:00Z').getTime();
  const b = new Date(fechaFin + 'T00:00:00Z').getTime();
  return Math.max(0, Math.round((b - a) / MS_DIA));
}

function diasEnMes(anio, mes1a12) {
  return new Date(Date.UTC(anio, mes1a12, 0)).getUTCDate();
}

// Factor de crecimiento por inflación real, encadenando mes a mes y prorrateando
// por día dentro de cada mes. `inflacionMensual` es un mapa 'YYYY-MM' -> decimal.
function factorInflacionAcumulada(fechaIni, fechaFin, inflacionMensual, tasaDefault) {
  let factor = 1;
  const cursor = new Date(fechaIni + 'T00:00:00Z');
  cursor.setUTCDate(cursor.getUTCDate() + 1); // la inflación corre desde el día siguiente a la compra
  const fin = new Date(fechaFin + 'T00:00:00Z');
  while (cursor.getTime() <= fin.getTime()) {
    const anio = cursor.getUTCFullYear();
    const mes = cursor.getUTCMonth() + 1;
    const key = `${anio}-${String(mes).padStart(2, '0')}`;
    const tasaMensual = inflacionMensual[key] ?? tasaDefault;
    const dias = diasEnMes(anio, mes);
    const tasaDiaria = Math.pow(1 + tasaMensual, 1 / dias) - 1;
    factor *= 1 + tasaDiaria;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return factor;
}

function factorTasaDiaria(tasaAnual, dias) {
  return Math.pow(1 + tasaAnual / 365, dias);
}

// Busca en `bars` (ordenadas de más viejo a más nuevo, con { date, close })
// el cierre en la fecha dada o el más reciente anterior. Para lookups locales
// sobre una serie ya bajada, sin ir a pedirle nada nuevo a Yahoo.
function buscarPrecioEnFecha(bars, fecha) {
  let mejor = null;
  for (const b of bars) {
    if (b.date > fecha) break;
    if (b.close != null) mejor = b.close;
  }
  return mejor;
}

// movimientos: [{ fecha, tipo: 'compra'|'venta', monto_ars, precio }]
// precioActualARS: precio de mercado hoy, en pesos
// fechaHoy: 'YYYY-MM-DD'
// benchmark (opcional): { precioEnFecha: (fecha) => precioARS|null, precioHoy: number }
// para comparar contra haber puesto la misma plata en otra cosa (ej. CEDEAR del S&P 500).
function calcularPosicion(ticker, movimientos, precioActualARS, fechaHoy, config, benchmark) {
  const compras = movimientos.filter((m) => m.tipo === 'compra');
  const ventas = movimientos.filter((m) => m.tipo === 'venta');

  const comision = config.COMISION_PCT;

  let cantidadComprada = 0;
  let montoCompradoNeto = 0;
  let capitalInvertido = 0; // bruto: incluye la comisión de compra
  for (const c of compras) {
    cantidadComprada += c.monto_ars / c.precio;
    montoCompradoNeto += c.monto_ars;
    capitalInvertido += c.monto_ars / (1 - comision);
  }
  const costoPromedio = cantidadComprada > 0 ? montoCompradoNeto / cantidadComprada : null;

  let cantidadVendida = 0;
  let recuperado = 0;
  for (const v of ventas) {
    cantidadVendida += v.monto_ars / v.precio;
    recuperado += v.monto_ars;
  }

  const cantidadNeta = cantidadComprada - cantidadVendida;
  const posicionAbierta = cantidadNeta > 1e-9;
  const valorActual = posicionAbierta ? cantidadNeta * precioActualARS * (1 - comision) : 0;
  const valorHoyTotal = recuperado + valorActual;
  const gananciaCedear = valorHoyTotal - capitalInvertido;

  // Plazo fijo tradicional: cada compra (monto bruto) crece a interés compuesto
  // diario desde su fecha hasta hoy.
  let valorPF = 0;
  let valorPFUva = 0;
  for (const c of compras) {
    const montoGross = c.monto_ars / (1 - comision);
    const dias = diasEntre(c.fecha, fechaHoy);
    valorPF += montoGross * factorTasaDiaria(config.TASA_PF_ANUAL, dias);

    const factorInfl = factorInflacionAcumulada(
      c.fecha, fechaHoy, config.INFLACION_MENSUAL, config.INFLACION_MENSUAL_ESTIMADA_DEFAULT,
    );
    const factorPlus = factorTasaDiaria(config.TASA_PF_UVA_PLUS_ANUAL, dias);
    valorPFUva += montoGross * factorInfl * factorPlus;
  }
  const gananciaPF = valorPF - capitalInvertido;
  const gananciaPFUva = valorPFUva - capitalInvertido;

  // Benchmark (ej. S&P 500 vía CEDEAR): cada compra, en vez de crecer a una tasa
  // fija, crece según cuánto subió/bajó realmente el benchmark entre esa fecha y hoy.
  let valorBenchmark = null;
  let compradoSinDatoBenchmark = false;
  if (benchmark) {
    valorBenchmark = 0;
    for (const c of compras) {
      const montoGross = c.monto_ars / (1 - comision);
      const precioEnCompra = benchmark.precioEnFecha(c.fecha);
      if (precioEnCompra == null || benchmark.precioHoy == null) {
        compradoSinDatoBenchmark = true;
        continue;
      }
      valorBenchmark += montoGross * (benchmark.precioHoy / precioEnCompra);
    }
    if (compradoSinDatoBenchmark && valorBenchmark === 0) valorBenchmark = null;
  }
  const gananciaBenchmark = valorBenchmark != null ? valorBenchmark - capitalInvertido : null;

  return {
    ticker,
    posicionAbierta,
    cantidadNeta,
    costoPromedio,
    capitalInvertido,
    recuperado,
    valorActual,
    valorHoyTotal,
    gananciaCedear,
    valorPF,
    gananciaPF,
    diferenciaPF: gananciaCedear - gananciaPF,
    valorPFUva,
    gananciaPFUva,
    diferenciaPFUva: gananciaCedear - gananciaPFUva,
    valorBenchmark,
    gananciaBenchmark,
    diferenciaBenchmark: gananciaBenchmark != null ? gananciaCedear - gananciaBenchmark : null,
    benchmarkIncompleto: compradoSinDatoBenchmark,
  };
}

function calcularRecomendacion(posicion, precioActualARS, potencialPct, config) {
  if (!posicion.posicionAbierta || posicion.costoPromedio == null) return 'posición cerrada';
  const varPct = ((precioActualARS - posicion.costoPromedio) / posicion.costoPromedio) * 100;
  if (varPct <= config.STOP_LOSS_PCT) return '🚨 VENDER (Stop Loss)';
  if (varPct >= config.TAKE_PROFIT_PCT) {
    if (potencialPct != null && potencialPct > 15) return '💎 MANTENER';
    return '💰 VENDER (Take Profit)';
  }
  return '✅ Mantener';
}

function totalizar(posiciones) {
  const t = {
    capitalInvertido: 0, valorHoyTotal: 0, gananciaCedear: 0,
    gananciaPF: 0, diferenciaPF: 0, gananciaPFUva: 0, diferenciaPFUva: 0,
    gananciaBenchmark: 0, diferenciaBenchmark: 0, benchmarkIncompleto: false,
  };
  let hayBenchmark = false;
  for (const p of posiciones) {
    t.capitalInvertido += p.capitalInvertido;
    t.valorHoyTotal += p.valorHoyTotal;
    t.gananciaCedear += p.gananciaCedear;
    t.gananciaPF += p.gananciaPF;
    t.diferenciaPF += p.diferenciaPF;
    t.gananciaPFUva += p.gananciaPFUva;
    t.diferenciaPFUva += p.diferenciaPFUva;
    if (p.gananciaBenchmark != null) {
      hayBenchmark = true;
      t.gananciaBenchmark += p.gananciaBenchmark;
      t.diferenciaBenchmark += p.diferenciaBenchmark;
    }
    if (p.benchmarkIncompleto) t.benchmarkIncompleto = true;
  }
  if (!hayBenchmark) {
    t.gananciaBenchmark = null;
    t.diferenciaBenchmark = null;
  }
  return t;
}

module.exports = {
  diasEntre,
  factorInflacionAcumulada,
  factorTasaDiaria,
  buscarPrecioEnFecha,
  calcularPosicion,
  calcularRecomendacion,
  totalizar,
};
