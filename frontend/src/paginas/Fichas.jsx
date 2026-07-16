import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, obtenerSesion } from "../servicios/api";

const VACIA = { numero_ficha: "", programa: "", jornada: "mañana", fecha_inicio: "", fecha_fin: "", id_periodo: "", id_instructor: "" };

export default function Fichas() {
  const rol = obtenerSesion().usuario.rol;
  const [fichas, setFichas] = useState([]);
  const [periodos, setPeriodos] = useState([]);
  const [instructores, setInstructores] = useState([]);
  const [modal, setModal] = useState(false);
  const [f, setF] = useState(VACIA);
  const [mensaje, setMensaje] = useState(null);

  const cargar = () => api("/fichas").then(setFichas).catch((e) => setMensaje({ tipo: "error", texto: e.message }));
  useEffect(() => {
    cargar();
    if (rol === "administrador") {
      api("/periodos").then(setPeriodos);
      api("/usuarios?rol=instructor&estado=activo").then(setInstructores);
    }
  }, []);

  async function crear() {
    try {
      await api("/fichas", { method: "POST", body: f });
      setMensaje({ tipo: "exito", texto: "Ficha creada" }); setModal(false); setF(VACIA); cargar();
    } catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  return (
    <>
      <div className="cabecera-pagina">
        <div><h1>{rol === "instructor" ? "Mis fichas" : "Fichas de formación"}</h1>
        <p>Programas, matrículas y enrolamiento de huella por ficha.</p></div>
        {rol === "administrador" && <button className="boton" onClick={() => setModal(true)}>+ Nueva ficha</button>}
      </div>
      {mensaje && <div className={`mensaje ${mensaje.tipo}`}>{mensaje.texto}</div>}

      <table className="tabla">
        <thead><tr><th>Ficha</th><th>Programa</th><th>Jornada</th><th>Instructor</th><th>Aprendices</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          {fichas.map((x) => (
            <tr key={x.id_ficha}>
              <td><b>{x.numero_ficha}</b></td>
              <td>{x.programa}</td>
              <td style={{ textTransform: "capitalize" }}>{x.jornada}</td>
              <td>{x.instructor}</td>
              <td>{x.total_aprendices}</td>
              <td><span className={`insignia ${x.estado}`}>{x.estado}</span></td>
              <td><Link className="boton mini suave" to={`/fichas/${x.id_ficha}`}>Ver detalles →</Link></td>
            </tr>
          ))}
          {!fichas.length && <tr><td colSpan={7}><div className="vacio">Aún no hay fichas registradas.</div></td></tr>}
        </tbody>
      </table>

      {modal && (
        <div className="superposicion" onClick={() => setModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Nueva ficha</h2>
            <div className="rejilla-2">
              <div><label>Número de ficha</label><input value={f.numero_ficha} onChange={(e) => setF({ ...f, numero_ficha: e.target.value })} /></div>
              <div>
                <label>Jornada</label>
                <select value={f.jornada} onChange={(e) => setF({ ...f, jornada: e.target.value })}>
                  <option value="mañana">Mañana</option><option value="tarde">Tarde</option>
                  <option value="noche">Noche</option><option value="mixta">Mixta</option>
                </select>
              </div>
            </div>
            <label>Programa de formación</label>
            <input value={f.programa} onChange={(e) => setF({ ...f, programa: e.target.value })} placeholder="Análisis y Desarrollo de Software" />
            <div className="rejilla-2">
              <div><label>Fecha inicio</label><input type="date" value={f.fecha_inicio} onChange={(e) => setF({ ...f, fecha_inicio: e.target.value })} /></div>
              <div><label>Fecha fin</label><input type="date" value={f.fecha_fin} onChange={(e) => setF({ ...f, fecha_fin: e.target.value })} /></div>
            </div>
            <div className="rejilla-2">
              <div>
                <label>Periodo</label>
                <select value={f.id_periodo} onChange={(e) => setF({ ...f, id_periodo: e.target.value })}>
                  <option value="">Selecciona…</option>
                  {periodos.map((p) => <option key={p.id_periodo} value={p.id_periodo}>{p.nombre}</option>)}
                </select>
              </div>
              <div>
                <label>Instructor titular</label>
                <select value={f.id_instructor} onChange={(e) => setF({ ...f, id_instructor: e.target.value })}>
                  <option value="">Selecciona…</option>
                  {instructores.map((i) => <option key={i.id_usuario} value={i.id_usuario}>{i.nombres} {i.apellidos}</option>)}
                </select>
              </div>
            </div>
            <div className="acciones-modal">
              <button className="boton suave" onClick={() => setModal(false)}>Cancelar</button>
              <button className="boton" onClick={crear}>Crear ficha</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
