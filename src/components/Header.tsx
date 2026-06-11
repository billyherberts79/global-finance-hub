import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

interface HeaderProps {
  usdBrl?: number | null;
  lastUpdate?: string;
}

export function Header({ usdBrl, lastUpdate }: HeaderProps) {
  const [now, setNow] = useState("");
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString("pt-BR"));
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, []);

  return (
    <nav className="flex items-center justify-between mb-10 border-b border-brand-border pb-6">
      <div className="flex items-center gap-8">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="size-8 bg-brand-accent rounded-sm flex items-center justify-center">
            <div className="size-4 border-2 border-white/90 rotate-45 group-hover:rotate-[225deg] transition-transform duration-500"></div>
          </div>
          <span className="font-display text-xl font-bold tracking-tight uppercase">
            Nexus Finance
          </span>
        </Link>
        <div className="hidden md:flex gap-6 text-sm font-medium text-brand-muted">
          <Link to="/" className="hover:text-foreground transition-colors" activeOptions={{ exact: true }} activeProps={{ className: "text-foreground" }}>
            Dashboard
          </Link>
          <Link to="/relatorios" className="hover:text-foreground transition-colors" activeProps={{ className: "text-foreground" }}>
            Relatórios
          </Link>
          <Link to="/saude" className="hover:text-foreground transition-colors" activeProps={{ className: "text-foreground" }}>
            Saúde do Sistema
          </Link>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {usdBrl != null && (
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">USD / BRL</span>
            <span className="text-sm font-display font-bold">R$ {usdBrl.toFixed(4)}</span>
          </div>
        )}
        <div className="px-3 py-1 rounded-full bg-brand-positive/10 border border-brand-positive/20 flex items-center gap-2">
          <div className="size-1.5 rounded-full bg-brand-positive animate-pulse"></div>
          <span className="text-[10px] font-bold text-brand-positive uppercase tracking-wider">
            Sistemas Online
          </span>
        </div>
        <div className="text-xs text-brand-muted tabular-nums" suppressHydrationWarning>
          {now} BRT
        </div>
      </div>
    </nav>
  );
}