import {
  randomBytes,
  scrypt as derive,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(derive);
export const digest = (value) =>
  createHash("sha256").update(value).digest("hex");
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${(await scrypt(password, salt, 64)).toString("hex")}`;
}
export async function verifyPassword(password, user) {
  if (user?.password_scheme === "legacy_plaintext")
    return timingSafeEqual(
      Buffer.from(digest(password)),
      Buffer.from(digest(user.password_hash)),
    );
  const [, salt, key] = (
    user?.password_scheme === "scrypt" ? user.password_hash : ""
  ).split(":");
  const actual = await scrypt(password, salt || "unavailable-account", 64);
  const expected = Buffer.from(key || "", "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
