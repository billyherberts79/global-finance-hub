import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface GuideSection {
  title: string;
  whatItIs: string;
  howToRead: string;
  limits: string;
}

const SECTIONS: GuideSection[] = [
  {
    title: "Médias móveis (SMA / EMA)",
    whatItIs:
      "A SMA (média móvel simples) e a EMA (média móvel exponencial) suavizam o preço ao longo do tempo, facilitando enxergar a tendência por trás da oscilação diária. A EMA dá mais peso aos preços recentes; a SMA trata todos os dias do período igualmente.",
    howToRead:
      "Quando o preço está acima das médias, a tendência de curto prazo tende a ser de alta; abaixo, de baixa. O cruzamento entre uma média curta e uma longa (ex.: EMA 21 cruzando a SMA 50) costuma ser observado como possível mudança de tendência.",
    limits:
      'Médias móveis são indicadores de atraso (lagging): reagem ao que já aconteceu, não preveem o futuro. Em mercados sem tendência clara ("andando de lado"), geram sinais falsos com frequência.',
  },
  {
    title: "Previsão de preço (regressão)",
    whatItIs:
      "Uma regressão estatística sobre o histórico de preços (em escala logarítmica) que projeta uma linha de tendência para os próximos dias, com uma banda de confiança de 95% ao redor.",
    howToRead:
      'O valor central é a projeção mais provável segundo o padrão histórico recente. A banda de 95% mostra a faixa em que o preço provavelmente estará, dado esse mesmo padrão — quanto mais larga a banda, maior a incerteza. O percentual de "Confiança" reflete o quanto os dados históricos se ajustaram bem a essa linha de tendência.',
    limits:
      "Esse modelo só enxerga o próprio histórico de preço — não sabe de notícias, decisões de política monetária, ou qualquer evento futuro. Ele assume que o padrão recente vai continuar, o que raramente é verdade em mercados voláteis como o de criptoativos. Trate como um cenário estatístico, não como uma previsão garantida.",
  },
  {
    title: "Pressão de mercado (futuros)",
    whatItIs:
      "Combina duas métricas do mercado de contratos futuros perpétuos (Bybit): o funding rate (taxa paga periodicamente entre posições compradas e vendidas) e a variação do Open Interest (total de contratos em aberto) nos últimos 7 dias.",
    howToRead:
      'Funding rate muito positivo e Open Interest subindo forte sugerem excesso de alavancagem em posições compradas (risco de "long squeeze" — liquidações em cascata numa correção). O oposto (funding negativo, OI caindo) sugere pressão vendedora elevada. Valores próximos de zero indicam mercado sem alavancagem excessiva em nenhuma direção.',
    limits:
      'Os limiares usados para classificar "pressão alta" (funding acima de ~20 pontos-base, ou variação de OI acima de ~20% em 7 dias) são heurísticas de ponto de partida, não calibradas estatisticamente. Além disso, esse dado vem de uma única exchange (Bybit), não do mercado global consolidado.',
  },
  {
    title: "Fluxo de ETFs spot",
    whatItIs:
      "Mede a entrada ou saída líquida de dinheiro nos ETFs de Bitcoin à vista negociados nos EUA (como IBIT, FBTC, GBTC), que refletem compra ou venda real de Bitcoin por parte de investidores institucionais.",
    howToRead:
      "Entradas líquidas fortes e sustentadas indicam demanda institucional comprando o ativo. Saídas líquidas fortes indicam resgates/venda institucional. Olhamos tanto o último dia disponível quanto o acumulado dos últimos 5 dias, para diferenciar um movimento pontual de uma tendência mais consistente.",
    limits:
      'Os dados são publicados com um dia de atraso (geralmente à noite, horário dos EUA) e a fonte (Farside Investors) não oferece uma API oficial — o dado é obtido lendo a tabela pública do site deles, o que é mais frágil que uma API estruturada. Os limiares de "fluxo forte" (US$ 300M/dia, US$ 1.200M em 5 dias) também são heurísticas, não calibradas por backtest.',
  },
];

export function IndicatorGuide() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto gap-1.5 px-2 py-1 text-[11px] font-semibold text-brand-accent hover:text-brand-accent hover:bg-brand-accent/10"
        >
          <Info className="h-3.5 w-3.5" />
          Como interpretar estes indicadores
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto bg-brand-surface border-brand-border">
        <DialogHeader>
          <DialogTitle className="text-brand-accent">Guia dos indicadores</DialogTitle>
          <DialogDescription>
            O que cada indicador mede, como interpretá-lo e onde ele deixa de ser confiável. Nenhum
            deles, isoladamente, deve ser usado como sinal único de decisão.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 pt-2">
          {SECTIONS.map((section) => (
            <div
              key={section.title}
              className="space-y-1.5 border-t border-brand-border pt-4 first:border-t-0 first:pt-0"
            >
              <h4 className="text-sm font-bold text-foreground">{section.title}</h4>
              <p className="text-xs text-brand-muted leading-relaxed">
                <span className="font-semibold text-foreground/80">O que é: </span>
                {section.whatItIs}
              </p>
              <p className="text-xs text-brand-muted leading-relaxed">
                <span className="font-semibold text-foreground/80">Como ler: </span>
                {section.howToRead}
              </p>
              <p className="text-xs text-brand-muted leading-relaxed">
                <span className="font-semibold text-brand-negative/80">Limites: </span>
                {section.limits}
              </p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
