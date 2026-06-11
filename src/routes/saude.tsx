import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";

import { Header } from "@/components/Header";
import { getHealth, getQuotes } from "@/lib/api/finance.functions";
import { fmtDateTime } from "@/lib/finance/format";

export const Route = createFileRoute("/saude")({
  head: () => ({
    meta: [
      { title: "Saúde do Sistema — Nexus Finance" },
      { name: "description", content: "Status das fontes de dados e latência das APIs." },
      { property: "og:title", content: "Saúde do Sistema — Nexus Finance" },
      { property: "og:description", content: "Monitoramento das APIs CoinGecko e Yahoo Finance." },
    ],
  }),
  component: SaudePage,
});

function SaudePage() {
  const fetchHealth = useServerFn(getHealth);
  const fetchQuotes = useServerFn(getQuotes);
  const quotesQuery = useQuery({ queryKey: ["quotes"], queryFn: () => fetchQuotes(), staleTime: 120_000 });
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["health"],
    queryFn: () => fetchHealth(),
    refetchInterval: 30_000,
  });

  const avgLatency = data ? Math.round(data.checks.reduce((s, c) => s + c.latencyMs, 0) / data.checks.length) : null;
  const allOk = data ? data.checks.every((c) => c.ok) : false;

  return (
    <div className="min-h-screen bg-brand-bg text-foreground font-sans p-6 max-w-[1600px] mx-auto">
      <Header usdBrl={quotesQuery.data?.fxRates.USD ?? null} />

      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Saúde do Sistema</h1>
          <p className="text-sm text-brand-muted mt-1">
            {data ? `Verificado em ${fmtDateTime(data.checkedAt)}` : "Verificando…"}
          </p>
        </div>
        <button onClick={() => refetch()} disabled={isFetching} className="px-3 py-2 bg-brand-surface border border-brand-border hover:border-brand-accent/50 text-xs font-bold rounded uppercase tracking-widest flex items-center gap-2 disabled:opacity-50">
          <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <Metric label="Status Global" value={data ? (allOk ? "Operacional" : "Degradado") : "—"} tone={allOk ? "pos" : "neg"} />
        <Metric label="Latência média" value={avgLatency != null ? `${avgLatency} ms` : "—"} />
        <Metric label="APIs monitoradas" value={data ? String(data.checks.length) : "—"} />
      </div>

      <div className="bg-brand-surface border border-brand-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.2em] text-brand-muted">
              <th className="text-left p-4 font-bold">Serviço</th>
              <th className="text-left p-4 font-bold">Status</th>
              <th className="text-right p-4 font-bold">Latência</th>
            </tr>
          </thead>
          <tbody>
            {data?.checks.map((c) => (
              <tr key={c.name} className="border-t border-brand-border">
                <td className="p-4">{c.name}</td>
                <td className="p-4">
                  <span className={`inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${c.ok ? "text-brand-positive" : "text-brand-negative"}`}>
                    <span className={`size-1.5 rounded-full ${c.ok ? "bg-brand-positive" : "bg-brand-negative"}`} />
                    {c.ok ? "Online" : "Falha"}
                  </span>
                  {c.detail && <div className="text-[10px] text-brand-muted mt-1 truncate max-w-md">{c.detail}</div>}
                </td>
                <td className="p-4 text-right tabular-nums">{c.latencyMs} ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <div className="bg-brand-surface border border-brand-border rounded-lg p-4">
      <div className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.2em]">{label}</div>
      <div className={`font-display text-2xl font-bold mt-2 ${tone === "pos" ? "text-brand-positive" : tone === "neg" ? "text-brand-negative" : ""}`}>{value}</div>
    </div>
  );
}