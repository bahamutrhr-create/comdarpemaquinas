// sheets.js
// Camada que conversa com o Google Apps Script (que por sua vez lê/escreve o Google Sheets).

function fetchMachinesFromSheet() {
  // JSONP: carrega os dados via uma tag <script>, que não sofre bloqueio de CORS
  // (diferente de fetch/XHR). É a forma padrão de contornar isso com Apps Script.
  return new Promise((resolve, reject) => {
    const callbackName = "sheetsCallback_" + Date.now();
    const script = document.createElement("script");

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Tempo esgotado ao buscar dados da planilha."));
    }, 15000);

    function cleanup() {
      clearTimeout(timeout);
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[callbackName] = (data) => {
      cleanup();
      resolve(data.machines || []);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Falha ao buscar dados da planilha."));
    };

    script.src = `${CONFIG.API_URL}?action=list&callback=${callbackName}`;
    document.body.appendChild(script);
  });
}

async function createMachineInSheet(payload) {
  // Apps Script Web Apps respondem via um redirect interno do Google que o
  // navegador bloqueia por CORS ao tentar LER a resposta de um POST.
  // Solução: enviar em modo "no-cors" (o envio funciona normalmente,
  // só não conseguimos ler o retorno) e depois recarregar a lista
  // direto da planilha, que já sabemos que funciona via GET.
  await fetch(CONFIG.API_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "create", ...payload }),
  });

  // dá um tempo pro Apps Script terminar de gravar (planilha + upload da foto no Drive)
  await new Promise((resolve) => setTimeout(resolve, 1500));
  return { success: true };
}

async function updateMachineInSheet(payload) {
  await fetch(CONFIG.API_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "update", ...payload }),
  });
  await new Promise((resolve) => setTimeout(resolve, 1500));
  return { success: true };
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
