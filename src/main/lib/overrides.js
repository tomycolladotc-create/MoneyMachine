// Para algunos tickers, el símbolo "pelado" (sin .BA) no existe en Yahoo o no
// trae fundamentals/analistas. Se verificó a mano cuál es el símbolo real que
// sí responde con datos completos:
// - Los sufijos numéricos "3"/"11" son códigos de acciones locales de B3
//   (Brasil): ahí el fundamentals hay que pedirlo con sufijo ".SA".
// - El resto son tickers directamente mal formados en el listado original de
//   CEDEARs (ej. "XROX" en vez de "XRX", "DISN" en vez de "DIS").
// Dos tickers (AKO.B, BKC) no tienen ni un listado CEDEAR (.BA) que responda en
// Yahoo ni un símbolo alternativo confirmado, así que quedan sin resolver.

const FUNDAMENTALS_OVERRIDE = {
  ITUB3: 'ITUB3.SA',
  ABEV3: 'ABEV3.SA',
  BBAS3: 'BBAS3.SA',
  BBDC3: 'BBDC3.SA',
  CSNA3: 'CSNA3.SA',
  HAPV3: 'HAPV3.SA',
  LREN3: 'LREN3.SA',
  MGLU3: 'MGLU3.SA',
  NATU3: 'NATU3.SA',
  PETR3: 'PETR3.SA',
  PRIO3: 'PRIO3.SA',
  RENT3: 'RENT3.SA',
  SBSP3: 'SBSP3.SA',
  SUZB3: 'SUZB3.SA',
  TIMS3: 'TIMS3.SA',
  VALE3: 'VALE3.SA',
  VIVT3: 'VIVT3.SA',
  WEGE3: 'WEGE3.SA',
  BPA11: 'BPAC11.SA',
  XROX: 'XRX',
  DISN: 'DIS',
  TRVV: 'TRV',
  KOFM: 'KOF',
  ADS: 'ADS.DE',
};

function fundamentalsTicker(tickerBare) {
  return FUNDAMENTALS_OVERRIDE[tickerBare] || tickerBare;
}

module.exports = { FUNDAMENTALS_OVERRIDE, fundamentalsTicker };
