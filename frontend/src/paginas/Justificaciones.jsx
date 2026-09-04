import { useEffect, useState } from "react";
import { api } from "../servicios/api";

function textoPlazo(horas) {
  const h = Number(horas || 72);
  return h % 24 === 0 ? `${h / 24} día(s)` : `${h} horas`;
}

const ETIQUETA_TIPO = {
  cita_medica: "Cita médica",
  incapacidad_medica: "Incapacidad médica",
  calamidad_domestica: "Calamidad doméstica",
  diligencia_legal: "Diligencia legal / trámite obligatorio",
  duelo: "Duelo (fallecimiento familiar)",
  otro: "Otro",
};

export default function Justificaciones() {
  const [lista, setLista] = useState([]);
  const [detalle, setDetalle] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [plazo, setPlazo] = useState(72);
  const [rechazando, setRechazando] = useState(false);
  const [observacion, setObservacion] = useState("");

  const cargar = () => api("/justificaciones").then(setLista).catch((e) => setMensaje({ tipo: "error", texto: e.message }));
  useEffect(() => {
    cargar();
    api("/configuracion").then((c) => setPlazo(c.horas_justificacion));
  }, []);

  function abrir(j) { setDetalle(j); setRechazando(false); setObservacion(""); }

  async function validar(j, estado, obs) {
    try {
      const r = await api(`/justificaciones/${j.id_justificacion}`, { method: "PATCH", body: { estado, observacion: obs } });
      setMensaje({ tipo: "exito", texto: r.mensaje }); setDetalle(null); setRechazando(false); cargar();
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
        <p>Los aprendices tienen {textoPlazo(plazo)} para cargar su excusa. Al aprobarla, la ausencia pasa a "justificada".</p></div>
      </div>
      {mensaje && <div className={`mensaje ${mensaje.tipo}`}>{mensaje.texto}</div>}

      <table className="tabla">
        <thead><tr><th>Fecha clase</th><th>Aprendiz</th><th>Ficha</th><th>Tipo</th><th>Enviada</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          {lista.map((j) => (
            <tr key={j.id_justificacion}>
              <td>{new Date(j.fecha).toLocaleDateString("es-CO")}</td>
              <td>{j.nombres} {j.apellidos}</td>
              <td>{j.numero_ficha}</td>
              <td>{ETIQUETA_TIPO[j.tipo] || "—"}</td>
              <td>{j.enviada_en ? new Date(j.enviada_en).toLocaleString("es-CO") : "—"}</td>
              <td><span className={`insignia ${j.estado}`}>{j.estado}</span></td>
              <td><button className="boton mini suave" onClick={() => abrir(j)}>Revisar</button></td>
            </tr>
          ))}
          {!lista.length && <tr><td colSpan={7}><div className="vacio">No hay justificaciones para revisar.</div></td></tr>}
        </tbody>
      </table>

      {detalle && (
        <div className="superposicion" onClick={() => setDetalle(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Justificación · {detalle.nombres} {detalle.apellidos}</h2>
            <p style={{ color: "var(--tinta-suave)", fontSize: 13.5 }}>
              Clase del {new Date(detalle.fecha).toLocaleDateString("es-CO")} · Ficha {detalle.numero_ficha}
              · {ETIQUETA_TIPO[detalle.tipo] || "Sin tipo"}
            </p>
            <label>Motivo descrito por el aprendiz</label>
            <div className="tarjeta" style={{ background: "var(--violeta-50)" }}>{detalle.descripcion || "Sin descripción"}</div>
            {detalle.nombre_archivo && (
              <p style={{ marginTop: 12 }}>
                📎 Adjunto: <a href="#" onClick={(e) => { e.preventDefault(); verArchivo(detalle); }}>{detalle.nombre_archivo}</a>
              </p>
            )}

            {detalle.observacion_validacion && (
              <>
                <label style={{ marginTop: 14 }}>Observación de {detalle.estado === "rechazada" ? "rechazo" : "aprobación"}</label>
                <div className="tarjeta" style={{ background: "var(--rojo-suave)" }}>{detalle.observacion_validacion}</div>
              </>
            )}

            {detalle.estado === "enviada" && !rechazando && (
              <div className="acciones-modal">
                <button className="boton peligro" onClick={() => setRechazando(true)}>Rechazar</button>
                <button className="boton exito" onClick={() => validar(detalle, "aprobada")}>Aprobar (queda justificada)</button>
              </div>
            )}

            {detalle.estado === "enviada" && rechazando && (<>
              <label style={{ marginTop: 14 }}>Explica por qué se rechaza (obligatorio, el aprendiz lo verá)</label>
              <textarea rows={3} value={observacion} onChange={(e) => setObservacion(e.target.value)}
                        placeholder="Ej.: la foto no corresponde a una constancia médica real." />
              <div className="acciones-modal">
                <button className="boton suave" onClick={() => setRechazando(false)}>Cancelar</button>
                <button className="boton peligro" disabled={!observacion.trim()} onClick={() => validar(detalle, "rechazada", observacion)}>Confirmar rechazo</button>
              </div>
            </>)}

            {detalle.estado !== "enviada" && (
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
