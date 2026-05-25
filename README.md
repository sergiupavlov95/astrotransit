# ✦ AstroTransit — Setup & Deployment

## Structura proiectului

```
astrotransit/
├── server.js          ← Backend Node.js (ascunde cheia API)
├── package.json
├── .env.example       ← Template pentru variabile de mediu
├── .gitignore         ← .env și node_modules sunt excluse din git
└── public/
    └── index.html     ← Frontend (apelează /api/claude, fără cheie în browser)
```

---

## Rulare locală

### 1. Instalează dependențele
```bash
npm install
```

### 2. Setează cheia API
```bash
cp .env.example .env
# Deschide .env și pune cheia ta Anthropic:
# ANTHROPIC_API_KEY=sk-ant-api03-...
```

### 3. Pornește serverul
```bash
npm start
# sau în mod development (auto-restart):
node --watch server.js
```

### 4. Deschide browserul
```
http://localhost:3000
```

---

## Deployment pe server (VPS / Railway / Render)

### Railway (recomandat — gratuit)
1. Creează cont pe [railway.app](https://railway.app)
2. New Project → Deploy from GitHub repo
3. Adaugă variabila de mediu: `ANTHROPIC_API_KEY=sk-ant-...`
4. Railway setează `PORT` automat

### Render
1. New Web Service → conectează repo GitHub
2. Build command: `npm install`
3. Start command: `npm start`
4. Environment variable: `ANTHROPIC_API_KEY=sk-ant-...`

### VPS (Ubuntu/Debian)
```bash
# Instalează Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Clonează și configurează
git clone <repo-url> astrotransit
cd astrotransit
npm install
cp .env.example .env
nano .env   # adaugă cheia

# Pornește cu PM2 (process manager)
npm install -g pm2
pm2 start server.js --name astrotransit
pm2 save
pm2 startup
```

---

## Securitate
- Cheia API **nu ajunge niciodată** în browser sau în codul frontend
- `.env` este exclus din git prin `.gitignore`
- Request-urile sunt limitate la max 2000 tokens și 20 mesaje pe apel
- Nu există autentificare — dacă vrei să limitezi accesul, adaugă un middleware simplu
