# INSTALLATION.md — Guide d'Installation de Production (FTF Platform)

Ce document décrit comment installer et configurer l'application FTF sur un serveur Linux en production.

---

## 📋 Prérequis Systèmes

* **Système d'exploitation** : Ubuntu 22.04 LTS ou supérieur (recommandé).
* **Node.js** : version 20.x LTS.
* **MongoDB** : version 7.0 (obligatoirement configuré en **Replica Set** pour le support des transactions multi-documents).
* **Docker & Docker Compose** (requis si vous utilisez le déploiement conteneurisé).

---

## 🛠️ Option A : Installation sous Docker (Recommandé)

Docker simplifie grandement l'initialisation du replica set MongoDB et des volumes de persistance.

### 1. Préparation du serveur
Installez Docker Engine et Docker Compose :
```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2
```

### 2. Téléchargement et Configuration
Clonez le dépôt de l'application et créez le fichier de configuration :
```bash
git clone <repo-url> ftf-platform
cd ftf-platform
cp .env.example .env
```

Éditez le fichier `.env` et ajustez les paramètres requis :
```ini
# Port d'écoute de l'application
PORT=3000

# URI MongoDB (pointe vers le conteneur du réseau Docker avec replicaSet rs0)
MONGODB_URI=mongodb://mongodb:27017/ftf?replicaSet=rs0

# Secret NextAuth (générez une clé robuste avec : openssl rand -base64 32)
NEXTAUTH_SECRET=ChangerCeSecretEnProductionAbsolument!

# URL publique de l'application
NEXTAUTH_URL=https://ftf-platform.tn
```

### 3. Démarrage des Services
Démarrez les conteneurs en tâche de fond :
```bash
docker compose up -d
```
Cette commande démarre la base MongoDB (en replica set mono-nœud nommé `rs0`) et l'application Next.js compilée en mode standalone.

### 4. Initialisation du premier compte Administrateur
Créez le premier utilisateur administrateur système :
```bash
docker compose exec app npx tsx scripts/bootstrap.ts
```
Suivez les instructions sur l'écran pour saisir l'email et le mot de passe initial de l'administrateur FTF.

---

## ⚙️ Option B : Installation Manuelle (Bare Metal)

Si vous installez les services séparément sans Docker.

### 1. Configuration de MongoDB en Replica Set
Éditez le fichier `/etc/mongod.conf` pour activer les replica sets :
```yaml
replication:
  replSetName: "rs0"
```
Redémarrez MongoDB et initialisez-le :
```bash
sudo systemctl restart mongod
mongosh --eval "rs.initiate()"
```

### 2. Compilation de l'application Next.js
Installez Node.js 20, installez les dépendances et lancez le build :
```bash
# Installer Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Préparer l'application
npm ci
npm run build
```

### 3. Service Systemd
Créez un service systemd pour exécuter l'application en arrière-plan. Créez le fichier `/etc/systemd/system/ftf.service` :
```ini
[Unit]
Description=FTF Competition Platform
After=network.target mongod.service

[Service]
Type=simple
User=node
WorkingDirectory=/opt/ftf-platform
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=MONGODB_URI=mongodb://127.0.0.1:27017/ftf?replicaSet=rs0
Environment=NEXTAUTH_SECRET=GénérerUnSecretFort
Environment=NEXTAUTH_URL=https://votre-domaine.com
ExecStart=/usr/bin/node .next/standalone/server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

Activez et démarrez le service :
```bash
sudo systemctl daemon-reload
sudo systemctl enable ftf
sudo systemctl start ftf
```

---

## 🛡️ Sécurité & Proxy inverse

Il est fortement recommandé de placer l'application derrière un proxy inverse comme **Nginx** pour gérer le chiffrement SSL/TLS :

```nginx
server {
    listen 80;
    server_name ftf-platform.tn;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name ftf-platform.tn;

    ssl_certificate /etc/letsencrypt/live/ftf-platform.tn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ftf-platform.tn/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Vérifiez le bon fonctionnement en appelant l'API de santé de l'application :
```bash
curl https://ftf-platform.tn/api/health
```
