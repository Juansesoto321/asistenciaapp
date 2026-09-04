/**
 * Adaptador del protocolo real ZKTeco PUSH/ADMS (iClock) para lectores fisicos
 * como el SenseFace 2A. A diferencia del simulador (/api/lector), aqui el
 * dispositivo hace el matching de huella/rostro EN SI MISMO y solo envia el
 * PIN del usuario ya identificado - nunca una plantilla biometrica cruda.
 *
 * Convencion: el PIN con el que se matricula a cada aprendiz EN EL DISPOSITIVO
 * debe ser su numero de documento (asi el backend sabe a quien corresponde).
 *
 * Rutas fijas por el protocolo (no llevan prefijo /api ni autenticacion por
 * header - el dispositivo identifica con el parametro SN=<serial>):
 *   GET  /iclock/cdata        -> handshake / opciones al encender o reconectar
 *   POST /iclock/cdata        -> carga de registros de asistencia (ATTLOG)
 *   GET  /iclock/getrequest   -> heartbeat / sondeo de comandos pendientes
 *   POST /iclock/devicecmd    -> confirmacion de comandos (no usado por ahora)
 */
const express = require("express");
const pool = require("../config/db");
const { emitirASesion } = require("../servicios/tiempoReal");

const router = express.Router();
router.use(express.text({ type: "*/*" }));

async function buscarDispositivo(sn) {
  const r = await pool.query("SELECT * FROM dispositivo WHERE serial = $1", [sn]);
  return r.rows[0] || null;
}

async function marcarEnLinea(idDispositivo) {
  await pool.query(
    "UPDATE dispositivo SET estado = 'en_linea', ultimo_heartbeat = NOW() WHERE id_dispositivo = $1",
    [idDispositivo]
  );
}

// Handshake: el dispositivo pide su configuracion al conectar
router.get("/cdata", async (req, res) => {
  const sn = req.query.SN;
  console.log(`[ADMS] Handshake de dispositivo SN=${sn}`);
  const d = await buscarDispositivo(sn);
  if (d) await marcarEnLinea(d.id_dispositivo);
  else console.warn(`[ADMS] SN desconocido (no esta en la tabla dispositivo): ${sn}`);

  // Formato verificado contra un SenseFace 2A real (firmware ZAM70-NF24HA-Ver3.3.12):
  // TransFlag debe ser texto ("TransData AttLog<TAB>OpLog"), no una mascara binaria,
  // y no debe llevar campos extra (ServerVer/PushProtVer/etc.) que el equipo no espera.
  const lineas = [
    `GET OPTION FROM: ${sn}`,
    "Stamp=9999",
    "ATTLOGStamp=9999",
    "OPERLOGStamp=9999",
    "ErrorDelay=30",
    "Delay=10",
    "TransTimes=00:00;23:59",
    "TransInterval=1",
    "TransFlag=TransData AttLog\tOpLog",
    "TimeZone=-5",
    "Realtime=1",
    "Encrypt=None",
    "0",
  ];
  res.type("text/plain").send(lineas.join("\n"));
});

// Carga de registros de asistencia (ATTLOG) - cuerpo en texto plano,
// una marcacion por linea, campos separados por tabulador:
// PIN \t Fecha-Hora \t Estado \t Verificacion \t ...
router.post("/cdata", async (req, res) => {
  const sn = req.query.SN;
  const tabla = req.query.table;
  console.log(`[ADMS] POST cdata SN=${sn} table=${tabla}`);

  if (tabla !== "ATTLOG") {
    // OPERLOG, USERINFO, etc: por ahora solo se confirman, no se procesan
    return res.type("text/plain").send("OK");
  }

  const d = await buscarDispositivo(sn);
  if (!d) {
    console.warn(`[ADMS] Marcacion de un SN no registrado: ${sn}`);
    return res.type("text/plain").send("OK"); // se confirma igual para que el equipo no reintente en bucle
  }
  await marcarEnLinea(d.id_dispositivo);

  const cuerpo = typeof req.body === "string" ? req.body : "";
  const lineas = cuerpo.split(/\r?\n/).filter((l) => l.trim());
  console.log(`[ADMS] ${lineas.length} registro(s) de asistencia recibidos`);

  for (const linea of lineas) {
    const campos = linea.split("\t");
    const pin = campos[0]?.trim();
    if (!pin) continue;
    try {
      await procesarMarcacion({ pin, idAmbiente: d.id_ambiente });
    } catch (e) {
      console.error(`[ADMS] Error procesando marcacion de PIN ${pin}:`, e.message);
    }
  }

  res.type("text/plain").send("OK");
});

