// ===============================
// CONFIGURACIÓN
// ===============================
const SHEET_ID = "1WGtZG2WWqJjGcJxIzR4-7Hl-090HZB7oxBWocX7A2w0";
const URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;

// ===============================
// DOM
// ===============================
const contenedor = document.getElementById("resultados");
const selectSorteo = document.getElementById("selectSorteo");
const selectFecha = document.getElementById("selectFecha");
const bannerTexto = document.getElementById("bannerTexto");
const bannerMonto = document.getElementById("bannerMonto");

// ===============================
// FETCH
// ===============================
fetch(URL)
  .then(r => r.text())
  .then(text => {
    const json = JSON.parse(text.substring(47).slice(0, -2));

    // MAPEO DE COLUMNAS (MODELO KINO)
    const colMap = {};
    json.table.cols.forEach((c, i) => {
      if (!c.label) return;
      const partes = c.label.trim().split(" ");
      const key = partes[0].toLowerCase();
      const logo = partes.find(p => p.startsWith("http")) || null;
      colMap[key] = { index: i, logo };
    });

    const data = json.table.rows
      .map(row => {
        const get = key => row.c[colMap[key]?.index]?.v || "";
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
            jubilazo50: { jugadas: parseJugadas(get("jubilazo50")), logo: colMap.jubilazo50?.logo }
          }
        };
      })
      .filter(Boolean)
      .sort((a, b) => Number(b.sorteo) - Number(a.sorteo));

    if (!data.length) {
      contenedor.innerHTML = "<p>No hay datos disponibles</p>";
      return;
    }

    cargarSelectores(data);
    render([data[0]]);
    renderBanner(data[0]);
  });

// ===============================
// HELPERS
// ===============================
function parseNums(v) {
  if (!v) return [];
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
  if (typeof f === "string" && f.startsWith("Date")) {
    const [, y, m, d] = f.match(/Date\((\d+),(\d+),(\d+)\)/);
    return `${d.padStart(2, "0")}-${String(+m + 1).padStart(2, "0")}-${y}`;
  }
  return f;
}

function normalizarMonto(m) {
  return Number(m?.toString().replace(/[^\d]/g, "")) || 0;
}

// ===============================
// RENDER
// ===============================
function render(data) {
  contenedor.innerHTML = "";

  data.forEach(s => {
    let html = `
      <div class="card">
        <h2>Sorteo LOTO ${s.sorteo}</h2>
        <small>${s.fecha}</small>
    `;

    for (const [key, juego] of Object.entries(s.juegos)) {

      if (juego.nums && juego.nums.length) {
        html += `
          <h3>${juego.logo ? `<img src="${juego.logo}">` : ""}${key.toUpperCase()}</h3>
          <div class="bolas">
            ${juego.nums.map(n => `<div class="bola">${n}</div>`).join("")}
          </div>
        `;
      }

      if (juego.jugadas && juego.jugadas.length) {
        html += `
          <h3>${juego.logo ? `<img src="${juego.logo}">` : ""}${key.toUpperCase()}</h3>
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
    contenedor.innerHTML += html;
  });
}

// ===============================
// SELECTORES
// ===============================
function cargarSelectores(data) {
  selectSorteo.innerHTML = `<option value="">Selecciona sorteo</option>`;
  selectFecha.innerHTML = `<option value="">Selecciona fecha</option>`;

  data.forEach(s => {
    selectSorteo.innerHTML += `<option value="${s.sorteo}">${s.sorteo}</option>`;
    selectFecha.innerHTML += `<option value="${s.fecha}">${s.fecha}</option>`;
  });

  selectSorteo.onchange = selectFecha.onchange = () => {
    const filtrado = data.filter(s =>
      (!selectSorteo.value || s.sorteo === selectSorteo.value) &&
      (!selectFecha.value || s.fecha === selectFecha.value)
    );

    if (filtrado.length) {
      render(filtrado);
      renderBanner(filtrado[0]);
    }
  };
}

// ===============================
// BANNER
// ===============================
function renderBanner(s) {
  bannerTexto.textContent = `Próximo Sorteo N° ${Number(s.sorteo) + 1}`;
  bannerMonto.textContent = `$${s.monto.toLocaleString("es-CL")}`;
}
