// sheets.js
// Camada que conversa com o Google Apps Script (que por sua vez lê/escreve o Google Sheets).

const SESSION_STORAGE_KEY = "maquinas_session";

function getSavedSession() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session.token || Date.now() > session.expiresAt) return null;
    return session;
  } catch (e) {
    return null;
  }
}

function saveSession(session) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

function jsonpRequest(params) {
  return new Promise((resolve, reject) => {
    const callbackName = "jsonpCallback_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
    const script = document.createElement("script");

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Tempo esgotado."));
    }, 15000);

    function cleanup() {
      clearTimeout(timeout);
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[callbackName] = (data) => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Falha na requisição."));
    };

    const query = Object.keys(params)
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
      .join("&");
    script.src = `${CONFIG.API_URL}?${query}&callback=${callbackName}`;
    document.body.appendChild(script);
  });
}

function requestLoginCode(email) {
  return jsonpRequest({ action: "request-code", email });
}

function verifyLoginCode(email, code) {
  return jsonpRequest({ action: "verify-code", email, code });
}

function checkSessionValid(token) {
  return jsonpRequest({ action: "check-session", token }).then((r) => r.valid);
}

function fetchMachinesFromSheet() {
  const session = getSavedSession();
  return jsonpRequest({ action: "list", token: session ? session.token : "" }).then((data) => data.machines || []);
}

async function createMachineInSheet(payload) {
  const session = getSavedSession();
  // Apps Script Web Apps respondem via um redirect interno do Google que o
  // navegador bloqueia por CORS ao tentar LER a resposta de um POST.
  // Solução: enviar em modo "no-cors" (o envio funciona normalmente,
  // só não conseguimos ler o retorno) e depois recarregar a lista
  // direto da planilha, que já sabemos que funciona via GET.
  await fetch(CONFIG.API_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "create", token: session ? session.token : "", ...payload }),
  });

  // dá um tempo pro Apps Script terminar de gravar (planilha + upload da foto no Drive)
  await new Promise((resolve) => setTimeout(resolve, 1500));
  return { success: true };
}

async function updateMachineInSheet(payload) {
  const session = getSavedSession();
  await fetch(CONFIG.API_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "update", token: session ? session.token : "", ...payload }),
  });
  await new Promise((resolve) => setTimeout(resolve, 1500));
  return { success: true };
}

async function createTicket(payload) {
  await fetch(CONFIG.API_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "create-ticket", ...payload }),
  });
  await new Promise((resolve) => setTimeout(resolve, 1200));
  return { success: true };
}

function fetchTickets(machineId) {
  return jsonpRequest({ action: "list-tickets", machineId: machineId || "" }).then(
    (data) => data.tickets || []
  );
}

function checkinUrlFor(machineId) {
  return `${CONFIG.API_URL}?action=checkin&id=${encodeURIComponent(machineId)}`;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]); // remove o prefixo data:...;base64,
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
