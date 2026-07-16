/**
 * Siembra la base de datos: esquema + datos de demostracion.
 * Uso: npm run sembrar
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const pool = require("../config/db");

async function main() {
  console.log("Creando esquema...");
  const sql = fs.readFileSync(path.join(__dirname, "../../../db/init.sql"), "utf8");
  await pool.query(sql);

  const hayUsuarios = await pool.query("SELECT 1 FROM usuario LIMIT 1");
  if (hayUsuarios.rows.length) {
    console.log("Ya existen datos. No se vuelve a sembrar.");
    return pool.end();
  }

  console.log("Sembrando datos de demostración...");
  const hAdmin = await bcrypt.hash("Admin123*", 10);
  const hInstr = await bcrypt.hash("Instructor123*", 10);
  const hAprendiz = await bcrypt.hash("Aprendiz123*", 10);

  const admin = await pool.query(
    `INSERT INTO usuario (nombres, apellidos, documento, correo, contrasena_hash, rol)
     VALUES ('Administrador','Sistema','1000000001','admin@sena.edu.co',$1,'administrador') RETURNING id_usuario`,
    [hAdmin]
  );
  const instructor = await pool.query(
    `INSERT INTO usuario (nombres, apellidos, documento, correo, contrasena_hash, rol)
     VALUES ('Cristian','Buitrago','1000000002','cristian.buitrago@sena.edu.co',$1,'instructor') RETURNING id_usuario`,
    [hInstr]
  );

  const aprendices = [
    ["Julieth Camila", "Peña Mahecha", "1027524931", "julieth.pena@soy.sena.edu.co"],
    ["Julian Felipe", "Becerra Villalobo", "1027524932", "julian.becerra@soy.sena.edu.co"],
    ["Juan Sebastian", "Soto Moreno", "1027524933", "juan.soto@soy.sena.edu.co"],
    ["Santiago", "Bermudez Torres", "1027524934", "santiago.bermudez@soy.sena.edu.co"],
    ["Yordan Hernando", "Mendez Beltran", "1027524935", "yordan.mendez@soy.sena.edu.co"],
  ];
  const idsAprendices = [];
  for (const [n, a, d, c] of aprendices) {
    const r = await pool.query(
      `INSERT INTO usuario (nombres, apellidos, documento, correo, contrasena_hash, rol)
       VALUES ($1,$2,$3,$4,$5,'aprendiz') RETURNING id_usuario`,
      [n, a, d, c, hAprendiz]
    );
    idsAprendices.push(r.rows[0].id_usuario);
  }

  const periodo = await pool.query(
    `INSERT INTO periodo (nombre, fecha_inicio, fecha_fin)
     VALUES ('2026-2','2026-07-01','2026-12-20') RETURNING id_periodo`
  );
  const ficha = await pool.query(
    `INSERT INTO ficha (numero_ficha, programa, jornada, fecha_inicio, fecha_fin, id_periodo, id_instructor)
     VALUES ('3311983','Análisis y Desarrollo de Software','mañana','2026-07-01','2026-12-20',$1,$2)
     RETURNING id_ficha`,
    [periodo.rows[0].id_periodo, instructor.rows[0].id_usuario]
  );
  for (const id of idsAprendices) {
    await pool.query("INSERT INTO matricula (id_aprendiz, id_ficha) VALUES ($1,$2)", [id, ficha.rows[0].id_ficha]);
  }

  const ambiente = await pool.query(
    `INSERT INTO ambiente (numero_ambiente, sede_centro, id_periodo)
     VALUES ('201','SENA - CGMLTI Bogotá',$1) RETURNING id_ambiente`,
    [periodo.rows[0].id_periodo]
  );
  await pool.query(
    `INSERT INTO dispositivo (serial, modelo, id_ambiente, clave_api, estado)
     VALUES ('LECTOR-001','ZKTeco K50 (simulado)',$1,'clave-simulador-demo','no_verificado')`,
    [ambiente.rows[0].id_ambiente]
  );

  // Horario todos los dias (permite demostrar la app cualquier dia de la semana)
  for (let dia = 0; dia <= 6; dia++) {
    await pool.query(
      `INSERT INTO horario (id_ficha, id_ambiente, id_instructor, id_periodo, dia_semana, hora_inicio, hora_fin)
       VALUES ($1,$2,$3,$4,$5,'06:00','23:59')`,
      [ficha.rows[0].id_ficha, ambiente.rows[0].id_ambiente, instructor.rows[0].id_usuario, periodo.rows[0].id_periodo, dia]
    );
  }

  console.log(`
Datos sembrados correctamente.

CUENTAS DE DEMOSTRACIÓN
  Administrador:  admin@sena.edu.co               / Admin123*
  Instructor:     cristian.buitrago@sena.edu.co   / Instructor123*
  Aprendices:     julieth.pena@soy.sena.edu.co    / Aprendiz123*
                  julian.becerra@soy.sena.edu.co  / Aprendiz123*
                  juan.soto@soy.sena.edu.co       / Aprendiz123*
                  santiago.bermudez@soy.sena.edu.co / Aprendiz123*
                  yordan.mendez@soy.sena.edu.co   / Aprendiz123*

LECTOR SIMULADO
  Serial: LECTOR-001 · Clave API: clave-simulador-demo · Ambiente: 201
`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
