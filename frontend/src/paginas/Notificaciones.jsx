import { useEffect, useState } from "react";
import { api } from "../servicios/api";

export default function Notificaciones() {
  const [lista, setLista] = useState([]);
  const cargar = () => api("/notificaciones").then(setLista);
  useEffect(() => { cargar(); }, []);

  async function marcarLeida(n) {
    await api(`/notificaciones/${n.id_notificacion}/leida`, { method: "PATCH" });
    cargar();
  }

  return (
    <>
      <div className="cabecera-pagina">
        <div><h1>Notificaciones</h1><p>Inasistencias, justificaciones, solicitudes y avisos del sistema.</p></div>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {lista.map((n) => (
          <div key={n.id_notificacion} className="tarjeta"
               style={{ opacity: n.leida ? 0.65 : 1, display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center" }}>
            <div>
              <b>{n.titulo}</b>
              <p style={{ color: "var(--tinta-suave)", fontSize: 13.5, marginTop: 4 }}>{n.mensaje}</p>
              <small style={{ color: "var(--tinta-suave)" }}>{new Date(n.creado_en).toLocaleString("es-CO")}</small>
            </div>
            {!n.leida && <button className="boton mini suave" onClick={() => marcarLeida(n)}>Marcar leída</button>}
          </div>
        ))}
        {!lista.length && <div className="vacio">No tienes notificaciones.</div>}
      </div>
    </>
  );
}
