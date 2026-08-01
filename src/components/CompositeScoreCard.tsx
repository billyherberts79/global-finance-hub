import type { CompositeScoreResult } from "@/lib/finance/composite-score";
import { COMPOSITE_LABEL_DESCRIPTION } from "@/lib/finance/composite-score";

function componentColor(score: number): string {
  if (score > 0.05) return "text-brand-positive";
  if (score < -0.05) return "text-brand-negative";
  return "text-brand-muted";
}

export function CompositeScoreCard({ composite }: { composite: CompositeScoreResult }) {
  const hasData = composite.label !== "indisponivel";

  return (
    <div className="bg-brand-surface border border-brand-border rounded-lg p-4">
      <h3 className="text-[10px] font-bold text-brand-accent uppercase tracking-[0.2em] mb-3">
        Score composto
      </h3>

      {!hasData ? (
        <p className="text-xs text-brand-muted">
          Dados insuficientes para calcular o score composto.
        </p>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-2xl font-bold tabular-nums text-foreground">
                {composite.score >= 0 ? "+" : ""}
                {(composite.score * 100).toFixed(0)}
              </span>
              <span
                className={`text-xs font-bold uppercase tracking-wide ${
                  composite.label === "bullish"
                    ? "text-brand-positive"
                    : composite.label === "bearish"
                      ? "text-brand-negative"
                      : "text-brand-muted"
                }`}
              >
                {composite.label === "bullish"
                  ? "Viés comprador"
                  : composite.label === "bearish"
                    ? "Viés vendedor"
                    : "Neutro / misto"}
              </span>
            </div>
            <div className="h-2 w-full bg-brand-surface-2 rounded-full overflow-hidden relative">
              <div className="absolute inset-y-0 left-1/2 w-px bg-brand-border z-10" />
              <div
                className={`h-full ${composite.score >= 0 ? "bg-brand-positive ml-[50%]" : "bg-brand-negative mr-[50%] ml-auto"}`}
                style={{ width: `${Math.min(50, Math.abs(composite.score) * 50)}%` }}
              />
            </div>
          </div>

          <div className="space-y-2 pt-1 border-t border-brand-border">
            <p className="text-[10px] font-bold text-brand-muted uppercase tracking-wide">
              Composição (peso × contribuição)
            </p>
            {composite.components.map((c) => (
              <div key={c.key} className="flex items-center justify-between text-xs gap-2">
                <span className="text-brand-muted truncate">{c.label}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {c.available ? (
                    <>
                      <span className="text-brand-muted/70 tabular-nums w-10 text-right">
                        {(c.normalizedWeight * 100).toFixed(0)}%
                      </span>
                      <span
                        className={`font-bold tabular-nums w-12 text-right ${componentColor(c.score)}`}
                      >
                        {c.score >= 0 ? "+" : ""}
                        {(c.score * 100).toFixed(0)}
                      </span>
                    </>
                  ) : (
                    <span className="text-brand-muted/50 italic">indisponível</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-brand-muted leading-relaxed pt-1 border-t border-brand-border">
            {COMPOSITE_LABEL_DESCRIPTION[composite.label]}
          </p>
          <p className="text-[10px] text-brand-muted/70">
            Média ponderada dos fatores disponíveis (o peso do basis de futuros CME, não
            implementado por falta de fonte gratuita, foi redistribuído entre os demais). Heurística
            exploratória, não calibrada por backtest — use como contexto adicional, não como sinal
            de decisão isolado.
          </p>
        </div>
      )}
    </div>
  );
}
