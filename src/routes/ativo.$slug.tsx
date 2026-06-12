import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Download, FileText, FileSpreadsheet } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Header } from "@/components/Header";
import { getHistory, getQuotes } from "@/lib/api/finance.functions";
import { findAsset } from "@/lib/finance/assets";
import { exportAssetPDF, exportHistoryCSV, exportHistoryXLSX } from "@/lib/finance/exports";
import { forecast } from "@/lib/finance/forecast";
import { fmtBRL, fmtDate, fmtPercent, fmtPrice } from "@/lib/finance/format";
import { ema, sma } from "@/lib/finance/indicators";

export const Route = createFileRoute("/ativo/$slug")({
  beforeLoad: ({ params }) => {
    if (!findAsset(params.slug)) throw notFound();
  },
  head: ({ params }) => {
    const a = findAsset(params.slug);
    const title = a ? `${a.name} (${a.symbol}) — Nexus Finance` : "Ativo — Nexus Finance";
    return {
      meta: [
        { title },
        { name: "description", content: a ? `Cotação, histórico, médias móveis e previsão para ${a.name}.` : "Detalhe de ativo." },
        { property: "og:title", content: title },
      ],
    };
  },
  component: AssetDetail,
  notFoundComponent: () => (
    <div className="p-10 text-center text-brand-muted">
      Ativo não encontrado. <Link to="/" className="text-brand-accent underline">Voltar</Link>
    </div>
  ),
  errorComponent: ({ reset }) => {
    return (
      <div className="p-10 text-center">
        <p className="text-brand-negative mb-4">Falha ao carregar dados do ativo.</p>
        <button onClick={reset} className="px-4 py-2 bg-brand-accent text-white rounded text-sm">Tentar novamente</button>
      </div>
    );
  },
});

type Range = "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y";
const RANGES: { value: Range; label: string }[] = [
  { value: "1mo", label: "1M" },
  { value: "3mo", label: "3M" },
  { value: "6mo", label: "6M" },
  { value: "1y", label: "1A" },
  { value: "2y", label: "2A" },
  { value: "5y", label: "5A" },
];

type Interval = "1d" | "1wk";
const INTERVALS: { value: Interval; label: string }[] = [
  { value: "1d", label: "Diário" },
  { value: "1wk", label: "Semanal" },
];

const HORIZONS = [7, 15, 30, 60, 90] as const;
const MA_PERIODS = [9, 21, 50, 100, 200] as const;

