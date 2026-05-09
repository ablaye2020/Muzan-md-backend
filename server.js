// ============================================
// MUZAN-MD - VRAI GÉNÉRATEUR DE SESSION
// Connexion réelle à WhatsApp
// Développé par Joyboy ☀️
// ============================================

const express = require('express');
const cors = require('cors');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const Pino = require('pino');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Servir les fichiers statiques (si tu mets le frontend ici)
app.use(express.static('public'));

// Stockage des sessions en cours
const activePairings = new Map();

// ========== FONCTION POUR CONNECTER WHATSAPP ==========
async function connectToWhatsApp(phoneNumber, pairingCode) {
    const sessionDir = path.join(__dirname, `sessions_${pairingCode}`);
    
    // Créer le dossier s'il n'existe pas
    if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
    }
    
    try {
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        
        const sock = makeWASocket({
            auth: state,
            logger: Pino({ level: 'silent' }),
            browser: ['Muzan-MD', 'Chrome', '1.0.0'],
            printQRInTerminal: false
        });
        
        // Écouter les événements de connexion
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            console.log(`📡 Statut connexion ${phoneNumber}: ${connection}`);
            
            if (connection === 'open') {
                console.log(`✅ WhatsApp CONNECTÉ pour ${phoneNumber}`);
                
                // Lire les credentials
                const credsFile = path.join(sessionDir, 'creds.json');
                if (fs.existsSync(credsFile)) {
                    const creds = JSON.parse(fs.readFileSync(credsFile, 'utf8'));
                    const sessionId = Buffer.from(JSON.stringify(creds)).toString('base64');
                    
                    activePairings.set(pairingCode, {
                        connected: true,
                        sessionId: sessionId,
                        phoneNumber: phoneNumber,
                        creds: creds,
                        connectedAt: Date.now()
                    });
                    
                    console.log(`🎉 SESSION GÉNÉRÉE pour ${phoneNumber}`);
                    console.log(`📋 Session ID: ${sessionId.substring(0, 50)}...`);
                }
            }
            
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log(`❌ Déconnecté pour ${phoneNumber}`);
                    activePairings.delete(pairingCode);
                }
            }
        });
        
        // Sauvegarder les credentials
        sock.ev.on('creds.update', saveCreds);
        
        // Démarrer le pairing code
        const cleanNumber = phoneNumber.replace(/\D/g, '');
        await sock.requestPairingCode(cleanNumber);
        console.log(`📱 Code de pairing envoyé à ${cleanNumber}`);
        
        return { success: true, message: 'Code envoyé avec succès' };
        
    } catch (error) {
        console.error('❌ Erreur:', error);
        return { success: false, error: error.message };
    }
}

// ========== API ENDPOINTS ==========

// Route d'accueil
app.get('/', (req, res) => {
    res.json({
        name: 'Muzan-MD Pair Generator API',
        version: '2.0',
        developer: 'Joyboy ☀️',
        status: 'online',
        message: 'API fonctionnelle ! Utilise /api/generate pour générer un code'
    });
});

// Générer un code de pairage (vrai)
app.post('/api/generate', async (req, res) => {
    const { phoneNumber, countryCode } = req.body;
    
    console.log(`📱 Requête reçue: ${countryCode}${phoneNumber}`);
    
    if (!phoneNumber || !countryCode) {
        return res.status(400).json({ 
            success: false, 
            error: 'Numéro et code pays requis' 
        });
    }
    
    const fullNumber = `${countryCode}${phoneNumber}`.replace(/\D/g, '');
    
    if (fullNumber.length < 10 || fullNumber.length > 15) {
        return res.status(400).json({ 
            success: false, 
            error: 'Numéro invalide' 
        });
    }
    
    // Générer un code unique
    const randomCode = Math.floor(10000000 + Math.random() * 90000000);
    const formattedCode = `${randomCode.toString().slice(0,4)}-${randomCode.toString().slice(4,8)}`;
    
    // Stocker les infos
    activePairings.set(formattedCode, {
        phoneNumber: fullNumber,
        createdAt: Date.now(),
        connected: false,
        sessionId: null
    });
    
    // Lancer la connexion WhatsApp en arrière-plan
    connectToWhatsApp(fullNumber, formattedCode).catch(console.error);
    
    res.json({
        success: true,
        code: formattedCode,
        expiresIn: 300,
        fullNumber: fullNumber,
        message: `Code envoyé à +${fullNumber}`
    });
});

