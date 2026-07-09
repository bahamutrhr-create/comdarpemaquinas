// app.js

const STATUS_LABEL = {
  operando: "OPERANDO",
  nao_operando: "NÃO OPERANDO",
};

let state = {
  view: "list",     // "list" | "map"
  selectedTypes: [], // vazio = todos os tipos
  selectedAddresses: [], // vazio = todas as obras
  selectedStatuses: [], // vazio = todos os status
  sortBy: "none",    // "none" | "horimetro_desc" | "horimetro_asc"
  search: "",
};

let MACHINES = [];
let leafletMap = null;
let markerLayer = null;

// ---------- helpers ----------

function timeAgo(dateStr) {
  const then = new Date(dateStr);
  const now = new Date();
  const months =
    (now.getFullYear() - then.getFullYear()) * 12 +
    (now.getMonth() - then.getMonth());
  if (months <= 0) return "hoje";
  if (months === 1) return "há 1 mês";
  return `há ${months} meses`;
}

function filteredMachines() {
  let list = MACHINES.filter((m) => {
    const matchesType =
      state.selectedTypes.length === 0 || state.selectedTypes.includes(m.type);
    const matchesAddress =
      state.selectedAddresses.length === 0 || state.selectedAddresses.includes(m.address);
    const matchesStatus =
      state.selectedStatuses.length === 0 || state.selectedStatuses.includes(m.status);
    const q = state.search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      m.name.toLowerCase().includes(q) ||
      m.tag.toLowerCase().includes(q) ||
      m.type.toLowerCase().includes(q) ||
      m.address.toLowerCase().includes(q);
    return matchesType && matchesAddress && matchesStatus && matchesSearch;
  });

  if (state.sortBy === "horimetro_desc") {
    list = list.slice().sort((a, b) => (b.horimetro || 0) - (a.horimetro || 0));
  } else if (state.sortBy === "horimetro_asc") {
    list = list.slice().sort((a, b) => (a.horimetro || 0) - (b.horimetro || 0));
  }

  return list;
}

// ---------- chips ----------

function renderChips() {
  const row = document.getElementById("chipRow");
  const isAll =
    state.selectedTypes.length === 0 &&
    state.selectedAddresses.length === 0 &&
    state.selectedStatuses.length === 0;
  row.innerHTML = `<button class="chip ${isAll ? "active" : ""}" id="chipTodas">Todas</button>`;

  document.getElementById("chipTodas").addEventListener("click", () => {
    state.selectedTypes = [];
    state.selectedAddresses = [];
    state.selectedStatuses = [];
    state.sortBy = "none";
    renderChips();
    renderFilterButton();
    renderList();
    if (state.view === "map") renderMapMarkers();
  });

  renderFilterButton();
}

function renderFilterButton() {
  const btn = document.getElementById("filterBtn");
  const badge = document.getElementById("filterBadge");
  const activeCount =
    state.selectedTypes.length +
    state.selectedAddresses.length +
    state.selectedStatuses.length +
    (state.sortBy !== "none" ? 1 : 0);

  if (activeCount > 0) {
    btn.classList.add("has-filters");
    badge.style.display = "flex";
    badge.textContent = activeCount;
  } else {
    btn.classList.remove("has-filters");
    badge.style.display = "none";
  }
}

// ---------- list view ----------

function renderList() {
  const list = filteredMachines();
  const container = document.getElementById("listView");
  document.getElementById("machineCount").textContent = `${MACHINES.length} máquinas rastreadas`;

  if (list.length === 0) {
    container.innerHTML = `<div class="empty-state">Nenhuma máquina encontrada.</div>`;
    return;
  }

  container.innerHTML = list
    .map((m) => {
      const initials = m.photoInitials;
      const photo = m.photoUrl
        ? `<img src="${m.photoUrl}" alt="${m.name}" class="machine-photo" style="object-fit:cover;border-color:${m.photoColor}"/>`
        : `<div class="machine-photo" style="background:${m.photoColor}">${initials}</div>`;
      return `
      <div class="machine-card" data-id="${m.id}">
        ${photo}
        <div class="machine-info">
          <div class="machine-title-row">
            <span class="machine-name">${m.name}</span>
            <span class="status-pill ${m.status}"><span class="dot"></span>${STATUS_LABEL[m.status]}</span>
          </div>
          <div class="machine-type">${m.type}</div>
          <div class="machine-meta">
            <div class="meta-row">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              ${m.address}
            </div>
            <div class="meta-row">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
              TAG ${m.tag}
            </div>
            <div class="meta-row">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z"></path><path d="M12 12V8"></path></svg>
              Horímetro: ${(m.horimetro || 0).toLocaleString("pt-BR")} h
            </div>
          </div>
        </div>
      </div>`;
    })
    .join("");

  container.querySelectorAll(".machine-card").forEach((card) => {
    card.addEventListener("click", () => {
      const machine = MACHINES.find((m) => m.id === card.dataset.id);
      openModal(machine);
    });
  });
}

