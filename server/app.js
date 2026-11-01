import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import api from './api.js';
import { readFileSync } from 'node:fs';

const app = express();
const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

app.disable('x-powered-by');
// Derrière un hébergeur (Render, Railway, Nginx…), req.ip vaudrait l'IP du proxy pour tout le monde :
// le limiteur bloquerait alors tous les visiteurs ensemble. TRUST_PROXY=1 lit la vraie IP.
// Sur Vercel, la confiance au proxy est activée d'office.
const trustProxy = process.env.TRUST_PROXY || (process.env.VERCEL ? '1' : '');
if (trustProxy) app.set('trust proxy', Number(trustProxy) || trustProxy);
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy':
      "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  });
  next();
});
app.use(express.json({ limit: '50kb' }));
// Express 5 laisse req.body vide (undefined) sans corps JSON : on garantit un objet.
app.use((req, res, next) => { req.body ??= {}; next(); });

app.use('/api', api);
app.use('/api', (req, res) => res.status(404).json({ error: 'Route introuvable' }));
// En local, Express sert public/. Sur Vercel, ce dossier est servi directement par le CDN (express.static y est ignoré).
app.use(express.static(publicDir, {
  extensions: ['html'],
  // Les pages HTML sont toujours revalidées ; CSS/JS/images peuvent être mis en cache 1 jour.
  setHeaders: (res, file) => res.set('Cache-Control', file.endsWith('.html') ? 'no-cache' : 'public, max-age=86400'),
}));
// Page 404 lue une fois ; repli minimal si le fichier n'est pas embarqué (cas de Vercel).
let notFoundHtml = '<!doctype html><meta charset="utf-8"><title>Page introuvable</title><p style="font-family:sans-serif;text-align:center;margin-top:20vh">Page introuvable. <a href="/">Retour au portfolio</a></p>';
try { notFoundHtml = readFileSync(path.join(publicDir, '404.html'), 'utf8'); } catch {}
app.use((req, res) => res.status(404).type('html').send(notFoundHtml));

app.use((err, req, res, next) => {
  if (err.status !== 400) console.error(err);
  res.status(err.status || 500).json({ error: err.status === 400 ? 'Requête invalide' : 'Erreur serveur' });
});

export default app;
