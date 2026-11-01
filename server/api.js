import { Router } from 'express';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { all, get, run, ready, toProject } from './db.js';
import { checkPassword, createToken, requireAdmin, rateLimit } from './auth.js';
import { notifyContact } from './mailer.js';

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const profilePath = path.join(serverDir, 'data', 'profile.json');
const publicDir = path.join(serverDir, '..', 'public');
const api = Router();

// Les routes qui touchent la base attendent que les tables soient prêtes (création + projets de départ).
const withDb = (req, res, next) => ready().then(() => next(), next);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CATEGORIES = ['fullstack', 'frontend', 'backend', 'mobile'];
const SUBJECTS = [
  'Offre de stage', "Offre d'emploi (CDI / CDD)", 'Mission freelance', "Création d'un site web",
  'Application web sur mesure', 'Plateforme e-commerce', "Maintenance / amélioration d'un site existant",
  'Collaboration sur un projet', 'Autre demande',
];
const isUrl = (v) => !v || /^https?:\/\/\S+$/i.test(v);
const isImage = (v) => !v || /^(https?:\/\/\S+|\/[\w\-./]+)\.(png|jpe?g|webp|gif|svg|avif)(\?\S*)?$/i.test(v);
// Un fichier local (« /cv/mon-cv.pdf ») n'est exposé que s'il existe vraiment dans public/.
const localFileExists = (url) => {
  const file = path.join(publicDir, path.normalize(url));
  return file.startsWith(publicDir) && existsSync(file);
};

// Profil lu une fois au démarrage (le fichier ne change qu'à un nouveau déploiement).
// Sur Vercel, public/ est servi par le CDN et absent du serveur : on ne vérifie le CV que s'il est visible ici.
let profileCache = null;
function getProfile() {
  if (!profileCache) {
    const data = JSON.parse(readFileSync(profilePath, 'utf8'));
    if (data.cv && !/^https?:\/\//i.test(data.cv) && existsSync(publicDir) && !localFileExists(data.cv)) data.cv = null;
    profileCache = data;
  }
  return profileCache;
}
const clean = (v, max) => String(v ?? '').trim().slice(0, max);

/* ---------- Public ---------- */

api.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

api.get('/profile', (req, res) => {
  try {
    res.json(getProfile());
  } catch (err) {
    console.error('✖ profile.json illisible :', err.message);
    res.status(500).json({ error: 'Profil indisponible' });
  }
});

api.get('/projects', withDb, async (req, res) => {
  const { category } = req.query;
  const rows = category && CATEGORIES.includes(category)
    ? await all('SELECT * FROM projects WHERE category = ? ORDER BY featured DESC, id DESC', [category])
    : await all('SELECT * FROM projects ORDER BY featured DESC, id DESC');
  res.json(rows.map(toProject));
});

api.post('/contact', rateLimit({ windowMs: 15 * 60 * 1000, max: 5 }), withDb, async (req, res) => {
  const name = clean(req.body.name, 100);
  const email = clean(req.body.email, 150);
  const subject = clean(req.body.subject, 150);
  const body = clean(req.body.message, 5000);

  // Champ piège anti-spam : invisible pour les humains, rempli par les robots.
  if (req.body.website) return res.status(201).json({ ok: true });

  const errors = {};
  if (name.length < 2) errors.name = 'Nom trop court.';
  if (!EMAIL_RE.test(email)) errors.email = 'Adresse e-mail invalide.';
  if (!SUBJECTS.includes(subject)) errors.subject = 'Veuillez choisir un sujet dans la liste.';
  if (body.length < 10) errors.message = 'Message trop court (10 caractères minimum).';
  if (Object.keys(errors).length) return res.status(422).json({ error: 'Formulaire invalide', errors });

  // Le message est enregistré avant l'envoi : aucune demande client n'est perdue
  // même si le fournisseur SMTP est momentanément indisponible.
  const result = await run(
    'INSERT INTO messages (name, email, subject, body) VALUES (?, ?, ?, ?)',
    [name, email, subject, body],
  );

  try {
    await notifyContact({ name, email, subject, body });
    return res.status(201).json({
      ok: true,
      emailSent: true,
      message: 'Message enregistré et notification e-mail envoyée.',
      id: Number(result.lastInsertRowid),
    });
  } catch (err) {
    console.error('✖ Message enregistré, mais notification e-mail échouée :', err.message);
    return res.status(201).json({
      ok: true,
      emailSent: false,
      message: 'Votre message est enregistré sur le site, mais la notification e-mail a échoué. Vous pouvez aussi me contacter directement.',
      id: Number(result.lastInsertRowid),
    });
  }
});

/* ---------- Authentification ---------- */

api.post('/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }), (req, res) => {
  if (!checkPassword(req.body.password)) return res.status(401).json({ error: 'Mot de passe incorrect' });
  res.json({ token: createToken() });
});

