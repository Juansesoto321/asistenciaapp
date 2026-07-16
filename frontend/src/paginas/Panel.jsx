import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, obtenerSesion } from "../servicios/api";

export default function Panel() {
  const sesion = obtenerSesion();
  const rol = sesion.usuario.rol;
  const [datos, setDatos] = useState(null);
  const [historial, setHistorial] = useState(null);

  useEffect(() => {
    if (rol === "aprendiz") api("/reportes/mi-historial").then(setHistorial).catch(() => {});
    else api("/reportes/estadisticas").then(setDatos).catch(() => {});
  }, []);

  return (
    <>
      <div className="cabecera-pagina">
        <div>
          <h1>Hola, {sesion.usuario.nombres} 👋</h1>
          <p>{new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        {rol !== "aprendiz" && <Link to="/sesiones" className="boton">🕒 Ir a sesiones de hoy</Link>}
      </div>

      {rol !== "aprendiz" && datos && (
        <div className="fila-tarjetas">
          <div className="tarjeta-metrica"><div className="valor">{datos.fichas_activas}</div><div className="nombre">Fichas activas</div></div>
          <div className="tarjeta-metrica"><div className="valor">{datos.aprendices_activos}</div><div className="nombre">Aprendices activos</div></div>
          <div className="tarjeta-metrica"><div className="valor">{datos.sesiones_hoy}</div><div className="nombre">Sesiones hoy</div></div>
          <div className="tarjeta-metrica"><div className="valor">{datos.promedio_asistencia}%</div><div className="nombre">Asistencia promedio</div></div>
        </div>
      )}

      {rol === "aprendiz" && historial?.resumen && (
        <div className="fila-tarjetas">
          <div className="tarjeta-metrica">
            <div className="valor" style={{ color: historial.resumen.porcentaje < historial.resumen.minimo ? "var(--rojo)" : "var(--verde)" }}>
              {historial.resumen.porcentaje}%
            </div>
            <div className="nombre">Mi asistencia</div>
          </div>
          <div className="tarjeta-metrica"><div className="valor">{historial.resumen.presentes}</div><div className="nombre">Presentes</div></div>
          <div className="tarjeta-metrica"><div className="valor">{historial.resumen.tardanzas}</div><div className="nombre">Tardanzas</div></div>
          <div className="tarjeta-metrica"><div className="valor">{historial.resumen.ausencias}</div><div className="nombre">Ausencias</div></div>
        </div>
      )}

      <div className="tarjeta">
        <h3>Accesos rápidos</h3>
        <p style={{ color: "var(--tinta-suave)", margin: "8px 0 14px" }}>Lo más usado según tu rol.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {rol === "administrador" && (<>
            <Link className="boton suave" to="/usuarios">👥 Gestionar usuarios</Link>
            <Link className="boton suave" to="/fichas">📚 Fichas y matrículas</Link>
            <Link className="boton suave" to="/ambientes">🏫 Lectores biométricos</Link>
            <Link className="boton suave" to="/reportes">🔎 Búsqueda avanzada</Link>
          </>)}
          {rol === "instructor" && (<>
            <Link className="boton suave" to="/sesiones">🕒 Iniciar clase de hoy</Link>
            <Link className="boton suave" to="/justificaciones">📄 Revisar justificaciones</Link>
            <Link className="boton suave" to="/reportes">🔎 Reportes de mis fichas</Link>
          </>)}
          {rol === "aprendiz" && (<>
            <Link className="boton suave" to="/mi-asistencia">🗒️ Ver mi historial completo</Link>
            <Link className="boton suave" to="/perfil">👤 Actualizar mis datos</Link>
          </>)}
        </div>
      </div>
    </>
  );
}
