import { useEffect, useState } from "react";
import { api } from "../servicios/api";

export default function Configuracion() {
  const [conf, setConf] = useState(null);
  const [mensaje, setMensaje] = useState(null);

  useEffect(() => { api("/configuracion").then(setConf); }, []);

  async function guardar() {
    try {
      const r = await api("/configuracion", { method: "PUT", body: conf });
      setMensaje({ tipo: "exito", texto: r.mensaje });
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
    </>
  );
}
