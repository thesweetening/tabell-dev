# 🏒 SHL Tabellsimulator - Komplett Teknisk Dokumentation

## Projektmål & Användarupplevelse
Interaktiv simulator där användare kan fylla i resultat för kommande SHL-matcher och se realtidsuppdatering av tabellen. Användare tänker: *"Vad händer i tabellen om mitt lag vinner och Rögle förlorar?"*

---

## 🗄️ AIRTABLE DATASTRUKTUR

### Base Information
- **Airtable Base:** SHL-data (exakt Base ID finns i konfiguration)
- **API Access:** Bearer token för autentisering
- **Paginering:** Krävs för Matches (289 records > 100 limit)

### Tabell 1: `Teams` (14 lag)
```javascript
// Fält struktur:
{
  id: "rec123...",
  fields: {
    "Lag": "Frölunda HC",           // Lagnamn
    "Stad": "Göteborg",             // Hemmastad  
    "Färg": "#FF0000",              // Primärfärg
    // Andra metadata...
  }
}
```

### Tabell 2: `Team_Stats` (säsongsstatistik)
```javascript
// KRITISK fältmappning:
{
  id: "rec456...", 
  fields: {
    "Teams": ["recTeamId123"],               // Link till Teams-tabell
    "name (from Teams)": ["Frölunda HC"],   // Computed field från Teams
    "games": 15,                             // Spelade matcher
    "wins": 12,                              // Vinster ordinarie  
    "overtime_wins": 0,                      // Vinster övertid/SO
    "losses": 2,                             // Förluster ordinarie
    "overtime_losses": 1,                    // Förluster övertid/SO  
    "goals_for": 49,                         // Gjorda mål
    "goals_against": 19,                     // Insläppta mål
    "goal_difference": 30,                   // Målskillnad (+/-)
    "points": 36,                            // Totala poäng
    "season": "2024/25"                      // Säsong
  }
}
```

### Tabell 3: `Matches` (289 matcher)
```javascript
// Matchdata struktur:
{
  id: "rec789...",
  fields: {
    "home_team": "Frölunda HC",         // Hemmalag
    "away_team": "Rögle BK",           // Bortalag  
    "match_date": "2025-10-28",        // Datum
    "home_score": null,                // Hemmaresultat (null = ej spelad)
    "away_score": null,                // Bortaresultat (null = ej spelad)
    "overtime": false,                 // Övertid/Straffar boolean
    "finished": false,                 // Match avslutad boolean
    "round": 7                         // Omgång nummer
  }
}
```

---

## 🔗 API-KOPPLINGAR OCH FALLBACK-SYSTEM

### Primär Backend: Node.js (server.js)
```javascript
// Endpoint: /api/team-stats  
app.get('/api/team-stats', async (req, res) => {
  // Hämtar från Airtable Team_Stats
  // Returnerar: {success: true, data: [...]}
});

// Endpoint: /api/matches
app.get('/api/matches', async (req, res) => {
  // Paginering för 289 matcher:
  let allRecords = [];
  let offset = '';
  do {
    const batch = await airtable.get(`?offset=${offset}&maxRecords=100`);
    allRecords = allRecords.concat(batch.records);
    offset = batch.offset;
  } while (offset);
});
```

### Fallback System: PHP (api-matches.php)
```php
// Backup när Node.js inte tillgänglig
$response = file_get_contents("https://api.airtable.com/v0/{$baseId}/Matches", [
  'http' => [
    'header' => "Authorization: Bearer {$apiKey}"
  ]
]);
return json_encode(['success' => true, 'data' => $data]);
```

### Frontend API Requests (shl-simulator-backend.js)
```javascript
async apiRequest(endpoint) {
  // 1. Försök PHP fallback först (för matches)
  if (endpoint === 'matches') {
    const phpResponse = await fetch('api-matches.php');
  }
  
  // 2. Direktaccess till Airtable med paginering  
  if (this.CONFIG?.airtable?.apiKey) {
    let allRecords = [];
    let offset = '';
    do {
      const url = `https://api.airtable.com/v0/${baseId}/${table}?offset=${offset}`;
      const batch = await fetch(url, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      allRecords = allRecords.concat(batch.records);
      offset = batch.offset;
    } while (offset);
  }
  
  // 3. Fallback till demo-data
  return this.getDemoData(endpoint);
}
```

---

## ⚙️ KONFIGURATIONSHANTERING

### Backend Konfiguration (.env)
```bash
# Airtable credentials
AIRTABLE_API_KEY=keyXXXXXXXXXXXXXX
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX

