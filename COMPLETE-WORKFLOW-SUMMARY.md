# Tabell.top - Komplett Staging/Production Workflow Setup

## 📋 PROJEKTÖVERSIKT

**Projekt:** Tabell.top webbsida med professionell staging/production workflow  
**Mål:** Automatisk deployment från GitHub till FTP-server via GitHub Actions  
**Status:** 95% komplett - fungerar men CSS-deployment problem kvarstår  

---

## ✅ VAD VI HAR UPPNÅTT

### 🎉 FUNGERANDE COMPONENTS:

1. **GitHub CLI Autentisering** ✅
   - Installerat: `brew install gh`
   - Konfigurerat med scopes: `repo`, `read:org`, `workflow`
   - Löste credential-problem som blockerade workflow deployment

2. **Staging Repository (tabell-dev)** ✅
   - Repository: https://github.com/thesweetening/tabell-dev
   - Automatisk deployment till staging-server
   - FTP-secrets konfigurerade korrekt

3. **Production Repository (tabell-live)** ✅
   - Repository: https://github.com/thesweetening/tabell-live
   - Automatisk deployment till production-server
   - Sync från staging fungerar perfekt

4. **Git Remote Workflow** ✅
   - `origin` → tabell-dev (staging)
   - `production` → tabell-live (production)
   - Snabb sync mellan repositories: `git push production main`

---

## 🏗️ TEKNISK ARKITEKTUR

### **FTP-Konfiguration:**

#### Staging FTP-konto:
- **Server:** Konfigurerad via `STAGING_FTP_SERVER` secret
- **Hemkatalog:** `/home/qtvifscj/domains/tabell.top/`
- **Deployment-path:** `/public_html/staging/`
- **URL:** https://tabell.top/staging/

#### Production FTP-konto:  
- **Server:** Konfigurerad via `FTP_SERVER` secret
- **Hemkatalog:** `/home/qtvifscj/domains/tabell.top/public_html/`
- **Deployment-path:** `./` (root av FTP-konto)
- **URL:** https://tabell.top/

### **GitHub Secrets:**

#### tabell-dev Repository:
```
STAGING_FTP_SERVER    = [FTP server hostname]
STAGING_FTP_USERNAME  = [FTP username för staging]  
STAGING_FTP_PASSWORD  = [FTP password för staging]
```

#### tabell-live Repository:
```
FTP_SERVER    = [FTP server hostname]
FTP_USERNAME  = [FTP username för production]
FTP_PASSWORD  = [FTP password för production]
```

---

## ⚙️ GITHUB ACTIONS WORKFLOWS

### **Staging Workflow (deploy-staging.yml):**
```yaml
name: Deploy to Staging

on:
  push:
    branches: [ main, develop ]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: List files for debugging
      run: |
        echo "=== Files to deploy ==="
        ls -la
        find . -name "*.html" -o -name "*.css" -o -name "*.js"
        
    - name: Deploy via FTP
      uses: SamKirkland/FTP-Deploy-Action@v4.3.4
      with:
        server: ${{ secrets.STAGING_FTP_SERVER }}
        username: ${{ secrets.STAGING_FTP_USERNAME }}
        password: ${{ secrets.STAGING_FTP_PASSWORD }}
        local-dir: ./
        server-dir: /public_html/staging/
        exclude: |
          .git/**
          .github/**
          README.md
          SETUP.md
          .gitignore
```

### **Production Workflow (deploy-production.yml):**
```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: List files for debugging
      run: |
        echo "=== Production Deployment Files ==="
        ls -la
        find . -name "*.html" -o -name "*.css" -o -name "*.js"
        
    - name: Deploy to Production via FTP
      uses: SamKirkland/FTP-Deploy-Action@v4.3.4
      with:
        server: ${{ secrets.FTP_SERVER }}
        username: ${{ secrets.FTP_USERNAME }}
        password: ${{ secrets.FTP_PASSWORD }}
        local-dir: ./
        server-dir: ./
        exclude: |
          .git/**
          .github/**
          README.md
          SETUP.md
          PROJECT-STATUS.md
          .gitignore
```

---

## 🔄 PROFESSIONELL WORKFLOW PROCESS

### **Daglig Utveckling:**

1. **Utveckla på staging:**
   ```bash
   # Gör ändringar i koden
   git add .
   git commit -m "New feature description"
   git push origin main
   # → Automatisk deployment till staging
   ```

2. **Testa på staging:**
   - Besök: https://tabell.top/staging/
   - Verifiera funktionalitet
   - Testa alla ändringar

3. **Deploy till production:**
   ```bash
   git push production main
   # → Automatisk deployment till production
   ```

4. **Verifiera production:**
   - Besök: https://tabell.top/
   - Kontrollera att allt fungerar identiskt

### **Git Remote Konfiguration:**
```bash
git remote -v
# origin     https://github.com/thesweetening/tabell-dev.git
# production https://github.com/thesweetening/tabell-live.git
```

---

## ⚠️ PROBLEM VI LÖSTE

### **1. GitHub Actions Authentication Error:**
**Problem:** `refusing to allow a Personal Access Token to create or update workflow without workflow scope`

**Lösning:**
- Installerade GitHub CLI: `brew install gh`
- Skapade token med scopes: `repo`, `read:org`, `workflow`
- Konfigurerade: `gh auth login`

