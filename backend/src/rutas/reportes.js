/**
 * CU-17 Busqueda avanzada · CU-18 Exportar · CU-19 Historial del aprendiz
 * + estadisticas del dashboard
 */
const express = require("express");
const pool = require("../config/db");
const { autenticar, autorizar } = require("../middleware/autenticar");

const router = express.Router();
router.use(autenticar);

function construirBusqueda(req) {
  const { nombre, id_ficha, id_instructor, estado, fecha_inicio, fecha_fin, pct_min, pct_max } = req.query;
  const condiciones = [];
  const valores = [];
  const add = (sql, val) => { valores.push(val); condiciones.push(sql.replace("?", `$${valores.length}`)); };

  if (nombre) add("(u.nombres ILIKE ? OR u.apellidos ILIKE ? OR u.documento ILIKE ?)".replaceAll("?", `$${valores.length + 1}`), `%${nombre}%`);
  if (id_ficha) add("f.id_ficha = ?", id_ficha);
  if (id_instructor) add("h.id_instructor = ?", id_instructor);
  if (estado) add("a.estado = ?", estado);
  if (fecha_inicio) add("s.fecha >= ?", fecha_inicio);
  if (fecha_fin) add("s.fecha <= ?", fecha_fin);
  // Regla CU-17: el instructor solo consulta sus fichas
  if (req.usuario.rol === "instructor") add("h.id_instructor = ?", req.usuario.id);

  const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
  const sql = `
    SELECT a.id_asistencia, s.fecha, u.nombres || ' ' || u.apellidos AS aprendiz, u.documento,
           f.numero_ficha, a.estado, TO_CHAR(a.hora_marca AT TIME ZONE 'America/Bogota','HH24:MI') AS hora,
           a.metodo, a.observacion
    FROM asistencia a
    JOIN sesion_clase s ON s.id_sesion = a.id_sesion
    JOIN horario h ON h.id_horario = s.id_horario
    JOIN ficha f ON f.id_ficha = h.id_ficha
    JOIN usuario u ON u.id_usuario = a.id_aprendiz
    ${where}
    ORDER BY s.fecha DESC, u.apellidos`;
  return { sql, valores, pct_min, pct_max };
}

// CU-17
router.get("/busqueda", autorizar("administrador", "instructor"), async (req, res) => {
  try {
    const { sql, valores } = construirBusqueda(req);
    const r = await pool.query(sql, valores);
    res.json(r.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ mensaje: "Error en la búsqueda" });
  }
});

// CU-18: exportar CSV (abre en Excel)
router.get("/exportar", autorizar("administrador", "instructor"), async (req, res) => {
  const { sql, valores } = construirBusqueda(req);
  const r = await pool.query(sql, valores);
  const encabezado = "Fecha;Aprendiz;Documento;Ficha;Estado;Hora;Método;Observación\n";
  const filas = r.rows.map(f =>
    [f.fecha.toISOString().slice(0,10), f.aprendiz, f.documento, f.numero_ficha, f.estado, f.hora || "", f.metodo, (f.observacion || "").replace(/;/g, ",")].join(";")
  ).join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=reporte_asistencia.csv");
  res.send("\uFEFF" + encabezado + filas);
});

// Busquedas guardadas (CU-17 paso 6)
router.get("/busquedas-guardadas", async (req, res) => {
  const r = await pool.query("SELECT * FROM busqueda_guardada WHERE id_usuario = $1 ORDER BY creado_en DESC", [req.usuario.id]);
  res.json(r.rows);
});
router.post("/busquedas-guardadas", async (req, res) => {
  const { nombre, filtros } = req.body;
  const r = await pool.query(
    "INSERT INTO busqueda_guardada (id_usuario, nombre, filtros) VALUES ($1,$2,$3) RETURNING *",
    [req.usuario.id, nombre, JSON.stringify(filtros)]
  );
  res.status(201).json(r.rows[0]);
});

// CU-19: historial del aprendiz (solo sus datos)
router.get("/mi-historial", autorizar("aprendiz"), async (req, res) => {
  const fichas = await pool.query(
    `SELECT f.id_ficha, f.numero_ficha, f.programa, m.estado AS estado_matricula
     FROM matricula m JOIN ficha f ON f.id_ficha = m.id_ficha
     WHERE m.id_aprendiz = $1 ORDER BY m.fecha_matricula DESC`,
    [req.usuario.id]
  );
  const idFicha = req.query.id_ficha || fichas.rows[0]?.id_ficha;
  let detalle = [], resumen = null;
  if (idFicha) {
    const r = await pool.query(
      `SELECT s.fecha, a.estado, TO_CHAR(a.hora_marca AT TIME ZONE 'America/Bogota','HH24:MI') AS hora,
              a.metodo, a.observacion
       FROM asistencia a
       JOIN sesion_clase s ON s.id_sesion = a.id_sesion
       JOIN horario h ON h.id_horario = s.id_horario
       WHERE a.id_aprendiz = $1 AND h.id_ficha = $2
       ORDER BY s.fecha DESC`,
      [req.usuario.id, idFicha]
    );
    detalle = r.rows;
    const total = detalle.length;
    const asistidas = detalle.filter(d => ["presente", "tardanza", "justificada"].includes(d.estado)).length;
    const conf = await pool.query("SELECT valor FROM configuracion WHERE clave = 'porcentaje_minimo'");
    resumen = {
      total,
      presentes: detalle.filter(d => d.estado === "presente").length,
      tardanzas: detalle.filter(d => d.estado === "tardanza").length,
      ausencias: detalle.filter(d => d.estado === "ausente").length,
      justificadas: detalle.filter(d => d.estado === "justificada").length,
      porcentaje: total ? Math.round((asistidas / total) * 100) : 100,
      minimo: Number(conf.rows[0]?.valor || 80), // regla CU-19: resaltar bajo el minimo
    };
  }
  res.json({ fichas: fichas.rows, id_ficha: idFicha ? Number(idFicha) : null, detalle, resumen });
});

// Estadisticas para el dashboard del admin/instructor
router.get("/estadisticas", autorizar("administrador", "instructor"), async (req, res) => {
  const filtro = req.usuario.rol === "instructor" ? "AND h.id_instructor = $1" : "";
  const valores = req.usuario.rol === "instructor" ? [req.usuario.id] : [];
  const r = await pool.query(
    `SELECT
      (SELECT COUNT(*) FROM ficha WHERE estado = 'activa' ${req.usuario.rol === "instructor" ? "AND id_instructor = $1" : ""}) AS fichas_activas,
      (SELECT COUNT(DISTINCT m.id_aprendiz) FROM matricula m JOIN ficha f ON f.id_ficha = m.id_ficha
        WHERE m.estado = 'activa' ${req.usuario.rol === "instructor" ? "AND f.id_instructor = $1" : ""}) AS aprendices_activos,
      (SELECT COUNT(*) FROM sesion_clase s JOIN horario h ON h.id_horario = s.id_horario
        WHERE s.fecha = CURRENT_DATE ${filtro}) AS sesiones_hoy,
      COALESCE((SELECT ROUND(AVG(CASE WHEN a.estado IN ('presente','tardanza','justificada') THEN 100 ELSE 0 END))
        FROM asistencia a JOIN sesion_clase s ON s.id_sesion = a.id_sesion
        JOIN horario h ON h.id_horario = s.id_horario WHERE TRUE ${filtro}), 0) AS promedio_asistencia`,
    valores
  );
  res.json(r.rows[0]);
});

module.exports = router;
