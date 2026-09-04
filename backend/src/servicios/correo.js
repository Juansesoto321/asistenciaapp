/**
 * Envio de correos (Nodemailer). Si no hay SMTP configurado en .env,
 * los correos se imprimen en consola: util para desarrollo y sustentacion.
 */
const nodemailer = require("nodemailer");

let transportador = null;
if (process.env.CORREO_HOST) {
  transportador = nodemailer.createTransport({
    host: process.env.CORREO_HOST,
    port: Number(process.env.CORREO_PUERTO || 587),
    secure: false,
    auth: { user: process.env.CORREO_USUARIO, pass: process.env.CORREO_CONTRASENA },
    // Si la red bloquea el puerto SMTP (comun en redes institucionales), que
    // falle rapido en vez de colgar la peticion varios segundos por intento.
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000,
  });
}

function imprimirEnConsola(para, asunto, html) {
  console.log("\n=== CORREO (no se pudo entregar por SMTP; contenido real) ===");
  console.log("Para:   ", para);
  console.log("Asunto: ", asunto);
  console.log(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  console.log("===============================================================\n");
}

async function enviarCorreo({ para, asunto, html }) {
  if (!transportador) {
    imprimirEnConsola(para, asunto, html);
    return { simulado: true };
  }
  // El envio de correo NUNCA debe tumbar la operacion que lo dispara (cerrar
  // sesion, crear usuario, etc.): si el SMTP falla o la red lo bloquea, se
  // registra el error (con el contenido completo, como evidencia) pero la
  // funcion no lanza excepcion.
  try {
    return await transportador.sendMail({
      from: process.env.CORREO_REMITENTE,
      to: para,
      subject: asunto,
      html,
    });
  } catch (e) {
    console.error(`No se pudo enviar el correo a ${para} (${e.message}). Contenido que se intento enviar:`);
    imprimirEnConsola(para, asunto, html);
    return { enviado: false, error: e.message };
  }
}

module.exports = { enviarCorreo };
