import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Header } from "@/components/Header";
import { getQuotes } from "@/lib/api/finance.functions";
import { ASSETS, CATEGORY_LABEL, type AssetCategory } from "@/lib/finance/assets";
import { exportQuotesXLSX } from "@/lib/finance/exports";

export const Route = createFileRoute("/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — Nexus Finance" },
      { name: "description", content: "Exporte relatórios PDF e Excel de cotações e históricos." },
      { property: "og:title", content: "Relatórios — Nexus Finance" },
    ],
  }),
  component: Relatorios,
});

function Relatorios() {
  const fetchQuotes = useServerFn(getQuotes);
  const { data } = useQuery({ queryKey: ["quotes"], queryFn: () => fetchQuotes(), staleTime: 120_000 });
  const [busy, setBusy] = useState(false);

  const handleAll = async () => {
    if (!data) return;
    setBusy(true);
    try { await exportQuotesXLSX(data.quotes); toast.success("Excel gerado"); }
    catch (e) { toast.error("Falha", { description: String(e) }); }
    finally { setBusy(false); }
  };

  const grouped: Record<AssetCategory, typeof ASSETS> = { cripto: [], moedas: [], commodities: [], indices: [] };
  for (const a of ASSETS) grouped[a.category].push(a);

  return (
    <div className="min-h-screen bg-brand-bg text-foreground font-sans p-6 max-w-[1600px] mx-auto">
      <Header usdBrl={data?.fxRates.USD ?? null} />

      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-sm text-brand-muted mt-1">Exporte snapshots e históricos em PDF ou Excel.</p>
        </div>
        <button onClick={handleAll} disabled={!data || busy} className="px-3 py-2 bg-brand-accent hover:bg-brand-accent/90 text-xs font-bold text-white rounded uppercase tracking-widest flex items-center gap-2 disabled:opacity-50">
          <Download className="size-3.5" /> Excel completo
        </button>
      </div>

      <div className="space-y-10">
        {(Object.keys(grouped) as AssetCategory[]).map((cat) => (
          <section key={cat}>
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-brand-muted mb-3 border-b border-brand-border pb-2">{CATEGORY_LABEL[cat]}</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {grouped[cat].map((a) => (
                <Link key={a.slug} to="/ativo/$slug" params={{ slug: a.slug }} className="bg-brand-surface border border-brand-border rounded-lg p-4 hover:border-brand-accent/50 transition-colors flex justify-between items-center">
                  <div>
                    <div className="font-medium">{a.name}</div>
                    <div className="text-[11px] text-brand-muted">{a.symbol}</div>
                  </div>
                  <FileText className="size-4 text-brand-muted" />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}