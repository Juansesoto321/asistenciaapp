/**
 * Cifrado AES-256-GCM para plantillas biometricas (Ley 1581/2012).
 * La huella nunca se almacena en su forma original: el lector entrega un
 * "template" y aqui se cifra antes de tocar la base de datos.
 */
const crypto = require("crypto");

const CLAVE = Buffer.from(process.env.CLAVE_CIFRADO || "0".repeat(64), "hex");

function cifrar(textoPlano) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", CLAVE, iv);
  const cifrado = Buffer.concat([cipher.update(textoPlano, "utf8"), cipher.final()]);
  return {
    plantilla_cifrada: cifrado.toString("base64"),
    iv: iv.toString("hex"),
    etiqueta_auth: cipher.getAuthTag().toString("hex"),
  };
}

function descifrar({ plantilla_cifrada, iv, etiqueta_auth }) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", CLAVE, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(etiqueta_auth, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(plantilla_cifrada, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * SIMULACION: genera el "template" a partir de la lectura del dedo.
 * El lector real (ZKTeco) entregaria un template propietario via SDK;
 * aqui derivamos un hash determinista para poder hacer matching 1:N.
 */
function generarTemplateSimulado(lecturaHuella) {
  return crypto.createHash("sha256").update(`huella:${lecturaHuella}`).digest("hex");
}

module.exports = { cifrar, descifrar, generarTemplateSimulado };
