-- Aplicar somente após inventário, backup verificado e revisão do esquema real.
-- Qualquer inconsistência aborta a transação; nenhum histórico é excluído.
BEGIN;
DO $$
DECLARE role_name text;
BEGIN
    IF EXISTS (SELECT 1 FROM users GROUP BY lower(email) HAVING count(*) > 1) THEN
        RAISE EXCEPTION 'Há contas com e-mails equivalentes: revisar identidade antes da migração';
    END IF;
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
            IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                WHERE n.nspname='public' AND p.prosecdef AND has_function_privilege(role_name,p.oid,'EXECUTE')) THEN
                RAISE EXCEPTION 'Revisar RPCs SECURITY DEFINER acessíveis a % antes da migração', role_name;
            END IF;
            IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                WHERE n.nspname='public' AND c.relkind IN ('v','m') AND has_table_privilege(role_name,c.oid,'SELECT')) THEN
                RAISE EXCEPTION 'Revisar views acessíveis a % antes da migração', role_name;
            END IF;
        END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM group_players GROUP BY group_id, player_id HAVING count(*) > 1) THEN
        RAISE EXCEPTION 'Há membros duplicados: reconciliar antes da migração';
    END IF;
    IF EXISTS (SELECT 1 FROM game_players WHERE player_id IS NOT NULL GROUP BY game_id, player_id HAVING count(*) > 1) THEN
        RAISE EXCEPTION 'Há jogadores duplicados por jogo: reconciliar antes da migração';
    END IF;
    IF EXISTS (SELECT 1 FROM game_players gp JOIN teams t ON t.id = gp.team_id WHERE t.game_id <> gp.game_id) THEN
        RAISE EXCEPTION 'Há times vinculados a outro jogo';
    END IF;
    IF EXISTS (SELECT 1 FROM game_players WHERE goals IS NULL OR goals < 0) THEN
        RAISE EXCEPTION 'Há gols nulos/negativos: revisar sem sobrescrever';
    END IF;
END $$;

ALTER TABLE users ADD COLUMN player_id uuid REFERENCES players(id);
CREATE UNIQUE INDEX users_player_id_unique ON users(player_id) WHERE player_id IS NOT NULL;
ALTER TABLE users ADD COLUMN password_scheme text NOT NULL DEFAULT 'legacy_pending'
    CHECK (password_scheme IN ('legacy_pending', 'legacy_plaintext', 'scrypt'));
ALTER TABLE groups ADD COLUMN timezone text NOT NULL DEFAULT 'America/Sao_Paulo';
CREATE UNIQUE INDEX group_players_membership_unique ON group_players(group_id, player_id);
CREATE INDEX IF NOT EXISTS idx_groups_user_id ON groups(user_id);

CREATE TABLE seasons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id uuid NOT NULL REFERENCES groups(id),
    name varchar(255) NOT NULL CHECK (length(trim(name)) > 0),
    closed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, group_id)
);
CREATE INDEX seasons_group_id_idx ON seasons(group_id);
ALTER TABLE groups ADD COLUMN current_season_id uuid;
INSERT INTO seasons(group_id, name) SELECT id, extract(year FROM now() AT TIME ZONE timezone)::text FROM groups;
UPDATE groups g SET current_season_id = s.id FROM seasons s WHERE s.group_id = g.id;
ALTER TABLE groups ADD CONSTRAINT groups_current_season_fk FOREIGN KEY (current_season_id, id) REFERENCES seasons(id, group_id);
CREATE INDEX groups_current_season_idx ON groups(current_season_id);
ALTER TABLE games ADD COLUMN season_id uuid;
UPDATE games g SET season_id = p.current_season_id FROM groups p WHERE p.id = g.group_id;
ALTER TABLE games ALTER COLUMN season_id SET NOT NULL;
ALTER TABLE games ADD CONSTRAINT games_season_group_fk FOREIGN KEY (season_id, group_id) REFERENCES seasons(id, group_id);
CREATE INDEX games_season_id_idx ON games(season_id);
ALTER TABLE games ADD COLUMN results_version integer NOT NULL DEFAULT 0;
ALTER TABLE games ADD COLUMN results_recorded_at timestamptz;
ALTER TABLE game_players ADD COLUMN confirmation text CHECK (confirmation IN ('yes', 'no', 'maybe'));
ALTER TABLE game_players ADD COLUMN attended boolean;
ALTER TABLE game_players ADD COLUMN own_goals integer NOT NULL DEFAULT 0 CHECK (own_goals >= 0);
ALTER TABLE game_players ALTER COLUMN goals SET NOT NULL;
ALTER TABLE game_players ADD CONSTRAINT game_players_goals_nonnegative CHECK (goals >= 0);
ALTER TABLE game_players ADD CONSTRAINT game_players_absence_goals CHECK (attended IS DISTINCT FROM false OR (goals = 0 AND own_goals = 0));
CREATE UNIQUE INDEX game_players_registered_unique ON game_players(game_id, player_id) WHERE player_id IS NOT NULL;
ALTER TABLE teams ADD CONSTRAINT teams_id_game_unique UNIQUE (id, game_id);
ALTER TABLE game_players ADD CONSTRAINT game_players_team_game_fk FOREIGN KEY (team_id, game_id) REFERENCES teams(id, game_id);
CREATE TABLE sessions (
    token_hash text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_id_idx ON sessions(user_id);
CREATE INDEX sessions_expires_at_idx ON sessions(expires_at);

-- Express é o único acesso de dados. Não reutilizar chave anon como credencial de servidor.
-- Revogar grants existentes também neutraliza políticas permissivas antigas para estes papéis.
DO $$
DECLARE tab text; role_name text; column_names text;
BEGIN
    FOREACH tab IN ARRAY ARRAY['users','players','groups','group_players','games','teams','game_players','seasons','sessions'] LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tab);
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', tab);
        SELECT string_agg(quote_ident(column_name), ',') INTO column_names
            FROM information_schema.columns WHERE table_schema='public' AND table_name=tab;
        EXECUTE format('REVOKE ALL (%s) ON TABLE public.%I FROM PUBLIC', column_names, tab);
        FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
                EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', tab, role_name);
                EXECUTE format('REVOKE ALL (%s) ON TABLE public.%I FROM %I', column_names, tab, role_name);
            END IF;
        END LOOP;
    END LOOP;
END $$;
COMMIT;
