-- Somente leitura. Exportar saída antes da migração e repetir as contagens depois.
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position;
SELECT conrelid::regclass AS table_name, conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint WHERE connamespace = 'public'::regnamespace ORDER BY 1, 2;
SELECT * FROM pg_indexes WHERE schemaname = 'public';
SELECT * FROM pg_policies WHERE schemaname = 'public';
SELECT table_name, grantee, privilege_type FROM information_schema.table_privileges WHERE table_schema = 'public';
SELECT 'users' AS table_name, count(*) FROM users UNION ALL SELECT 'players', count(*) FROM players
UNION ALL SELECT 'groups', count(*) FROM groups UNION ALL SELECT 'group_players', count(*) FROM group_players
UNION ALL SELECT 'games', count(*) FROM games UNION ALL SELECT 'teams', count(*) FROM teams
UNION ALL SELECT 'game_players', count(*) FROM game_players;
SELECT game_id, player_id, count(*) FROM game_players WHERE player_id IS NOT NULL GROUP BY game_id, player_id HAVING count(*) > 1;
SELECT group_id, player_id, count(*) FROM group_players GROUP BY group_id, player_id HAVING count(*) > 1;
-- Funções/views podem expor dados mesmo após revogar acesso direto às tabelas: revisar todas.
SELECT p.oid::regprocedure, p.prosecdef, p.proacl, pg_get_functiondef(p.oid)
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.prokind = 'f';
SELECT viewname, definition FROM pg_views WHERE schemaname = 'public';
