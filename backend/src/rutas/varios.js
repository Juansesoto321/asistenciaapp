/** CU-20 Notificaciones · CU-21 Soporte · Configuracion del sistema */
const express = require("express");
const pool = require("../config/db");
const { auditar } = require("../servicios/auditoria");
const { autenticar, autorizar } = require("../middleware/autenticar");

const router = express.Router();
router.use(autenticar);

// CU-20
router.get("/notificaciones", async (req, res) => {
  const r = await pool.query(
    "SELECT * FROM notificacion WHERE id_usuario = $1 ORDER BY creado_en DESC LIMIT 50",
    [req.usuario.id]
  );
  res.json(r.rows);
});
router.patch("/notificaciones/:id/leida", async (req, res) => {
  await pool.query("UPDATE notificacion SET leida = TRUE WHERE id_notificacion = $1 AND id_usuario = $2", [req.params.id, req.usuario.id]);
  res.json({ ok: true });
});

// CU-21
router.post("/soporte", async (req, res) => {
  const { tipo, descripcion } = req.body;
  const r = await pool.query(
    "INSERT INTO ticket_soporte (id_usuario, tipo, descripcion) VALUES ($1,$2,$3) RETURNING id_ticket",
    [req.usuario.id, tipo, descripcion]
  );
  await pool.query(
    `INSERT INTO notificacion (id_usuario, tipo, titulo, mensaje)
     SELECT id_usuario, 'soporte', 'Nuevo ticket de soporte', 'Ticket #' || $1 || ': ' || $2
     FROM usuario WHERE rol = 'administrador' AND estado = 'activo'`,
    [r.rows[0].id_ticket, tipo]
  );
  res.status(201).json({ mensaje: `Ticket #${r.rows[0].id_ticket} registrado. Te notificaremos la respuesta`, id_ticket: r.rows[0].id_ticket });
});
router.get("/soporte", async (req, res) => {
  const propio = req.usuario.rol !== "administrador";
  const r = await pool.query(
    `SELECT t.*, u.nombres || ' ' || u.apellidos AS usuario
     FROM ticket_soporte t JOIN usuario u ON u.id_usuario = t.id_usuario
     ${propio ? "WHERE t.id_usuario = $1" : ""} ORDER BY t.creado_en DESC`,
    propio ? [req.usuario.id] : []
  );
  res.json(r.rows);
});
router.patch("/soporte/:id", autorizar("administrador"), async (req, res) => {
  await pool.query("UPDATE ticket_soporte SET estado = $1 WHERE id_ticket = $2", [req.body.estado, req.params.id]);
  res.json({ mensaje: "Ticket actualizado" });
});

// Configuracion (tolerancia, % minimo, ventana de justificacion)
router.get("/configuracion", async (_req, res) => {
  const r = await pool.query("SELECT * FROM configuracion");
  res.json(Object.fromEntries(r.rows.map(f => [f.clave, f.valor])));
});
router.put("/configuracion", autorizar("administrador"), async (req, res) => {
  for (const [clave, valor] of Object.entries(req.body)) {
    await pool.query(
      "INSERT INTO configuracion (clave, valor) VALUES ($1,$2) ON CONFLICT (clave) DO UPDATE SET valor = $2",
      [clave, String(valor)]
    );
  }
  await auditar(req.usuario.id, "actualizar_configuracion", "configuracion", null, req.body);
  res.json({ mensaje: "Configuración guardada" });
});

module.exports = router;