/* ---------- Administration (protégé) ---------- */

api.get('/admin/stats', requireAdmin, withDb, async (req, res) => {
  const { projects, messages, unread } = await get(`SELECT
    (SELECT COUNT(*) FROM projects) AS projects,
    (SELECT COUNT(*) FROM messages) AS messages,
    (SELECT COUNT(*) FROM messages WHERE is_read = 0) AS unread`);
  res.json({ projects: Number(projects), messages: Number(messages), unread: Number(unread) });
});

api.get('/admin/messages', requireAdmin, withDb, async (req, res) => {
  const rows = await all('SELECT * FROM messages ORDER BY id DESC');
  res.json(rows.map((m) => ({ ...m, is_read: !!m.is_read })));
});

api.patch('/admin/messages/:id', requireAdmin, withDb, async (req, res) => {
  const r = await run('UPDATE messages SET is_read = ? WHERE id = ?', [req.body.is_read ? 1 : 0, req.params.id]);
  if (!r.changes) return res.status(404).json({ error: 'Message introuvable' });
  res.json({ ok: true });
});

api.delete('/admin/messages/:id', requireAdmin, withDb, async (req, res) => {
  const r = await run('DELETE FROM messages WHERE id = ?', [req.params.id]);
  if (!r.changes) return res.status(404).json({ error: 'Message introuvable' });
  res.status(204).end();
});

function validateProject(b) {
  const p = {
    title: clean(b.title, 120),
    description: clean(b.description, 1000),
    category: clean(b.category, 20),
    tags: (Array.isArray(b.tags) ? b.tags : String(b.tags ?? '').split(','))
      .map((t) => clean(t, 30)).filter(Boolean).slice(0, 10),
    repo_url: clean(b.repo_url, 300) || null,
    demo_url: clean(b.demo_url, 300) || null,
    image_url: clean(b.image_url, 300) || null,
    featured: b.featured ? 1 : 0,
  };
  const errors = {};
  if (p.title.length < 2) errors.title = 'Titre requis.';
  if (p.description.length < 10) errors.description = 'Description trop courte.';
  if (!CATEGORIES.includes(p.category)) errors.category = 'Catégorie invalide.';
  if (!isUrl(p.repo_url)) errors.repo_url = 'URL invalide.';
  if (!isUrl(p.demo_url)) errors.demo_url = 'URL invalide.';
  if (!isImage(p.image_url)) errors.image_url = 'Lien d’image invalide (https://… ou /img/… en .png, .jpg, .webp…).';
  return { p, errors };
}

api.post('/admin/projects', requireAdmin, withDb, async (req, res) => {
  const { p, errors } = validateProject(req.body);
  if (Object.keys(errors).length) return res.status(422).json({ error: 'Projet invalide', errors });
  const r = await run(
    'INSERT INTO projects (title, description, category, tags, repo_url, demo_url, image_url, featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [p.title, p.description, p.category, JSON.stringify(p.tags), p.repo_url, p.demo_url, p.image_url, p.featured],
  );
  res.status(201).json(toProject(await get('SELECT * FROM projects WHERE id = ?', [r.lastInsertRowid])));
});

api.put('/admin/projects/:id', requireAdmin, withDb, async (req, res) => {
  const { p, errors } = validateProject(req.body);
  if (Object.keys(errors).length) return res.status(422).json({ error: 'Projet invalide', errors });
  const r = await run(
    'UPDATE projects SET title=?, description=?, category=?, tags=?, repo_url=?, demo_url=?, image_url=?, featured=? WHERE id=?',
    [p.title, p.description, p.category, JSON.stringify(p.tags), p.repo_url, p.demo_url, p.image_url, p.featured, req.params.id],
  );
  if (!r.changes) return res.status(404).json({ error: 'Projet introuvable' });
  res.json(toProject(await get('SELECT * FROM projects WHERE id = ?', [req.params.id])));
});

api.delete('/admin/projects/:id', requireAdmin, withDb, async (req, res) => {
  const r = await run('DELETE FROM projects WHERE id = ?', [req.params.id]);
  if (!r.changes) return res.status(404).json({ error: 'Projet introuvable' });
  res.status(204).end();
});

export default api;