function AssetDetail() {
  const { slug } = Route.useParams();
  const router = useRouter();
  const asset = findAsset(slug)!;

  const fetchHistory = useServerFn(getHistory);
  const fetchQuotes = useServerFn(getQuotes);

  const [range, setRange] = useState<Range>("1y");
  const [interval, setIntervalState] = useState<Interval>("1d");
  const [horizon, setHorizon] = useState<(typeof HORIZONS)[number]>(30);
  const [showSMA, setShowSMA] = useState<number | null>(50);
  const [showEMA, setShowEMA] = useState<number | null>(21);

  const quotesQuery = useQuery({
    queryKey: ["quotes"],
    queryFn: () => fetchQuotes(),
    staleTime: 120_000,
  });
  const quote = quotesQuery.data?.quotes.find((q) => q.slug === slug);
  const usdBrl = quotesQuery.data?.fxRates.USD ?? null;

  const historyQuery = useQuery({
    queryKey: ["history", slug, range, interval],
    queryFn: () => fetchHistory({ data: { slug, range, interval } }),
    staleTime: 300_000,
  });

  const closes = historyQuery.data?.candles.map((c) => c.close) ?? [];
  const smaSeries = useMemo(() => (showSMA ? sma(closes, showSMA) : null), [closes, showSMA]);
  const emaSeries = useMemo(() => (showEMA ? ema(closes, showEMA) : null), [closes, showEMA]);
  const fxToBRL = historyQuery.data?.fxToBRL ?? 1;

  const fc = useMemo(() => {
    if (!historyQuery.data) return null;
    return forecast(historyQuery.data.candles.map((c) => ({ t: c.t, close: c.close })), horizon);
  }, [historyQuery.data, horizon]);

  const chartData = useMemo(() => {
    if (!historyQuery.data) return [];
    const hist = historyQuery.data.candles.map((c, i) => ({
      t: c.t,
      date: fmtDate(c.t),
      close: c.close,
      sma: smaSeries?.[i] ?? null,
      ema: emaSeries?.[i] ?? null,
      yhat: null as number | null,
      band: null as [number, number] | null,
    }));
    if (fc?.points.length) {
      const last = hist[hist.length - 1];
      hist.push({ ...last, yhat: last.close, band: [last.close, last.close] });
      for (const p of fc.points) {
        hist.push({
          t: p.t,
          date: fmtDate(p.t),
          close: null as unknown as number,
          sma: null,
          ema: null,
          yhat: p.yhat,
          band: [p.lower, p.upper],
        });
      }
    }
    return hist;
  }, [historyQuery.data, smaSeries, emaSeries, fc]);

  const stats = useMemo(() => {
    if (!historyQuery.data?.candles.length) return null;
    const cs = historyQuery.data.candles;
    const first = cs[0];
    const last = cs[cs.length - 1];
    const max = Math.max(...closes);
    const min = Math.min(...closes);
    return {
      open: first.open ?? first.close,
      close: last.close,
      max, min,
      variation: ((last.close - first.close) / first.close) * 100,
    };
  }, [historyQuery.data, closes]);

  const handleExportPDF = async () => {
    if (!historyQuery.data) return;
    try {
      await exportAssetPDF(asset.name, asset.symbol, asset.currency, historyQuery.data.candles, fxToBRL);
      toast.success("PDF gerado");
    } catch (e) {
      toast.error("Falha ao gerar PDF", { description: String(e) });
    }
  };
  const handleExportXLSX = async () => {
    if (!historyQuery.data) return;
    try {
      await exportHistoryXLSX(asset.name, asset.symbol, asset.currency, historyQuery.data.candles, fxToBRL);
      toast.success("Excel gerado");
    } catch (e) {
      toast.error("Falha ao gerar Excel", { description: String(e) });
    }
  };
  const handleExportCSV = () => {
    if (!historyQuery.data) return;
    try {
      exportHistoryCSV(asset.name, asset.symbol, asset.currency, historyQuery.data.candles, fxToBRL);
      toast.success("CSV gerado");
    } catch (e) {
      toast.error("Falha ao gerar CSV", { description: String(e) });
    }
  };

  const positive = (quote?.changePercent ?? 0) >= 0;

  return (
    <div className="min-h-screen bg-brand-bg text-foreground font-sans p-6 max-w-[1600px] mx-auto">
      <Header usdBrl={usdBrl} />

      <button
        onClick={() => router.history.back()}
        className="text-xs text-brand-muted hover:text-foreground transition-colors mb-4 inline-flex items-center gap-1.5 uppercase tracking-wider"
      >
        <ArrowLeft className="size-3.5" /> Voltar
      </button>

      <div className="grid grid-cols-12 gap-6">
        <main className="col-span-12 lg:col-span-9">
          <div className="bg-brand-surface border border-brand-border rounded-lg p-6 mb-6">
            <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
              <div>
                <span className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.2em]">{asset.symbol}</span>
                <h1 className="font-display text-4xl font-bold tracking-tight mt-1 text-foreground" style={{ textShadow: "0 0 24px color-mix(in oklab, var(--brand-accent) 35%, transparent)" }}>{asset.name}</h1>
                {quote?.price != null && (
                  <div className="flex items-baseline gap-3 mt-3">
                    <span className="text-3xl font-display font-bold tabular-nums">{fmtPrice(quote.price, asset.currency, asset.category)}</span>
                    {asset.currency !== "BRL" && asset.category !== "indices" && (
                      <span className="text-base text-brand-muted tabular-nums">{fmtBRL(quote.priceBRL)}</span>
                    )}
                    {quote.changePercent != null && (
                      <span className={`text-sm font-medium tabular-nums ${positive ? "text-brand-positive" : "text-brand-negative"}`}>
                        {positive ? "+" : ""}{quote.changePercent.toFixed(2)}%
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={handleExportPDF} disabled={!historyQuery.data} className="px-3 py-2 bg-brand-surface-2 border border-brand-border hover:border-brand-accent/50 text-xs font-bold rounded transition-colors uppercase tracking-widest flex items-center gap-2 disabled:opacity-50">
                  <FileText className="size-3.5" /> PDF
                </button>
                <button onClick={handleExportCSV} disabled={!historyQuery.data} className="px-3 py-2 bg-brand-surface-2 border border-brand-border hover:border-brand-accent/50 text-xs font-bold rounded transition-colors uppercase tracking-widest flex items-center gap-2 disabled:opacity-50">
                  <FileSpreadsheet className="size-3.5" /> CSV
                </button>
                <button onClick={handleExportXLSX} disabled={!historyQuery.data} className="px-3 py-2 bg-brand-accent hover:bg-brand-accent/90 text-xs font-bold text-white rounded transition-colors uppercase tracking-widest flex items-center gap-2 disabled:opacity-50">
                  <Download className="size-3.5" /> Excel
                </button>
              </div>
            </div>

            {/* Range + Interval selectors */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex flex-wrap gap-1">
                {RANGES.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setRange(r.value)}
                    className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded transition-colors ${
                      range === r.value ? "bg-brand-accent text-white" : "bg-brand-surface-2 text-brand-muted hover:text-foreground"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-1 border border-brand-border rounded p-0.5">
                {INTERVALS.map((iv) => (
                  <button
                    key={iv.value}
                    onClick={() => setIntervalState(iv.value)}
                    className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded transition-colors ${
                      interval === iv.value ? "bg-brand-accent text-white" : "text-brand-muted hover:text-foreground"
                    }`}
                  >
                    {iv.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Chart */}
            <div className="h-[420px] w-full">
              {historyQuery.isLoading ? (
                <div className="h-full w-full bg-brand-surface-2/40 rounded animate-pulse" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <filter id="chartGlow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="2.5" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>
                    <CartesianGrid stroke="var(--brand-border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "var(--brand-muted)", fontSize: 10 }} minTickGap={40} stroke="var(--brand-border)" />
                    <YAxis tick={{ fill: "var(--brand-muted)", fontSize: 10 }} domain={["auto", "auto"]} stroke="var(--brand-border)" width={70} tickFormatter={(v) => fmtPrice(v, asset.currency, asset.category).replace(/\s/g, "")} />
                    <Tooltip
                      contentStyle={{ background: "var(--brand-bg)", border: "1px solid var(--brand-border)", fontSize: 12 }}
                      labelStyle={{ color: "var(--brand-muted)" }}
                      formatter={(value, name) => {
                        const n = typeof value === "number" ? value : Number(value);
                        return [Number.isFinite(n) ? fmtPrice(n, asset.currency, asset.category) : "—", String(name)];
                      }}
                    />
                    {/* Forecast confidence band */}
                    <Area type="monotone" dataKey="band" stroke="none" fill="var(--brand-accent)" fillOpacity={0.12} isAnimationActive={false} />
                    <Line type="monotone" dataKey="close" name="Preço" stroke="var(--brand-accent)" strokeWidth={2} dot={false} isAnimationActive={false} filter="url(#chartGlow)" />
                    {showSMA && <Line type="monotone" dataKey="sma" name={`SMA ${showSMA}`} stroke="#f59e0b" strokeWidth={1} dot={false} isAnimationActive={false} />}
                    {showEMA && <Line type="monotone" dataKey="ema" name={`EMA ${showEMA}`} stroke="#a855f7" strokeWidth={1} dot={false} isAnimationActive={false} />}
                    <Line type="monotone" dataKey="yhat" name="Previsão" stroke="var(--brand-accent)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* MA selectors */}
            <div className="mt-6 grid sm:grid-cols-2 gap-6">
              <div>
                <div className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.2em] mb-2">SMA</div>
                <div className="flex flex-wrap gap-1">
                  <button onClick={() => setShowSMA(null)} className={`px-2 py-1 text-[11px] rounded ${!showSMA ? "bg-brand-accent text-white" : "bg-brand-surface-2 text-brand-muted"}`}>Off</button>
                  {MA_PERIODS.map((p) => (
                    <button key={p} onClick={() => setShowSMA(p)} className={`px-2 py-1 text-[11px] rounded tabular-nums ${showSMA === p ? "bg-brand-accent text-white" : "bg-brand-surface-2 text-brand-muted hover:text-foreground"}`}>{p}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.2em] mb-2">EMA</div>
                <div className="flex flex-wrap gap-1">
                  <button onClick={() => setShowEMA(null)} className={`px-2 py-1 text-[11px] rounded ${!showEMA ? "bg-brand-accent text-white" : "bg-brand-surface-2 text-brand-muted"}`}>Off</button>
                  {MA_PERIODS.map((p) => (
                    <button key={p} onClick={() => setShowEMA(p)} className={`px-2 py-1 text-[11px] rounded tabular-nums ${showEMA === p ? "bg-brand-accent text-white" : "bg-brand-surface-2 text-brand-muted hover:text-foreground"}`}>{p}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>

        <aside className="col-span-12 lg:col-span-3 space-y-4">
          {/* Stats */}
          <div className="bg-brand-surface border border-brand-border rounded-lg p-4">
            <h3 className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.2em] mb-3">Estatísticas do período</h3>
            {stats ? (
              <dl className="space-y-2 text-sm">
                <Stat label="Abertura" value={fmtPrice(stats.open, asset.currency, asset.category)} />
                <Stat label="Fechamento" value={fmtPrice(stats.close, asset.currency, asset.category)} />
                <Stat label="Máxima" value={fmtPrice(stats.max, asset.currency, asset.category)} />
                <Stat label="Mínima" value={fmtPrice(stats.min, asset.currency, asset.category)} />
                <Stat label="Variação" value={fmtPercent(stats.variation)} highlight={stats.variation >= 0 ? "pos" : "neg"} />
                {asset.currency !== "BRL" && asset.category !== "indices" && <Stat label="Fechamento BRL" value={fmtBRL(stats.close * fxToBRL)} />}
              </dl>
            ) : (
              <div className="text-brand-muted text-sm">—</div>
            )}
          </div>

          {/* Forecast */}
          <div className="bg-brand-surface border border-brand-border rounded-lg p-4">
            <h3 className="text-[10px] font-bold text-brand-accent uppercase tracking-[0.2em] mb-3">Previsão</h3>
            <div className="flex flex-wrap gap-1 mb-3">
              {HORIZONS.map((h) => (
                <button key={h} onClick={() => setHorizon(h)} className={`px-2 py-1 text-[11px] rounded tabular-nums ${horizon === h ? "bg-brand-accent text-white" : "bg-brand-surface-2 text-brand-muted hover:text-foreground"}`}>
                  {h}d
                </button>
              ))}
            </div>
            {fc && fc.points.length > 0 ? (
              <div className="space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-brand-muted">Projeção</span>
                  <span className="font-bold tabular-nums">{fmtPrice(fc.points[fc.points.length - 1].yhat, asset.currency, asset.category)}</span>
                </div>
                {asset.currency !== "BRL" && asset.category !== "indices" && (
                  <div className="flex justify-between text-xs">
                    <span className="text-brand-muted">Projeção (BRL)</span>
                    <span className="font-bold tabular-nums text-brand-accent">{fmtBRL(fc.points[fc.points.length - 1].yhat * fxToBRL)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs">
                  <span className="text-brand-muted">Intervalo 95%</span>
                  <span className="tabular-nums text-[11px]">
                    {fmtPrice(fc.points[fc.points.length - 1].lower, asset.currency, asset.category)} — {fmtPrice(fc.points[fc.points.length - 1].upper, asset.currency, asset.category)}
                  </span>
                </div>
                {asset.currency !== "BRL" && asset.category !== "indices" && (
                  <div className="flex justify-between text-xs">
                    <span className="text-brand-muted">Intervalo (BRL)</span>
                    <span className="tabular-nums text-[11px]">
                      {fmtBRL(fc.points[fc.points.length - 1].lower * fxToBRL)} — {fmtBRL(fc.points[fc.points.length - 1].upper * fxToBRL)}
                    </span>
                  </div>
                )}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-brand-muted">Confiança</span>
                    <span className="font-bold tabular-nums">{(fc.confidence * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-1 w-full bg-brand-surface-2 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-accent" style={{ width: `${Math.max(5, fc.confidence * 100)}%` }} />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-brand-muted">Dados insuficientes para previsão.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: "pos" | "neg" }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-brand-muted text-xs">{label}</dt>
      <dd className={`font-medium tabular-nums text-xs ${highlight === "pos" ? "text-brand-positive" : highlight === "neg" ? "text-brand-negative" : ""}`}>{value}</dd>
    </div>
  );
}