// ============================================
// Muzan-MD - Générateur de Session
// Développé par Joyboy ☀️
// Version: 2.0
// ============================================

// Configuration
let generatedCode = null;
let phoneNumber = null;
let countryCode = null;
let sessionData = null;
let countdownInterval = null;
let verificationInterval = null;

// Éléments DOM
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const step3 = document.getElementById('step3');
const step1Indicator = document.getElementById('step1-indicator');
const step2Indicator = document.getElementById('step2-indicator');
const step3Indicator = document.getElementById('step3-indicator');
const phoneInput = document.getElementById('phoneNumber');
const countrySelect = document.getElementById('countryCode');
const generateBtn = document.getElementById('generateBtn');
const verifyBtn = document.getElementById('verifyBtn');
const resetBtn = document.getElementById('resetBtn');
const backBtn = document.getElementById('backBtn');
const copyBtn = document.getElementById('copyBtn');
const pairCodeSpan = document.getElementById('pairCode');
const displayCodeSpan = document.getElementById('displayCode');
const sessionIdSpan = document.getElementById('sessionId');
const timerSpan = document.getElementById('timer');
const loadingOverlay = document.getElementById('loadingOverlay');

// ========== FONCTIONS UTILITAIRES ==========

// Changer d'étape
function setStep(step) {
    // Cacher tous
    step1.classList.remove('active');
    step2.classList.remove('active');
    step3.classList.remove('active');
    step1Indicator.classList.remove('active');
    step2Indicator.classList.remove('active');
    step3Indicator.classList.remove('active');
    
    // Afficher étape
    if (step === 1) {
        step1.classList.add('active');
        step1Indicator.classList.add('active');
    } else if (step === 2) {
        step2.classList.add('active');
        step2Indicator.classList.add('active');
        startCountdown();
    } else if (step === 3) {
        step3.classList.add('active');
        step3Indicator.classList.add('active');
        if (verificationInterval) clearInterval(verificationInterval);
    }
}

// Générer un code aléatoire (format 8 chiffres)
function generateRandomCode() {
    const code = Math.floor(10000000 + Math.random() * 90000000);
    return code.toString();
}

// Formater le code (XXXX-XXXX)
function formatCode(code) {
    return `${code.slice(0,4)}-${code.slice(4,8)}`;
}

// Démarrer le compte à rebours (5 minutes)
function startCountdown() {
    let timeLeft = 300; // 5 minutes en secondes
    
    if (countdownInterval) clearInterval(countdownInterval);
    
    countdownInterval = setInterval(() => {
        if (timeLeft <= 0) {
            clearInterval(countdownInterval);
            timerSpan.textContent = '00:00';
            timerSpan.style.color = '#ff0000';
            alert('⏰ Code expiré ! Génère un nouveau code.');
            setStep(1);
        } else {
            timeLeft--;
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            timerSpan.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }, 1000);
}

// Générer une session ID unique
function generateSessionId(code, phone, country) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    return `MUZAN_${code.replace('-', '')}_${country}${phone}_${timestamp}_${random}`;
}

// Afficher/Masquer le chargement
function showLoading(show, message = 'Connexion en cours...') {
    if (show) {
        loadingOverlay.querySelector('p').textContent = message;
        loadingOverlay.style.display = 'flex';
    } else {
        loadingOverlay.style.display = 'none';
    }
}

// Sauvegarder en localStorage
function saveToLocalStorage() {
    localStorage.setItem('muzan_code', generatedCode);
    localStorage.setItem('muzan_phone', phoneNumber);
    localStorage.setItem('muzan_country', countryCode);
    localStorage.setItem('muzan_timestamp', Date.now());
}

// Charger depuis localStorage
function loadFromLocalStorage() {
    const savedCode = localStorage.getItem('muzan_code');
    const savedPhone = localStorage.getItem('muzan_phone');
    const savedCountry = localStorage.getItem('muzan_country');
    const savedTimestamp = localStorage.getItem('muzan_timestamp');
    
    if (savedCode && savedPhone && savedTimestamp) {
        const age = Date.now() - parseInt(savedTimestamp);
        const hourInMs = 60 * 60 * 1000;
        
        if (age < hourInMs) {
            return { code: savedCode, phone: savedPhone, country: savedCountry };
        }
    }
    return null;
}

// Copier la session ID
async function copySessionId() {
    const sessionId = sessionIdSpan.innerText;
    if (sessionId && sessionId !== 'Chargement...') {
        await navigator.clipboard.writeText(sessionId);
        copyBtn.innerHTML = '✅ Copié !';
        setTimeout(() => {
            copyBtn.innerHTML = '📋 Copier';
        }, 2000);
    }
}

