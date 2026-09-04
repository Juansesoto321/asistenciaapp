import { useEffect, useState } from "react";
import { api } from "../servicios/api";

const PERIODO_VACIO = { nombre: "", fecha_inicio: "", fecha_fin: "" };

export default function Configuracion() {
  const [conf, setConf] = useState(null);
  const [periodos, setPeriodos] = useState([]);
  const [nuevoPeriodo, setNuevoPeriodo] = useState(PERIODO_VACIO);
  const [mensaje, setMensaje] = useState(null);

  const cargarPeriodos = () => api("/periodos").then(setPeriodos);
  useEffect(() => { api("/configuracion").then(setConf); cargarPeriodos(); }, []);

  async function guardar() {
    try {
      const r = await api("/configuracion", { method: "PUT", body: conf });
      setMensaje({ tipo: "exito", texto: r.mensaje });
    } catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  async function crearPeriodo() {
    if (!nuevoPeriodo.nombre.trim() || !nuevoPeriodo.fecha_inicio || !nuevoPeriodo.fecha_fin)
      return setMensaje({ tipo: "error", texto: "Completa nombre, fecha de inicio y fecha de fin del periodo" });
    try {
      await api("/periodos", { method: "POST", body: nuevoPeriodo });
      setMensaje({ tipo: "exito", texto: "Periodo creado" });
      setNuevoPeriodo(PERIODO_VACIO);
      cargarPeriodos();
    } catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  if (!conf) return <div className="vacio">Cargando…</div>;
  return (
    <>
      <div className="cabecera-pagina">
        <div><h1>Configuración del sistema</h1><p>Parámetros que gobiernan las reglas de negocio.</p></div>
      </div>
      {mensaje && <div className={`mensaje ${mensaje.tipo}`}>{mensaje.texto}</div>}
      <div className="tarjeta" style={{ maxWidth: 560 }}>
        <label>Nombre de la institución</label>
        <input value={conf.nombre_institucion || ""} onChange={(e) => setConf({ ...conf, nombre_institucion: e.target.value })} />
        <label>Minutos de tolerancia antes de marcar tardanza</label>
        <input type="number" min="0" value={conf.minutos_tolerancia || 15}
               onChange={(e) => setConf({ ...conf, minutos_tolerancia: e.target.value })} />
        <label>Porcentaje mínimo de asistencia (%)</label>
        <input type="number" min="0" max="100" value={conf.porcentaje_minimo || 80}
               onChange={(e) => setConf({ ...conf, porcentaje_minimo: e.target.value })} />
        <label>Horas de plazo para cargar justificaciones</label>
        <input type="number" min="1" value={conf.horas_justificacion || 72}
               onChange={(e) => setConf({ ...conf, horas_justificacion: e.target.value })} />
        <button className="boton" style={{ marginTop: 18 }} onClick={guardar}>Guardar configuración</button>
      </div>

      <div className="cabecera-pagina" style={{ marginTop: 32 }}>
        <div><h1 style={{ fontSize: 20 }}>Periodos académicos</h1><p>Los periodos se usan al crear fichas, ambientes y horarios.</p></div>
      </div>
      <div className="tarjeta" style={{ maxWidth: 560 }}>
        <table className="tabla">
          <thead><tr><th>Nombre</th><th>Inicio</th><th>Fin</th></tr></thead>
          <tbody>
            {periodos.map((p) => (
              <tr key={p.id_periodo}>
                <td>{p.nombre}</td>
                <td>{new Date(p.fecha_inicio).toLocaleDateString("es-CO")}</td>
                <td>{new Date(p.fecha_fin).toLocaleDateString("es-CO")}</td>
              </tr>
            ))}
            {!periodos.length && <tr><td colSpan={3}><div className="vacio">Aún no hay periodos creados.</div></td></tr>}
          </tbody>
        </table>
        <h3 style={{ fontSize: 15, marginTop: 20 }}>Nuevo periodo</h3>
        <label>Nombre *</label>
        <input required value={nuevoPeriodo.nombre} onChange={(e) => setNuevoPeriodo({ ...nuevoPeriodo, nombre: e.target.value })} placeholder="2026-2" />
        <div className="rejilla-2">
          <div><label>Fecha inicio *</label><input required type="date" value={nuevoPeriodo.fecha_inicio} onChange={(e) => setNuevoPeriodo({ ...nuevoPeriodo, fecha_inicio: e.target.value })} /></div>
          <div><label>Fecha fin *</label><input required type="date" value={nuevoPeriodo.fecha_fin} onChange={(e) => setNuevoPeriodo({ ...nuevoPeriodo, fecha_fin: e.target.value })} /></div>
        </div>
        <button className="boton" style={{ marginTop: 18 }} onClick={crearPeriodo}>Crear periodo</button>
      </div>
    </>
  );
}
