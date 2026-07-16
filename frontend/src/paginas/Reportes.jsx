import { useEffect, useState } from "react";
import { api, obtenerSesion } from "../servicios/api";

const VACIO = { nombre: "", id_ficha: "", estado: "", fecha_inicio: "", fecha_fin: "" };

export default function Reportes() {
  const sesion = obtenerSesion();
  const [filtros, setFiltros] = useState(VACIO);
  const [fichas, setFichas] = useState([]);
  const [resultados, setResultados] = useState(null);
  const [guardadas, setGuardadas] = useState([]);
  const [mensaje, setMensaje] = useState(null);

  useEffect(() => {
    api("/fichas").then(setFichas);
    api("/reportes/busquedas-guardadas").then(setGuardadas);
  }, []);

  const query = () => new URLSearchParams(Object.entries(filtros).filter(([, v]) => v)).toString();

  async function buscar() {
    try { setResultados(await api(`/reportes/busqueda?${query()}`)); }
    catch (e) { setMensaje({ tipo: "error", texto: e.message }); }
  }

  async function exportar() {
    const r = await fetch(`/api/reportes/exportar?${query()}`, {
      headers: { Authorization: `Bearer ${sesion.token}` },
    });
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "reporte_asistencia.csv";
    a.click();
  }

  async function guardar() {
    const nombre = prompt("Nombre para esta búsqueda guardada:");
    if (!nombre) return;
    await api("/reportes/busquedas-guardadas", { method: "POST", body: { nombre, filtros } });
    setGuardadas(await api("/reportes/busquedas-guardadas"));
  }

  return (
    <>
      <div className="cabecera-pagina">
        <div><h1>Búsqueda avanzada y reportes</h1>
        <p>Combina filtros, guarda tus búsquedas frecuentes y exporta a Excel (CSV).</p></div>
      </div>
      {mensaje && <div className={`mensaje ${mensaje.tipo}`}>{mensaje.texto}</div>}

      <div className="tarjeta" style={{ marginBottom: 18 }}>
        <div className="rejilla-2">
          <div><label>Aprendiz (nombre o documento)</label>
            <input value={filtros.nombre} onChange={(e) => setFiltros({ ...filtros, nombre: e.target.value })} /></div>
          <div><label>Ficha</label>
            <select value={filtros.id_ficha} onChange={(e) => setFiltros({ ...filtros, id_ficha: e.target.value })}>
              <option value="">Todas</option>
              {fichas.map((f) => <option key={f.id_ficha} value={f.id_ficha}>{f.numero_ficha}</option>)}
            </select></div>
        </div>
        <div className="rejilla-2">
          <div><label>Estado</label>
            <select value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}>
              <option value="">Todos</option>
              <option value="presente">Presente</option><option value="tardanza">Tardanza</option>
              <option value="ausente">Ausente</option><option value="justificada">Justificada</option>
            </select></div>
          <div className="rejilla-2">
            <div><label>Desde</label><input type="date" value={filtros.fecha_inicio} onChange={(e) => setFiltros({ ...filtros, fecha_inicio: e.target.value })} /></div>
            <div><label>Hasta</label><input type="date" value={filtros.fecha_fin} onChange={(e) => setFiltros({ ...filtros, fecha_fin: e.target.value })} /></div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <button className="boton" onClick={buscar}>🔎 Buscar</button>
          <button className="boton suave" onClick={guardar}>💾 Guardar búsqueda</button>
          {resultados?.length > 0 && <button className="boton exito" onClick={exportar}>📥 Exportar CSV</button>}
          {guardadas.length > 0 && (
            <select style={{ maxWidth: 240 }} onChange={(e) => {
              const g = guardadas.find((x) => x.id_busqueda === Number(e.target.value));
              if (g) setFiltros({ ...VACIO, ...g.filtros });
            }}>
              <option value="">Cargar búsqueda guardada…</option>
              {guardadas.map((g) => <option key={g.id_busqueda} value={g.id_busqueda}>{g.nombre}</option>)}
            </select>
          )}
        </div>
      </div>

      {resultados && (
        <table className="tabla">
          <thead><tr><th>Fecha</th><th>Aprendiz</th><th>Documento</th><th>Ficha</th><th>Estado</th><th>Hora</th><th>Método</th></tr></thead>
          <tbody>
            {resultados.map((r) => (
              <tr key={r.id_asistencia}>
                <td>{new Date(r.fecha).toLocaleDateString("es-CO")}</td>
                <td>{r.aprendiz}</td><td>{r.documento}</td><td>{r.numero_ficha}</td>
                <td><span className={`insignia ${r.estado}`}>{r.estado}</span></td>
                <td>{r.hora || "—"}</td>
                <td><span className={`insignia ${r.metodo}`}>{r.metodo}</span></td>
              </tr>
            ))}
            {!resultados.length && <tr><td colSpan={7}><div className="vacio">Sin resultados con esos filtros.</div></td></tr>}
          </tbody>
        </table>
      )}
    </>
  );
}
