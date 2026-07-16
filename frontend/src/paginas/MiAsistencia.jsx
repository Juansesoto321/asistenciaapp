import { useEffect, useState } from "react";
import { api } from "../servicios/api";

function Anillo({ porcentaje, minimo }) {
  const critico = porcentaje < minimo;
  const color = critico ? "var(--rojo)" : "var(--verde)";
  const r = 56, c = 2 * Math.PI * r;
  return (
    <div className="anillo-progreso">
      <svg width="132" height="132" role="img" aria-label={`Asistencia ${porcentaje}%`}>
        <circle cx="66" cy="66" r={r} fill="none" stroke="var(--borde)" strokeWidth="12" />
        <circle cx="66" cy="66" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
                strokeDasharray={c} strokeDashoffset={c * (1 - porcentaje / 100)}
                transform="rotate(-90 66 66)" />
      </svg>
      <div className="centro" style={{ color }}>{porcentaje}%</div>
    </div>
  );
}

export default function MiAsistencia() {
  const [datos, setDatos] = useState(null);
  const [mensaje, setMensaje] = useState(null);

  const cargar = (idFicha) =>
    api(`/reportes/mi-historial${idFicha ? `?id_ficha=${idFicha}` : ""}`)
      .then(setDatos).catch((e) => setMensaje({ tipo: "error", texto: e.message }));
  useEffect(() => cargar(), []);

  if (!datos) return <div className="vacio">Cargando…</div>;
  const r = datos.resumen;

  return (
    <>
      <div className="cabecera-pagina">
        <div><h1>Mi asistencia</h1><p>Historial personal, porcentaje acumulado y estado de cada clase.</p></div>
        {datos.fichas.length > 1 && (
          <select style={{ maxWidth: 280 }} value={datos.id_ficha || ""} onChange={(e) => cargar(e.target.value)}>
            {datos.fichas.map((f) => <option key={f.id_ficha} value={f.id_ficha}>{f.numero_ficha} · {f.programa}</option>)}
          </select>
        )}
      </div>
      {mensaje && <div className={`mensaje ${mensaje.tipo}`}>{mensaje.texto}</div>}

      {r && (<>
        {r.porcentaje < r.minimo && (
          <div className="mensaje error">
            ⚠️ Tu asistencia ({r.porcentaje}%) está por debajo del mínimo institucional ({r.minimo}%).
            Habla con tu instructor y justifica tus inasistencias a tiempo.
          </div>
        )}
        <div className="tarjeta" style={{ display: "flex", gap: 26, alignItems: "center", flexWrap: "wrap", marginBottom: 18 }}>
          <Anillo porcentaje={r.porcentaje} minimo={r.minimo} />
          <div className="fila-tarjetas" style={{ flex: 1, marginBottom: 0 }}>
            <div className="tarjeta-metrica"><div className="valor" style={{ color: "var(--verde)" }}>{r.presentes}</div><div className="nombre">Presentes</div></div>
            <div className="tarjeta-metrica"><div className="valor" style={{ color: "var(--ambar)" }}>{r.tardanzas}</div><div className="nombre">Tardanzas</div></div>
            <div className="tarjeta-metrica"><div className="valor" style={{ color: "var(--azul)" }}>{r.justificadas}</div><div className="nombre">Justificadas</div></div>
            <div className="tarjeta-metrica"><div className="valor" style={{ color: "var(--rojo)" }}>{r.ausencias}</div><div className="nombre">Ausencias</div></div>
          </div>
        </div>
      </>)}

      <table className="tabla">
        <thead><tr><th>Fecha</th><th>Estado</th><th>Hora de marca</th><th>Método</th><th>Observación</th></tr></thead>
        <tbody>
          {datos.detalle.map((d, i) => (
            <tr key={i}>
              <td>{new Date(d.fecha).toLocaleDateString("es-CO", { weekday: "short", day: "2-digit", month: "short" })}</td>
              <td><span className={`insignia ${d.estado}`}>{d.estado}</span></td>
              <td>{d.hora || "—"}</td>
              <td><span className={`insignia ${d.metodo}`}>{d.metodo}</span></td>
              <td>{d.observacion || "—"}</td>
            </tr>
          ))}
          {!datos.detalle.length && <tr><td colSpan={5}><div className="vacio">Aún no tienes registros de asistencia.</div></td></tr>}
        </tbody>
      </table>
    </>
  );
}
