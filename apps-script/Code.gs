/**
 * BACKEND DO APP DE MÁQUINAS
 * ---------------------------------------------------------
 * Como instalar:
 * 1. Crie uma Planilha Google nova.
 * 2. Renomeie a primeira aba para exatamente:  Maquinas
 * 3. Na linha 1, cole estes cabeçalhos (uma coluna cada, na ordem):
 *    id | tag | name | type | status | address | lat | lng | lastUpdate | photoUrl | photoInitials | photoColor | horimetro
 *    (se sua planilha já existia antes, só adicione "horimetro" na próxima coluna livre, no fim)
 * 4. Menu Extensões > Apps Script.
 * 5. Apague o conteúdo padrão de Code.gs e cole este arquivo inteiro.
 * 6. Clique em "Implantar" > "Nova implantação" > tipo "App da Web".
 *    - Executar como: Eu (seu usuário)
 *    - Quem pode acessar: Qualquer pessoa
 * 7. Copie a URL gerada (termina em /exec) e cole em config.js no front-end.
 * ---------------------------------------------------------
 */

const SHEET_NAME = "Maquinas";
const PHOTOS_FOLDER_NAME = "Fotos Maquinas App";
const PALETTE = ["#d4a35a", "#3a6ea5", "#c23b3b", "#e0a300", "#5aa06c", "#8a5ac2"];

// ---------- entrypoints ----------

function doGet(e) {
  const action = (e.parameter.action || "list").toLowerCase();

  if (action === "list") {
    return listResponse_(e.parameter.callback);
  }
  if (action === "checkin") {
    return checkinPage_(e.parameter.id);
  }
  if (action === "update-location") {
    return updateLocationAndRespond_(e.parameter);
  }
  return jsonResponse_({ error: "ação desconhecida" });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse_({ error: "corpo inválido" });
  }

  if (body.action === "create") {
    return jsonResponse_(createMachine_(body));
  }
  if (body.action === "update") {
    return jsonResponse_(updateMachine_(body));
  }
  if (body.action === "update-status") {
    return jsonResponse_(updateStatus_(body));
  }
  return jsonResponse_({ error: "ação desconhecida" });
}

// ---------- sheet helpers ----------

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error("Aba '" + SHEET_NAME + "' não encontrada.");
  return sheet;
}

const HEADERS = [
  "id", "tag", "name", "type", "status", "address",
  "lat", "lng", "lastUpdate", "photoUrl", "photoInitials", "photoColor", "horimetro",
];

function listMachines_() {
  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  const rows = values.slice(1); // remove cabeçalho
  return rows
    .filter((r) => r[0]) // ignora linhas vazias
    .map((r) => rowToMachine_(r));
}

function rowToMachine_(r) {
  const obj = {};
  HEADERS.forEach((h, i) => (obj[h] = r[i]));
  obj.lat = Number(obj.lat);
  obj.lng = Number(obj.lng);
  obj.horimetro = Number(obj.horimetro) || 0;
  if (obj.lastUpdate instanceof Date) {
    obj.lastUpdate = Utilities.formatDate(obj.lastUpdate, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return obj;
}

function findRowIndexById_(sheet, id) {
  const ids = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 0), 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) return i + 2; // +2: cabeçalho + índice base 1
  }
  return -1;
}

function nextId_(sheet) {
  const lastRow = sheet.getLastRow();
  const n = lastRow; // linha 1 = cabeçalho, então lastRow já é a contagem certa +0
  return "MAQ-" + String(n).padStart(3, "0");
}

function initialsFrom_(name) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function colorFor_(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

// ---------- create / update ----------

function createMachine_(body) {
  const sheet = getSheet_();
  const id = nextId_(sheet);

  let photoUrl = "";
  if (body.photoBase64) {
    photoUrl = uploadPhoto_(body.photoBase64, body.photoMimeType || "image/jpeg", id + ".jpg");
  }

  const row = [
    id,
    body.tag || "",
    body.name || "",
    body.type || "",
    "operando",
    body.address || "Localização não informada",
    body.lat || "",
    body.lng || "",
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"),
    photoUrl,
    initialsFrom_(body.name || "??"),
    colorFor_(body.name || id),
    body.horimetro || 0,
  ];

  sheet.appendRow(row);
  return { success: true, machine: rowToMachine_(row) };
}

function updateMachine_(body) {
  const sheet = getSheet_();
  const rowIndex = findRowIndexById_(sheet, body.id);
  if (rowIndex === -1) return { error: "máquina não encontrada" };

  const textFields = ["tag", "name", "type", "address", "status"];
  textFields.forEach((field) => {
    if (body[field] !== undefined && body[field] !== "") {
      sheet.getRange(rowIndex, HEADERS.indexOf(field) + 1).setValue(body[field]);
    }
  });

  if (body.lat !== undefined && body.lat !== "") {
    sheet.getRange(rowIndex, HEADERS.indexOf("lat") + 1).setValue(Number(body.lat));
  }
  if (body.lng !== undefined && body.lng !== "") {
    sheet.getRange(rowIndex, HEADERS.indexOf("lng") + 1).setValue(Number(body.lng));
  }
  if (body.horimetro !== undefined && body.horimetro !== "") {
    sheet.getRange(rowIndex, HEADERS.indexOf("horimetro") + 1).setValue(Number(body.horimetro));
  }

  if (body.name) {
    sheet.getRange(rowIndex, HEADERS.indexOf("photoInitials") + 1).setValue(initialsFrom_(body.name));
  }

  if (body.photoBase64) {
    const photoUrl = uploadPhoto_(body.photoBase64, body.photoMimeType || "image/jpeg", body.id + ".jpg");
    sheet.getRange(rowIndex, HEADERS.indexOf("photoUrl") + 1).setValue(photoUrl);
  }

  sheet.getRange(rowIndex, HEADERS.indexOf("lastUpdate") + 1).setValue(
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd")
  );

  return { success: true };
}

function updateStatus_(body) {
  const sheet = getSheet_();
  const rowIndex = findRowIndexById_(sheet, body.id);
  if (rowIndex === -1) return { error: "máquina não encontrada" };
  sheet.getRange(rowIndex, HEADERS.indexOf("status") + 1).setValue(body.status);
  return { success: true };
}

function uploadPhoto_(base64Data, mimeType, fileName) {
  let folder = null;
  const folders = DriveApp.getFoldersByName(PHOTOS_FOLDER_NAME);
  folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(PHOTOS_FOLDER_NAME);

  const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, fileName);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w200";
}

