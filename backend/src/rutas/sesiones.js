/**
 * CU-12 Iniciar sesion de clase · CU-14 Supervisar en tiempo real
 * CU-15 Asistencia manual/override · cierre con generacion de justificaciones (72h)
 */
const express = require("express");
const crypto = require("crypto");
const pool = require("../config/db");
const { enviarCorreo } = require("../servicios/correo");
const { auditar } = require("../servicios/auditoria");
const { emitirASesion } = require("../servicios/tiempoReal");
const { autenticar, autorizar } = require("../middleware/autenticar");

const router = express.Router();
router.use(autenticar);

// Horarios de HOY del instructor, con estado de sesion
router.get("/hoy", autorizar("instructor", "administrador"), async (req, res) => {
  const dia = new Date().getDay();
  const filtro = req.usuario.rol === "instructor" ? "AND h.id_instructor = $2" : "";
  const valores = req.usuario.rol === "instructor" ? [dia, req.usuario.id] : [dia];
  const r = await pool.query(
    `SELECT h.id_horario, h.hora_inicio, h.hora_fin, f.numero_ficha, f.programa,
            a.numero_ambiente, s.id_sesion, s.estado AS estado_sesion
     FROM horario h
     JOIN ficha f ON f.id_ficha = h.id_ficha
     JOIN ambiente a ON a.id_ambiente = h.id_ambiente
     LEFT JOIN sesion_clase s ON s.id_horario = h.id_horario AND s.fecha = CURRENT_DATE
     WHERE h.dia_semana = $1 ${filtro}
     ORDER BY h.hora_inicio`,
    valores
  );
  res.json(r.rows);
});

// CU-12: iniciar (o reanudar) la sesion de hoy
router.post("/iniciar", autorizar("instructor", "administrador"), async (req, res) => {
  try {
    const { id_horario } = req.body;
    const h = await pool.query(
      `SELECT h.*, f.numero_ficha, d.estado AS estado_lector
       FROM horario h
       JOIN ficha f ON f.id_ficha = h.id_ficha
       LEFT JOIN dispositivo d ON d.id_ambiente = h.id_ambiente
       WHERE h.id_horario = $1`,
      [id_horario]
    );
    if (!h.rows[0]) return res.status(404).json({ mensaje: "Horario no encontrado" });
    // Regla CU-12: solo el instructor titular (o un administrador)
    if (req.usuario.rol === "instructor" && h.rows[0].id_instructor !== req.usuario.id)
      return res.status(403).json({ mensaje: "Solo el instructor titular puede iniciar esta sesión" });

    const r = await pool.query(
      `INSERT INTO sesion_clase (id_horario, fecha)
       VALUES ($1, CURRENT_DATE)
       ON CONFLICT (id_horario, fecha) DO UPDATE SET estado = sesion_clase.estado
       RETURNING id_sesion, estado`,
      [id_horario]
    );
    const sesion = r.rows[0];
    if (sesion.estado === "cerrada")
      return res.status(400).json({ mensaje: "La sesión de hoy ya fue cerrada" });

    await auditar(req.usuario.id, "iniciar_sesion_clase", "sesion_clase", sesion.id_sesion);
    res.json({
      id_sesion: sesion.id_sesion,
      lector: h.rows[0].estado_lector || "sin_lector",
      mensaje: h.rows[0].estado_lector === "en_linea"
        ? "Sesión activa. Lector en línea, listo para capturar huellas"
        : "Sesión activa. El lector no está en línea: puedes usar registro manual",
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ mensaje: "Error al iniciar la sesión" });
  }
});

// CU-14: detalle de la sesion (lista completa con estados)
router.get("/:id", async (req, res) => {
  const r = await pool.query(
    `SELECT s.id_sesion, s.fecha, s.estado, s.hora_apertura, s.hora_cierre,
            h.hora_inicio, h.hora_fin, f.numero_ficha, f.programa, a.numero_ambiente
     FROM sesion_clase s
     JOIN horario h ON h.id_horario = s.id_horario
     JOIN ficha f ON f.id_ficha = h.id_ficha
     JOIN ambiente a ON a.id_ambiente = h.id_ambiente
     WHERE s.id_sesion = $1`,
    [req.params.id]
  );
  if (!r.rows[0]) return res.status(404).json({ mensaje: "Sesión no encontrada" });
  const aprendices = await pool.query(
    `SELECT u.id_usuario, u.nombres, u.apellidos, u.documento,
            asi.estado, asi.hora_marca, asi.metodo, asi.observacion,
            (pb.id_plantilla IS NOT NULL) AS tiene_huella
     FROM matricula m
     JOIN usuario u ON u.id_usuario = m.id_aprendiz
     JOIN sesion_clase s ON s.id_sesion = $1
     JOIN horario h ON h.id_horario = s.id_horario AND h.id_ficha = m.id_ficha
     LEFT JOIN asistencia asi ON asi.id_sesion = s.id_sesion AND asi.id_aprendiz = u.id_usuario
     LEFT JOIN plantilla_biometrica pb ON pb.id_aprendiz = u.id_usuario
     WHERE m.estado = 'activa'
     ORDER BY u.apellidos`,
    [req.params.id]
  );
  res.json({ ...r.rows[0], aprendices: aprendices.rows });
});

