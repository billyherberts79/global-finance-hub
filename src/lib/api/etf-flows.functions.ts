import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  buildEtfFlowSignal,
  FARSIDE_PATH,
  hasEtfFlowSignal,
  parseFarsideHtml,
  type EtfFlowSignal,
} from "../finance/etf-flows";

// =============================================================================
// Logging (mesmo padrão dos demais módulos de API)
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
// HTTP helper para texto (HTML), com timeout + retry
// =============================================================================

async function fetchText(
  url: string,
  opts: { timeoutMs?: number; retries?: number } = {},
): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? 8000;
  const retries = opts.retries ?? 2;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 (Dashboard-Financeiro/2.0)",
          Accept: "text/html,application/xhtml+xml",
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
      return await res.text();
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    }
  }
  throw lastErr;
}

// =============================================================================
// getEtfFlowSignal — sinal de fluxo de ETFs spot para um ativo
// =============================================================================

const FARSIDE_BASE = "https://farside.co.uk";

export const getEtfFlowSignal = createServerFn({ method: "GET" })
  .inputValidator(z.object({ slug: z.string() }))
  .handler(async ({ data }): Promise<EtfFlowSignal | null> => {
    const t0 = Date.now();
    if (!hasEtfFlowSignal(data.slug)) return null;

    const path = FARSIDE_PATH[data.slug];
    const debugErrors: string[] = [];

    let days: ReturnType<typeof parseFarsideHtml> = [];
    try {
      const html = await fetchText(`${FARSIDE_BASE}/${path}/`, { timeoutMs: 8000, retries: 2 });
      days = parseFarsideHtml(html);
    } catch (err) {
      const msg = `farside(${path}): ${String(err)}`;
      debugErrors.push(msg);
      log("warn", "farside-fetch", `falha ${path}`, { err: String(err) });
    }

    const signal = buildEtfFlowSignal({ slug: data.slug, days, debugErrors });

    log("info", "getEtfFlowSignal", "ok", {
      slug: data.slug,
      ms: Date.now() - t0,
      days: days.length,
    });
    return signal;
  });
