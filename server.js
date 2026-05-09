// ============================================
// Muzan-MD - Serveur Backend Pair Generator
// Développé par Joyboy ☀️
// Version: 2.0
// ============================================

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// ========== INITIALISATION ==========
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Stockage temporaire des sessions (en mémoire)
// ⚠️ En production, utilise une base de données (MongoDB, PostgreSQL, etc.)
const tempSessions = new Map();
const pairCodes = new Map();

// ========== FONCTIONS UTILITAIRES ==========

// Générer un code unique
function generatePairCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    code += '-';
    for (let i = 0; i < 4; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

// Générer une session ID unique
function generateSessionId(phoneNumber, countryCode, code) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const cleanCode = code.replace('-', '');
    return `MUZAN_${cleanCode}_${countryCode}${phoneNumber}_${timestamp}_${random}`;
}

// Valider le numéro de téléphone
function validatePhoneNumber(number, countryCode) {
    const cleanNumber = number.replace(/\D/g, '');
    if (cleanNumber.length < 8 || cleanNumber.length > 15) {
        return false;
    }
    return true;
}

// ========== ROUTES API ==========

// Route d'accueil
app.get('/', (req, res) => {
    res.json({
        name: 'Muzan-MD Pair Generator API',
        version: '2.0',
        developer: 'Joyboy ☀️',
        status: 'online',
        endpoints: [
            'POST /api/generate - Générer un code de pairage',
            'POST /api/verify - Vérifier le code',
            'GET /api/status/:code - Statut d\'un code',
            'POST /api/session - Récupérer une session',
            'GET /api/health - Vérification santé'
        ]
    });
});

// Route santé
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        activeSessions: tempSessions.size,
        activePairs: pairCodes.size
    });
});

// 1. Générer un code de pairage
app.post('/api/generate', (req, res) => {
    const { phoneNumber, countryCode } = req.body;
    
    // Vérifications
    if (!phoneNumber || !countryCode) {
        return res.status(400).json({
            success: false,
            error: 'Numéro de téléphone et code pays requis'
        });
    }
    
    if (!validatePhoneNumber(phoneNumber, countryCode)) {
        return res.status(400).json({
            success: false,
            error: 'Numéro de téléphone invalide (8-15 chiffres)'
        });
    }
    
    // Générer un code unique
    const pairCode = generatePairCode();
    const fullNumber = `${countryCode}${phoneNumber}`;
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
    
    // Stocker le code
    pairCodes.set(pairCode, {
        phoneNumber: fullNumber,
        createdAt: Date.now(),
        expiresAt: expiresAt,
        verified: false,
        sessionId: null
    });
    
    // Supprimer automatiquement après expiration
    setTimeout(() => {
        if (pairCodes.has(pairCode) && !pairCodes.get(pairCode).verified) {
            pairCodes.delete(pairCode);
            console.log(`🗑️ Code expiré supprimé: ${pairCode}`);
        }
    }, 5 * 60 * 1000);
    
    console.log(`🌙 Code généré: ${pairCode} pour ${fullNumber}`);
    
    res.json({
        success: true,
        code: pairCode,
        expiresIn: 300, // secondes
        message: 'Code généré avec succès'
    });
});

// 2. Vérifier un code (simule la connexion WhatsApp)
app.post('/api/verify', (req, res) => {
    const { code } = req.body;
    
    if (!code) {
        return res.status(400).json({
            success: false,
            error: 'Code requis'
        });
    }
    
    const pairData = pairCodes.get(code);
    
    if (!pairData) {
        return res.status(404).json({
            success: false,
            error: 'Code invalide ou expiré'
        });
    }
    
    if (pairData.expiresAt < Date.now()) {
        pairCodes.delete(code);
        return res.status(410).json({
            success: false,
            error: 'Code expiré'
        });
    }
    
    if (pairData.verified) {
        return res.json({
            success: true,
            verified: true,
            sessionId: pairData.sessionId
        });
    }
    
    // Ici, dans la vraie version, on attendrait la confirmation WhatsApp
    // Pour la simulation, on marque comme vérifié après un délai
    setTimeout(() => {
        if (pairCodes.has(code) && !pairCodes.get(code).verified) {
            const sessionId = generateSessionId(
                pairData.phoneNumber.slice(-9),
                pairData.phoneNumber.slice(0, -9),
                code
            );
            
            pairData.verified = true;
            pairData.sessionId = sessionId;
            pairData.verifiedAt = Date.now();
            
            // Sauvegarder la session
            tempSessions.set(sessionId, {
                phoneNumber: pairData.phoneNumber,
                code: code,
                createdAt: Date.now()
            });
            
            console.log(`✅ Session créée: ${sessionId}`);
        }
    }, 3000);
    
    res.json({
        success: true,
        message: 'Vérification en cours...',
        status: 'pending'
    });
});