// CU-15: registro manual / override (con justificacion obligatoria)
router.post("/:id/asistencia-manual", autorizar("instructor", "administrador"), async (req, res) => {
  const cliente = await pool.connect();
  try {
    const { id_aprendiz, estado, motivo } = req.body;
    if (!motivo?.trim())
      return res.status(400).json({ mensaje: "Todo registro manual requiere una justificación (regla CU-15)" });
    if (!["presente", "tardanza", "ausente", "justificada"].includes(estado))
      return res.status(400).json({ mensaje: "Estado inválido" });

    // Regla CU-15: instructor solo dentro de 24h del cierre; admin siempre
    const s = await pool.query("SELECT estado, hora_cierre FROM sesion_clase WHERE id_sesion = $1", [req.params.id]);
    if (!s.rows[0]) return res.status(404).json({ mensaje: "Sesión no encontrada" });
    if (req.usuario.rol === "instructor" && s.rows[0].estado === "cerrada") {
      const horas = (Date.now() - new Date(s.rows[0].hora_cierre).getTime()) / 3600000;
      if (horas > 24)
        return res.status(403).json({ mensaje: "Pasadas 24 horas del cierre, solo el administrador puede modificar" });
    }

    await cliente.query("BEGIN");
    const existente = await cliente.query(
      "SELECT id_asistencia, estado FROM asistencia WHERE id_sesion = $1 AND id_aprendiz = $2",
      [req.params.id, id_aprendiz]
    );
    let idAsistencia;
    if (existente.rows[0]) {
      idAsistencia = existente.rows[0].id_asistencia;
      await cliente.query(
        `UPDATE asistencia SET estado = $1, metodo = 'manual', observacion = $2,
          registrado_por = $3, hora_marca = COALESCE(hora_marca, NOW())
         WHERE id_asistencia = $4`,
        [estado, motivo, req.usuario.id, idAsistencia]
      );
      await cliente.query(
        `INSERT INTO cambio_asistencia (id_asistencia, estado_anterior, estado_nuevo, motivo, cambiado_por)
         VALUES ($1,$2,$3,$4,$5)`,
        [idAsistencia, existente.rows[0].estado, estado, motivo, req.usuario.id]
      );
    } else {
      const ins = await cliente.query(
        `INSERT INTO asistencia (id_sesion, id_aprendiz, estado, hora_marca, metodo, observacion, registrado_por)
         VALUES ($1,$2,$3,NOW(),'manual',$4,$5) RETURNING id_asistencia`,
        [req.params.id, id_aprendiz, estado, motivo, req.usuario.id]
      );
      idAsistencia = ins.rows[0].id_asistencia;
      await cliente.query(
        `INSERT INTO cambio_asistencia (id_asistencia, estado_anterior, estado_nuevo, motivo, cambiado_por)
         VALUES ($1,NULL,$2,$3,$4)`,
        [idAsistencia, estado, motivo, req.usuario.id]
      );
    }
    await cliente.query("COMMIT");

    const u = await pool.query("SELECT nombres, apellidos FROM usuario WHERE id_usuario = $1", [id_aprendiz]);
    emitirASesion(req.params.id, "marcacion", {
      id_aprendiz, nombres: u.rows[0].nombres, apellidos: u.rows[0].apellidos,
      estado, hora_marca: new Date(), metodo: "manual",
    });
    await auditar(req.usuario.id, "asistencia_manual", "asistencia", idAsistencia, { estado, motivo });
    res.json({ mensaje: "Asistencia registrada manualmente" });
  } catch (e) {
    await cliente.query("ROLLBACK");
    console.error(e);
    res.status(500).json({ mensaje: "Error en el registro manual" });
  } finally {
    cliente.release();
  }
});

