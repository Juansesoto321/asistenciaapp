/**
 * ============================================================
 * SIMULADOR DEL LECTOR BIOMÉTRICO (ZKTeco K50)
 * ============================================================
 * Emula el dispositivo físico instalado en la pared del ambiente:
 *  - Envía un "heartbeat" periódico al servidor (CU-09)
 *  - Permite "poner el dedo" escribiendo el documento del aprendiz,
 *    que hace las veces de la huella capturada (CU-13)
 *
 * Cuando llegue el hardware real, este módulo se reemplaza por la
 * integración con el protocolo PUSH/ADMS de ZKTeco: el backend NO cambia.
 *
 * Uso:  node simulador.js [url_backend]
 *       (por defecto http://localhost:4000)
 */
const readline = require("readline");

const URL_BACKEND = process.argv[2] || process.env.URL_BACKEND || "http://localhost:4000";
const SERIAL = process.env.SERIAL_LECTOR || "LECTOR-001";
const CLAVE_API = process.env.CLAVE_API_LECTOR || "clave-simulador-demo";

const encabezados = {
  "Content-Type": "application/json",
  "x-serial": SERIAL,
  "x-clave-api": CLAVE_API,
};

async function heartbeat() {
  try {
    const r = await fetch(`${URL_BACKEND}/api/lector/heartbeat`, { method: "POST", headers: encabezados });
    if (!r.ok) console.log(`[heartbeat] rechazado (${r.status})`);
  } catch {
    console.log("[heartbeat] servidor no disponible");
  }
}

async function marcar(lectura) {
  try {
    const r = await fetch(`${URL_BACKEND}/api/lector/marcacion`, {
      method: "POST",
      headers: encabezados,
      body: JSON.stringify({ lectura }),
    });
    const datos = await r.json();
    const icono = { ok: "\u2705", duplicada: "\u26A0\uFE0F ", no_reconocida: "\u274C", sin_sesion: "\u23F8\uFE0F " }[datos.resultado] || "\u2139\uFE0F ";
    console.log(`${icono} ${datos.mensaje}`);
    // El K50 real confirma con luz verde/roja y sonido: aqui lo simula el icono
  } catch (e) {
    console.log("Error de red:", e.message);
  }
}

console.log(`
============================================================
  LECTOR BIOMÉTRICO SIMULADO · ${SERIAL}
  Conectado a: ${URL_BACKEND}
============================================================
  Escribe el DOCUMENTO del aprendiz y presiona Enter para
  simular que pone su dedo en el lector.

  Documentos de demostración:
    1027524931  Julieth Peña       1027524934  Santiago Bermudez
    1027524932  Julian Becerra     1027524935  Yordan Mendez
    1027524933  Juan Soto
    9999999999  (huella NO registrada, prueba CU-16)

  Comandos: "salir" para terminar
============================================================
`);

heartbeat();
setInterval(heartbeat, 30_000); // heartbeat cada 30 s

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: "huella> " });
rl.prompt();
rl.on("line", (linea) => {
  const texto = linea.trim();
  if (texto === "salir") process.exit(0);
  if (texto) marcar(texto);
  rl.prompt();
});
