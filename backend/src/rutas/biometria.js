/**
 * CU-10 Enrollment con consentimiento · CU-11 Derecho al borrado (Ley 1581/2012)
 */
const express = require("express");
const pool = require("../config/db");
const { cifrar, generarTemplateSimulado } = require("../servicios/cifrado");
const { auditar } = require("../servicios/auditoria");
const { autenticar, autorizar } = require("../middleware/autenticar");

const router = express.Router();
router.use(autenticar);

const TEXTO_CONSENTIMIENTO = `Autorizo al SENA el tratamiento de mi huella dactilar con la única finalidad de
registrar mi asistencia a las actividades de formación, conforme a la Ley 1581 de 2012.
Entiendo que: (1) solo se almacena una plantilla matemática cifrada, nunca la imagen de mi huella;
(2) puedo revocar este consentimiento y solicitar la eliminación de mis datos biométricos en cualquier
momento; (3) mis registros de asistencia se conservarán con fines académicos.`;

router.get("/consentimiento/texto", (_req, res) => res.json({ version: "v1.0", texto: TEXTO_CONSENTIMIENTO }));

// Estado biometrico de un aprendiz
router.get("/:idAprendiz/estado", async (req, res) => {
  const r = await pool.query(
    `SELECT (pb.id_plantilla IS NOT NULL) AS enrolado, pb.creado_en,
            c.aceptado, c.fecha_aceptacion
     FROM usuario u
     LEFT JOIN plantilla_biometrica pb ON pb.id_aprendiz = u.id_usuario
     LEFT JOIN consentimiento c ON c.id_consentimiento = pb.id_consentimiento
     WHERE u.id_usuario = $1`,
    [req.params.idAprendiz]
  );
  res.json(r.rows[0] || { enrolado: false });
});

/**
 * CU-10: Enrollment. Flujo: consentimiento -> doble captura -> template cifrado.
 * En modo simulado, "lectura1" y "lectura2" las produce el simulador de enrolador
 * (equivalen a las dos pasadas del dedo por el ZK9500).
 */
router.post("/enrolar", autorizar("administrador", "instructor"), async (req, res) => {
  const cliente = await pool.connect();
  try {
    const { id_aprendiz, acepta_consentimiento, lectura1, lectura2 } = req.body;

    // A1: sin consentimiento no hay enrollment (el aprendiz usara registro manual)
    if (!acepta_consentimiento)
      return res.status(400).json({ mensaje: "El aprendiz no aceptó el consentimiento. Deberá usar registro manual" });

    // Validar doble captura consistente (regla CU-10 A2)
    if (!lectura1 || lectura1 !== lectura2)
      return res.status(400).json({ mensaje: "Las dos capturas no coinciden. Intenta nuevamente (máximo 3 intentos)" });

    const yaExiste = await cliente.query("SELECT 1 FROM plantilla_biometrica WHERE id_aprendiz = $1", [id_aprendiz]);
    if (yaExiste.rows[0])
      return res.status(400).json({ mensaje: "El aprendiz ya tiene una huella registrada. Elimínala primero para re-enrolar" });

    await cliente.query("BEGIN");
    const cons = await cliente.query(
      `INSERT INTO consentimiento (id_aprendiz, version_texto, aceptado)
       VALUES ($1,'v1.0',TRUE) RETURNING id_consentimiento`,
      [id_aprendiz]
    );
    const template = generarTemplateSimulado(lectura1);
    const cifrado = cifrar(template);
    await cliente.query(
      `INSERT INTO plantilla_biometrica (id_aprendiz, plantilla_cifrada, iv, etiqueta_auth, id_consentimiento)
       VALUES ($1,$2,$3,$4,$5)`,
      [id_aprendiz, cifrado.plantilla_cifrada, cifrado.iv, cifrado.etiqueta_auth, cons.rows[0].id_consentimiento]
    );
    await cliente.query("COMMIT");
    await auditar(req.usuario.id, "enrollment_biometrico", "usuario", id_aprendiz);
    res.status(201).json({ mensaje: "Huella registrada y cifrada correctamente (AES-256)" });
  } catch (e) {
    await cliente.query("ROLLBACK");
    console.error(e);
    res.status(500).json({ mensaje: "Error en el enrollment" });
  } finally {
    cliente.release();
  }
});

/**
 * CU-11: Derecho al borrado. Elimina la plantilla, conserva historial de asistencia.
 */
router.delete("/:idAprendiz", autorizar("administrador"), async (req, res) => {
  try {
    const r = await pool.query("DELETE FROM plantilla_biometrica WHERE id_aprendiz = $1 RETURNING id_consentimiento", [req.params.idAprendiz]);
    if (!r.rows[0]) return res.status(404).json({ mensaje: "El aprendiz no tiene datos biométricos" });
    await pool.query("UPDATE consentimiento SET revocado_en = NOW() WHERE id_consentimiento = $1", [r.rows[0].id_consentimiento]);
    await pool.query(
      `INSERT INTO notificacion (id_usuario, tipo, titulo, mensaje)
       VALUES ($1,'biometria','Datos biométricos eliminados',
               'Tu plantilla biométrica fue eliminada permanentemente según tu solicitud (Ley 1581/2012). Tus registros históricos de asistencia se conservan.')`,
      [req.params.idAprendiz]
    );
    await auditar(req.usuario.id, "eliminar_datos_biometricos", "usuario", Number(req.params.idAprendiz));
    res.json({ mensaje: "Datos biométricos eliminados permanentemente. El registro queda en auditoría" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ mensaje: "Error al eliminar los datos biométricos" });
  }
});

module.exports = router;
