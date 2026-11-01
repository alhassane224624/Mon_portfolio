// Démarrage local (npm start / npm run dev) et hébergeurs classiques.
// Sur Vercel, c'est index.js à la racine qui exporte l'application, sans app.listen.
import app from './app.js';
import { ready, dbUrl } from './db.js';
import { verifyMailer } from './mailer.js';

const PORT = Number(process.env.PORT) || 3000;

if (!process.env.ADMIN_PASSWORD) {
  console.warn('⚠  ADMIN_PASSWORD non défini dans .env : l’espace admin est désactivé.');
}

ready()
  .then(() => console.log(`✔ Base de données prête (${dbUrl.startsWith('file:') ? 'fichier local' : 'Turso'})`))
  .catch((err) => console.error(`✖ Base de données inaccessible : ${err.message}`));

app.listen(PORT, process.env.IP, (err) => {
  // Express 5 passe l'erreur au callback (ex. port déjà utilisé) au lieu de planter.
  if (err) {
    console.error(`✖ Impossible de démarrer sur le port ${PORT} : ${err.code === 'EADDRINUSE' ? 'port déjà utilisé, un autre serveur tourne sans doute déjà' : err.message}`);
    process.exit(1);
  }
  console.log(`✔ Portfolio en ligne sur http://localhost:${PORT}`);
  verifyMailer();
});