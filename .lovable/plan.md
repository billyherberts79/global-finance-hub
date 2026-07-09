## Objetivo
Substituir `src/lib/api/derivatives.functions.ts` pela nova versão enviada (`derivatives.functions-3.ts`).

## O que mudou
- Troca do provedor de dados de derivativos de **Binance Futures** para **Bybit V5** (endpoints públicos, sem API key).
- Motivo: Binance (`fapi.binance.com`) retorna HTTP 403 em certas infraestruturas de hospedagem devido a bloqueio geográfico/regulatório; Bybit não apresentou esse problema nos testes.
- Novos endpoints: `/v5/market/funding/history` e `/v5/market/open-interest`.
- Adaptação do parsing de resposta (envelope `retCode`/`retMsg`, timestamps como string, ordenação ascendente).
- Logging ajustado para refletir o novo provedor (`bybit-funding`, `bybit-oi`).

## Passo
1. Copiar `user-uploads://derivatives.functions-3.ts` → `src/lib/api/derivatives.functions.ts` (overwrite).
2. Deixar o build automático validar imports e tipos.

## Nenhum outro arquivo será alterado.