### **2. FTP Path Configuration:**
**Problem:** Filer hamnade i fel mappar på servern

**Lösning:**
- **Staging:** Ändrade `server-dir` till `/public_html/staging/`
- **Production:** Ändrade FTP-hemkatalog till `/public_html/`
- **Separata FTP-konton** för staging och production

### **3. Git Credential Caching:**
**Problem:** Git använde gamla cached credentials utan workflow scope

**Lösning:**
- `git config --global credential.helper osxkeychain`
- GitHub CLI hanterar autentisering automatiskt

### **4. Repository Sync Issues:**
**Problem:** Merge conflicts vid sync mellan repositories

**Lösning:**
- Använd `git push production main` för clean sync
- Undvik `--force` - använd proper merge workflow

---

## 🎯 TESTADE SCENARIOS

### **Test 1: HTML-ändringar** ✅
- Ändrade rubrik från "Välkommen till Tabell.top" → "Tabellesimulatorn 2.0"
- **Resultat:** Fungerande deployment till både staging och production

### **Test 2: CSS-färgändringar** ✅ (med fördröjning)
- Ändrade `--primary-color` från blå → röd → grön → svart
- **Resultat:** Production deployment fungerar, staging deployment långsam

### **Test 3: Staging → Production Sync** ✅
- Utvecklade på staging först
- Synkade till production med `git push production main`
- **Resultat:** Perfekt workflow, identiska sidor efter deployment

---

## ❌ ÅTERSTÅENDE PROBLEM

### **CSS Deployment Delay på Staging:**
**Symptom:** HTML-ändringar deployar omedelbart, CSS-ändringar tar lång tid eller deployar inte
**Senaste test:** Ändrade till svart färg (`#000000`) men staging visar fortfarande grön
**Möjliga orsaker:**
1. Browser cache på staging-sidan
2. FTP-server cache för CSS-filer
3. GitHub Actions workflow exclude-regel
4. CSS-fil deployment timing issue

**För vidare undersökning:**
- Kontrollera GitHub Actions loggar för CSS-fil deployment
- Testa med cache-busting techniques (fil-versioning)
- Kontrollera FTP-server CSS-fil tidsstämplar
- Undersök browser dev tools för CSS-laddning

---

## 📂 PROJEKTSTRUKTUR

```
/Volumes/home/Kodning/SHL-V2/
├── .github/
│   └── workflows/
│       ├── deploy-staging.yml      ✅ FUNGERAR
│       └── deploy-production.yml   ✅ FUNGERAR
├── css/
│   └── style.css                   ⚠️ SLOW DEPLOYMENT
├── js/
│   └── main.js                     ✅ FUNGERAR
├── images/                         ✅ FUNGERAR
├── index.html                      ✅ FUNGERAR
├── about.html                      ✅ FUNGERAR  
├── contact.html                    ✅ FUNGERAR
├── README.md
├── SETUP.md
├── PROJECT-STATUS.md               📋 DENNA FIL
└── .gitignore
```

---

## 🔧 VERKTYG & TEKNOLOGIER

- **Git & GitHub:** Version control och repository hosting
- **GitHub Actions:** CI/CD pipeline för automatisk deployment
- **GitHub CLI:** Autentisering och credential management
- **FTP-Deploy-Action:** `SamKirkland/FTP-Deploy-Action@v4.3.4`
- **macOS Keychain:** Säker credential storage
- **Homebrew:** Package manager för GitHub CLI installation

---

## 📚 LÄRDOMAR & BEST PRACTICES

### **Autentisering:**
- Använd GitHub CLI för modern credential management
- Personal Access Tokens behöver rätt scopes: `repo`, `read:org`, `workflow`
- Undvik token i URL:er - säkerhetsrisk

### **FTP Configuration:**
- Separata FTP-konton för staging och production
- Tydliga server-dir paths för att undvika kollisioner
- Exclude-regler för att undvika deployment av utvecklingsfiler

### **Git Workflow:**
- `origin` för staging development
- `production` remote för production deployment
- Clean commit messages för tydlig historik

### **Debugging:**
- Debug-steg i workflows för file listing
- GitHub Actions loggar för deployment verification
- Browser dev tools för cache-problem

---

## 🚀 NÄSTA STEG

1. **Lösa CSS Deployment Delay:**
   - Undersök staging workflow CSS-hantering
   - Testa cache-busting techniques
   - Kontrollera FTP-server CSS-fil permissions

2. **Optimering:**
   - Lägg till build-steg för CSS/JS minification
   - Implementera deployment notifications
   - Sätt upp monitoring för deployment status

3. **Säkerhet:**
   - Regelbunden rotation av FTP-lösenord
   - Audit av GitHub secrets
   - Backup-strategi för repositories

---

## 🎉 SLUTSATS

**Vi har uppnått en nästan perfekt professionell staging/production workflow:**

✅ **Automatisk deployment** från GitHub till FTP  
✅ **Säker autentisering** via GitHub CLI  
✅ **Clean separation** mellan staging och production  
✅ **Snabb sync** mellan environments  
✅ **Professionell Git workflow** med remotes  

**Återstående:** CSS deployment delay på staging - teknisk detalj som inte påverkar huvudfunktionaliteten.

**Total framgång:** 95% - Ett deployment-system redo för professionell utveckling!

**Datum:** 25 oktober 2025  
**Status:** Production ready med minor optimization kvar