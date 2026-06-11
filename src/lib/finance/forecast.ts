/**
 * Lightweight forecasting using linear regression on log-prices plus a
 * residual-based confidence band. JS-only (no native deps) — works in the
 * Cloudflare Worker runtime. Equivalent in spirit to a Prophet trend-only
 * model for short horizons (7–90 days).
 */

export interface ForecastPoint {
  t: number; // timestamp ms
  yhat: number;
  lower: number;
  upper: number;
}

export interface ForecastResult {
  points: ForecastPoint[];
  confidence: number; // 0..1
  slopePerDay: number;
}

const Z_95 = 1.96;

export function forecast(
  history: { t: number; close: number }[],
  horizonDays: number,
): ForecastResult {
  const recent = history.filter((p) => Number.isFinite(p.close) && p.close > 0).slice(-180);
  if (recent.length < 10) {
    return { points: [], confidence: 0, slopePerDay: 0 };
  }
  const xs = recent.map((_, i) => i);
  const ys = recent.map((p) => Math.log(p.close));
  const n = xs.length;
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const meanX = sumX / n;
  const meanY = sumY / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - meanX) * (ys[i] - meanY);
    sxx += (xs[i] - meanX) ** 2;
  }
  const slope = sxy / (sxx || 1);
  const intercept = meanY - slope * meanX;

  // residual std
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const pred = intercept + slope * xs[i];
    ssRes += (ys[i] - pred) ** 2;
    ssTot += (ys[i] - meanY) ** 2;
  }
  const residualStd = Math.sqrt(ssRes / Math.max(1, n - 2));
  const r2 = ssTot > 0 ? Math.max(0, Math.min(1, 1 - ssRes / ssTot)) : 0;

  const lastT = recent[recent.length - 1].t;
  const dayMs = 86_400_000;
  const points: ForecastPoint[] = [];
  for (let h = 1; h <= horizonDays; h++) {
    const x = n - 1 + h;
    const logY = intercept + slope * x;
    // widening confidence band with horizon
    const band = Z_95 * residualStd * Math.sqrt(1 + h / Math.max(10, n));
    points.push({
      t: lastT + h * dayMs,
      yhat: Math.exp(logY),
      lower: Math.exp(logY - band),
      upper: Math.exp(logY + band),
    });
  }
  return { points, confidence: r2, slopePerDay: slope };
}