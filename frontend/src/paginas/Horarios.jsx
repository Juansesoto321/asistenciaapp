import { useEffect, useState } from "react";
import { api, obtenerSesion } from "../servicios/api";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const VACIO = { id_ficha: "", id_ambiente: "", id_instructor: "", id_periodo: "", dia_semana: "1", hora_inicio: "07:00", hora_fin: "13:00" };

export default function Horarios() {
  const rol = obtenerSesion().usuario.rol;
  const [horarios, setHorarios] = useState([]);
  const [fichas, setFichas] = useState([]);
  const [ambientes, setAmbientes] = useState([]);
  const [instructores, setInstructores] = useState([]);
  const [periodos, setPeriodos] = useState([]);
  const [modal, setModal] = useState(false);
  const [f, setF] = useState(VACIO);
  const [mensaje, setMensaje] = useState(null);

  const cargar = () => api("/horarios").then(setHorarios).catch((e) => setMensaje({ tipo: "error", texto: e.message }));
  useEffect(() => {
    cargar();
    if (rol === "administrador") {
      api("/fichas").then(setFichas);
      api("/ambientes").then(setAmbientes);
      api("/usuarios?rol=instructor&estado=activo").then(setInstructores);
      api("/periodos").then(setPeriodos);
    }
  }, []);

  async function crear() {
    try {
      await api("/horarios", { method: "POST", body: f });
      setMensaje({ tipo: "exito", texto: "Horario creado sin conflictos" });
      setModal(false); setF(VACIO); cargar();
    } catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  async function eliminar(id) {
    if (!confirm("¿Eliminar este horario?")) return;
    await api(`/horarios/${id}`, { method: "DELETE" });
    cargar();
  }

  return (
    <>
      <div className="cabecera-pagina">
        <div><h1>{rol === "instructor" ? "Mis horarios" : "Horarios de clase"}</h1>
        <p>El sistema valida que no haya cruces de instructor ni de ambiente.</p></div>
        {rol === "administrador" && <button className="boton" onClick={() => setModal(true)}>+ Nuevo horario</button>}
      </div>
      {mensaje && <div className={`mensaje ${mensaje.tipo}`}>{mensaje.texto}</div>}

      <table className="tabla">
        <thead><tr><th>Día</th><th>Hora</th><th>Ficha</th><th>Programa</th><th>Ambiente</th><th>Instructor</th>{rol === "administrador" && <th></th>}</tr></thead>
        <tbody>
          {horarios.map((h) => (
            <tr key={h.id_horario}>
              <td><b>{DIAS[h.dia_semana]}</b></td>
              <td>{h.hora_inicio.slice(0, 5)} – {h.hora_fin.slice(0, 5)}</td>
              <td>{h.numero_ficha}</td>
              <td>{h.programa}</td>
              <td>{h.numero_ambiente}</td>
              <td>{h.instructor}</td>
              {rol === "administrador" && <td><button className="boton mini peligro" onClick={() => eliminar(h.id_horario)}>Eliminar</button></td>}
            </tr>
          ))}
          {!horarios.length && <tr><td colSpan={7}><div className="vacio">No hay horarios configurados.</div></td></tr>}
        </tbody>
      </table>

      {modal && (
        <div className="superposicion" onClick={() => setModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Nuevo horario</h2>
            <div className="rejilla-2">
              <div>
                <label>Ficha</label>
                <select value={f.id_ficha} onChange={(e) => setF({ ...f, id_ficha: e.target.value })}>
                  <option value="">Selecciona…</option>
                  {fichas.map((x) => <option key={x.id_ficha} value={x.id_ficha}>{x.numero_ficha} · {x.programa}</option>)}
                </select>
              </div>
              <div>
                <label>Ambiente</label>
                <select value={f.id_ambiente} onChange={(e) => setF({ ...f, id_ambiente: e.target.value })}>
                  <option value="">Selecciona…</option>
                  {ambientes.map((a) => <option key={a.id_ambiente} value={a.id_ambiente}>{a.numero_ambiente} · {a.sede_centro}</option>)}
                </select>
              </div>
            </div>
            <div className="rejilla-2">
              <div>
                <label>Instructor</label>
                <select value={f.id_instructor} onChange={(e) => setF({ ...f, id_instructor: e.target.value })}>
                  <option value="">Selecciona…</option>
                  {instructores.map((i) => <option key={i.id_usuario} value={i.id_usuario}>{i.nombres} {i.apellidos}</option>)}
                </select>
              </div>
              <div>
                <label>Periodo</label>
                <select value={f.id_periodo} onChange={(e) => setF({ ...f, id_periodo: e.target.value })}>
                  <option value="">Selecciona…</option>
                  {periodos.map((p) => <option key={p.id_periodo} value={p.id_periodo}>{p.nombre}</option>)}
                </select>
              </div>
            </div>
            <div className="rejilla-2">
              <div>
                <label>Día de la semana</label>
                <select value={f.dia_semana} onChange={(e) => setF({ ...f, dia_semana: e.target.value })}>
                  {DIAS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
              <div className="rejilla-2">
                <div><label>Inicio</label><input type="time" value={f.hora_inicio} onChange={(e) => setF({ ...f, hora_inicio: e.target.value })} /></div>
                <div><label>Fin</label><input type="time" value={f.hora_fin} onChange={(e) => setF({ ...f, hora_fin: e.target.value })} /></div>
              </div>
            </div>
            <div className="acciones-modal">
              <button className="boton suave" onClick={() => setModal(false)}>Cancelar</button>
              <button className="boton" onClick={crear}>Guardar horario</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
