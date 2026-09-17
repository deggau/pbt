# Task 06 — banco e publicação

Implementação local preparada para **Render Free + Supabase Free**, servindo HTML e API na mesma origem. Não é necessário Firebase nem cartão/plano Blaze para esta arquitetura. Os limites dos planos gratuitos continuam aplicáveis; o Render suspende o serviço após inatividade e o primeiro acesso pode demorar.

## Antes da primeira publicação

1. No Supabase, abra o SQL Editor e execute `database/06-inventory.sql` (somente leitura). Confira tabelas, nomes/tipos, constraints, índices, RLS, grants, funções, views, duplicidades e contagens. O esquema desta migração espera `groups.user_id`, `users`, `teams` e a migração 04 já aplicada. **Não execute `create-tables.sql` ou a migração 04 em um banco existente.**
2. Confira o significado dos registros históricos. A migração deixa `attended` e `confirmation` como `NULL` (desconhecidos), mantém gols existentes, convidados e times e cria `own_goals=0`. Todos os jogos da patota, independentemente do ano, recebem a temporada padrão. O fuso inicial é `America/Sao_Paulo`; revise-o caso alguma patota use outro fuso.
3. Revise as contas e a propriedade das patotas. `groups.user_id` conserva o administrador proprietário. `users.player_id` só pode ser vinculado após verificar a identidade; nunca pelo e-mail automaticamente. Registros duplicados ou relacionamentos inconsistentes devem ser reconciliados explicitamente antes da migração.
4. Gere e restaure um backup em um banco descartável. A pipeline gera um dump do **schema público da aplicação**, restaura em PostgreSQL descartável e guarda o dump criptografado antes de migrar. Isso não substitui backup completo de Auth, Storage, extensões e demais schemas do projeto Supabase. Dependências externas ao schema público podem exigir adaptar o teste de restauração; se ele falhar, a pipeline para antes da migração.
5. A migração bloqueia RPCs `SECURITY DEFINER` e views públicas acessíveis aos papéis `anon`/`authenticated`, exigindo revisão antes de prosseguir. Revise também grants por papéis personalizados e configurações de schemas expostos no Supabase. As tabelas da aplicação passam a ter RLS habilitada e sem grants para clientes públicos. O frontend usa somente o Express.

Nenhuma dessas etapas foi executada no Supabase remoto durante a implementação. Não habilite produção sem concluir a revisão.

## Conexão e migração

Em **Supabase → Connect**, copie a conexão PostgreSQL direta ou **Session pooler**, porta **5432** (o pooler atende redes IPv4). Não use Transaction pooler para a migração. Configure a senha com URL encoding e TLS com validação (`sslmode=verify-full`, usando o certificado fornecido pelo Supabase se necessário). Não desabilite validação de certificado.

Configure `DATABASE_URL` no `.env` local ou nos Secrets, nunca em HTML/JS público. A chave anon antiga não serve para este backend. O usuário PostgreSQL deve poder acessar as tabelas com RLS: para implantação inicial, use o acesso administrativo revisado; para runtime, prefira uma credencial dedicada com permissões apenas sobre as tabelas necessárias e capacidade de contornar RLS, pois a autorização ocorre no Express. Não exponha essa credencial no cliente.

Com acesso configurado:

```text
npm ci
npm run db:inventory
```

Após conferir/restaurar o backup, configure `SCHEMA_REVIEWED=true` e `BACKUP_VERIFIED=<referência do backup>` e execute:

```text
npm run db:migrate
```

O runner usa transação, lock de migração e ledger com checksum. Compara todos os campos preexistentes de todas as linhas das sete tabelas antigas antes/depois; divergência causa rollback. Execuções posteriores não reaplicam SQL. Não altere uma migração já aplicada: crie outra e acrescente-a ao runner. O arquivo SQL pode ser revisado no editor, mas a aplicação deve ocorrer pelo runner para registrar o ledger.

## Transição das contas sem trocar IDs

Contas antigas começam com `password_scheme=legacy_pending`; a senha antiga é preservada até ser revisada. O diagnóstico local indica senha em texto no campo `password_hash`, mas o banco real precisa confirmar isso. Para cada conta cuja identidade e formato da senha forem conferidos:

```text
npm run db:account -- --user UUID_DA_CONTA --player UUID_DO_JOGADOR --approve-legacy-plaintext --identity-reviewed
```

