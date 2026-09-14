// Lista precargada de acciones populares de Wall Street (ticker sin sufijo,
// cotizan en dólares) para que el botón "Traer acciones populares" de
// Universo las agregue con un click. El usuario puede agregar cualquier otro
// ticker a mano además de esta lista — esto es solo un punto de partida,
// igual que el universo de CEDEARs se sembró con una lista curada al empezar.

const SECTORES_ACCIONES = {
  Tecnologia: [
    'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'META', 'NVDA', 'TSLA', 'AVGO', 'ORCL',
    'CRM', 'ADBE', 'CSCO', 'ACN', 'AMD', 'INTC', 'IBM', 'QCOM', 'TXN', 'NOW',
    'INTU', 'AMAT', 'MU', 'PANW', 'SNPS', 'CDNS', 'ADI', 'LRCX', 'UBER', 'SHOP',
    'PLTR', 'NET', 'SNOW', 'CRWD', 'DDOG', 'ZS', 'TEAM', 'WDAY', 'ABNB',
  ],
  Salud: [
    'LLY', 'UNH', 'JNJ', 'ABBV', 'MRK', 'TMO', 'ABT', 'PFE', 'DHR', 'AMGN',
    'ISRG', 'BMY', 'GILD', 'VRTX', 'CVS', 'MDT', 'CI', 'ELV', 'REGN', 'ZTS',
  ],
  Financiero: [
    'BRK-B', 'JPM', 'V', 'MA', 'BAC', 'WFC', 'GS', 'MS', 'AXP', 'SPGI',
    'BLK', 'C', 'SCHW', 'PYPL', 'PGR', 'CB', 'PNC', 'USB', 'TFC',
  ],
  Consumo: [
    'WMT', 'PG', 'COST', 'KO', 'PEP', 'MCD', 'NKE', 'SBUX', 'TGT', 'LOW',
    'HD', 'TJX', 'DIS', 'BKNG', 'CMG', 'MDLZ', 'EL', 'CL', 'GIS', 'KHC',
  ],
  'Energia/Industria': [
    'XOM', 'CVX', 'COP', 'SLB', 'EOG', 'PSX', 'BA', 'CAT', 'HON', 'UPS',
    'GE', 'RTX', 'LMT', 'DE', 'UNP', 'MMM', 'FDX', 'NOC', 'ETN', 'EMR',
    'F', 'GM', 'OXY', 'NEE', 'DUK', 'SO',
  ],
};

export const ACCIONES_POPULARES = Object.entries(SECTORES_ACCIONES).flatMap(
  ([sector, tickers]) => tickers.map((ticker) => ({ ticker, sector })),
);
