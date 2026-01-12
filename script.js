// script.js (FINAL)
// - Mantiene selects (sorteo/fecha)
// - NO muestra el primer sorteo al cargar
// - Si seleccionas un sorteo sin datos => "Resultados a las 22:00 horas."
// - Embed como botón en la web normal
// - En modo embed (?embed=1): se VEN los selects, pero NO se ve el botón/embed box (solo para navegar resultados)

// ===============================
// CONFIGURACIÓN
// ===============================
const SHEET_ID = "1WGtZG2WWqJjGcJxIzR4-7Hl-090HZB7oxBWocX7A2w0";
const URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;

const DISPLAY_NAME = {
  loto: "Loto",
  comodin: "Comodín",
  multiplicador: "Multiplicador",
  recargado: "Recargado",
  revancha: "Revancha",
  desquite: "Desquite",
  jubilazo: "Jubilazo",
  jubilazo50: "Jubilazo 50",
};

// ===============================
// DOM
// ===============================
const contenedor = document.getElementById("resultados");
const selectSorteo = document.getElementById("selectSorteo");
const selectFecha = document.getElementById("selectFecha");

const bannerTexto = document.getElementById("bannerTexto");
const bannerMonto = document.getElementById("bannerMonto");

const btnEmbed = document.getElementById("btnEmbed");
const embedBox = document.getElementById("embedBox");
const embedCode = document.getElementById("embedCode");
const copyEmbed = document.getElementById("copyEmbed");
const hint = document.getElementById("hint");

let ALL_DATA = [];

// ===============================
// UI: EMBED (solo en página normal)
// ===============================
btnEmbed?.addEventListener("click", () => {
  const visible = !embedBox.hidden;
  embedBox.hidden = visible;
  btnEmbed.textContent = visible ? "Mostrar embed" : "Ocultar embed";
});

copyEmbed?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(embedCode.value);
    copyEmbed.textContent = "Copiado ✅";
    setTimeout(() => (copyEmbed.textContent = "Copiar"), 1200);
  } catch {
    embedCode.focus();
    embedCode.select();
  }
});

