// Render hook is a secret; never print its URL or response body.
const hook = process.env.RENDER_DEPLOY_HOOK;
const sha = process.env.GITHUB_SHA;
if (!hook || !/^[a-f0-9]{40}$/.test(sha || ""))
  throw new Error("Configure RENDER_DEPLOY_HOOK e GITHUB_SHA.");
const url = new URL(hook);
if (url.protocol !== "https:" || url.hostname !== "api.render.com")
  throw new Error("Deploy hook inválido.");
url.searchParams.set("ref", sha);
try {
  const response = await fetch(url, {
    method: "POST",
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  console.log(
    "Deploy solicitado ao Render para o commit validado. Consulte o status no painel Render.",
  );
} catch {
  console.error("Falha ao solicitar deploy no Render.");
  process.exitCode = 1;
}
