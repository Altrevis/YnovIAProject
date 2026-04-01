# Shaarp.ai — AI-Powered Exhibitor Scraper

Shaarp.ai est une application web qui scrape automatiquement les annuaires d'exposants de salons professionnels et d'événements. L'utilisateur colle une URL dans une interface de type chat ; l'application extrait les données structurées des exposants et les affiche dans un tableau filtrable/exportable.

---

## Fonctionnalités

- **Scraping multi-stratégie** : fetch statique → rendu JavaScript (Playwright headless) → détection de JSON embarqué → config Algolia → enrichissement des pages de détail
- **Extraction LLM** : utilise un modèle local via LM Studio (Vercel AI SDK + `@ai-sdk/openai`) pour structurer les données brutes
- **Données exposants** : nom, description, site web, logo, stand/booth, pays, LinkedIn, Twitter, catégories, email, téléphone
- **Export** : CSV et Excel (SpreadsheetML XML)
- **Proxy d'images** : les logos sont proxifiés via `/api/image-proxy` pour contourner le hotlinking/CORS
- **Thème clair/sombre** : toggle avec persistance `localStorage` et détection `prefers-color-scheme`
- **Navbar auto-masquante** au scroll

---

## Stack technique

| Catégorie | Technologie |
|---|---|
| Framework | **Next.js 16** (App Router) |
| Langage | **TypeScript 5** |
| Runtime | **React 19** |
| Styles | **Tailwind CSS v4**, `tw-animate-css`, `shadcn/ui` |
| IA / LLM | **Vercel AI SDK** (`ai` v4), `@ai-sdk/openai` → **LM Studio** local |
| Scraping statique | **Cheerio** v1 |
| Scraping SPA/JS | **Playwright** (Chromium headless) |
| Icônes | **lucide-react** |
| Tests E2E | **Playwright** |
| Polices | Inter + JetBrains Mono (Google Fonts via `next/font`) |

---

## Prérequis

- **Node.js** ≥ 18
- **npm** / yarn / pnpm / bun
- **LM Studio** en cours d'exécution en local à `http://127.0.0.1:1234/v1` avec un modèle chargé (ex. Mistral 3B)  
  _(Sans LM Studio, le pipeline de scrape fonctionne partiellement via la détection directe de JSON, mais l'extraction LLM échouera.)_
- **Playwright browsers** installés (voir ci-dessous)

---

## Installation

```bash
# Cloner le dépôt
git clone <url-du-repo>
cd YnovIAProject1

# Installer les dépendances
npm install

# Installer les navigateurs Playwright
npx playwright install chromium
```

---

## Lancer le projet

```bash
# Développement
npm run dev

# Build de production
npm run build
npm run start
```

Ouvrir [http://localhost:3000](http://localhost:3000) dans le navigateur.

---

## Structure du projet

```
app/
├── page.tsx                  # Page racine — affiche le composant <Chat />
├── layout.tsx                # Layout racine — polices, ThemeProvider
├── theme-provider.tsx        # Contexte React pour le thème clair/sombre
├── globals.css               # Variables CSS (palette, animations, scrollbar)
├── results/page.tsx          # Page résultats avec tableau complet et export CSV
├── legal/page.tsx            # Mentions légales
└── api/
    ├── scrape/route.ts       # Endpoint principal — pipeline de scraping + LLM
    ├── image-proxy/route.ts  # Proxy d'images externes (CORS, cache 24h)
    └── chat/route.ts         # Stub 501 — chat conversationnel (à venir)

components/
├── chat.tsx              # Composant principal — UX complète du scraper
├── chat-conv.tsx         # Chat conversationnel (streaming via /api/chat)
├── chat-area.tsx         # Bulles de chat (affichage)
├── input-area.tsx        # Zone de saisie stylisée
├── filter-panel.tsx      # Panneau de filtres URL / type d'entité / source
├── navbar.tsx            # Navbar fixe avec auto-hide et toggle thème
├── result-preview.tsx    # Aperçu 3 lignes avec lien vers /results
├── results-table.tsx     # Tableau complet triable/filtrable + export
└── ui/
    └── button.tsx        # Composant Button shadcn/ui

lib/
├── scraper.ts    # Moteur de scraping : pagination, JSON embarqué, Algolia, enrichissement
├── api.ts        # fetch HTTP (UA rotatif, retry, timeout) + Playwright (interception XHR)
├── parser.ts     # Résumé de page via Cheerio (title, OG, meta, liens, texte)
├── formatter.ts  # Helper formatEntreprise()
└── utils.ts      # Utilitaire cn() (clsx + tailwind-merge)
```

---

## Pages & routes

| Route | Description |
|---|---|
| `/` | Interface chat — scraping par URL, tableau de résultats inline |
| `/results` | Page résultats complète (données mock, CSV download) |
| `/legal` | Mentions légales |
| `/api/scrape` | POST — reçoit `{ url }`, retourne une liste d'exposants |
| `/api/image-proxy` | GET `?url=...` — proxy d'images externes |
| `/api/chat` | POST — stub 501, chat LLM (à venir) |

---

## Pipeline de scraping (`/api/scrape`)

1. **Fetch statique** — récupère le HTML brut avec UA rotatif et retry
2. **Détection JSON embarqué** — cherche `__NEXT_DATA__`, `application/ld+json`, variables inline dans les `<script>`
3. **Rendu Playwright** — si le contenu est dynamique, lance Chromium headless et intercepte les réponses XHR/fetch JSON
4. **Détection Algolia** — extrait la config de recherche Algolia et interroge l'index directement
5. **Pagination** — suit les liens `rel=next` et `aria-label` pour parcourir toutes les pages
6. **Enrichissement** — visite les pages de détail des exposants pour compléter les données manquantes
7. **Extraction LLM** — envoie le contenu à LM Studio pour structurer les champs en `Exhibitor[]`
8. **Mapping direct** — `mapRawToExhibitor()` tente un mapping sans LLM sur les JSON déjà structurés

---

## Configuration

| Fichier | Notes |
|---|---|
| `next.config.ts` | Configuration minimale Next.js |
| `tailwind.config.ts` | Dark mode via `class`, chemins `app/` et `components/` |
| `app/globals.css` | Tokens de design : `--primary: #6647fc` (violet), gradient `#eb6ea6` (rose) |
| `playwright.config.ts` | Tests E2E dans `./e2e/`, Chromium + Firefox + WebKit, `baseURL: http://localhost:3000` |
| `components.json` | Configuration shadcn/ui |
| `eslint.config.mjs` | ESLint avec `eslint-config-next` |

---

## Tests E2E

```bash
npx playwright test
```

Les tests sont dans `./e2e/` et tournent sur Chromium, Firefox et WebKit. Le serveur de dev est démarré automatiquement par Playwright.

---

## Dépendance LM Studio

Le pipeline de scraping utilise **LM Studio** comme backend LLM local. Avant de lancer le projet :

1. Télécharger [LM Studio](https://lmstudio.ai/)
2. Charger un modèle (recommandé : Mistral 3B ou équivalent)
3. Démarrer le serveur local sur `http://127.0.0.1:1234/v1`

Sans ce serveur, le scraping fonctionne partiellement (détection JSON directe) mais l'extraction structurée par LLM sera indisponible.

---

## Auteurs

Projet réalisé dans le cadre du cursus **Ynov Campus** — IA & Développement.