// ---------- QR check-in flow ----------

function checkinPage_(id) {
  const sheet = getSheet_();
  const rowIndex = findRowIndexById_(sheet, id);
  if (rowIndex === -1) {
    return HtmlService.createHtmlOutput("<h2>Máquina não encontrada.</h2>");
  }
  const machine = rowToMachine_(sheet.getRange(rowIndex, 1, 1, HEADERS.length).getValues()[0]);
  const scriptUrl = ScriptApp.getService().getUrl();

  const html = `
    <!doctype html><html><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0b0b0e;color:#f2f2f4;
           display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:20px;text-align:center}
      .card{max-width:360px}
      h1{font-size:20px;margin-bottom:6px}
      p{color:#9a9aa5;font-size:14px;margin-bottom:24px}
      button{background:#f97316;color:#1a0f00;border:none;border-radius:12px;padding:14px 22px;
             font-weight:700;font-size:15px;cursor:pointer;width:100%}
      #status{margin-top:16px;font-size:13px;color:#9a9aa5}
    </style></head>
    <body>
      <div class="card">
        <h1>Check-in: ${machine.name}</h1>
        <p>TAG ${machine.tag} · ${machine.type}</p>
        <button id="btn" onclick="doCheckin()">Confirmar minha localização</button>
        <div id="status"></div>
      </div>
      <script>
        function doCheckin() {
          document.getElementById('status').textContent = 'Obtendo localização...';
          navigator.geolocation.getCurrentPosition(function(pos) {
            var url = "${scriptUrl}?action=update-location&id=${id}"
              + "&lat=" + pos.coords.latitude
              + "&lng=" + pos.coords.longitude;
            window.location.href = url;
          }, function() {
            document.getElementById('status').textContent = 'Permissão de localização negada.';
          });
        }
      </script>
    </body></html>`;
  return HtmlService.createHtmlOutput(html);
}

function updateLocationAndRespond_(params) {
  const sheet = getSheet_();
  const rowIndex = findRowIndexById_(sheet, params.id);
  if (rowIndex === -1) {
    return HtmlService.createHtmlOutput("<h2>Máquina não encontrada.</h2>");
  }

  sheet.getRange(rowIndex, HEADERS.indexOf("lat") + 1).setValue(Number(params.lat));
  sheet.getRange(rowIndex, HEADERS.indexOf("lng") + 1).setValue(Number(params.lng));
  sheet.getRange(rowIndex, HEADERS.indexOf("address") + 1).setValue("Atualizado via check-in (GPS)");
  sheet.getRange(rowIndex, HEADERS.indexOf("lastUpdate") + 1).setValue(
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd")
  );
  sheet.getRange(rowIndex, HEADERS.indexOf("status") + 1).setValue("operando");

  return HtmlService.createHtmlOutput(
    `<!doctype html><html><head><meta charset="utf-8">
     <meta name="viewport" content="width=device-width, initial-scale=1"></head>
     <body style="font-family:-apple-system,sans-serif;background:#0b0b0e;color:#f2f2f4;
       display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center">
       <div><h1 style="color:#22c55e">Check-in realizado ✓</h1>
       <p style="color:#9a9aa5">Localização atualizada com sucesso. Pode fechar esta página.</p></div>
     </body></html>`
  );
}

// ---------- utils ----------

function listResponse_(callback) {
  const machines = listMachines_();
  if (callback) {
    // JSONP: entrega o JSON embrulhado numa chamada de função JS.
    // Isso não é bloqueado por CORS porque é carregado como uma <script>, não um fetch/XHR.
    return ContentService
      .createTextOutput(callback + "(" + JSON.stringify({ machines: machines }) + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return jsonResponse_({ machines: machines });
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
