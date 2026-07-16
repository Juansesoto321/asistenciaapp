# AsistenciaApp 🫆

**Sistema de Control de Asistencia con Lector de Huella Digital**
SENA · Análisis y Desarrollo de Software · Bogotá D.C. · 2026

Plataforma web que automatiza el registro de asistencia de aprendices mediante lectores biométricos de huella (ZKTeco), con supervisión en tiempo real, gestión de justificaciones con ventana de 72 horas y cumplimiento de la Ley 1581/2012 (cifrado AES-256 de plantillas biométricas, consentimiento informado y derecho al borrado).

---

## Arquitectura

```
┌─────────────┐  PUSH (HTTP)   ┌──────────────┐  Socket.IO   ┌──────────────┐
│ Lector K50  │ ─────────────► │   Backend    │ ───────────► │  Frontend    │
│ (simulado)  │  marcaciones   │ Node/Express │  tiempo real │  React+Vite  │
└─────────────┘  + heartbeat   └──────┬───────┘              └──────────────┘
                                      │ pg
                               ┌──────▼───────┐
                               │ PostgreSQL 16│
                               └──────────────┘
```

| Componente | Tecnología | Carpeta |
|---|---|---|
| Base de datos | PostgreSQL 16 (19 tablas) | `db/` |
| Backend / API REST | Node.js 20 + Express + Socket.IO + JWT + Nodemailer | `backend/` |
| Frontend | React 18 + Vite + React Router | `frontend/` |
| Simulador del lector | Node.js (CLI, emula protocolo PUSH de ZKTeco) | `simulador-lector/` |

---

## Opción A · Ejecución local (desarrollo y sustentación)

Requisitos: **Node.js 20+** y **PostgreSQL 14+**.

```bash
# 1. Crear la base de datos
psql -U postgres -c "CREATE DATABASE asistenciaapp;"

# 2. Backend
cd backend
cp .env.example .env        # revisar DATABASE_URL si tu contraseña no es "postgres"
npm install
npm run sembrar             # crea el esquema + datos de demostración
npm run dev                 # http://localhost:4000

# 3. Frontend (otra terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173

# 4. Simulador del lector (otra terminal)
cd simulador-lector
node simulador.js           # escribe el documento del aprendiz = poner el dedo
```

## Opción B · Docker (despliegue)

Requisito: Docker con el plugin Compose.

```bash
docker compose up -d --build
docker compose exec backend npm run sembrar   # solo la primera vez
# Aplicación: http://localhost:8080
# Simulador apuntando al despliegue:
node simulador-lector/simulador.js http://localhost:8080
```

Para producción define variables reales en un archivo `.env` junto al compose:
`JWT_SECRETO`, `CLAVE_CIFRADO` (64 hex), `URL_FRONTEND` (dominio público, usado en los
correos) y las credenciales SMTP (`CORREO_HOST`, `CORREO_USUARIO`, `CORREO_CONTRASENA`).
Sin SMTP, los correos se imprimen en la consola del backend (útil para la demo).

## Opción C · Nube gratuita (Render / Railway)

1. Sube el repositorio a GitHub.
2. Crea un PostgreSQL gestionado y copia su `DATABASE_URL`.
3. Despliega `backend/` como Web Service (comando `npm start`) con las variables del `.env.example`.
4. Despliega `frontend/` como Static Site (build `npm run build`, carpeta `dist`) y configura el rewrite `/api/*` y `/socket.io/*` hacia la URL del backend.

---

## Cuentas de demostración

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | admin@sena.edu.co | Admin123* |
| Instructor | cristian.buitrago@sena.edu.co | Instructor123* |
| Aprendiz | julieth.pena@soy.sena.edu.co | Aprendiz123* |
| Aprendiz | julian.becerra@soy.sena.edu.co | Aprendiz123* |
| Aprendiz | juan.soto@soy.sena.edu.co | Aprendiz123* |
| Aprendiz | santiago.bermudez@soy.sena.edu.co | Aprendiz123* |
| Aprendiz | yordan.mendez@soy.sena.edu.co | Aprendiz123* |

**Lector sembrado:** serial `LECTOR-001`, clave API `clave-simulador-demo`, ambiente 201, ficha 3311983.

## Guion de demostración (5 minutos)

1. **Admin** → Fichas → ficha 3311983 → *Enrolar huella* de un aprendiz (consentimiento → 2 capturas → plantilla cifrada AES-256).
2. **Instructor** → Sesiones de hoy → *Iniciar sesión de hoy* → queda en la vista de supervisión en vivo.
3. En el **simulador**, escribe el documento del aprendiz (ej. `1027524931`): la fila se actualiza **en tiempo real** con presente/tardanza según los 15 min de tolerancia. Prueba `9999999999` para ver la alerta de huella no reconocida.
4. Registra a otro aprendiz con **✍ Manual** (motivo obligatorio, queda en auditoría).
5. **⏹ Cerrar sesión**: los no marcados quedan ausentes y en la consola del backend aparece el **correo simulado** con el enlace de justificación (72 h).
6. Abre ese enlace `/justificar/<token>` en el navegador → envía la excusa con adjunto.
7. **Instructor** → Justificaciones → *Aprobar* → la ausencia pasa a **justificada**.
8. **Aprendiz** (julieth.pena) → *Mi asistencia*: anillo de porcentaje y alerta si baja del 80 %.

## Del simulador al lector real

El backend expone el contrato que consume el dispositivo (`/api/lector/heartbeat` y `/api/lector/marcacion`, autenticado con `x-serial` + `x-clave-api`). El simulador implementa ese contrato por consola. Cuando se adquiera el hardware:

- **Aula:** ZKTeco **K50** (o MA300 para exteriores) conectado por TCP/IP con protocolo PUSH/ADMS → se implementa un pequeño adaptador que traduce los eventos PUSH a `POST /api/lector/marcacion`. El backend **no cambia**.
- **Enrolamiento:** enrolador USB ZKTeco **ZK9500** con su SDK → reemplaza la función `capturar()` del asistente de enrolamiento del frontend.

## Seguridad y Ley 1581/2012

- La huella **nunca** se guarda: solo una plantilla matemática cifrada con **AES-256-GCM** (clave fuera de la BD, en variable de entorno).
- **Consentimiento informado** versionado y auditable antes del enrolamiento; sin él, el aprendiz usa registro manual.
- **Derecho al borrado** (CU-11): elimina la plantilla de forma permanente conservando el historial académico.
- Contraseñas con **bcrypt**, sesiones **JWT** (8 h), bloqueo tras **5 intentos** fallidos, y **auditoría** de todas las acciones sensibles.

## Estructura del proyecto

```
asistenciaapp/
├── db/init.sql                  # Esquema completo (19 tablas) + configuración
├── backend/
│   ├── src/index.js             # Servidor + tareas programadas (72h, heartbeats)
│   ├── src/rutas/               # auth, usuarios, academico, biometria, lector,
│   │                            # sesiones, justificaciones, reportes, varios
│   ├── src/servicios/           # cifrado AES-256, correo, tiempo real, auditoría
│   └── src/scripts/sembrar.js   # npm run sembrar
├── frontend/src/paginas/        # 19 vistas (admin, instructor, aprendiz, públicas)
├── simulador-lector/simulador.js
└── docker-compose.yml
```
