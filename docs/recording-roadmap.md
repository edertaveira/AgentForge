# Mapa de gravação do AgentForge

Este documento transforma a grade curricular em uma sequência operacional. O objetivo é gravar
o raciocínio e as decisões da engenharia de agentes, não a digitação mecânica do TypeScript.

## Formato padrão de cada aula prática

1. Apresente o problema e o resultado observável esperado.
2. Mostre apenas o contexto necessário ao coding agent.
3. Leia o plano e destaque suposições ou perguntas bloqueantes.
4. Autorize somente a ação necessária para a aula.
5. Mostre os arquivos alterados e o diff relevante.
6. Execute a validação e abra as evidências geradas.
7. Termine com a decisão humana: corrigir, aprovar, publicar ou bloquear.

## Bloco A — Fundamentos e fluxo local (Seções 1–9)

**Estado para gravação:** `main` no checkpoint `v0.4-mcp`, usando o provider local.

**Demonstração central:**

```bash
npm run demo
```

Mostre `fixtures/tasks/AF-101.json`, o workspace isolado, `evidence.json`, o diff e o estado
`READY_FOR_HUMAN`. Este bloco cobre arquitetura, contratos, contexto, guardrails, implementação,
testes, revisão e orquestração. Nas aulas de construção, use o código final para explicar decisões
e recrie mudanças pequenas com o coding agent; não redigite a aplicação inteira.

**Exercícios:** tarefa ambígua; acesso a caminho proibido; regressão intencional; evidência
incompleta. Em cada exercício, o resultado pedagógico correto pode ser o bloqueio do fluxo.

## Bloco B — MCP local (Seção 10, aulas 61–65)

**Checkpoint:** `v0.4-mcp`.

```bash
npm run mcp:demo
```

Grave nesta ordem: problema de integração; host/client/server; descoberta das três ferramentas;
filtro estático; leitura de tarefa e arquivos; comprovação de que nenhuma escrita ocorreu.

**Mensagem central:** MCP padroniza contexto e ferramentas. Ele não torna o modelo autônomo nem
correto por si só.

## Bloco C — Jira real (Seção 10, aulas 66–69)

**Checkpoint:** `v0.2-jira` para explicar o marco, ou `main` para a demonstração mais atual.

```bash
npm run jira:check
npm run demo:jira
```

Use uma tarefa fictícia do projeto do curso. Mostre o identificador e os critérios, mas não o
`.env`, token, e-mail, headers ou URL privada completa. Explique a conversão para `WorkItem`, os
campos ausentes e as perguntas bloqueantes. Se o analista bloquear uma tarefa ambígua, preserve
esse resultado: ele é parte do produto, não uma falha da gravação.

## Bloco D — GitHub e Pull Request (Seção 11)

**Checkpoint:** `v0.3-github` para explicar o marco, ou `main` para executar o fluxo atual.

```bash
npm run github:check
npm run github:publish -- --approve-external --run=<run-revisado>
```

Primeiro mostre o preview, o diff, os testes realmente executados e a evidência ligada ao run.
Somente depois verbalize a aprovação e execute a publicação. Abra a URL retornada, revise a Pull
Request e pare antes do merge. A aula deve deixar claro que `--approve-external` representa uma
decisão humana explícita, não um detalhe burocrático.

## Bloco E — Projeto final (Seção 12)

Use `main` e execute o percurso completo: Jira → análise → implementação isolada → testes →
revisão → evidências → aprovação → Pull Request. Compare o resultado com as limitações conhecidas
e encerre mostrando como adaptar os contratos a outra linguagem sem substituir as validações.

## Ordem recomendada de gravação

Não grave na ordem numérica do curso. Grave primeiro o que reduz retrabalho:

1. Demonstração final local, sem credenciais.
2. MCP local.
3. Jira real.
4. Pull Request real.
5. Aulas conceituais das Seções 1 e 2.
6. Aulas de construção das Seções 3–9.
7. Projeto final e encerramento.

Assim, as integrações são verificadas cedo e as aulas iniciais podem antecipar exatamente o que o
aluno verá no restante do curso.
