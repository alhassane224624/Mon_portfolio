import { createClient } from '@libsql/client';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// En ligne (Vercel) : base Turso, via TURSO_DATABASE_URL + TURSO_AUTH_TOKEN.
// En local : sans ces variables, on garde le fichier SQLite server/data/portfolio.db.
const localFile = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'portfolio.db');
export const dbUrl = process.env.TURSO_DATABASE_URL || `file:${localFile}`;

export const db = createClient({ url: dbUrl, authToken: process.env.TURSO_AUTH_TOKEN });

// Petits utilitaires : lignes renvoyées sous forme d'objets simples.
const toObjects = (rs) => rs.rows.map((r) => Object.fromEntries(rs.columns.map((c, i) => [c, r[i]])));
export const all = async (sql, args = []) => toObjects(await db.execute({ sql, args }));
export const get = async (sql, args = []) => (await all(sql, args))[0];
export const run = async (sql, args = []) => {
  const rs = await db.execute({ sql, args });
  return { changes: rs.rowsAffected, lastInsertRowid: rs.lastInsertRowid != null ? Number(rs.lastInsertRowid) : null };
};

const seedProjects = [
  {
    title: 'MarketLocal — Marketplace multi-vendeurs',
    description: "Marketplace qui rapproche les acheteurs des artisans, producteurs et petites boutiques : boutiques vendeurs, catalogue, panier, paiement Stripe, suivi des commandes, avis clients et statistiques. API Laravel séparée.",
    category: 'fullstack',
    tags: ['Next.js', 'TypeScript', 'Redux Toolkit', 'Laravel', 'Stripe', 'Tailwind'],
    featured: 1,
    repo_url: 'https://github.com/alhassane224624/marketlocal-web',
    demo_url: 'https://marketlocal-web.vercel.app/',
    image_url: '/img/projects/marketlocal.png',
  },
  {
    title: "Gestion intégrée d'un établissement de formation",
    description: "Plateforme complète de gestion scolaire avec 5 espaces (administration, comptable, professeur, stagiaire, parents) : inscriptions, filières, emplois du temps, appel, notes et bulletins, paiements et reçus PDF, annonces et notifications.",
    category: 'fullstack',
    tags: ['Laravel', 'PHP', 'SQL'],
    featured: 1,
    repo_url: 'https://github.com/alhassane224624/GS_ETABLISSEMENT_GS',
    demo_url: 'https://gestionetablissement.42web.io/',
    image_url: '/img/projects/gs-etablissement/admin.jpg',
    gallery: [
      { src: '/img/projects/gs-etablissement/admin.jpg', caption: "Administration — tableau de bord" },
      { src: '/img/projects/gs-etablissement/comptable.jpg', caption: "Espace comptable — paiements et reçus" },
      { src: '/img/projects/gs-etablissement/professeur.jpg', caption: "Espace professeur — appel et saisie des notes" },
      { src: '/img/projects/gs-etablissement/stagiaire.jpg', caption: "Application stagiaire (mobile)" },
      { src: '/img/projects/gs-etablissement/parents.jpg', caption: "Espace parents (mobile)" },
    ],
  },
  {
    title: 'Gestion documentaire des fonctionnaires',
    description: "Application web sécurisée pour numériser les dossiers des fonctionnaires : authentification JWT, upload de fichiers, analyse de PDF et recherche rapide via l'identifiant PPR.",
    category: 'fullstack',
    tags: ['React', 'MongoDB', 'JWT', 'Analyse PDF'],
    featured: 1,
    repo_url: 'https://github.com/alhassane224624/numerique_document',
  },
  {
    title: 'Système de gestion des archives — CMC Nador',
    description: 'Plateforme de centralisation et de classement des documents administratifs, avec recherche optimisée et gestion fine des rôles et permissions. Réalisée en stage.',
    category: 'fullstack',
    tags: ['Laravel', 'MVC', 'MySQL'],
    featured: 1,
    repo_url: 'https://github.com/alhassane224624/Archives-MC-Nador',
  },
  {
    title: 'Plateforme e-commerce automobile',
    description: 'Application moderne de vente de véhicules : catalogue, fiches produits détaillées, gestion des commandes et suivi client.',
    category: 'frontend',
    tags: ['React', 'Redux', 'React Router'],
    featured: 0,
  },
];

async function init() {
  await db.batch([
    `CREATE TABLE IF NOT EXISTS projects (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT    NOT NULL,
      description TEXT    NOT NULL,
      category    TEXT    NOT NULL,
      tags        TEXT    NOT NULL DEFAULT '[]',
      repo_url    TEXT,
      demo_url    TEXT,
      image_url   TEXT,
      gallery     TEXT    NOT NULL DEFAULT '[]',
      featured    INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS messages (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      email      TEXT    NOT NULL,
      subject    TEXT    NOT NULL,
      body       TEXT    NOT NULL,
      is_read    INTEGER NOT NULL DEFAULT 0,
      created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  ], 'write');

  // Migration : colonnes apparues après la création initiale de la base.
  const cols = (await all('PRAGMA table_info(projects)')).map((c) => c.name);
  if (!cols.includes('image_url')) await db.execute('ALTER TABLE projects ADD COLUMN image_url TEXT');
  if (!cols.includes('gallery')) await db.execute("ALTER TABLE projects ADD COLUMN gallery TEXT NOT NULL DEFAULT '[]'");

  // Base vide : on insère les projets de départ.
  const { n } = await get('SELECT COUNT(*) AS n FROM projects');
  if (Number(n) === 0) {
    await db.batch(seedProjects.map((p) => ({
      sql: 'INSERT INTO projects (title, description, category, tags, featured, repo_url, demo_url, image_url, gallery) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [p.title, p.description, p.category, JSON.stringify(p.tags), p.featured, p.repo_url ?? null, p.demo_url ?? null, p.image_url ?? null, JSON.stringify(p.gallery ?? [])],
    })), 'write');
  }
}

// Initialisation unique ; en cas d'échec, la prochaine requête réessaie.
let initPromise = null;
export function ready() {
  initPromise ??= init().catch((err) => { initPromise = null; throw err; });
  return initPromise;
}

export const toProject = (row) => ({ ...row, tags: JSON.parse(row.tags), gallery: JSON.parse(row.gallery || '[]'), featured: !!row.featured });
