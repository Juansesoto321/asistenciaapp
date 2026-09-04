/**
 * CU-23 Cargar justificacion (aprendiz, via enlace de 72 horas)
 * CU-24 Validar justificacion (instructor aprueba/rechaza)
 */
const express = require("express");
const pool = require("../config/db");
const { auditar } = require("../servicios/auditoria");
const { enviarCorreo } = require("../servicios/correo");
const { autenticar, autorizar } = require("../middleware/autenticar");

const router = express.Router();

const TIPOS_VALIDOS = ["cita_medica", "incapacidad_medica", "calamidad_domestica", "diligencia_legal", "duelo", "otro"];
const TIPOS_SIN_FOTO_OBLIGATORIA = ["calamidad_domestica", "duelo"];

// Texto legible del plazo configurado (ej. "5 días" o "18 horas")
async function textoPlazo() {
  const r = await pool.query("SELECT valor FROM configuracion WHERE clave = 'horas_justificacion'");
  const horas = Number(r.rows[0]?.valor || 72);
  return horas % 24 === 0 ? `${horas / 24} día(s)` : `${horas} horas`;
}

// --- PUBLICO (acceso por token del correo, sin login) ---
router.get("/token/:token", async (req, res) => {
  const r = await pool.query(
    `SELECT j.id_justificacion, j.estado, j.expira_en, j.tipo, j.descripcion,
            s.fecha, f.numero_ficha, f.programa, u.nombres, u.apellidos
     FROM justificacion j
     JOIN asistencia a ON a.id_asistencia = j.id_asistencia
     JOIN sesion_clase s ON s.id_sesion = a.id_sesion
     JOIN horario h ON h.id_horario = s.id_horario
     JOIN ficha f ON f.id_ficha = h.id_ficha
     JOIN usuario u ON u.id_usuario = a.id_aprendiz
     WHERE j.token = $1`,
    [req.params.token]
  );
  if (!r.rows[0]) return res.status(404).json({ mensaje: "Enlace de justificación no válido" });
  const j = r.rows[0];
  if (new Date(j.expira_en) < new Date() && j.estado === "pendiente")
    return res.status(410).json({ mensaje: `El plazo de ${await textoPlazo()} para justificar venció`, vencida: true });
  res.json(j);
});

