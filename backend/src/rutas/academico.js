/**
 * CU-05 Gestionar fichas · CU-06 Matricular · CU-07 Ambientes y lectores
 * CU-08 Horarios · CU-09 Monitorear lectores
 */
const express = require("express");
const crypto = require("crypto");
const pool = require("../config/db");
const { auditar } = require("../servicios/auditoria");
const { autenticar, autorizar } = require("../middleware/autenticar");

const router = express.Router();
router.use(autenticar);

// ---------- PERIODOS ----------
router.get("/periodos", async (_req, res) => {
  const r = await pool.query("SELECT * FROM periodo ORDER BY fecha_inicio DESC");
  res.json(r.rows);
});
router.post("/periodos", autorizar("administrador"), async (req, res) => {
  const { nombre, fecha_inicio, fecha_fin } = req.body;
  const r = await pool.query(
    "INSERT INTO periodo (nombre, fecha_inicio, fecha_fin) VALUES ($1,$2,$3) RETURNING *",
    [nombre, fecha_inicio, fecha_fin]
  );
  res.status(201).json(r.rows[0]);
});

// ---------- FICHAS (CU-05) ----------
router.get("/fichas", async (req, res) => {
  // Regla CU-17: el instructor solo ve sus fichas
  const filtroInstructor = req.usuario.rol === "instructor" ? "WHERE f.id_instructor = $1" : "";
  const valores = req.usuario.rol === "instructor" ? [req.usuario.id] : [];
  const r = await pool.query(
    `SELECT f.*, p.nombre AS periodo,
            u.nombres || ' ' || u.apellidos AS instructor,
            (SELECT COUNT(*) FROM matricula m WHERE m.id_ficha = f.id_ficha AND m.estado = 'activa') AS total_aprendices
     FROM ficha f
     JOIN periodo p ON p.id_periodo = f.id_periodo
     JOIN usuario u ON u.id_usuario = f.id_instructor
     ${filtroInstructor}
     ORDER BY f.id_ficha DESC`,
    valores
  );
  res.json(r.rows);
});

