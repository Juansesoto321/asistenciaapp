const jwt = require("jsonwebtoken");

/** Verifica el token JWT y adjunta el usuario a la peticion (CU-01). */
function autenticar(req, res, next) {
  const encabezado = req.headers.authorization || "";
  const token = encabezado.startsWith("Bearer ") ? encabezado.slice(7) : null;
  if (!token) return res.status(401).json({ mensaje: "No autenticado" });
  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRETO);
    next();
  } catch {
    return res.status(401).json({ mensaje: "Sesión inválida o expirada" });
  }
}

/** Restringe una ruta a ciertos roles. Uso: autorizar('administrador') */
function autorizar(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.usuario.rol)) {
      return res.status(403).json({ mensaje: "No tienes permisos para esta acción" });
    }
    next();
  };
}

module.exports = { autenticar, autorizar };
