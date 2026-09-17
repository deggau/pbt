# PBT Game Registry

Registro de jogos da patota com Express, HTML/CSS/JavaScript e Supabase (PostgreSQL).

## Executar

1. Execute `npm ci`.
2. Configure `.env` conforme `.env.example`, com `DATABASE_URL` e `FRONTEND_URL`.
3. Revise e aplique a migração e a transição de contas seguindo [o guia da task 06](database/06-README.md). Não execute o SQL inicial em bancos existentes.
4. Execute `npm start` e abra `http://localhost:3000`.

O Express serve aplicação e API na mesma origem. `GET /health` é o health check. A chave anon antiga não substitui a conexão PostgreSQL usada pelo servidor.

## Funcionalidades

- Sessão verificável, vínculo explícito conta–jogador e permissões por patota.
- Próximo jogo, confirmação própria, agendamento com horário/fuso e sugestão editável.
- Presença efetiva, gols, gols contra, convidados e times em uma tela de resultados.
- Saldo de gols e participações em rankings separados por temporada.
- Temporadas criadas/renomeadas pelo administrador, sem encerramento automático por ano.
- Dados locais antigos preservados, com exportação disponível em “Conta e opções”.

## Testes

```text
npm test
npx playwright install chromium
npm run test:ui
```

Testes de banco locais usam PostgreSQL embutido (PGlite), sem acessar produção. A CI também executa a API em PostgreSQL 17 descartável. Os testes de navegador usam dados próprios e geram capturas em `test-results/`.

## Deploy gratuito

Arquitetura escolhida: **Render Free + Supabase Free**. `render.yaml` define o serviço e `.github/workflows/` contém testes e deploy com migração/backup antes da publicação. As cotas dos planos gratuitos e a suspensão por inatividade continuam aplicáveis.

Veja [database/06-README.md](database/06-README.md) para inventário, backup, credenciais, transição das contas, Secrets e ativação da pipeline. A publicação automática começa desabilitada. Não há credenciais de produção nos arquivos de configuração.

## Organização

- `server.js`, `lib/api.js`: aplicação Express e rotas.
- `lib/domain.js`: validação, horário/fuso e regras de resultado.
- `app.js`, `auth.js`, `index.html`, `styles.css`: interface.
- `migrations/`, `database/`, `scripts/`: esquema, inventário e operação do banco.
- `tasks/`: acompanhamento; mover para `tasks/completed/` apenas após cumprir os critérios da task.

O Git instalado via SourceTree pode ser chamado por `%LocalAppData%\Atlassian\SourceTree\git_local\bin\git.exe`.
