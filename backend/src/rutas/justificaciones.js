/**
 * CU-23 Cargar justificacion (aprendiz, via enlace de 72 horas)
 * CU-24 Validar justificacion (instructor aprueba/rechaza)
 */
const express = require("express");
const pool = require("../config/db");
const { auditar } = require("../servicios/auditoria");
const { autenticar, autorizar } = require("../middleware/autenticar");

const router = express.Router();

// --- PUBLICO (acceso por token del correo, sin login) ---
router.get("/token/:token", async (req, res) => {
  const r = await pool.query(
    `SELECT j.id_justificacion, j.estado, j.expira_en, j.descripcion,
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
    return res.status(410).json({ mensaje: "El plazo de 72 horas para justificar venció", vencida: true });
  res.json(j);
});

router.post("/token/:token", async (req, res) => {
  try {
    const { descripcion, nombre_archivo, archivo_datos } = req.body;
    if (!descripcion?.trim()) return res.status(400).json({ mensaje: "Describe el motivo de tu inasistencia" });
    const r = await pool.query(
      `UPDATE justificacion SET descripcion = $1, nombre_archivo = $2, archivo_datos = $3,
        estado = 'enviada', enviada_en = NOW()
       WHERE token = $4 AND estado = 'pendiente' AND expira_en > NOW()
       RETURNING id_justificacion, id_asistencia`,
      [descripcion, nombre_archivo || null, archivo_datos || null, req.params.token]
    );
    if (!r.rows[0])
      return res.status(410).json({ mensaje: "El enlace ya fue usado o el plazo de 72 horas venció" });

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

// Bandeja del instructor/admin
router.get("/", autorizar("instructor", "administrador"), async (req, res) => {
  const filtro = req.usuario.rol === "instructor" ? "AND h.id_instructor = $1" : "";
  const valores = req.usuario.rol === "instructor" ? [req.usuario.id] : [];
  const r = await pool.query(
    `SELECT j.id_justificacion, j.estado, j.descripcion, j.nombre_archivo, j.enviada_en, j.expira_en,
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
  const r = await pool.query("SELECT nombre_archivo, archivo_datos FROM justificacion WHERE id_justificacion = $1", [req.params.id]);
  if (!r.rows[0]?.archivo_datos) return res.status(404).json({ mensaje: "Sin adjunto" });
  res.json(r.rows[0]);
});

// CU-24: aprobar / rechazar
router.patch("/:id", autorizar("instructor", "administrador"), async (req, res) => {
  const cliente = await pool.connect();
  try {
    const { estado } = req.body; // aprobada | rechazada
    if (!["aprobada", "rechazada"].includes(estado))
      return res.status(400).json({ mensaje: "Estado inválido" });
    await cliente.query("BEGIN");
    const r = await cliente.query(
      `UPDATE justificacion SET estado = $1, validada_por = $2, validada_en = NOW()
       WHERE id_justificacion = $3 AND estado = 'enviada'
       RETURNING id_asistencia`,
      [estado, req.usuario.id, req.params.id]
    );
    if (!r.rows[0]) {
      await cliente.query("ROLLBACK");
      return res.status(400).json({ mensaje: "La justificación no está pendiente de revisión" });
    }
    if (estado === "aprobada") {
      const asis = await cliente.query(
        "UPDATE asistencia SET estado = 'justificada' WHERE id_asistencia = $1 RETURNING id_aprendiz",
        [r.rows[0].id_asistencia]
      );
      await cliente.query(
        `INSERT INTO cambio_asistencia (id_asistencia, estado_anterior, estado_nuevo, motivo, cambiado_por)
         VALUES ($1,'ausente','justificada','Justificación aprobada',$2)`,
        [r.rows[0].id_asistencia, req.usuario.id]
      );
      await cliente.query(
        `INSERT INTO notificacion (id_usuario, tipo, titulo, mensaje)
         VALUES ($1,'justificacion','Justificación aprobada','Tu inasistencia quedó marcada como justificada.')`,
        [asis.rows[0].id_aprendiz]
      );
    } else {
      const asis = await cliente.query("SELECT id_aprendiz FROM asistencia WHERE id_asistencia = $1", [r.rows[0].id_asistencia]);
      await cliente.query(
        `INSERT INTO notificacion (id_usuario, tipo, titulo, mensaje)
         VALUES ($1,'justificacion','Justificación rechazada','Tu justificación fue rechazada. La inasistencia se mantiene.')`,
        [asis.rows[0].id_aprendiz]
      );
    }
    await cliente.query("COMMIT");
    await auditar(req.usuario.id, `justificacion_${estado}`, "justificacion", Number(req.params.id));
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
