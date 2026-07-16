/**
 * CU-01 Iniciar sesion · CU-02 Recuperar contrasena · CU-03 Actualizar perfil
 * CU-22 Auto-registro con aprobacion del administrador
 */
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const pool = require("../config/db");
const { enviarCorreo } = require("../servicios/correo");
const { auditar } = require("../servicios/auditoria");
const { autenticar } = require("../middleware/autenticar");

const router = express.Router();
const MAX_INTENTOS = 5; // regla CU-01: bloqueo tras 5 intentos fallidos

const validarContrasena = (c) =>
  typeof c === "string" && c.length >= 8 && /[A-Z]/.test(c) && /[a-z]/.test(c) && /\d/.test(c);

// ---- CU-01: Login ----
router.post("/login", async (req, res) => {
  try {
    const { correo, contrasena } = req.body;
    const r = await pool.query("SELECT * FROM usuario WHERE correo = $1", [correo]);
    const u = r.rows[0];
    const errorGenerico = { mensaje: "Correo o contraseña incorrectos" };
    if (!u) return res.status(401).json(errorGenerico);

    if (u.estado === "pendiente")
      return res.status(403).json({ mensaje: "Tu cuenta está pendiente de aprobación por el administrador" });
    if (u.estado === "inactivo")
      return res.status(403).json({ mensaje: "Tu cuenta está desactivada. Contacta al administrador" });
    if (u.estado === "bloqueado" && u.bloqueado_hasta && new Date(u.bloqueado_hasta) > new Date())
      return res.status(403).json({ mensaje: "Cuenta bloqueada por intentos fallidos. Intenta más tarde o recupera tu contraseña" });

    const valida = await bcrypt.compare(contrasena || "", u.contrasena_hash);
    if (!valida) {
      const intentos = u.intentos_fallidos + 1;
      const bloquear = intentos >= MAX_INTENTOS;
      await pool.query(
        `UPDATE usuario SET intentos_fallidos = $1,
          estado = CASE WHEN $2 THEN 'bloqueado' ELSE estado END,
          bloqueado_hasta = CASE WHEN $2 THEN NOW() + INTERVAL '15 minutes' ELSE bloqueado_hasta END
         WHERE id_usuario = $3`,
        [intentos, bloquear, u.id_usuario]
      );
      await auditar(u.id_usuario, "intento_login_fallido");
      return res.status(401).json(
        bloquear ? { mensaje: "Cuenta bloqueada por 5 intentos fallidos (15 minutos)" } : errorGenerico
      );
    }

    await pool.query(
      "UPDATE usuario SET intentos_fallidos = 0, estado = 'activo', bloqueado_hasta = NULL WHERE id_usuario = $1",
      [u.id_usuario]
    );
    const token = jwt.sign(
      { id: u.id_usuario, rol: u.rol, nombres: u.nombres, apellidos: u.apellidos, correo: u.correo },
      process.env.JWT_SECRETO,
      { expiresIn: "8h" }
    );
    await auditar(u.id_usuario, "login");
    res.json({
      token,
      usuario: { id: u.id_usuario, nombres: u.nombres, apellidos: u.apellidos, correo: u.correo, rol: u.rol },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ mensaje: "Error al iniciar sesión" });
  }
});

// ---- CU-22: Auto-registro (queda pendiente de aprobacion) ----
router.post("/registro", async (req, res) => {
  try {
    const { nombres, apellidos, tipo_documento, documento, correo, telefono, contrasena, rol } = req.body;
    if (!["aprendiz", "instructor"].includes(rol))
      return res.status(400).json({ mensaje: "Rol inválido: solo aprendiz o instructor" });
    if (!validarContrasena(contrasena))
      return res.status(400).json({ mensaje: "La contraseña debe tener mínimo 8 caracteres, una mayúscula, una minúscula y un número" });

    const hash = await bcrypt.hash(contrasena, 10);
    const r = await pool.query(
      `INSERT INTO usuario (nombres, apellidos, tipo_documento, documento, correo, telefono, contrasena_hash, rol, estado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pendiente') RETURNING id_usuario`,
      [nombres, apellidos, tipo_documento || "CC", documento, correo, telefono, hash, rol]
    );
    // Notificar a los administradores
    await pool.query(
      `INSERT INTO notificacion (id_usuario, tipo, titulo, mensaje)
       SELECT id_usuario, 'solicitud_registro', 'Nueva solicitud de registro',
              $1 FROM usuario WHERE rol = 'administrador' AND estado = 'activo'`,
      [`${nombres} ${apellidos} (${rol}) solicitó una cuenta y espera aprobación.`]
    );
    await auditar(r.rows[0].id_usuario, "solicitud_registro", "usuario", r.rows[0].id_usuario);
    res.status(201).json({ mensaje: "Solicitud enviada. Un administrador aprobará tu cuenta" });
  } catch (e) {
    if (e.code === "23505")
      return res.status(400).json({ mensaje: "El correo o documento ya está registrado" });
    console.error(e);
    res.status(500).json({ mensaje: "Error al registrar" });
  }
});

