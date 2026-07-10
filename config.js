// config.js
//
// Depois de implantar o Apps Script (veja apps-script/Code.gs), cole aqui
// a URL que termina em /exec. Enquanto estiver com o valor abaixo,
// o app usa os dados de exemplo (MOCK_MACHINES em data.js) para você
// continuar testando o layout sem depender da planilha.

const CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbyoFCCPEUP3ccJGEu-3xphOZxBgEz0Ax3N-157MciVzp6sxTJYzQtVF6JXiPNgQPPfP/exec",

  // Opcional: cole aqui uma chave da Google Maps JavaScript API para usar o
  // Google Maps de verdade na aba "MAPA" (precisa de projeto no Google Cloud
  // com faturamento habilitado + a API "Maps JavaScript API" ativada).
  // Enquanto deixar como está, o app usa OpenStreetMap (gratuito, sem chave).
  GOOGLE_MAPS_API_KEY: "COLE_AQUI_SUA_CHAVE_DO_GOOGLE_MAPS",
};

const USING_REAL_BACKEND = !CONFIG.API_URL.startsWith("COLE_AQUI");
const USING_GOOGLE_MAPS = !CONFIG.GOOGLE_MAPS_API_KEY.startsWith("COLE_AQUI");

// Trava de login por código de e-mail. Deixe "false" enquanto essa parte
// estiver pausada — o app funciona normalmente sem pedir login.
// Mude para "true" só depois de colar o Code.gs com as rotas de autenticação
// no Apps Script e reimplantar.
const REQUIRE_LOGIN = false;
