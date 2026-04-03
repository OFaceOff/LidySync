// ==UserScript==
// @name         LidySync
// @namespace    https://github.com/OFaceOff
// @version      10.0
// @description  Chat em tempo real para assistir filmes sincronizados com amigos.
// @author       Face Off & FStudio
// @icon         https://raw.githubusercontent.com/OFaceOff/LidySync/main/icon.ico
// @match        *://*/*
// @grant        none
// @run-at       document-start
// @require      https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js
// @require      https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js
// ==/UserScript==

(function() {
    'use strict';

    async function hashPassword(password) {
        const msgBuffer = new TextEncoder().encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    const firebaseConfig = {
        apiKey: "AIzaSyD3IWvUCE2EfLS6r6QlWiHqsMpXnQmEzWo",
        authDomain: "lidysync-chat.firebaseapp.com",
        projectId: "lidysync-chat",
        storageBucket: "lidysync-chat.firebasestorage.app",
        messagingSenderId: "566970786298",
        appId: "1:566970786298:web:c4fc05441dd9f76aa38443"
    };

    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();

    function injectUI() {
        if (document.getElementById('lidysync-host')) return;

        const target = document.body || document.documentElement;
        if (!target) { setTimeout(injectUI, 100); return; }

        const host = document.createElement('div');
        host.id = 'lidysync-host';
        host.style.cssText = 'position: fixed !important; bottom: 20px !important; right: 20px !important; z-index: 2147483647 !important; pointer-events: none !important;';
        
        const shadow = host.attachShadow({ mode: 'open' });

        const style = document.createElement('style');
        style.textContent = `
            * { box-sizing: border-box; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; }
            #ls-wrapper { pointer-events: auto; display: flex; flex-direction: column; align-items: flex-end; position: relative; }
            
            ::-webkit-scrollbar { width: 6px; }
            ::-webkit-scrollbar-thumb { background: #334155; border-radius: 6px; }
            ::-webkit-scrollbar-thumb:hover { background: #475569; }
            
            #ls-fab {
                width: 58px; height: 58px; 
                background: linear-gradient(135deg, #6366f1, #8b5cf6);
                border-radius: 50%; display: flex; justify-content: center;
                align-items: center; cursor: pointer;
                box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
                font-size: 26px; transition: transform 0.2s, box-shadow 0.2s;
            }
            #ls-fab:hover { transform: scale(1.08); box-shadow: 0 6px 25px rgba(99, 102, 241, 0.6); }
            
            #ls-chat-window {
                width: 340px; height: 540px; 
                background-color: #0f172a; 
                border-radius: 16px; 
                box-shadow: 0 12px 40px rgba(0,0,0,0.6);
                display: none; flex-direction: column;
                margin-bottom: 15px; overflow: hidden; 
                border: 1px solid rgba(255,255,255,0.08); position: relative;
            }
            #ls-chat-window.open { display: flex; animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
            @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
            
            #ls-header { 
                background-color: rgba(15, 23, 42, 0.85); 
                backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
                color: #f8fafc; padding: 16px; display: flex; justify-content: space-between; 
                align-items: center; font-size: 15px; font-weight: 600; z-index: 10;
                border-bottom: 1px solid rgba(255,255,255,0.05);
            }
            .ls-header-btns { display: flex; gap: 12px; align-items: center; }
            .ls-header-btn { cursor: pointer; color: #94a3b8; font-size: 18px; background: none; border: none; transition: color 0.2s; display: flex; align-items: center; }
            .ls-header-btn:hover { color: #f8fafc; }
            
            .ls-screen { flex: 1; display: none; flex-direction: column; padding: 24px; background-color: #0f172a; gap: 16px; justify-content: center; z-index: 5; overflow-y: auto;}
            
            #ls-settings-overlay { position: absolute; top: 54px; left: 0; width: 100%; height: calc(100% - 54px); background-color: #0f172a; z-index: 30; display: none; flex-direction: column; padding: 24px; gap: 16px; overflow-y: auto; }

            .ls-label { color: #94a3b8; font-size: 12px; font-weight: 600; margin-bottom: 6px; display: block; text-transform: uppercase; letter-spacing: 0.5px; }
            .ls-input-text, .ls-select { 
                background-color: #1e293b; border: 1px solid rgba(255,255,255,0.1); 
                border-radius: 10px; padding: 12px; color: #f8fafc; outline: none; 
                font-size: 14px; width: 100%; transition: all 0.2s; 
            }
            .ls-input-text:focus, .ls-select:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15); }
            
            .ls-input-color { width: 100%; height: 42px; border: none; border-radius: 10px; cursor: pointer; background: none; padding: 0; }
            .ls-input-color::-webkit-color-swatch-wrapper { padding: 0; }
            .ls-input-color::-webkit-color-swatch { border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; }
            
            .ls-checkbox-group { display: flex; align-items: flex-start; gap: 10px; color: #cbd5e1; font-size: 13.5px; margin-top: 5px; cursor: pointer; line-height: 1.5; }
            
            .ls-btn-primary { 
                background: linear-gradient(135deg, #6366f1, #8b5cf6); 
                color: white; border: none; border-radius: 10px; padding: 14px; 
                font-weight: 600; cursor: pointer; margin-top: 10px; transition: all 0.2s; width: 100%; font-size: 14px;
                box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
            }
            .ls-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(99, 102, 241, 0.35); }
            .ls-btn-secondary { background-color: #1e293b; color: #f8fafc; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 14px; font-weight: 600; cursor: pointer; transition: 0.2s; width: 100%; font-size: 14px; }
            .ls-btn-secondary:hover { background-color: #334155; }
            .ls-btn-danger { background-color: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 10px; padding: 14px; font-weight: 600; cursor: pointer; margin-top: 5px; transition: 0.2s; width: 100%; font-size: 14px; }
            .ls-btn-danger:hover { background-color: #ef4444; color: white; }
            
            .ls-config-section { background: rgba(255,255,255,0.02); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 8px;}
            
            #ls-chat-area { flex: 1; display: none; flex-direction: column; overflow: hidden; position: relative; }
            #ls-messages { flex: 1; padding: 20px 16px; overflow-y: auto; background-color: #0f172a; display: flex; flex-direction: column; gap: 14px; transition: background 0.3s; }
            
            .ls-message-container { display: flex; flex-direction: column; max-width: 85%; position: relative; }
            .ls-message-container.sent { align-self: flex-end; align-items: flex-end; }
            .ls-message-container.received { align-self: flex-start; align-items: flex-start; }
            
            .ls-sender-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; padding: 0 4px; }
            .ls-sender-name { font-size: 11px; color: #94a3b8; font-weight: 600; letter-spacing: 0.3px; }
            
            .ls-msg-delete { display: none; cursor: pointer; font-size: 13px; filter: grayscale(100%); transition: 0.2s; opacity: 0.6; }
            .ls-msg-delete:hover { filter: grayscale(0%); opacity: 1; transform: scale(1.1); }
            .ls-message-container:hover .ls-msg-delete { display: inline-block; }
            
            .ls-message { padding: 10px 14px; font-size: 14px; line-height: 1.45; color: #f8fafc; word-wrap: break-word; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
            
            .ls-message-container.system-msg-container { max-width: 95%; align-self: center; margin: 8px 0; }
            .ls-message.system-msg { 
                background: rgba(99, 102, 241, 0.1) !important; 
                color: #a5b4fc; 
                text-align: center; font-weight: 500; 
                border-radius: 12px !important; font-size: 13px; 
                border: 1px solid rgba(99, 102, 241, 0.2);
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                padding: 10px 16px;
                letter-spacing: 0.2px;
            }
            
            .ls-message.deleted-msg { background-color: transparent !important; color: #64748b; font-style: italic; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px !important; font-size: 13px; box-shadow: none; }
            
            .sent .ls-message:not(.deleted-msg) { border-radius: 14px 14px 4px 14px; }
            .received .ls-message:not(.deleted-msg) { border-radius: 14px 14px 14px 4px; background-color: #1e293b !important; border: 1px solid rgba(255,255,255,0.05); }
            
            #ls-input-area { display: flex; padding: 12px 16px; background-color: #0f172a; gap: 10px; align-items: center; position: relative; flex-wrap: nowrap; border-top: 1px solid rgba(255,255,255,0.05); }
            .ls-icon-btn { flex-shrink: 0; background: none; border: none; color: #64748b; font-size: 22px; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 4px; transition: color 0.2s, transform 0.2s; border-radius: 8px; }
            .ls-icon-btn:hover { color: #cbd5e1; background: rgba(255,255,255,0.05); transform: scale(1.05); }
            
            #ls-input { flex-grow: 1; min-width: 0; background-color: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 10px 16px; color: #f8fafc; outline: none; font-size: 14px; transition: 0.2s; }
            #ls-input:focus { border-color: #6366f1; background-color: rgba(30, 41, 59, 0.8); }
            
            #ls-send-btn { 
                flex-shrink: 0; background: linear-gradient(135deg, #6366f1, #8b5cf6); 
                color: white; border: none; border-radius: 50%; width: 40px; height: 40px; 
                cursor: pointer; display: flex; align-items: center; justify-content: center; 
                font-size: 16px; box-shadow: 0 2px 10px rgba(99, 102, 241, 0.3); transition: transform 0.2s;
            }
            #ls-send-btn:hover { transform: scale(1.05); }
            
            .ls-popup-panel { position: absolute; bottom: 70px; background-color: #1e293b; border-radius: 16px; padding: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); display: none; z-index: 20; border: 1px solid rgba(255,255,255,0.1); }
            #ls-emoji-panel { left: 16px; width: 240px; grid-template-columns: repeat(6, 1fr); gap: 6px; }
            .ls-emoji-item { font-size: 20px; cursor: pointer; text-align: center; padding: 6px; border-radius: 8px; transition: 0.1s; }
            .ls-emoji-item:hover { background-color: rgba(255,255,255,0.1); transform: scale(1.1); }
            
            #ls-plus-panel { left: 16px; width: 200px; flex-direction: column; gap: 4px; }
            .ls-action-item { color: #f8fafc; padding: 12px; cursor: pointer; font-size: 14px; border-radius: 10px; display: flex; align-items: center; gap: 10px; font-weight: 500; transition: 0.2s; }
            .ls-action-item:hover { background-color: rgba(99, 102, 241, 0.1); color: #a5b4fc; }

            #ls-countdown-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); z-index: 100; display: none; flex-direction: column; justify-content: center; align-items: center; }
            #ls-countdown-number { font-size: 110px; font-weight: 700; color: #a5b4fc; text-shadow: 0 0 40px rgba(99, 102, 241, 0.5); animation: pop 1s infinite; letter-spacing: -2px; }
            #ls-countdown-text { color: #cbd5e1; font-size: 16px; margin-top: 15px; font-weight: 500; letter-spacing: 0.5px;}
            @keyframes pop { 0% { transform: scale(0.8); opacity: 0.5; } 50% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); opacity: 0.8; } }
        `;

        const emojis = ['😀','😂','😍','🥰','😎','😭','😡','😱','🍿','🎬','🍕','🥂','👍','👎','❤️','🔥'];

        const wrapper = document.createElement('div');
        wrapper.id = 'ls-wrapper';
        wrapper.innerHTML = `
            <div id="ls-chat-window">
                <div id="ls-header">
                    <span id="ls-header-title">🍿 LidySync</span>
                    <div class="ls-header-btns">
                        <button class="ls-header-btn" id="ls-settings-btn" title="Configurações" style="display:none;">⚙️</button>
                        <button class="ls-header-btn" id="ls-close-btn" title="Minimizar">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        </button>
                    </div>
                </div>
                
                <div id="ls-setup-area" class="ls-screen">
                    <span style="color: #f8fafc; font-size: 20px; font-weight: 700; text-align: center; margin-bottom: 5px;">Bem-vindo</span>
                    <div><span class="ls-label">Seu Apelido</span><input type="text" class="ls-input-text" id="ls-setup-name" placeholder="Como quer ser chamado?" /></div>
                    <div><span class="ls-label">Cor da sua Bolha</span><input type="color" class="ls-input-color" id="ls-setup-color" value="#6366f1" /></div>
                    <button class="ls-btn-primary" id="ls-setup-btn">Continuar</button>
                </div>

                <div id="ls-lobby-area" class="ls-screen">
                    <span style="color: #f8fafc; font-size: 20px; font-weight: 700; text-align: center; margin-bottom: 5px;">Salas Privadas</span>
                    <div><span class="ls-label">Nome da Sala</span><input type="text" class="ls-input-text" id="ls-lobby-room" placeholder="Ex: cine-pipoca" /></div>
                    <div><span class="ls-label">Senha</span><input type="password" class="ls-input-text" id="ls-lobby-pass" placeholder="***" /></div>
                    
                    <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 10px;">
                        <button class="ls-btn-primary" id="ls-join-room-btn">Entrar na Sala</button>
                        <button class="ls-btn-secondary" id="ls-create-room-btn">Criar Nova Sala</button>
                        <button class="ls-btn-secondary" id="ls-back-to-setup" style="border:none; background:none; font-size:13px; font-weight:500; text-decoration:underline; color:#94a3b8; padding:0;">Editar meu Perfil</button>
                    </div>
                </div>

                <div id="ls-settings-overlay">
                    <span style="color: #f8fafc; font-size: 20px; font-weight: 700; margin-bottom: 5px;">Ações da Sala</span>
                    
                    <div class="ls-config-section">
                        <button class="ls-btn-secondary" id="ls-leave-room-btn">🚪 Voltar ao Lobby</button>
                        <button class="ls-btn-danger" id="ls-delete-room-btn">🗑️ Encerrar Sala para Todos</button>
                    </div>

                    <span style="color: #f8fafc; font-size: 16px; font-weight: 700; margin-bottom: 5px; margin-top: 10px;">Aparência</span>
                    
                    <div class="ls-config-section">
                        <span class="ls-label">Fundo do Chat</span>
                        <select class="ls-select" id="ls-config-bg-type" style="margin-bottom: 12px;">
                            <option value="color">Cor Sólida</option>
                            <option value="image">Imagem (Link URL)</option>
                        </select>
                        
                        <div id="ls-bg-color-wrapper"><input type="color" class="ls-input-color" id="ls-config-bg-color" value="#0f172a" /></div>
                        <div id="ls-bg-image-wrapper" style="display: none;"><input type="text" class="ls-input-text" id="ls-config-bg-image" placeholder="Cole o link .jpg ou .png..." /></div>
                        
                        <label class="ls-checkbox-group" style="margin-top: 16px;">
                            <input type="checkbox" id="ls-config-sync">
                            <span><b>Sincronizar Fundo</b><br><small style="color: #64748b;">Muda o visual para todos na sala.</small></span>
                        </label>
                    </div>

                    <div class="ls-config-section">
                        <span class="ls-label">Sistema</span>
                        <label class="ls-checkbox-group">
                            <input type="checkbox" id="ls-config-autoplay" checked>
                            <span>Tentar Play Automático pós-Countdown</span>
                        </label>
                    </div>
                    
                    <button class="ls-btn-primary" id="ls-save-config-btn">Salvar Alterações</button>
                </div>

                <div id="ls-chat-area">
                    <div id="ls-messages"></div>
                    
                    <div id="ls-countdown-overlay">
                        <div id="ls-countdown-number">3</div>
                        <div id="ls-countdown-text">Preparando...</div>
                    </div>

                    <div id="ls-emoji-panel" class="ls-popup-panel">${emojis.map(e => `<span class="ls-emoji-item">${e}</span>`).join('')}</div>

                    <div id="ls-plus-panel" class="ls-popup-panel">
                        <div class="ls-action-item" id="btn-action-countdown">⏱️ Sincronizar Vídeo (Play)</div>
                    </div>

                    <div id="ls-input-area">
                        <button class="ls-icon-btn" id="ls-btn-plus">➕</button>
                        <button class="ls-icon-btn" id="ls-btn-emoji">😀</button>
                        <input type="text" id="ls-input" placeholder="Mensagem..." autocomplete="off" />
                        <button id="ls-send-btn">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left:-2px;"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                        </button>
                    </div>
                </div>
            </div>
            <div id="ls-fab">
                <img src="https://raw.githubusercontent.com/OFaceOff/LidySync/main/icon.ico" width="28" height="28" style="filter: brightness(0) invert(1);" alt="LS">
            </div>
        `;

        shadow.appendChild(style);
        shadow.appendChild(wrapper);
        target.appendChild(host);

        const fab = shadow.getElementById('ls-fab');
        const chatWindow = shadow.getElementById('ls-chat-window');
        const closeBtn = shadow.getElementById('ls-close-btn');
        const settingsBtn = shadow.getElementById('ls-settings-btn');
        const headerTitle = shadow.getElementById('ls-header-title');
        
        const setupArea = shadow.getElementById('ls-setup-area');
        const lobbyArea = shadow.getElementById('ls-lobby-area');
        const chatArea = shadow.getElementById('ls-chat-area');
        const settingsOverlay = shadow.getElementById('ls-settings-overlay');
        const messagesContainer = shadow.getElementById('ls-messages');
        const input = shadow.getElementById('ls-input');

        let myName = localStorage.getItem('ls_username');
        let myColor = localStorage.getItem('ls_usercolor') || '#6366f1';
        let currentRoom = localStorage.getItem('ls_current_room'); 
        let currentRoomKey = localStorage.getItem('ls_room_key'); 
        
        let myBgType = localStorage.getItem('ls_bg_type') || 'color';
        let myBgColor = localStorage.getItem('ls_bg_color') || '#0f172a';
        let myBgImage = localStorage.getItem('ls_bg_image') || '';
        let mySyncBg = localStorage.getItem('ls_sync_bg') === 'true'; 
        let myAutoPlay = localStorage.getItem('ls_autoplay') !== 'false'; 

        let roomListener = null;
        let messagesListener = null;
        let settingsListener = null;
        let isFirstSnapshot = true;

        function checkScreenState() {
            settingsOverlay.style.display = 'none';
            if (!myName) {
                setupArea.style.display = 'flex';
                lobbyArea.style.display = 'none';
                chatArea.style.display = 'none';
                settingsBtn.style.display = 'none';
                headerTitle.innerText = "🍿 LidySync";
            } else if (!currentRoom || !currentRoomKey) {
                setupArea.style.display = 'none';
                lobbyArea.style.display = 'flex';
                chatArea.style.display = 'none';
                settingsBtn.style.display = 'none';
                headerTitle.innerText = `Lobby (${myName})`;
            } else {
                setupArea.style.display = 'none';
                lobbyArea.style.display = 'none';
                chatArea.style.display = 'flex';
                settingsBtn.style.display = 'block';
                headerTitle.innerText = `${currentRoom}`;
                if (!mySyncBg) applyBackground(myBgType, myBgColor, myBgImage);
                startChatListeners();
            }
        }

        shadow.getElementById('ls-setup-btn').addEventListener('click', () => {
            const name = shadow.getElementById('ls-setup-name').value.trim();
            if (!name) return alert("Digite um apelido!");
            myName = name;
            myColor = shadow.getElementById('ls-setup-color').value;
            localStorage.setItem('ls_username', myName);
            localStorage.setItem('ls_usercolor', myColor);
            checkScreenState();
        });

        shadow.getElementById('ls-back-to-setup').addEventListener('click', () => {
            myName = null;
            checkScreenState();
        });

        const inputRoom = shadow.getElementById('ls-lobby-room');
        const inputPass = shadow.getElementById('ls-lobby-pass');

        shadow.getElementById('ls-create-room-btn').addEventListener('click', async () => {
            const roomName = inputRoom.value.trim().toLowerCase();
            const roomPass = inputPass.value.trim();
            if(!roomName || !roomPass) return alert("Preencha o nome da sala e uma senha!");
            
            try {
                const docRef = db.collection('rooms').doc(roomName);
                const doc = await docRef.get();
                if(doc.exists) return alert("Esta sala já existe! Digite a senha e clique em 'Entrar na Sala'.");
                
                const hashedPass = await hashPassword(roomPass);
                
                await docRef.set({ password: hashedPass, createdBy: myName, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
                
                currentRoom = roomName; 
                currentRoomKey = crypto.randomUUID();
                localStorage.setItem('ls_current_room', currentRoom);
                localStorage.setItem('ls_room_key', currentRoomKey);
                
                inputRoom.value = ''; inputPass.value = ''; checkScreenState();
            } catch (e) { alert("Erro ao criar sala. Verifique a conexão."); }
        });

        shadow.getElementById('ls-join-room-btn').addEventListener('click', async () => {
            const roomName = inputRoom.value.trim().toLowerCase();
            const roomPass = inputPass.value.trim();
            if(!roomName || !roomPass) return alert("Preencha o nome da sala e a senha!");
            
            try {
                const docRef = db.collection('rooms').doc(roomName);
                const doc = await docRef.get();
                if(!doc.exists) return alert("Esta sala não existe! Clique em 'Criar Nova Sala'.");
                
                const hashedPass = await hashPassword(roomPass);
                if(doc.data().password !== hashedPass) return alert("Senha incorreta!");
                
                currentRoom = roomName; 
                currentRoomKey = crypto.randomUUID();
                localStorage.setItem('ls_current_room', currentRoom);
                localStorage.setItem('ls_room_key', currentRoomKey);
                
                inputRoom.value = ''; inputPass.value = ''; checkScreenState();
            } catch (e) { alert("Erro ao entrar. Verifique a conexão."); }
        });

        shadow.getElementById('ls-leave-room-btn').addEventListener('click', () => {
            stopChatListeners();
            currentRoom = null; 
            currentRoomKey = null;
            localStorage.removeItem('ls_current_room');
            localStorage.removeItem('ls_room_key');
            checkScreenState();
        });

        shadow.getElementById('ls-delete-room-btn').addEventListener('click', async () => {
            if(!confirm("Atenção: Isso vai encerrar a sala e expulsar todo mundo. Tem certeza?")) return;
            try { await db.collection('rooms').doc(currentRoom).delete(); } catch (e) {}
        });

        function startChatListeners() {
            if (!currentRoom) return;
            stopChatListeners(); 

            isFirstSnapshot = true;
            messagesContainer.innerHTML = '';
            
            const roomRef = db.collection('rooms').doc(currentRoom);
            const messagesRef = roomRef.collection('messages');
            const settingsRef = roomRef.collection('settings').doc('shared');

            roomListener = roomRef.onSnapshot(doc => {
                if (!doc.exists) {
                    alert("A sala foi encerrada pelo criador.");
                    stopChatListeners(); 
                    currentRoom = null; 
                    currentRoomKey = null;
                    localStorage.removeItem('ls_current_room'); 
                    localStorage.removeItem('ls_room_key'); 
                    checkScreenState();
                }
            });

            settingsListener = settingsRef.onSnapshot(doc => {
                if (doc.exists && mySyncBg) {
                    const data = doc.data(); applyBackground(data.bgType, data.bgColor, data.bgImage);
                }
            });

            messagesListener = messagesRef.orderBy('timestamp', 'asc').limitToLast(50).onSnapshot((snapshot) => {
                messagesContainer.innerHTML = '';
                
                snapshot.docChanges().forEach((change) => {
                    const data = change.doc.data();
                    if (change.type === 'added' && data.type === 'countdown' && !isFirstSnapshot && !data.deleted) {
                        runVisualCountdown(data.sender);
                    }
                });

                snapshot.forEach((doc) => {
                    const data = doc.data();
                    const docId = doc.id; 
                    const isMe = data.sender === myName;
                    const container = document.createElement('div');
                    
                    if (data.type === 'countdown') {
                        if (data.deleted) return; 
                        container.className = 'ls-message-container system-msg-container';
                        container.innerHTML = `<div class="ls-message system-msg">🎬 ${data.text}</div>`;
                    } else {
                        container.className = `ls-message-container ${isMe ? 'sent' : 'received'}`;
                        
                        const senderRow = document.createElement('div');
                        senderRow.className = 'ls-sender-row';
                        
                        const nameLabel = document.createElement('span');
                        nameLabel.className = 'ls-sender-name';
                        nameLabel.innerText = data.sender;
                        senderRow.appendChild(nameLabel);
                        
                        if (isMe && !data.deleted) {
                            const delBtn = document.createElement('span');
                            delBtn.className = 'ls-msg-delete';
                            delBtn.innerText = '🗑️';
                            delBtn.title = "Apagar";
                            delBtn.onclick = async () => { try { await messagesRef.doc(docId).update({ deleted: true }); } catch (e) {} };
                            senderRow.appendChild(delBtn);
                        }
                        
                        const msgBubble = document.createElement('div');
                        msgBubble.className = 'ls-message';

                        if (data.deleted) {
                            msgBubble.classList.add('deleted-msg');
                            msgBubble.innerText = "🚫 Mensagem apagada";
                        } else {
                            msgBubble.innerText = data.text;
                            if(isMe) { msgBubble.style.background = data.color || '#6366f1'; }
                        }

                        container.appendChild(senderRow);
                        container.appendChild(msgBubble);
                    }
                    messagesContainer.appendChild(container);
                });
                
                scrollToBottom();
                isFirstSnapshot = false;
            });
        }

        function stopChatListeners() {
            if (roomListener) roomListener(); if (messagesListener) messagesListener(); if (settingsListener) settingsListener();
            roomListener = null; messagesListener = null; settingsListener = null;
        }

        function applyBackground(type, color, imageUrl) {
            if (type === 'image' && imageUrl) {
                messagesContainer.style.backgroundImage = `linear-gradient(rgba(15, 23, 42, 0.8), rgba(15, 23, 42, 0.8)), url("${imageUrl}")`;
                messagesContainer.style.backgroundSize = 'cover';
                messagesContainer.style.backgroundPosition = 'center';
                messagesContainer.style.backgroundColor = 'transparent';
            } else {
                messagesContainer.style.backgroundImage = 'none';
                messagesContainer.style.backgroundColor = color || '#0f172a';
            }
        }

        const bgTypeSelect = shadow.getElementById('ls-config-bg-type');
        const bgColorWrapper = shadow.getElementById('ls-bg-color-wrapper');
        const bgImageWrapper = shadow.getElementById('ls-bg-image-wrapper');

        bgTypeSelect.addEventListener('change', (e) => {
            if (e.target.value === 'image') { bgColorWrapper.style.display = 'none'; bgImageWrapper.style.display = 'block'; } 
            else { bgColorWrapper.style.display = 'block'; bgImageWrapper.style.display = 'none'; }
        });

        settingsBtn.addEventListener('click', () => {
            settingsOverlay.style.display = 'flex';
            bgTypeSelect.value = myBgType;
            bgTypeSelect.dispatchEvent(new Event('change')); 
            shadow.getElementById('ls-config-bg-color').value = myBgColor;
            shadow.getElementById('ls-config-bg-image').value = myBgImage;
            shadow.getElementById('ls-config-sync').checked = mySyncBg;
            shadow.getElementById('ls-config-autoplay').checked = myAutoPlay;
        });

        shadow.getElementById('ls-save-config-btn').addEventListener('click', async () => {
            myBgType = bgTypeSelect.value; myBgColor = shadow.getElementById('ls-config-bg-color').value;
            myBgImage = shadow.getElementById('ls-config-bg-image').value; mySyncBg = shadow.getElementById('ls-config-sync').checked;
            myAutoPlay = shadow.getElementById('ls-config-autoplay').checked;
            
            localStorage.setItem('ls_bg_type', myBgType); localStorage.setItem('ls_bg_color', myBgColor);
            localStorage.setItem('ls_bg_image', myBgImage); localStorage.setItem('ls_sync_bg', mySyncBg);
            localStorage.setItem('ls_autoplay', myAutoPlay);
            
            if (mySyncBg && currentRoom) {
                try {
                    await db.collection('rooms').doc(currentRoom).collection('settings').doc('shared').set({
                        bgType: myBgType, bgColor: myBgColor, bgImage: myBgImage, timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });
                } catch (e) {}
            } else { applyBackground(myBgType, myBgColor, myBgImage); }
            
            settingsOverlay.style.display = 'none'; scrollToBottom();
        });

        const scrollToBottom = () => { messagesContainer.scrollTop = messagesContainer.scrollHeight; };
        fab.addEventListener('click', () => { chatWindow.classList.add('open'); fab.style.display = 'none'; checkScreenState(); });
        closeBtn.addEventListener('click', () => { chatWindow.classList.remove('open'); fab.style.display = 'flex'; });

        const btnPlus = shadow.getElementById('ls-btn-plus');
        const btnEmoji = shadow.getElementById('ls-btn-emoji');
        const emojiPanel = shadow.getElementById('ls-emoji-panel');
        const plusPanel = shadow.getElementById('ls-plus-panel');

        btnEmoji.addEventListener('click', () => { emojiPanel.style.display = emojiPanel.style.display === 'grid' ? 'none' : 'grid'; plusPanel.style.display = 'none'; });
        btnPlus.addEventListener('click', () => { plusPanel.style.display = plusPanel.style.display === 'flex' ? 'none' : 'flex'; emojiPanel.style.display = 'none'; });

        shadow.querySelectorAll('.ls-emoji-item').forEach(item => {
            item.addEventListener('click', (e) => { input.value += e.target.innerText; emojiPanel.style.display = 'none'; input.focus(); });
        });

        input.addEventListener('focus', () => { emojiPanel.style.display = 'none'; plusPanel.style.display = 'none'; });

        const countdownOverlay = shadow.getElementById('ls-countdown-overlay');
        const countdownNumber = shadow.getElementById('ls-countdown-number');
        
        function runVisualCountdown(senderName) {
            countdownOverlay.style.display = 'flex';
            shadow.getElementById('ls-countdown-text').innerText = `${senderName} vai dar play...`;
            
            let count = 3; countdownNumber.innerText = count; countdownNumber.style.color = "#a5b4fc"; 

            const timer = setInterval(() => {
                count--;
                if (count > 0) {
                    countdownNumber.innerText = count;
                } else if (count === 0) {
                    countdownNumber.innerText = "PLAY!";
                    countdownNumber.style.color = "#10b981"; 
                    if (myAutoPlay) { try { const video = document.querySelector('video'); if (video) video.play(); } catch (e) {} }
                } else {
                    clearInterval(timer); countdownOverlay.style.display = 'none';
                }
            }, 1000);
        }

        shadow.getElementById('btn-action-countdown').addEventListener('click', async () => {
            plusPanel.style.display = 'none';
            if(!currentRoom) return;
            if(!currentRoomKey) return alert("Sessão inválida. Saia e entre na sala novamente.");
            
            try {
                await db.collection('rooms').doc(currentRoom).collection('messages').add({
                    type: 'countdown', 
                    text: `${myName} iniciou a sincronização!`, 
                    sender: myName, 
                    roomKey: currentRoomKey,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(), 
                    deleted: false
                });
            } catch (e) {}
        });

        async function sendMessage() {
            const text = input.value.trim();
            if (!text || !myName || !currentRoom) return;
            if (text.length > 300) return alert("Mensagem muito longa (máx: 300 caracteres).");
            if (!currentRoomKey) return alert("Sessão inválida. Saia e entre na sala novamente.");
            
            input.value = '';
            try {
                await db.collection('rooms').doc(currentRoom).collection('messages').add({
                    type: 'text', 
                    text: text, 
                    sender: myName, 
                    color: myColor, 
                    roomKey: currentRoomKey,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(), 
                    deleted: false
                });
            } catch (e) {}
        }

        shadow.getElementById('ls-send-btn').addEventListener('click', sendMessage);
        input.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
    }

    const interval = setInterval(() => { if (document.body) injectUI(); }, 1000);

})();