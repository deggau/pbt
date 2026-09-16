# Presença, resultados e experiência mobile

Status: revisão inicial realizada; implementação e validação pendentes.

## Objetivo

Evoluir o registro da patota preservando jogadores, grupos, jogos, times e resultados existentes. Aproveitar Express, Supabase e HTML/CSS/JavaScript, sem introduzir um framework como requisito.

## Diagnóstico do código local — 16/09/2026

- Backend Express em `server.js`, banco Supabase acessado com `@supabase/supabase-js`.
- Há rotas para grupos, jogadores, jogos e times, mas todas as rotas de dados estão sem autenticação/autorização.
- O login consulta `users` comparando a senha recebida diretamente com `password_hash`; não emite sessão/token. O frontend guarda apenas o ID do usuário, insuficiente para autorizar operações.
- `group_players.is_admin` já aparece no SQL e pode servir de base para permissões por grupo.
- Falta um vínculo explícito entre a conta de login e o registro de jogador. Não usar IDs informados pelo navegador nem correspondência automática de e-mail como prova de identidade.
- O frontend mistura API e localStorage; dados demonstrativos são carregados em `example-data.js`. Dados locais não devem ser apagados nem importados automaticamente como se fossem registros reais.
- `GameRegistry` não é inicializado pelo fluxo de login com `init()` nem atribuído a `window.gameRegistry`; existem dois handlers para o mesmo formulário de jogo e um deles referencia campos ausentes.
- A listagem de grupos procura o ID do usuário entre IDs de grupos. O backend lista grupos de todos os usuários.
- O formulário de jogo não coleta horário. O backend ignora `teams_count` recebido na criação.
- Consultas têm seleções de relacionamentos inconsistentes, como `created_by_users:name` e `players:name`, além de aliases repetidos.
- Criação de times usa `supabase.raw`, que precisa ser substituído por uma operação de banco apropriada; exclusão consulta o time depois de excluí-lo. Atribuição de times está incompleta.
- Há rotas de jogadores duplicadas. Updates aceitam indiscriminadamente propriedades do corpo da requisição.
- Não há campos específicos para confirmação de presença, presença efetiva ou gols contra, nem regra implementada de pontuação da patota.
- O SQL inicial referencia `users` antes da criação e indexa `groups.player_id`, enquanto a tabela declarada contém `user_id`. Confirmar o esquema real antes de preparar/aplicar migrações.
- `npm test` é um placeholder que retorna erro.
- Existem alterações locais prévias em `app.js`, `index.html` e `styles.css`; preservá-las durante a implementação.

Este diagnóstico é do repositório. Nenhuma consulta ao banco remoto, migração ou alteração dos dados foi realizada.

## Ordem de execução

### 1. Conferir o banco e estabelecer identidade/permissões

- Inventariar tabelas, constraints, índices e políticas RLS reais e garantir backup antes da migração.
- Definir sessão autenticada verificável no servidor e vínculo conta–jogador, com transição que preserve as contas existentes.
- Restringir leitura aos grupos dos quais a pessoa participa; resolver administrador pelo grupo no servidor.
- Jogador altera somente a própria confirmação de presença em jogo futuro.
- Administrador cadastra/edita jogos e confirma presença de outros membros do grupo; registra presença efetiva e resultados passados.
- Validar também as rotas antigas, relacionamentos entre jogo/time/jogador, listas de campos permitidos e acesso direto ao Supabase. Esconder botões não substitui autorização.

### 2. Evoluir o esquema sem apagar históricos

- Separar confirmação para o próximo jogo de presença efetiva no resultado.
- Acrescentar gols contra com valor inicial zero e validação de inteiro não negativo.
- Não interpretar automaticamente todo registro histórico de jogador como presença confirmada/efetiva sem verificar o significado dos dados antigos.
- Verificar duplicidades antes de adicionar unicidade de jogador por jogo; não excluí-las silenciosamente.
- Preservar convidados e vínculos com times.
- Salvar o conjunto de resultados de uma partida em transação, evitando resultados parcialmente gravados.

### 3. Agendamento