# Google OAuth
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com  
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxx

# Server
PORT=3000
```

### Frontend Config Loading
```javascript
async loadConfig() {
  try {
    // Försök ladda från backend
    const response = await fetch(`${this.API_BASE_URL}/api/config`);
    this.CONFIG = await response.json();
  } catch (error) {
    // Fallback till localStorage om backend otillgänglig
    const saved = localStorage.getItem('airtable_config');
    this.CONFIG = saved ? JSON.parse(saved) : { airtable: { apiKey: 'demo_mode' }};
  }
}
```

---

## 🎮 SIMULATOR LOGIK & DATAFLÖDE

### Nuvarande Kloning-Arkitektur
```javascript
class SHLSimulator {
  constructor() {
    // IMMUTABLE originaldata från Airtable
    this.originalTeamStats = [];  // RÖR ALDRIG DENNA!
    
    // MUTABLE arbetskopia för simulering
    this.currentTeamStats = [];   // Klona från original
    
    // Övrig data
    this.teams = [];              // Lagnamn från Teams-tabell
    this.matches = [];            // 289 matcher från Matches-tabell
  }
  
  // KRITISK: Initial dataladdning
  async loadTeamStatsData() {
    const response = await this.apiRequest('team-stats');
    
    // Spara ORIGINAL (rör aldrig)
    this.originalTeamStats = response.data.map(record => {
      // KRITISK namn-mappning från Airtable
      let teamName = 'Okänt lag';
      if (record.fields["name (from Teams)"]) {
        teamName = Array.isArray(record.fields["name (from Teams)"]) 
          ? record.fields["name (from Teams)"][0]
          : record.fields["name (from Teams)"];
      }
      
      return {
        id: record.id,
        teamId: record.fields.Teams?.[0],
        name: teamName,                    // KRITISKT för simulator
        games: Number(record.fields.games) || 0,
        wins: Number(record.fields.wins) || 0,
        overtime_wins: Number(record.fields.overtime_wins) || 0,
        losses: Number(record.fields.losses) || 0, 
        overtime_losses: Number(record.fields.overtime_losses) || 0,
        goals_for: Number(record.fields.goals_for) || 0,
        goals_against: Number(record.fields.goals_against) || 0,
        goal_difference: Number(record.fields.goal_difference) || 0,
        points: Number(record.fields.points) || 0  // KRITISKT för simulator
      };
    });
    
    // Klona för arbetskopia
    this.cloneOriginalData();
  }
}
```

### Simulering Workflow
```javascript
// 1. USER INPUT → handleScoreInput()
handleScoreInput(inputElement) {
  const homeScore = parseInt(homeInput.value);
  const awayScore = parseInt(awayInput.value);
  
  if (homeScore !== null && awayScore !== null) {
    // 2. FRESH START → cloneOriginalData()
    this.cloneOriginalData();
    
    // 3. ADD POINTS → addPointsToTeam()  
    if (homeScore > awayScore) {
      this.addPointsToTeam(homeTeam, 3, 'ordinarie vinst');
    }
    
    // 4. RENDER → renderTableFromCurrentData()
    this.renderTableFromCurrentData();
  }
}

// KLONING: Fräsch kopia varje gång
cloneOriginalData() {
  this.currentTeamStats = this.originalTeamStats.map(team => ({
    ...team,  // Kopiera alla egenskaper
    // Säkerställ numeriska värden
    points: Number(team.points) || 0
  }));
}

