import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../servicios/api";

export default function Registrarse() {
  const [f, setF] = useState({ nombres: "", apellidos: "", tipo_documento: "CC", documento: "", correo: "", telefono: "", contrasena: "", rol: "aprendiz" });
  const [mensaje, setMensaje] = useState(null);
  const c = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function enviar() {
    setMensaje(null);
    try {
      const r = await api("/auth/registro", { method: "POST", body: f });
      setMensaje({ tipo: "exito", texto: r.mensaje });
    } catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  return (
    <div className="pantalla-acceso">
      <div className="tarjeta-acceso" style={{ maxWidth: 480 }}>
        <div className="logo-acceso">🫆</div>
        <h1>Crear cuenta</h1>
        <p className="subtitulo">Tu solicitud quedará pendiente hasta que un administrador la apruebe</p>
        {mensaje && <div className={`mensaje ${mensaje.tipo}`}>{mensaje.texto}</div>}
        <div className="rejilla-2">
          <div><label>Nombres</label><input value={f.nombres} onChange={c("nombres")} /></div>
          <div><label>Apellidos</label><input value={f.apellidos} onChange={c("apellidos")} /></div>
        </div>
        <div className="rejilla-2">
          <div>
            <label>Tipo de documento</label>
            <select value={f.tipo_documento} onChange={c("tipo_documento")}>
              <option value="CC">Cédula de ciudadanía</option>
              <option value="TI">Tarjeta de identidad</option>
              <option value="CE">Cédula de extranjería</option>
            </select>
          </div>
          <div><label>Número de documento</label><input value={f.documento} onChange={c("documento")} /></div>
        </div>
        <label>Correo institucional</label>
        <input value={f.correo} onChange={c("correo")} placeholder="usuario@soy.sena.edu.co" />
        <div className="rejilla-2">
          <div><label>Teléfono</label><input value={f.telefono} onChange={c("telefono")} /></div>
          <div>
            <label>Rol</label>
            <select value={f.rol} onChange={c("rol")}>
              <option value="aprendiz">Aprendiz</option>
              <option value="instructor">Instructor</option>
            </select>
          </div>
        </div>
        <label>Contraseña (mín. 8, mayúscula, minúscula y número)</label>
        <input type="password" value={f.contrasena} onChange={c("contrasena")} />
        <button className="boton ancho" onClick={enviar}>Enviar solicitud</button>
        <div className="enlaces-acceso"><Link to="/">← Ya tengo cuenta</Link></div>
      </div>
    </div>
  );
}
