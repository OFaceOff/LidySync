async function fetchLatestVersion() {
    const versionDisplay = document.getElementById('ls-version-display');
    try {
        const response = await fetch('https://raw.githubusercontent.com/OFaceOff/LidySync/main/lidysync.user.js');
        if (!response.ok) throw new Error('Erro ao buscar o arquivo');
        const text = await response.text();
        const versionMatch = text.match(/\/\/\s*@version\s+([\d\.]+)/i);
        
        if (versionMatch && versionMatch[1]) {
            versionDisplay.textContent = `Versão Atual: ${versionMatch[1]}`;
        } else {
            versionDisplay.textContent = `Versão Atual: Desconhecida`;
        }
    } catch (error) {
        versionDisplay.textContent = `Versão Atual: Offline`;
    }
}
document.addEventListener('DOMContentLoaded', fetchLatestVersion);

const mockupInput = document.getElementById('mockup-input');
const mockupSendBtn = document.getElementById('mockup-send-btn');
const mockupMessages = document.getElementById('mockup-messages');

let mockupMessageCount = 0;
const maxMockupMessages = 3;

let sharedAudioCtx = null;
function initAudioContext() {
    if (!sharedAudioCtx) {
        sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return sharedAudioCtx;
}

function unlockAudio() {
    const ctx = initAudioContext();
    if (ctx.state === 'suspended') {
        ctx.resume();
    }
}
document.addEventListener('pointerdown', unlockAudio, { once: true });
document.addEventListener('keydown', unlockAudio, { once: true });

function playMockupSendSound() {
    try {
        const ctx = initAudioContext();
        if (ctx.state === 'suspended') ctx.resume();
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.04);
        
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
    } catch (e) {}
}

function playMockupReceiveSound() {
    try {
        const ctx = initAudioContext();
        if (ctx.state === 'suspended') return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.075);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
    } catch (e) {}
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}

function sendMockupMessage() {
    const text = mockupInput.value.trim();
    if (!text) return;
    if (mockupMessageCount >= maxMockupMessages) return;

    const msgElement = document.createElement('div');
    msgElement.className = 'm-msg me';
    msgElement.innerHTML = escapeHTML(text);

    mockupMessages.appendChild(msgElement);
    
    playMockupSendSound();

    mockupInput.value = '';
    mockupMessages.scrollTop = mockupMessages.scrollHeight;
    
    mockupMessageCount++;

    if (mockupMessageCount === maxMockupMessages) {
        mockupInput.disabled = true;
        mockupInput.placeholder = "Venha para o LidySync.";
        mockupSendBtn.style.opacity = '0.5';
        mockupSendBtn.style.pointerEvents = 'none';
        
        setTimeout(() => {
            const botMsgElement = document.createElement('div');
            botMsgElement.className = 'm-msg';
            botMsgElement.innerHTML = `Gostou? Então clique <a href="#download" style="color: var(--highlight); text-decoration: underline; font-weight: bold;">aqui</a> para aprender a instalar e usar nosso aplicativo.`;
            
            mockupMessages.appendChild(botMsgElement);
            playMockupReceiveSound();
            mockupMessages.scrollTop = mockupMessages.scrollHeight;
        }, 1500);
    }
}

mockupSendBtn.addEventListener('click', sendMockupMessage);
mockupInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMockupMessage();
    }
});

let initialMockupMessageSent = false;
const mockupWrapper = document.getElementById('como-funciona');

if (mockupWrapper) {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !initialMockupMessageSent) {
                initialMockupMessageSent = true;
                
                setTimeout(() => {
                    const initialMsg = document.createElement('div');
                    initialMsg.className = 'm-msg';
                    initialMsg.innerHTML = 'Posso dar play ?';
                    
                    mockupMessages.appendChild(initialMsg);
                    playMockupReceiveSound();
                    mockupMessages.scrollTop = mockupMessages.scrollHeight;
                }, 1000);
            }
        });
    }, { threshold: 0.5 });

    observer.observe(mockupWrapper);
}