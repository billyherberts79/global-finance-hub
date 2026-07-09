## Plano

Substituir três arquivos pelas novas versões enviadas em `user-uploads://`.

### Passos
1. Copiar `user-uploads://derivatives-2.ts` → `src/lib/finance/derivatives.ts` (overwrite).
2. Copiar `user-uploads://derivatives.functions-2.ts` → `src/lib/api/derivatives.functions.ts` (overwrite).
3. Copiar `user-uploads://ativo.$slug-2.tsx` → `src/routes/ativo.$slug.tsx` (overwrite).
4. Deixar o build automático validar imports e tipos.

Nenhum outro arquivo será alterado.