router.post("/fichas", autorizar("administrador"), async (req, res) => {
  try {
    const { numero_ficha, programa, jornada, fecha_inicio, fecha_fin, id_periodo, id_instructor } = req.body;
    const r = await pool.query(
      `INSERT INTO ficha (numero_ficha, programa, jornada, fecha_inicio, fecha_fin, id_periodo, id_instructor)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [numero_ficha, programa, jornada, fecha_inicio, fecha_fin, id_periodo, id_instructor]
    );
    await auditar(req.usuario.id, "crear_ficha", "ficha", r.rows[0].id_ficha);
    res.status(201).json(r.rows[0]);
  } catch (e) {
    if (e.code === "23505") return res.status(400).json({ mensaje: "El número de ficha ya existe" });
    if (e.code === "23514") return res.status(400).json({ mensaje: "La fecha fin debe ser posterior a la fecha inicio" });
    console.error(e);
    res.status(500).json({ mensaje: "Error al crear la ficha" });
  }
});

// ---------- MATRICULAS (CU-06) ----------
router.get("/fichas/:id/matriculas", async (req, res) => {
  const r = await pool.query(
    `SELECT m.id_matricula, m.estado, m.fecha_matricula,
            u.id_usuario, u.nombres, u.apellidos, u.documento, u.correo,
            (pb.id_plantilla IS NOT NULL) AS tiene_huella
     FROM matricula m
     JOIN usuario u ON u.id_usuario = m.id_aprendiz
     LEFT JOIN plantilla_biometrica pb ON pb.id_aprendiz = u.id_usuario
     WHERE m.id_ficha = $1 ORDER BY u.apellidos`,
    [req.params.id]
  );
  res.json(r.rows);
});

router.post("/fichas/:id/matriculas", autorizar("administrador"), async (req, res) => {
  const { ids_aprendices } = req.body; // array de id_usuario
  const resultados = { matriculados: 0, errores: [] };
  for (const id of ids_aprendices || []) {
    try {
      await pool.query(
        "INSERT INTO matricula (id_aprendiz, id_ficha) VALUES ($1,$2)",
        [id, req.params.id]
      );
      resultados.matriculados++;
    } catch (e) {
      resultados.errores.push({
        id_aprendiz: id,
        error: e.constraint === "idx_matricula_activa_unica"
          ? "El aprendiz ya tiene una matrícula activa en otra ficha"
          : "Ya está matriculado en esta ficha",
      });
    }
  }
  await auditar(req.usuario.id, "matricular_aprendices", "ficha", Number(req.params.id), resultados);
  res.json(resultados);
});

router.patch("/matriculas/:id", autorizar("administrador"), async (req, res) => {
  const { estado } = req.body; // retirada | finalizada
  await pool.query("UPDATE matricula SET estado = $1 WHERE id_matricula = $2", [estado, req.params.id]);
  await auditar(req.usuario.id, "cambiar_matricula", "matricula", Number(req.params.id), { estado });
  res.json({ mensaje: "Matrícula actualizada" });
});

// ---------- AMBIENTES Y DISPOSITIVOS (CU-07) ----------
router.get("/ambientes", async (_req, res) => {
  const r = await pool.query(
    `SELECT a.*, d.id_dispositivo, d.serial, d.modelo, d.estado AS estado_dispositivo, d.ultimo_heartbeat
     FROM ambiente a LEFT JOIN dispositivo d ON d.id_ambiente = a.id_ambiente
     ORDER BY a.numero_ambiente`
  );
  res.json(r.rows);
});

router.post("/ambientes", autorizar("administrador"), async (req, res) => {
  const { numero_ambiente, sede_centro, id_periodo } = req.body;
  const r = await pool.query(
    "INSERT INTO ambiente (numero_ambiente, sede_centro, id_periodo) VALUES ($1,$2,$3) RETURNING *",
    [numero_ambiente, sede_centro, id_periodo || null]
  );
  await auditar(req.usuario.id, "crear_ambiente", "ambiente", r.rows[0].id_ambiente);
  res.status(201).json(r.rows[0]);
});

// Asociar lector al ambiente: genera la clave API que usara el dispositivo
router.post("/ambientes/:id/dispositivo", autorizar("administrador"), async (req, res) => {
  try {
    const { serial, modelo } = req.body;
    const claveApi = crypto.randomBytes(16).toString("hex");
    const r = await pool.query(
      `INSERT INTO dispositivo (serial, modelo, id_ambiente, clave_api, estado)
       VALUES ($1,$2,$3,$4,'no_verificado') RETURNING id_dispositivo, serial, modelo, estado`,
      [serial, modelo || "ZKTeco K50 (simulado)", req.params.id, claveApi]
    );
    await auditar(req.usuario.id, "registrar_dispositivo", "dispositivo", r.rows[0].id_dispositivo);
    // La clave se muestra UNA sola vez, para configurar el lector/simulador
    res.status(201).json({ ...r.rows[0], clave_api: claveApi });
  } catch (e) {
    if (e.code === "23505") return res.status(400).json({ mensaje: "Serial duplicado o el ambiente ya tiene un lector asociado" });
    console.error(e);
    res.status(500).json({ mensaje: "Error al registrar el dispositivo" });
  }
});

// CU-09: panel de monitoreo de lectores
router.get("/dispositivos", autorizar("administrador"), async (_req, res) => {
  const r = await pool.query(
    `SELECT d.id_dispositivo, d.serial, d.modelo, d.estado, d.ultimo_heartbeat,
            a.numero_ambiente, a.sede_centro
     FROM dispositivo d LEFT JOIN ambiente a ON a.id_ambiente = d.id_ambiente
     ORDER BY d.serial`
  );
  res.json(r.rows);
});

// ---------- HORARIOS (CU-08) ----------
router.get("/horarios", async (req, res) => {
  const filtro = req.usuario.rol === "instructor" ? "WHERE h.id_instructor = $1" : "";
  const valores = req.usuario.rol === "instructor" ? [req.usuario.id] : [];
  const r = await pool.query(
    `SELECT h.*, f.numero_ficha, f.programa, a.numero_ambiente,
            u.nombres || ' ' || u.apellidos AS instructor
     FROM horario h
     JOIN ficha f ON f.id_ficha = h.id_ficha
     JOIN ambiente a ON a.id_ambiente = h.id_ambiente
     JOIN usuario u ON u.id_usuario = h.id_instructor
     ${filtro}
     ORDER BY h.dia_semana, h.hora_inicio`,
    valores
  );
  res.json(r.rows);
});

router.post("/horarios", autorizar("administrador"), async (req, res) => {
  try {
    const { id_ficha, id_ambiente, id_instructor, id_periodo, dia_semana, hora_inicio, hora_fin } = req.body;
    // Regla CU-08: sin conflictos de instructor ni de ambiente
    const conflicto = await pool.query(
      `SELECT h.id_horario, f.numero_ficha,
              CASE WHEN h.id_instructor = $1 THEN 'instructor' ELSE 'ambiente' END AS tipo
       FROM horario h JOIN ficha f ON f.id_ficha = h.id_ficha
       WHERE h.dia_semana = $3
         AND (h.id_instructor = $1 OR h.id_ambiente = $2)
         AND (h.hora_inicio, h.hora_fin) OVERLAPS ($4::time, $5::time)
       LIMIT 1`,
      [id_instructor, id_ambiente, dia_semana, hora_inicio, hora_fin]
    );
    if (conflicto.rows[0]) {
      const c = conflicto.rows[0];
      return res.status(400).json({
        mensaje: `Conflicto de ${c.tipo}: se cruza con la ficha ${c.numero_ficha} en ese horario`,
      });
    }
    const r = await pool.query(
      `INSERT INTO horario (id_ficha, id_ambiente, id_instructor, id_periodo, dia_semana, hora_inicio, hora_fin)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id_ficha, id_ambiente, id_instructor, id_periodo, dia_semana, hora_inicio, hora_fin]
    );
    await auditar(req.usuario.id, "crear_horario", "horario", r.rows[0].id_horario);
    res.status(201).json(r.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ mensaje: "Error al crear el horario" });
  }
});

router.delete("/horarios/:id", autorizar("administrador"), async (req, res) => {
  await pool.query("DELETE FROM horario WHERE id_horario = $1", [req.params.id]);
  await auditar(req.usuario.id, "eliminar_horario", "horario", Number(req.params.id));
  res.json({ mensaje: "Horario eliminado" });
});

module.exports = router;
