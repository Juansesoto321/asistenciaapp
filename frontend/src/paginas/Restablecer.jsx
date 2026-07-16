import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../servicios/api";

export default function Restablecer() {
  const { token } = useParams();
  const [contrasena, setContrasena] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [mensaje, setMensaje] = useState(null);

  async function enviar() {
    setMensaje(null);
    if (contrasena !== confirmar) return setMensaje({ tipo: "error", texto: "Las contraseñas no coinciden" });
    try {
      const r = await api("/auth/restablecer", { method: "POST", body: { token, contrasena } });
      setMensaje({ tipo: "exito", texto: r.mensaje });
    } catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  return (
    <div className="pantalla-acceso">
      <div className="tarjeta-acceso">
        <div className="logo-acceso">🔑</div>
        <h1>Nueva contraseña</h1>
        <p className="subtitulo">El enlace es válido por 1 hora desde que lo solicitaste</p>
        {mensaje && <div className={`mensaje ${mensaje.tipo}`}>{mensaje.texto}</div>}
        <label>Nueva contraseña</label>
        <input type="password" value={contrasena} onChange={(e) => setContrasena(e.target.value)} />
        <label>Confirmar contraseña</label>
        <input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
        <button className="boton ancho" onClick={enviar}>Guardar contraseña</button>
        <div className="enlaces-acceso"><Link to="/">← Ir a iniciar sesión</Link></div>
      </div>
    </div>
  );
}
