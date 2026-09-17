import { fixture } from "./fixture.js";
import { createApp } from "../lib/api.js";
const db = await fixture();
const server = createApp(db, {
  origin: "http://127.0.0.1:3106",
  now: () => new Date("2026-09-16T12:00:00Z"),
}).listen(3106, "127.0.0.1");
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.close(() => db.close()));
