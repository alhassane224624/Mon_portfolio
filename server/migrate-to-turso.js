// Copie les projets et messages de la base locale (server/data/portfolio.db) vers Turso.
// Usage : renseigner TURSO_DATABASE_URL et TURSO_AUTH_TOKEN dans .env, puis « npm run db:migrate ».
import { createClient } from '@libsql/client';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import path from 'node:path';

const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env;
if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
  console.error('✖ TURSO_DATABASE_URL et TURSO_AUTH_TOKEN doivent être définis dans .env.');
  process.exit(1);
}
const localFile = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'portfolio.db');
if (!existsSync(localFile)) {
  console.error(`✖ Base locale introuvable : ${localFile}`);
  process.exit(1);
}

// Crée les tables côté Turso (même schéma que l'application), sans projets de départ.
const { db: remote, ready, all: remoteAll } = await import('./db.js');
const local = createClient({ url: `file:${localFile}` });

const rows = async (client, sql) => {
  const rs = await client.execute(sql);
  return rs.rows.map((r) => Object.fromEntries(rs.columns.map((c, i) => [c, r[i]])));
};

await ready();
// ready() insère les projets de départ si la base est vide : on les remplace par ceux de la base locale.
const remoteMessages = await remoteAll('SELECT COUNT(*) AS n FROM messages');
if (Number(remoteMessages[0].n) > 0) {
  console.error('✖ La base Turso contient déjà des messages : migration annulée pour ne rien écraser.');
  process.exit(1);
}

const projects = await rows(local, 'SELECT * FROM projects ORDER BY id');
const messages = await rows(local, 'SELECT * FROM messages ORDER BY id');
const insert = (table, r) => {
  const cols = Object.keys(r);
  return { sql: `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, args: cols.map((c) => r[c]) };
};

await remote.batch([
  'DELETE FROM projects',
  ...projects.map((p) => insert('projects', { gallery: '[]', ...p })),
  ...messages.map((m) => insert('messages', m)),
], 'write');

console.log(`✔ Migration terminée : ${projects.length} projets et ${messages.length} messages copiés vers Turso.`);
