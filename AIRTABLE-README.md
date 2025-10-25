# SHL Airtable Integration 🏒

Automatisk import av SHL-matchdata till Airtable med koppling till befintliga lag.

## 🚀 Snabbstart

### 1. Konfigurera Airtable

1. Skapa en **Personal Access Token** i Airtable:
   - Gå till https://airtable.com/create/tokens
   - Klicka "Create new token"
   - Ge token namnet "SHL Simulator"
   - Välj scope: `data.records:read` och `data.records:write`
   - Lägg till din SHL-Simulatorn 2 base

2. Hitta ditt **Base ID**:
   - Öppna din Airtable base
   - Gå till Help → API documentation
   - Base ID börjar med `app...`

### 2. Konfigurera applikationen

Redigera `.env` filen och lägg in dina uppgifter:

```bash
# Airtable Personal Access Token
AIRTABLE_API_KEY=pat1234567890abcdef...

# Airtable Base ID
AIRTABLE_BASE_ID=appABC123DEF456...

# Tabell-namn (ändra om du har andra namn)
TEAMS_TABLE=Teams
MATCHES_TABLE=Matches
TEAM_STATS_TABLE=Team_Stats
```

### 3. Kör importen

**Alternativ A: Använd admin-panelen (rekommenderas)**
1. Öppna `airtable-admin.html` i din webbläsare
2. Fyll i API-nyckel och Base-ID
3. Klicka "Testa Anslutning"
4. Klicka "Importera Matcher" när anslutningen fungerar

**Alternativ B: Kör direkt i JavaScript**
```javascript
// Ladda och kör importen
await SHLImporter.importSHLMatches();
```

## 📋 Förutsättningar

### Airtable-tabeller som måste finnas:

1. **Teams** - Innehåller alla 14 SHL-lag
   - Fält: `team_name` eller `name` (använt för matchning)
   - Exempel: "Färjestad BK", "Frölunda HC", etc.

2. **Matches** - Tom tabell där matcher importeras
   - Kommer att fyllas med:
     - `match_id` - Unik identifierare
     - `date` - Matchdatum
     - `time` - Matchtid
     - `home_team` - Länk till Teams (hemmalag)
     - `away_team` - Länk till Teams (bortalag)
     - `arena` - Spelplats
     - `status` - "Scheduled", "Live", "Finished", etc.
     - `round` - Omgång (1-52)
     - `season` - Säsong (ex: "2024-2025")

### CSV-data som läses:

- `matches.csv` - 289 SHL-matcher extraherade från officiell kalender
- Alla lagnamn måste matcha exakt med namnen i Airtable Teams-tabellen

## 🔧 Funktioner

### Intelligent matchning
- Kopplar automatiskt hemma/bortaslag till befintliga Teams-records
- Kontrollerar duplicerade matcher (skippar om `match_id` redan finns)
- Validerar att alla lagnamn finns i databasen

### Batch-import
- Importerar matcher i säkra batches (10 per anrop)
- Automatisk fördröjning mellan anrop för att respektera API-begränsningar
- Detaljerad loggning och felhantering

### Säkerhet
- API-nycklar lagras säkert i `.env` (aldrig i version control)
- Validering av alla indata innan import
- Graceful error handling med detaljerade felmeddelanden

## 📊 Dataflöde

```
SHL ICS Kalender → parse_ics.py → matches.csv → Airtable Importer → Airtable Matches
                                                       ↓
Teams (befintliga records) ←─────────────────── Länkning via team_name
```

## 🐛 Felsökning

### "Kunde inte hitta lag för match"
- Kontrollera att alla 14 SHL-lag finns i Teams-tabellen
- Verifiera att lagnamnen är exakt samma som i `matches.csv`:
  ```
  Färjestad BK, Frölunda HC, Växjö Lakers, Luleå Hockey,
  Djurgårdens IF, Skellefteå AIK, HV71, Rögle BK,
  Leksands IF, Linköping HC, Malmö Redhawks, Brynäs IF,
  Timrå IK, Örebro Hockey
  ```

### "API error 401"
- Kontrollera att Personal Access Token är korrekt
- Verifiera att token har rätt behörigheter för din base

### "API error 404"
- Kontrollera att Base-ID är korrekt
- Verifiera att tabellnamnen stämmer överens med dina Airtable-tabeller

### "Många fel/varningar"
- Kolla loggen för specifika felmeddelanden
- De vanligaste felen är lagnamn som inte matchar

## 📈 Nästa steg

Efter lyckad import kan du:

1. **Konfigurera formler** i Airtable för beräkning av:
   - Vinnare per match
   - Poäng för lagen
   - Tabellställning

2. **Skapa vyer** för:
   - Aktuella matcher
   - Tabellställning
   - Matchresultat per lag

3. **Utveckla webbapplikationen** som använder denna data för simulering

## 🔒 Säkerhet

- **Aldrig** commita `.env` till version control
- Håll Personal Access Token hemlig
- Överväg att rotera tokens regelbundet
- Använd HTTPS för alla API-anrop