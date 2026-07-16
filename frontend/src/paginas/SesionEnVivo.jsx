import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { io } from "socket.io-client";
import { api } from "../servicios/api";

export default function SesionEnVivo() {
  const { id } = useParams();
  const [sesion, setSesion] = useState(null);
  const [alerta, setAlerta] = useState(null);
  const [modal, setModal] = useState(null); // aprendiz para registro manual
  const [manual, setManual] = useState({ estado: "presente", motivo: "" });
  const [mensaje, setMensaje] = useState(null);
  const socketRef = useRef(null);

  const cargar = () => api(`/sesiones/${id}`).then(setSesion).catch((e) => setMensaje({ tipo: "error", texto: e.message }));

  useEffect(() => {
    cargar();
    const socket = io();
    socketRef.current = socket;
    socket.emit("unirse_sesion", id);
    socket.on("marcacion", (m) => {
      setSesion((s) => s && ({
        ...s,
        aprendices: s.aprendices.map((a) =>
          a.id_usuario === m.id_aprendiz ? { ...a, estado: m.estado, hora_marca: m.hora_marca, metodo: m.metodo } : a),
      }));
    });
    socket.on("huella_no_reconocida", () => {
      setAlerta("Huella no reconocida en el lector. Si el aprendiz insiste, usa el registro manual.");
      setTimeout(() => setAlerta(null), 8000);
    });
    return () => { socket.emit("salir_sesion", id); socket.disconnect(); };
  }, [id]);

  async function guardarManual() {
    try {
      const r = await api(`/sesiones/${id}/asistencia-manual`, {
        method: "POST",
        body: { id_aprendiz: modal.id_usuario, estado: manual.estado, motivo: manual.motivo },
      });
      setMensaje({ tipo: "exito", texto: r.mensaje });
      setModal(null); setManual({ estado: "presente", motivo: "" }); cargar();
    } catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  async function cerrar() {
    if (!confirm("Al cerrar, los aprendices sin marca quedarán AUSENTES y recibirán el enlace de justificación (72 horas). ¿Cerrar la sesión?")) return;
    try {
      const r = await api(`/sesiones/${id}/cerrar`, { method: "POST" });
      setMensaje({ tipo: "exito", texto: r.mensaje }); cargar();
    } catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  if (!sesion) return <div className="vacio">Cargando sesión…</div>;
  const marcados = sesion.aprendices.filter((a) => a.estado).length;

  return (
    <>
      <div className="cabecera-pagina">
        <div>
          <Link to="/sesiones" style={{ fontSize: 13.5 }}>← Sesiones de hoy</Link>
          <h1>
            {sesion.estado === "activa" && <span className="pulso" />}
            Ficha {sesion.numero_ficha} · Ambiente {sesion.numero_ambiente}
          </h1>
          <p>{sesion.programa} · {new Date(sesion.fecha).toLocaleDateString("es-CO")} · {sesion.hora_inicio.slice(0,5)}–{sesion.hora_fin.slice(0,5)}
             · <b>{marcados}/{sesion.aprendices.length}</b> registrados</p>
        </div>
        {sesion.estado === "activa"
          ? <button className="boton peligro" onClick={cerrar}>⏹ Cerrar sesión de clase</button>
          : <span className="insignia cerrada">Sesión cerrada</span>}
      </div>

      {alerta && <div className="mensaje error">⚠️ {alerta}</div>}
      {mensaje && <div className={`mensaje ${mensaje.tipo}`}>{mensaje.texto}</div>}

      <table className="tabla">
        <thead><tr><th>Aprendiz</th><th>Documento</th><th>Huella</th><th>Estado</th><th>Hora</th><th>Método</th><th></th></tr></thead>
        <tbody>
          {sesion.aprendices.map((a) => (
            <tr key={a.id_usuario}>
              <td>{a.nombres} {a.apellidos}</td>
              <td>{a.documento}</td>
              <td>{a.tiene_huella ? "🫆" : <span title="Sin huella registrada: usar manual">✋</span>}</td>
              <td>{a.estado ? <span className={`insignia ${a.estado}`}>{a.estado}</span> : <span style={{ color: "var(--tinta-suave)" }}>esperando…</span>}</td>
              <td>{a.hora_marca ? new Date(a.hora_marca).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
              <td>{a.metodo ? <span className={`insignia ${a.metodo}`}>{a.metodo}</span> : "—"}</td>
              <td><button className="boton mini suave" onClick={() => setModal(a)}>✍ Manual</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {modal && (
        <div className="superposicion" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Registro manual · {modal.nombres} {modal.apellidos}</h2>
            <p style={{ color: "var(--tinta-suave)", fontSize: 13.5 }}>
              Para casos excepcionales: lesión, lector caído o huella no reconocida. Queda trazado en auditoría.
            </p>
            <label>Estado</label>
            <select value={manual.estado} onChange={(e) => setManual({ ...manual, estado: e.target.value })}>
              <option value="presente">Presente</option>
              <option value="tardanza">Tardanza</option>
              <option value="ausente">Ausente</option>
              <option value="justificada">Justificada</option>
            </select>
            <label>Justificación del registro manual (obligatoria)</label>
            <textarea rows={3} value={manual.motivo} onChange={(e) => setManual({ ...manual, motivo: e.target.value })}
                      placeholder="Ej.: lesión en la mano derecha, el lector no reconoció la huella tras 3 intentos…" />
            <div className="acciones-modal">
              <button className="boton suave" onClick={() => setModal(null)}>Cancelar</button>
              <button className="boton" disabled={!manual.motivo.trim()} onClick={guardarManual}>Guardar registro</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
