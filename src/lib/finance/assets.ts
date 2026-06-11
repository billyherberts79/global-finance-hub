export type AssetCategory = "cripto" | "moedas" | "commodities" | "indices";
export type DataSource = "coingecko" | "yahoo";

export interface AssetDef {
  slug: string;
  name: string;
  symbol: string;
  category: AssetCategory;
  source: DataSource;
  /** CoinGecko id (for crypto) or Yahoo symbol (for everything else) */
  apiId: string;
  /** Native currency code (USD, BRL, EUR, GBP, JPY, HKD, CNY) — used to convert to BRL */
  currency: string;
  unit?: string;
}

export const ASSETS: AssetDef[] = [
  // Cripto
  { slug: "btc", name: "Bitcoin", symbol: "BTC", category: "cripto", source: "coingecko", apiId: "bitcoin", currency: "USD" },
  { slug: "eth", name: "Ethereum", symbol: "ETH", category: "cripto", source: "coingecko", apiId: "ethereum", currency: "USD" },

  // Moedas (já cotadas vs BRL)
  { slug: "usdbrl", name: "Dólar Americano", symbol: "USD/BRL", category: "moedas", source: "yahoo", apiId: "USDBRL=X", currency: "BRL" },
  { slug: "eurbrl", name: "Euro", symbol: "EUR/BRL", category: "moedas", source: "yahoo", apiId: "EURBRL=X", currency: "BRL" },
  { slug: "cnybrl", name: "Yuan", symbol: "CNY/BRL", category: "moedas", source: "yahoo", apiId: "CNYBRL=X", currency: "BRL" },

  // Commodities
  { slug: "brent", name: "Petróleo Brent", symbol: "BZ=F", category: "commodities", source: "yahoo", apiId: "BZ=F", currency: "USD", unit: "barril" },
  { slug: "ouro", name: "Ouro", symbol: "GC=F", category: "commodities", source: "yahoo", apiId: "GC=F", currency: "USD", unit: "onça" },
  { slug: "prata", name: "Prata", symbol: "SI=F", category: "commodities", source: "yahoo", apiId: "SI=F", currency: "USD", unit: "onça" },

  // Índices
  { slug: "bvsp", name: "Bovespa", symbol: "^BVSP", category: "indices", source: "yahoo", apiId: "^BVSP", currency: "BRL", unit: "pts" },
  { slug: "ixic", name: "Nasdaq Composite", symbol: "^IXIC", category: "indices", source: "yahoo", apiId: "^IXIC", currency: "USD", unit: "pts" },
  { slug: "dji", name: "Dow Jones", symbol: "^DJI", category: "indices", source: "yahoo", apiId: "^DJI", currency: "USD", unit: "pts" },
  { slug: "gspc", name: "S&P 500", symbol: "^GSPC", category: "indices", source: "yahoo", apiId: "^GSPC", currency: "USD", unit: "pts" },
  { slug: "gdaxi", name: "DAX (Alemanha)", symbol: "^GDAXI", category: "indices", source: "yahoo", apiId: "^GDAXI", currency: "EUR", unit: "pts" },
  { slug: "ftse", name: "FTSE 100 (Reino Unido)", symbol: "^FTSE", category: "indices", source: "yahoo", apiId: "^FTSE", currency: "GBP", unit: "pts" },
  { slug: "n225", name: "Nikkei 225 (Japão)", symbol: "^N225", category: "indices", source: "yahoo", apiId: "^N225", currency: "JPY", unit: "pts" },
  { slug: "hsi", name: "Hang Seng (Hong Kong)", symbol: "^HSI", category: "indices", source: "yahoo", apiId: "^HSI", currency: "HKD", unit: "pts" },
  { slug: "sse", name: "Shanghai Composite", symbol: "000001.SS", category: "indices", source: "yahoo", apiId: "000001.SS", currency: "CNY", unit: "pts" },
];

export function findAsset(slug: string): AssetDef | undefined {
  return ASSETS.find((a) => a.slug === slug);
}

export const CATEGORY_LABEL: Record<AssetCategory, string> = {
  cripto: "Criptomoedas",
  moedas: "Moedas",
  commodities: "Commodities",
  indices: "Índices Globais",
};

/** Yahoo symbols used to fetch FX rates needed for BRL conversion */
export const FX_PAIRS: Record<string, string> = {
  USD: "USDBRL=X",
  EUR: "EURBRL=X",
  GBP: "GBPBRL=X",
  JPY: "JPYBRL=X",
  HKD: "HKDBRL=X",
  CNY: "CNYBRL=X",
};