O comando transforma a senha existente em scrypt, preserva a senha de login e o ID da conta, vincula o jogador informado e revoga sessões antigas. Omita `--player` para administradores que não jogam; omita `--approve-legacy-plaintext` ao vincular uma conta já convertida. Um vínculo já existente com outro jogador não é sobrescrito. Não marque hashes bcrypt/argon2 como texto: esses casos exigem uma transição específica após inventário. Não há endpoint público para reivindicar identidades.

Faça esta revisão na janela de manutenção da primeira publicação. Enquanto pendente, a conta não consegue entrar. O backend antigo deve ser retirado nessa janela: manter uma versão sem autorização acessível anularia a proteção desta atualização.

## Render Free

1. Conecte o repositório GitHub ao Render e crie o serviço usando `render.yaml` (plano **free**).
2. Configure `DATABASE_URL` e `FRONTEND_URL=https://NOME.onrender.com` (sem barra final). Mantenha `NODE_ENV=production` para o cookie Secure.
3. Deixe **Auto-Deploy Off**. A pipeline deve aplicar a migração antes de solicitar a publicação do mesmo commit.
4. Copie o **Deploy Hook** das configurações do serviço para um Secret do GitHub. Ele permite publicar: trate como senha.
5. O início do serviço não aplica migrações. `/health` indica que o processo está ativo; valide login e dados após a publicação.

## GitHub Actions

`ci.yml` roda testes em PostgreSQL 17 descartável e Chromium. `deploy.yml` roda novamente os testes, faz backup/restauração, migra e solicita deploy via hook apontando para `GITHUB_SHA`. A execução do hook inicia uma publicação assíncrona: confira a conclusão no Render antes de considerar o deploy concluído.

Crie o environment **production**. Configure seus Secrets:

| Secret | Conteúdo |
|---|---|
| `DATABASE_URL` | Conexão administrativa Supabase para migrações |
| `BACKUP_PASSPHRASE` | Senha forte independente para criptografar os backups |
| `RENDER_DEPLOY_HOOK` | URL secreta do deploy hook Render |

Configure as variáveis:

| Variável | Onde | Quando definir |
|---|---|---|
| `PRODUCTION_DEPLOY_ENABLED=true` | Repositório | Após revisar o código, o esquema real e preparar o serviço |
| `SCHEMA_REVIEWED=true` | Environment production | Após concluir o inventário e a revisão da primeira migração |

O deploy automático usa `main`; também há execução manual, restrita à mesma branch. PRs não recebem credenciais de produção. Não houve commit/push nem criação de Secrets ou serviços nesta implementação.

Os backups criptografados ficam em artifacts por **7 dias**, sujeitos às cotas do GitHub. Baixe e guarde as cópias necessárias em armazenamento privado antes de expirarem. Guarde a senha separadamente. Nunca publique o dump sem criptografia nem sua senha; o `.env.example` foi substituído por placeholders.

Restauração em caso de falha: baixe o artifact, descriptografe localmente com GPG, restaure **primeiro em banco isolado** com `pg_restore` e confira contagens/vínculos. Só depois decida a recuperação de produção em janela de manutenção. Não há rollback destrutivo automático. Se o deploy do app falhar após a migração, corrija/republique; não volte ao backend antigo sem autenticação.

## Desenvolvimento e evidências

```text
npm test
npx playwright install chromium
npm run test:ui
npm start
```

Os testes locais usam PGlite (PostgreSQL embutido), sem dados remotos; na CI, a suíte HTTP também usa PostgreSQL 17 real. A suíte do navegador cria dados descartáveis e verifica login pelo teclado, mobile, confirmação, quarta bola/repetição, zero, gols acima de cinco, ausência incompatível e falha de rede. Screenshots ficam em `test-results/` (ignorado pelo Git).

Contas e dados de demonstração existem somente nos testes. `example-data.js` não é carregado na aplicação. Os valores antigos em localStorage permanecem intactos e podem ser exportados em **Conta e opções → Exportar dados locais antigos**; não são importados automaticamente.

Referências consultadas: [Render Free](https://render.com/docs/free), [Render Deploy Hooks](https://render.com/docs/deploy-hooks), [Supabase: conexões](https://supabase.com/docs/guides/database/connecting-to-postgres), [GitHub: deployments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments).
