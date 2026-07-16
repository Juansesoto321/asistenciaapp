/**
 * CU-04 Gestionar usuarios · CU-06 Carga masiva · CU-22 Aprobar solicitudes
 */
const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const pool = require("../config/db");
const { enviarCorreo } = require("../servicios/correo");
const { auditar } = require("../servicios/auditoria");
const { autenticar, autorizar } = require("../middleware/autenticar");

const router = express.Router();
router.use(autenticar, autorizar("administrador"));

// Listar usuarios con filtros
router.get("/", async (req, res) => {
  const { rol, estado, buscar } = req.query;
  const condiciones = [];
  const valores = [];
  if (rol) { valores.push(rol); condiciones.push(`rol = $${valores.length}`); }
  if (estado) { valores.push(estado); condiciones.push(`estado = $${valores.length}`); }
  if (buscar) {
    valores.push(`%${buscar}%`);
    condiciones.push(`(nombres ILIKE $${valores.length} OR apellidos ILIKE $${valores.length} OR documento ILIKE $${valores.length} OR correo ILIKE $${valores.length})`);
  }
  const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
  const r = await pool.query(
    `SELECT id_usuario, nombres, apellidos, tipo_documento, documento, correo, telefono, rol, estado, creado_en
     FROM usuario ${where} ORDER BY creado_en DESC`,
    valores
  );
  res.json(r.rows);
});

// Crear usuario (contrasena temporal enviada por correo — CU-04)
router.post("/", async (req, res) => {
  try {
    const { nombres, apellidos, tipo_documento, documento, correo, telefono, rol } = req.body;
    if (!["administrador", "instructor", "aprendiz"].includes(rol))
      return res.status(400).json({ mensaje: "Rol inválido" });
    const temporal = `Sena${crypto.randomBytes(3).toString("hex")}*1`;
    const hash = await bcrypt.hash(temporal, 10);
    const r = await pool.query(
      `INSERT INTO usuario (nombres, apellidos, tipo_documento, documento, correo, telefono, contrasena_hash, rol, estado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'activo') RETURNING id_usuario`,
      [nombres, apellidos, tipo_documento || "CC", documento, correo, telefono, hash, rol]
    );
    await enviarCorreo({
      para: correo,
      asunto: "AsistenciaApp · Tu cuenta fue creada",
      html: `<p>Hola ${nombres},</p><p>Tu cuenta en AsistenciaApp está lista.</p>
             <p><b>Usuario:</b> ${correo}<br/><b>Contraseña temporal:</b> ${temporal}</p>
             <p>Cámbiala al ingresar por primera vez.</p>`,
    });
    await auditar(req.usuario.id, "crear_usuario", "usuario", r.rows[0].id_usuario, { rol });
    res.status(201).json({ mensaje: "Usuario creado. Se envió la contraseña temporal por correo", id: r.rows[0].id_usuario });
  } catch (e) {
    if (e.code === "23505") return res.status(400).json({ mensaje: "El correo o documento ya existe" });
    console.error(e);
    res.status(500).json({ mensaje: "Error al crear el usuario" });
  }
});

// Editar usuario
router.put("/:id", async (req, res) => {
  try {
    const { nombres, apellidos, telefono, rol } = req.body;
    await pool.query(
      `UPDATE usuario SET nombres = COALESCE($1,nombres), apellidos = COALESCE($2,apellidos),
        telefono = COALESCE($3,telefono), rol = COALESCE($4,rol), actualizado_en = NOW()
       WHERE id_usuario = $5`,
      [nombres, apellidos, telefono, rol, req.params.id]
    );
    await auditar(req.usuario.id, "editar_usuario", "usuario", Number(req.params.id));
    res.json({ mensaje: "Usuario actualizado" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ mensaje: "Error al actualizar" });
  }
});

// Cambiar estado: aprobar (pendiente->activo), desactivar, reactivar
// Regla CU-04: no se elimina, solo se desactiva
router.patch("/:id/estado", async (req, res) => {
  try {
    const { estado } = req.body;
    if (!["activo", "inactivo"].includes(estado))
      return res.status(400).json({ mensaje: "Estado inválido" });
    const r = await pool.query(
      "UPDATE usuario SET estado = $1, actualizado_en = NOW() WHERE id_usuario = $2 RETURNING correo, nombres, estado",
      [estado, req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ mensaje: "Usuario no encontrado" });
    if (estado === "activo") {
      await enviarCorreo({
        para: r.rows[0].correo,
        asunto: "AsistenciaApp · Cuenta aprobada",
        html: `<p>Hola ${r.rows[0].nombres}, tu cuenta fue aprobada. Ya puedes iniciar sesión.</p>`,
      });
    }
    await auditar(req.usuario.id, `usuario_${estado}`, "usuario", Number(req.params.id));
    res.json({ mensaje: `Usuario ${estado === "activo" ? "aprobado/activado" : "desactivado"}` });
  } catch (e) {
    console.error(e);
    res.status(500).json({ mensaje: "Error al cambiar el estado" });
  }
});

// CU-06 A1: carga masiva de aprendices (filas JSON desde CSV/Excel del frontend)
router.post("/carga-masiva", async (req, res) => {
  const { filas } = req.body; // [{nombres, apellidos, documento, correo, telefono}]
  if (!Array.isArray(filas) || !filas.length)
    return res.status(400).json({ mensaje: "No se recibieron filas" });
  const resultados = { creados: 0, errores: [] };
  for (const [i, f] of filas.entries()) {
    try {
      if (!f.nombres || !f.apellidos || !f.documento || !f.correo)
        throw new Error("Faltan campos obligatorios (nombres, apellidos, documento, correo)");
      const temporal = `Sena${crypto.randomBytes(3).toString("hex")}*1`;
      const hash = await bcrypt.hash(temporal, 10);
      await pool.query(
        `INSERT INTO usuario (nombres, apellidos, tipo_documento, documento, correo, telefono, contrasena_hash, rol, estado)
         VALUES ($1,$2,'CC',$3,$4,$5,$6,'aprendiz','activo')`,
        [f.nombres, f.apellidos, String(f.documento), f.correo, f.telefono || null, hash]
      );
      await enviarCorreo({
        para: f.correo,
        asunto: "AsistenciaApp · Tu cuenta fue creada",
        html: `<p>Hola ${f.nombres}, tu cuenta está lista.<br/><b>Usuario:</b> ${f.correo}<br/><b>Contraseña temporal:</b> ${temporal}</p>`,
      });
      resultados.creados++;
    } catch (e) {
      resultados.errores.push({ fila: i + 1, documento: f.documento, error: e.code === "23505" ? "Correo o documento duplicado" : e.message });
    }
  }
  await auditar(req.usuario.id, "carga_masiva_aprendices", "usuario", null, resultados);
  res.json(resultados);
});

module.exports = router;
