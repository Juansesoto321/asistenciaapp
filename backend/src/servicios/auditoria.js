const pool = require("../config/db");

/** Registra toda accion sensible (requisito transversal de los CU). */
async function auditar(idUsuario, accion, entidad = null, idEntidad = null, detalle = null) {
  try {
    await pool.query(
      `INSERT INTO auditoria (id_usuario, accion, entidad, id_entidad, detalle)
       VALUES ($1,$2,$3,$4,$5)`,
      [idUsuario, accion, entidad, idEntidad, detalle ? JSON.stringify(detalle) : null]
    );
  } catch (e) {
    console.error("Error registrando auditoria:", e.message);
  }
}

module.exports = { auditar };
