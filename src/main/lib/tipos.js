// Infiere el tipo de un ticker (CEDEAR, ACCION o CRYPTO) a partir de su propio
// símbolo de mercado, sin necesitar guardar un campo aparte en la cartera:
// los CEDEARs siempre terminan en ".BA" (BYMA), las criptomonedas en "-USD"
// (la convención de Yahoo Finance para pares cripto/dólar, ej. "BTC-USD"), y
// todo lo demás es una acción de Wall Street cotizando directo en dólares.
function tipoDeTicker(ticker) {
  const t = (ticker || '').toUpperCase();
  if (t.endsWith('.BA')) return 'CEDEAR';
  if (t.endsWith('-USD')) return 'CRYPTO';
  return 'ACCION';
}

// Moneda en la que cotiza el precio de mercado de ese ticker.
function monedaDeTicker(ticker) {
  return tipoDeTicker(ticker) === 'CEDEAR' ? 'ARS' : 'USD';
}

module.exports = { tipoDeTicker, monedaDeTicker };
