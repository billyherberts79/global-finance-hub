/**
 * Sinal de fluxo líquido dos ETFs spot de Bitcoin (IBIT, FBTC, GBTC etc.)
 * como proxy de demanda/oferta institucional real.
 *
 * Fonte: farside.co.uk (Farside Investors). Não existe uma API oficial e
 * gratuita para esse dado — a Farside disponibiliza os números numa tabela
 * HTML pública, então fazemos parsing dessa tabela. Isso é inerentemente
 * mais frágil que consumir uma API estruturada: se a Farside mudar o layout
 * da página, o parser pode parar de funcionar e precisar de ajuste.
 *
 * IMPORTANTE: os limiares de normalização abaixo (300 US$M/dia = extremo)
 * são heurísticas de ponto de partida baseadas na ordem de grandeza
 * histórica observada na própria tabela, não valores calibrados via
 * backtest.
 */

/** Mapeia o slug do ativo para o caminho da página de flows na Farside. */
export const FARSIDE_PATH: Record<string, string> = {
  btc: "btc",
};

export function hasEtfFlowSignal(slug: string): boolean {
  return slug in FARSIDE_PATH;
}

export interface EtfFlowDayPoint {
  /** Data no formato ISO yyyy-mm-dd */
  date: string;
  /** Fluxo líquido total do dia, em milhões de USD. null = dado ainda não publicado. */
  totalUsdM: number | null;
}

export interface EtfFlowSignal {
  slug: string;

  latestDate: string | null;
  latestDayFlowUsdM: number | null;
  last5dFlowUsdM: number | null; // soma dos últimos 5 dias com dado disponível
  last5dAvgUsdM: number | null;

  dailyScore: number; // -1..1, baseado no último dia
  cumulativeScore: number; // -1..1, baseado na soma de 5 dias
  pressureScore: number; // -1..1, média dos dois

  label: "strong_inflow" | "strong_outflow" | "neutro" | "indisponivel";
  debugErrors?: string[];
  updatedAt: string;
}

function scaledTanh(value: number, scale: number): number {
  if (!Number.isFinite(value) || scale === 0) return 0;
  return Math.tanh(value / scale);
}

export function computeDailyFlowScore(flowUsdM: number | null): number {
  if (flowUsdM == null || !Number.isFinite(flowUsdM)) return 0;
  // 300 US$M num único dia é um fluxo bem forte (olhando o histórico da tabela).
  return scaledTanh(flowUsdM, 300);
}

export function computeCumulativeFlowScore(sum5dUsdM: number | null): number {
  if (sum5dUsdM == null || !Number.isFinite(sum5dUsdM)) return 0;
  // 1200 US$M acumulados em 5 dias é um movimento sustentado forte.
  return scaledTanh(sum5dUsdM, 1200);
}

export function buildEtfFlowSignal(params: {
  slug: string;
  days: EtfFlowDayPoint[]; // ordenado ascendente por data
  debugErrors?: string[];
}): EtfFlowSignal {
  const { slug, days, debugErrors } = params;

  const withData = days.filter((d) => d.totalUsdM != null);
  const latest = withData.length ? withData[withData.length - 1] : null;

  const last5 = withData.slice(-5);
  const last5dFlowUsdM = last5.length
    ? last5.reduce((s, d) => s + (d.totalUsdM as number), 0)
    : null;
  const last5dAvgUsdM =
    last5.length && last5dFlowUsdM != null ? last5dFlowUsdM / last5.length : null;

  const dailyScore = computeDailyFlowScore(latest?.totalUsdM ?? null);
  const cumulativeScore = computeCumulativeFlowScore(last5dFlowUsdM);

  const hasData = latest != null;
  const pressureScore = hasData ? (dailyScore + cumulativeScore) / 2 : 0;

  let label: EtfFlowSignal["label"] = "indisponivel";
  if (hasData) {
    if (pressureScore > 0.5) label = "strong_inflow";
    else if (pressureScore < -0.5) label = "strong_outflow";
    else label = "neutro";
  }

  return {
    slug,
    latestDate: latest?.date ?? null,
    latestDayFlowUsdM: latest?.totalUsdM ?? null,
    last5dFlowUsdM,
    last5dAvgUsdM,
    dailyScore,
    cumulativeScore,
    pressureScore,
    label,
    debugErrors: debugErrors && debugErrors.length ? debugErrors : undefined,
    updatedAt: new Date().toISOString(),
  };
}

