import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, guardarSesion } from "../servicios/api";

export default function IniciarSesion() {
  const navegar = useNavigate();
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [recuperando, setRecuperando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [cargando, setCargando] = useState(false);

  async function enviar() {
    setMensaje(null); setCargando(true);
    try {
      if (recuperando) {
        const r = await api("/auth/recuperar", { method: "POST", body: { correo } });
        setMensaje({ tipo: "exito", texto: r.mensaje });
      } else {
        const r = await api("/auth/login", { method: "POST", body: { correo, contrasena } });
        guardarSesion(r);
        navegar("/panel");
      }
    } catch (e) {
      setMensaje({ tipo: "error", texto: e.message });
    } finally { setCargando(false); }
  }

  return (
    <div className="pantalla-acceso">
      <div className="tarjeta-acceso">
        <div className="logo-acceso">🫆</div>
        <h1>AsistenciaApp</h1>
        <p className="subtitulo">Control de asistencia con huella digital · SENA</p>
        {mensaje && <div className={`mensaje ${mensaje.tipo}`}>{mensaje.texto}</div>}
        <label>Correo institucional</label>
        <input value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="usuario@soy.sena.edu.co"
               onKeyDown={(e) => e.key === "Enter" && enviar()} />
        {!recuperando && (<>
          <label>Contraseña</label>
          <input type="password" value={contrasena} onChange={(e) => setContrasena(e.target.value)}
                 placeholder="••••••••" onKeyDown={(e) => e.key === "Enter" && enviar()} />
        </>)}
        <button className="boton ancho" onClick={enviar} disabled={cargando}>
          {cargando ? "Un momento..." : recuperando ? "Enviar enlace de recuperación" : "Iniciar sesión"}
        </button>
        <div className="enlaces-acceso">
          <a href="#" onClick={(e) => { e.preventDefault(); setRecuperando(!recuperando); setMensaje(null); }}>
            {recuperando ? "← Volver al inicio de sesión" : "¿Olvidaste tu contraseña?"}
          </a>
          <Link to="/registrarse">Crear cuenta</Link>
        </div>
      </div>
    </div>
  );
}
