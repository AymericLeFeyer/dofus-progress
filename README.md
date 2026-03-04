# Dofus Progress

Outil de suivi de progression pour Dofus — gérez vos personnages, votre guilde, et suivez vos succès et quêtes. L'avancement de chaque personnage est visible par les membres de sa guilde.

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | React 18 + Vite + TypeScript + Ant Design 5 |
| État | Zustand + React Router 6 |
| Backend | Fastify 4 + TypeScript (architecture DDD) |
| ORM | Prisma 5 |
| Base de données | PostgreSQL 16 |
| Infra | Docker + Docker Compose |

## Démarrage rapide

### Avec Docker (recommandé)

```bash
# 1. Copier les variables d'environnement
cp .env.example .env

# 2. Build et lancement (première fois)
docker-compose down -v && docker-compose up --build

# 3. Synchroniser les données DofusDB (à faire une fois, puis pour les mises à jour)
docker-compose exec backend npm run sync:dofusdb
```

**URLs :**
- Frontend → http://localhost:5173
- Backend  → http://localhost:3000
- Postgres → localhost:5432

### Sans Docker (développement local)

**Prérequis :** Node.js 20+, PostgreSQL 16

```bash
# Backend
cd backend
cp .env.example .env        # renseigner DATABASE_URL
npm install
npx prisma db push
npm run dev

# Frontend (autre terminal)
cd frontend
npm install
npm run dev
```

## Fonctionnalités

### Compte & Personnages
- Inscription / connexion (JWT)
- Création de personnages : nom, classe (19 classes Dofus), niveau 1–200
- Édition et suppression (impossible si chef de guilde)

### Guildes
- Création d'une guilde avec un personnage comme chef
- Image de guilde (URL)
- Invitation par nom de personnage → token valide 7 jours
- Accepter / refuser une invitation
- Retirer un membre (chef ou officier uniquement)
- Un personnage ne peut appartenir qu'à une seule guilde

### Encyclopédie (données DofusDB)
- **Succès** : arbre de catégories coloré + grille de succès avec image, points, description
- **Quêtes** : liste par catégorie + drawer de détail avec les étapes
- Données stockées en base PostgreSQL, alimentées par le script de sync

## Script de synchronisation DofusDB

Importe tous les succès et quêtes depuis [api.dofusdb.fr](https://api.dofusdb.fr) dans PostgreSQL.

```bash
# Lancer la sync (idempotent, peut être relancé pour les mises à jour)
docker-compose exec backend npm run sync:dofusdb
```

Le script affiche une progress bar et un résumé :

```
📁 Catégories de succès...  [██████████████████████████████] 124/124
🏆 Succès...                [██████████████████████████████] 2900/2900
📚 Catégories de quêtes...  [██████████████████████████████] 42/42
📜 Quêtes...                [██████████████████████████████] 1800/1800

✅ Sync terminée — durée : 47.3s
```

## Architecture backend (DDD)

```
backend/src/
├── domain/
│   ├── auth/          User.entity · IUserRepository · AuthService
│   ├── character/     Character.entity · ICharacterRepository · CharacterService
│   └── guild/         Guild/GuildMember/GuildInvitation.entity · IGuildRepository · GuildService
├── infrastructure/
│   ├── prisma/        client.ts
│   ├── repositories/  PrismaUserRepository · PrismaCharacterRepository · PrismaGuildRepository
│   └── http/
│       ├── routes/    auth · character · guild · encyclopedia
│       └── middleware/ authenticate.ts
└── shared/errors/     AppError · NotFoundError · UnauthorizedError · ConflictError · ForbiddenError
```

## API Routes

### Auth
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/auth/register` | Créer un compte |
| POST | `/api/auth/login` | Connexion |
| GET  | `/api/auth/me` | Profil courant |

### Personnages
| Méthode | Route | Description |
|---------|-------|-------------|
| GET  | `/api/characters` | Mes personnages (avec info guilde) |
| POST | `/api/characters` | Créer un personnage |
| PUT  | `/api/characters/:id` | Modifier |
| DELETE | `/api/characters/:id` | Supprimer |
| GET  | `/api/characters/classes` | Liste des 19 classes |

### Guildes & Invitations
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/guilds` | Créer une guilde |
| GET  | `/api/guilds/:id` | Guilde + membres |
| POST | `/api/guilds/:id/invite` | Inviter un personnage |
| DELETE | `/api/guilds/:guildId/members/:characterId` | Retirer un membre |
| GET  | `/api/invitations` | Mes invitations en attente |
| POST | `/api/invitations/:token/accept` | Accepter |
| POST | `/api/invitations/:token/decline` | Refuser |

### Encyclopédie
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/achievements/categories` | Toutes les catégories de succès |
| GET | `/api/achievements?categoryId=&search=&skip=&limit=` | Succès paginés |
| GET | `/api/quests/categories` | Toutes les catégories de quêtes |
| GET | `/api/quests?categoryId=&search=&skip=&limit=` | Quêtes paginées |
| GET | `/api/encyclopedia/status` | Statut de la dernière sync |

## Variables d'environnement

### Racine (`.env`)
```env
DB_USER=dofus
DB_PASSWORD=dofus_password
DB_NAME=dofus_progress
JWT_SECRET=change_me_to_a_long_random_secret
```

### Backend (`backend/.env`)
```env
DATABASE_URL=postgresql://dofus:dofus_password@localhost:5432/dofus_progress
JWT_SECRET=change_me_to_a_long_random_secret
PORT=3000
NODE_ENV=development
```

## Commandes utiles

```bash
# Rebuild un seul service
docker-compose up --build backend

# Accéder au shell du backend
docker-compose exec backend sh

# Prisma Studio (interface DB)
docker-compose exec backend npm run db:studio

# Voir les logs en temps réel
docker-compose logs -f backend

# Reset complet (⚠️ supprime les données)
docker-compose down -v && docker-compose up --build
```
