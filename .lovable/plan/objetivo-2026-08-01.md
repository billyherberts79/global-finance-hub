## Objetivo
Adicionar o guia de indicadores e atualizar a página de ativo.

## Passos
1. Criar `src/components/IndicatorGuide.tsx` a partir do arquivo enviado (modal com explicações de SMA/EMA, previsão, pressão de mercado, fluxos de ETF).
2. Substituir `src/routes/ativo.$slug.tsx` pela nova versão: única diferença em relação à atual é o import do `IndicatorGuide` e o botão do guia alinhado à direita acima do conteúdo.
3. Validar build/typecheck.

Nenhum outro arquivo será alterado.
