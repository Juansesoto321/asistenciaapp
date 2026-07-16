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
  });
}

async function enviarCorreo({ para, asunto, html }) {
  if (!transportador) {
    console.log("\n=== CORREO SIMULADO ===");
    console.log("Para:   ", para);
    console.log("Asunto: ", asunto);
    console.log(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    console.log("=======================\n");
    return { simulado: true };
  }
  return transportador.sendMail({
    from: process.env.CORREO_REMITENTE,
    to: para,
    subject: asunto,
    html,
  });
}

module.exports = { enviarCorreo };
