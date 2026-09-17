import { GameRegistry } from "./app.js";

export async function api(path, method = "GET", body) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      signal: AbortSignal.timeout(30000),
      headers: { "Content-Type": "application/json", "X-PBT-Request": "1" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new Error("Falha de rede. Verifique sua conexão e tente novamente.");
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("Servidor indisponível. Tente novamente.");
  }
  if (!response.ok || !result.success)
    throw new Error(result.error || "Não foi possível concluir.");
  return result.data;
}
async function start(user) {
  document.getElementById("authContainer").classList.add("hidden");
  document.getElementById("appContainer").classList.remove("hidden");
  document.body.classList.remove("auth-mode");
  window.gameRegistry = new GameRegistry(user, api);
  await window.gameRegistry.init();
}
document
  .getElementById("loginForm")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = document.getElementById("loginBtn");
    button.disabled = true;
    document.getElementById("loginStatus").textContent = "Entrando…";
    try {
      const user = await api("/auth/login", "POST", {
        email: document.getElementById("email").value,
        password: document.getElementById("password").value,
      });
      document.getElementById("password").value = "";
      await start(user);
      document.getElementById("loginStatus").textContent = "";
    } catch (error) {
      document.getElementById("loginStatus").textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
try {
  await start(await api("/auth/me"));
} catch {
  /* Login remains available. */
}