export const ETF_LABEL_DESCRIPTION: Record<EtfFlowSignal["label"], string> = {
  strong_inflow:
    "Entrada líquida forte e sustentada nos ETFs spot de Bitcoin — sinal de demanda institucional real comprando o ativo subjacente.",
  strong_outflow:
    "Saída líquida forte e sustentada dos ETFs spot de Bitcoin — sinal de resgates institucionais vendendo o ativo subjacente.",
  neutro:
    "Fluxo de ETFs dentro da faixa normal, sem pressão relevante de demanda institucional em nenhuma direção.",
  indisponivel: "Dados de fluxo de ETF indisponíveis no momento.",
};

// =============================================================================
// Parsing da tabela HTML da Farside — tolerante a variações de marcação.
// =============================================================================

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#8217;/gi, "'")
    .replace(/&#8211;/gi, "-");
}

/** Converte uma célula de texto da tabela ("(172.0)", "1,119.9", "-", "0.0") num número ou null. */
export function parseFarsideCell(raw: string): number | null {
  const text = raw.trim();
  if (text === "" || text === "-" || text === "—") return null;
  const isNegative = text.startsWith("(") && text.endsWith(")");
  const cleaned = text.replace(/[(),]/g, "").replace(/,/g, "");
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return null;
  return isNegative ? -num : num;
}

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

/** Converte "22 Jun 2026" -> "2026-06-22". Retorna null se não bater o formato. */
export function parseFarsideDate(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const monthIdx = MONTHS[m[2].toLowerCase()];
  const year = Number(m[3]);
  if (monthIdx == null || !Number.isFinite(day) || !Number.isFinite(year)) return null;
  const mm = String(monthIdx + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/**
 * Extrai as linhas diárias de fluxo total (US$M) de uma página HTML da Farside.
 * Estratégia: converte <tr>/<td>/<th> em delimitadores textuais antes de
 * remover as demais tags, para não depender de atributos/classes específicas.
 */
export function parseFarsideHtml(html: string): EtfFlowDayPoint[] {
  const tableMatch = html.match(/<table[^>]*>[\s\S]*?<\/table>/i);
  if (!tableMatch) throw new Error("Tabela não encontrada no HTML da Farside");

  let content = tableMatch[0];
  content = content.replace(/<tr[^>]*>/gi, "\n@ROW@\n");
  content = content.replace(/<\/tr>/gi, "");
  content = content.replace(/<t[dh][^>]*>/gi, "@CELL@");
  content = content.replace(/<\/t[dh]>/gi, "");
  content = content.replace(/<[^>]+>/g, ""); // remove tags remanescentes (img, a, span, strong...)
  content = decodeEntities(content);

  const rawRows = content
    .split("@ROW@")
    .map((r) => r.trim())
    .filter(Boolean);

  const days: EtfFlowDayPoint[] = [];

  for (const row of rawRows) {
    const cells = row
      .split("@CELL@")
      .map((c) => c.replace(/\s+/g, " ").trim())
      .filter((c, idx) => !(idx === 0 && c === "")); // remove célula vazia inicial de indentação, se houver

    if (cells.length < 2) continue;

    const firstCell = cells[0];
    const parsedDate = parseFarsideDate(firstCell);
    if (!parsedDate) continue; // pula cabeçalhos, linha "Fee", "Total", "Average" etc.

    const tickerCells = cells.slice(1, -1); // exclui a data (primeira) e o total (última)
    const totalRaw = cells[cells.length - 1];

    const allTickersUnpublished =
      tickerCells.length > 0 && tickerCells.every((c) => parseFarsideCell(c) == null);

    // Quando o dia ainda não foi publicado, cada ETF mostra "-", mas a coluna
    // Total às vezes já vem preenchida com "0.0" por padrão — isso não é um
    // fluxo real de zero, é ausência de dado. Tratamos como null nesse caso.
    const totalUsdM = allTickersUnpublished ? null : parseFarsideCell(totalRaw);

    days.push({ date: parsedDate, totalUsdM });
  }

  return days.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
