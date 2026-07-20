# Sauvegarde et Restauration — FTF Platform

Ce guide détaille les procédures administratives pour sauvegarder et restaurer les données de la plateforme en production.

---

## 💾 1. Sauvegarde de la Base de Données (MongoDB)

L'ensemble des saisons, compétitions, clubs, joueurs, matchs et historiques d'audit est stocké dans MongoDB.

### Déploiement avec Docker Compose
Si MongoDB tourne dans le conteneur `ftf-mongodb` :
```bash
# Définir le dossier de sauvegarde temporaire
BACKUP_DIR="./backups/mongodb_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Effectuer le dump
docker exec -t ftf-mongodb mongodump --db ftf --out /data/db/temp_dump

# Copier le dump depuis le conteneur vers le serveur hôte
docker cp ftf-mongodb:/data/db/temp_dump/ftf "$BACKUP_DIR"

# Nettoyer le conteneur
docker exec -t ftf-mongodb rm -rf /data/db/temp_dump

echo "Sauvegarde MongoDB effectuée dans : $BACKUP_DIR"
```

### Déploiement Natif (Sans Docker)
Si MongoDB tourne sur la machine hôte :
```bash
BACKUP_DIR="./backups/mongodb_$(date +%Y%m%d_%H%M%S)"
mongodump --uri="mongodb://localhost:27017/ftf?replicaSet=rs0" --out="$BACKUP_DIR"
```

---

## 📁 2. Sauvegarde des Uploads (Médias et Images)

Les blasons des clubs et photos des joueurs sont stockés localement sur le système de fichiers.

### Déploiement avec Docker Compose
Les uploads sont persistés dans le volume Docker nommé `ftf_uploads_data`.
```bash
BACKUP_FILE="./backups/uploads_$(date +%Y%m%d_%H%M%S).tar.gz"

# Compresser le volume à l'aide d'un conteneur temporaire alpine
docker run --rm \
  -v ftf_uploads_data:/data \
  -v ./backups:/backup \
  alpine tar czf "/backup/$(basename $BACKUP_FILE)" -C /data .

echo "Sauvegarde des uploads effectuée dans : $BACKUP_FILE"
```

### Déploiement Natif (Sans Docker)
Sauvegardez directement le dossier `public/uploads` de l'application :
```bash
BACKUP_FILE="./backups/uploads_$(date +%Y%m%d_%H%M%S).tar.gz"
tar -czf "$BACKUP_FILE" -C ./public/uploads .
```

---

## 🔄 3. Restauration des Données

En cas de migration de serveur ou de sinistre.

### Restauration de MongoDB (Docker)
```bash
# Dossier de sauvegarde à restaurer (exemple)
TARGET_BACKUP="./backups/mongodb_20260720_000000"

# Copier les fichiers dans le conteneur
docker cp "$TARGET_BACKUP" ftf-mongodb:/data/db/temp_restore

# Importer les données dans la base de données 'ftf'
docker exec -t ftf-mongodb mongorestore --db ftf /data/db/temp_restore

# Nettoyer le conteneur
docker exec -t ftf-mongodb rm -rf /data/db/temp_restore
```

### Restauration des Uploads (Docker)
```bash
# Fichier d'archive de sauvegarde (exemple)
TARGET_ARCHIVE="./backups/uploads_20260720_000000.tar.gz"

# Décompresser l'archive dans le volume Docker
docker run --rm \
  -v ftf_uploads_data:/data \
  -v ./backups:/backup \
  alpine sh -c "rm -rf /data/* && tar xzf /backup/$(basename $TARGET_ARCHIVE) -C /data"
```

---

## ⏰ 4. Automatisation des Sauvegardes (Cron)

Il est conseillé de créer une tâche cron quotidienne pour automatiser le processus :

Créez le script `/opt/backup.sh` :
```bash
#!/bin/bash
BACKUP_PARENT="/var/backups/ftf"
DATE=$(date +%Y%m%d)
mkdir -p "$BACKUP_PARENT/$DATE"

# 1. Dump MongoDB
docker exec -t ftf-mongodb mongodump --db ftf --out /data/db/temp_dump
docker cp ftf-mongodb:/data/db/temp_dump/ftf "$BACKUP_PARENT/$DATE/mongodb"
docker exec -t ftf-mongodb rm -rf /data/db/temp_dump

# 2. Archive Uploads
docker run --rm -v ftf_uploads_data:/data -v "$BACKUP_PARENT/$DATE":/backup alpine tar czf /backup/uploads.tar.gz -C /data .

# 3. Conserver uniquement les 7 derniers jours de sauvegarde
find "$BACKUP_PARENT" -type d -mtime +7 -exec rm -rf {} \;
```

Ajoutez-le dans la crontab à minuit :
```text
0 0 * * * /bin/bash /opt/backup.sh >> /var/log/ftf-backup.log 2>&1
```
