import { useEffect, useState } from "react";
import { api } from "../servicios/api";

export default function Justificaciones() {
  const [lista, setLista] = useState([]);
  const [detalle, setDetalle] = useState(null);
  const [mensaje, setMensaje] = useState(null);

  const cargar = () => api("/justificaciones").then(setLista).catch((e) => setMensaje({ tipo: "error", texto: e.message }));
  useEffect(() => { cargar(); }, []);

  async function validar(j, estado) {
    try {
      const r = await api(`/justificaciones/${j.id_justificacion}`, { method: "PATCH", body: { estado } });
      setMensaje({ tipo: "exito", texto: r.mensaje }); setDetalle(null); cargar();
    } catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  async function verArchivo(j) {
    const r = await api(`/justificaciones/${j.id_justificacion}/archivo`);
    const enlace = document.createElement("a");
    enlace.href = r.archivo_datos;
    enlace.download = r.nombre_archivo || "adjunto";
    enlace.click();
  }

  return (
    <>
      <div className="cabecera-pagina">
        <div><h1>Justificaciones de inasistencia</h1>
        <p>Los aprendices tienen 72 horas para cargar su excusa. Al aprobarla, la ausencia pasa a "justificada".</p></div>
      </div>
      {mensaje && <div className={`mensaje ${mensaje.tipo}`}>{mensaje.texto}</div>}

      <table className="tabla">
        <thead><tr><th>Fecha clase</th><th>Aprendiz</th><th>Ficha</th><th>Enviada</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          {lista.map((j) => (
            <tr key={j.id_justificacion}>
              <td>{new Date(j.fecha).toLocaleDateString("es-CO")}</td>
              <td>{j.nombres} {j.apellidos}</td>
              <td>{j.numero_ficha}</td>
              <td>{j.enviada_en ? new Date(j.enviada_en).toLocaleString("es-CO") : "—"}</td>
              <td><span className={`insignia ${j.estado}`}>{j.estado}</span></td>
              <td><button className="boton mini suave" onClick={() => setDetalle(j)}>Revisar</button></td>
            </tr>
          ))}
          {!lista.length && <tr><td colSpan={6}><div className="vacio">No hay justificaciones para revisar.</div></td></tr>}
        </tbody>
      </table>

      {detalle && (
        <div className="superposicion" onClick={() => setDetalle(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Justificación · {detalle.nombres} {detalle.apellidos}</h2>
            <p style={{ color: "var(--tinta-suave)", fontSize: 13.5 }}>
              Clase del {new Date(detalle.fecha).toLocaleDateString("es-CO")} · Ficha {detalle.numero_ficha}
            </p>
            <label>Motivo descrito por el aprendiz</label>
            <div className="tarjeta" style={{ background: "var(--violeta-50)" }}>{detalle.descripcion || "Sin descripción"}</div>
            {detalle.nombre_archivo && (
              <p style={{ marginTop: 12 }}>
                📎 Adjunto: <a href="#" onClick={(e) => { e.preventDefault(); verArchivo(detalle); }}>{detalle.nombre_archivo}</a>
              </p>
            )}
            {detalle.estado === "enviada" ? (
              <div className="acciones-modal">
                <button className="boton peligro" onClick={() => validar(detalle, "rechazada")}>Rechazar</button>
                <button className="boton exito" onClick={() => validar(detalle, "aprobada")}>Aprobar (queda justificada)</button>
              </div>
            ) : (
              <div className="acciones-modal">
                <span className={`insignia ${detalle.estado}`}>{detalle.estado}</span>
                <button className="boton suave" onClick={() => setDetalle(null)}>Cerrar</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