// 3. Obtenir le statut d'un code
app.get('/api/status/:code', (req, res) => {
    const { code } = req.params;
    const pairData = pairCodes.get(code);
    
    if (!pairData) {
        return res.json({
            exists: false,
            verified: false,
            expired: true
        });
    }
    
    const expired = pairData.expiresAt < Date.now();
    
    res.json({
        exists: true,
        verified: pairData.verified,
        expired: expired,
        sessionId: pairData.verified ? pairData.sessionId : null,
        expiresIn: Math.max(0, Math.floor((pairData.expiresAt - Date.now()) / 1000))
    });
});

// 4. Récupérer une session par son ID
app.get('/api/session/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = tempSessions.get(sessionId);
    
    if (!session) {
        return res.status(404).json({
            success: false,
            error: 'Session introuvable'
        });
    }
    
    res.json({
        success: true,
        sessionId: sessionId,
        phoneNumber: session.phoneNumber,
        createdAt: session.createdAt
    });
});

// 5. Supprimer une session (déconnexion)
app.delete('/api/session/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    
    if (tempSessions.has(sessionId)) {
        tempSessions.delete(sessionId);
        res.json({
            success: true,
            message: 'Session supprimée'
        });
    } else {
        res.status(404).json({
            success: false,
            error: 'Session introuvable'
        });
    }
});

// 6. Nettoyer les sessions expirées (toutes les heures)
setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [code, data] of pairCodes.entries()) {
        if (data.expiresAt < now && !data.verified) {
            pairCodes.delete(code);
            cleaned++;
        }
    }
    
    if (cleaned > 0) {
        console.log(`🧹 Nettoyage: ${cleaned} codes expirés supprimés`);
    }
}, 60 * 60 * 1000);

// ========== STATISTIQUES ==========
app.get('/api/stats', (req, res) => {
    const now = Date.now();
    let activeCodes = 0;
    let verifiedCodes = 0;
    
    for (const data of pairCodes.values()) {
        if (data.expiresAt > now) activeCodes++;
        if (data.verified) verifiedCodes++;
    }
    
    res.json({
        totalSessions: tempSessions.size,
        activePairCodes: activeCodes,
        verifiedToday: verifiedCodes,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// ========== GESTION DES ERREURS ==========
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route non trouvée'
    });
});

app.use((err, req, res, next) => {
    console.error('Erreur serveur:', err);
    res.status(500).json({
        success: false,
        error: 'Erreur interne du serveur'
    });
});

// ========== DÉMARRAGE ==========
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║     🌙 MUZAN-MD PAIR GENERATOR API 🌙                    ║
║                                                          ║
║     Serveur démarré sur le port: ${PORT}                     ║
║     API disponible sur: http://localhost:${PORT}           ║
║                                                          ║
║     Développé par: Joyboy ☀️                             ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
    `);
    
    console.log('\n📋 Endpoints disponibles:');
    console.log('   GET  /            - Documentation');
    console.log('   GET  /api/health  - Vérification santé');
    console.log('   POST /api/generate - Générer un code');
    console.log('   POST /api/verify   - Vérifier un code');
    console.log('   GET  /api/status/:code - Statut code');
    console.log('   GET  /api/session/:id - Récupérer session');
    console.log('   GET  /api/stats    - Statistiques\n');
});

// Export pour tests
module.exports = app;
