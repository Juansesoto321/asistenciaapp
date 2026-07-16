/**
 * Endpoint que consume el LECTOR BIOMETRICO (real o simulado).
 * Emula el protocolo PUSH de ZKTeco: el dispositivo envia las marcaciones
 * al servidor. Autenticacion por clave API del dispositivo.
 * CU-13 Marcar asistencia con huella · CU-16 Huella no reconocida · CU-09 heartbeat
 */
const express = require("express");
const pool = require("../config/db");
const { descifrar, generarTemplateSimulado } = require("../servicios/cifrado");
const { emitirASesion } = require("../servicios/tiempoReal");

const router = express.Router();

// Middleware: autenticar dispositivo por serial + clave API
async function autenticarDispositivo(req, res, next) {
  const serial = req.headers["x-serial"];
  const clave = req.headers["x-clave-api"];
  const r = await pool.query("SELECT * FROM dispositivo WHERE serial = $1 AND clave_api = $2", [serial, clave]);
  if (!r.rows[0]) return res.status(401).json({ mensaje: "Dispositivo no autorizado" });
  req.dispositivo = r.rows[0];
  next();
}

// CU-09: heartbeat del lector
router.post("/heartbeat", autenticarDispositivo, async (req, res) => {
  await pool.query(
    "UPDATE dispositivo SET estado = 'en_linea', ultimo_heartbeat = NOW() WHERE id_dispositivo = $1",
    [req.dispositivo.id_dispositivo]
  );
  res.json({ ok: true });
});

// CU-13: el lector envia una lectura de huella
router.post("/marcacion", autenticarDispositivo, async (req, res) => {
  try {
    const { lectura } = req.body; // en produccion: template del SDK; simulado: identificador del dedo
    const d = req.dispositivo;

    // 1. Buscar la sesion ACTIVA de hoy en el ambiente de este lector (CU-12 precondicion)
    const sesion = await pool.query(
      `SELECT s.id_sesion, s.hora_apertura, h.id_ficha, h.hora_inicio
       FROM sesion_clase s
       JOIN horario h ON h.id_horario = s.id_horario
       WHERE h.id_ambiente = $1 AND s.fecha = CURRENT_DATE AND s.estado = 'activa'
       ORDER BY s.hora_apertura DESC LIMIT 1`,
      [d.id_ambiente]
    );
    if (!sesion.rows[0])
      return res.status(409).json({ resultado: "sin_sesion", mensaje: "No hay una sesión de clase activa en este ambiente" });
    const s = sesion.rows[0];

    // 2. Matching 1:N contra las plantillas de los aprendices matriculados en la ficha
    const plantillas = await pool.query(
      `SELECT pb.*, u.id_usuario, u.nombres, u.apellidos
       FROM plantilla_biometrica pb
       JOIN usuario u ON u.id_usuario = pb.id_aprendiz
       JOIN matricula m ON m.id_aprendiz = u.id_usuario AND m.estado = 'activa'
       WHERE m.id_ficha = $1`,
      [s.id_ficha]
    );
    const templateLeido = generarTemplateSimulado(lectura);
    let aprendiz = null;
    for (const p of plantillas.rows) {
      try {
        if (descifrar(p) === templateLeido) { aprendiz = p; break; }
      } catch { /* plantilla corrupta: se ignora */ }
    }

    // CU-16: huella no reconocida -> alerta al instructor en tiempo real
    if (!aprendiz) {
      emitirASesion(s.id_sesion, "huella_no_reconocida", { hora: new Date() });
      return res.status(404).json({ resultado: "no_reconocida", mensaje: "Huella no reconocida. Reintenta (máximo 3 veces) o pide registro manual al instructor" });
    }

    // 3. Calcular estado segun tolerancia configurable (regla CU-13: 15 min por defecto)
    const conf = await pool.query("SELECT valor FROM configuracion WHERE clave = 'minutos_tolerancia'");
    const tolerancia = Number(conf.rows[0]?.valor || 15);
    const inicioClase = new Date(`${new Date().toISOString().slice(0, 10)}T${s.hora_inicio}`);
    const minutosTarde = (Date.now() - inicioClase.getTime()) / 60000;
    const estado = minutosTarde > tolerancia ? "tardanza" : "presente";

    // 4. Registrar (UNIQUE evita duplicados — regla CU-13 A2)
    const insercion = await pool.query(
      `INSERT INTO asistencia (id_sesion, id_aprendiz, estado, hora_marca, metodo)
       VALUES ($1,$2,$3,NOW(),'huella')
       ON CONFLICT (id_sesion, id_aprendiz) DO NOTHING
       RETURNING id_asistencia`,
      [s.id_sesion, aprendiz.id_usuario, estado]
    );
    if (!insercion.rows[0])
      return res.json({ resultado: "duplicada", mensaje: `${aprendiz.nombres}: asistencia ya registrada en esta sesión` });

    // 5. Actualizar la vista del instructor en tiempo real (CU-14)
    emitirASesion(s.id_sesion, "marcacion", {
      id_aprendiz: aprendiz.id_usuario,
      nombres: aprendiz.nombres,
      apellidos: aprendiz.apellidos,
      estado,
      hora_marca: new Date(),
      metodo: "huella",
    });

    res.json({
      resultado: "ok",
      mensaje: `${aprendiz.nombres} ${aprendiz.apellidos}: ${estado.toUpperCase()}`,
      estado,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ mensaje: "Error procesando la marcación" });
  }
});

module.exports = router;
