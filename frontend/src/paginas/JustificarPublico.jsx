import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../servicios/api";

export default function JustificarPublico() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [descripcion, setDescripcion] = useState("");
  const [archivo, setArchivo] = useState(null);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    api(`/justificaciones/token/${token}`).then(setInfo).catch((e) => setError(e.message));
  }, [token]);

  function seleccionarArchivo(e) {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return setError("El archivo no puede superar 5 MB");
    const lector = new FileReader();
    lector.onload = () => setArchivo({ nombre: f.name, datos: lector.result });
    lector.readAsDataURL(f);
  }

  async function enviar() {
    setError(null);
    try {
      await api(`/justificaciones/token/${token}`, {
        method: "POST",
        body: { descripcion, nombre_archivo: archivo?.nombre, archivo_datos: archivo?.datos },
      });
      setEnviado(true);
    } catch (e) { setError(e.message); }
  }

  return (
    <div className="pantalla-acceso">
      <div className="tarjeta-acceso" style={{ maxWidth: 500 }}>
        <div className="logo-acceso">📄</div>
        <h1>Justificar inasistencia</h1>
        {error && <div className="mensaje error">{error}</div>}

        {enviado ? (
          <div className="mensaje exito">Justificación enviada. Tu instructor la revisará y te llegará una notificación con la decisión.</div>
        ) : info ? (<>
          <p className="subtitulo">
            {info.nombres} {info.apellidos} · Ficha {info.numero_ficha}<br />
            Clase del {new Date(info.fecha).toLocaleDateString("es-CO")}<br />
            ⏳ Este enlace vence el {new Date(info.expira_en).toLocaleString("es-CO")}
          </p>
          {info.estado !== "pendiente" ? (
            <div className="mensaje exito">Esta justificación ya fue enviada y está en estado: {info.estado}.</div>
          ) : (<>
            <label>Describe el motivo de tu inasistencia</label>
            <textarea rows={4} value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
                      placeholder="Ej.: cita médica en la EPS, adjunto la constancia…"
                      style={{ background: "rgba(255,255,255,.09)", borderColor: "rgba(255,255,255,.18)", color: "#fff" }} />
            <label>Soporte / evidencia (opcional, máx. 5 MB)</label>
            <input type="file" onChange={seleccionarArchivo} accept=".pdf,.jpg,.jpeg,.png" />
            {archivo && <p style={{ fontSize: 13, marginTop: 6 }}>📎 {archivo.nombre}</p>}
            <button className="boton ancho" disabled={!descripcion.trim()} onClick={enviar}>Enviar justificación</button>
          </>)}
        </>) : !error && <p className="subtitulo">Validando enlace…</p>}
      </div>
    </div>
  );
}
