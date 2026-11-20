# 🚋 Guide de déploiement — Educ CEB Bagré sur Vercel + Supabase

Ce guide explique comment déployer gratuitement votre application de gestion scolaire CEB Burkina Faso sur **Vercel** avec **Supabase**.

## 1. Prérequis

Installez sur votre machine :
- **Node.js** (v18+) : https://nodejs.org/
- **npm** (installé avec Node.js)

Vérifiez : `node --version` et `npm --version`

## 2. Installation des dépendances

Dans le dossier du projet :
```bash
npm install
```

Installe : `vite`, `@supabase/supabase-js`, `vite-plugin-pwa`, `xlsx`, `idb`.

## 3. Configuration Supabase

### 3.1 Créer un projet

1. Allez sur https://supabase.com et créez un compte.
2. Cliquez sur **"New Project"**, nommez-le `educ-ceb-bagre`.
3. Attendez que le projet soit prêt.

### 3.2 Récupérer les clés API

Dans **Settings → API**, notez :
- **Project URL** (ex: `https://xyzabc.supabase.co`)
- **anon public** key (commence par `eyJ...`)

### 3.3 Variables d'environnement

```bash
copy .env.example .env
```

Éditez `.env` :
```
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre-cle-anonyme
VITE_CEB_DEFAULT=BAGRÉ
```

### 3.4 Appliquer le schéma SQL

Dans **SQL Editor** de Supabase, copiez-collez le contenu de `supabase/migrations/001_initial_schema.sql` et cliquez sur **Run**.

### 3.5 Configurer Supabase Auth

Dans **Authentication → Settings**, désactivez **"Enable email confirmations"**.

L'identifiant (téléphone ou nom d'utilisateur) est converti automatiquement en `identifiant@ceb.local` pour Supabase Auth. Aucun vrai email n'est requis.

## 4. Build local

```bash
npm run build
```

Génère le dossier `dist/`. Pour tester :
```bash
npm run preview
```
Puis ouvrez http://localhost:8080

## 5. Déploiement sur Vercel

### 5.1 Compte Vercel

Allez sur https://vercel.com, créez un compte gratuit.

### 5.2 Déployer via CLI

```bash
npm install -g vercel
vercel login
vercel
```

Suivez les prompts :
- Project name : `educ-ceb-bagre`
- Directory : `.`
- Override settings : `N`

### 5.3 Variables d'environnement Vercel

Dans le dashboard Vercel → votre projet → **Settings → Environment Variables**, ajoutez :

| Clé | Valeur |
|-----|--------|
| `VITE_SUPABASE_URL` | `https://votre-projet.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `votre-cle-anonyme` |
| `VITE_CEB_DEFAULT` | `BAGRÉ` |

Redéployez : `vercel --prod`

### 5.4 Votre lien public

Votre application sera accessible à : `https://educ-ceb-bagre.vercel.app`

## 6. Utilisation

1. Ouvrez votre lien Vercel.
2. Cliquez sur **"Créer un compte"**.
3. Remplissez : nom, identifiant, WhatsApp (+226), mot de passe, rôle.
4. Connectez-vous.

### Rôles

| Rôle | Capacités |
|------|-----------|
| **Titulaire** | Sa classe, élèves, notes, évaluer autres classes, examens blancs CM |
| **Directeur** | Lecture seule école, effectifs centralisés |
| **Encadreur** | Lecture seule écoles suivies, synthèse Examens Blancs, export |
| **Chef CEB** | Lecture seule toute CEB, convocation WhatsApp |

## 7. PWA

Installable sur Android (Chrome) et PC (Chrome/Edge). Fonctionne hors-ligne avec sync auto.

## 8. Structure

```
├── package.json, vite.config.js, vercel.json, .env.example
├── index.html
├── supabase/migrations/001_initial_schema.sql
├── src/main.js, supabaseClient.js, db.js, utils/format.js
├── src/views/{login,register,dashboard,titulaire,directeur,encadreur,chef-ceb}.js
└── public/{icon-192.png,icon-512.png,manifest.json}
```

**Bonne gestion scolaire avec Educ CEB Bagré ! 🇧🇫**