/**
 * AsistenciaApp · Servidor principal
 * Sistema de Control de Asistencia con Lector de Huella Digital · SENA 2026
 */
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const pool = require("./config/db");
const tiempoReal = require("./servicios/tiempoReal");

const app = express();
const servidor = http.createServer(app);
tiempoReal.inicializar(servidor);

app.use(cors());
app.use(express.json({ limit: "10mb" })); // adjuntos de justificacion en base64

// Salud del servicio (publica)
app.get("/api/salud", (_req, res) => res.json({ ok: true, servicio: "AsistenciaApp", fecha: new Date() }));

// Rutas con prefijo propio (el orden importa: las publicas primero)
app.use("/api/auth", require("./rutas/auth"));
app.use("/api/lector", require("./rutas/lector"));            // dispositivo (clave API)
app.use("/api/justificaciones", require("./rutas/justificaciones")); // incluye rutas publicas por token
app.use("/api/usuarios", require("./rutas/usuarios"));
app.use("/api/biometria", require("./rutas/biometria"));
app.use("/api/sesiones", require("./rutas/sesiones"));
app.use("/api/reportes", require("./rutas/reportes"));
// Routers montados en /api (requieren token): SIEMPRE al final
app.use("/api", require("./rutas/academico"));
app.use("/api", require("./rutas/varios"));

// ---- Tareas programadas ----
// 1. Vencer justificaciones fuera de la ventana de 72 horas
// 2. Marcar lectores fuera de linea si no envian heartbeat en 3 minutos (CU-09)
setInterval(async () => {
  try {
    await pool.query(
      "UPDATE justificacion SET estado = 'vencida' WHERE estado = 'pendiente' AND expira_en < NOW()"
    );
    await pool.query(
      `UPDATE dispositivo SET estado = 'fuera_de_linea'
       WHERE estado = 'en_linea' AND ultimo_heartbeat < NOW() - INTERVAL '3 minutes'`
    );
  } catch (e) {
    console.error("Error en tareas programadas:", e.message);
  }
}, 60_000);

const PUERTO = process.env.PUERTO || 4000;
servidor.listen(PUERTO, () => {
  console.log(`\nAsistenciaApp backend escuchando en http://localhost:${PUERTO}`);
  console.log("Socket.IO activo para supervisión en tiempo real\n");
});