// ===============================
// FETCH
// ===============================
fetch(URL)
  .then(r => r.text())
  .then(text => {
    const json = parseGviz(text);

    // Mapeo robusto de columnas: "Jubilazo 50" -> "jubilazo50"
    const colMap = {};
    json.table.cols.forEach((c, i) => {
      if (!c.label) return;

      const parts = c.label.trim().split(/\s+/);
      const logo = parts.find(p => /^https?:\/\//i.test(p)) || null;

      const labelText = parts
        .filter(p => !/^https?:\/\//i.test(p))
        .join(" ")
        .trim();

      const key = labelText
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[^\w]/g, "");

      if (!key) return;
      colMap[key] = { index: i, logo };
    });

    const data = json.table.rows
      .map(row => {
        const get = key => row.c?.[colMap[key]?.index]?.v ?? "";
        if (!get("sorteo")) return null;

        return {
          sorteo: get("sorteo").toString(),
          fecha: formatearFecha(get("fecha")),
          monto: normalizarMonto(get("monto")),
          juegos: {
            loto: { nums: parseNums(get("loto")), logo: colMap.loto?.logo },
            comodin: { nums: parseNums(get("comodin")), logo: colMap.comodin?.logo },
            multiplicador: { nums: parseNums(get("multiplicador")), logo: colMap.multiplicador?.logo },
            recargado: { nums: parseNums(get("recargado")), logo: colMap.recargado?.logo },
            revancha: { nums: parseNums(get("revancha")), logo: colMap.revancha?.logo },
            desquite: { nums: parseNums(get("desquite")), logo: colMap.desquite?.logo },
            jubilazo: { jugadas: parseJugadas(get("jubilazo")), logo: colMap.jubilazo?.logo },
            jubilazo50: { jugadas: parseJugadas(get("jubilazo50")), logo: colMap.jubilazo50?.logo },
          }
        };
      })
      .filter(Boolean)
      .sort((a, b) => Number(b.sorteo) - Number(a.sorteo));

    ALL_DATA = data;

    if (!ALL_DATA.length) {
      contenedor.innerHTML = "<p>No hay datos disponibles</p>";
      return;
    }

    cargarSelectores(ALL_DATA);

    // ✅ Estado inicial: NO renderizar el primero
    limpiarVista();

    // Params: ?sorteo=XXXX&embed=1
    const params = new URLSearchParams(location.search);
    const sorteoParam = params.get("sorteo");
    const embedMode = params.get("embed") === "1";

    if (embedMode) activarModoEmbed(); // OJO: mantiene selects, oculta embed UI

    if (sorteoParam) {
      // precarga por URL
      selectSorteo.value = sorteoParam;
      aplicarFiltros();
      if (hint) hint.style.display = "none";
    }

    // eventos
    selectSorteo.addEventListener("change", () => {
      aplicarFiltros();
    });

    selectFecha.addEventListener("change", () => {
      aplicarFiltros();
    });
  })
  .catch(err => {
    console.error(err);
    contenedor.innerHTML = "<p>Error cargando datos. Intenta nuevamente.</p>";
  });

// ===============================
// FILTROS / CONTROL
// ===============================
function aplicarFiltros() {
  const sVal = selectSorteo.value;
  const fVal = selectFecha.value;

  if (!sVal && !fVal) {
    limpiarVista();
    return;
  }

  // Si elige sorteo -> 1 resultado (o sin datos)
  if (sVal) {
    const item = ALL_DATA.find(x => x.sorteo === String(sVal));

    if (item) {
      // sincroniza fecha
      selectFecha.value = item.fecha;

      render([item]);
      renderBanner(item);
      actualizarEmbed(item.sorteo);
      if (hint) hint.style.display = "none";

      // actualiza URL (sin recargar)
      pushUrl(item.sorteo);

      return;
    }

    // ✅ Sorteo seleccionado pero no existe:
    renderSinDatos(sVal);
    renderBannerSinDatos(sVal);
    actualizarEmbed(String(sVal));
    if (hint) hint.style.display = "none";
    pushUrl(String(sVal));
    return;
  }

  // Si NO hay sorteo pero hay fecha -> mostrar todos los sorteos de esa fecha
  if (fVal) {
    const items = ALL_DATA.filter(x => x.fecha === String(fVal));

    if (!items.length) {
      contenedor.innerHTML = "<p>No hay datos para esa fecha.</p>";
      embedBox.hidden = true;
      btnEmbed.disabled = true;
      btnEmbed.textContent = "Mostrar embed";
      return;
    }

    render(items);
    renderBanner(items[0]);

    // embed del más reciente de esa fecha
    actualizarEmbed(items[0].sorteo);
    if (hint) hint.style.display = "none";

    // setea selectSorteo al más reciente de esa fecha
    selectSorteo.value = items[0].sorteo;
    pushUrl(items[0].sorteo);
  }
}

function limpiarVista() {
  contenedor.innerHTML = "";
  bannerTexto.textContent = "Selecciona un sorteo";
  bannerMonto.textContent = "$0";

  embedBox.hidden = true;
  btnEmbed.disabled = true;
  btnEmbed.textContent = "Mostrar embed";

  if (hint) hint.style.display = "block";
}

function pushUrl(sorteo) {
  const params = new URLSearchParams(location.search);
  params.set("sorteo", sorteo);
  // mantenemos embed=1 si está activo
  if (params.get("embed") !== "1") params.delete("embed");
  history.replaceState({}, "", `${location.pathname}?${params.toString()}`);
}

// ===============================
// HELPERS
// ===============================
function parseGviz(text) {
  const m = text.match(/setResponse\(([\s\S]*?)\);?\s*$/);
  if (!m) throw new Error("No se pudo parsear la respuesta GViz");
  return JSON.parse(m[1]);
}

function parseNums(v) {
  if (v === null || v === undefined || v === "") return [];
  const nums = v.toString().match(/\d+/g);
  return nums ? nums.map(Number) : [];
}

function parseJugadas(v) {
  if (!v) return [];
  return v
    .toString()
    .split(/\n+/)
    .map(linea => {
      const nums = linea.match(/\d+/g);
      return nums ? nums.map(Number) : null;
    })
    .filter(j => j && j.length === 6);
}

function formatearFecha(f) {
  if (!f) return "";
  if (typeof f === "string" && f.startsWith("Date")) {
    const m = f.match(/Date\((\d+),(\d+),(\d+)/);
    if (!m) return f;
    const y = m[1];
    const mm = String(Number(m[2]) + 1).padStart(2, "0");
    const dd = String(Number(m[3])).padStart(2, "0");
    return `${dd}-${mm}-${y}`;
  }
  return String(f);
}

function normalizarMonto(m) {
  if (m === null || m === undefined || m === "") return 0;
  return Number(m.toString().replace(/[^\d]/g, "")) || 0;
}

// ===============================
// SELECTORES
// ===============================
function cargarSelectores(data) {
  const sorteos = [...new Set(data.map(x => x.sorteo))];
  const fechas = [...new Set(data.map(x => x.fecha))];

  selectSorteo.innerHTML = `<option value="">Selecciona sorteo</option>` +
    sorteos.map(s => `<option value="${s}">${s}</option>`).join("");

  selectFecha.innerHTML = `<option value="">Selecciona fecha</option>` +
    fechas.map(f => `<option value="${f}">${f}</option>`).join("");
}

// ===============================
// RENDER
// ===============================
function render(data) {
  const cards = data.map(s => {
    let html = `
      <div class="card">
        <h2>Sorteo LOTO ${s.sorteo}</h2>
        <small>${s.fecha}</small>
    `;

    for (const [key, juego] of Object.entries(s.juegos)) {
      const titulo = DISPLAY_NAME[key] || key.toUpperCase();
      const logoHtml = juego.logo
        ? `<img src="${juego.logo}" alt="${titulo}" loading="lazy">`
        : "";

      if (juego.nums && juego.nums.length) {
        html += `
          <h3>${logoHtml}${titulo}</h3>
          <div class="bolas">
            ${juego.nums.map(n => `<div class="bola">${n}</div>`).join("")}
          </div>
        `;
      }

      if (juego.jugadas && juego.jugadas.length) {
        html += `
          <h3>${logoHtml}${titulo}</h3>
          <div class="jugadas">
            ${juego.jugadas.map(j =>
              `<div class="bolas">
                ${j.map(n => `<div class="bola">${n}</div>`).join("")}
              </div>`
            ).join("")}
          </div>
        `;
      }
    }

    html += `</div>`;
    return html;
  });

  contenedor.innerHTML = cards.join("");
}

function renderSinDatos(sorteo) {
  contenedor.innerHTML = `
    <div class="card">
      <h2>Sorteo LOTO ${sorteo}</h2>
      <p class="sin-datos">Resultados a las 22:00 horas.</p>
    </div>
  `;
}

// ===============================
// BANNER
// ===============================
function renderBanner(s) {
  bannerTexto.textContent = `Próximo Sorteo N° ${Number(s.sorteo) + 1}`;

  // Heurística: si viene en pesos grandes, convierto a millones
  const monto = s.monto || 0;
  const enMillones = monto >= 1_000_000 ? Math.round(monto / 1_000_000) : monto;

  bannerMonto.textContent = `$${enMillones.toLocaleString("es-CL")}`;
}

function renderBannerSinDatos(sorteo) {
  bannerTexto.textContent = `Sorteo LOTO ${sorteo}`;
  bannerMonto.textContent = "$0";
}

// ===============================
// EMBED
// ===============================
function actualizarEmbed(sorteo) {
  const base = `${location.origin}${location.pathname}`;

  // Por defecto, el código generado es "embed con selects y sin UI de embed"
  // => usa embed=1 (pero ojo: nuestro activarModoEmbed NO oculta selects)
  const src = `${base}?sorteo=${encodeURIComponent(sorteo)}&embed=1`;

  embedCode.value =
`<iframe
  src="${src}"
  width="100%"
  height="1750"
  style="border:0;border-radius:12px;overflow:hidden"
  loading="lazy"
  referrerpolicy="no-referrer-when-downgrade"
></iframe>`;

  btnEmbed.disabled = false;
  btnEmbed.textContent = "Mostrar embed";
  embedBox.hidden = true;
}

// ===============================
// MODO EMBED (mantiene selects, oculta solo UI embed)
// ===============================
function activarModoEmbed() {
  // ✅ Mantener los selects (NO ocultamos .buscador)
  const footer = document.querySelector("footer");
  if (footer) footer.style.display = "none";

  // ❌ Ocultar la UI de embed dentro del iframe
  if (btnEmbed) btnEmbed.style.display = "none";
  if (embedBox) embedBox.style.display = "none";
  if (hint) hint.style.display = "none";
}

