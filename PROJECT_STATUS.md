# SHL Tabellsimulator - Status och Återstående Problem

## 📊 Vad vi har åstadkommit

### ✅ **Fungerande funktioner**
- **Säkerhet**: API-nycklar exponeras inte längre publikt
- **Google OAuth**: Inloggning fungerar med backend + PHP fallback
- **Admin Panel**: Grundstruktur klar med matchregistrering
- **Dataintegration**: Laddar ALL 289 matcher från Airtable Matches-tabell (inte bara 100)
- **Färgtema**: Ljusblå tema istället för grönt
- **Alla 14 lag**: Visas nu i tabellen
- **Real data**: Hämtar korrekt SHL-statistik från Team_Stats

### ⚠️ **Identifierade problem**

#### 1. **KRITISKT: Layout-proportioner fel**
- **Problem**: SHL-tabellen (vänster) är för smal, matchlistan (höger) är för bred
- **Önskat**: 
  - SHL-tabell (vänster) = bred som LILA området i färgmarkering
  - Matchlista (höger) = smal som GULA området i färgmarkering
- **Nuvarande CSS**: `grid-template-columns: 250px 1fr;` (tvärtom mot önskat)
- **Behöver vara**: `grid-template-columns: 1fr 250px;` (SHL-tabell bred, matchlista smal)

#### 2. **KRITISKT: Simulering fungerar inte**
- **Problem**: När man fyller i matchresultat uppdateras inte SHL-tabellen
- **Debug visar**: 
  - `renderTable()` anropas korrekt
  - `updateTeamStats()` anropas
  - Men lagnamnen matchar inte mellan matcher och teamStats
- **Trolig orsak**: Lagnamn från Airtable Teams vs Matches-tabeller stämmer inte överens

#### 3. **Endast 1 match visas för 2025-10-28**
- **Problem**: Trots att det finns 7 matcher den 28 oktober visas bara 1
- **Status**: Åtgärdad med paginering men behöver verifieras

## 🔧 Teknisk arkitektur

### **Backend (Node.js)**
```
/backend/server.js
- Google OAuth 2.0 autentisering
- Airtable API proxy med paginering för alla 289 matcher
- Sessions med 4-timmars timeout
```

### **PHP Fallback** 
```
/api-config.php - Konfiguration från .env
/api-matches.php - Hämtar alla matcher med paginering
```

### **Frontend**
```
/js/shl-simulator-backend.js - Huvudlogik
/css/simulator.css - Layout (PROBLEM här)
/admin-panel.html - Admin interface
```

## 🎯 Nästa steg för att lösa problemen

### **1. Fixa layout-proportioner (AKUT)**
```css
/* I /css/simulator.css, ändra från: */
grid-template-columns: 250px 1fr;
/* Till: */
grid-template-columns: 1fr 250px;
```

### **2. Debug simulering**
- Kolla lagnamn-mappning mellan Teams och Matches-tabeller
- Verifiera att `team.name` stämmer med `teamStats.name`

### **3. Verifiera matcher**
- Testa att alla 7 matcher för 2025-10-28 visas
- Kontrollera att "finished"-filtrering fungerar

## 📋 Debug-information från senaste session

```javascript
// Konsol-utskrifter visar:
"🎯 renderTable() ANROPAD - börjar rendera tabell"
"🔍 updateTeamStats called with: {homeTeam, awayTeam, homeScore, awayScore}"
"❌ Team stats not found: {homeTeam, awayTeam}"

// Teams array visar: "undefined" för många lag
// Detta indikerar mappning-problem mellan tabeller
```

## 🚨 Kritiska filer att fokusera på

1. **`/css/simulator.css`** - Layout-fix (rad ~24)
2. **`/js/shl-simulator-backend.js`** - Simulerings-logik (rad ~640, 780)
3. **Airtable Teams vs Matches** - Fältnamn-mappning

## 💡 Lösningsstrategi

1. **Fixa layouten först** (5 min) - enkel CSS-ändring
2. **Debug lagnamn** (15 min) - logga alla fältnamn från båda tabellerna  
3. **Testa simulering** (10 min) - verifiera att uppdatering fungerar
4. **Sluttest** - fyll i matchresultat och se tabelluppdatering

---
**Status**: Kärnfunktionalitet 80% klar, behöver bara slutjustera layout och simulering
**Tidsestimering**: ~30 minuter för att lösa alla återstående problem