// POÄNG: Lägg till på arbetskopia
addPointsToTeam(teamName, points) {
  const team = this.currentTeamStats.find(t => t.name === teamName);
  team.points += points;
  
  // Uppdatera vinster för sortering
  if (points === 3) team.wins += 1;
  else if (points === 2) team.overtime_wins += 1;
}
```

---

## 🎨 CSS LAYOUT & PROPORTIONER

### Grid Layout (css/simulator.css)
```css
.simulator-container {
  display: grid;
  grid-template-columns: 1fr 320px;  /* SHL-tabell bred, matchlista 320px */
  gap: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.shl-table-container {
  /* Vänster kolumn - tar upp resterande plats */
  background: white;
  border-radius: 8px;
  overflow: hidden;
}

.matches-container {  
  /* Höger kolumn - fast 320px bredd */
  background: #e3f2fd;
  padding: 20px;
  border-radius: 8px;
}
```

### Tabellstyling
```css
.shl-table {
  width: 100%;
  border-collapse: collapse;
  font-family: 'Roboto', sans-serif;
}

.shl-table th {
  background: #dc2626;  /* SHL röd */
  color: white;
  padding: 12px 8px;
  text-align: center;
}

.shl-table td:last-child {
  background: #dc2626;  /* Poäng-kolumn röd */
  color: white;
  font-weight: bold;
}
```

---

## 📊 SHL POÄNGSYSTEM & SORTERING

### Poängregler (officiella SHL)
```javascript
// Ordinarie tid (60 min)
if (homeScore > awayScore && resultType === 'regular') {
  homeTeam.points += 3;  // Vinnare får 3p
  awayTeam.points += 0;  // Förlorare får 0p
}

// Övertid/Straffläggning  
if (homeScore > awayScore && resultType !== 'regular') {
  homeTeam.points += 2;  // Vinnare får 2p
  awayTeam.points += 1;  // Förlorare får 1p (tröstpoäng)
}
```

### Tabellsortering (officiell SHL-ordning)
```javascript
sortedStats.sort((a, b) => {
  // 1. Poäng (högst först)
  if (b.points !== a.points) return b.points - a.points;
  
  // 2. Målskillnad (bäst först)  
  if (b.goal_difference !== a.goal_difference) 
    return b.goal_difference - a.goal_difference;
    
  // 3. Gjorda mål (flest först)
  if (b.goals_for !== a.goals_for) 
    return b.goals_for - a.goals_for;
    
  // 4. Alfabetisk som sista utväg
  return a.name.localeCompare(b.name);
});
```

---

## 🚀 DEPLOYMENT & INFRASTRUKTUR

### GitHub Actions Workflow (.github/workflows/)
```yaml
# Staging deployment (tabell-dev)
name: Deploy to Staging
on:
  push:
    branches: [main]
    
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: FTP Deploy
        uses: SamKirkland/FTP-deploy-action@4.0.0
        with:
          server: ${{ secrets.FTP_SERVER }}
          username: ${{ secrets.FTP_USERNAME }}  
          password: ${{ secrets.FTP_PASSWORD }}
```

### Miljöer
- **Staging:** `https://tabell.top/shl-simulator` (tabell-dev repo)
- **Production:** `https://tabell.top/` (tabell-live repo) 
- **Backend:** Node.js på port 3000 med PM2
- **Database:** Airtable Cloud

---

## ❌ HISTORISKA PROBLEM & LÖSNINGSFÖRSÖK

### Problem 1: Lagnamn undefined
```javascript
// SYMPTOM: console.log → "rec123: undefined"
// ORSAK: Fel Airtable-fältmappning
// LÖSNING: Korrekt mappning av "name (from Teams)"

// FÖRE (fel):
name: record.fields.name 

// EFTER (rätt):  
name: record.fields["name (from Teams)"][0]
```

### Problem 2: Duplicerade poäng
```javascript  
// SYMPTOM: 18p → 21p → 24p → 27p vid samma input
// ORSAK: handleScoreInput anropas flera gånger
// LÖSNING: Kloning-system (fresh start varje gång)

// FÖRE (fel):
team.points += 3; // Adderar på tidigare värde

// EFTER (rätt):
this.cloneOriginalData(); // Fresh start
team.points += 3; // Adderar på original
```

### Problem 3: Fel vinnare
```javascript
// SYMPTOM: Rögle 1-3 Frölunda → Rögle får poäng
// ORSAK: awayScore var null trots input "3"
// LÖSNING: Bättre score-parsing

// FÖRE (fel):
const score = input.value ? parseInt(input.value) : null;

// EFTER (rätt):
const score = input.value !== '' ? parseInt(input.value) : null;
```

---

## 🔧 NUVARANDE STATUS & AKUT PROBLEM

### Senaste Implementation: Kloning-systemet
- ✅ **Arkitektur:** originalTeamStats (immutable) + currentTeamStats (mutable)
- ✅ **Workflow:** Clone → Add Points → Render
- ❌ **Problem:** Tom tabell efter implementation

### Debug Status (senaste commit)
```javascript
// Senaste debug-meddelanden:
📊 DATA STATUS: {originalTeamStats: ?, currentTeamStats: ?, teamStats: ?}
✅ ORIGINAL TEAM STATS sparad: X lag  
✅ CURRENT TEAM STATS klonad för simulering
```

### Troliga Orsaker till Tom Tabell
1. **Initial setup:** `originalTeamStats` fylls aldrig
2. **Timing:** `renderTable` körs innan data laddats  
3. **Reference:** `renderTable` letar i fel data-array
4. **Airtable:** API-anrop misslyckas tyst

---

## 🧪 TIDIGARE LÖSNINGSFÖRSÖK

### Försök 1: Komplex recalculateAllStats
**Approach:** Spara original → räkna om ALLT från scratch → sortera  
**Problem:** Aldrig anropad, komplex debug-loop  
**Resultat:** Ingen simulering alls

### Försök 2: Direkt poängaddition  
**Approach:** Hitta lag direkt → lägg till poäng → rendera  
**Problem 1:** Duplicerade anrop (18p→21p→24p→27p)  
**Problem 2:** Fel lagnamn (awayScore = null)  
**Problem 3:** Fel vinnare (Rögle fick poäng istället för Frölunda)  

### Försök 3: Förbättringar
**Approach:** Duplicate prevention med Set, bättre score-parsing, kräva båda scores  
**Resultat:** Ingenting händer alls (blockering)

### Försök 4: Kloning-systemet (NUVARANDE)
**Approach:** originalTeamStats (immutable) + currentTeamStats (mutable)  
**Status:** Implementerat men ger tom tabell  
**Nästa:** Debug initial setup

---

## 🎯 BRAINSTORMING ALTERNATIV

Vid design av kloning-systemet övervägdes dessa alternativ:

1. 📋 **Klona tabellen** (VALD) - kopiera originaldata för simulering
2. 🎯 **Event-driven system** - lyssna på alla ändringar
3. 🔄 **React-liknande state management** - centraliserad state
4. 📊 **Direkt DOM-manipulation** - uppdatera DOM direkt
5. 🧮 **Funktionell approach** - ren funktionell beräkning

Kloning valdes för dess enkelhet och förutsägbarhet.

---

## 📋 NÄSTA STEG & PRIORITERINGAR

### Akut (Tom tabell)
1. 🔍 **Debug initial data loading** - varför fylls inte originalTeamStats?
2. 🔧 **Fixa renderTable data-referens** - pekar den på rätt array?
3. ✅ **Testa basic rendering** - fungerar tabellen utan simulering?

### Core Funktionalitet 
1. 🏒 **Örebro HK test** - 18p + 3p = 21p grundfunktion
2. 🔄 **Reset-funktionalitet** - återställ till original
3. 🎯 **Multi-match simulering** - flera matcher samtidigt

### Kvalitetssäkring
1. 📊 **Korrekt SHL-poängberäkning** - följ officiella regler
2. 🏆 **Tabellsortering** - poäng → målskillnad → gjorda mål
3. 🎨 **Layout proportioner** - SHL-tabell bred, matchlista smal (1fr 320px)

---

## 📁 FILSTRUKTUR

```
/Volumes/home/Kodning/SHL-V2/
├── js/
│   └── shl-simulator-backend.js     # Huvudlogik (1134+ rader)
├── css/
│   └── simulator.css                # Layout & styling  
├── backend/
│   └── server.js                    # Node.js API server
├── api-matches.php                  # PHP fallback
├── PROJECT_STATUS.md                # Äldre dokumentation
├── PROJEKT_DOKUMENTATION.md        # Denna fil
└── .github/workflows/              # GitHub Actions deployment
```

---

## 🔑 KRITISKA TAKEAWAYS

1. **Airtable-mappning är känslig** - fältnamn måste vara exakta
2. **Paginering krävs** - 289 matcher > 100 records limit  
3. **Kloning förhindrar side-effects** - fresh start varje simulering
4. **Fallback-system är essentiellt** - PHP backup när Node.js failar
5. **Debug-first approach** - logga ALLT för att förstå dataflödet

**Denna dokumentation innehåller ALLT för att återstarta utvecklingen från vilken punkt som helst!** 🚀

---

*Senast uppdaterad: 28 oktober 2025*  
*Status: Tom tabell efter kloning-implementation - behöver debug*