- Buscar o último jogo da patota selecionada como referência de local, dia da semana e horário.
- Sugerir a próxima ocorrência futura desse dia/horário; se a referência estiver antiga, avançar até uma data futura.
- Exibir e editar a sugestão antes de salvar. Sem referência, solicitar data, horário e local.
- Tornar explícito o fuso da patota e armazenar o instante consistentemente, evitando mudanças de dia na conversão para UTC.

### 4. Registro rápido de partidas passadas

- Uma tela com todos os jogadores, presença efetiva, gols e gols contra.
- A quarta bola define exatamente quatro gols; repetir o clique mantém quatro.
- Oferecer zero e entrada numérica para valores maiores; validar inteiros não negativos no cliente e no servidor.
- Impedir resultados incompatíveis com ausência sem descartar gols já registrados silenciosamente.
- Manter gols contra separados e aplicar desconto de um ponto por gol contra na somatória.
- Mostrar saldo de gols e ranking de participações como indicadores separados, conforme as regras abaixo.

### 5. Interface mobile

- Destacar próximo jogo, data, horário, local e ação para confirmar presença.
- Oferecer acesso direto a histórico e estatísticas, com ações administrativas condicionadas às permissões.
- Evitar depender de arrastar e soltar para operar no celular.
- Prever estados vazios, carregamento, falha de rede e salvamento em andamento; não anunciar sucesso se a API falhar.
- Preservar dados locais antigos para eventual exportação/reconciliação, usando o banco como fonte dos novos registros.

### 6. Validação

- Negar requisições sem sessão, de outro grupo e de jogador tentando alterar terceiros, jogos ou resultados.
- Validar administrador em seu grupo e negar alteração de IDs/vínculos para contornar permissões.
- Conferir primeira partida, referência antiga, virada de mês/ano e horário/fuso na sugestão.
- Conferir zero, quarta bola, repetição de clique, mais de cinco gols e gols contra.
- Conferir rollback de resultado quando uma linha falhar, reenvio e edições concorrentes.
- Conferir totais após edição, separação de gols contra e exclusão de partidas futuras das estatísticas de resultados.
- Testar login, próximo jogo, presença e resultados em tela pequena e por teclado.
- Conferir preservação de contagens e dados históricos antes/depois da migração.

## Regras da temporada confirmadas

- Gols: cada gol feito soma 1 e cada gol contra soma -1. Saldo = gols feitos menos gols contra, podendo ser negativo. Manter os valores brutos separados para conferência.
- Assiduidade: ranking separado pelo número de participações. Cada presença efetiva em uma partida realizada conta uma vez, independentemente dos gols.
- Confirmação de presença em partida futura não conta como participação realizada.
- Não somar participações ao saldo de gols nem atribuir pontos por vitórias.
- Aplicar a mesma temporada aos dois indicadores. A temporada é definida pelo usuário, sem vínculo obrigatório com o ano calendário e sem encerramento automático na virada do ano.
- Criar automaticamente uma temporada padrão para a patota, com o ano atual como descrição sugerida (por exemplo, 2026). O ano é apenas o nome inicial, não um filtro por datas.
- Manter a temporada como informação acessória: o fluxo normal de cadastro de jogos e acompanhamento já usa a temporada atual, sem exigir configuração adicional.
- Oferecer um botão “+” discreto para criar uma nova temporada, com nome sugerido editável; permitir também renomear uma temporada existente.
- O usuário decide quando finalizar a temporada atual e iniciar a próxima. A criação de uma temporada não deve encerrar outra silenciosamente.
- Vincular jogos explicitamente à temporada, mantendo os históricos e seus indicadores consultáveis após o encerramento. Renomear ou mudar de temporada não deve transferir jogos antigos automaticamente.
- Na migração, preservar todos os jogos existentes e definir sua vinculação à temporada padrão de forma explícita, sem descartá-los ou separá-los automaticamente pelo ano da data.
- Exemplo de validação: 4 gols feitos, 1 gol contra e 3 presenças efetivas resultam em saldo de 3 gols e 3 participações, em indicadores separados.

## Critério de conclusão

Implementação, migração revisada e validações concluídas com evidências. Somente então mover esta task para `tasks/completed/` e criar commit descritivo, sem incluir alterações prévias alheias à tarefa.


