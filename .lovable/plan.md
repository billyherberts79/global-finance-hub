## Plano

Substituir o arquivo `src/routes/ativo.$slug.tsx` pelo conteúdo do arquivo enviado em `user-uploads://ativo.$slug.tsx`.

### Passos
1. Copiar `user-uploads://ativo.$slug.tsx` para `src/routes/ativo.$slug.tsx` (com overwrite).
2. Deixar o build automático validar imports (`@/lib/api/derivatives.functions` e `@/lib/finance/derivatives` já existem no projeto).

Nenhum outro arquivo será alterado.