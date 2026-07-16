import { NavLink, useNavigate } from "react-router-dom";
import { obtenerSesion, cerrarSesion } from "../servicios/api";

const MENUS = {
  administrador: [
    ["/panel", "📊", "Panel"],
    ["/usuarios", "👥", "Usuarios"],
    ["/fichas", "📚", "Fichas"],
    ["/ambientes", "🏫", "Ambientes y lectores"],
    ["/horarios", "🗓️", "Horarios"],
    ["/sesiones", "🕒", "Sesiones de clase"],
    ["/justificaciones", "📄", "Justificaciones"],
    ["/reportes", "🔎", "Reportes"],
    ["/configuracion", "⚙️", "Configuración"],
    ["/notificaciones", "🔔", "Notificaciones"],
    ["/soporte", "🛟", "Soporte"],
  ],
  instructor: [
    ["/panel", "📊", "Panel"],
    ["/sesiones", "🕒", "Mis clases de hoy"],
    ["/fichas", "📚", "Mis fichas"],
    ["/horarios", "🗓️", "Mis horarios"],
    ["/justificaciones", "📄", "Justificaciones"],
    ["/reportes", "🔎", "Reportes"],
    ["/notificaciones", "🔔", "Notificaciones"],
    ["/soporte", "🛟", "Soporte"],
  ],
  aprendiz: [
    ["/panel", "📊", "Panel"],
    ["/mi-asistencia", "🗒️", "Mi asistencia"],
    ["/notificaciones", "🔔", "Notificaciones"],
    ["/perfil", "👤", "Mi perfil"],
    ["/soporte", "🛟", "Soporte"],
  ],
};

export default function Diseno({ children }) {
  const sesion = obtenerSesion();
  const navegar = useNavigate();
  const menu = MENUS[sesion.usuario.rol] || [];
  return (
    <div className="aplicacion">
      <aside className="barra-lateral">
        <div className="marca">
          <div className="icono">🫆</div>
          <div>
            AsistenciaApp
            <small>SENA · Control de asistencia</small>
          </div>
        </div>
        <nav>
          {menu.map(([ruta, icono, nombre]) => (
            <NavLink key={ruta} to={ruta} className={({ isActive }) => (isActive ? "activo" : "")}>
              <span>{icono}</span> {nombre}
            </NavLink>
          ))}
        </nav>
        <div className="pie-usuario">
          <b>{sesion.usuario.nombres} {sesion.usuario.apellidos}</b>
          <span style={{ textTransform: "capitalize" }}>{sesion.usuario.rol}</span>
          <div>
            <button onClick={() => { cerrarSesion(); navegar("/"); }}>Cerrar sesión →</button>
          </div>
        </div>
      </aside>
      <main className="contenido">{children}</main>
    </div>
  );
}
