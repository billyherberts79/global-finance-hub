import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileSpreadsheet, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AssetCard } from "@/components/AssetCard";
import { Header } from "@/components/Header";
import { getQuotes } from "@/lib/api/finance.functions";
import { CATEGORY_LABEL, type AssetCategory } from "@/lib/finance/assets";
import { exportQuotesCSV, exportQuotesXLSX } from "@/lib/finance/exports";
import { fmtDateTime } from "@/lib/finance/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Nexus Finance" },
      { name: "description", content: "Visão geral em tempo real de criptomoedas, moedas, commodities e índices globais, com conversão automática para BRL." },
      { property: "og:title", content: "Dashboard — Nexus Finance" },
      { property: "og:description", content: "Cotações ao vivo com conversão BRL, médias móveis e forecasting." },
    ],
  }),
  component: Dashboard,
});

const STALE_MS = 120_000;

function Dashboard() {
  const fetchQuotes = useServerFn(getQuotes);
  const router = useRouter();
  const [exporting, setExporting] = useState(false);

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["quotes"],
    queryFn: () => fetchQuotes(),
    staleTime: STALE_MS,
    refetchInterval: STALE_MS,
  });

  const handleExport = async () => {
    if (!data) return;
    setExporting(true);
    try {
      await exportQuotesXLSX(data.quotes);
      toast.success("Planilha gerada");
    } catch (e) {
      toast.error("Falha ao gerar planilha", { description: String(e) });
    } finally {
      setExporting(false);
    }
  };
  const handleExportCSV = () => {
    if (!data) return;
    try { exportQuotesCSV(data.quotes); toast.success("CSV gerado"); }
    catch (e) { toast.error("Falha ao gerar CSV", { description: String(e) }); }
  };

  const handleRefresh = () => {
    refetch();
    router.invalidate();
  };

  const grouped: Record<AssetCategory, NonNullable<typeof data>["quotes"]> = {
    cripto: [], moedas: [], commodities: [], indices: [],
  };
  if (data) for (const q of data.quotes) grouped[q.category].push(q);

  const usdBrl = data?.fxRates.USD ?? null;

  return (
    <div className="min-h-screen bg-brand-bg text-foreground font-sans p-6 max-w-[1600px] mx-auto">
      <Header usdBrl={usdBrl} />

      <div className="flex flex-wrap items-end justify-between mb-8 gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Mercados Globais</h1>
          <p className="text-sm text-brand-muted mt-1">
            {data
              ? `Atualizado em ${fmtDateTime(data.fetchedAt)}`
              : "Carregando cotações em tempo real…"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={isFetching}
            className="px-3 py-2 bg-brand-surface border border-brand-border hover:border-brand-accent/50 text-xs font-bold rounded transition-colors uppercase tracking-widest flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </button>
          <button
            onClick={handleExportCSV}
            disabled={!data}
            className="px-3 py-2 bg-brand-surface border border-brand-border hover:border-brand-accent/50 text-xs font-bold rounded transition-colors uppercase tracking-widest flex items-center gap-2 disabled:opacity-50"
          >
            <FileSpreadsheet className="size-3.5" />
            CSV
          </button>
          <button
            onClick={handleExport}
            disabled={!data || exporting}
            className="px-3 py-2 bg-brand-accent hover:bg-brand-accent/90 text-xs font-bold text-white rounded transition-colors uppercase tracking-widest flex items-center gap-2 disabled:opacity-50"
          >
            <Download className="size-3.5" />
            Excel
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 border border-brand-negative/30 bg-brand-negative/5 rounded-lg text-sm text-brand-negative">
          Dados temporariamente indisponíveis. Tentaremos novamente.
        </div>
      )}

      {isLoading && !data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-brand-surface border border-brand-border rounded-lg p-4 h-40 animate-pulse" />
          ))}
        </div>
      )}

      {data && (
        <div className="space-y-12">
          {(Object.keys(grouped) as AssetCategory[]).map((cat) =>
            grouped[cat].length > 0 ? (
              <section key={cat}>
                <div className="flex items-baseline justify-between mb-4 border-b border-brand-border pb-2">
                  <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-brand-muted">
                    {CATEGORY_LABEL[cat]}
                  </h2>
                  <span className="text-[10px] text-brand-muted/60 tabular-nums">
                    {grouped[cat].length} ativos
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {grouped[cat].map((q) => (
                    <AssetCard key={q.slug} q={q} />
                  ))}
                </div>
              </section>
            ) : null,
          )}
        </div>
      )}

      <footer className="mt-16 border-t border-brand-border pt-6 text-[10px] text-brand-muted/60 uppercase font-bold tracking-[0.2em] text-center">
        Nexus Finance · Dados via CoinGecko e Yahoo Finance
      </footer>
    </div>
  );
}
