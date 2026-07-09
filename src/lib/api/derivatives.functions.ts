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
// Bybit V5 (linear/USDT perpetual) — endpoints públicos, sem API key.
//
// Trocado de Binance para Bybit porque a Binance Futures (fapi.binance.com)
// retorna HTTP 403 para requisições vindas de certas infraestruturas de
// hospedagem (bloqueio geográfico/regulatório). Bybit não apresentou esse
// bloqueio nos testes.
// =============================================================================

const BYBIT_BASE = "https://api.bybit.com";

interface BybitRetEnvelope<T> {
  retCode: number;
  retMsg: string;
  result: T;
}

interface BybitFundingRateRaw {
  symbol: string;
  fundingRate: string;
  fundingRateTimestamp: string; // ms, como string
}

async function bybitFundingRateHistory(symbol: string, limit = 21): Promise<FundingRatePoint[]> {
  const url = `${BYBIT_BASE}/v5/market/funding/history?category=linear&symbol=${symbol}&limit=${limit}`;
  const raw = await fetchJson<BybitRetEnvelope<{ list: BybitFundingRateRaw[] }>>(url, {
    timeoutMs: 6000,
    retries: 2,
  });
  if (raw.retCode !== 0) throw new Error(`Bybit retCode=${raw.retCode} (${raw.retMsg})`);
  return raw.result.list
    .map((p) => ({ t: Number(p.fundingRateTimestamp), rate: Number(p.fundingRate) }))
    .filter((p) => Number.isFinite(p.rate) && Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t); // API pode retornar mais recente primeiro; normalizamos para ascendente
}

interface BybitOpenInterestRaw {
  openInterest: string;
  timestamp: string; // ms, como string
}

/** Histórico de Open Interest. intervalTime diário, limit=8 cobre ~7 dias corridos. */
async function bybitOpenInterestHistory(
  symbol: string,
  intervalTime = "1d",
  limit = 8,
): Promise<OpenInterestPoint[]> {
  const url = `${BYBIT_BASE}/v5/market/open-interest?category=linear&symbol=${symbol}&intervalTime=${intervalTime}&limit=${limit}`;
  const raw = await fetchJson<BybitRetEnvelope<{ list: BybitOpenInterestRaw[] }>>(url, {
    timeoutMs: 6000,
    retries: 2,
  });
  if (raw.retCode !== 0) throw new Error(`Bybit retCode=${raw.retCode} (${raw.retMsg})`);
  return raw.result.list
    .map((p) => ({ t: Number(p.timestamp), openInterest: Number(p.openInterest) }))
    .filter((p) => Number.isFinite(p.openInterest) && Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t);
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
      bybitFundingRateHistory(futuresSymbol, 21),
      bybitOpenInterestHistory(futuresSymbol, "1d", 8),
    ]);

    const debugErrors: string[] = [];

    const fundingHistory = fundingResult.status === "fulfilled" ? fundingResult.value : [];
    if (fundingResult.status === "rejected") {
      const msg = `fundingRate: ${String(fundingResult.reason)}`;
      debugErrors.push(msg);
      log("warn", "bybit-funding", `falha ${futuresSymbol}`, {
        err: String(fundingResult.reason),
      });
    }

    const openInterestHistory = oiResult.status === "fulfilled" ? oiResult.value : [];
    if (oiResult.status === "rejected") {
      const msg = `openInterest: ${String(oiResult.reason)}`;
      debugErrors.push(msg);
      log("warn", "bybit-oi", `falha ${futuresSymbol}`, { err: String(oiResult.reason) });
    }

    const signal = buildDerivativesSignal({
      slug: data.slug,
      futuresSymbol,
      fundingHistory,
      openInterestHistory,
      debugErrors,
    });

    log("info", "getDerivativesSignal", "ok", { slug: data.slug, ms: Date.now() - t0 });
    return signal;
  });
