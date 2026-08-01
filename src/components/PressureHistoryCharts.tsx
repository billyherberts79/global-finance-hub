import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DerivativesSignal } from "@/lib/finance/derivatives";
import type { EtfFlowSignal } from "@/lib/finance/etf-flows";
import { fmtDate } from "@/lib/finance/format";

const tooltipStyle = {
  contentStyle: {
    background: "var(--brand-bg)",
    border: "1px solid var(--brand-border)",
    borderRadius: 6,
    fontSize: 11,
  },
  labelStyle: { color: "var(--brand-muted)" },
};

function FundingRateChart({ derivatives }: { derivatives: DerivativesSignal }) {
  const data = derivatives.fundingHistory.map((p) => ({
    t: p.t,
    date: fmtDate(p.t),
    ratePct: p.rate * 100,
  }));

  if (data.length < 2) {
    return <p className="text-xs text-brand-muted">Histórico de funding rate insuficiente.</p>;
  }

  return (
    <div>
      <p className="text-[10px] font-bold text-brand-muted uppercase tracking-wide mb-2">
        Funding rate — histórico ({derivatives.futuresSymbol})
      </p>
      <div className="h-32 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="var(--brand-border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "var(--brand-muted)", fontSize: 9 }}
              stroke="var(--brand-border)"
              minTickGap={30}
            />
            <YAxis
              tick={{ fill: "var(--brand-muted)", fontSize: 9 }}
              stroke="var(--brand-border)"
              tickFormatter={(v: number) => `${v.toFixed(4)}%`}
              width={56}
            />
            <Tooltip
              {...tooltipStyle}
              formatter={(value: number) => [`${value.toFixed(4)}%`, "Funding rate"]}
            />
            <Line
              type="monotone"
              dataKey="ratePct"
              stroke="var(--brand-accent)"
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function EtfFlowChart({ etfFlow }: { etfFlow: EtfFlowSignal }) {
  const data = etfFlow.history.map((d) => ({
    date: fmtDate(new Date(d.date)),
    flow: d.totalUsdM ?? 0,
  }));

  if (data.length < 2) {
    return <p className="text-xs text-brand-muted">Histórico de fluxo de ETF insuficiente.</p>;
  }

  return (
    <div>
      <p className="text-[10px] font-bold text-brand-muted uppercase tracking-wide mb-2">
        Fluxo diário de ETFs spot — últimos {data.length} dias
      </p>
      <div className="h-32 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="var(--brand-border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "var(--brand-muted)", fontSize: 9 }}
              stroke="var(--brand-border)"
              minTickGap={40}
            />
            <YAxis
              tick={{ fill: "var(--brand-muted)", fontSize: 9 }}
              stroke="var(--brand-border)"
              tickFormatter={(v: number) => `${v.toFixed(0)}M`}
              width={48}
            />
            <Tooltip
              {...tooltipStyle}
              formatter={(value: number) => [`US$ ${value.toFixed(1)}M`, "Fluxo líquido"]}
            />
            <Bar dataKey="flow" radius={[2, 2, 0, 0]}>
              {data.map((d, i) => (
                <Cell
                  key={i}
                  fill={d.flow >= 0 ? "var(--brand-positive)" : "var(--brand-negative)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function PressureHistoryCharts({
  derivatives,
  etfFlow,
}: {
  derivatives?: DerivativesSignal | null;
  etfFlow?: EtfFlowSignal | null;
}) {
  const hasDerivatives = !!derivatives && derivatives.fundingHistory.length > 1;
  const hasEtfFlow = !!etfFlow && etfFlow.history.length > 1;

  if (!hasDerivatives && !hasEtfFlow) return null;

  return (
    <div className="bg-brand-surface border border-brand-border rounded-lg p-4">
      <h3 className="text-[10px] font-bold text-brand-accent uppercase tracking-[0.2em] mb-3">
        Histórico dos sinais de pressão
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {hasDerivatives && <FundingRateChart derivatives={derivatives} />}
        {hasEtfFlow && <EtfFlowChart etfFlow={etfFlow} />}
      </div>
    </div>
  );
}
