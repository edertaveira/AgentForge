# Checkpoints do curso

Os checkpoints abaixo são estados estáveis do projeto para demonstração e gravação. Eles não
são branches de trabalho: são tags imutáveis que permitem voltar exatamente ao estado exibido
em uma aula.

| Tag | Estado validado | Aulas principais |
| --- | --- | --- |
| `v0.2-jira` | Jira Cloud e análise com OpenAI | Seção 10, aulas 66–69 |
| `v0.3-github` | publicação controlada de Pull Request | Seção 11, aulas 70–75 |
| `v0.4-mcp` | MCP local, filtrado e somente leitura | Seção 10, aulas 61–65 |

## Regra para as gravações

- Use `main` para introduções, arquitetura e demonstração final.
- Use uma tag somente quando a aula precisar reproduzir aquele marco histórico.
- Nunca edite a partir de uma tag. Para corrigir algo, volte à `main`, crie uma branch e gere
  uma nova tag depois do merge e da validação.
- Não mostre `.env`, tokens, cabeçalhos HTTP, histórico do terminal ou telas de criação de
  credenciais.
- Antes de cada gravação, confirme que o repositório está limpo e execute a validação indicada
  no roteiro.

## Como abrir um checkpoint sem risco

```bash
git status --short
git switch --detach v0.4-mcp
npm ci
npm test
```

Depois da gravação:

```bash
git switch main
```

O modo `detached HEAD` é esperado aqui: ele impede que uma alteração acidental pareça pertencer
a uma branch do curso.

## Critério para um novo checkpoint

Uma nova tag só pode ser criada após:

```bash
npm ci
npm test
npm run check
git diff --check
```

Integrações externas também exigem seus checks específicos e revisão humana. Passar nos testes
não autoriza publicar, fazer merge ou alterar Jira/GitHub automaticamente.
