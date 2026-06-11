/** Simple Moving Average */
export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (period <= 0) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** Exponential Moving Average */
export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (period <= 0 || values.length === 0) return out;
  const k = 2 / (period + 1);
  // seed with SMA of first `period` values
  let acc = 0;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      acc += values[i];
      continue;
    }
    if (i === period - 1) {
      acc += values[i];
      out[i] = acc / period;
    } else {
      const prev = out[i - 1] as number;
      out[i] = values[i] * k + prev * (1 - k);
    }
  }
  return out;
}

export const SMA_PERIODS = [9, 21, 50, 100, 200] as const;
export const EMA_PERIODS = [9, 21, 50, 100, 200] as const;