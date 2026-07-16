import { useEffect, useState } from "react";
import { api } from "../servicios/api";

const VACIO = { nombres: "", apellidos: "", tipo_documento: "CC", documento: "", correo: "", telefono: "", rol: "aprendiz" };

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [filtro, setFiltro] = useState({ rol: "", estado: "", buscar: "" });
  const [modal, setModal] = useState(null); // 'crear' | 'masiva'
  const [f, setF] = useState(VACIO);
  const [csv, setCsv] = useState("");
  const [mensaje, setMensaje] = useState(null);

  const cargar = () => {
    const q = new URLSearchParams(Object.entries(filtro).filter(([, v]) => v)).toString();
    api(`/usuarios?${q}`).then(setUsuarios).catch((e) => setMensaje({ tipo: "error", texto: e.message }));
  };
  useEffect(() => { cargar(); }, [filtro]);

  async function crear() {
    try {
      const r = await api("/usuarios", { method: "POST", body: f });
      setMensaje({ tipo: "exito", texto: r.mensaje }); setModal(null); setF(VACIO); cargar();
    } catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  async function cambiarEstado(u, estado) {
    try {
      const r = await api(`/usuarios/${u.id_usuario}/estado`, { method: "PATCH", body: { estado } });
      setMensaje({ tipo: "exito", texto: r.mensaje }); cargar();
    } catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  async function cargaMasiva() {
    // CSV: nombres;apellidos;documento;correo;telefono
    const filas = csv.trim().split("\n").map((l) => {
      const [nombres, apellidos, documento, correo, telefono] = l.split(";").map((s) => s?.trim());
      return { nombres, apellidos, documento, correo, telefono };
    });
    try {
      const r = await api("/usuarios/carga-masiva", { method: "POST", body: { filas } });
      setMensaje({
        tipo: r.errores.length ? "error" : "exito",
        texto: `${r.creados} aprendices creados.` + (r.errores.length ? ` Errores: ${r.errores.map((e) => `fila ${e.fila} (${e.error})`).join(", ")}` : ""),
      });
      setModal(null); setCsv(""); cargar();
    } catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  return (
    <>
      <div className="cabecera-pagina">
        <div><h1>Usuarios</h1><p>Crea, aprueba y administra las cuentas del sistema.</p></div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="boton suave" onClick={() => setModal("masiva")}>📥 Carga masiva</button>
          <button className="boton" onClick={() => setModal("crear")}>+ Nuevo usuario</button>
        </div>
      </div>
      {mensaje && <div className={`mensaje ${mensaje.tipo}`}>{mensaje.texto}</div>}

      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <input style={{ maxWidth: 260 }} placeholder="Buscar por nombre, documento o correo"
               value={filtro.buscar} onChange={(e) => setFiltro({ ...filtro, buscar: e.target.value })} />
        <select style={{ maxWidth: 170 }} value={filtro.rol} onChange={(e) => setFiltro({ ...filtro, rol: e.target.value })}>
          <option value="">Todos los roles</option>
          <option value="administrador">Administrador</option>
          <option value="instructor">Instructor</option>
          <option value="aprendiz">Aprendiz</option>
        </select>
        <select style={{ maxWidth: 190 }} value={filtro.estado} onChange={(e) => setFiltro({ ...filtro, estado: e.target.value })}>
          <option value="">Todos los estados</option>
          <option value="activo">Activo</option>
          <option value="pendiente">Pendiente de aprobación</option>
          <option value="inactivo">Inactivo</option>
        </select>
      </div>

      <table className="tabla">
        <thead><tr><th>Nombre</th><th>Documento</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>
          {usuarios.map((u) => (
            <tr key={u.id_usuario}>
              <td>{u.nombres} {u.apellidos}</td>
              <td>{u.documento}</td>
              <td>{u.correo}</td>
              <td style={{ textTransform: "capitalize" }}>{u.rol}</td>
              <td><span className={`insignia ${u.estado}`}>{u.estado}</span></td>
              <td style={{ display: "flex", gap: 6 }}>
                {u.estado === "pendiente" && <button className="boton mini exito" onClick={() => cambiarEstado(u, "activo")}>Aprobar</button>}
                {u.estado === "activo" && <button className="boton mini peligro" onClick={() => cambiarEstado(u, "inactivo")}>Desactivar</button>}
                {u.estado === "inactivo" && <button className="boton mini exito" onClick={() => cambiarEstado(u, "activo")}>Reactivar</button>}
              </td>
            </tr>
          ))}
          {!usuarios.length && <tr><td colSpan={6}><div className="vacio">No hay usuarios con esos filtros.</div></td></tr>}
        </tbody>
      </table>

      {modal === "crear" && (
        <div className="superposicion" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Nuevo usuario</h2>
            <p style={{ color: "var(--tinta-suave)", fontSize: 13.5 }}>La contraseña temporal se envía al correo del usuario.</p>
            <div className="rejilla-2">
              <div><label>Nombres</label><input value={f.nombres} onChange={(e) => setF({ ...f, nombres: e.target.value })} /></div>
              <div><label>Apellidos</label><input value={f.apellidos} onChange={(e) => setF({ ...f, apellidos: e.target.value })} /></div>
            </div>
            <div className="rejilla-2">
              <div><label>Documento</label><input value={f.documento} onChange={(e) => setF({ ...f, documento: e.target.value })} /></div>
              <div><label>Teléfono</label><input value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} /></div>
            </div>
            <label>Correo</label><input value={f.correo} onChange={(e) => setF({ ...f, correo: e.target.value })} />
            <label>Rol</label>
            <select value={f.rol} onChange={(e) => setF({ ...f, rol: e.target.value })}>
              <option value="aprendiz">Aprendiz</option>
              <option value="instructor">Instructor</option>
              <option value="administrador">Administrador</option>
            </select>
            <div className="acciones-modal">
              <button className="boton suave" onClick={() => setModal(null)}>Cancelar</button>
              <button className="boton" onClick={crear}>Crear usuario</button>
            </div>
          </div>
        </div>
      )}

      {modal === "masiva" && (
        <div className="superposicion" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Carga masiva de aprendices</h2>
            <p style={{ color: "var(--tinta-suave)", fontSize: 13.5 }}>
              Pega una fila por aprendiz con el formato:<br />
              <code>nombres;apellidos;documento;correo;telefono</code>
            </p>
            <textarea rows={8} value={csv} onChange={(e) => setCsv(e.target.value)}
                      placeholder={"Ana María;García López;1012345678;ana.garcia@soy.sena.edu.co;3001234567"} />
            <div className="acciones-modal">
              <button className="boton suave" onClick={() => setModal(null)}>Cancelar</button>
              <button className="boton" onClick={cargaMasiva}>Cargar aprendices</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
