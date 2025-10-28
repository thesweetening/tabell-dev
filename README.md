# SHL Simulator v2.0 - SQL Edition# Tabell.top Website



## 🏒 Ny och förbättrad SHL-tabellsimulator med MySQLEn modern webbsida för tabell.top med staging/production workflow via GitHub Actions.



Denna version använder MySQL istället för Airtable för:## Projektstruktur

- Snabbare prestanda

- Bättre kontroll över data```

- Enklare utveckling och debugging/

- Riktig relationsdatabas├── .github/

│   └── workflows/

## 🗄️ Databas: shl_simulator│       ├── deploy-production.yml    # Deployment till production

## 🎨 Tema: Ljus orange│       └── deploy-staging.yml       # Deployment till staging

## 🔐 Auth: Google OAuth├── css/

│   └── style.css                    # Huvudsaklig CSS

## Funktioner:├── js/

- Real-time tabellsimulering│   └── main.js                      # JavaScript funktionalitet

- Admin-panel för matchresultat├── images/                          # Bilder och media

- Responsiv design├── index.html                       # Hemsida

- Automatiska poängberäkningar├── about.html                       # Om oss-sida

├── contact.html                     # Kontaktsida

Byggd: 28 oktober 2025└── README.md                        # Denna fil
```

## GitHub Repository Setup

Projektet använder två sammankopplade repositories:

### 1. Development Repository: `tabell-dev` (detta repo)
- **Syfte**: Utveckling och staging
- **Huvudbranch**: `main`
- **Deployment**: Automatisk till staging-server
- **URL**: https://test.tabell.top (eller staging-subdirektori)

### 2. Production Repository: `tabell-live`
- **Syfte**: Live-produktionssida
- **Huvudbranch**: `main` 
- **Deployment**: Automatisk till live-server via FTP
- **URL**: https://tabell.top

### Repository-koppling
- Utveckling sker i `tabell-dev`
- När funktioner är testade → manuell sync/merge till `tabell-live`
- Båda repos har egen GitHub Actions för FTP-deployment

## GitHub Secrets Konfiguration

Lägg till följande secrets i både repositories:

### Production Repository (`tabell-live`)
- `PROD_FTP_SERVER` - FTP server hostname
- `PROD_FTP_USERNAME` - FTP användarnamn för production
- `PROD_FTP_PASSWORD` - FTP lösenord för production

### Development Repository (`tabell-dev`)
- `STAGING_FTP_SERVER` - FTP server hostname (kan vara samma som production)
- `STAGING_FTP_USERNAME` - FTP användarnamn för staging
- `STAGING_FTP_PASSWORD` - FTP lösenord för staging

## Workflow Process

### Development Flow (tabell-dev)
1. **Utveckla**: Gör ändringar i `tabell-dev`
2. **Commit & Push**: Push till `main` branch
3. **Auto-deploy**: GitHub Actions deployas automatiskt till staging
4. **Testa**: Verifiera funktionalitet på staging-server

### Production Flow (tabell-live)
1. **Manuell sync**: Kopiera godkänd kod från `tabell-dev` till `tabell-live`
2. **Push**: Push till `tabell-live` main branch  
3. **Auto-deploy**: GitHub Actions deployas automatiskt till live
4. **Verifiera**: Kontrollera live-sidan

### Sync-metoder mellan repos:
- **Manuell**: Kopiera filer mellan repos lokalt
- **Git**: Använd remote/fetch mellan repositories
- **GitHub**: Fork och pull requests

## FTP Deployment Konfiguration

GitHub Actions använder [FTP-Deploy-Action](https://github.com/SamKirkland/FTP-Deploy-Action) för att:
- Ladda upp filer via FTP
- Exkludera utvecklingsfiler (.git, node_modules, etc.)
- Deployas till specificerade server-directories

### Server Directory Structure
- **Production**: `/public_html/`
- **Staging**: `/public_html/staging/` (eller separat domain)

## Teknisk Stack

- **HTML5** - Semantisk markup
- **CSS3** - Moderna CSS features med custom properties
- **JavaScript** - Vanilla JS för interaktivitet
- **GitHub Actions** - CI/CD pipeline
- **FTP** - File deployment

## Utveckling Lokalt

1. Klona repository
2. Öppna `index.html` i webbläsare
3. Gör ändringar i HTML/CSS/JS filer
4. Testa lokalt innan push

## Funktioner

- Responsiv design
- Smooth scrolling navigation
- Animerade element vid scrolling
- Kontaktformulär (frontend-only)
- SEO-optimerad struktur

## Nästa Steg

1. Skapa GitHub repositories (`tabell-live` och `tabell-dev`)
2. Lägg till FTP secrets i repository settings
3. Push denna kod till `tabell-dev` för första deployment
4. Testa staging-deployment
5. Merge till `tabell-live` för production deployment

## Support

För frågor om setup eller deployment, kontakta utvecklingsteamet.