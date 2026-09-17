import "dotenv/config";
import pg from "pg";
import { hashPassword } from "../lib/passwords.js";

if (!process.env.DATABASE_URL || process.env.ALLOW_UNTRUSTED_DB_CERT !== "true") throw new Error("Defina DATABASE_URL e ALLOW_UNTRUSTED_DB_CERT=true.");
const url = new URL(process.env.DATABASE_URL); url.searchParams.delete("sslmode");
const client = new pg.Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } });
const ids = {
  user: "10000000-0000-4000-8000-000000000001", player: "10000000-0000-4000-8000-000000000002",
  group: "10000000-0000-4000-8000-000000000003", season: "10000000-0000-4000-8000-000000000004",
  past: "10000000-0000-4000-8000-000000000005", future: "10000000-0000-4000-8000-000000000006",
  teamA: "10000000-0000-4000-8000-000000000007", teamB: "10000000-0000-4000-8000-000000000008",
  futureTeamA: "10000000-0000-4000-8000-000000000013", futureTeamB: "10000000-0000-4000-8000-000000000014",
  player2: "10000000-0000-4000-8000-000000000009", player3: "10000000-0000-4000-8000-000000000010",
  player4: "10000000-0000-4000-8000-000000000011", player5: "10000000-0000-4000-8000-000000000012",
};
const email = "demo@pbt.local";
const password = "PbtDemo2026!";
try {
  await client.connect(); await client.query("BEGIN");
  const passwordHash = await hashPassword(password);
  await client.query("INSERT INTO players(id,name,email,phone) VALUES($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,email=EXCLUDED.email,phone=EXCLUDED.phone", [ids.player,"Demo PBT","demo@pbt.local","11999990000"]);
  for (const [id,name] of [[ids.player2,"Ana Lima"],[ids.player3,"Bruno Souza"],[ids.player4,"Carla Dias"],[ids.player5,"Diego Alves"]]) await client.query("INSERT INTO players(id,name,email,phone) VALUES($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name", [id,name,`${id.slice(-2)}@pbt.local`,`1199999${id.slice(-4)}`]);
  await client.query("INSERT INTO users(id,name,email,password_hash,password_scheme,player_id) VALUES($1,$2,$3,$4,'scrypt',$5) ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name,password_hash=EXCLUDED.password_hash,password_scheme='scrypt',player_id=EXCLUDED.player_id", [ids.user,"Demo PBT",email,passwordHash,ids.player]);
  await client.query("INSERT INTO groups(id,name,user_id,timezone) VALUES($1,'Patota Demo', $2, 'America/Sao_Paulo') ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,user_id=EXCLUDED.user_id,timezone=EXCLUDED.timezone", [ids.group,ids.user]);
  await client.query("INSERT INTO seasons(id,group_id,name) VALUES($1,$2,'Demo 2026') ON CONFLICT (id) DO NOTHING", [ids.season,ids.group]);
  await client.query("UPDATE groups SET current_season_id=$1 WHERE id=$2", [ids.season,ids.group]);
  for (const player of [ids.player,ids.player2,ids.player3,ids.player4,ids.player5]) await client.query("INSERT INTO group_players(group_id,player_id,is_admin) VALUES($1,$2,$3) ON CONFLICT (group_id,player_id) DO UPDATE SET is_admin=EXCLUDED.is_admin", [ids.group,player,player===ids.player]);
  await client.query("INSERT INTO games(id,group_id,created_by,season_id,opponent,date,location,teams_count,score) VALUES($1,$2,$3,$4,'Amigos do Bairro','2026-09-13T22:00:00Z','Quadra Demo',2,'4 x 3') ON CONFLICT (id) DO NOTHING", [ids.past,ids.group,ids.user,ids.season]);
  await client.query("INSERT INTO games(id,group_id,created_by,season_id,opponent,date,location,teams_count) VALUES($1,$2,$3,$4,'Rivais da Quinta','2026-09-20T22:00:00Z','Quadra Demo',2) ON CONFLICT (id) DO NOTHING", [ids.future,ids.group,ids.user,ids.season]);
  await client.query("INSERT INTO teams(id,game_id,name,color) VALUES($1,$2,'Verde','#2e7d32'),($3,$2,'Azul','#1565c0'),($4,$5,'Verde','#2e7d32'),($6,$5,'Azul','#1565c0') ON CONFLICT (id) DO NOTHING", [ids.teamA,ids.past,ids.teamB,ids.futureTeamA,ids.future,ids.futureTeamB]);
  const rows=[[ids.player,ids.teamA,true,2,0],[ids.player2,ids.teamB,true,1,1],[ids.player3,ids.teamA,true,1,0],[ids.player4,ids.teamB,false,0,0],[ids.player5,ids.teamA,true,0,0]];
  for (const [player,team,attended,goals,own] of rows) await client.query("INSERT INTO game_players(game_id,player_id,team_id,attended,goals,own_goals) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (game_id,player_id) WHERE player_id IS NOT NULL DO UPDATE SET team_id=EXCLUDED.team_id,attended=EXCLUDED.attended,goals=EXCLUDED.goals,own_goals=EXCLUDED.own_goals", [ids.past,player,team,attended,goals,own]);
  await client.query("INSERT INTO game_players(game_id,player_id,confirmation) VALUES($1,$2,'yes'),($1,$3,'maybe'),($1,$4,'yes') ON CONFLICT (game_id,player_id) WHERE player_id IS NOT NULL DO UPDATE SET confirmation=EXCLUDED.confirmation", [ids.future,ids.player,ids.player2,ids.player3]);
  await client.query("COMMIT");
  console.log(JSON.stringify({email,password,group:"Patota Demo",futureGame:"Rivais da Quinta",pastGame:"Amigos do Bairro"}));
} catch (error) { await client.query("ROLLBACK").catch(()=>{}); console.error("Seed demo falhou:",error.code || error.message,error.detail || ""); process.exitCode=1; }
finally { await client.end(); }
