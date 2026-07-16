import { Routes, Route, Navigate } from "react-router-dom";
import { obtenerSesion } from "./servicios/api";
import Diseno from "./componentes/Diseno.jsx";
import IniciarSesion from "./paginas/IniciarSesion.jsx";
import Registrarse from "./paginas/Registrarse.jsx";
import Restablecer from "./paginas/Restablecer.jsx";
import JustificarPublico from "./paginas/JustificarPublico.jsx";
import Panel from "./paginas/Panel.jsx";
import Usuarios from "./paginas/Usuarios.jsx";
import Fichas from "./paginas/Fichas.jsx";
import DetalleFicha from "./paginas/DetalleFicha.jsx";
import Ambientes from "./paginas/Ambientes.jsx";
import Horarios from "./paginas/Horarios.jsx";
import Sesiones from "./paginas/Sesiones.jsx";
import SesionEnVivo from "./paginas/SesionEnVivo.jsx";
import Justificaciones from "./paginas/Justificaciones.jsx";
import MiAsistencia from "./paginas/MiAsistencia.jsx";
import Reportes from "./paginas/Reportes.jsx";
import Configuracion from "./paginas/Configuracion.jsx";
import Soporte from "./paginas/Soporte.jsx";
import Notificaciones from "./paginas/Notificaciones.jsx";
import Perfil from "./paginas/Perfil.jsx";

function Protegida({ children, roles }) {
  const sesion = obtenerSesion();
  if (!sesion) return <Navigate to="/" replace />;
  if (roles && !roles.includes(sesion.usuario.rol)) return <Navigate to="/panel" replace />;
  return <Diseno>{children}</Diseno>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<IniciarSesion />} />
      <Route path="/registrarse" element={<Registrarse />} />
      <Route path="/restablecer/:token" element={<Restablecer />} />
      <Route path="/justificar/:token" element={<JustificarPublico />} />

      <Route path="/panel" element={<Protegida><Panel /></Protegida>} />
      <Route path="/usuarios" element={<Protegida roles={["administrador"]}><Usuarios /></Protegida>} />
      <Route path="/fichas" element={<Protegida roles={["administrador","instructor"]}><Fichas /></Protegida>} />
      <Route path="/fichas/:id" element={<Protegida roles={["administrador","instructor"]}><DetalleFicha /></Protegida>} />
      <Route path="/ambientes" element={<Protegida roles={["administrador"]}><Ambientes /></Protegida>} />
      <Route path="/horarios" element={<Protegida roles={["administrador","instructor"]}><Horarios /></Protegida>} />
      <Route path="/sesiones" element={<Protegida roles={["instructor","administrador"]}><Sesiones /></Protegida>} />
      <Route path="/sesiones/:id" element={<Protegida roles={["instructor","administrador"]}><SesionEnVivo /></Protegida>} />
      <Route path="/justificaciones" element={<Protegida roles={["instructor","administrador"]}><Justificaciones /></Protegida>} />
      <Route path="/mi-asistencia" element={<Protegida roles={["aprendiz"]}><MiAsistencia /></Protegida>} />
      <Route path="/reportes" element={<Protegida roles={["administrador","instructor"]}><Reportes /></Protegida>} />
      <Route path="/configuracion" element={<Protegida roles={["administrador"]}><Configuracion /></Protegida>} />
      <Route path="/soporte" element={<Protegida><Soporte /></Protegida>} />
      <Route path="/notificaciones" element={<Protegida><Notificaciones /></Protegida>} />
      <Route path="/perfil" element={<Protegida><Perfil /></Protegida>} />
      <Route path="*" element={<Navigate to="/panel" replace />} />
    </Routes>
  );
}
