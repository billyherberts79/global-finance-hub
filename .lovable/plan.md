## Plano

Copiar os dois arquivos enviados para os caminhos indicados:

1. `user-uploads://derivatives.ts` → `src/lib/finance/derivatives.ts`
2. `user-uploads://derivatives.functions.ts` → `src/lib/api/derivatives.functions.ts`

Nenhum outro arquivo será alterado. Os arquivos serão copiados na íntegra usando `code--copy`, preservando o conteúdo original (imports já apontam para `../finance/derivatives`, compatível com a estrutura do projeto).

Após a cópia, o build do TanStack roda automaticamente para validar que não há erros de tipo/import.

### Observação
Os arquivos ficam disponíveis para uso, mas ainda não estão conectados a nenhuma rota/componente da UI. Caso queira exibir os sinais de derivativos (funding rate, open interest) na página de ativo (BTC/ETH), isso pode ser feito em uma etapa seguinte.