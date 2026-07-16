import { useEffect, useState } from "react";
import { api } from "../servicios/api";

export default function Perfil() {
  const [perfil, setPerfil] = useState(null);
  const [f, setF] = useState({ telefono: "", contrasena_actual: "", contrasena_nueva: "" });
  const [mensaje, setMensaje] = useState(null);

  useEffect(() => {
    api("/auth/perfil").then((p) => { setPerfil(p); setF((x) => ({ ...x, telefono: p.telefono || "" })); });
  }, []);

  async function guardar() {
    try {
      const r = await api("/auth/perfil", { method: "PUT", body: f });
      setMensaje({ tipo: "exito", texto: r.mensaje });
      setF({ ...f, contrasena_actual: "", contrasena_nueva: "" });
    } catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  if (!perfil) return <div className="vacio">Cargando…</div>;
  return (
    <>
      <div className="cabecera-pagina">
        <div><h1>Mi perfil</h1><p>Datos personales y cambio de contraseña. El rol solo lo modifica un administrador.</p></div>
      </div>
      {mensaje && <div className={`mensaje ${mensaje.tipo}`}>{mensaje.texto}</div>}
      <div className="tarjeta" style={{ maxWidth: 560 }}>
        <div className="rejilla-2">
          <div><label>Nombres</label><input readOnly value={perfil.nombres} /></div>
          <div><label>Apellidos</label><input readOnly value={perfil.apellidos} /></div>
        </div>
        <div className="rejilla-2">
          <div><label>Documento</label><input readOnly value={`${perfil.tipo_documento} ${perfil.documento}`} /></div>
          <div><label>Rol</label><input readOnly value={perfil.rol} style={{ textTransform: "capitalize" }} /></div>
        </div>
        <label>Correo</label><input readOnly value={perfil.correo} />
        <label>Teléfono</label>
        <input value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} />
        <hr style={{ margin: "20px 0", border: "none", borderTop: "1px solid var(--borde)" }} />
        <h3 style={{ fontSize: 15 }}>Cambiar contraseña</h3>
        <label>Contraseña actual</label>
        <input type="password" value={f.contrasena_actual} onChange={(e) => setF({ ...f, contrasena_actual: e.target.value })} />
        <label>Contraseña nueva (mín. 8, mayúscula, minúscula y número)</label>
        <input type="password" value={f.contrasena_nueva} onChange={(e) => setF({ ...f, contrasena_nueva: e.target.value })} />
        <button className="boton" style={{ marginTop: 18 }} onClick={guardar}>Guardar cambios</button>
      </div>
    </>
  );
}
