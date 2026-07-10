## Objetivo
Adicionar dois novos arquivos e substituir um existente com as versões enviadas.

## Passos
1. Copiar `user-uploads://etf-flows.ts` → `src/lib/finance/etf-flows.ts` (novo).
2. Copiar `user-uploads://etf-flows.functions.ts` → `src/lib/api/etf-flows.functions.ts` (novo).
3. Copiar `user-uploads://ativo.$slug.tsx` → `src/routes/ativo.$slug.tsx` (overwrite).
4. Build automático valida imports e tipos.

Nenhum outro arquivo será alterado.