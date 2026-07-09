/**
 * Sinais de mercado de derivativos (futuros perpétuos) como proxy de
 * "pressão de liquidação" / alavancagem excessiva.
 *
 * Fonte: Binance Futures (gratuita, sem API key). Cobre apenas os ativos
 * que têm par de futuros líquido: BTC e ETH.
 *
 * IMPORTANTE: os limiares abaixo (ex.: 20 bps de funding, 20% de variação
 * de OI em 7d) são heurísticas de ponto de partida, não valores validados
 * estatisticamente. O ideal é calibrar via backtest antes de confiar neles
 * para decisão real.
 */

/** Mapeia o slug do ativo (usado no dashboard) para o símbolo de futuros na Binance. */
export const FUTURES_SYMBOL: Record<string, string> = {
  btc: "BTCUSDT",
  eth: "ETHUSDT",
};

export function hasFuturesSignal(slug: string): boolean {
  return slug in FUTURES_SYMBOL;
}

export interface FundingRatePoint {
  t: number; // fundingTime em ms
  rate: number; // decimal, ex.: 0.0001 = 0.01%
}

export interface OpenInterestPoint {
  t: number;
  openInterest: number; // em contratos/moeda base
}

export interface DerivativesSignal {
  slug: string;
  futuresSymbol: string;

  // Funding rate
  currentFundingRate: number | null; // decimal
  avgFundingRate7d: number | null; // decimal
  fundingScore: number; // -1..1 (negativo = shorts pagando/pressão vendedora excessiva; positivo = longs pagando/pressão compradora excessiva)

  // Open Interest
  openInterestNow: number | null;
  openInterestChangePercent7d: number | null;
  oiScore: number; // -1..1 (queda forte = -1, alta forte = +1)

  // Composto
  pressureScore: number; // -1..1, média dos dois acima
  label: "long_squeeze_risk" | "short_squeeze_risk" | "neutro" | "indisponivel";

  /** Mensagens de erro brutas (uma por fonte), só preenchido quando algo falhou. Útil para diagnóstico. */
  debugErrors?: string[];

  updatedAt: string;
}

/** tanh suave para mapear um valor bruto num range -1..1 */
function scaledTanh(value: number, scale: number): number {
  if (!Number.isFinite(value) || scale === 0) return 0;
  return Math.tanh(value / scale);
}

export function computeFundingScore(currentFundingRate: number | null): number {
  if (currentFundingRate == null || !Number.isFinite(currentFundingRate)) return 0;
  const bps = currentFundingRate * 10_000; // decimal -> basis points
  // 20 bps (0.20% ao período de 8h) é considerado um funding bem esticado.
  return scaledTanh(bps, 20);
}

export function computeOiScore(changePercent7d: number | null): number {
  if (changePercent7d == null || !Number.isFinite(changePercent7d)) return 0;
  // 20% de variação de Open Interest em 7 dias é considerado uma mudança forte de alavancagem.
  return scaledTanh(changePercent7d, 20);
}

export function buildDerivativesSignal(params: {
  slug: string;
  futuresSymbol: string;
  fundingHistory: FundingRatePoint[];
  openInterestHistory: OpenInterestPoint[];
  debugErrors?: string[];
}): DerivativesSignal {
  const { slug, futuresSymbol, fundingHistory, openInterestHistory, debugErrors } = params;

  const currentFundingRate = fundingHistory.length
    ? fundingHistory[fundingHistory.length - 1].rate
    : null;

  const last21 = fundingHistory.slice(-21); // ~7 dias (3 funding/dia)
  const avgFundingRate7d = last21.length
    ? last21.reduce((s, p) => s + p.rate, 0) / last21.length
    : null;

  const fundingScore = computeFundingScore(currentFundingRate);

  const openInterestNow = openInterestHistory.length
    ? openInterestHistory[openInterestHistory.length - 1].openInterest
    : null;

  const oiWeekAgo = openInterestHistory.length ? openInterestHistory[0].openInterest : null;

  const openInterestChangePercent7d =
    openInterestNow != null && oiWeekAgo != null && oiWeekAgo !== 0
      ? ((openInterestNow - oiWeekAgo) / oiWeekAgo) * 100
      : null;

  const oiScore = computeOiScore(openInterestChangePercent7d);

  const hasData = currentFundingRate != null || openInterestNow != null;
  const pressureScore = hasData ? (fundingScore + oiScore) / 2 : 0;

  let label: DerivativesSignal["label"] = "indisponivel";
  if (hasData) {
    if (pressureScore > 0.5) label = "long_squeeze_risk";
    else if (pressureScore < -0.5) label = "short_squeeze_risk";
    else label = "neutro";
  }

  return {
    slug,
    futuresSymbol,
    currentFundingRate,
    avgFundingRate7d,
    fundingScore,
    openInterestNow,
    openInterestChangePercent7d,
    oiScore,
    pressureScore,
    label,
    debugErrors: debugErrors && debugErrors.length ? debugErrors : undefined,
    updatedAt: new Date().toISOString(),
  };
}

export const LABEL_DESCRIPTION: Record<DerivativesSignal["label"], string> = {
  long_squeeze_risk:
    "Funding e Open Interest elevados sugerem alavancagem excessiva em posições compradas (long). Risco maior de liquidações em cascata numa correção (long squeeze).",
  short_squeeze_risk:
    "Funding negativo e/ou queda de Open Interest sugerem pressão vendedora elevada. Risco de squeeze de posições vendidas (short squeeze) numa reversão.",
  neutro: "Sem sinal relevante de alavancagem excessiva em nenhuma direção no momento.",
  indisponivel: "Dados de derivativos indisponíveis para este ativo ou período.",
};
