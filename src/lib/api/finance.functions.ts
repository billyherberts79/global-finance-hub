import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { ASSETS, FX_PAIRS, findAsset, type AssetCategory } from "../finance/assets";

// =============================================================================
// Logging
// =============================================================================

function log(level: "info" | "warn" | "error", scope: string, msg: string, extra?: Record<string, unknown>) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, scope, msg, ...extra });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

// =============================================================================
// HTTP helper with timeout + retry
// =============================================================================

async function fetchJson<T>(url: string, opts: { timeoutMs?: number; retries?: number } = {}): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 6000;
  const retries = opts.retries ?? 1;
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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
// Yahoo Finance
// =============================================================================

interface YahooChartResp {
  chart: {
    result?: Array<{
      meta: {
        regularMarketPrice?: number;
        previousClose?: number;
        chartPreviousClose?: number;
        regularMarketDayHigh?: number;
        regularMarketDayLow?: number;
        regularMarketTime?: number;
        currency?: string;
      };
      timestamp?: number[];
      indicators: {
        quote: Array<{
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }>;
      };
    }>;
    error?: { description: string } | null;
  };
}

async function yahooChart(symbol: string, range: string, interval: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
  return await fetchJson<YahooChartResp>(url, { timeoutMs: 8000, retries: 1 });
}

// =============================================================================
// CoinGecko
// =============================================================================

interface CGMarket {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_percentage_24h: number;
  last_updated: string;
}

