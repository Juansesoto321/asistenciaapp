/**
 * Socket.IO: canal en tiempo real para la vista de supervision del
 * instructor (CU-14). Cada sesion de clase es una "sala".
 */
let io = null;

function inicializar(servidorHttp) {
  const { Server } = require("socket.io");
  io = new Server(servidorHttp, { cors: { origin: "*" } });
  io.on("connection", (socket) => {
    socket.on("unirse_sesion", (idSesion) => socket.join(`sesion_${idSesion}`));
    socket.on("salir_sesion", (idSesion) => socket.leave(`sesion_${idSesion}`));
  });
  return io;
}

function emitirASesion(idSesion, evento, datos) {
  if (io) io.to(`sesion_${idSesion}`).emit(evento, datos);
}

module.exports = { inicializar, emitirASesion };
