// Universo de CEDEARs y mapeo de sectores. Los tickers son "bare" (sin sufijo .BA);
// el sufijo se agrega donde corresponde al armar las URLs de Yahoo Finance.

const SECTORES = {
  Tecnologia: [
    'AAPL', 'ADBE', 'ADI', 'AI', 'AMAT', 'AMZN', 'ANET', 'ARM', 'ASML', 'AVGO',
    'COIN', 'CRM', 'CSCO', 'DOCU', 'GOOGL', 'HIMS', 'HPQ', 'IBM', 'LRCX', 'META',
    'MRVL', 'MSFT', 'MSI', 'MSTR', 'MU', 'NOW', 'NVDA', 'OKLO', 'ORCL', 'PANW',
    'PINS', 'PLTR', 'QCOM', 'RGTI', 'RKLB', 'SHOP', 'SNAP', 'SNOW', 'SPOT', 'TEAM',
    'TSLA', 'TSM', 'TWLO', 'UBER', 'UPST', 'VRSN', 'XROX', 'XYZ', 'ZM',
  ],
  Salud: [
    'ABBV', 'ABT', 'AMGN', 'AZN', 'BIIB', 'BMY', 'DHR', 'GSK', 'ISRG', 'JNJ',
    'LLY', 'MDT', 'MRK', 'MRNA', 'NVO', 'NVS', 'PFE', 'TMO', 'VRTX',
  ],
  Financiero: [
    'AXP', 'BBV', 'BNY', 'BRKB', 'BX', 'GS', 'ING', 'ITUB', 'ITUB3', 'JPM',
    'MA', 'NU', 'PYPL', 'SAN', 'SCHW', 'USB', 'V', 'XP',
  ],
  Consumo: ['COST', 'KO', 'PEP', 'PG', 'WMT'],
  'Energia/Ind': [
    'AAL', 'AAP', 'ABEV', 'ABEV3', 'ABNB', 'ACN', 'ADGO', 'ADP', 'ADS', 'AEG',
    'AEM', 'AIG', 'ALAB', 'AMX', 'ANF', 'ARCO', 'ASR', 'ASTS', 'AVY',
    'AXIA', 'B', 'BA', 'BAK', 'BB', 'BBAS3', 'BBDC3', 'BCS', 'BHP', 'BIOX',
    'BKNG', 'BKR', 'BMNR', 'BNG', 'BP', 'BPA11', 'BSBR', 'CAAP', 'CAH',
    'CAR', 'CAT', 'CCJ', 'CCL', 'CDE', 'CEG', 'CL', 'CLS', 'COP', 'CRWV',
    'CSNA3', 'CVS', 'CVX', 'CX', 'DAL', 'DE', 'DECK', 'DEO', 'DISN', 'DOW',
    'E', 'EA', 'EBAY', 'ECL', 'EFX', 'EMBJ', 'EQNR', 'ETSY', 'F', 'FCX',
    'FDX', 'FISV', 'FMX', 'FNMA', 'FSLR', 'GE', 'GFI', 'GGB', 'GLNG', 'GLW',
    'GM', 'GPRK', 'GRMN', 'GT', 'HAL', 'HAPV3', 'HDB', 'HL', 'HMY', 'HOG',
    'HON', 'HSY', 'HUT', 'HWM', 'IBN', 'IFF', 'INFY', 'IP', 'IREN', 'JCI',
    'JOYY', 'KB', 'KEEL', 'KEP', 'KMB', 'KOFM', 'LAR', 'LMT', 'LREN3', 'LVS',
    'LYG', 'MDLZ', 'MFG', 'MGLU3', 'MMM', 'MO', 'MOS', 'MP', 'MRSH', 'MUFG',
    'MUX', 'NATU3', 'NBIS', 'NEE', 'NEM', 'NFLX', 'NG', 'NGG', 'NKE', 'NMR',
    'NOKA', 'NUE', 'NXE', 'O', 'ONDS', 'ORLY', 'OXY', 'PAAS', 'PAGS', 'PATH',
    'PBI', 'PBR', 'PCAR', 'PETR3', 'PHG', 'PKS', 'PM', 'PRIO3', 'PSX', 'RACE',
    'RBLX', 'RENT3', 'RIO', 'RIOT', 'ROKU', 'ROST', 'RTX', 'SAP', 'SATL', 'SBS',
    'SBSP3', 'SBUX', 'SCCO', 'SDA', 'SHEL', 'SIEGY', 'SLB', 'SNA', 'SNDK', 'SONY',
    'SPCE', 'SPCX', 'SPGI', 'STLA', 'STNE', 'SUZ', 'SUZB3', 'SWKS', 'SYY', 'T',
    'TCOM', 'TEM', 'TEN', 'TGT', 'TIMB', 'TIMS3', 'TJX', 'TM', 'TMUS', 'TRIP',
    'TRVV', 'TTE', 'TV', 'TXN', 'TXR', 'UAL', 'UGP', 'UL', 'UNH', 'UNP',
    'URBN', 'VALE', 'VALE3', 'VIV', 'VIVT3', 'VST', 'VZ', 'WBO', 'WEGE3', 'XOM',
    'YELP',
  ],
  'Latam/China': ['BABA', 'BIDU', 'GLOB', 'JMIA', 'MELI', 'NIO', 'NTES', 'SE', 'VIST', 'XPEV'],
};

const TICKER_SECTOR = {};
for (const [sector, tickers] of Object.entries(SECTORES)) {
  for (const t of tickers) TICKER_SECTOR[t] = sector;
}

const TODOS_LOS_TICKERS = Object.keys(TICKER_SECTOR);

function sectorDe(tickerBare) {
  return TICKER_SECTOR[tickerBare] || 'Otro';
}

module.exports = { SECTORES, TICKER_SECTOR, TODOS_LOS_TICKERS, sectorDe };