// ---------- map view ----------

let googleMap = null;
let googleMarkers = [];
let googleMapsLoadingPromise = null;

function initMap() {
  if (USING_GOOGLE_MAPS) {
    loadGoogleMapsScript()
      .then(initGoogleMap)
      .catch(() => {
        document.getElementById("map").innerHTML =
          `<div class="empty-state">Não foi possível carregar o Google Maps.<br/>Verifique a chave em config.js.</div>`;
      });
  } else {
    initLeafletMap();
  }
}

function renderMapMarkers() {
  if (USING_GOOGLE_MAPS && googleMap) {
    renderGoogleMapMarkers();
  } else if (leafletMap) {
    renderLeafletMapMarkers();
  }
}

// --- Google Maps ---

function loadGoogleMapsScript() {
  if (window.google && window.google.maps) return Promise.resolve();
  if (googleMapsLoadingPromise) return googleMapsLoadingPromise;

  googleMapsLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${CONFIG.GOOGLE_MAPS_API_KEY}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar Google Maps"));
    document.head.appendChild(script);
  });
  return googleMapsLoadingPromise;
}

function initGoogleMap() {
  googleMap = new google.maps.Map(document.getElementById("map"), {
    center: { lat: -23.5613, lng: -46.6565 },
    zoom: 12,
    styles: GOOGLE_MAP_DARK_STYLE,
    disableDefaultUI: false,
    fullscreenControl: false,
  });
  renderGoogleMapMarkers();
}

function renderGoogleMapMarkers() {
  googleMarkers.forEach((mk) => mk.setMap(null));
  googleMarkers = [];

  const list = filteredMachines();
  const bounds = new google.maps.LatLngBounds();

  list.forEach((m) => {
    const color = m.status === "operando" ? "#22c55e" : "#eab308";
    const marker = new google.maps.Marker({
      position: { lat: m.lat, lng: m.lng },
      map: googleMap,
      title: m.name,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: color,
        fillOpacity: 1,
        strokeColor: "#0b0b0e",
        strokeWeight: 2,
        scale: 9,
      },
    });
    const info = new google.maps.InfoWindow({
      content: `<div style="font-family:sans-serif;">
        <strong>${m.name}</strong><br/>
        <span style="color:#6ea8e8;">${m.type}</span><br/>
        <span style="color:${color};font-weight:bold;">${STATUS_LABEL[m.status]}</span><br/>
        <span>TAG ${m.tag}</span><br/>
        <button onclick="openMachineDetailById('${m.id}')" style="margin-top:6px;background:#f97316;color:#1a0f00;border:none;border-radius:6px;padding:6px 10px;font-weight:700;cursor:pointer;">Ver detalhes completos</button>
      </div>`,
    });
    marker.addListener("click", () => {
      info.open(googleMap, marker);
    });
    googleMarkers.push(marker);
    bounds.extend(marker.getPosition());
  });

  if (list.length) googleMap.fitBounds(bounds, 60);
}

const GOOGLE_MAP_DARK_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#16161b" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0b0b0e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9a9aa5" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#26262e" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0d1b2a" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#1a1a20" }] },
];

// --- Leaflet (OpenStreetMap, padrão gratuito) ---

