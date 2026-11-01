# Portfolio Full Stack

Portfolio complet de développeur full stack : site vitrine moderne, API REST, base de données et tableau de bord d'administration.

## Stack technique

| Couche | Technologies |
| --- | --- |
| Front-end | HTML5 sémantique, CSS moderne (variables, grid, `color-mix`), JavaScript ES modules (sans framework) |
| Back-end | Node.js 22+, Express 4, API REST JSON |
| Base de données | SQLite via `@libsql/client` : fichier local en développement, [Turso](https://turso.tech) en ligne |
| Sécurité | Jetons signés HMAC, comparaison en temps constant, limitation de débit, CSP et en-têtes de sécurité, validation côté serveur, champ anti-spam, échappement XSS |

## Fonctionnalités

- **Site public** : hero animé (effet machine à écrire), à propos avec statistiques, compétences avec barres animées, projets filtrables chargés depuis l'API, parcours en timeline, formulaire de contact enregistré en base.
- **Thème clair / sombre** mémorisé, design responsive (mobile → desktop), accessibilité (navigation clavier, `aria-*`, `prefers-reduced-motion`).
- **Espace admin** (`/admin`) : connexion par mot de passe, statistiques, lecture / suppression des messages, ajout / modification / suppression de projets.

## Démarrage

```bash
npm install
cp .env.example .env   # puis choisir un mot de passe admin
npm run dev            # http://localhost:3000
```

## Personnalisation

- **Vos informations** (nom, rôle, compétences, parcours, réseaux) : `server/data/profile.json`
- **Photo de profil** : déposer une photo carrée dans `public/img/profile.jpg` (sinon les initiales s'affichent)
- **CV** : déposer le PDF dans `public/cv/` avec le nom indiqué dans `cv` (`profile.json`). Les boutons « Mon CV » n'apparaissent que si le fichier existe.
- **Captures des projets** : déposer les images dans `public/img/projets/` puis renseigner « Image d'aperçu » dans l'admin (ex. `/img/projets/marketlocal.webp`, format 16:8 conseillé)
- **Vos projets** : depuis l'espace admin `http://localhost:3000/admin`
- **Notifications e-mail** : copiez `.env.example` en `.env`, puis configurez `SMTP_USER` (compte Gmail expéditeur), `SMTP_PASS` (mot de passe d'application Google à 16 caractères) et `MAIL_TO` (boîte qui reçoit les messages). Redémarrez le serveur et vérifiez le terminal : il doit afficher `SMTP prêt`. Le message est enregistré en base même si l'e-mail échoue ; le formulaire indique désormais explicitement la différence. Les messages restent consultables dans `/admin`.
- **Couleurs** : variables en haut de `public/css/style.css`

## Mise en ligne gratuite (Vercel + Turso)

Aucune carte bancaire n'est demandée par ces deux services.

1. **Turso** (base de données) : créer un compte sur turso.tech, créer une base, puis copier son URL (`libsql://…`) et générer un jeton (*Create token*).
2. Dans `.env` en local, ajouter `TURSO_DATABASE_URL` et `TURSO_AUTH_TOKEN`, puis lancer `npm run db:migrate` : les projets et messages de la base locale sont copiés vers Turso.
3. **GitHub** : pousser le projet (`.env` et la base locale sont exclus par `.gitignore`).
4. **Vercel** : *Add New → Project*, importer le dépôt, puis dans *Environment Variables* ajouter :
   `ADMIN_PASSWORD`, `TOKEN_SECRET`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `MAIL_TO`.
5. *Deploy*. Chaque `git push` redéploie automatiquement le site.

Sur Vercel, `index.js` (racine) exporte l'application Express et le dossier `public/` est servi par le CDN ; les en-têtes de sécurité sont définis dans `vercel.json`.

## Mise en production

- Définir `ADMIN_PASSWORD` (long) et `TOKEN_SECRET` (chaîne aléatoire : `node -e "console.log(crypto.randomBytes(32).toString('hex'))"`).
- Derrière un hébergeur ou un proxy (Render, Railway, Nginx…), mettre `TRUST_PROXY=1`, sinon tous les visiteurs partagent la même limite d'envoi.
- Ne jamais partager ni committer le fichier `.env`.

## API

| Méthode | Route | Accès | Description |
| --- | --- | --- | --- |
| GET | `/api/health` | public | État du serveur |
| GET | `/api/profile` | public | Informations du profil |
| GET | `/api/projects?category=` | public | Liste des projets |
| POST | `/api/contact` | public (5 req / 15 min) | Envoi d'un message |
| POST | `/api/auth/login` | public (10 req / 15 min) | Connexion admin → jeton |
| GET | `/api/admin/stats` | admin | Statistiques |
| GET / PATCH / DELETE | `/api/admin/messages[/:id]` | admin | Gestion des messages |
| POST / PUT / DELETE | `/api/admin/projects[/:id]` | admin | Gestion des projets |

## Structure

```
├── public/            # Front-end statique
│   ├── index.html     # Site portfolio
│   ├── admin.html     # Tableau de bord
│   ├── css/
│   └── js/
└── server/
    ├── index.js       # Serveur Express + sécurité
    ├── api.js         # Routes REST
    ├── auth.js        # Jetons, mot de passe, limitation de débit
    ├── db.js          # Schéma SQLite + données initiales
    └── data/profile.json
```
