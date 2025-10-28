const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const bodyParser = require('body-parser');
const cors = require('cors');
const session = require('express-session');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Google OAuth Client
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Airtable Configuration
const AIRTABLE_CONFIG = {
    apiKey: process.env.AIRTABLE_API_KEY,
    baseId: process.env.AIRTABLE_BASE_ID,
    apiUrl: 'https://api.airtable.com/v0'
};

// Authorized emails
const AUTHORIZED_EMAILS = (process.env.AUTHORIZED_EMAILS || '').split(',').map(email => email.trim());

console.log('🚀 Starting SHL Simulator Backend...');
console.log('📧 Authorized emails:', AUTHORIZED_EMAILS);

// Middleware
app.use(cors({
    origin: [
        process.env.FRONTEND_URL || 'http://localhost:3000',
        'http://localhost:8000', // För Python HTTP server
        'https://thesweetening.github.io' // För staging
    ],
    credentials: true
}));

app.use(bodyParser.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 4 * 60 * 60 * 1000 // 4 hours
    }
}));

// Middleware för att kontrollera autentisering
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({
            success: false,
            message: 'Autentisering krävs'
        });
    }
    next();
};

// Utility function för Airtable API-anrop
const airtableRequest = async (endpoint, options = {}) => {
    const url = `${AIRTABLE_CONFIG.apiUrl}/${AIRTABLE_CONFIG.baseId}/${endpoint}`;
    
    const config = {
        headers: {
            'Authorization': `Bearer ${AIRTABLE_CONFIG.apiKey}`,
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    };

    try {
        const response = await axios(url, config);
        return response.data;
    } catch (error) {
        console.error('Airtable API Error:', error.response?.data || error.message);
        throw new Error(error.response?.data?.error?.message || 'Airtable API fel');
    }
};

// Routes

// Health check
app.get('/', (req, res) => {
    res.json({
        message: '🏒 SHL Simulator Backend',
        status: 'running',
        timestamp: new Date().toISOString()
    });
});

// Säker konfiguration för frontend (endast publika värden)
app.get('/api/auth/config', (req, res) => {
    // Endast säkra konfigurationsvärden som kan exponeras
    res.json({
        googleClientId: process.env.GOOGLE_CLIENT_ID,
        // Lägg till andra publika config-värden här om behövs
        environment: process.env.NODE_ENV || 'development'
    });
});

// Google OAuth Authentication
app.post('/api/auth/google', async (req, res) => {
    const { idToken } = req.body;

    if (!idToken) {
        return res.status(400).json({
            success: false,
            message: 'ID Token krävs'
        });
    }

    try {
        // Verifiera ID-token med Google
        const ticket = await client.verifyIdToken({
            idToken: idToken,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const email = payload.email;

        console.log(`🔐 OAuth försök från: ${email}`);

        // Kontrollera om användaren är auktoriserad
        if (!AUTHORIZED_EMAILS.includes(email)) {
            console.log(`❌ Otillåten användare: ${email}`);
            return res.status(403).json({
                success: false,
                message: 'Du har inte behörighet att komma åt denna applikation'
            });
        }

        // Skapa session
        req.session.user = {
            email: email,
            name: payload.name,
            picture: payload.picture,
            loginTime: new Date().toISOString()
        };

        console.log(`✅ Användare inloggad: ${email}`);

        res.json({
            success: true,
            message: 'Inloggning lyckades',
            user: req.session.user
        });

    } catch (error) {
        console.error('OAuth Error:', error);
        res.status(401).json({
            success: false,
            message: 'Ogiltig token'
        });
    }
});

// Kontrollera session status
app.get('/api/auth/status', (req, res) => {
    if (req.session.user) {
        res.json({
            authenticated: true,
            user: req.session.user
        });
    } else {
        res.json({
            authenticated: false
        });
    }
});

// Logga ut
app.post('/api/auth/logout', (req, res) => {
    if (req.session.user) {
        console.log(`👋 Användare utloggad: ${req.session.user.email}`);
    }
    
    req.session.destroy((err) => {
        if (err) {
            console.error('Session destroy error:', err);
        }
        res.json({ success: true, message: 'Utloggad' });
    });
});

// Säkra API endpoints för Airtable data

// Hämta lag (Teams)
app.get('/api/teams', requireAuth, async (req, res) => {
    try {
        console.log('📥 Hämtar Teams data...');
        const data = await airtableRequest('Teams');
        res.json({
            success: true,
            data: data.records
        });
    } catch (error) {
        console.error('Error fetching teams:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Hämta lagstatistik (Team_Stats)
app.get('/api/team-stats', requireAuth, async (req, res) => {
    try {
        console.log('📊 Hämtar Team_Stats data...');
        const data = await airtableRequest('Team_Stats?sort%5B0%5D%5Bfield%5D=points&sort%5B0%5D%5Bdirection%5D=desc');
        res.json({
            success: true,
            data: data.records
        });
    } catch (error) {
        console.error('Error fetching team stats:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Hämta matcher
app.get('/api/matches', requireAuth, async (req, res) => {
    try {
        console.log('🎯 Hämtar Matches data...');
        
        // Hämta ALLA matcher från Matches-tabellen med paginering för att få alla 289 records
        let allRecords = [];
        let offset = '';
        
        do {
            const endpoint = `Matches?sort%5B0%5D%5Bfield%5D=match_date&sort%5B0%5D%5Bdirection%5D=asc&maxRecords=100${offset ? '&offset=' + offset : ''}`;
            console.log(`📄 Hämtar batch från: ${endpoint}`);
            const batchData = await airtableRequest(endpoint);
            
            allRecords = allRecords.concat(batchData.records);
            offset = batchData.offset;
            
            console.log(`📊 Hämtat ${allRecords.length} av totalt ~289 matches...`);
        } while (offset);
        
        console.log(`✅ Hämtade totalt ${allRecords.length} matcher från Matches-tabellen`);
        
        const data = { records: allRecords };
        
        res.json({
            success: true,
            data: data.records
        });
    } catch (error) {
        console.error('Error fetching matches:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Uppdatera matchtider (UTC till svensk tid)
app.post('/api/matches/update-times', requireAuth, async (req, res) => {
    try {
        console.log('🕐 Uppdaterar matchtider...');
        
        // Hämta alla matcher med UTC-tider som behöver uppdateras
        const matches = await airtableRequest('Matches?maxRecords=300');
        
        const updates = [];
        const timeMapping = {
            '18:00': '19:00',
            '17:00': '18:00', 
            '14:15': '15:15'
        };

        // Uppdatera i omvänd ordning för att undvika dubbeluppdateringar
        const sortedTimes = Object.keys(timeMapping).sort().reverse();
        
        for (const utcTime of sortedTimes) {
            const swedishTime = timeMapping[utcTime];
            
            const matchesToUpdate = matches.records.filter(record => 
                record.fields.match_time === utcTime
            );

            for (const match of matchesToUpdate) {
                updates.push({
                    id: match.id,
                    fields: {
                        match_time: swedishTime
                    }
                });
            }
        }

        console.log(`Uppdaterar ${updates.length} matcher...`);

        // Batch-uppdatering (max 10 åt gången för Airtable)
        const batchSize = 10;
        let updated = 0;

        for (let i = 0; i < updates.length; i += batchSize) {
            const batch = updates.slice(i, i + batchSize);
            
            await airtableRequest('Matches', {
                method: 'PATCH',
                data: { records: batch }
            });
            
            updated += batch.length;
            console.log(`Uppdaterade ${updated}/${updates.length} matcher`);
        }

        res.json({
            success: true,
            message: `Uppdaterade ${updated} matchtider från UTC till svensk tid`,
            updated: updated
        });

    } catch (error) {
        console.error('Error updating match times:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Importera matchdata (placeholder för framtida funktionalitet)
app.post('/api/matches/import', requireAuth, async (req, res) => {
    try {
        console.log('📥 Importfunktion anropad...');
        
        res.json({
            success: true,
            message: 'Import-funktionalitet kommer snart',
            note: 'Använd befintliga import-verktyg tills vidare'
        });

    } catch (error) {
        console.error('Error importing matches:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({
        success: false,
        message: 'Internt serverfel'
    });
});

// Sätt matchresultat
app.post('/api/matches/:id/result', requireAuth, async (req, res) => {
    try {
        const matchId = req.params.id;
        const { homeScore, awayScore, resultType } = req.body;

        console.log(`🏒 Sätter resultat för match ${matchId}: ${homeScore}-${awayScore} (${resultType})`);

        // Validering
        if (homeScore === null || homeScore === undefined) {
            return res.status(400).json({ success: false, message: 'Hemmalags-mål saknas' });
        }
        if (awayScore === null || awayScore === undefined) {
            return res.status(400).json({ success: false, message: 'Bortalags-mål saknas' });
        }
        if (homeScore === awayScore) {
            return res.status(400).json({ success: false, message: 'Matcher kan inte sluta oavgjort i SHL' });
        }

        // Uppdatera match i Airtable
        const matchUpdate = {
            records: [{
                id: matchId,
                fields: {
                    home_goals: parseInt(homeScore),
                    away_goals: parseInt(awayScore),
                    finished: true,
                    result_type: resultType || 'regulation'
                }
            }]
        };

        await airtableRequest('Matches', {
            method: 'PATCH',
            data: matchUpdate
        });

        console.log(`✅ Match ${matchId} resultat sparat: ${homeScore}-${awayScore}`);

        res.json({
            success: true,
            message: `Matchresultat sparat: ${homeScore}-${awayScore}`,
            match: {
                id: matchId,
                homeScore: parseInt(homeScore),
                awayScore: parseInt(awayScore),
                resultType: resultType || 'regulation',
                finished: true
            }
        });

    } catch (error) {
        console.error('Error saving match result:', error);
        res.status(500).json({
            success: false,
            message: 'Kunde inte spara matchresultat: ' + error.message
        });
    }
});

// Hämta dagens matcher för admin-panel
app.get('/api/matches/today', requireAuth, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        console.log(`📅 Hämtar matcher för ${today}`);

        const endpoint = `Matches?filterByFormula=IS_SAME(match_date%2C'${today}')&sort%5B0%5D%5Bfield%5D=match_time&sort%5B0%5D%5Bdirection%5D=asc`;
        const data = await airtableRequest(endpoint);

        res.json({
            success: true,
            data: data.records,
            date: today,
            count: data.records.length
        });

    } catch (error) {
        console.error('Error fetching today matches:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint hittades inte'
    });
});

// Start server
app.listen(port, () => {
    console.log(`🚀 SHL Simulator Backend körs på port ${port}`);
    console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
    console.log(`🔐 Google Client ID: ${process.env.GOOGLE_CLIENT_ID ? '✅ Konfigurerat' : '❌ Saknas'}`);
    console.log(`🗃️ Airtable: ${process.env.AIRTABLE_API_KEY ? '✅ Konfigurerat' : '❌ Saknas'}`);
});

module.exports = app;