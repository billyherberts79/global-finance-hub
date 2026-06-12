import { Link } from "@tanstack/react-router";

import type { QuoteSnapshot } from "@/lib/api/finance.functions";
import { fmtBRL, fmtPercent, fmtPrice } from "@/lib/finance/format";

import { Sparkline } from "./Sparkline";

export function AssetCard({ q }: { q: QuoteSnapshot }) {
  const positive = (q.changePercent ?? 0) >= 0;
  return (
    <Link
      to="/ativo/$slug"
      params={{ slug: q.slug }}
      className="bg-brand-surface border border-brand-border p-4 rounded-lg hover:border-brand-accent/50 transition-colors block"
    >
      <div className="flex justify-between items-start mb-2 gap-3">
        <div className="min-w-0">
          <span className="text-[10px] font-bold text-brand-muted uppercase tracking-wider block truncate">
            {q.symbol}
          </span>
          <div className="text-xl font-display font-bold tracking-tight text-foreground truncate mt-0.5">
            {q.name}
          </div>
          <div className="text-base font-display font-semibold tabular-nums truncate text-brand-muted mt-1">
            {fmtPrice(q.price, q.currency, q.category)}
          </div>
        </div>
        <div className={`text-sm font-medium tabular-nums shrink-0 ${positive ? "text-brand-positive" : "text-brand-negative"}`}>
          {q.changePercent != null ? `${positive ? "+" : ""}${q.changePercent.toFixed(2)}%` : "—"}
        </div>
      </div>
      {q.currency !== "BRL" && q.category !== "indices" && (
        <div className="text-xs text-brand-muted/80 mb-3 tabular-nums">{fmtBRL(q.priceBRL)}</div>
      )}
      {q.currency === "BRL" && q.changePercent != null && (
        <div className="text-xs text-brand-muted/80 mb-3">Variação 24h {fmtPercent(q.changePercent)}</div>
      )}
      <Sparkline values={q.sparkline} positive={positive} />
      {q.stale && (
        <div className="mt-2 text-[10px] text-brand-negative/80 uppercase tracking-wider">
          Dados indisponíveis
        </div>
      )}
    </Link>
  );
}