// Vérifier le statut de connexion
app.get('/api/status/:code', (req, res) => {
    const { code } = req.params;
    const pairing = activePairings.get(code);
    
    if (!pairing) {
        return res.json({ 
            exists: false, 
            connected: false 
        });
    }
    
    res.json({
        exists: true,
        connected: pairing.connected || false,
        sessionId: pairing.sessionId || null,
        phoneNumber: pairing.phoneNumber,
        createdAt: pairing.createdAt
    });
});

// Récupérer la session ID après connexion
app.get('/api/session/:code', (req, res) => {
    const { code } = req.params;
    const pairing = activePairings.get(code);
    
    if (!pairing) {
        return res.status(404).json({ 
            success: false, 
            error: 'Code non trouvé' 
        });
    }
    
    if (!pairing.connected) {
        return res.status(202).json({ 
            success: false, 
            error: 'Connexion en cours...' 
        });
    }
    
    res.json({
        success: true,
        sessionId: pairing.sessionId,
        phoneNumber: pairing.phoneNumber,
        connectedAt: pairing.connectedAt
    });
});

// Supprimer une session
app.delete('/api/session/:code', (req, res) => {
    const { code } = req.params;
    
    if (activePairings.has(code)) {
        activePairings.delete(code);
        res.json({ success: true, message: 'Session supprimée' });
    } else {
        res.status(404).json({ error: 'Session non trouvée' });
    }
});

// Route santé
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        activePairings: activePairings.size,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Statistiques
app.get('/api/stats', (req, res) => {
    let connected = 0;
    for (const [code, data] of activePairings.entries()) {
        if (data.connected) connected++;
    }
    
    res.json({
        totalSessions: activePairings.size,
        connectedSessions: connected,
        pendingSessions: activePairings.size - connected
    });
});

// ========== NETTOYAGE AUTO ==========
setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [code, data] of activePairings.entries()) {
        // Supprimer les sessions non connectées de plus de 10 minutes
        if (!data.connected && (now - data.createdAt) > 10 * 60 * 1000) {
            activePairings.delete(code);
            cleaned++;
            
            // Nettoyer le dossier de session
            const sessionDir = path.join(__dirname, `sessions_${code}`);
            if (fs.existsSync(sessionDir)) {
                fs.rmSync(sessionDir, { recursive: true, force: true });
            }
        }
    }
    
    if (cleaned > 0) {
        console.log(`🧹 Nettoyage: ${cleaned} sessions expirées supprimées`);
    }
}, 5 * 60 * 1000);

// ========== DÉMARRAGE ==========
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║     🌙 MUZAN-MD - VRAI GÉNÉRATEUR DE SESSION 🌙             ║
║                                                              ║
║     ✅ Serveur démarré sur: http://localhost:${PORT}          ║
║     ✅ API prête à recevoir les requêtes                     ║
║     ✅ Ce serveur connecte VRAIMENT WhatsApp !               ║
║                                                              ║
║     Développé par: Joyboy ☀️                                ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
    `);
    
    console.log('\n📋 Endpoints disponibles:');
    console.log('   POST /api/generate - Générer un code');
    console.log('   GET  /api/status/:code - Vérifier statut');
    console.log('   GET  /api/session/:code - Récupérer session');
    console.log('   GET  /api/health - Vérification santé\n');
});