// ---- CU-02: Recuperar contrasena ----
router.post("/recuperar", async (req, res) => {
  try {
    const { correo } = req.body;
    const r = await pool.query("SELECT id_usuario, nombres FROM usuario WHERE correo = $1", [correo]);
    // Respuesta generica: no revelamos si el correo existe (regla CU-02 A1)
    const respuesta = { mensaje: "Si el correo existe, recibirás un enlace de recuperación" };
    if (!r.rows[0]) return res.json(respuesta);

    const token = crypto.randomBytes(32).toString("hex");
    await pool.query(
      `INSERT INTO token_recuperacion (id_usuario, token, expira_en)
       VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
      [r.rows[0].id_usuario, token]
    );
    const enlace = `${process.env.URL_FRONTEND}/restablecer/${token}`;
    await enviarCorreo({
      para: correo,
      asunto: "AsistenciaApp · Recupera tu contraseña",
      html: `<p>Hola ${r.rows[0].nombres},</p>
             <p>Haz clic en el siguiente enlace para restablecer tu contraseña (válido por 1 hora):</p>
             <p><a href="${enlace}">${enlace}</a></p>`,
    });
    res.json(respuesta);
  } catch (e) {
    console.error(e);
    res.status(500).json({ mensaje: "Error al procesar la solicitud" });
  }
});

// ---- CU-02: Restablecer con token ----
router.post("/restablecer", async (req, res) => {
  try {
    const { token, contrasena } = req.body;
    if (!validarContrasena(contrasena))
      return res.status(400).json({ mensaje: "La contraseña debe tener mínimo 8 caracteres, una mayúscula, una minúscula y un número" });
    const r = await pool.query(
      `SELECT * FROM token_recuperacion WHERE token = $1 AND usado = FALSE AND expira_en > NOW()`,
      [token]
    );
    if (!r.rows[0]) return res.status(400).json({ mensaje: "Enlace inválido o expirado. Solicita uno nuevo" });
    const hash = await bcrypt.hash(contrasena, 10);
    await pool.query(
      "UPDATE usuario SET contrasena_hash = $1, intentos_fallidos = 0, estado = 'activo', bloqueado_hasta = NULL WHERE id_usuario = $2",
      [hash, r.rows[0].id_usuario]
    );
    await pool.query("UPDATE token_recuperacion SET usado = TRUE WHERE id_token = $1", [r.rows[0].id_token]);
    await auditar(r.rows[0].id_usuario, "restablecer_contrasena");
    res.json({ mensaje: "Contraseña actualizada. Ya puedes iniciar sesión" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ mensaje: "Error al restablecer la contraseña" });
  }
});

// ---- CU-03: Ver y actualizar perfil ----
router.get("/perfil", autenticar, async (req, res) => {
  const r = await pool.query(
    `SELECT id_usuario, nombres, apellidos, tipo_documento, documento, correo, telefono, rol, estado, creado_en
     FROM usuario WHERE id_usuario = $1`,
    [req.usuario.id]
  );
  res.json(r.rows[0]);
});

router.put("/perfil", autenticar, async (req, res) => {
  try {
    const { telefono, contrasena_actual, contrasena_nueva } = req.body;
    if (contrasena_nueva) {
      const r = await pool.query("SELECT contrasena_hash FROM usuario WHERE id_usuario = $1", [req.usuario.id]);
      const ok = await bcrypt.compare(contrasena_actual || "", r.rows[0].contrasena_hash);
      if (!ok) return res.status(400).json({ mensaje: "La contraseña actual no es correcta" });
      if (!validarContrasena(contrasena_nueva))
        return res.status(400).json({ mensaje: "La contraseña nueva no cumple los requisitos de seguridad" });
      const hash = await bcrypt.hash(contrasena_nueva, 10);
      await pool.query("UPDATE usuario SET contrasena_hash = $1 WHERE id_usuario = $2", [hash, req.usuario.id]);
    }
    if (telefono !== undefined)
      await pool.query("UPDATE usuario SET telefono = $1 WHERE id_usuario = $2", [telefono, req.usuario.id]);
    await auditar(req.usuario.id, "actualizar_perfil");
    res.json({ mensaje: "Perfil actualizado" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ mensaje: "Error al actualizar el perfil" });
  }
});

module.exports = router;
