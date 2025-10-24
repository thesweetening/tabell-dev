# Setup Guide - Tabell.top Repositories

## 🎯 Snabb Setup

### 1. Skapa tabell-dev repository
```bash
# På GitHub: Skapa nytt repo "tabell-dev"
# Kopiera denna kod dit
git remote add origin https://github.com/thesweetening/tabell-dev.git
git push -u origin main
```

### 2. Lägg till Staging Secrets i tabell-dev
Gå till `tabell-dev` → Settings → Secrets and variables → Actions

Lägg till:
- `STAGING_FTP_SERVER` (din FTP-server)
- `STAGING_FTP_USERNAME` (FTP-användare för staging)
- `STAGING_FTP_PASSWORD` (FTP-lösenord för staging)

### 3. Skapa tabell-live repository
```bash
# På GitHub: Skapa nytt repo "tabell-live"
# Kopiera samma kod dit (utan .github/workflows/deploy-staging.yml)
```

### 4. Production Secrets (redan gjort!)
Du har redan lagt till i `tabell-live`:
- ✅ `PROD_FTP_SERVER` 
- ✅ `PROD_FTP_USERNAME`
- ✅ `PROD_FTP_PASSWORD`

## 🔄 Daglig Workflow

### Utveckla i tabell-dev:
```bash
# Gör ändringar
git add .
git commit -m "Ny funktion"
git push origin main
# → Automatisk deployment till staging
```

### Flytta till production:
```bash
# När staging är testad och godkänd
# Metod 1: Manuell kopiering
cp -r tabell-dev/* tabell-live/
cd tabell-live
git add .
git commit -m "Sync från staging"
git push origin main
# → Automatisk deployment till live

# Metod 2: Git remote
cd tabell-live
git remote add dev ../tabell-dev
git fetch dev main
git merge dev/main
git push origin main
```

## 📂 Fil-struktur för varje repo

### tabell-dev (detta repo):
- Alla filer inklusive `deploy-staging.yml`
- Utvecklings- och staging-deployment

### tabell-live:
- Samma filer UTAN `deploy-staging.yml`  
- Endast `deploy-production.yml`
- Production-deployment

## 🚨 Viktiga noteringar

1. **Olika FTP-paths**: 
   - Staging: `/public_html/staging/` eller subdomain
   - Production: `/public_html/`

2. **Secrets per repo**:
   - `tabell-dev` = STAGING_* secrets
   - `tabell-live` = PROD_* secrets (✅ redan gjort)

3. **Sync är manuell**: 
   - Automatisk sync kräver Personal Access Token
   - Manuell sync ger bättre kontroll

Redo att börja utveckla! 🎉