async function coingeckoMarkets(ids: string[]): Promise<CGMarket[]> {
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids.join(",")}&order=market_cap_desc&price_change_percentage=24h`;
  return await fetchJson<CGMarket[]>(url, { timeoutMs: 6000, retries: 1 });
}

interface CGMarketChart {
  prices: [number, number][];
  market_caps: [number, number][];
  total_volumes: [number, number][];
}

async function coingeckoMarketChart(id: string, days: number): Promise<CGMarketChart> {
  const url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
  return await fetchJson<CGMarketChart>(url, { timeoutMs: 8000, retries: 1 });
}

// =============================================================================
// FX rates → BRL (Yahoo)
// =============================================================================

async function getFxRatesToBRL(): Promise<Record<string, number>> {
  const rates: Record<string, number> = { BRL: 1 };
  const entries = Object.entries(FX_PAIRS);
  const results = await Promise.allSettled(
    entries.map(async ([code, symbol]) => {
      const r = await yahooChart(symbol, "1d", "1d");
      const price = r.chart.result?.[0]?.meta?.regularMarketPrice;
      if (typeof price === "number") rates[code] = price;
    }),
  );
  for (const [i, res] of results.entries()) {
    if (res.status === "rejected") log("warn", "fx", `Falha ${entries[i][0]}`, { err: String(res.reason) });
  }
  // sane fallbacks
  if (!rates.USD) rates.USD = 5.0;
  if (!rates.EUR) rates.EUR = rates.USD * 1.08;
  if (!rates.GBP) rates.GBP = rates.USD * 1.27;
  if (!rates.JPY) rates.JPY = rates.USD / 150;
  if (!rates.HKD) rates.HKD = rates.USD / 7.8;
  if (!rates.CNY) rates.CNY = rates.USD / 7.2;
  return rates;
}

// =============================================================================
// Public types
// =============================================================================

export interface QuoteSnapshot {
  slug: string;
  name: string;
  symbol: string;
  category: AssetCategory;
  currency: string;
  price: number | null;
  priceBRL: number | null;
  changePercent: number | null;
  high24h: number | null;
  low24h: number | null;
  marketCap?: number | null;
  volume?: number | null;
  sparkline: number[];
  updatedAt: string;
  stale?: boolean;
}

export interface QuotesResponse {
  fxRates: Record<string, number>;
  quotes: QuoteSnapshot[];
  fetchedAt: string;
}

export interface HistoryCandle {
  t: number;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  volume: number | null;
}

export interface HistoryResponse {
  slug: string;
  currency: string;
  candles: HistoryCandle[];
  fxToBRL: number;
}

// =============================================================================
// getQuotes — snapshot of all assets
// =============================================================================

export const getQuotes = createServerFn({ method: "GET" }).handler(async (): Promise<QuotesResponse> => {
  const t0 = Date.now();
  const fxRates = await getFxRatesToBRL();

  const cryptoIds = ASSETS.filter((a) => a.source === "coingecko").map((a) => a.apiId);
  const yahooAssets = ASSETS.filter((a) => a.source === "yahoo");

  const [cgRes, yahooResults] = await Promise.all([
    coingeckoMarkets(cryptoIds).catch((e) => {
      log("warn", "coingecko", "markets failed", { err: String(e) });
      return [] as CGMarket[];
    }),
    Promise.all(
      yahooAssets.map(async (a) => {
        try {
          const r = await yahooChart(a.apiId, "5d", "1h");
          return { asset: a, data: r, error: null as string | null };
        } catch (e) {
          return { asset: a, data: null, error: String(e) };
        }
      }),
    ),
  ]);

  const quotes: QuoteSnapshot[] = [];

  // Crypto
  for (const a of ASSETS.filter((x) => x.source === "coingecko")) {
    const m = cgRes.find((x) => x.id === a.apiId);
    const fx = fxRates[a.currency] ?? 1;
    if (m) {
      quotes.push({
        slug: a.slug,
        name: a.name,
        symbol: a.symbol,
        category: a.category,
        currency: a.currency,
        price: m.current_price,
        priceBRL: m.current_price * fx,
        changePercent: m.price_change_percentage_24h,
        high24h: m.high_24h,
        low24h: m.low_24h,
        marketCap: m.market_cap,
        volume: m.total_volume,
        sparkline: [],
        updatedAt: m.last_updated,
      });
    } else {
      quotes.push({
        slug: a.slug, name: a.name, symbol: a.symbol, category: a.category, currency: a.currency,
        price: null, priceBRL: null, changePercent: null, high24h: null, low24h: null,
        sparkline: [], updatedAt: new Date().toISOString(), stale: true,
      });
    }
  }

  // Yahoo
  for (const { asset: a, data, error } of yahooResults) {
    const fx = fxRates[a.currency] ?? 1;
    if (!data || error) {
      log("warn", "yahoo", `falha ${a.symbol}`, { err: error ?? "no-data" });
      quotes.push({
        slug: a.slug, name: a.name, symbol: a.symbol, category: a.category, currency: a.currency,
        price: null, priceBRL: null, changePercent: null, high24h: null, low24h: null,
        sparkline: [], updatedAt: new Date().toISOString(), stale: true,
      });
      continue;
    }
    const result = data.chart.result?.[0];
    const meta = result?.meta;
    const closes = (result?.indicators.quote[0]?.close ?? []).filter((v): v is number => typeof v === "number");
    const price = meta?.regularMarketPrice ?? closes[closes.length - 1] ?? null;
    const prev = meta?.chartPreviousClose ?? meta?.previousClose ?? closes[0] ?? null;
    const change = price != null && prev != null && prev !== 0 ? ((price - prev) / prev) * 100 : null;
    quotes.push({
      slug: a.slug,
      name: a.name,
      symbol: a.symbol,
      category: a.category,
      currency: a.currency,
      price,
      priceBRL: price != null ? price * fx : null,
      changePercent: change,
      high24h: meta?.regularMarketDayHigh ?? null,
      low24h: meta?.regularMarketDayLow ?? null,
      sparkline: closes.slice(-24),
      updatedAt: meta?.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : new Date().toISOString(),
    });
  }

  log("info", "getQuotes", "ok", { ms: Date.now() - t0, count: quotes.length });
  return { fxRates, quotes, fetchedAt: new Date().toISOString() };
});

// =============================================================================
// getHistory — historical candles for an asset
// =============================================================================

export const getHistory = createServerFn({ method: "GET" })
  .inputValidator(z.object({ slug: z.string(), range: z.enum(["1mo", "3mo", "6mo", "1y", "2y", "5y"]).default("1y") }))
  .handler(async ({ data }): Promise<HistoryResponse> => {
    const t0 = Date.now();
    const asset = findAsset(data.slug);
    if (!asset) throw new Error(`Ativo desconhecido: ${data.slug}`);

    const fxRates = await getFxRatesToBRL();
    const fx = fxRates[asset.currency] ?? 1;

    let candles: HistoryCandle[] = [];
    if (asset.source === "coingecko") {
      const days = data.range === "1mo" ? 30 : data.range === "3mo" ? 90 : data.range === "6mo" ? 180 : data.range === "1y" ? 365 : data.range === "2y" ? 730 : 1825;
      const chart = await coingeckoMarketChart(asset.apiId, days);
      candles = chart.prices.map(([t, p]) => ({ t, open: null, high: null, low: null, close: p, volume: null }));
    } else {
      const yr = await yahooChart(asset.apiId, data.range, "1d");
      const r = yr.chart.result?.[0];
      const ts = r?.timestamp ?? [];
      const q = r?.indicators.quote[0];
      candles = ts.map((tSec, i) => {
        const close = q?.close?.[i];
        if (close == null) return null;
        return {
          t: tSec * 1000,
          open: q?.open?.[i] ?? null,
          high: q?.high?.[i] ?? null,
          low: q?.low?.[i] ?? null,
          close: close as number,
          volume: q?.volume?.[i] ?? null,
        };
      }).filter((c): c is HistoryCandle => c !== null);
    }

    log("info", "getHistory", "ok", { slug: data.slug, range: data.range, n: candles.length, ms: Date.now() - t0 });
    return { slug: data.slug, currency: asset.currency, candles, fxToBRL: fx };
  });

// =============================================================================
// getHealth — system health check
// =============================================================================

export interface HealthCheck {
  name: string;
  ok: boolean;
  latencyMs: number;
  detail?: string;
}

export interface HealthResponse {
  checks: HealthCheck[];
  checkedAt: string;
  memoryMB?: number;
}

async function ping(name: string, fn: () => Promise<unknown>): Promise<HealthCheck> {
  const t = Date.now();
  try {
    await fn();
    return { name, ok: true, latencyMs: Date.now() - t };
  } catch (e) {
    return { name, ok: false, latencyMs: Date.now() - t, detail: String(e) };
  }
}

export const getHealth = createServerFn({ method: "GET" }).handler(async (): Promise<HealthResponse> => {
  const checks = await Promise.all([
    ping("Yahoo Finance (Moedas)", () => yahooChart("USDBRL=X", "1d", "1d")),
    ping("Yahoo Finance (Índices)", () => yahooChart("^GSPC", "1d", "1d")),
    ping("Yahoo Finance (Commodities)", () => yahooChart("GC=F", "1d", "1d")),
    ping("CoinGecko", () => coingeckoMarkets(["bitcoin"])),
  ]);
  return { checks, checkedAt: new Date().toISOString() };
});