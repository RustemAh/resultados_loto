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

const inputSorteo = document.getElementById("inputSorteo");
const btnBuscar = document.getElementById("btnBuscar");

const embedBox = document.getElementById("embedBox");
const embedCode = document.getElementById("embedCode");
const copyEmbed = document.getElementById("copyEmbed");
const hint = document.getElementById("hint");

let ALL_DATA = [];

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

    // ❌ Ya no renderizamos el primer sorteo automáticamente
    contenedor.innerHTML = "";
    embedBox.hidden = true;
    if (hint) hint.style.display = "block";

    // Soporte para embed: ?sorteo=XXXX&embed=1
    const params = new URLSearchParams(location.search);
    const sorteoParam = params.get("sorteo");
    const embedMode = params.get("embed") === "1";

    if (embedMode) activarModoEmbed();

    if (sorteoParam) {
      mostrarPorSorteo(sorteoParam);
      // sincroniza input/select visualmente si existe
      if (inputSorteo) inputSorteo.value = sorteoParam;
      if (selectSorteo) selectSorteo.value = sorteoParam;
    }
  })
  .catch(err => {
    console.error(err);
    contenedor.innerHTML = "<p>Error cargando datos. Intenta nuevamente.</p>";
  });

// ===============================
// EVENTOS
// ===============================
selectSorteo.addEventListener("change", () => {
  const val = selectSorteo.value;
  if (!val) return limpiarVista();
  mostrarPorSorteo(val);
  if (inputSorteo) inputSorteo.value = val;
});

selectFecha.addEventListener("change", () => {
  const fecha = selectFecha.value;
  if (!fecha) return limpiarVista();

  const items = ALL_DATA.filter(x => x.fecha === fecha);
  if (!items.length) return;

  // si hay varios sorteos en esa fecha, muestra todos
  render(items);
  renderBanner(items[0]);
  if (hint) hint.style.display = "none";

  // sincroniza sorteo al más reciente de esa fecha
  selectSorteo.value = items[0].sorteo;
  if (inputSorteo) inputSorteo.value = items[0].sorteo;

  // embed del primero (más reciente) de esa fecha
  actualizarEmbed(items[0].sorteo);
});

btnBuscar?.addEventListener("click", () => {
  const val = (inputSorteo?.value || "").trim();
  if (!val) return;
  mostrarPorSorteo(val);
  selectSorteo.value = val; // aunque no exista en select, no pasa nada
});

inputSorteo?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") btnBuscar?.click();
});

copyEmbed?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(embedCode.value);
    copyEmbed.textContent = "Copiado ✅";
    setTimeout(() => (copyEmbed.textContent = "Copiar"), 1200);
  } catch {
    // fallback: seleccionar texto
    embedCode.focus();
    embedCode.select();
  }
});

// ===============================
// LÓGICA PRINCIPAL
// ===============================
function mostrarPorSorteo(sorteo) {
  const item = ALL_DATA.find(x => x.sorteo === String(sorteo));

  if (hint) hint.style.display = "none";

  if (item) {
    render([item]);
    renderBanner(item);

    // sincroniza fecha
    if (selectFecha) selectFecha.value = item.fecha;

    actualizarEmbed(item.sorteo);
  } else {
    // ✅ No hay datos: mostrar mensaje solicitado
    renderSinDatos(sorteo);
    renderBannerSinDatos(sorteo);

    actualizarEmbed(String(sorteo)); // igual generamos embed para ese sorteo
  }
}

function limpiarVista() {
  contenedor.innerHTML = "";
  embedBox.hidden = true;
  if (hint) hint.style.display = "block";
  // opcional: reset de banner
  bannerTexto.textContent = "Próximo Sorteo";
  bannerMonto.textContent = "$0";
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
// BANNER
// ===============================
function renderBanner(s) {
  bannerTexto.textContent = `Próximo Sorteo N° ${Number(s.sorteo) + 1}`;

  // si viene en pesos grandes, convierto a millones
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
  // Genera iframe apuntando a esta misma página en modo embed
  const base = `${location.origin}${location.pathname}`;
  const src = `${base}?sorteo=${encodeURIComponent(sorteo)}&embed=1`;

  embedCode.value =
`<iframe
  src="${src}"
  width="100%"
  height="700"
  style="border:0;border-radius:12px;overflow:hidden"
  loading="lazy"
  referrerpolicy="no-referrer-when-downgrade"
></iframe>`;

  embedBox.hidden = false;
}

function activarModoEmbed() {
  // oculta buscador/footer/hint para que se vea limpio dentro del iframe
  const buscador = document.querySelector(".buscador");
  const footer = document.querySelector("footer");
  if (buscador) buscador.style.display = "none";
  if (footer) footer.style.display = "none";
  if (hint) hint.style.display = "none";
}

