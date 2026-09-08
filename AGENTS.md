# PBT Game Registry - guia de agentes

## Visão geral
Projeto de registro de jogos de futebol com Supabase backend e frontend HTML/CSS/JS.

## Estrutura do projeto
- **Backend**: Node.js/Express (`server.js`)
- **Frontend**: HTML/CSS/JS (`index.html`, `app.js`, `auth.js`)
- **Banco de dados**: Supabase (PostgreSQL)
- **Estilos**: `styles.css`

## Tecnologias
- Node.js com Express
- Supabase (`@supabase/supabase-js`)
- CORS, dotenv

## API Endpoints
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/` | Health check |
| GET | `/api/games` | Listar todos os jogos |
| GET | `/api/games/:id` | Detalhes do jogo com jogadores |
| POST | `/api/games` | Criar novo jogo |
| PUT | `/api/games/:id` | Atualizar jogo |
| DELETE | `/api/games/:id` | Excluir jogo |
| POST | `/api/game_players` | Adicionar jogador ao jogo |
| GET | `/api/games/:id/players` | Listar jogadores do jogo |
| DELETE | `/api/game_players/:id` | Remover jogador do jogo |
| POST | `/api/teams` | Criar time |
| GET | `/api/games/:id/teams` | Listar times do jogo |
| PUT | `/api/teams/:id` | Atualizar time |
| DELETE | `/api/teams/:id` | Excluir time |

## Banco de dados

### Tabelas principais
- **players**: Jogadores registrados (id, name, email, phone)
- **groups**: Grupos de jogadores (id, name, player_id)
- **group_players**: Relação grupo-jogador (id, group_id, player_id)
- **games**: Jogos registrados (id, group_id, created_by, opponent, date, location, score, teams_count)
- **teams**: Times por jogo (id, game_id, name, color)
- **game_players**: Jogadores nos jogos (id, game_id, player_id, team_id, invited_player_name, goals)

### Migrations
Local: `migrations/`

## Configuração
1. Copiar `.env.example` para `.env`
2. Configurar `SUPABASE_URL` e `SUPABASE_ANON_KEY`
3. Executar `npm install`
4. Iniciar com `npm start`

## Git
Git configurado para SourceTree:
```
%LocalAppData%\Atlassian\SourceTree\git_local\bin\git.exe
```

## Task Management
- Tasks em `tasks/`
- Tasks concluídas em `tasks/completed/`
- Após concluir: mover task para `completed/` com commit descritivo

## Diretrizes para código
- Seguir padrões existentes em `server.js`
- Usar try/catch com tratamento de erro do Supabase
- Responder com estrutura consistente: `{ success: true/false, data/error }`
- Manter referências entre tabelas via UUIDs
- Indexar colunas de foreign keys

## Padrões de命名
- Variáveis/colunas: `snake_case`
- Classes CSS: `kebab-case`
- Nomes de tabelas: plural (ex: `games`, `players`)
- Colunas UUID: usar `gen_random_uuid()` default
