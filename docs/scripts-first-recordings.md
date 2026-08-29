# Roteiros das primeiras gravações

Os roteiros são tópicos de fala, não textos para leitura literal.

## Aula 2 — Demonstração: do Jira à Pull Request

**Promessa:** ao final, o aluno verá o fluxo completo e saberá onde a decisão humana permanece.

1. Apresente o AgentForge como um fluxo verificável, não como um gerador de código livre.
2. Mostre rapidamente a tarefa fictícia e seus critérios.
3. Execute a demonstração local com `npm run demo`.
4. Aponte analista, implementador, testador e revisor sem explicar a implementação ainda.
5. Abra o workspace isolado, o diff e `artifacts/evidence.json`.
6. Destaque `READY_FOR_HUMAN`: o sistema terminou o trabalho automatizado, não publicou nada.
7. Mostre o preview da Pull Request e encerre antecipando Jira, MCP e GitHub.

**Corte:** não configure credenciais nesta aula e não mergulhe no TypeScript.

## Aula 3 — O que o agente fez e o que dependeu do humano

**Promessa:** separar automação de responsabilidade.

1. Liste o que foi automatizado: coleta de contexto, plano, workspace, mudança, testes e evidência.
2. Liste o que foi decidido por uma pessoa: objetivo, limites, resolução de ambiguidades,
   aprovação e publicação.
3. Use uma pergunta bloqueante real do projeto como exemplo de comportamento saudável.
4. Explique que teste aprovado não prova sozinho que toda a entrega está correta.
5. Termine com a regra: autoridade deve ser explícita e proporcional à ação.

## Aula 4 — Vibe coding versus agentic engineering

**Promessa:** mostrar por que o curso usa coding agents sem empobrecer o aprendizado.

1. Defina vibe coding como exploração rápida orientada pelo resultado aparente.
2. Defina agentic engineering como objetivo, contrato, contexto, permissões, evidências e revisão.
3. Compare a mesma solicitação vaga nas duas abordagens.
4. Mostre que o aluno não precisa digitar cada linha, mas precisa saber avaliar decisões e provas.
5. Reforce: TypeScript é a implementação de referência; o método se aplica a outras linguagens.

## Aula 61 — O problema que o MCP resolve

**Promessa:** entender o papel do MCP antes de executar qualquer ferramenta.

1. Mostre o problema de integrar cada fonte com um adaptador exclusivo no cliente.
2. Apresente MCP como uma fronteira padronizada para contexto e ferramentas.
3. Diferencie modelo, host, client e server.
4. Mostre as ferramentas locais do AgentForge e suas anotações somente leitura.
5. Antecipe o risco: padronizar acesso não elimina prompt injection nem excesso de permissão.

## Aula 64 — Construindo um MCP para o quadro local

**Promessa:** descobrir e usar contexto local sem dar acesso irrestrito ao agente.

1. Execute `npm run mcp:demo`.
2. Mostre a descoberta das ferramentas antes de chamá-las.
3. Consulte a tarefa fictícia e os arquivos permitidos.
4. Mostre o filtro estático aplicado ao cliente.
5. Finalize comprovando que Jira, GitHub e workspace não sofreram escrita.

## Aula 66 — Criando o adaptador do Jira

**Promessa:** trazer uma tarefa real para o mesmo contrato usado no modo local.

1. Execute `npm run jira:check` e explique que o check não revela o segredo.
2. Mostre a interface do adaptador e o contrato `WorkItem`.
3. Execute `npm run demo:jira` com uma tarefa fictícia preparada previamente.
4. Compare o item normalizado com a origem no Jira.
5. Mostre como campos ausentes se transformam em bloqueio, não em invenção.

## Aula 73 — Preview e aprovação humana obrigatória

**Promessa:** publicar somente a entrega que foi revisada na tela.

1. Abra o run escolhido, a evidência, o diff e a descrição preparada.
2. Execute `npm run github:check`.
3. Explique por que a publicação normal permanece bloqueada.
4. Verbalize a decisão de aprovação e só então use o comando com `--approve-external`.
5. Abra a Pull Request retornada e faça a revisão final sem realizar o merge.
