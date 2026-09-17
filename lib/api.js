import express from "express";
import cors from "cors";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  check,
  fields,
  integer,
  label,
  timezone,
  localInstant,
  nextGame,
  resultLine,
} from "./domain.js";
import { digest, hashPassword, verifyPassword } from "./passwords.js";

export function createApp(
  db,
  {
    origin = "http://localhost:3000",
    secure = false,
    now = () => new Date(),
  } = {},
) {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin, credentials: true }));
  app.use(express.json({ limit: "256kb" }));
  const query = (sql, values = [], conn = db) => conn.query(sql, values);
  const rows = async (sql, values = [], conn = db) =>
    (await query(sql, values, conn)).rows;
  const one = async (sql, values = [], conn = db) =>
    (await rows(sql, values, conn))[0];
  const tx = async (work) => {
    const conn = await db.connect();
    try {
      await conn.query("BEGIN");
      const value = await work(conn);
      await conn.query("COMMIT");
      return value;
    } catch (error) {
      await conn.query("ROLLBACK");
      throw error;
    } finally {
      conn.release();
    }
  };
  const route = (method, path, fn) =>
    app[method](path, (req, res, next) =>
      Promise.resolve(fn(req, res))
        .then((data) => {
          if (!res.headersSent) res.json({ success: true, data });
        })
        .catch(next),
    );
  const cookie = (value, age) =>
    `pbt_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${secure ? "; Secure" : ""}`;
  const token = (req) =>
    /(?:^|;\s*)pbt_session=([a-f0-9]{64})(?:;|$)/.exec(
      req.headers.cookie || "",
    )?.[1];
  app.use("/api", (req, res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      (req.headers["x-pbt-request"] !== "1" ||
        (req.headers.origin && req.headers.origin !== origin))
    ) {
      return res
        .status(403)
        .json({ success: false, error: "Origem da requisição inválida." });
    }
    next();
  });
  const attempts = new Map();
  route("post", "/api/auth/login", async (req, res) => {
    fields(req.body, ["email", "password"]);
    const email = label(req.body.email, "E-mail").toLowerCase();
    check(
      typeof req.body.password === "string" &&
        req.body.password.length > 0 &&
        req.body.password.length <= 1024,
      "Senha inválida.",
    );
    const password = req.body.password;
    const time = now().getTime();
    for (const [key, value] of attempts)
      if (value.until <= time) attempts.delete(key);
    const key = req.ip;
    const attempt = attempts.get(key) || { count: 0, until: time + 900000 };
    check(
      attempt.count < 20 && attempts.size < 10000,
      "Muitas tentativas. Aguarde 15 minutos.",
      429,
    );
    attempt.count++;
    attempts.set(key, attempt);
    const user = await one("SELECT * FROM users WHERE lower(email) = $1", [
      email,
    ]);
    check(
      await verifyPassword(password, user),
      "Credenciais inválidas ou conta aguardando revisão de acesso.",
      401,
    );
    const session = randomBytes(32).toString("hex");
    await tx(async (conn) => {
      if (user.password_scheme === "legacy_plaintext")
        await query(
          "UPDATE users SET password_hash=$1,password_scheme='scrypt' WHERE id=$2 AND password_scheme='legacy_plaintext'",
          [await hashPassword(password), user.id],
          conn,
        );
      await query("DELETE FROM sessions WHERE expires_at <= $1", [now()], conn);
      await query(
        "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)",
        [digest(session), user.id, new Date(time + 43200000)],
        conn,
      );
    });
    attempts.delete(key);
    res.setHeader("Set-Cookie", cookie(session, 43200));
    return { id: user.id, name: user.name, player_id: user.player_id };
  });
  app.use("/api", (req, res, next) => {
    const session = token(req);
    if (!session)
      return res
        .status(401)
        .json({ success: false, error: "Faça login para continuar." });
    one(
      "SELECT u.id,u.name,u.player_id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>$2",
      [digest(session), now()],
    )
      .then((user) => {
        check(user, "Sessão expirada. Faça login novamente.", 401);
        req.user = user;
        next();
      })
      .catch(next);
  });
  route("get", "/api/auth/me", (req) => req.user);
  route("post", "/api/auth/logout", async (req, res) => {
    await query("DELETE FROM sessions WHERE token_hash=$1", [
      digest(token(req)),
    ]);
    res.setHeader("Set-Cookie", cookie("", 0));
    return null;
  });
  const membership = async (
    req,
    id,
    admin = false,
    conn = db,
    lock = false,
  ) => {
    const group = await one(
      `SELECT g.*, (g.user_id=$2 OR EXISTS(SELECT 1 FROM group_players p WHERE p.group_id=g.id AND p.player_id=$3 AND p.is_admin=true)) AS is_admin
            FROM groups g WHERE g.id=$1 AND (g.user_id=$2 OR EXISTS(SELECT 1 FROM group_players p WHERE p.group_id=g.id AND p.player_id=$3)) ${lock ? "FOR UPDATE OF g" : ""}`,
      [id, req.user.id, req.user.player_id],
      conn,
    );
    check(
      group && (!admin || group.is_admin),
      "Acesso não permitido a esta patota.",
      403,
    );
    return group;
  };
  const gameAccess = async (
    req,
    id,
    admin = false,
    conn = db,
    lock = false,
  ) => {
    const game = await one(
      `SELECT * FROM games WHERE id=$1 ${lock ? "FOR UPDATE" : ""}`,
      [id],
      conn,
    );
    check(game, "Jogo não encontrado.", 404);
    game.group = await membership(req, game.group_id, admin, conn);
    return game;
  };
  const memberPlayer = async (group_id, player_id, conn = db) =>
    check(
      await one(
        "SELECT id FROM group_players WHERE group_id=$1 AND player_id=$2",
        [group_id, player_id],
        conn,
      ),
      "Jogador não pertence à patota.",
    );
  const teamInGame = async (game_id, team_id, conn = db) => {
    if (team_id)
      check(
        await one(
          "SELECT id FROM teams WHERE id=$1 AND game_id=$2",
          [team_id, game_id],
          conn,
        ),
        "Time não pertence ao jogo.",
      );
  };
  route("get", "/api/groups", (req) =>
    rows(
      `SELECT g.*, (g.user_id=$1 OR EXISTS(SELECT 1 FROM group_players p WHERE p.group_id=g.id AND p.player_id=$2 AND p.is_admin=true)) AS is_admin
        FROM groups g WHERE g.user_id=$1 OR EXISTS(SELECT 1 FROM group_players p WHERE p.group_id=g.id AND p.player_id=$2) ORDER BY g.name`,
      [req.user.id, req.user.player_id],
    ),
  );
  route("post", "/api/groups", (req) =>
    tx(async (conn) => {
      fields(req.body, ["name", "timezone"]);
      const zone = timezone(req.body.timezone || "America/Sao_Paulo");
      const group = await one(
        "INSERT INTO groups(name,user_id,timezone) VALUES($1,$2,$3) RETURNING *",
        [label(req.body.name, "Nome"), req.user.id, zone],
        conn,
      );
      const season = await one(
        "INSERT INTO seasons(group_id,name) VALUES($1,$2) RETURNING id",
        [
          group.id,
          new Intl.DateTimeFormat("en", {
            timeZone: zone,
            year: "numeric",
          }).format(now()),
        ],
        conn,
      );
      await query(
        "UPDATE groups SET current_season_id=$1 WHERE id=$2",
        [season.id, group.id],
        conn,
      );
      if (req.user.player_id)
        await query(
          "INSERT INTO group_players(group_id,player_id,is_admin) VALUES($1,$2,true)",
          [group.id, req.user.player_id],
          conn,
        );
      return { ...group, current_season_id: season.id, is_admin: true };
    }),
  );
  route("get", "/api/groups/:id", async (req) => {
    const group = await membership(req, req.params.id);
    return {
      ...group,
      group_players: await rows(
        "SELECT gp.*,p.name,p.email,p.phone FROM group_players gp JOIN players p ON p.id=gp.player_id WHERE gp.group_id=$1 ORDER BY p.name",
        [group.id],
      ),
    };
  });
  route("get", "/api/groups/:id/seasons", async (req) => {
    await membership(req, req.params.id);
    return rows(
      "SELECT * FROM seasons WHERE group_id=$1 ORDER BY created_at DESC,id",
      [req.params.id],
    );
  });
  route("post", "/api/groups/:id/seasons", (req) =>
    tx(async (conn) => {
      fields(req.body, ["name"]);
      await membership(req, req.params.id, true, conn, true);
      return one(
        "INSERT INTO seasons(group_id,name) VALUES($1,$2) RETURNING *",
        [req.params.id, label(req.body.name, "Nome")],
        conn,
      );
    }),
  );
  route("put", "/api/seasons/:id", (req) =>
    tx(async (conn) => {
      fields(req.body, ["name"]);
      const season = await one(
        "SELECT * FROM seasons WHERE id=$1",
        [req.params.id],
        conn,
      );
      check(season, "Temporada não encontrada.", 404);
      await membership(req, season.group_id, true, conn);
      return one(
        "UPDATE seasons SET name=$1 WHERE id=$2 RETURNING *",
        [label(req.body.name, "Nome"), season.id],
        conn,
      );
    }),
  );
  route("post", "/api/groups/:id/current-season", (req) =>
    tx(async (conn) => {
      fields(req.body, ["season_id", "close_current"]);
      check(
        typeof req.body.close_current === "boolean",
        "Informe se deseja encerrar a temporada atual.",
      );
      const group = await membership(req, req.params.id, true, conn, true);
      const season = await one(
        "SELECT * FROM seasons WHERE id=$1 AND group_id=$2 AND closed_at IS NULL",
        [req.body.season_id, group.id],
        conn,
      );
      check(season, "Escolha uma temporada aberta desta patota.");
      check(
        season.id !== group.current_season_id,
        "Esta já é a temporada atual.",
      );
      if (req.body.close_current)
        await query(
          "UPDATE seasons SET closed_at=$1 WHERE id=$2",
          [now(), group.current_season_id],
          conn,
        );
      return one(
        "UPDATE groups SET current_season_id=$1 WHERE id=$2 RETURNING *",
        [season.id, group.id],
        conn,
      );
    }),
  );
  route("get", "/api/groups/:id/suggestion", async (req) => {
    const group = await membership(req, req.params.id);
    return nextGame(
      await one(
        "SELECT date,location FROM games WHERE group_id=$1 ORDER BY date DESC LIMIT 1",
        [group.id],
      ),
      group.timezone,
      now(),
    );
  });
  route("get", "/api/groups/:id/stats", async (req) => {
    await membership(req, req.params.id);
    check(
      await one("SELECT id FROM seasons WHERE id=$1 AND group_id=$2", [
        req.query.season_id,
        req.params.id,
      ]),
      "Temporada inválida.",
    );
    const data = await rows(
      `SELECT p.id,p.name,COALESCE(sum(gp.goals),0)::int AS goals,COALESCE(sum(gp.own_goals),0)::int AS own_goals,
            COALESCE(sum(gp.goals-gp.own_goals),0)::int AS balance,count(gp.id)::int AS appearances
            FROM players p JOIN game_players gp ON gp.player_id=p.id JOIN games g ON g.id=gp.game_id
            WHERE g.group_id=$1 AND g.season_id=$2 AND g.date<=$3 AND gp.attended=true GROUP BY p.id,p.name ORDER BY balance DESC,p.name`,
      [req.params.id, req.query.season_id, now()],
    );
    const unknown = await one(
      "SELECT count(*)::int AS count FROM game_players gp JOIN games g ON g.id=gp.game_id WHERE g.group_id=$1 AND g.season_id=$2 AND g.date<=$3 AND gp.attended IS NULL",
      [req.params.id, req.query.season_id, now()],
    );
    return {
      goals: data,
      attendance: [...data].sort(
        (a, b) => b.appearances - a.appearances || a.name.localeCompare(b.name),
      ),
      unreviewed: unknown.count,
    };
  });
  route("get", "/api/games", async (req) => {
    await membership(req, req.query.group_id);
    return rows(
      "SELECT * FROM games WHERE group_id=$1 AND ($2::uuid IS NULL OR season_id=$2) ORDER BY date DESC",
      [req.query.group_id, req.query.season_id || null],
    );
  });
  route("get", "/api/games/:id", async (req) => {
    const game = await gameAccess(req, req.params.id);
    return {
      ...game,
      players: await rows(
        "SELECT gp.*,p.name FROM game_players gp LEFT JOIN players p ON p.id=gp.player_id WHERE gp.game_id=$1 ORDER BY p.name,gp.invited_player_name",
        [game.id],
      ),
      teams: await rows("SELECT * FROM teams WHERE game_id=$1 ORDER BY name", [
        game.id,
      ]),
    };
  });
  route("post", "/api/games", (req) =>
    tx(async (conn) => {
      fields(req.body, [
        "group_id",
        "opponent",
        "local_date",
        "location",
        "teams_count",
      ]);
      const group = await membership(req, req.body.group_id, true, conn, true);
      const count = integer(req.body.teams_count, "Times", 2, 10);
      const game = await one(
        "INSERT INTO games(group_id,created_by,season_id,opponent,date,location,teams_count) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
        [
          group.id,
          req.user.id,
          group.current_season_id,
          label(req.body.opponent, "Adversário"),
          localInstant(req.body.local_date, group.timezone),
          label(req.body.location, "Local"),
          count,
        ],
        conn,
      );
      for (let index = 1; index <= count; index++)
        await query(
          "INSERT INTO teams(game_id,name,color) VALUES($1,$2,$3)",
          [game.id, `Time ${index}`, index % 2 ? "#2e7d32" : "#1565c0"],
          conn,
        );
      return game;
    }),
  );
  route("put", "/api/games/:id", (req) =>
    tx(async (conn) => {
      fields(req.body, ["opponent", "local_date", "location"]);
      const game = await gameAccess(req, req.params.id, true, conn, true);
      const date = localInstant(req.body.local_date, game.group.timezone);
      const recorded = await one(
        "SELECT id FROM game_players WHERE game_id=$1 AND (attended IS NOT NULL OR goals>0 OR own_goals>0) LIMIT 1",
        [game.id],
        conn,
      );
      check(
        !recorded || new Date(date) <= now(),
        "Jogo com resultados não pode ser movido para o futuro.",
      );
      return one(
        "UPDATE games SET opponent=$1,date=$2,location=$3,updated_at=$4 WHERE id=$5 RETURNING *",
        [
          label(req.body.opponent, "Adversário"),
          date,
          label(req.body.location, "Local"),
          now(),
          game.id,
        ],
        conn,
      );
    }),
  );
  route("delete", "/api/games/:id", (req) =>
    tx(async (conn) => {
      const game = await gameAccess(req, req.params.id, true, conn, true);
      await query("DELETE FROM game_players WHERE game_id=$1", [game.id], conn);
      await query("DELETE FROM teams WHERE game_id=$1", [game.id], conn);
      await query("DELETE FROM games WHERE id=$1", [game.id], conn);
      return null;
    }),
  );
  route("put", "/api/games/:id/confirmation", (req) =>
    tx(async (conn) => {
      fields(req.body, ["player_id", "confirmation"]);
      check(
        ["yes", "no", "maybe"].includes(req.body.confirmation),
        "Confirmação inválida.",
      );
      const game = await gameAccess(req, req.params.id, false, conn, true);
      check(
        new Date(game.date) > now(),
        "Confirmação disponível apenas para jogos futuros.",
      );
      const player_id = req.body.player_id || req.user.player_id;
      check(
        player_id && (game.group.is_admin || player_id === req.user.player_id),
        "Você só pode alterar sua própria confirmação.",
        403,
      );
      await memberPlayer(game.group_id, player_id, conn);
      return one(
        `INSERT INTO game_players(game_id,player_id,confirmation) VALUES($1,$2,$3)
            ON CONFLICT (game_id,player_id) WHERE player_id IS NOT NULL DO UPDATE SET confirmation=EXCLUDED.confirmation RETURNING *`,
        [game.id, player_id, req.body.confirmation],
        conn,
      );
    }),
  );
  route("put", "/api/games/:id/results", (req) =>
    tx(async (conn) => {
      fields(req.body, ["version", "players", "score"]);
      integer(req.body.version, "Versão");
      check(
        Array.isArray(req.body.players) && req.body.players.length <= 500,
        "Lista de jogadores inválida.",
      );
      const game = await gameAccess(req, req.params.id, true, conn, true);
      check(
        new Date(game.date) <= now(),
        "Resultados somente para partidas realizadas.",
      );
      check(
        game.results_version === req.body.version,
        "Os resultados foram alterados. Recarregue antes de salvar.",
        409,
      );
      const existing = await rows(
        "SELECT * FROM game_players WHERE game_id=$1",
        [game.id],
        conn,
      );
      const ids = new Set();
      const players = new Set();
      for (const row of req.body.players) {
        resultLine(row);
        if (row.id) {
          check(!ids.has(row.id), "Linha duplicada.");
          ids.add(row.id);
          const old = existing.find((item) => item.id === row.id);
          check(
            old &&
              (row.player_id || null) === old.player_id &&
              (row.invited_player_name || null) === old.invited_player_name,
            "Identidade do jogador não pode ser alterada.",
          );
        } else {
          check(
            Boolean(row.player_id) !== Boolean(row.invited_player_name),
            "Informe jogador ou convidado.",
          );
          if (row.player_id)
            await memberPlayer(game.group_id, row.player_id, conn);
          else label(row.invited_player_name, "Convidado");
        }
        if (row.player_id) {
          check(!players.has(row.player_id), "Jogador duplicado.");
          players.add(row.player_id);
        }
        await teamInGame(game.id, row.team_id, conn);
        if (row.id)
          await query(
            "UPDATE game_players SET attended=$1,goals=$2,own_goals=$3,team_id=$4 WHERE id=$5 AND game_id=$6",
            [
              row.attended,
              row.goals,
              row.own_goals,
              row.team_id || null,
              row.id,
              game.id,
            ],
            conn,
          );
        else
          await query(
            "INSERT INTO game_players(game_id,player_id,invited_player_name,team_id,attended,goals,own_goals) VALUES($1,$2,$3,$4,$5,$6,$7)",
            [
              game.id,
              row.player_id || null,
              row.invited_player_name || null,
              row.team_id || null,
              row.attended,
              row.goals,
              row.own_goals,
            ],
            conn,
          );
      }
      check(
        existing.every((row) => ids.has(row.id)),
        "Envie todas as linhas existentes; nenhuma será descartada.",
      );
      const score =
        req.body.score == null || req.body.score === ""
          ? null
          : label(req.body.score, "Placar", 50);
      return one(
        "UPDATE games SET score=$1,results_version=results_version+1,results_recorded_at=$2,updated_at=$2 WHERE id=$3 RETURNING *",
        [score, now(), game.id],
        conn,
      );
    }),
  );
  route("get", "/api/games/:id/players", async (req) => {
    await gameAccess(req, req.params.id);
    return rows(
      "SELECT gp.*,p.name FROM game_players gp LEFT JOIN players p ON p.id=gp.player_id WHERE gp.game_id=$1",
      [req.params.id],
    );
  });
  route("get", "/api/games/:id/teams", async (req) => {
    await gameAccess(req, req.params.id);
    return rows("SELECT * FROM teams WHERE game_id=$1 ORDER BY name", [
      req.params.id,
    ]);
  });
  route("get", "/api/game_players/:id", async (req) => {
    const row = await one("SELECT * FROM game_players WHERE id=$1", [
      req.params.id,
    ]);
    check(row, "Jogador não encontrado.", 404);
    await gameAccess(req, row.game_id);
    return row;
  });
  route("post", "/api/game_players", (req) =>
    tx(async (conn) => {
      fields(req.body, [
        "game_id",
        "player_id",
        "invited_player_name",
        "team_id",
      ]);
      const game = await gameAccess(req, req.body.game_id, true, conn, true);
      check(
        new Date(game.date) > now(),
        "Para partidas passadas, use o registro de resultados.",
      );
      check(
        Boolean(req.body.player_id) !== Boolean(req.body.invited_player_name),
        "Informe jogador ou convidado.",
      );
      if (req.body.player_id)
        await memberPlayer(game.group_id, req.body.player_id, conn);
      else label(req.body.invited_player_name, "Convidado");
      await teamInGame(game.id, req.body.team_id, conn);
      return one(
        "INSERT INTO game_players(game_id,player_id,invited_player_name,team_id) VALUES($1,$2,$3,$4) RETURNING *",
        [
          game.id,
          req.body.player_id || null,
          req.body.invited_player_name || null,
          req.body.team_id || null,
        ],
        conn,
      );
    }),
  );
  for (const method of ["put", "delete"])
    route(method, "/api/game_players/:id", (req) =>
      tx(async (conn) => {
        fields(req.body || {}, method === "put" ? ["team_id"] : []);
        const row = await one(
          "SELECT * FROM game_players WHERE id=$1",
          [req.params.id],
          conn,
        );
        check(row, "Jogador não encontrado.", 404);
        const game = await gameAccess(req, row.game_id, true, conn, true);
        check(
          new Date(game.date) > now(),
          "Para partidas passadas, use o registro de resultados.",
        );
        if (method === "delete") {
          await query("DELETE FROM game_players WHERE id=$1", [row.id], conn);
          return null;
        }
        await teamInGame(game.id, req.body.team_id, conn);
        return one(
          "UPDATE game_players SET team_id=$1 WHERE id=$2 RETURNING *",
          [req.body.team_id || null, row.id],
          conn,
        );
      }),
    );
  route("post", "/api/teams", (req) =>
    tx(async (conn) => {
      fields(req.body, ["game_id", "name", "color"]);
      const game = await gameAccess(req, req.body.game_id, true, conn, true);
      const count = Number(
        (
          await one(
            "SELECT count(*) AS n FROM teams WHERE game_id=$1",
            [game.id],
            conn,
          )
        ).n,
      );
      check(count < 10, "Limite de 10 times.");
      const team = await one(
        "INSERT INTO teams(game_id,name,color) VALUES($1,$2,$3) RETURNING *",
        [
          game.id,
          label(req.body.name, "Nome"),
          label(req.body.color, "Cor", 50),
        ],
        conn,
      );
      await query(
        "UPDATE games SET teams_count=$1 WHERE id=$2",
        [Math.max(2, count + 1), game.id],
        conn,
      );
      return team;
    }),
  );
  for (const method of ["put", "delete"])
    route(method, "/api/teams/:id", (req) =>
      tx(async (conn) => {
        fields(req.body || {}, method === "put" ? ["name", "color"] : []);
        const team = await one(
          "SELECT * FROM teams WHERE id=$1",
          [req.params.id],
          conn,
        );
        check(team, "Time não encontrado.", 404);
        await gameAccess(req, team.game_id, true, conn, true);
        if (method === "put")
          return one(
            "UPDATE teams SET name=$1,color=$2 WHERE id=$3 RETURNING *",
            [
              label(req.body.name, "Nome"),
              label(req.body.color, "Cor", 50),
              team.id,
            ],
            conn,
          );
        const count = Number(
          (
            await one(
              "SELECT count(*) AS n FROM teams WHERE game_id=$1",
              [team.game_id],
              conn,
            )
          ).n,
        );
        check(count > 2, "O jogo deve manter pelo menos dois times.");
        check(
          !(await one(
            "SELECT id FROM game_players WHERE team_id=$1 LIMIT 1",
            [team.id],
            conn,
          )),
          "Há jogadores neste time. Reatribua-os antes de excluir.",
        );
        await query("DELETE FROM teams WHERE id=$1", [team.id], conn);
        await query(
          "UPDATE games SET teams_count=(SELECT count(*)::int FROM teams WHERE game_id=$1) WHERE id=$1",
          [team.game_id],
          conn,
        );
        return null;
      }),
    );
  route("get", "/api/players", async (req) => {
    await membership(req, req.query.group_id);
    return rows(
      "SELECT p.* FROM players p JOIN group_players gp ON gp.player_id=p.id WHERE gp.group_id=$1 ORDER BY p.name",
      [req.query.group_id],
    );
  });
  route("get", "/api/players/:id", async (req) => {
    const player = await one(
      `SELECT p.* FROM players p WHERE p.id=$1 AND EXISTS(SELECT 1 FROM group_players gp JOIN groups g ON g.id=gp.group_id WHERE gp.player_id=p.id AND (g.user_id=$2 OR EXISTS(SELECT 1 FROM group_players own WHERE own.group_id=g.id AND own.player_id=$3)))`,
      [req.params.id, req.user.id, req.user.player_id],
    );
    check(player, "Acesso não permitido ao jogador.", 403);
    return player;
  });
  route("post", "/api/players", (req) =>
    tx(async (conn) => {
      fields(req.body, ["group_id", "name", "email", "phone"]);
      await membership(req, req.body.group_id, true, conn, true);
      const player = await one(
        "INSERT INTO players(name,email,phone) VALUES($1,$2,$3) RETURNING *",
        [
          label(req.body.name, "Nome"),
          label(req.body.email, "E-mail"),
          label(req.body.phone, "Telefone", 20),
        ],
        conn,
      );
      await query(
        "INSERT INTO group_players(group_id,player_id) VALUES($1,$2)",
        [req.body.group_id, player.id],
        conn,
      );
      return player;
    }),
  );
  route("post", "/api/groups/:id/add-player", (req) =>
    tx(async (conn) => {
      fields(req.body, ["player_id"]);
      await membership(req, req.params.id, true, conn, true);
      check(
        await one(
          `SELECT gp.id FROM group_players gp JOIN groups g ON g.id=gp.group_id WHERE gp.player_id=$1 AND (g.user_id=$2 OR EXISTS(SELECT 1 FROM group_players own WHERE own.group_id=g.id AND own.player_id=$3 AND own.is_admin=true)) LIMIT 1`,
          [req.body.player_id, req.user.id, req.user.player_id],
          conn,
        ),
        "Jogador fora das patotas administradas.",
        403,
      );
      return one(
        "INSERT INTO group_players(group_id,player_id) VALUES($1,$2) RETURNING *",
        [req.params.id, req.body.player_id],
        conn,
      );
    }),
  );
  route("delete", "/api/groups/:id/remove-player/:playerId", (req) =>
    tx(async (conn) => {
      await membership(req, req.params.id, true, conn, true);
      check(
        req.params.playerId !== req.user.player_id,
        "Não remova seu próprio acesso por esta ação.",
      );
      await query(
        "DELETE FROM group_players WHERE group_id=$1 AND player_id=$2",
        [req.params.id, req.params.playerId],
        conn,
      );
      return null;
    }),
  );
  route("post", "/api/groups/:id/share", async (req) => {
    await membership(req, req.params.id, true);
    return {
      shareUrl: `${origin}/?group=${encodeURIComponent(req.params.id)}`,
      note: "O link não concede acesso; o jogador precisa ser membro.",
    };
  });
  app.use("/api", (req, res) =>
    res.status(404).json({ success: false, error: "Rota não encontrada." }),
  );
  app.get("/health", (req, res) =>
    res.json({ success: true, data: { status: "online" } }),
  );
  const root = fileURLToPath(new URL("../", import.meta.url));
  for (const file of [
    "index.html",
    "styles.css",
    "app.js",
    "auth.js",
    "lib/domain.js",
  ])
    app.get(file === "index.html" ? "/" : `/${file}`, (req, res) =>
      res.sendFile(file, { root }),
    );
  app.use((error, req, res, next) => {
    const conflict = ["23505", "23503", "23514"].includes(error.code);
    const status =
      error.status || (conflict ? 409 : error.code === "22P02" ? 400 : 500);
    if (status === 500)
      console.error("Database/API failure:", error.code || error.name);
    res.status(status).json({
      success: false,
      error:
        status === 500
          ? "Não foi possível concluir. Tente novamente."
          : conflict
            ? "Dados em conflito. Recarregue e revise os vínculos."
            : error.message,
    });
  });
  return app;
}
