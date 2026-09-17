// Operação administrativa local: identidade revisada explicitamente, nunca por e-mail.
import "dotenv/config";
import pg from "pg";
import { hashPassword } from "../lib/passwords.js";
const args = process.argv.slice(2);
const value = (key) => args[args.indexOf(key) + 1];
const user_id = args.includes("--user") ? value("--user") : null;
const player_id = args.includes("--player") ? value("--player") : null;
if (
  !process.env.DATABASE_URL ||
  !user_id ||
  !args.includes("--identity-reviewed")
)
  throw new Error(
    "Uso: npm run db:account -- --user UUID [--player UUID] [--approve-legacy-plaintext] --identity-reviewed",
  );
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  await client.query("BEGIN");
  const user = (
    await client.query("SELECT * FROM users WHERE id=$1 FOR UPDATE", [user_id])
  ).rows[0];
  if (!user) throw new Error("Conta não encontrada.");
  if (player_id) {
    if (user.player_id && user.player_id !== player_id)
      throw new Error(
        "Conta já vinculada a outro jogador; revisão manual necessária.",
      );
    await client.query("UPDATE users SET player_id=$1 WHERE id=$2", [
      player_id,
      user_id,
    ]);
  }
  if (args.includes("--approve-legacy-plaintext")) {
    if (!["legacy_pending", "legacy_plaintext"].includes(user.password_scheme))
      throw new Error("Conta já usa hash; não reinterpretar como texto.");
    await client.query(
      "UPDATE users SET password_hash=$1,password_scheme='scrypt' WHERE id=$2",
      [await hashPassword(user.password_hash), user_id],
    );
  }
  await client.query("DELETE FROM sessions WHERE user_id=$1", [user_id]);
  await client.query("COMMIT");
  console.log(
    "Conta revisada; vínculo/senha atualizados e sessões antigas revogadas.",
  );
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("Revisão interrompida:", error.code || error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