// Heartbeat / sondeo de comandos pendientes (el dispositivo pregunta seguido)
router.get("/getrequest", async (req, res) => {
  const sn = req.query.SN;
  const d = await buscarDispositivo(sn);
  if (d) await marcarEnLinea(d.id_dispositivo);
  res.type("text/plain").send("OK"); // sin comandos pendientes
});

// Confirmacion de comandos (no enviamos comandos al dispositivo por ahora)
router.post("/devicecmd", (_req, res) => res.type("text/plain").send("OK"));

/**
 * Misma logica de negocio que /api/lector/marcacion (sesion activa, tolerancia,
 * insercion sin duplicados, notificacion en vivo), pero identificando al
 * aprendiz por PIN=documento en vez de comparar una plantilla biometrica -
 * el matching de huella/rostro ya lo hizo el dispositivo.
 */
async function procesarMarcacion({ pin, idAmbiente }) {
  const sesion = await pool.query(
    `SELECT s.id_sesion, h.id_ficha, h.hora_inicio
     FROM sesion_clase s
     JOIN horario h ON h.id_horario = s.id_horario
     WHERE h.id_ambiente = $1 AND s.fecha = CURRENT_DATE AND s.estado = 'activa'
     ORDER BY s.hora_apertura DESC LIMIT 1`,
    [idAmbiente]
  );
  if (!sesion.rows[0]) {
    console.warn(`[ADMS] PIN ${pin} marco pero no hay sesion activa en ese ambiente`);
    return;
  }
  const s = sesion.rows[0];

  const aprendiz = await pool.query(
    `SELECT u.id_usuario, u.nombres, u.apellidos
     FROM usuario u
     JOIN matricula m ON m.id_aprendiz = u.id_usuario AND m.estado = 'activa'
     WHERE u.documento = $1 AND m.id_ficha = $2`,
    [pin, s.id_ficha]
  );
  if (!aprendiz.rows[0]) {
    console.warn(`[ADMS] PIN ${pin} no corresponde a ningun aprendiz matriculado en la ficha de esta sesion`);
    emitirASesion(s.id_sesion, "huella_no_reconocida", { hora: new Date(), pin });
    return;
  }
  const ap = aprendiz.rows[0];

  const conf = await pool.query("SELECT valor FROM configuracion WHERE clave = 'minutos_tolerancia'");
  const tolerancia = Number(conf.rows[0]?.valor || 15);
  const inicioClase = new Date(`${new Date().toISOString().slice(0, 10)}T${s.hora_inicio}`);
  const minutosTarde = (Date.now() - inicioClase.getTime()) / 60000;
  const estado = minutosTarde > tolerancia ? "tardanza" : "presente";

  const insercion = await pool.query(
    `INSERT INTO asistencia (id_sesion, id_aprendiz, estado, hora_marca, metodo)
     VALUES ($1,$2,$3,NOW(),'huella')
     ON CONFLICT (id_sesion, id_aprendiz) DO NOTHING
     RETURNING id_asistencia`,
    [s.id_sesion, ap.id_usuario, estado]
  );
  if (!insercion.rows[0]) {
    console.log(`[ADMS] ${ap.nombres}: ya tenia asistencia registrada en esta sesion`);
    return;
  }

  emitirASesion(s.id_sesion, "marcacion", {
    id_aprendiz: ap.id_usuario,
    nombres: ap.nombres,
    apellidos: ap.apellidos,
    estado,
    hora_marca: new Date(),
    metodo: "huella",
  });
  console.log(`[ADMS] ${ap.nombres} ${ap.apellidos}: ${estado.toUpperCase()}`);
}

module.exports = router;
