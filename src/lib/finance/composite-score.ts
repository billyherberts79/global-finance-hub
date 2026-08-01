/**
 * Score composto: combina os fatores considerados relevantes para o
 * movimento futuro do ativo, cada um já normalizado para -1 (baixista) a
 * +1 (altista), numa média ponderada.
 *
 * Pesos-base (definidos a partir da relevância relativa discutida para o
 * dashboard):
 *   - Indicadores técnicos / tendência de preço: 40
 *   - Fluxo de ETFs spot (demanda institucional):  25
 *   - Pressão de derivativos (funding + Open Interest): 20
 *   - Basis de futuros CME: 15 — NÃO IMPLEMENTADO (sem fonte gratuita
 *     viável encontrada). O peso dele é redistribuído proporcionalmente
 *     entre os fatores disponíveis, então os 3 fatores ativos hoje somam
 *     100% entre si (~47% / ~29% / ~24%).
 *
 * Quando um fator individual está indisponível para o ativo (ex.: ativo
 * sem par de futuros, ou API fora do ar), ele também é excluído e o peso é
 * redistribuído entre os que restaram — nunca "puxa" o score em direção a
 * zero por causa de dado faltante.
 */

export interface ScoreComponentInput {
  key: string;
  label: string;
  /** -1 (baixista) a +1 (altista). Ignorado se available=false. */
  score: number;
  /** Peso-base (antes da renormalização), na mesma escala arbitrária entre os componentes. */
  weight: number;
  available: boolean;
}

export interface ScoreComponentResult extends ScoreComponentInput {
  normalizedWeight: number; // 0..1, soma 1 entre os componentes disponíveis
  contribution: number; // score * normalizedWeight
}

export interface CompositeScoreResult {
  score: number; // -1..1
  label: "bullish" | "bearish" | "neutro" | "indisponivel";
  components: ScoreComponentResult[];
  updatedAt: string;
}

export const COMPOSITE_LABEL_DESCRIPTION: Record<CompositeScoreResult["label"], string> = {
  bullish:
    "Os fatores disponíveis, combinados e ponderados, apontam predominantemente para viés comprador (alta).",
  bearish:
    "Os fatores disponíveis, combinados e ponderados, apontam predominantemente para viés vendedor (baixa).",
  neutro: "Fatores mistos ou fracos entre si — sem viés dominante claro no momento.",
  indisponivel: "Dados insuficientes para calcular o score composto deste ativo.",
};

/**
 * Deriva um score -1..1 a partir do resultado do módulo de forecast
 * (regressão sobre log-preço): usa a inclinação diária (slopePerDay) como
 * direção/força da tendência, amortecida pela confiança (r²) do ajuste —
 * uma tendência forte mas com baixa confiança estatística pesa menos.
 */
export function computeTechnicalScore(
  fc: { confidence: number; slopePerDay: number } | null,
): number {
  if (!fc || !Number.isFinite(fc.slopePerDay)) return 0;
  // 1%/dia de inclinação (em log) é considerado uma tendência bem forte.
  const raw = Math.tanh(fc.slopePerDay / 0.01);
  const confidenceWeight = Math.max(0, Math.min(1, fc.confidence));
  return raw * confidenceWeight;
}

export function buildCompositeScore(components: ScoreComponentInput[]): CompositeScoreResult {
  const available = components.filter((c) => c.available);
  const totalWeight = available.reduce((s, c) => s + c.weight, 0);

  const withNorm: ScoreComponentResult[] = components.map((c) => {
    const normalizedWeight = c.available && totalWeight > 0 ? c.weight / totalWeight : 0;
    const contribution = c.available ? c.score * normalizedWeight : 0;
    return { ...c, normalizedWeight, contribution };
  });

  const score = withNorm.reduce((s, c) => s + c.contribution, 0);

  let label: CompositeScoreResult["label"] = "indisponivel";
  if (available.length > 0) {
    // Limiar mais baixo que o dos sinais individuais (±0.5), porque a média
    // ponderada de vários fatores já tende a se aproximar de zero quando há
    // divergência entre eles — exigir ±0.5 aqui raramente disparia.
    if (score > 0.3) label = "bullish";
    else if (score < -0.3) label = "bearish";
    else label = "neutro";
  }

  return {
    score,
    label,
    components: withNorm,
    updatedAt: new Date().toISOString(),
  };
}