function initLeafletMap() {
  leafletMap = L.map("map", { zoomControl: true }).setView([-23.5613, -46.6565], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap",
    maxZoom: 19,
  }).addTo(leafletMap);

  markerLayer = L.markerClusterGroup({
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
    maxClusterRadius: 55,
    iconCreateFunction: (cluster) => {
      const count = cluster.getChildCount();
      return L.divIcon({
        className: "",
        html: `<div style="background:#16161b;border:2.5px solid #f97316;color:#f2f2f4;
                     width:42px;height:42px;border-radius:50%;display:flex;align-items:center;
                     justify-content:center;font-weight:700;font-size:14px;
                     box-shadow:0 3px 10px rgba(0,0,0,0.5);">${count}</div>`,
        iconSize: [42, 42],
      });
    },
  }).addTo(leafletMap);

  renderLeafletMapMarkers();
}

function machineMarkerIcon(m) {
  const color = m.status === "operando" ? "#22c55e" : "#eab308";
  if (m.photoUrl) {
    return L.divIcon({
      className: "",
      html: `<div style="width:38px;height:38px;border-radius:50%;border:3px solid ${color};
                   overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.5);background:#16161b;">
               <img src="${m.photoUrl}" style="width:100%;height:100%;object-fit:cover;display:block;" />
             </div>`,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
      popupAnchor: [0, -19],
    });
  }
  return L.divIcon({
    className: "",
    html: `<div style="width:30px;height:30px;border-radius:50%;background:${color};
                 border:2px solid #0b0b0e;display:flex;align-items:center;justify-content:center;
                 color:#0b0b0e;font-size:10px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.5);">
             ${m.photoInitials || ""}
           </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });
}

window.openMachineDetailById = (id) => {
  const m = MACHINES.find((x) => x.id === id);
  if (m) openModal(m);
};

function renderLeafletMapMarkers() {
  markerLayer.clearLayers();
  const list = filteredMachines();
  const bounds = [];

  list.forEach((m) => {
    const color = m.status === "operando" ? "#22c55e" : "#eab308";
    const marker = L.marker([m.lat, m.lng], { icon: machineMarkerIcon(m) });
    marker.bindPopup(`
      <div class="popup-title">${m.name}</div>
      <div class="popup-type">${m.type}</div>
      <div class="popup-status" style="color:${color}">${STATUS_LABEL[m.status]}</div>
      <div class="popup-tag">TAG ${m.tag}</div>
      <button class="popup-details-btn" onclick="openMachineDetailById('${m.id}')">Ver detalhes completos</button>
    `);
    markerLayer.addLayer(marker);
    bounds.push([m.lat, m.lng]);
  });

  if (bounds.length) {
    leafletMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }
}

// ---------- modal (detail + QR + check-in) ----------

function openModal(machine) {
  const overlay = document.getElementById("modalOverlay");
  const modal = document.getElementById("modal");
  const checkinUrl = USING_REAL_BACKEND
    ? checkinUrlFor(machine.id)
    : `${window.location.origin}${window.location.pathname}?checkin=${machine.id}`;

  const photoHtml = machine.photoUrl
    ? `<img src="${machine.photoUrl}" alt="${machine.name}" class="modal-photo" style="object-fit:cover;border-color:${machine.photoColor}"/>`
    : `<div class="modal-photo" style="background:${machine.photoColor}">${machine.photoInitials}</div>`;

  modal.innerHTML = `
    <button class="modal-close" id="modalClose">&times;</button>
    ${photoHtml}
    <h2>${machine.name}</h2>
    <div class="modal-sub">${machine.type} · TAG ${machine.tag}</div>

    <div class="modal-field"><span class="label">Status</span><span class="value">${STATUS_LABEL[machine.status]}</span></div>
    <div class="modal-field"><span class="label">Horímetro</span><span class="value">${(machine.horimetro || 0).toLocaleString("pt-BR")} h</span></div>
    <div class="modal-field"><span class="label">Peso</span><span class="value">${(machine.pesoTon || 0).toLocaleString("pt-BR")} ton</span></div>
    <div class="modal-field"><span class="label">Localização</span><span class="value">${machine.address}</span></div>
    <div class="modal-field"><span class="label">Última atualização</span><span class="value">${timeAgo(machine.lastUpdate)}</span></div>

    <div class="qr-box"><div id="qrcode"></div></div>
    <div style="text-align:center;color:var(--text-faint);font-size:12px;margin-top:-8px;margin-bottom:4px;">
      Escaneie para fazer check-in desta máquina
    </div>

    ${
      USING_REAL_BACKEND
        ? `<a class="btn-primary" style="display:block;text-align:center;text-decoration:none;" href="${checkinUrl}" target="_blank">Abrir página de check-in</a>`
        : `<button class="btn-primary" id="checkinBtn">Simular check-in (conecte o Sheets pra valer)</button>`
    }
    <button class="btn-secondary" id="editBtn">Editar máquina</button>
    <button class="btn-secondary" id="closeBtn2">Fechar</button>
  `;

  new QRCode(document.getElementById("qrcode"), {
    text: checkinUrl,
    width: 140,
    height: 140,
    colorDark: "#0b0b0e",
    colorLight: "#ffffff",
  });

  overlay.classList.add("open");

  document.getElementById("modalClose").onclick = closeModal;
  document.getElementById("closeBtn2").onclick = closeModal;
  document.getElementById("editBtn").onclick = () => openEditMachineForm(machine);
  if (!USING_REAL_BACKEND) {
    document.getElementById("checkinBtn").onclick = () => runCheckin(machine);
  }
}

function closeModal() {
  document.getElementById("modalOverlay").classList.remove("open");
}

function runCheckin(machine) {
  const modal = document.getElementById("modal");

  const finish = (lat, lng, addressLabel) => {
    machine.lat = lat;
    machine.lng = lng;
    machine.address = addressLabel;
    machine.lastUpdate = new Date().toISOString().slice(0, 10);
    machine.status = "operando";

    modal.innerHTML = `
      <button class="modal-close" id="modalClose">&times;</button>
      <div class="checkin-msg">
        <svg class="icon-ok" width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="8 12 11 15 16 9"></polyline></svg>
        <h2>Check-in realizado</h2>
        <p class="modal-sub">${machine.name} teve a localização atualizada.</p>
      </div>
      <button class="btn-primary" id="doneBtn">Concluir</button>
    `;
    document.getElementById("modalClose").onclick = () => { closeModal(); renderList(); if (state.view === "map") renderMapMarkers(); };
    document.getElementById("doneBtn").onclick = () => { closeModal(); renderList(); if (state.view === "map") renderMapMarkers(); };
  };

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => finish(pos.coords.latitude, pos.coords.longitude, "Localização atual do dispositivo"),
      () => finish(machine.lat, machine.lng, machine.address) // permissão negada: mantém local
    );
  } else {
    finish(machine.lat, machine.lng, machine.address);
  }
}

// ---------- nav + search ----------

document.getElementById("navMachines").addEventListener("click", () => {
  state.view = "list";
  document.getElementById("navMachines").classList.add("active");
  document.getElementById("navMap").classList.remove("active");
  document.getElementById("listView").style.display = "flex";
  document.getElementById("mapView").style.display = "none";
  document.querySelector(".search-wrap").style.display = "block";
  document.querySelector(".chips-row").style.display = "flex";
});

document.getElementById("navMap").addEventListener("click", () => {
  state.view = "map";
  document.getElementById("navMap").classList.add("active");
  document.getElementById("navMachines").classList.remove("active");
  document.getElementById("listView").style.display = "none";
  document.getElementById("mapView").style.display = "block";
  document.querySelector(".search-wrap").style.display = "none";
  document.querySelector(".chips-row").style.display = "flex";

  const alreadyInitialized = USING_GOOGLE_MAPS ? googleMap : leafletMap;
  if (!alreadyInitialized) {
    setTimeout(initMap, 0); // garante que o container já tem altura
  } else if (!USING_GOOGLE_MAPS) {
    setTimeout(() => leafletMap.invalidateSize(), 0);
    renderMapMarkers();
  } else {
    renderMapMarkers();
  }
});

document.getElementById("searchInput").addEventListener("input", (e) => {
  state.search = e.target.value;
  renderList();
});

document.getElementById("filterBtn").addEventListener("click", openFilterPanel);

function openFilterPanel() {
  const overlay = document.getElementById("modalOverlay");
  const modal = document.getElementById("modal");

  const sortOptions = [
    { value: "none", label: "Padrão" },
    { value: "horimetro_desc", label: "Horímetro (maior primeiro)" },
    { value: "horimetro_asc", label: "Horímetro (menor primeiro)" },
  ];

  const uniqueAddresses = Array.from(new Set(MACHINES.map((m) => m.address))).sort();

  modal.innerHTML = `
    <button class="modal-close" id="modalClose">&times;</button>
    <h2>Filtrar máquinas</h2>
    <div class="modal-sub">Selecione um ou mais critérios</div>

    <div class="filter-section-title">Ordenar por</div>
    <div class="sort-options" id="sortOptions">
      ${sortOptions
        .map(
          (o) => `
        <label class="sort-option ${state.sortBy === o.value ? "selected" : ""}">
          <input type="radio" name="sortBy" value="${o.value}" ${state.sortBy === o.value ? "checked" : ""} />
          ${o.label}
        </label>`
        )
        .join("")}
    </div>

    <div class="filter-section-title">Status</div>
    <div class="type-checkbox-list" id="statusCheckboxList">
      <label class="type-checkbox">
        <input type="checkbox" value="operando" ${state.selectedStatuses.includes("operando") ? "checked" : ""} />
        Operando
      </label>
      <label class="type-checkbox">
        <input type="checkbox" value="nao_operando" ${state.selectedStatuses.includes("nao_operando") ? "checked" : ""} />
        Não operando
      </label>
    </div>

    <div class="filter-section-title">Obra</div>
    <div class="type-checkbox-list" id="addressCheckboxList">
      ${uniqueAddresses
        .map(
          (a) => `
        <label class="type-checkbox">
          <input type="checkbox" value="${a}" ${state.selectedAddresses.includes(a) ? "checked" : ""} />
          ${a}
        </label>`
        )
        .join("")}
    </div>

    <div class="filter-section-title">Tipo de máquina</div>
    <div class="type-checkbox-list" id="typeCheckboxList">
      ${MACHINE_TYPES.map(
        (t) => `
        <label class="type-checkbox">
          <input type="checkbox" value="${t}" ${state.selectedTypes.includes(t) ? "checked" : ""} />
          ${t}
        </label>`
      ).join("")}
    </div>

    <button class="btn-primary" id="applyFilterBtn">Aplicar filtros</button>
    <button class="btn-secondary" id="clearFilterBtn">Limpar filtros</button>
  `;

  overlay.classList.add("open");
  document.getElementById("modalClose").onclick = closeModal;

  document.getElementById("applyFilterBtn").onclick = () => {
    const checkedTypes = Array.from(
      modal.querySelectorAll('#typeCheckboxList input[type="checkbox"]:checked')
    ).map((cb) => cb.value);
    const checkedAddresses = Array.from(
      modal.querySelectorAll('#addressCheckboxList input[type="checkbox"]:checked')
    ).map((cb) => cb.value);
    const checkedStatuses = Array.from(
      modal.querySelectorAll('#statusCheckboxList input[type="checkbox"]:checked')
    ).map((cb) => cb.value);
    const sortValue = modal.querySelector('input[name="sortBy"]:checked').value;

    state.selectedTypes = checkedTypes;
    state.selectedAddresses = checkedAddresses;
    state.selectedStatuses = checkedStatuses;
    state.sortBy = sortValue;

    closeModal();
    renderChips();
    renderList();
    if (state.view === "map") renderMapMarkers();
  };

  document.getElementById("clearFilterBtn").onclick = () => {
    state.selectedTypes = [];
    state.selectedAddresses = [];
    state.selectedStatuses = [];
    state.sortBy = "none";
    closeModal();
    renderChips();
    renderList();
    if (state.view === "map") renderMapMarkers();
  };
}

document.getElementById("modalOverlay").addEventListener("click", (e) => {
  if (e.target.id === "modalOverlay") closeModal();
});

document.getElementById("fabAdd").addEventListener("click", () => {
  openAddMachineForm();
});

function openAddMachineForm() {
  const overlay = document.getElementById("modalOverlay");
  const modal = document.getElementById("modal");

  const typeOptions = MACHINE_TYPES.map((t) => `<option value="${t}">${t}</option>`).join("");

  modal.innerHTML = `
    <button class="modal-close" id="modalClose">&times;</button>
    <h2>Cadastrar máquina</h2>
    <div class="modal-sub">${USING_REAL_BACKEND ? "Será salvo na sua planilha do Google Sheets" : "Conecte o Sheets em config.js para salvar de verdade"}</div>

    <div style="display:flex;flex-direction:column;gap:12px;margin-top:12px;">
      <input class="form-input" id="fName" placeholder="Nome da máquina (ex: CAT 320F)" />
      <input class="form-input" id="fTag" placeholder="TAG / identificador" />
      <select class="form-input" id="fType">${typeOptions}</select>
      <input class="form-input" id="fAddress" placeholder="Endereço / localização inicial" />
      <input class="form-input" id="fLat" placeholder="Latitude (ex: -23.5613)" />
      <input class="form-input" id="fLng" placeholder="Longitude (ex: -46.6565)" />
      <input class="form-input" id="fHorimetro" type="number" step="0.1" placeholder="Horímetro (horas)" />
      <input class="form-input" id="fDataHorimetro" type="date" placeholder="Data do horímetro" />
      <input class="form-input" id="fPesoTon" type="number" step="0.1" placeholder="Peso (toneladas)" />
      <input type="file" accept="image/*" id="fPhoto" />
    </div>

    <button class="btn-primary" id="saveMachineBtn">Salvar máquina</button>
    <button class="btn-secondary" id="cancelBtn">Cancelar</button>
    <div id="saveStatus" style="text-align:center;font-size:12.5px;color:var(--text-faint);margin-top:8px;"></div>
  `;

  overlay.classList.add("open");
  document.getElementById("modalClose").onclick = closeModal;
  document.getElementById("cancelBtn").onclick = closeModal;
  document.getElementById("saveMachineBtn").onclick = saveNewMachine;
}

async function saveNewMachine() {
  const name = document.getElementById("fName").value.trim();
  const tag = document.getElementById("fTag").value.trim();
  const type = document.getElementById("fType").value;
  const address = document.getElementById("fAddress").value.trim() || "Localização não informada";
  const lat = parseFloat(document.getElementById("fLat").value) || -23.5613;
  const lng = parseFloat(document.getElementById("fLng").value) || -46.6565;
  const horimetro = parseFloat(document.getElementById("fHorimetro").value) || 0;
  const dataHorimetro = document.getElementById("fDataHorimetro").value || "";
  const pesoTon = parseFloat(document.getElementById("fPesoTon").value) || 0;
  const photoFile = document.getElementById("fPhoto").files[0];
  const statusEl = document.getElementById("saveStatus");

  if (!name || !tag) {
    statusEl.textContent = "Preencha ao menos nome e TAG.";
    return;
  }

  if (!USING_REAL_BACKEND) {
    statusEl.textContent = "Cadastro real desativado: configure a API_URL em config.js primeiro.";
    return;
  }

  statusEl.textContent = "Salvando na planilha...";
  try {
    const payload = { name, tag, type, address, lat, lng, horimetro, dataHorimetro, pesoTon };
    if (photoFile) {
      payload.photoBase64 = await fileToBase64(photoFile);
      payload.photoMimeType = photoFile.type;
    }
    await createMachineInSheet(payload);
    statusEl.textContent = "Atualizando lista...";
    MACHINES = await fetchMachinesFromSheet();
    closeModal();
    renderChips();
    renderList();
    if (state.view === "map") renderMapMarkers();
  } catch (err) {
    statusEl.textContent = "Erro de conexão com o Sheets.";
  }
}

// ---------- edit machine ----------

function openEditMachineForm(machine) {
  const overlay = document.getElementById("modalOverlay");
  const modal = document.getElementById("modal");

  const typeOptions = MACHINE_TYPES.map(
    (t) => `<option value="${t}" ${t === machine.type ? "selected" : ""}>${t}</option>`
  ).join("");

  modal.innerHTML = `
    <button class="modal-close" id="modalClose">&times;</button>
    <h2>Editar máquina</h2>
    <div class="modal-sub">${USING_REAL_BACKEND ? "As alterações são salvas na sua planilha" : "Conecte o Sheets em config.js para salvar de verdade"}</div>

    <div style="display:flex;flex-direction:column;gap:12px;margin-top:12px;">
      <input class="form-input" id="fName" placeholder="Nome da máquina" value="${machine.name}" />
      <input class="form-input" id="fTag" placeholder="TAG / identificador" value="${machine.tag}" />
      <select class="form-input" id="fType">${typeOptions}</select>
      <select class="form-input" id="fStatus">
        <option value="operando" ${machine.status === "operando" ? "selected" : ""}>Operando</option>
        <option value="nao_operando" ${machine.status === "nao_operando" ? "selected" : ""}>Não operando</option>
      </select>
      <input class="form-input" id="fAddress" placeholder="Endereço / localização" value="${machine.address}" />
      <input class="form-input" id="fLat" placeholder="Latitude" value="${machine.lat}" />
      <input class="form-input" id="fLng" placeholder="Longitude" value="${machine.lng}" />
      <input class="form-input" id="fHorimetro" type="number" step="0.1" placeholder="Horímetro (horas)" value="${machine.horimetro || 0}" />
      <input class="form-input" id="fDataHorimetro" type="date" value="${machine.dataHorimetro || ""}" />
      <input class="form-input" id="fPesoTon" type="number" step="0.1" placeholder="Peso (toneladas)" value="${machine.pesoTon || 0}" />
      <div style="font-size:12.5px;color:var(--text-faint);">Trocar foto (opcional):</div>
      <input type="file" accept="image/*" id="fPhoto" />
    </div>

    <button class="btn-primary" id="saveEditBtn">Salvar alterações</button>
    <button class="btn-secondary" id="cancelBtn">Cancelar</button>
    <div id="saveStatus" style="text-align:center;font-size:12.5px;color:var(--text-faint);margin-top:8px;"></div>
  `;

  overlay.classList.add("open");
  document.getElementById("modalClose").onclick = closeModal;
  document.getElementById("cancelBtn").onclick = closeModal;
  document.getElementById("saveEditBtn").onclick = () => saveEditedMachine(machine.id);
}

async function saveEditedMachine(id) {
  const name = document.getElementById("fName").value.trim();
  const tag = document.getElementById("fTag").value.trim();
  const type = document.getElementById("fType").value;
  const status = document.getElementById("fStatus").value;
  const address = document.getElementById("fAddress").value.trim();
  const lat = document.getElementById("fLat").value.trim();
  const lng = document.getElementById("fLng").value.trim();
  const horimetro = document.getElementById("fHorimetro").value.trim();
  const dataHorimetro = document.getElementById("fDataHorimetro").value || "";
  const pesoTon = document.getElementById("fPesoTon").value.trim();
  const photoFile = document.getElementById("fPhoto").files[0];
  const statusEl = document.getElementById("saveStatus");

  if (!name || !tag) {
    statusEl.textContent = "Preencha ao menos nome e TAG.";
    return;
  }

  if (!USING_REAL_BACKEND) {
    statusEl.textContent = "Edição real desativada: configure a API_URL em config.js primeiro.";
    return;
  }

  statusEl.textContent = "Salvando alterações...";
  try {
    const payload = { id, name, tag, type, status, address, lat, lng, horimetro, dataHorimetro, pesoTon };
    if (photoFile) {
      payload.photoBase64 = await fileToBase64(photoFile);
      payload.photoMimeType = photoFile.type;
    }
    await updateMachineInSheet(payload);
    statusEl.textContent = "Atualizando lista...";
    MACHINES = await fetchMachinesFromSheet();
    closeModal();
    renderChips();
    renderList();
    if (state.view === "map") renderMapMarkers();
  } catch (err) {
    statusEl.textContent = "Erro de conexão com o Sheets.";
  }
}

// ---------- boot ----------

async function boot() {
  renderChips();
  document.getElementById("machineCount").textContent = USING_REAL_BACKEND ? "Carregando..." : "6 máquinas rastreadas";

  if (USING_REAL_BACKEND) {
    document.getElementById("listView").innerHTML = `<div class="empty-state">Carregando máquinas da planilha...</div>`;
    try {
      MACHINES = await fetchMachinesFromSheet();
    } catch (err) {
      document.getElementById("machineCount").textContent = "Erro ao carregar";
      document.getElementById("listView").innerHTML =
        `<div class="empty-state">Não foi possível carregar a planilha.<br/>Verifique a API_URL em config.js e se a implantação está pública.</div>`;
      return;
    }
  } else {
    MACHINES = MOCK_MACHINES;
  }

  renderChips();
  renderList();
}

boot();