// ========== ÉTAPE 1 : GÉNÉRATION DU CODE ==========
generateBtn.addEventListener('click', async () => {
    let number = phoneInput.value.trim();
    countryCode = countrySelect.value;
    
    if (!number) {
        alert('🌙 Entre ton numéro WhatsApp !');
        return;
    }
    
    number = number.replace(/\D/g, '');
    if (number.length < 8 || number.length > 15) {
        alert('⚠️ Numéro invalide (8 à 15 chiffres)');
        return;
    }
    
    phoneNumber = number;
    
    // Générer le code
    const rawCode = generateRandomCode();
    const formattedCode = formatCode(rawCode);
    generatedCode = formattedCode;
    
    // Afficher le code
    pairCodeSpan.innerText = formattedCode;
    if (displayCodeSpan) displayCodeSpan.innerText = formattedCode;
    
    // Sauvegarder
    saveToLocalStorage();
    
    console.log(`🌙 Code généré: ${formattedCode}`);
    console.log(`📱 Pour: +${countryCode}${phoneNumber}`);
    
    // Animation succès
    pairCodeSpan.style.animation = 'none';
    setTimeout(() => {
        pairCodeSpan.style.animation = 'fadeIn 0.5s ease';
    }, 10);
    
    // Passer à l'étape 2
    setStep(2);
});

// ========== ÉTAPE 2 : VÉRIFICATION ==========
verifyBtn.addEventListener('click', async () => {
    if (!generatedCode) {
        const saved = loadFromLocalStorage();
        if (saved) {
            generatedCode = saved.code;
            phoneNumber = saved.phone;
            countryCode = saved.country;
            pairCodeSpan.innerText = generatedCode;
        } else {
            setStep(1);
            return;
        }
    }
    
    showLoading(true, '🔄 Vérification de la connexion...');
    
    // Simuler la vérification WhatsApp
    // Dans la vraie version, ici on appellerait une API
    setTimeout(() => {
        showLoading(false);
        
        // Générer la vraie session ID
        const sessionId = generateSessionId(generatedCode, phoneNumber, countryCode);
        sessionIdSpan.innerText = sessionId;
        
        // Sauvegarder la session
        localStorage.setItem('muzan_session', sessionId);
        sessionData = { sessionId, phoneNumber, countryCode, generatedCode };
        
        // Passer à l'étape 3
        setStep(3);
        
        // Jouer un son de succès (optionnel)
        // new Audio('https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3').play();
    }, 3000);
});

// ========== BOUTON RETOUR ==========
backBtn.addEventListener('click', () => {
    if (countdownInterval) clearInterval(countdownInterval);
    setStep(1);
});

// ========== BOUTON RÉINITIALISATION ==========
resetBtn.addEventListener('click', () => {
    generatedCode = null;
    phoneNumber = null;
    countryCode = null;
    sessionData = null;
    phoneInput.value = '';
    
    if (countdownInterval) clearInterval(countdownInterval);
    if (verificationInterval) clearInterval(verificationInterval);
    
    localStorage.removeItem('muzan_code');
    localStorage.removeItem('muzan_phone');
    localStorage.removeItem('muzan_country');
    localStorage.removeItem('muzan_session');
    localStorage.removeItem('muzan_timestamp');
    
    setStep(1);
});

// ========== COPIE SESSION ==========
copyBtn.addEventListener('click', copySessionId);

// ========== FORMATAGE AUTO NUMÉRO ==========
phoneInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 15) value = value.slice(0, 15);
    e.target.value = value;
});

// ========== CHARGEMENT INITIAL ==========
document.addEventListener('DOMContentLoaded', () => {
    const saved = loadFromLocalStorage();
    if (saved) {
        if (confirm('🌙 Une session précédente a été trouvée. Voulez-vous la continuer ?')) {
            generatedCode = saved.code;
            phoneNumber = saved.phone;
            countryCode = saved.country;
            phoneInput.value = saved.phone;
            countrySelect.value = saved.country;
            pairCodeSpan.innerText = saved.code;
            
            const savedSession = localStorage.getItem('muzan_session');
            if (savedSession) {
                sessionIdSpan.innerText = savedSession;
                setStep(3);
            } else {
                setStep(2);
            }
        }
    }
});

console.log('🌙 Muzan-MD Pair Generator - Développé par Joyboy ☀️');
console.log('✅ Site prêt à générer vos sessions !');
