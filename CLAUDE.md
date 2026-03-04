# Dofus Progress — contexte pour Claude

## Vue d'ensemble

Application web de suivi de progression Dofus. Les joueurs créent des personnages, rejoignent des guildes, et suivront leurs succès/quêtes (visible par la guilde).

## Stack

- **Frontend** : React 18 + Vite + TypeScript + Ant Design 5 + React Router 6 + Zustand + Axios
- **Backend** : Fastify 4 + TypeScript, architecture **DDD** (domain / infrastructure / shared)
- **ORM** : Prisma 5 → PostgreSQL 16
- **Infra** : Docker Compose, Dockerfiles multi-stage (dev + prod)
- **Auth** : JWT via `@fastify/jwt`, passwords hashés avec `bcryptjs`
- **Validation** : Zod côté backend

## Structure des dossiers

```
dofus-progress/
├── backend/
│   ├── prisma/schema.prisma          ← schéma DB
│   ├── scripts/sync-dofusdb.ts       ← script de sync encyclopédie
│   └── src/
│       ├── domain/                   ← entités, interfaces, services métier
│       │   ├── auth/
│       │   ├── character/
│       │   └── guild/
│       ├── infrastructure/
│       │   ├── prisma/client.ts
│       │   ├── repositories/         ← implémentations Prisma
│       │   └── http/
│       │       ├── routes/           ← auth · character · guild · encyclopedia
│       │       └── middleware/authenticate.ts
│       ├── shared/errors/AppError.ts
│       ├── app.ts                    ← buildApp() + DI manuel
│       └── server.ts
└── frontend/
    └── src/
        ├── types/index.ts            ← types app
        ├── types/dofusdb.ts          ← types encyclopédie
        ├── services/api.ts           ← axios instance (ajoute JWT auto)
        ├── services/auth.service.ts
        ├── services/character.service.ts
        ├── services/guild.service.ts
        ├── services/dofusdb.service.ts  ← lit depuis le backend (pas DofusDB directement)
        ├── stores/                   ← Zustand (authStore, characterStore, guildStore)
        ├── pages/                    ← Login · Register · Dashboard · Characters · Guild · Invitations · Achievements · Quests · Dungeons
        ├── components/layout/AppLayout.tsx
        ├── components/character/
        ├── components/guild/
        ├── hooks/useAuth.ts
        └── router/index.tsx
```

## Modèles Prisma

### Domaine utilisateur
- `User` — email, username, passwordHash
- `Character` — userId, name (unique), class, level
- `Guild` — name (unique), leaderId (Character), imageUrl
- `GuildMember` — guildId + characterId (composite PK), role (leader/officer/member)
- `GuildInvitation` — token (unique cuid), status (pending/accepted/declined), expiresAt

### Encyclopédie (données DofusDB, remplies par le script sync)
- `AchievementCategory` — id (int), parentId, nameFr, nameEn, color, icon, order
- `Achievement` — id (int), categoryId, points, level, nameFr, descriptionFr, img
- `QuestCategory` — id (int), nameFr, order
- `Quest` — id (int), categoryId, nameFr, levelMin, levelMax, isDungeonQuest, isPartyQuest, repeatType, stepIds (Int[]), followable, isEvent

## Règles métier importantes

- Un personnage ne peut appartenir qu'à **une seule guilde**
- Impossible de supprimer un personnage **chef de guilde**
- Seul le chef ou un officier peut **inviter / retirer** des membres
- Impossible de retirer le **chef de guilde** via l'API
- Les invitations expirent après **7 jours**
- Un personnage ne peut pas être invité s'il a déjà une invitation **pending** pour la même guilde

## Routes API

```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me

GET    /api/characters                         (avec guildMember inclus)
POST   /api/characters
PUT    /api/characters/:id
DELETE /api/characters/:id
GET    /api/characters/classes                 (liste des 19 classes)

POST   /api/guilds
GET    /api/guilds/:id                         (avec membres)
POST   /api/guilds/:id/invite                  (body: { characterName })
DELETE /api/guilds/:guildId/members/:characterId

GET    /api/invitations
POST   /api/invitations/:token/accept
POST   /api/invitations/:token/decline

GET    /api/achievements/categories
GET    /api/achievements?categoryId&skip&limit&search
GET    /api/quests/categories
GET    /api/quests?categoryId&skip&limit&search
GET    /api/encyclopedia/status
```

## Encyclopédie DofusDB

- Source : `https://api.dofusdb.fr/`
- Les données sont **stockées en DB** (pas appelées à la volée depuis le frontend)
- Script de sync : `docker-compose exec backend npm run sync:dofusdb`
- Le script est **idempotent** (upsert), relançable pour les mises à jour
- Seules les **étapes de quêtes** (quest-steps) sont encore chargées depuis DofusDB à la demande (drawer de détail), car elles ne sont pas stockées en DB
- Le proxy Vite `/dofusdb` → `https://api.dofusdb.fr` reste actif pour la page Donjons et les quest-steps

## Lancer le projet

```bash
# Premier démarrage
cp .env.example .env
docker-compose down -v && docker-compose up --build

# Sync encyclopédie (obligatoire pour avoir les succès/quêtes)
docker-compose exec backend npm run sync:dofusdb

# Relancements suivants
docker-compose up
```

## Conventions de code

- **DDD** : les entités et interfaces de repository sont dans `domain/`, les implémentations dans `infrastructure/`
- **Pas de DI container** : injection manuelle dans `app.ts`
- **Erreurs** : toujours lancer une sous-classe de `AppError` (NotFoundError, ForbiddenError…), le handler global gère le statut HTTP
- **Validation** : Zod en entrée de route, pas de validation dans les entités domaine
- **Frontend** : les appels API passent tous par `services/api.ts` (instance Axios avec token JWT auto)
- **Stores Zustand** : un store par domaine (auth, character, guild), pas de state global Redux-style
- **Couleurs Ant Design** : couleur primaire `#c0902b` (doré Dofus), configurée dans `App.tsx`

## À faire (prochaines étapes)

- Suivi de progression : cocher des succès/quêtes sur un personnage, visible par la guilde
- Upload image de guilde (actuellement URL uniquement)
- Page Almanax journalier
- Rôles officier dans la guilde (promotion/rétrogradation)
