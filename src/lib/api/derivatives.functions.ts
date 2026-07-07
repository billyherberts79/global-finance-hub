import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  buildDerivativesSignal,
  FUTURES_SYMBOL,
  hasFuturesSignal,
  type DerivativesSignal,
  type FundingRatePoint,
  type OpenInterestPoint,
} from "../finance/derivatives";

// =============================================================================
// Logging (mesmo padrão de finance.functions.ts)
// =============================================================================

function log(
  level: "info" | "warn" | "error",
  scope: string,
  msg: string,
  extra?: Record<string, unknown>,
) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, scope, msg, ...extra });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

// =============================================================================
// HTTP helper com timeout + retry (cópia local do padrão de finance.functions.ts)
// =============================================================================

async function fetchJson<T>(
  url: string,
  opts: { timeoutMs?: number; retries?: number } = {},
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 6000;
  const retries = opts.retries ?? 2;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Dashboard-Financeiro/2.0)",
          Accept: "application/json,text/plain,*/*",
        },
      });
      clearTimeout(timer);
      if (!res.ok) {
        if ((res.status === 429 || res.status >= 500) && attempt < retries) {
          const wait = Math.min(8000, 800 * Math.pow(2, attempt)) + Math.random() * 300;
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    }
  }
  throw lastErr;
}

// =============================================================================
// Binance Futures (USDⓈ-M) — endpoints públicos, sem API key
// =============================================================================

const BINANCE_FAPI = "https://fapi.binance.com";

interface BinanceFundingRateRaw {
  symbol: string;
  fundingRate: string;
  fundingTime: number;
  markPrice?: string;
}

async function binanceFundingRateHistory(symbol: string, limit = 21): Promise<FundingRatePoint[]> {
  const url = `${BINANCE_FAPI}/fapi/v1/fundingRate?symbol=${symbol}&limit=${limit}`;
  const raw = await fetchJson<BinanceFundingRateRaw[]>(url, { timeoutMs: 6000, retries: 2 });
  return raw
    .map((p) => ({ t: p.fundingTime, rate: Number(p.fundingRate) }))
    .filter((p) => Number.isFinite(p.rate));
}

interface BinanceOpenInterestHistRaw {
  symbol: string;
  sumOpenInterest: string;
  sumOpenInterestValue: string;
  timestamp: number;
}

/** Histórico de Open Interest. period diário, limit=8 cobre ~7 dias corridos. */
async function binanceOpenInterestHistory(
  symbol: string,
  period = "1d",
  limit = 8,
): Promise<OpenInterestPoint[]> {
  const url = `${BINANCE_FAPI}/futures/data/openInterestHist?symbol=${symbol}&period=${period}&limit=${limit}`;
  const raw = await fetchJson<BinanceOpenInterestHistRaw[]>(url, { timeoutMs: 6000, retries: 2 });
  return raw
    .map((p) => ({ t: p.timestamp, openInterest: Number(p.sumOpenInterest) }))
    .filter((p) => Number.isFinite(p.openInterest));
}

// =============================================================================
// getDerivativesSignal — sinal composto (funding + OI) para um ativo
// =============================================================================

export const getDerivativesSignal = createServerFn({ method: "GET" })
  .inputValidator(z.object({ slug: z.string() }))
  .handler(async ({ data }): Promise<DerivativesSignal | null> => {
    const t0 = Date.now();
    if (!hasFuturesSignal(data.slug)) return null;

    const futuresSymbol = FUTURES_SYMBOL[data.slug];

    const [fundingResult, oiResult] = await Promise.allSettled([
      binanceFundingRateHistory(futuresSymbol, 21),
      binanceOpenInterestHistory(futuresSymbol, "1d", 8),
    ]);

    const fundingHistory = fundingResult.status === "fulfilled" ? fundingResult.value : [];
    if (fundingResult.status === "rejected") {
      log("warn", "binance-funding", `falha ${futuresSymbol}`, {
        err: String(fundingResult.reason),
      });
    }

    const openInterestHistory = oiResult.status === "fulfilled" ? oiResult.value : [];
    if (oiResult.status === "rejected") {
      log("warn", "binance-oi", `falha ${futuresSymbol}`, { err: String(oiResult.reason) });
    }

    const signal = buildDerivativesSignal({
      slug: data.slug,
      futuresSymbol,
      fundingHistory,
      openInterestHistory,
    });

    log("info", "getDerivativesSignal", "ok", { slug: data.slug, ms: Date.now() - t0 });
    return signal;
  });
