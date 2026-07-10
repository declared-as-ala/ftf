# Déploiement — FTF Platform

## Prérequis

- Node.js 20+
- MongoDB 7.0+ (replica set requis pour les transactions)
- Docker & Docker Compose (optionnel, pour déploiement conteneurisé)

## Variables d'environnement

| Variable | Requis | Défaut | Description |
|---|---|---|---|
| `MONGODB_URI` | Oui | — | URI MongoDB avec `?replicaSet=rs0` |
| `NEXTAUTH_SECRET` | Oui | — | Clé secrète pour le chiffrement des sessions JWT |
| `NEXTAUTH_URL` | Oui | `http://localhost:3000` | URL publique de l'application |
| `LOG_LEVEL` | Non | `info` | Niveau de log (`debug`, `info`, `warn`, `error`) |
| `NODE_ENV` | Non | `production` | Environnement d'exécution |

## Déploiement avec Docker Compose

```bash
# 1. Cloner et configurer
git clone <repo> ftf
cd ftf
cp .env.example .env
# Éditer .env avec MONGODB_URI, NEXTAUTH_SECRET, NEXTAUTH_URL

# 2. Lancer les services
docker compose up -d

# 3. Bootstrap (création admin initial)
docker compose exec app npx tsx scripts/bootstrap.ts

# 4. Vérifier l'état
curl http://localhost:3000/api/health
```

## Déploiement manuel (sans Docker)

```bash
# 1. Installer les dépendances
npm ci

# 2. Construire l'application
npm run build

# 3. Bootstrap
npm run bootstrap

# 4. Démarrer
npm start
```

## Sauvegarde et restauration

### MongoDB

```bash
# Sauvegarde
mongodump --uri="$MONGODB_URI" --out=./backups/$(date +%Y%m%d_%H%M%S)

# Restauration
mongorestore --uri="$MONGODB_URI" ./backups/<backup_dir>
```

### Uploads

Les fichiers uploadés sont stockés dans `public/uploads/`. En Docker, ce répertoire est un volume nommé `uploads_data`.

```bash
# Sauvegarde des uploads (Docker)
docker run --rm -v ftf_uploads_data:/data -v ./backups:/backup alpine tar czf /backup/uploads-$(date +%Y%m%d).tar.gz /data

# Restauration
docker run --rm -v ftf_uploads_data:/data -v ./backups:/backup alpine tar xzf /backup/uploads-<date>.tar.gz -C /data
```

## Sécurité

1. **Chiffrement** : NEXTAUTH_SECRET doit être une chaîne aléatoire de 32+ caractères
2. **MongoDB** : En production, utilisez MongoDB Atlas ou un replica set avec authentification (keyFile)
3. **Headers** : Les en-têtes de sécurité sont configurés dans `next.config.ts` :
   - `X-Frame-Options: DENY`
   - `X-Content-Type-Options: nosniff`
   - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
   - `Permissions-Policy` restreinte
4. **Uploads** : Les fichiers sont validés par type MIME et taille maximale (2 MB)

## Healthcheck

`GET /api/health` retourne l'état de l'application :

```json
{
  "status": "ok",
  "db": { "status": "connected" },
  "uptime": 12345,
  "memory": { "rss": 128, "heapUsed": 64, "heapTotal": 96 }
}
```

## Logs

Les logs sont écrits sur stdout avec un format structuré :
```
[2025-07-10T12:00:00.000Z] [INFO] Serveur démarré
```

Niveaux : `debug` → `info` → `warn` → `error` (configurable via `LOG_LEVEL`).