router.post("/token/:token", async (req, res) => {
  try {
    const { tipo, descripcion, nombre_archivo, archivo_datos } = req.body;
    if (!TIPOS_VALIDOS.includes(tipo)) return res.status(400).json({ mensaje: "Selecciona un tipo de justificación válido" });
    if (!descripcion?.trim()) return res.status(400).json({ mensaje: "Describe el motivo de tu inasistencia" });
    const fotoObligatoria = !TIPOS_SIN_FOTO_OBLIGATORIA.includes(tipo);
    if (fotoObligatoria && !archivo_datos)
      return res.status(400).json({ mensaje: "Adjunta una foto del soporte para este tipo de justificación" });
    if (archivo_datos && !/^data:image\//.test(archivo_datos))
      return res.status(400).json({ mensaje: "El soporte debe ser una foto (imagen)" });
    const r = await pool.query(
      `UPDATE justificacion SET tipo = $1, descripcion = $2, nombre_archivo = $3, archivo_datos = $4,
        estado = 'enviada', enviada_en = NOW()
       WHERE token = $5 AND estado = 'pendiente' AND expira_en > NOW()
       RETURNING id_justificacion, id_asistencia`,
      [tipo, descripcion, nombre_archivo || null, archivo_datos || null, req.params.token]
    );
    if (!r.rows[0])
      return res.status(410).json({ mensaje: `El enlace ya fue usado o el plazo de ${await textoPlazo()} venció` });

    // Notificar al instructor titular
    await pool.query(
      `INSERT INTO notificacion (id_usuario, tipo, titulo, mensaje)
       SELECT h.id_instructor, 'justificacion', 'Nueva justificación por revisar',
              u.nombres || ' ' || u.apellidos || ' cargó una justificación de inasistencia.'
       FROM asistencia a
       JOIN sesion_clase s ON s.id_sesion = a.id_sesion
       JOIN horario h ON h.id_horario = s.id_horario
       JOIN usuario u ON u.id_usuario = a.id_aprendiz
       WHERE a.id_asistencia = $1`,
      [r.rows[0].id_asistencia]
    );
    res.json({ mensaje: "Justificación enviada. El instructor la revisará" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ mensaje: "Error al enviar la justificación" });
  }
});

// --- AUTENTICADO ---
router.use(autenticar);

// Un instructor solo puede ver/validar justificaciones de fichas donde es el titular; el admin, todas.
async function esPropietario(req, idJustificacion) {
  if (req.usuario.rol === "administrador") return true;
  const r = await pool.query(
    `SELECT 1 FROM justificacion j
     JOIN asistencia a ON a.id_asistencia = j.id_asistencia
     JOIN sesion_clase s ON s.id_sesion = a.id_sesion
     JOIN horario h ON h.id_horario = s.id_horario
     WHERE j.id_justificacion = $1 AND h.id_instructor = $2`,
    [idJustificacion, req.usuario.id]
  );
  return !!r.rows[0];
}

// Bandeja del instructor/admin
router.get("/", autorizar("instructor", "administrador"), async (req, res) => {
  const filtro = req.usuario.rol === "instructor" ? "AND h.id_instructor = $1" : "";
  const valores = req.usuario.rol === "instructor" ? [req.usuario.id] : [];
  const r = await pool.query(
    `SELECT j.id_justificacion, j.estado, j.tipo, j.descripcion, j.nombre_archivo, j.enviada_en, j.expira_en,
            j.observacion_validacion,
            s.fecha, f.numero_ficha, u.nombres, u.apellidos, u.documento
     FROM justificacion j
     JOIN asistencia a ON a.id_asistencia = j.id_asistencia
     JOIN sesion_clase s ON s.id_sesion = a.id_sesion
     JOIN horario h ON h.id_horario = s.id_horario
     JOIN ficha f ON f.id_ficha = h.id_ficha
     JOIN usuario u ON u.id_usuario = a.id_aprendiz
     WHERE j.estado IN ('enviada','aprobada','rechazada') ${filtro}
     ORDER BY j.enviada_en DESC NULLS LAST`,
    valores
  );
  res.json(r.rows);
});

// Descargar/ver adjunto
router.get("/:id/archivo", autorizar("instructor", "administrador"), async (req, res) => {
  if (!(await esPropietario(req, req.params.id)))
    return res.status(403).json({ mensaje: "No tienes permisos para ver este archivo" });
  const r = await pool.query("SELECT nombre_archivo, archivo_datos FROM justificacion WHERE id_justificacion = $1", [req.params.id]);
  if (!r.rows[0]?.archivo_datos) return res.status(404).json({ mensaje: "Sin adjunto" });
  res.json(r.rows[0]);
});

// CU-24: aprobar / rechazar
router.patch("/:id", autorizar("instructor", "administrador"), async (req, res) => {
  if (!(await esPropietario(req, req.params.id)))
    return res.status(403).json({ mensaje: "No tienes permisos para validar esta justificación" });
  const cliente = await pool.connect();
  try {
    const { estado, observacion } = req.body; // aprobada | rechazada
    if (!["aprobada", "rechazada"].includes(estado))
      return res.status(400).json({ mensaje: "Estado inválido" });
    if (estado === "rechazada" && !observacion?.trim())
      return res.status(400).json({ mensaje: "Explica por qué se rechaza la justificación" });

    await cliente.query("BEGIN");
    const r = await cliente.query(
      `UPDATE justificacion SET estado = $1, validada_por = $2, validada_en = NOW(), observacion_validacion = $3
       WHERE id_justificacion = $4 AND estado = 'enviada'
       RETURNING id_asistencia`,
      [estado, req.usuario.id, observacion?.trim() || null, req.params.id]
    );
    if (!r.rows[0]) {
      await cliente.query("ROLLBACK");
      return res.status(400).json({ mensaje: "La justificación no está pendiente de revisión" });
    }

    let aprendiz;
    if (estado === "aprobada") {
      const asis = await cliente.query(
        "UPDATE asistencia SET estado = 'justificada' WHERE id_asistencia = $1 RETURNING id_aprendiz",
        [r.rows[0].id_asistencia]
      );
      aprendiz = asis.rows[0].id_aprendiz;
      await cliente.query(
        `INSERT INTO cambio_asistencia (id_asistencia, estado_anterior, estado_nuevo, motivo, cambiado_por)
         VALUES ($1,'ausente','justificada','Justificación aprobada',$2)`,
        [r.rows[0].id_asistencia, req.usuario.id]
      );
      await cliente.query(
        `INSERT INTO notificacion (id_usuario, tipo, titulo, mensaje)
         VALUES ($1,'justificacion','Justificación aprobada','Tu inasistencia quedó marcada como justificada.')`,
        [aprendiz]
      );
    } else {
      const asis = await cliente.query("SELECT id_aprendiz FROM asistencia WHERE id_asistencia = $1", [r.rows[0].id_asistencia]);
      aprendiz = asis.rows[0].id_aprendiz;
      await cliente.query(
        `INSERT INTO notificacion (id_usuario, tipo, titulo, mensaje)
         VALUES ($1,'justificacion','Justificación rechazada',$2)`,
        [aprendiz, `Tu justificación fue rechazada. Motivo: ${observacion.trim()}`]
      );
    }
    await cliente.query("COMMIT");
    await auditar(req.usuario.id, `justificacion_${estado}`, "justificacion", Number(req.params.id));

    // Correo con el resultado (y el motivo, si fue rechazada)
    const u = await pool.query("SELECT nombres, correo FROM usuario WHERE id_usuario = $1", [aprendiz]);
    if (estado === "aprobada") {
      await enviarCorreo({
        para: u.rows[0].correo,
        asunto: "AsistenciaApp · Justificación aprobada",
        html: `<p>Hola ${u.rows[0].nombres},</p><p>Tu justificación fue <b>aprobada</b>. La inasistencia quedó marcada como "justificada".</p>`,
      });
    } else {
      await enviarCorreo({
        para: u.rows[0].correo,
        asunto: "AsistenciaApp · Justificación rechazada",
        html: `<p>Hola ${u.rows[0].nombres},</p>
               <p>Tu justificación fue <b>rechazada</b>.</p>
               <p><b>Motivo:</b> ${observacion.trim()}</p>
               <p>Puedes ver el detalle desde "Mi asistencia" en la plataforma.</p>`,
      });
    }

    res.json({ mensaje: `Justificación ${estado}` });
  } catch (e) {
    await cliente.query("ROLLBACK");
    console.error(e);
    res.status(500).json({ mensaje: "Error al validar la justificación" });
  } finally {
    cliente.release();
  }
});

module.exports = router;