// Cierre de sesion: marca ausentes + genera enlaces de justificacion (72h) + notifica
router.post("/:id/cerrar", autorizar("instructor", "administrador"), async (req, res) => {
  const cliente = await pool.connect();
  try {
    const s = await pool.query(
      `SELECT s.*, h.id_ficha, h.id_instructor, f.numero_ficha
       FROM sesion_clase s JOIN horario h ON h.id_horario = s.id_horario
       JOIN ficha f ON f.id_ficha = h.id_ficha
       WHERE s.id_sesion = $1`,
      [req.params.id]
    );
    if (!s.rows[0]) return res.status(404).json({ mensaje: "Sesión no encontrada" });
    if (s.rows[0].estado === "cerrada") return res.status(400).json({ mensaje: "La sesión ya está cerrada" });
    if (req.usuario.rol === "instructor" && s.rows[0].id_instructor !== req.usuario.id)
      return res.status(403).json({ mensaje: "Solo el instructor titular puede cerrar la sesión" });

    await cliente.query("BEGIN");
    // Marcar ausentes a quienes no registraron (CU-14 paso 5)
    const ausentes = await cliente.query(
      `INSERT INTO asistencia (id_sesion, id_aprendiz, estado, metodo)
       SELECT $1, m.id_aprendiz, 'ausente', 'sistema'
       FROM matricula m
       WHERE m.id_ficha = $2 AND m.estado = 'activa'
         AND NOT EXISTS (SELECT 1 FROM asistencia a WHERE a.id_sesion = $1 AND a.id_aprendiz = m.id_aprendiz)
       RETURNING id_asistencia, id_aprendiz`,
      [req.params.id, s.rows[0].id_ficha]
    );
    await cliente.query(
      "UPDATE sesion_clase SET estado = 'cerrada', hora_cierre = NOW(), cerrada_por = $1 WHERE id_sesion = $2",
      [req.usuario.id, req.params.id]
    );

    // Por cada ausente: enlace de justificacion valido por 72 horas + correo + notificacion
    const horasConf = await cliente.query("SELECT valor FROM configuracion WHERE clave = 'horas_justificacion'");
    const horas = Number(horasConf.rows[0]?.valor || 72);
    for (const a of ausentes.rows) {
      const token = crypto.randomBytes(24).toString("hex");
      await cliente.query(
        `INSERT INTO justificacion (id_asistencia, token, expira_en)
         VALUES ($1,$2, NOW() + ($3 || ' hours')::interval)`,
        [a.id_asistencia, token, horas]
      );
      const u = await cliente.query("SELECT nombres, correo FROM usuario WHERE id_usuario = $1", [a.id_aprendiz]);
      const enlace = `${process.env.URL_FRONTEND}/justificar/${token}`;
      await enviarCorreo({
        para: u.rows[0].correo,
        asunto: `AsistenciaApp · Inasistencia registrada (ficha ${s.rows[0].numero_ficha})`,
        html: `<p>Hola ${u.rows[0].nombres},</p>
               <p>Se registró tu <b>inasistencia</b> a la clase de hoy de la ficha ${s.rows[0].numero_ficha}.</p>
               <p>Si tienes una excusa (por ejemplo, cita médica), cárgala en el siguiente enlace.
               <b>Disponible solo por ${horas} horas</b>; después quedará como "sin justificación":</p>
               <p><a href="${enlace}">${enlace}</a></p>`,
      });
      await cliente.query(
        `INSERT INTO notificacion (id_usuario, tipo, titulo, mensaje)
         VALUES ($1,'inasistencia','Inasistencia registrada',
                 'Faltaste a la clase de hoy. Revisa tu correo: tienes ${horas} horas para cargar una justificación.')`,
        [a.id_aprendiz]
      );
    }
    await cliente.query("COMMIT");
    await auditar(req.usuario.id, "cerrar_sesion_clase", "sesion_clase", Number(req.params.id), { ausentes: ausentes.rows.length });
    res.json({ mensaje: `Sesión cerrada. ${ausentes.rows.length} aprendiz(es) marcados como ausentes y notificados` });
  } catch (e) {
    await cliente.query("ROLLBACK");
    console.error(e);
    res.status(500).json({ mensaje: "Error al cerrar la sesión" });
  } finally {
    cliente.release();
  }
});

module.exports = router;
