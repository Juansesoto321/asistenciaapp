/** Cliente HTTP con el token JWT de la sesion. */
const guardarSesion = (datos) => localStorage.setItem("sesion", JSON.stringify(datos));
const obtenerSesion = () => JSON.parse(localStorage.getItem("sesion") || "null");
const cerrarSesion = () => localStorage.removeItem("sesion");

async function api(ruta, opciones = {}) {
  const sesion = obtenerSesion();
  const r = await fetch(`/api${ruta}`, {
    ...opciones,
    headers: {
      "Content-Type": "application/json",
      ...(sesion?.token ? { Authorization: `Bearer ${sesion.token}` } : {}),
      ...opciones.headers,
    },
    body: opciones.body ? JSON.stringify(opciones.body) : undefined,
  });
  const datos = await r.json().catch(() => ({}));
  if (r.status === 401 && sesion) { cerrarSesion(); window.location.href = "/"; }
  if (!r.ok) throw new Error(datos.mensaje || "Error de servidor");
  return datos;
}

export { api, guardarSesion, obtenerSesion, cerrarSesion };
