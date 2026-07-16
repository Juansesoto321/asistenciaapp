import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../servicios/api";

export default function Sesiones() {
  const navegar = useNavigate();
  const [horarios, setHorarios] = useState([]);
  const [mensaje, setMensaje] = useState(null);

  useEffect(() => { api("/sesiones/hoy").then(setHorarios).catch((e) => setMensaje({ tipo: "error", texto: e.message })); }, []);

  async function iniciar(h) {
    try {
      const r = await api("/sesiones/iniciar", { method: "POST", body: { id_horario: h.id_horario } });
      navegar(`/sesiones/${r.id_sesion}`);
    } catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  return (
    <>
      <div className="cabecera-pagina">
        <div><h1>Sesiones de hoy</h1>
        <p>Inicia la sesión para activar el lector del ambiente y supervisar la asistencia en tiempo real.</p></div>
      </div>
      {mensaje && <div className={`mensaje ${mensaje.tipo}`}>{mensaje.texto}</div>}

      <table className="tabla">
        <thead><tr><th>Hora</th><th>Ficha</th><th>Programa</th><th>Ambiente</th><th>Sesión</th><th></th></tr></thead>
        <tbody>
          {horarios.map((h) => (
            <tr key={h.id_horario}>
              <td><b>{h.hora_inicio.slice(0,5)} – {h.hora_fin.slice(0,5)}</b></td>
              <td>{h.numero_ficha}</td>
              <td>{h.programa}</td>
              <td>{h.numero_ambiente}</td>
              <td>{h.estado_sesion
                ? <span className={`insignia ${h.estado_sesion}`}>{h.estado_sesion}</span>
                : <span className="insignia pendiente">sin iniciar</span>}</td>
              <td>
                {h.estado_sesion === "activa" && <button className="boton mini" onClick={() => navegar(`/sesiones/${h.id_sesion}`)}>Supervisar →</button>}
                {h.estado_sesion === "cerrada" && <button className="boton mini suave" onClick={() => navegar(`/sesiones/${h.id_sesion}`)}>Ver resumen</button>}
                {!h.estado_sesion && <button className="boton mini" onClick={() => iniciar(h)}>▶ Iniciar sesión de hoy</button>}
              </td>
            </tr>
          ))}
          {!horarios.length && <tr><td colSpan={6}><div className="vacio">No tienes clases programadas para hoy.</div></td></tr>}
        </tbody>
      </table>
    </>
  );
}
