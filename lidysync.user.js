// ==UserScript==
// @name         LidySync
// @namespace    https://github.com/OFaceOff
// @version      88.1
// @description  Chat em tempo real para assistir filmes sincronizados com amigos.
// @author       Face Off & FStudio
// @icon         https://raw.githubusercontent.com/OFaceOff/LidySync/refs/heads/main/docs/assets/img/favicon.ico
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @run-at       document-start
// @require      https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js
// @require      https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js
// ==/UserScript==

(function() {
    'use strict';

    const hasGM = typeof GM_getValue !== 'undefined';
    const ls = {
        getItem: function(key) {
            let val = hasGM ? GM_getValue(key) : undefined;
            if (val === undefined || val === null) {
                val = localStorage.getItem(key);
                if (val !== null && hasGM) GM_setValue(key, val);
            }
            return (val === undefined || val === null) ? null : val;
        },
        setItem: function(key, val) {
            if (hasGM) GM_setValue(key, String(val));
            localStorage.setItem(key, val);
        },
        removeItem: function(key) {
            if (hasGM) GM_deleteValue(key);
            localStorage.removeItem(key);
        },
        clear: function() {
            const keys = ['ls_device_id','ls_username','ls_userpin','ls_usercolor','ls_usertextcolor','ls_useravatar','ls_userbanner','ls_userbio','ls_usercountry','ls_userfav','ls_hidechats','ls_current_room','ls_room_key','ls_saved_rooms','ls_last_read','ls_muted_rooms','ls_theme','ls_sound','ls_inchat_sounds','ls_hide_sys','ls_hide_app','ls_hide_revive','ls_integrated','ls_autoplay'];
            if (hasGM) keys.forEach(k => GM_deleteValue(k));
            keys.forEach(k => localStorage.removeItem(k));
        }
    };

    async function hashPassword(password) {
        const msgBuffer = new TextEncoder().encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    let sharedAudioCtx = null;

    function playAudio(frequency1, frequency2, duration) {
        try {
            if (!sharedAudioCtx) sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (sharedAudioCtx.state === 'suspended') sharedAudioCtx.resume();
            const osc = sharedAudioCtx.createOscillator();
            const gain = sharedAudioCtx.createGain();
            osc.connect(gain);
            gain.connect(sharedAudioCtx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(frequency1, sharedAudioCtx.currentTime);
            if (frequency2) osc.frequency.exponentialRampToValueAtTime(frequency2, sharedAudioCtx.currentTime + (duration / 2));
            gain.gain.setValueAtTime(0.05, sharedAudioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, sharedAudioCtx.currentTime + duration);
            osc.start();
            osc.stop(sharedAudioCtx.currentTime + duration);
        } catch (e) {}
    }

    function playNotificationSound() { if (ls.getItem('ls_sound') !== 'false') playAudio(600, 1000, 0.1); }
    function playSendSound() { if (ls.getItem('ls_sound') !== 'false' && ls.getItem('ls_inchat_sounds') !== 'false') playAudio(300, 600, 0.08); }
    function playReceiveSound() { if (ls.getItem('ls_sound') !== 'false' && ls.getItem('ls_inchat_sounds') !== 'false') playAudio(800, 1200, 0.15); }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag]));
    }

    function linkify(text) {
        const safeText = escapeHTML(text);
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return safeText.replace(urlRegex, '<a href="$1" target="_blank" style="color: currentColor; text-decoration: underline; word-break: break-all;">$1</a>');
    }

    function compressImage(dataUrl, callback) {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width, height = img.height;
            const max = 800;
            if (width > height && width > max) { height *= max / width; width = max; } 
            else if (height > max) { width *= max / height; height = max; }
            canvas.width = width; canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            callback(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = dataUrl;
    }

    function buildTagsHTML(isAdm, uData) {
        let html = '';
        if (isAdm) html += `<span class="ls-tag ls-tag-host" title="Este usuário é o Host desse chat e ele pode alterar ou deletar o chat atual.">HOST</span>`;
        if (uData && uData.tags) {
            uData.tags.forEach(t => {
                let c = 'ls-tag-generic';
                let text = t;
                let title = '';
                
                if (t === 'DEV') { c = 'ls-tag-dev'; title = 'Este usuário faz parte da equipe de desenvolvimento da FStudio'; }
                else if (t === 'OWNER') { c = 'ls-tag-owner'; title = 'Este usuário detém a posse do aplicativo, ele que manda e desmanda, quer coisas novas ? pede pra ele que é ele que adiciona :3'; }
                else if (t === 'MOD') { c = 'ls-tag-mod'; title = 'Este usuário faz parte da equipe de moderação e está aqui para te ajudar'; }
                else if (t === 'LINDA DE MORRER' || t === 'Do Biel') { c = 'ls-tag-linda'; text = 'LINDA DE MORRER'; title = 'Essa pessoa é considerada muito linda por quem deu a tag a ela.'; }
                else if (t === 'VERIFICADO') { c = 'ls-tag-verified'; text = '✓'; title = 'Este usuário é verificado e com certeza não é um bot'; }
                else if (t === 'VIP') { c = 'ls-tag-vip'; title = 'Membro VIP - Apoiador da Comunidade'; }
                
                html += `<span class="ls-tag ${c}" title="${title}">${text}</span>`;
            });
        }
        return html;
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
        if (!target) return;

        const host = document.createElement('div');
        host.id = 'lidysync-host';
        host.style.cssText = 'position: fixed !important; bottom: 90px !important; right: 20px !important; z-index: 2147483647 !important; pointer-events: none !important;';
        
        const shadow = host.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        
        style.textContent = `
            * { box-sizing: border-box; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; }
            #ls-wrapper { 
                --bg-base: #020617; 
                --bg-surface: #0f172a; 
                --bg-elevated: #1e293b;
                --bg-overlay: rgba(2, 6, 23, 0.85); 
                --bg-modal: #0f172a; 
                --text-primary: #f9fafb; 
                --text-secondary: #94a3b8;
                --text-muted: #64748b; 
                --border-color: rgba(255,255,255,0.06); 
                --glass-blur: blur(16px); 
                --received-msg: #1e293b; 
                --highlight: #06b6d4;
                --fab-bg: linear-gradient(135deg, #5b5cf6, #7c3aed); 
                --fab-color: #ffffff; 
                --fab-shadow: 0 8px 25px rgba(91, 92, 246, 0.4); 
                --btn-primary-bg: linear-gradient(135deg, #5b5cf6, #7c3aed); 
                --btn-primary-color: #ffffff; 
                --btn-primary-shadow: rgba(91, 92, 246, 0.4);
                --btn-secondary-bg: #1e293b; 
                pointer-events: auto; display: flex; flex-direction: column; align-items: flex-end; position: relative; 
            }
            
            #ls-wrapper.theme-light { 
                --bg-base: #f8fafc; 
                --bg-surface: #ffffff; 
                --bg-elevated: #f1f5f9;
                --bg-overlay: rgba(248, 250, 252, 0.85); 
                --bg-modal: #ffffff; 
                --text-primary: #020617; 
                --text-secondary: #475569;
                --text-muted: #64748b; 
                --border-color: #e2e8f0; 
                --received-msg: #f1f5f9; 
                --fab-bg: linear-gradient(135deg, #5b5cf6, #7c3aed); 
                --fab-color: #ffffff; 
                --fab-shadow: 0 8px 25px rgba(91, 92, 246, 0.3); 
                --btn-primary-bg: linear-gradient(135deg, #5b5cf6, #7c3aed); 
                --btn-primary-shadow: rgba(91, 92, 246, 0.3);
                --btn-secondary-bg: #f1f5f9; 
            }
            
            #ls-wrapper.theme-glass { 
                --bg-base: rgba(2, 6, 23, 0.35); 
                --bg-surface: rgba(15, 23, 42, 0.55); 
                --bg-elevated: rgba(30, 41, 59, 0.65);
                --bg-overlay: rgba(2, 6, 23, 0.85); 
                --bg-modal: rgba(15, 23, 42, 0.95); 
                --border-color: rgba(255,255,255,0.1); 
                --glass-blur: blur(16px); 
                --received-msg: rgba(255, 255, 255, 0.1); 
                --fab-bg: rgba(255, 255, 255, 0.15); 
                --fab-color: #ffffff; 
                --fab-shadow: 0 8px 25px rgba(0, 0, 0, 0.4); 
                --btn-primary-bg: rgba(255, 255, 255, 0.2); 
                --btn-primary-color: #ffffff; 
                --btn-primary-shadow: rgba(0, 0, 0, 0.3);
                --btn-secondary-bg: rgba(0, 0, 0, 0.3); 
            }
            
            #ls-wrapper.theme-hellokitty { 
                --bg-base: #fff1f2; 
                --bg-surface: #ffffff; 
                --bg-elevated: #ffe4e6;
                --bg-overlay: rgba(255, 241, 242, 0.85); 
                --bg-modal: #ffffff; 
                --text-primary: #be123c; 
                --text-secondary: #fb7185;
                --text-muted: #fda4af; 
                --border-color: rgba(225, 29, 72, 0.15); 
                --received-msg: #ffe4e6; 
                --highlight: #e11d48;
                --fab-bg: linear-gradient(135deg, #fb7185, #e11d48); 
                --fab-shadow: 0 8px 25px rgba(225, 29, 72, 0.3); 
                --btn-primary-bg: linear-gradient(135deg, #fb7185, #e11d48); 
                --btn-primary-shadow: rgba(225, 29, 72, 0.3);
                --btn-secondary-bg: #ffe4e6; 
            }

            ::-webkit-scrollbar { width: 6px; } 
            ::-webkit-scrollbar-thumb { background: var(--text-muted); border-radius: 6px; opacity: 0.5; transition: 0.2s; }
            ::-webkit-scrollbar-thumb:hover { background: var(--highlight); }

            #ls-fab { width: 60px; height: 60px; background: var(--fab-bg); color: var(--fab-color); border-radius: 50%; display: flex; justify-content: center; align-items: center; cursor: pointer; box-shadow: var(--fab-shadow); backdrop-filter: var(--glass-blur); -webkit-backdrop-filter: var(--glass-blur); transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s; position: relative; }
            #ls-fab:hover { transform: scale(1.08); box-shadow: 0 12px 30px rgba(0,0,0,0.4); } 
            #ls-fab svg { stroke: currentColor; } #ls-fab svg polygon { fill: currentColor; stroke: currentColor; }
            
            #ls-unread-badge { position: absolute; top: -4px; right: -4px; background: #ef4444; color: white; font-size: 12px; font-weight: 800; border-radius: 50%; min-width: 22px; height: 22px; display: none; align-items: center; justify-content: center; border: 2px solid var(--bg-base); z-index: 10; padding: 0 4px; }
            
            #ls-chat-window { width: 350px; height: 580px; background-color: var(--bg-base); border-radius: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.4); display: none; flex-direction: column; margin-bottom: 15px; overflow: hidden; border: 1px solid var(--border-color); position: relative; backdrop-filter: var(--glass-blur); -webkit-backdrop-filter: var(--glass-blur); transition: background-color 0.3s, backdrop-filter 0.3s; resize: both; min-width: 300px; min-height: 400px; max-width: 90vw; max-height: 90vh; }
            #ls-chat-window.open { display: flex; animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
            #ls-chat-window.integrated { position: absolute !important; top: 0 !important; right: 0 !important; bottom: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; max-height: 100vh !important; border-radius: 0 !important; margin: 0 !important; border: none !important; border-left: 1px solid var(--border-color) !important; resize: none !important; box-shadow: -5px 0 25px rgba(0,0,0,0.4) !important; }
            #ls-chat-window.integrated #ls-close-btn, #ls-chat-window.integrated #ls-minimize-btn { display: none !important; } #ls-chat-window.integrated #ls-header { cursor: default !important; }
            
            @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
            
            #ls-header { background-color: var(--bg-overlay); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); color: var(--text-primary); padding: 16px; display: flex; justify-content: space-between; align-items: center; font-size: 15px; font-weight: 600; z-index: 10; border-bottom: 1px solid var(--border-color); cursor: grab; }
            #ls-header:active { cursor: grabbing; } 
            
            #ls-header-text { transition: color 0.2s; }
            #ls-header-text.clickable { cursor: pointer; }
            #ls-header-text.clickable:hover { color: var(--highlight); }

            .ls-header-btns { display: flex; gap: 8px; align-items: center; cursor: default; } 
            .ls-header-btn { cursor: pointer; color: var(--text-muted); font-size: 18px; background: none; border: none; transition: all 0.2s; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px;} 
            .ls-header-btn:hover { color: var(--highlight); background: rgba(128,128,128,0.1); }
            
            .ls-dropdown-container { position: relative; } 
            .ls-dropdown-menu { position: absolute; right: 0; top: calc(100% + 5px); background-color: var(--bg-overlay); border: 1px solid var(--border-color); border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.4); display: none; flex-direction: column; min-width: 200px; z-index: 50; overflow: hidden; backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); } 
            .ls-dropdown-menu.show { display: flex; animation: fadeIn 0.15s ease-out; } 
            @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } } 
            .ls-dropdown-item { padding: 12px 16px; color: var(--text-primary); font-size: 13.5px; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: 0.2s; background: none; border: none; text-align: left; width: 100%; font-weight: 500; } 
            .ls-dropdown-item:hover { background-color: rgba(128,128,128,0.1); color: var(--highlight); } 
            .ls-dropdown-item.danger:hover { color: #ef4444; background-color: rgba(239, 68, 68, 0.1); }
            
            .ls-screen { flex: 1; display: none; flex-direction: column; padding: 20px; background-color: transparent; gap: 16px; position: relative; overflow-y: auto;}
            
            #ls-room-list { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; padding-bottom: 70px; } 
            .ls-room-item { display: flex; align-items: center; padding: 12px; background: rgba(128,128,128,0.05); border: 1px solid var(--border-color); border-radius: 12px; cursor: pointer; transition: 0.2s; position: relative; } 
            .ls-room-item:hover { background: rgba(128,128,128,0.1); border-color: var(--highlight); } 
            .ls-room-avatar { width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, #5b5cf6, #7c3aed); display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px; color: white; margin-right: 12px; flex-shrink: 0; position: relative; background-size: cover !important; background-position: center !important; } 
            .ls-online-dot { position: absolute; bottom: 0; right: 0; width: 12px; height: 12px; background: #22c55e; border-radius: 50%; border: 2px solid var(--bg-surface); display: none; } 
            .ls-room-info { flex: 1; overflow: hidden; } 
            .ls-room-name { color: var(--text-primary); font-weight: 600; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 6px; } 
            .ls-room-status { color: var(--text-muted); font-size: 12px; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } 
            .ls-room-unread { width: 10px; height: 10px; background: #ef4444; border-radius: 50%; display: none; margin-left: 8px; flex-shrink: 0; } 
            .ls-room-options { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 8px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: 0.2s; margin-left: 4px; } 
            .ls-room-options:hover { background: rgba(128,128,128,0.1); color: var(--highlight); }
            
            .ls-tags-container { display: inline-flex; gap: 4px; align-items: center; vertical-align: middle; flex-wrap: wrap; } 
            .ls-tag { font-size: 8px; font-weight: 800; padding: 2px 5px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px; cursor: help; } 
            .ls-tag-host { background-color: #ef4444; color: #ffffff; } 
            .ls-tag-dev { background-color: #facc15; color: #000000; } 
            .ls-tag-owner { background-color: #5b21b6; color: #ffffff; } 
            .ls-tag-mod { background-color: #3b82f6; color: #ffffff; } 
            .ls-tag-linda { background-color: #fbcfe8; color: #be185d; } 
            .ls-tag-generic { background-color: rgba(128,128,128,0.2); color: inherit; }
            .ls-tag-vip { background: linear-gradient(135deg, #facc15, #eab308) !important; color: #000000 !important; border: 1px solid #ca8a04 !important; font-weight: 900 !important; text-shadow: none !important; }
            .ls-tag-verified { background-color: #0ea5e9 !important; color: #ffffff !important; border-radius: 50% !important; width: 14px !important; height: 14px !important; display: inline-flex !important; justify-content: center; align-items: center; padding: 0 !important; font-size: 9px !important; border: 1px solid #ffffff; box-shadow: 0 0 4px rgba(14, 165, 233, 0.6); }
            
            #ls-fab-add { position: absolute; bottom: 20px; right: 20px; width: 50px; height: 50px; background: var(--fab-bg); color: var(--fab-color); border-radius: 50%; display: flex; justify-content: center; align-items: center; cursor: pointer; box-shadow: var(--fab-shadow); font-size: 24px; transition: 0.2s; z-index: 20; border: none; backdrop-filter: var(--glass-blur); -webkit-backdrop-filter: var(--glass-blur); } 
            #ls-fab-add:hover { transform: scale(1.1); box-shadow: 0 12px 30px rgba(0,0,0,0.4); }
            
            .ls-modal-overlay { position: absolute; top: 54px; left: 0; width: 100%; height: calc(100% - 54px); background-color: var(--bg-modal); z-index: 30; display: none; flex-direction: column; overflow-y: auto; overflow-x: hidden; }
            
            .ls-modal-overlay-card { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(2, 6, 23, 0.75); z-index: 70; display: none; align-items: center; justify-content: center; backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px); }
            .ls-profile-card { background: var(--bg-surface); width: 90%; max-width: 360px; border-radius: 20px; border: 1px solid var(--border-color); display: flex; flex-direction: column; position: relative; box-shadow: 0 25px 50px rgba(0,0,0,0.6); max-height: 90%; overflow: hidden; }
            #ls-close-profile-modal { position: absolute; top: 12px; right: 12px; background: rgba(0,0,0,0.6); border: none; color: white; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 20; font-size: 16px; transition: 0.2s; backdrop-filter: blur(4px); }
            #ls-close-profile-modal:hover { background: rgba(0,0,0,0.9); transform: scale(1.1); color: var(--highlight); }
            .ls-profile-scrollable { flex: 1; overflow-y: auto; min-height: 0; display: flex; flex-direction: column; padding-bottom: 20px; }
            .ls-profile-banner { height: 130px; background: linear-gradient(135deg, #5b5cf6, #7c3aed); position: relative; background-size: cover !important; background-position: center !important; width: 100%; flex-shrink: 0; }
            .ls-profile-avatar-large { width: 85px; height: 85px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 36px; font-weight: bold; color: white; box-shadow: 0 4px 15px rgba(0,0,0,0.4); flex-shrink: 0; position: relative; border: 5px solid var(--bg-surface); background: var(--bg-surface); background-size: cover !important; background-position: center !important; z-index: 2; margin-top: -42px; }
            .ls-profile-status-indicator { position: absolute; bottom: 2px; right: 2px; width: 16px; height: 16px; border-radius: 50%; border: 3px solid var(--bg-surface); }
            .ls-profile-bio-box { background: rgba(128,128,128,0.05); padding: 12px 16px; border-radius: 10px; border-left: 3px solid var(--highlight); margin-top: 12px; font-size: 13.5px; line-height: 1.5; color: var(--text-primary); }
            .ls-profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; }
            .ls-profile-stat-box { background: var(--bg-elevated); border: 1px solid var(--border-color); padding: 12px; border-radius: 10px; text-align: center; }
            .ls-profile-stat-value { font-size: 18px; font-weight: 700; color: var(--text-primary); display: block; margin-top: 4px; }
            .ls-profile-stat-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; }

            .ls-modal-content { padding: 24px; display: flex; flex-direction: column; gap: 16px; }
            .ls-label { color: var(--text-muted); font-size: 12px; font-weight: 600; margin-bottom: 6px; display: block; text-transform: uppercase; letter-spacing: 0.5px; }
            .ls-input-wrapper { position: relative; width: 100%; display: flex; align-items: center; } 
            .ls-input-text, .ls-select, .ls-textarea, .ls-input-file { background-color: var(--bg-elevated); border: 1px solid var(--border-color); border-radius: 10px; padding: 12px; color: var(--text-primary); outline: none; font-size: 14px; width: 100%; transition: all 0.2s; } 
            .ls-input-text:focus, .ls-select:focus, .ls-textarea:focus { border-color: var(--highlight); box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.15); } 
            .ls-textarea { resize: vertical; min-height: 80px; } 
            .ls-pass-toggle { position: absolute; right: 12px; background: none; border: none; cursor: pointer; color: var(--text-muted); display: flex; align-items: center; justify-content: center; padding: 4px; border-radius: 4px; transition: 0.2s; } 
            .ls-pass-toggle:hover { color: var(--highlight); background: rgba(128,128,128,0.1); }
            .ls-input-color { width: 100%; height: 42px; border: none; border-radius: 10px; cursor: pointer; background: none; padding: 0; } 
            .ls-input-color::-webkit-color-swatch-wrapper { padding: 0; } 
            .ls-input-color::-webkit-color-swatch { border: 1px solid var(--border-color); border-radius: 10px; }
            .ls-checkbox-group { display: flex; align-items: flex-start; gap: 10px; color: var(--text-primary); font-size: 13.5px; margin-top: 5px; cursor: pointer; line-height: 1.5; }
            
            .ls-btn-primary { background: var(--btn-primary-bg); color: var(--btn-primary-color); border: none; border-radius: 10px; padding: 14px; font-weight: 600; cursor: pointer; margin-top: 10px; transition: all 0.2s; width: 100%; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); } 
            .ls-btn-primary:hover { transform: translateY(-1px); filter: brightness(1.08); box-shadow: 0 6px 16px var(--btn-primary-shadow); } 
            .ls-btn-secondary { background-color: var(--btn-secondary-bg); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 10px; padding: 14px; font-weight: 600; cursor: pointer; transition: 0.2s; width: 100%; font-size: 14px; } 
            .ls-btn-secondary:hover { filter: brightness(1.08); border-color: var(--highlight); color: var(--highlight); } 
            .ls-btn-danger { background-color: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 10px; padding: 14px; font-weight: 600; cursor: pointer; transition: 0.2s; width: 100%; font-size: 14px; } 
            .ls-btn-danger:hover { background-color: #ef4444; color: white; }
            
            .ls-config-section { background: rgba(128,128,128,0.05); padding: 16px; border-radius: 12px; border: 1px solid var(--border-color); margin-bottom: 8px;}
            
            #ls-chat-area { flex: 1; display: none; flex-direction: column; overflow: hidden; position: relative; } 
            #ls-messages { flex: 1; padding: 20px 16px 8px; overflow-y: auto; background-color: transparent; display: flex; flex-direction: column; gap: 14px; }
            #ls-reply-bar { display: none; background: var(--bg-elevated); padding: 8px 12px; border-left: 3px solid var(--highlight); margin: 0 16px 10px; border-radius: 4px; font-size: 12px; color: var(--text-muted); position: relative; border: 1px solid var(--border-color); } 
            #ls-reply-bar-close { position: absolute; right: 8px; top: 8px; cursor: pointer; font-size: 14px; color: inherit; border: none; background: none; transition: 0.2s; }
            #ls-reply-bar-close:hover { color: var(--highlight); }
            
            #ls-mention-panel { position: absolute; bottom: 60px; left: 16px; background-color: var(--bg-overlay); border: 1px solid var(--border-color); border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.4); display: none; flex-direction: column; min-width: 150px; max-height: 180px; overflow-y: auto; z-index: 50; padding: 4px 0; backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); } 
            .ls-mention-item { padding: 8px 16px; color: var(--text-primary); font-size: 13px; cursor: pointer; font-weight: 500; } 
            .ls-mention-item:hover, .ls-mention-item.active { background-color: rgba(128,128,128,0.15); color: var(--highlight); }
            
            .ls-message-container { display: flex; flex-direction: column; max-width: 85%; position: relative; } 
            .ls-message-container.sent { align-self: flex-end; align-items: flex-end; } 
            .ls-message-container.received { align-self: flex-start; align-items: flex-start; }
            
            .ls-sender-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; padding: 0 4px; } 
            .ls-sender-name { font-size: 11px; color: var(--text-muted); font-weight: 600; letter-spacing: 0.3px; cursor: pointer; transition: 0.2s; } 
            .ls-sender-name:hover { text-decoration: underline; color: var(--highlight); } 
            .ls-msg-time { font-size: 9px; color: var(--text-muted); opacity: 0.7; font-weight: normal; margin-left: 4px; }
            
            .ls-msg-action { display: none; cursor: pointer; font-size: 13px; filter: grayscale(100%); transition: 0.2s; opacity: 0.6; margin: 0 2px; } 
            .ls-msg-action:hover { filter: grayscale(0%); opacity: 1; transform: scale(1.1); } 
            .ls-message-container:hover .ls-msg-action { display: inline-block; }
            
            .ls-message { padding: 10px 14px; font-size: 14px; line-height: 1.45; color: #ffffff; word-wrap: break-word; word-break: break-word; white-space: pre-wrap; overflow-wrap: anywhere; box-shadow: 0 2px 8px rgba(0,0,0,0.15); max-width: 100%; overflow-x: hidden; } 
            .ls-message img { max-width: 100%; border-radius: 8px; display: block; margin-top: 4px; cursor: pointer; transition: transform 0.2s; } 
            .ls-message img:hover { transform: scale(1.02); opacity: 0.9; }
            
            .ls-message-container.system-msg-container { max-width: 95%; align-self: center; margin: 6px 0; } 
            .ls-message.system-msg { background: rgba(128, 128, 128, 0.1) !important; color: var(--text-muted); text-align: center; font-weight: 500; border-radius: 12px !important; font-size: 12px; border: 1px solid rgba(128, 128, 128, 0.2); box-shadow: none; padding: 6px 12px; } 
            .ls-message.deleted-msg { background-color: transparent !important; color: var(--text-muted); font-style: italic; border: 1px solid var(--border-color); border-radius: 12px !important; font-size: 13px; box-shadow: none; }
            
            .sent .ls-message:not(.deleted-msg) { border-radius: 14px 14px 4px 14px; } 
            .received .ls-message:not(.deleted-msg) { border-radius: 14px 14px 14px 4px; background-color: var(--received-msg) !important; border: 1px solid var(--border-color); }
            
            #ls-input-area { display: flex; padding: 12px 16px; background-color: var(--bg-overlay); gap: 10px; align-items: center; position: relative; flex-wrap: nowrap; border-top: 1px solid var(--border-color); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); } 
            .ls-icon-btn { flex-shrink: 0; background: none; border: none; color: var(--text-muted); font-size: 22px; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 4px; transition: all 0.2s; border-radius: 8px; } 
            .ls-icon-btn:hover { color: var(--highlight); background: rgba(128,128,128,0.1); transform: scale(1.05); }
            
            #ls-input { flex-grow: 1; min-width: 0; background-color: var(--bg-elevated); border: 1px solid var(--border-color); border-radius: 20px; padding: 10px 16px; color: var(--text-primary); outline: none; font-size: 14px; transition: 0.2s; } 
            #ls-input:focus { border-color: var(--highlight); }
            
            #ls-send-btn { flex-shrink: 0; background: var(--btn-primary-bg); color: var(--btn-primary-color); border: none; border-radius: 50%; width: 40px; height: 40px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); transition: all 0.2s; } 
            #ls-send-btn:hover { transform: scale(1.05); filter: brightness(1.1); box-shadow: 0 4px 12px var(--btn-primary-shadow);}
            
            .ls-popup-panel { position: absolute; bottom: 70px; background-color: var(--bg-overlay); border-radius: 16px; padding: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.4); display: none; z-index: 20; border: 1px solid var(--border-color); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); } 
            #ls-emoji-panel { left: 16px; width: 280px; display: flex; flex-wrap: wrap; gap: 6px; padding: 12px; } 
            .ls-emoji-item { font-size: 20px; cursor: pointer; text-align: center; border-radius: 8px; transition: 0.1s; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; } 
            .ls-emoji-item:hover { background-color: rgba(128,128,128,0.1); transform: scale(1.1); }
            
            #ls-plus-panel { left: 16px; width: 280px; flex-direction: column; gap: 4px; } 
            .ls-action-item { color: var(--text-primary); padding: 12px; cursor: pointer; font-size: 14px; border-radius: 10px; display: flex; align-items: center; gap: 10px; font-weight: 500; transition: 0.2s; } 
            .ls-action-item:hover { background-color: rgba(128,128,128,0.1); color: var(--highlight); }
            
            #ls-countdown-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(2, 6, 23, 0.85); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); z-index: 100; display: none; flex-direction: column; justify-content: center; align-items: center; } 
            #ls-countdown-number { font-size: 110px; font-weight: 700; color: var(--highlight); text-shadow: 0 0 40px rgba(6, 182, 212, 0.5); animation: pop 1s infinite; letter-spacing: -2px; } 
            #ls-countdown-text { color: var(--text-secondary); font-size: 16px; margin-top: 15px; font-weight: 500; letter-spacing: 0.5px;} 
            @keyframes pop { 0% { transform: scale(0.8); opacity: 0.5; } 50% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); opacity: 0.8; } }
            
            #ls-image-viewer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); z-index: 200; display: none; align-items: center; justify-content: center; flex-direction: column; opacity: 0; transition: opacity 0.2s; } 
            #ls-image-viewer.show { opacity: 1; } 
            #ls-viewer-img { max-width: 90%; max-height: 85%; border-radius: 8px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); object-fit: contain; transform: scale(0.95); transition: transform 0.2s; cursor: default; } 
            #ls-image-viewer.show #ls-viewer-img { transform: scale(1); } 
            #ls-close-viewer { position: absolute; top: 16px; right: 16px; background: rgba(0,0,0,0.5); border: none; color: white; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: 0.2s; } 
            #ls-close-viewer:hover { background: rgba(0,0,0,0.8); transform: scale(1.1); color: var(--highlight); }
            
            #ls-party-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 300; display: none; align-items: center; justify-content: center; overflow: hidden; pointer-events: none; }
            .party-active { animation: discoBg 1s infinite alternate; }
            @keyframes discoBg { 0% { background: rgba(255, 0, 0, 0.4); } 25% { background: rgba(0, 255, 0, 0.4); } 50% { background: rgba(0, 0, 255, 0.4); } 75% { background: rgba(255, 255, 0, 0.4); } 100% { background: rgba(255, 0, 255, 0.4); } }
            .party-dancer { position: absolute; font-size: 50px; animation: dance 0.5s infinite alternate; }
            @keyframes dance { 0% { transform: translateY(0) scale(1) rotate(-10deg); } 100% { transform: translateY(-20px) scale(1.2) rotate(10deg); } }
            #ls-disco-ball { font-size: 80px; position: absolute; top: -100px; transition: top 1s ease-out; animation: spin 2s linear infinite; }
            #ls-disco-ball.drop { top: 20px; }
            @keyframes spin { 100% { transform: rotate(360deg); } }
            
            :root { --ls-chat-width: 350px; }
            html.ls-integrated-active { margin-right: var(--ls-chat-width) !important; width: calc(100% - var(--ls-chat-width)) !important; }
            body.ls-integrated-active { max-width: calc(100vw - var(--ls-chat-width)) !important; }
            
            .ls-integrated-active .html5-video-player, .ls-integrated-active #ytd-player,
            .ls-integrated-active .nf-player-container, .ls-integrated-active .watch-video,
            .ls-integrated-active .webPlayerContainer, .ls-integrated-active .scaling-video-container, .ls-integrated-active .dv-player-fullscreen,
            .ls-integrated-active div[data-testid="player-container"], .ls-integrated-active div[data-testid="default-player"],
            .ls-integrated-active #app_body_content, .ls-integrated-active .btm-media-client-element,
            .ls-integrated-active .video-player-wrapper, .ls-integrated-active #vilos-player,
            .ls-integrated-active .player-wrapper {
                width: calc(100vw - var(--ls-chat-width)) !important;
                max-width: calc(100vw - var(--ls-chat-width)) !important;
                right: auto !important;
            }
            .ls-integrated-active .ytp-chrome-bottom, 
            .ls-integrated-active .nf-player-controls, 
            .ls-integrated-active .dv-player-controls,
            .ls-integrated-active .bottom-controls,
            .ls-integrated-active [data-testid="player-controls"] {
                width: calc(100vw - var(--ls-chat-width)) !important;
                max-width: calc(100vw - var(--ls-chat-width)) !important;
            }
        `;

        const emojis = ['😀','😂','😍','🥰','😎','😭','😡','😱','🍿','🎬','🍕','🥂','👍','👎','❤️','🔥'];
        const svgEye = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
        const svgEyeOff = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

        const wrapper = document.createElement('div');
        wrapper.id = 'ls-wrapper';
        wrapper.className = ls.getItem('ls_theme') !== null ? ls.getItem('ls_theme') : ''; 
        
        wrapper.innerHTML = `
            <div id="ls-chat-window">
                <div id="ls-header">
                    <span id="ls-header-title" style="display:flex; align-items:center; gap:8px; user-select:none;">
                        <button class="ls-header-btn" id="ls-back-btn" style="display:none; margin-left:-8px; margin-right:4px;" title="Voltar ao Lobby"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path><polygon points="10.5,9 15.5,12 10.5,15" fill="currentColor" stroke="currentColor" stroke-width="1"></polygon></svg>
                        <span id="ls-header-text" title="Ver membros da sala">LidySync</span>
                    </span>
                    <div class="ls-header-btns">
                        <button class="ls-header-btn" id="ls-lobby-settings-btn" title="Configurações" style="display:none;">⚙️</button>
                        <div class="ls-dropdown-container" id="ls-chat-menu-container" style="display:none;">
                            <button class="ls-header-btn" id="ls-chat-menu-btn" title="Opções da Sala">⋮</button>
                            <div class="ls-dropdown-menu" id="ls-chat-dropdown">
                                <button class="ls-dropdown-item" id="ls-menu-share">🔗 Compartilhar Sala</button>
                                <button class="ls-dropdown-item" id="ls-menu-members">👥 Ver Membros</button>
                                <button class="ls-dropdown-item" id="ls-menu-theater">🖥️ Modo Teatro</button>
                                <button class="ls-dropdown-item" id="ls-menu-settings">⚙️ Configurações da Sala</button>
                                <div style="height:1px; background:var(--border-color); margin:4px 0;" id="ls-menu-delete-divider"></div>
                                <button class="ls-dropdown-item danger" id="ls-menu-leave" style="display:none;">🚪 Sair da Sala</button>
                                <button class="ls-dropdown-item danger" id="ls-menu-delete">🗑️ Encerrar Sala</button>
                            </div>
                        </div>
                        <button class="ls-header-btn" id="ls-minimize-btn" title="Minimizar"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg></button>
                        <button class="ls-header-btn" id="ls-close-btn" title="Fechar App"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
                    </div>
                </div>
                
                <div id="ls-setup-area" class="ls-screen ls-modal-content">
                    <div style="text-align: center; margin-bottom: 10px;">
                        <span style="font-size: 32px; font-weight: 800; background: linear-gradient(135deg, #5b5cf6, #7c3aed); -webkit-background-clip: text; -webkit-text-fill-color: transparent; display: block; margin-bottom: 4px;">LidySync</span>
                        <span style="color: var(--text-primary); font-size: 16px; font-weight: 600;">Bem-vindo!</span>
                    </div>
                    <div><span class="ls-label">Nome de Usuário</span><input type="text" class="ls-input-text" id="ls-setup-name" placeholder="Adicione seu apelido" maxlength="100" /></div>
                    <div>
                        <span class="ls-label">PIN de Acesso (Mín. 4 dígitos)</span>
                        <input type="password" class="ls-input-text" id="ls-setup-pin" placeholder="Ex: 1234" maxlength="8" />
                        <div style="text-align: right; margin-top: 4px;"><span id="ls-forgot-pin" style="color: var(--text-muted); font-size: 11px; cursor: pointer; text-decoration: underline;">Esqueci meu PIN</span></div>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <div style="flex:1;"><span class="ls-label">Cor da Bolha</span><input type="color" class="ls-input-color" id="ls-setup-color" value="#5b5cf6" /></div>
                        <div style="flex:1;"><span class="ls-label">Cor do Texto</span><input type="color" class="ls-input-color" id="ls-setup-textcolor" value="#ffffff" /></div>
                    </div>
                    <div style="display: flex; gap: 8px; margin-top: 10px;">
                        <button class="ls-btn-primary" id="ls-login-btn" style="flex: 1; margin-top: 0;">Entrar</button>
                        <button class="ls-btn-secondary" id="ls-register-btn" style="flex: 1; margin-top: 0;">Registrar</button>
                    </div>
                    <label class="ls-checkbox-group" style="margin-top:12px; justify-content: center;">
                        <input type="checkbox" id="ls-setup-keep" checked>
                        <span style="font-weight: 500;">Manter logado</span>
                    </label>
                </div>

                <div id="ls-lobby-area" class="ls-screen" style="padding: 16px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color: var(--text-primary); font-size: 18px; font-weight: 700;">Meus Chats</span></div>
                    <div id="ls-room-list"></div>
                    <button id="ls-fab-add" title="Nova Sala">+</button>
                </div>

                <div id="ls-lobby-settings-overlay" class="ls-modal-overlay" style="top: 54px; height: calc(100% - 54px);">
                    <div class="ls-modal-content">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="color: var(--text-primary); font-size: 20px; font-weight: 700;">Configurações</span>
                            <button id="ls-close-lobby-modal" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:16px;">✕</button>
                        </div>
                        <div class="ls-config-section"><span class="ls-label">Sua Conta</span><button class="ls-btn-secondary" id="ls-btn-open-my-profile">👤 Ver Meu Perfil</button></div>
                        <div class="ls-config-section">
                            <span class="ls-label">Preferências Globais</span>
                            <select class="ls-select" id="ls-app-theme" style="margin-bottom: 12px;">
                                <option value="">Tema Escuro (Padrão)</option><option value="theme-glass">Tema Glassmorfismo</option><option value="theme-light">Tema Claro</option><option value="theme-hellokitty">Tema Hello Kitty</option>
                            </select>
                            <label class="ls-checkbox-group"><input type="checkbox" id="ls-app-sound" checked><span><b>Mudo (Sem Sons)</b><br><small style="color: var(--text-muted);">Desmarque para mutar todos os sons.</small></span></label>
                            <label class="ls-checkbox-group"><input type="checkbox" id="ls-app-inchatsound" checked><span><b>Sons no Chat</b><br><small style="color: var(--text-muted);">Sons rápidos ao enviar e receber.</small></span></label>
                            <label class="ls-checkbox-group"><input type="checkbox" id="ls-app-hidesys"><span><b>Ocultar Entrada/Saída</b><br><small style="color: var(--text-muted);">Não mostra no chat quem entrou ou saiu.</small></span></label>
                        </div>
                        <div class="ls-config-section">
                            <span class="ls-label">Visibilidade do App</span>
                            <label class="ls-checkbox-group"><input type="checkbox" id="ls-app-hide"><span><b>Modo Silencioso (Ocultar)</b><br><small style="color: var(--text-muted);">Some ao fechar. Requer F5 para voltar.</small></span></label>
                            <label class="ls-checkbox-group"><input type="checkbox" id="ls-app-revive" checked><span><b>Despertar com Notificação</b><br><small style="color: var(--text-muted);">Reaparece se chegar mensagem.</small></span></label>
                            <label class="ls-checkbox-group"><input type="checkbox" id="ls-app-integrated"><span><b>Modo Teatro (Integrado)</b><br><small style="color: var(--text-muted);">Fixa o chat na direita da tela.</small></span></label>
                        </div>
                        <div class="ls-config-section" style="margin-top:auto;"><button class="ls-btn-danger" id="ls-wipe-data-btn">Desconectar e Apagar Dados</button></div>
                        <button class="ls-btn-primary" id="ls-save-lobby-config-btn" style="margin-top: 0;">Salvar Alterações</button>
                        <div style="text-align: center; margin-top: 8px; color: var(--text-muted); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Versão Atual - 89.0</div>
                    </div>
                </div>

                <div id="ls-profile-overlay" class="ls-modal-overlay-card">
                    <div class="ls-profile-card">
                        <button id="ls-close-profile-modal" title="Fechar Perfil">✕</button>
                        
                        <div id="ls-profile-view" class="ls-profile-scrollable">
                            <div class="ls-profile-banner" id="ls-profile-v-banner"></div>
                            <div style="display: flex; justify-content: space-between; align-items: flex-end; padding: 0 20px;">
                                <div class="ls-profile-avatar-large" id="ls-profile-v-avatar"><div class="ls-profile-status-indicator" id="ls-profile-v-status"></div></div>
                                <button id="ls-btn-edit-profile" class="ls-btn-secondary" style="width: auto; padding: 8px 16px; font-size: 13px; margin-bottom: 5px; border-radius: 20px; z-index: 5;">Editar Perfil</button>
                            </div>
                            <div style="padding: 16px 20px 0;">
                                <div style="font-size:24px; font-weight:800; color:var(--text-primary); display: flex; align-items: center; gap: 8px;" id="ls-profile-v-name">-</div>
                                <div style="font-size:14px; color:var(--text-muted); margin-top:4px;" id="ls-profile-v-statustext">-</div>
                            </div>
                            <div style="padding: 0 20px; margin-top: 14px;">
                                <div class="ls-tags-container" id="ls-profile-v-tags"></div>
                            </div>
                            <div style="padding: 0 20px; margin-top: 16px;">
                                <div class="ls-profile-bio-box" id="ls-profile-v-bio" style="margin-top:0;">-</div>
                            </div>
                            <div style="padding: 0 20px; margin-top: 16px; display: none;" id="ls-profile-v-fav-container">
                                <span style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">🍿 Assistindo / Favorito</span>
                                <div style="color: var(--text-primary); font-size: 15px; font-weight: 600; margin-top: 6px; background: rgba(128,128,128,0.05); padding: 10px 14px; border-radius: 10px; border: 1px solid var(--border-color);" id="ls-profile-v-fav">-</div>
                            </div>
                            <div class="ls-profile-grid" style="padding: 20px;">
                                <div class="ls-profile-stat-box"><span class="ls-profile-stat-label">Chats Activos</span><span class="ls-profile-stat-value" id="ls-profile-v-rooms">-</span></div>
                                <div class="ls-profile-stat-box"><span class="ls-profile-stat-label">Membro desde</span><span class="ls-profile-stat-value" style="font-size:15px;" id="ls-profile-v-created">-</span></div>
                            </div>
                        </div>

                        <div id="ls-profile-edit" class="ls-profile-scrollable ls-modal-content" style="display: none; padding: 20px;">
                            <div style="font-size: 20px; font-weight: 800; color: var(--text-primary); margin-bottom: 16px; text-align: center;">Editar Perfil</div>
                            <div style="text-align:center; margin-bottom: 10px;"><div class="ls-profile-avatar-large" id="ls-profile-e-avatar" style="margin: 0 auto; color: var(--text-primary); margin-top: 0;"></div></div>
                            <div style="display: flex; gap: 10px;">
                                <div style="flex:1;"><span class="ls-label">Foto (Avatar)</span>
                                    <div style="display:flex; gap:8px;">
                                        <input type="file" id="ls-profile-e-avatar-file" accept="image/*" class="ls-input-file" style="padding: 8px; font-size:12px;" />
                                        <button id="ls-profile-e-avatar-clear" class="ls-btn-danger" style="width:auto; padding:8px; margin:0;" title="Remover Foto">🗑️</button>
                                    </div>
                                </div>
                            </div>
                            <div style="display: flex; gap: 10px;">
                                <div style="flex:1;"><span class="ls-label">Capa (Fundo)</span>
                                    <div style="display:flex; gap:8px;">
                                        <input type="file" id="ls-profile-e-banner-file" accept="image/*" class="ls-input-file" style="padding: 8px; font-size:12px;" />
                                        <button id="ls-profile-e-banner-clear" class="ls-btn-danger" style="width:auto; padding:8px; margin:0;" title="Remover Capa">🗑️</button>
                                    </div>
                                </div>
                            </div>
                            <div style="display: flex; gap: 10px;">
                                <div style="flex:1;"><span class="ls-label">Cor Principal</span><input type="color" class="ls-input-color" id="ls-profile-e-color" /></div>
                                <div style="flex:1;"><span class="ls-label">Cor do Texto</span><input type="color" class="ls-input-color" id="ls-profile-e-textcolor" /></div>
                            </div>
                            <div><span class="ls-label">Filme/Série Favorita</span><input type="text" class="ls-input-text" id="ls-profile-e-fav" placeholder="O que você mais gosta?" maxlength="50" /></div>
                            <div><span class="ls-label">Bio</span><textarea class="ls-textarea" id="ls-profile-e-bio" placeholder="Fale um pouco sobre você..." maxlength="200"></textarea></div>
                            <label class="ls-checkbox-group" style="margin-top:5px;"><input type="checkbox" id="ls-profile-e-hiderooms"><span><b>Ocultar quantidade de chats ativos</b></span></label>
                            <div style="display: flex; gap: 10px; margin-top: 10px;">
                                <button class="ls-btn-secondary" id="ls-btn-cancel-profile">Cancelar</button>
                                <button class="ls-btn-primary" id="ls-btn-save-profile" style="margin-top:0;">Salvar Perfil</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div id="ls-add-room-overlay" class="ls-modal-overlay" style="top: 54px; height: calc(100% - 54px);">
                    <div class="ls-modal-content">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="color: var(--text-primary); font-size: 18px; font-weight: 700;">Nova Conexão</span>
                            <button id="ls-close-add-modal" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:16px;">✕</button>
                        </div>
                        <div><span class="ls-label">Nome da Sala</span><input type="text" class="ls-input-text" id="ls-lobby-room" placeholder="Max 80 caracteres" maxlength="80" /></div>
                        <div>
                            <span class="ls-label">Senha de Acesso (4 a 16 carac.)</span>
                            <div class="ls-input-wrapper"><input type="password" class="ls-input-text" id="ls-lobby-pass" placeholder="***" style="padding-right: 40px;" maxlength="16" /><button class="ls-pass-toggle" id="ls-toggle-pass-1">${svgEyeOff}</button></div>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;"><button class="ls-btn-primary" id="ls-join-room-btn">Entrar na Sala</button><button class="ls-btn-secondary" id="ls-create-room-btn">Criar Nova Sala</button></div>
                    </div>
                </div>

                <div id="ls-settings-overlay" class="ls-modal-overlay" style="top: 54px; height: calc(100% - 54px);">
                    <div class="ls-modal-content">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="color: var(--text-primary); font-size: 18px; font-weight: 700;">Configurações da Sala</span>
                            <button id="ls-close-settings-modal" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:16px;">✕</button>
                        </div>
                        <div class="ls-config-section">
                            <span class="ls-label">Sistema</span>
                            <label class="ls-checkbox-group"><input type="checkbox" id="ls-config-autoplay" checked><span>Tentar Play Automático pós-Countdown</span></label>
                        </div>
                        <button class="ls-btn-primary" id="ls-save-config-btn" style="margin-top: auto;">Salvar Alterações</button>
                    </div>
                </div>

                <div id="ls-members-overlay" class="ls-modal-overlay" style="top: 54px; height: calc(100% - 54px);">
                    <div class="ls-modal-content" style="height: 100%;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="color: var(--text-primary); font-size: 18px; font-weight: 700;">Membros da Sala</span>
                            <button id="ls-close-members-modal" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:16px;">✕</button>
                        </div>
                        <div id="ls-members-list" style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px; overflow-y: auto;"></div>
                    </div>
                </div>

                <div id="ls-camera-overlay" class="ls-modal-overlay" style="align-items: center; justify-content: center; background: rgba(0,0,0,0.9); padding: 20px;">
                    <div style="width: 100%; max-width: 320px; background: var(--bg-surface); padding: 16px; border-radius: 16px; display: flex; flex-direction: column; gap: 10px; border: 1px solid var(--border-color);">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="color: var(--text-primary); font-weight: bold; font-size: 16px;">Tirar Foto</span>
                            <button id="ls-close-camera" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size: 18px;">✕</button>
                        </div>
                        <video id="ls-camera-video" autoplay playsinline style="width: 100%; border-radius: 8px; background: #000; min-height: 200px;"></video>
                        <button class="ls-btn-primary" id="ls-capture-btn">📸 Capturar e Enviar</button>
                    </div>
                </div>

                <div id="ls-image-viewer">
                    <button id="ls-close-viewer">✕</button>
                    <img id="ls-viewer-img" src="">
                </div>
                
                <div id="ls-party-overlay">
                    <div id="ls-disco-ball">🪩</div>
                    <div class="party-dancer" style="left: 10%; bottom: 20%;">🕺</div>
                    <div class="party-dancer" style="right: 20%; top: 30%;">💃</div>
                    <div class="party-dancer" style="left: 30%; top: 20%;">👯‍♀️</div>
                    <div class="party-dancer" style="right: 10%; bottom: 10%;">👯‍♂️</div>
                </div>

                <div id="ls-chat-area">
                    <div id="ls-messages"></div>
                    <div id="ls-typing-indicator" style="display: none; padding: 0 16px 8px; font-size: 11px; color: var(--text-muted); font-style: italic; min-height: 16px;"></div>
                    <div id="ls-reply-bar"><span id="ls-reply-bar-text"></span><button id="ls-reply-bar-close">✕</button></div>
                    <div id="ls-countdown-overlay"><div id="ls-countdown-number">3</div><div id="ls-countdown-text">Preparando...</div></div>
                    <div id="ls-mention-panel"></div>
                    <div id="ls-emoji-panel" class="ls-popup-panel">${emojis.map(e => `<span class="ls-emoji-item">${e}</span>`).join('')}</div>
                    <div id="ls-plus-panel" class="ls-popup-panel">
                        <div class="ls-action-item" id="btn-action-countdown">⏱️ Play Sincronizado</div>
                        <div class="ls-action-item" id="btn-action-pause">⏸️ Pausar Sincronizado</div>
                        <div class="ls-action-item" id="btn-action-sharetime">⏳ Compartilhar meu tempo atual</div>
                        <div class="ls-action-item" id="btn-action-sync">🔄 Sincronizar com o Anfitrião</div>
                        <div class="ls-action-item" id="btn-action-gif">🎞️ Adicionar GIF</div>
                        <div class="ls-action-item" id="btn-action-camera">📷 Tirar Foto</div>
                    </div>
                    <div id="ls-input-area">
                        <button class="ls-icon-btn" id="ls-btn-plus">➕</button>
                        <button class="ls-icon-btn" id="ls-btn-emoji">😀</button>
                        <input type="text" id="ls-input" placeholder="Mensagem..." autocomplete="off" maxlength="150" />
                        <button id="ls-send-btn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left:-2px;"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg></button>
                    </div>
                </div>
            </div>
            <div id="ls-fab">
                <div id="ls-unread-badge">0</div>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path><polygon points="10.5,9 15.5,12 10.5,15" fill="currentColor" stroke="currentColor" stroke-width="1"></polygon></svg>
            </div>
        `;

        shadow.appendChild(style);
        shadow.appendChild(wrapper);
        target.appendChild(host);

        const fab = shadow.getElementById('ls-fab');
        const badge = shadow.getElementById('ls-unread-badge');
        const chatWindow = shadow.getElementById('ls-chat-window');
        const closeBtn = shadow.getElementById('ls-close-btn');
        const minimizeBtn = shadow.getElementById('ls-minimize-btn');
        const lobbySettingsBtn = shadow.getElementById('ls-lobby-settings-btn');
        const backBtn = shadow.getElementById('ls-back-btn');
        const headerText = shadow.getElementById('ls-header-text');
        const chatMenuContainer = shadow.getElementById('ls-chat-menu-container');
        
        const setupArea = shadow.getElementById('ls-setup-area');
        const lobbyArea = shadow.getElementById('ls-lobby-area');
        const addRoomOverlay = shadow.getElementById('ls-add-room-overlay');
        const chatArea = shadow.getElementById('ls-chat-area');
        const settingsOverlay = shadow.getElementById('ls-settings-overlay');
        const membersOverlay = shadow.getElementById('ls-members-overlay');
        const lobbySettingsOverlay = shadow.getElementById('ls-lobby-settings-overlay');
        const profileOverlay = shadow.getElementById('ls-profile-overlay');
        const messagesContainer = shadow.getElementById('ls-messages');
        const input = shadow.getElementById('ls-input');
        const inputSetupName = shadow.getElementById('ls-setup-name');
        const inputSetupPin = shadow.getElementById('ls-setup-pin');

        const imageViewer = shadow.getElementById('ls-image-viewer');
        const viewerImg = shadow.getElementById('ls-viewer-img');
        const closeViewerBtn = shadow.getElementById('ls-close-viewer');

        closeViewerBtn.addEventListener('click', () => { imageViewer.classList.remove('show'); setTimeout(() => { imageViewer.style.display = 'none'; viewerImg.src = ''; }, 200); });
        imageViewer.addEventListener('click', (e) => { if(e.target === imageViewer) closeViewerBtn.click(); });

        let myDeviceId = ls.getItem('ls_device_id');
        if (!myDeviceId) {
            myDeviceId = crypto.randomUUID();
            ls.setItem('ls_device_id', myDeviceId);
        }

        let myName = sessionStorage.getItem('ls_username') || ls.getItem('ls_username');
        let myPin = sessionStorage.getItem('ls_userpin') || ls.getItem('ls_userpin');
        let myColor = ls.getItem('ls_usercolor') || '#5b5cf6';
        let myTextColor = ls.getItem('ls_usertextcolor') || '#ffffff';
        let myAvatar = ls.getItem('ls_useravatar') || '';
        let myBanner = ls.getItem('ls_userbanner') || '';
        let myBio = ls.getItem('ls_userbio') || '';
        let myFav = ls.getItem('ls_userfav') || '';
        let myHideChats = ls.getItem('ls_hidechats') === 'true';
        let currentRoom = ls.getItem('ls_current_room'); 
        let currentRoomKey = ls.getItem('ls_room_key'); 
        
        let tempAvatar = '';
        let tempBanner = '';
        
        let savedRooms = JSON.parse(ls.getItem('ls_saved_rooms') || '[]');
        let lastReadTimes = JSON.parse(ls.getItem('ls_last_read') || '{}');
        let mutedRooms = JSON.parse(ls.getItem('ls_muted_rooms') || '[]');
        
        let myAutoPlay = ls.getItem('ls_autoplay') !== 'false'; 
        let myHideApp = ls.getItem('ls_hide_app') === 'true';
        let myHideRevive = ls.getItem('ls_hide_revive') !== 'false';
        let myIntegratedMode = ls.getItem('ls_integrated') === 'true';
        let myHideSys = ls.getItem('ls_hide_sys') === 'true';
        let myInChatSound = ls.getItem('ls_inchat_sounds') !== 'false';
        
        let editingRoomAppearance = null;
        let unreadCount = 0;
        let replyTarget = null;
        let isCurrentlyIntegrated = false;

        let roomListener = null;
        let messagesListener = null;
        let userProfileUnsubscribe = null;
        let isFirstSnapshot = true;
        let localStream = null;
        let lobbyUnsubscribes = [];
        let currentRoomData = null;
        let userCache = {};
        
        let isTyping = false;
        let typingTimeout = null;
        let lsPartyTimeout = null;

        let floodCount = 0;
        let isFlooding = false;
        let floodResetTimer = null;
        
        let lastDocumentTitle = document.title;
        let lastPingTime = 0;

        let isRemoteAction = false;
        let lastVideoElement = null;
        let lastUrl = window.location.href;

        window.addEventListener('beforeunload', () => {
            if (currentRoom && currentRoomKey) {
                db.collection('rooms').doc(currentRoom).collection('messages').add({
                    type: 'countdown', text: 'SYSTEM_WENT_AWAY', sender: myName, deviceId: myDeviceId, color: myColor, roomKey: currentRoomKey,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(), deleted: false
                }).catch(()=>{});
            }
        });

        function checkFlood() {
            if (isFlooding) return true;
            floodCount++;
            
            if (!floodResetTimer) {
                floodResetTimer = setTimeout(() => {
                    floodCount = 0;
                    floodResetTimer = null;
                }, 10000); 
            }
            
            if (floodCount > 20) {
                isFlooding = true;
                clearTimeout(floodResetTimer);
                floodResetTimer = null;
                
                input.disabled = true;
                input.placeholder = "Você foi silenciado por 5seg digite mais devagar";
                shadow.getElementById('ls-send-btn').style.pointerEvents = 'none';
                shadow.getElementById('ls-send-btn').style.opacity = '0.5';
                setTimeout(() => {
                    isFlooding = false;
                    floodCount = 0;
                    input.disabled = false;
                    input.placeholder = "Mensagem...";
                    shadow.getElementById('ls-send-btn').style.pointerEvents = 'auto';
                    shadow.getElementById('ls-send-btn').style.opacity = '1';
                    input.focus();
                }, 5000);
                return true;
            }
            return false;
        }

        shadow.getElementById('ls-forgot-pin').addEventListener('click', () => {
            alert("No momento o serviço de recuperação de PIN está desativado, em breve criaremos nosso discord para tickets de suporte e ajuda, obrigado!");
        });

        inputSetupName.addEventListener('keypress', (e) => { if (e.key === 'Enter') shadow.getElementById('ls-login-btn').click(); });
        inputSetupPin.addEventListener('keypress', (e) => { if (e.key === 'Enter') shadow.getElementById('ls-login-btn').click(); });

        shadow.getElementById('ls-register-btn').addEventListener('click', async () => {
            const name = inputSetupName.value.trim();
            const pin = inputSetupPin.value.trim();
            if (!name) return alert("Digite um apelido!");
            if (name.length > 100) return alert("O apelido deve ter no máximo 100 caracteres.");
            if (!pin || pin.length < 4) return alert("Digite um PIN válido (mínimo de 4 dígitos).");

            try {
                const userDoc = await db.collection('users').doc(name).get();
                if (userDoc.exists) return alert("Este apelido já está em uso! Clique em 'Entrar' se for a sua conta.");
                const snapshot = await db.collection('users').where('deviceId', '==', myDeviceId).get();
                if (snapshot.size >= 3) return alert("Você já atingiu o limite de 3 perfis criados neste dispositivo.");

                myName = name; myPin = pin;
                myColor = shadow.getElementById('ls-setup-color').value;
                myTextColor = shadow.getElementById('ls-setup-textcolor').value;
                
                const keepLogged = shadow.getElementById('ls-setup-keep').checked;
                if (keepLogged) {
                    ls.setItem('ls_username', myName);
                    ls.setItem('ls_userpin', myPin);
                    sessionStorage.removeItem('ls_username');
                    sessionStorage.removeItem('ls_userpin');
                } else {
                    sessionStorage.setItem('ls_username', myName);
                    sessionStorage.setItem('ls_userpin', myPin);
                    ls.removeItem('ls_username');
                    ls.removeItem('ls_userpin');
                }

                ls.setItem('ls_usercolor', myColor);
                ls.setItem('ls_usertextcolor', myTextColor);
                await syncUserProfile(); checkScreenState();
            } catch (e) { alert("Erro ao conectar ao banco de dados."); }
        });

        shadow.getElementById('ls-login-btn').addEventListener('click', async () => {
            const name = inputSetupName.value.trim();
            const pin = inputSetupPin.value.trim();
            if (!name || !pin) return alert("Preencha o Apelido e o PIN para entrar.");

            try {
                const userDoc = await db.collection('users').doc(name).get();
                if (!userDoc.exists) return alert("Usuário não encontrado! Verifique o nome ou clique em 'Registrar'.");
                const data = userDoc.data();
                if (data.isBanned) return alert("Você foi banido por: " + (data.banReason || "Violação das regras."));
                if (data.pin !== pin) return alert("PIN incorreto!");

                myName = name; myPin = pin;
                myColor = data.color || shadow.getElementById('ls-setup-color').value;
                myTextColor = data.textColor || shadow.getElementById('ls-setup-textcolor').value;
                myBio = data.bio || ''; myHideChats = data.hideChats || false;
                myAvatar = data.avatar || ''; myBanner = data.banner || ''; myFav = data.fav || '';
                
                const keepLogged = shadow.getElementById('ls-setup-keep').checked;
                if (keepLogged) {
                    ls.setItem('ls_username', myName);
                    ls.setItem('ls_userpin', myPin);
                    sessionStorage.removeItem('ls_username');
                    sessionStorage.removeItem('ls_userpin');
                } else {
                    sessionStorage.setItem('ls_username', myName);
                    sessionStorage.setItem('ls_userpin', myPin);
                    ls.removeItem('ls_username');
                    ls.removeItem('ls_userpin');
                }
                
                ls.setItem('ls_usercolor', myColor);
                ls.setItem('ls_usertextcolor', myTextColor);
                ls.setItem('ls_userbio', myBio);
                ls.setItem('ls_hidechats', myHideChats);
                ls.setItem('ls_useravatar', myAvatar); ls.setItem('ls_userbanner', myBanner);
                ls.setItem('ls_userfav', myFav);
                
                await syncUserProfile(); checkScreenState();
            } catch (e) { alert("Erro ao conectar ao banco de dados."); }
        });

        const mentionPanel = shadow.getElementById('ls-mention-panel');
        let isMentioning = false; let activeMentionIndex = 0; let mentionMatches = [];

        input.addEventListener('input', (e) => {
            if (currentRoom && currentRoomKey) {
                if (!isTyping) {
                    isTyping = true;
                    db.collection('rooms').doc(currentRoom).update({ typing: firebase.firestore.FieldValue.arrayUnion(myName) }).catch(()=>{});
                }
                clearTimeout(typingTimeout);
                typingTimeout = setTimeout(() => {
                    isTyping = false;
                    db.collection('rooms').doc(currentRoom).update({ typing: firebase.firestore.FieldValue.arrayRemove(myName) }).catch(()=>{});
                }, 2000);
            }

            const val = input.value; const cursorPos = input.selectionStart;
            const textBeforeCursor = val.substring(0, cursorPos);
            const match = textBeforeCursor.match(/(?:^|\s)@([^@\n]*)$/);

            if (match && currentRoomData && currentRoomData.participants) {
                const searchStr = match[1].toLowerCase();
                if (searchStr.length > 20) { mentionPanel.style.display = 'none'; isMentioning = false; return; }
                mentionMatches = currentRoomData.participants.filter(p => p.toLowerCase().includes(searchStr));

                if (mentionMatches.length > 0) {
                    isMentioning = true; mentionPanel.innerHTML = ''; activeMentionIndex = 0;
                    mentionMatches.forEach((p, index) => {
                        const div = document.createElement('div');
                        div.className = 'ls-mention-item' + (index === 0 ? ' active' : '');
                        div.innerText = `@${p.replace(/\s/g, '')}`;
                        div.onmousedown = (ev) => { ev.preventDefault(); insertMention(p); };
                        mentionPanel.appendChild(div);
                    });
                    mentionPanel.style.display = 'flex';
                } else { mentionPanel.style.display = 'none'; isMentioning = false; }
            } else { mentionPanel.style.display = 'none'; isMentioning = false; }
        });

        function insertMention(name) {
            const cleanName = name.replace(/\s/g, '');
            const val = input.value; const cursorPos = input.selectionStart;
            const textBeforeCursor = val.substring(0, cursorPos);
            const textAfterCursor = val.substring(cursorPos);
            const lastAtPos = textBeforeCursor.lastIndexOf('@');
            const newTextBefore = textBeforeCursor.substring(0, lastAtPos) + `@${cleanName} `;
            input.value = newTextBefore + textAfterCursor;
            input.focus(); input.selectionStart = input.selectionEnd = newTextBefore.length;
            mentionPanel.style.display = 'none'; isMentioning = false;
        }

        input.addEventListener('blur', () => { 
            setTimeout(() => { mentionPanel.style.display = 'none'; isMentioning = false; }, 150); 
            if (isTyping && currentRoom) {
                clearTimeout(typingTimeout);
                isTyping = false;
                db.collection('rooms').doc(currentRoom).update({ typing: firebase.firestore.FieldValue.arrayRemove(myName) }).catch(()=>{});
            }
        });

        const header = shadow.getElementById('ls-header');
        let isDragging = false, startX, startY, currentLeft, currentTop;

        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.ls-header-btns') || e.target.closest('#ls-header-text') || e.target.closest('button')) return;
            if (isCurrentlyIntegrated) return;

            isDragging = true;
            const rect = chatWindow.getBoundingClientRect();
            if (chatWindow.style.position !== 'fixed') {
                chatWindow.style.position = 'fixed'; chatWindow.style.margin = '0';
                chatWindow.style.bottom = 'auto'; chatWindow.style.right = 'auto';
            }
            currentLeft = rect.left; currentTop = rect.top;
            chatWindow.style.left = currentLeft + 'px'; chatWindow.style.top = currentTop + 'px';
            startX = e.clientX; startY = e.clientY;
            chatWindow.style.transition = 'none';
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            currentLeft += e.clientX - startX; currentTop += e.clientY - startY;
            startX = e.clientX; startY = e.clientY;
            chatWindow.style.left = currentLeft + 'px'; chatWindow.style.top = currentTop + 'px';
        });

        window.addEventListener('mouseup', () => {
            if (isDragging) { isDragging = false; chatWindow.style.transition = 'background-color 0.3s, backdrop-filter 0.3s'; }
        });

        function toggleIntegratedMode(active, temporary = false) {
            const pushStyleId = 'ls-integrated-push-style';
            let pushStyle = document.getElementById(pushStyleId);

            if (active) {
                isCurrentlyIntegrated = true;
                if (!pushStyle) {
                    pushStyle = document.createElement('style'); 
                    pushStyle.id = pushStyleId;
                    pushStyle.innerHTML = `
                        :root { --ls-chat-width: 350px; }
                        html.ls-integrated-active, body.ls-integrated-active { margin-right: var(--ls-chat-width) !important; width: calc(100% - var(--ls-chat-width)) !important; }
                        html.ls-integrated-active div[id^="layer-root-"], html.ls-integrated-active div[data-testid="playerContainer"],
                        html.ls-integrated-active .html5-video-player, html.ls-integrated-active #ytd-player,
                        html.ls-integrated-active .nf-player-container, html.ls-integrated-active .watch-video,
                        html.ls-integrated-active .webPlayerContainer, html.ls-integrated-active .scaling-video-container, 
                        html.ls-integrated-active .dv-player-fullscreen, html.ls-integrated-active div[data-testid="player-container"],
                        html.ls-integrated-active #app_body_content, html.ls-integrated-active .btm-media-client-element,
                        html.ls-integrated-active .video-player-wrapper, html.ls-integrated-active #vilos-player,
                        html.ls-integrated-active .player-wrapper {
                            width: calc(100vw - var(--ls-chat-width)) !important;
                            max-width: calc(100vw - var(--ls-chat-width)) !important;
                            right: auto !important;
                        }
                        html.ls-integrated-active .ytp-chrome-bottom, html.ls-integrated-active .nf-player-controls, 
                        html.ls-integrated-active .dv-player-controls, html.ls-integrated-active .bottom-controls,
                        html.ls-integrated-active [data-testid="player-controls"], html.ls-integrated-active [data-testid="playback_controls"] {
                            width: calc(100vw - var(--ls-chat-width)) !important;
                            max-width: calc(100vw - var(--ls-chat-width)) !important;
                        }
                    `;
                    document.head.appendChild(pushStyle);
                    document.documentElement.classList.add('ls-integrated-active');
                    document.body.classList.add('ls-integrated-active');
                }
                chatWindow.classList.add('integrated'); chatWindow.classList.add('open');
                host.style.cssText = 'position: fixed !important; top: 0 !important; right: 0 !important; bottom: 0 !important; width: 350px !important; height: 100vh !important; z-index: 2147483647 !important; pointer-events: auto !important;';
                const wrapperEl = shadow.getElementById('ls-wrapper');
                wrapperEl.style.display = 'block'; wrapperEl.style.width = '100%'; wrapperEl.style.height = '100%';
                fab.style.display = 'none'; badge.style.display = 'none';
                const tBtn = shadow.getElementById('ls-menu-theater'); if(tBtn) tBtn.innerText = '🖥️ Sair do Modo Teatro';
            } else {
                isCurrentlyIntegrated = false;
                if (!temporary) {
                    myIntegratedMode = false;
                    ls.setItem('ls_integrated', false);
                }
                if (pushStyle) pushStyle.remove();
                document.documentElement.classList.remove('ls-integrated-active');
                document.body.classList.remove('ls-integrated-active');
                chatWindow.classList.remove('integrated');
                host.style.cssText = 'position: fixed !important; bottom: 90px !important; right: 20px !important; z-index: 2147483647 !important; pointer-events: none !important;';
                const wrapperEl = shadow.getElementById('ls-wrapper');
                wrapperEl.style.display = 'flex'; wrapperEl.style.width = 'auto'; wrapperEl.style.height = 'auto';
                if (!chatWindow.classList.contains('open') && !myHideApp) fab.style.display = 'flex';
                const tBtn = shadow.getElementById('ls-menu-theater'); if(tBtn) tBtn.innerText = '🖥️ Modo Teatro';
            }
        }

        shadow.addEventListener('click', (e) => {
            if(!e.target.closest('.ls-dropdown-container')) { shadow.querySelectorAll('.ls-dropdown-menu').forEach(m => m.classList.remove('show')); }
        });

        shadow.getElementById('ls-toggle-pass-1').addEventListener('click', (e) => {
            const inputField = shadow.getElementById('ls-lobby-pass');
            if (inputField.type === 'password') { inputField.type = 'text'; e.currentTarget.innerHTML = svgEye; } 
            else { inputField.type = 'password'; e.currentTarget.innerHTML = svgEyeOff; }
        });

        function formatTime(timestamp) {
            const date = timestamp ? (timestamp.toDate ? timestamp.toDate() : new Date(timestamp)) : new Date();
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        function updateLastRead(roomName) {
            lastReadTimes[roomName] = Date.now();
            ls.setItem('ls_last_read', JSON.stringify(lastReadTimes));
        }

        async function sendSystemAction(actionText) {
            if(!currentRoom || !currentRoomKey) return;
            try {
                await db.collection('rooms').doc(currentRoom).collection('messages').add({
                    type: 'countdown', text: actionText, sender: myName, deviceId: myDeviceId, color: myColor, roomKey: currentRoomKey,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(), deleted: false
                });
            } catch(e){}
        }

        async function syncUserProfile() {
            if (!myName) return;
            const userRef = db.collection('users').doc(myName);
            try {
                const doc = await userRef.get();
                if (!doc.exists) {
                    await userRef.set({ username: myName, color: myColor, textColor: myTextColor, deviceId: myDeviceId, pin: myPin, bio: myBio, fav: myFav, hideChats: myHideChats, roomCount: savedRooms.length, avatar: myAvatar, banner: myBanner, tags: [], isBanned: false, banReason: "", watching: document.title, createdAt: firebase.firestore.FieldValue.serverTimestamp(), lastSeen: firebase.firestore.FieldValue.serverTimestamp() });
                } else {
                    await userRef.set({ color: myColor, textColor: myTextColor, pin: myPin, bio: myBio, fav: myFav, hideChats: myHideChats, avatar: myAvatar, banner: myBanner, roomCount: savedRooms.length, watching: document.title, lastSeen: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
                }

                if (userProfileUnsubscribe) userProfileUnsubscribe();
                userProfileUnsubscribe = userRef.onSnapshot(snap => {
                    if(snap.exists) {
                        const data = snap.data();
                        if(data.isBanned) { alert("⚠️ Acesso Negado: Você foi banido. Motivo: " + (data.banReason || "Violação das regras.")); ls.clear(); sessionStorage.clear(); location.reload(); }
                        if(data.username && data.username !== myName) { alert(`⚠️ Moderação: Seu nome foi alterado pelo administrador para "${data.username}".`); ls.setItem('ls_username', data.username); location.reload(); }
                    }
                });
            } catch(e) { }
        }

        function checkScreenState() {
            settingsOverlay.style.display = 'none'; addRoomOverlay.style.display = 'none'; lobbySettingsOverlay.style.display = 'none'; membersOverlay.style.display = 'none'; profileOverlay.style.display = 'none'; editingRoomAppearance = null;
            if (myName) db.collection('users').doc(myName).set({ color: myColor, deviceId: myDeviceId, pin: myPin, roomCount: savedRooms.length, watching: document.title, lastSeen: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true }).catch(()=>{});
            
            const isPlayer = ['/watch', '/video', '/v/', '?v=', '&v=', '/detail', '/player', '/play', '/live-tv', '/on-demand'].some(p => window.location.href.toLowerCase().includes(p));
            if (myIntegratedMode && isPlayer) toggleIntegratedMode(true); 
            else toggleIntegratedMode(false, true);

            if (!myName || !myPin) {
                if (userProfileUnsubscribe) userProfileUnsubscribe();
                setupArea.style.display = 'flex'; lobbyArea.style.display = 'none'; chatArea.style.display = 'none'; chatMenuContainer.style.display = 'none'; lobbySettingsBtn.style.display = 'none'; backBtn.style.display = 'none'; headerText.innerText = "LidySync";
                headerText.classList.remove('clickable');
                stopLobbyListeners();
            } else if (!currentRoom || !currentRoomKey) {
                setupArea.style.display = 'none'; lobbyArea.style.display = 'flex'; chatArea.style.display = 'none'; chatMenuContainer.style.display = 'none'; lobbySettingsBtn.style.display = 'flex'; backBtn.style.display = 'none'; headerText.innerText = `Lobby (${myName})`;
                headerText.classList.remove('clickable');
                renderSavedRooms(); startLobbyListeners();
            } else {
                setupArea.style.display = 'none'; lobbyArea.style.display = 'none'; chatArea.style.display = 'flex'; chatMenuContainer.style.display = 'block'; lobbySettingsBtn.style.display = 'none'; backBtn.style.display = 'flex'; headerText.innerText = `${currentRoom}`;
                headerText.classList.add('clickable');
                if (myIntegratedMode) toggleIntegratedMode(true);
                stopLobbyListeners(); startChatListeners();
            }
        }

        shadow.getElementById('ls-header-text').addEventListener('click', () => {
            if (currentRoom) {
                membersOverlay.style.display = 'flex';
                fetchAndRenderMembers(currentRoom, shadow.getElementById('ls-members-list'));
            }
        });

        async function openProfile(targetUsername) {
            shadow.querySelectorAll('.ls-dropdown-menu').forEach(m => m.classList.remove('show'));
            profileOverlay.style.display = 'flex'; shadow.getElementById('ls-profile-view').style.display = 'flex'; shadow.getElementById('ls-profile-edit').style.display = 'none';
            const btnEdit = shadow.getElementById('ls-btn-edit-profile');
            btnEdit.style.display = targetUsername === myName ? 'block' : 'none';

            shadow.getElementById('ls-profile-v-name').innerText = "Carregando..."; shadow.getElementById('ls-profile-v-bio').innerText = "-"; shadow.getElementById('ls-profile-v-tags').innerHTML = ""; shadow.getElementById('ls-profile-v-created').innerText = "-"; shadow.getElementById('ls-profile-v-rooms').innerText = "-"; shadow.getElementById('ls-profile-v-statustext').innerText = "-";
            shadow.getElementById('ls-profile-v-banner').style.background = 'linear-gradient(135deg, #5b5cf6, #7c3aed)';
            shadow.getElementById('ls-profile-v-fav-container').style.display = 'none';
            
            try {
                const doc = await db.collection('users').doc(targetUsername).get();
                if(doc.exists) {
                    const data = doc.data();
                    shadow.getElementById('ls-profile-v-name').innerText = targetUsername;
                    const avatar = shadow.getElementById('ls-profile-v-avatar');
                    
                    if (data.avatar) {
                        avatar.style.backgroundImage = `url(${data.avatar})`;
                        avatar.style.backgroundColor = 'transparent';
                        avatar.innerText = '';
                    } else {
                        avatar.style.backgroundImage = 'none';
                        avatar.style.backgroundColor = data.color || '#5b5cf6';
                        avatar.innerText = targetUsername.charAt(0).toUpperCase();
                    }
                    avatar.style.color = data.textColor || '#ffffff';
                    
                    if (data.banner) {
                        shadow.getElementById('ls-profile-v-banner').style.background = `url(${data.banner}) center/cover`;
                    } else {
                        shadow.getElementById('ls-profile-v-banner').style.background = `linear-gradient(135deg, ${data.color || '#5b5cf6'}, #1e293b)`;
                    }

                    shadow.getElementById('ls-profile-v-bio').innerText = data.bio || 'Olá! Estou usando o LidySync.';
                    
                    const favContainer = shadow.getElementById('ls-profile-v-fav-container');
                    if (data.fav) {
                        favContainer.style.display = 'block';
                        shadow.getElementById('ls-profile-v-fav').innerText = data.fav;
                    } else {
                        favContainer.style.display = 'none';
                    }
                    
                    const tContainer = shadow.getElementById('ls-profile-v-tags');
                    if (data.tags && data.tags.length > 0) { tContainer.innerHTML = buildTagsHTML(currentRoomData && currentRoomData.createdBy === targetUsername, data); } 
                    else { tContainer.innerHTML = `<span style="color:var(--text-muted); font-size:12px;">(Você ainda não tem tags.)</span>`; }

                    if (data.createdAt) shadow.getElementById('ls-profile-v-created').innerText = data.createdAt.toDate().toLocaleDateString();
                    shadow.getElementById('ls-profile-v-rooms').innerText = (data.hideChats && targetUsername !== myName) ? "Oculto" : (data.roomCount || 0);

                    const statusInd = shadow.getElementById('ls-profile-v-status');
                    const statusText = shadow.getElementById('ls-profile-v-statustext');
                    if (data.lastSeen && (Date.now() - data.lastSeen.toMillis() < 300000)) { 
                        statusInd.style.background = '#22c55e'; 
                        statusText.innerText = data.watching ? `🟢 Online | Assistindo: ${data.watching}` : '🟢 Online'; 
                    } else { 
                        statusInd.style.background = '#94a3b8'; 
                        statusText.innerText = '🔴 Offline'; 
                    }
                } else { shadow.getElementById('ls-profile-v-name').innerText = "Usuário não encontrado."; }
            } catch(e) {}
        }

        shadow.getElementById('ls-btn-open-my-profile').addEventListener('click', () => { openProfile(myName); });
        
        shadow.getElementById('ls-close-profile-modal').addEventListener('click', () => { 
            profileOverlay.style.display = 'none'; 
            shadow.getElementById('ls-profile-edit').style.display = 'none';
            shadow.getElementById('ls-profile-view').style.display = 'flex';
        });
        
        shadow.getElementById('ls-btn-edit-profile').addEventListener('click', () => {
            shadow.getElementById('ls-profile-view').style.display = 'none'; shadow.getElementById('ls-profile-edit').style.display = 'flex'; shadow.getElementById('ls-btn-edit-profile').style.display = 'none';
            shadow.getElementById('ls-profile-e-color').value = myColor; shadow.getElementById('ls-profile-e-textcolor').value = myTextColor; shadow.getElementById('ls-profile-e-bio').value = myBio; shadow.getElementById('ls-profile-e-fav').value = myFav; shadow.getElementById('ls-profile-e-hiderooms').checked = myHideChats;
            
            tempAvatar = myAvatar;
            tempBanner = myBanner;
            
            const avatar = shadow.getElementById('ls-profile-e-avatar');
            if (tempAvatar) {
                avatar.style.backgroundImage = `url(${tempAvatar})`;
                avatar.style.backgroundColor = 'transparent';
                avatar.innerText = '';
            } else {
                avatar.style.backgroundImage = 'none';
                avatar.style.backgroundColor = myColor;
                avatar.innerText = myName.charAt(0).toUpperCase();
            }
            avatar.style.color = myTextColor;
        });
        
        shadow.getElementById('ls-btn-cancel-profile').addEventListener('click', () => {
            shadow.getElementById('ls-profile-edit').style.display = 'none';
            shadow.getElementById('ls-profile-view').style.display = 'flex';
            shadow.getElementById('ls-btn-edit-profile').style.display = 'block';
        });

        shadow.getElementById('ls-profile-e-avatar-file').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    compressImage(event.target.result, (compressed) => {
                        tempAvatar = compressed;
                        const av = shadow.getElementById('ls-profile-e-avatar');
                        av.style.backgroundImage = `url(${compressed})`;
                        av.style.backgroundColor = 'transparent';
                        av.innerText = '';
                    });
                };
                reader.readAsDataURL(file);
            }
        });

        shadow.getElementById('ls-profile-e-avatar-clear').addEventListener('click', () => {
            tempAvatar = '';
            shadow.getElementById('ls-profile-e-avatar-file').value = '';
            const av = shadow.getElementById('ls-profile-e-avatar');
            av.style.backgroundImage = 'none';
            av.style.backgroundColor = shadow.getElementById('ls-profile-e-color').value;
            av.innerText = myName.charAt(0).toUpperCase();
        });

        shadow.getElementById('ls-profile-e-banner-file').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    compressImage(event.target.result, (compressed) => {
                        tempBanner = compressed;
                    });
                };
                reader.readAsDataURL(file);
            }
        });

        shadow.getElementById('ls-profile-e-banner-clear').addEventListener('click', () => {
            tempBanner = '';
            shadow.getElementById('ls-profile-e-banner-file').value = '';
        });

        shadow.getElementById('ls-profile-e-color').addEventListener('input', (e) => { 
            if(!tempAvatar) shadow.getElementById('ls-profile-e-avatar').style.backgroundColor = e.target.value; 
        });
        shadow.getElementById('ls-profile-e-textcolor').addEventListener('input', (e) => { shadow.getElementById('ls-profile-e-avatar').style.color = e.target.value; });

        shadow.getElementById('ls-btn-save-profile').addEventListener('click', async () => {
            myColor = shadow.getElementById('ls-profile-e-color').value; myTextColor = shadow.getElementById('ls-profile-e-textcolor').value; myBio = shadow.getElementById('ls-profile-e-bio').value.trim(); myHideChats = shadow.getElementById('ls-profile-e-hiderooms').checked;
            myFav = shadow.getElementById('ls-profile-e-fav').value.trim();
            myAvatar = tempAvatar; myBanner = tempBanner;
            
            ls.setItem('ls_usercolor', myColor); ls.setItem('ls_usertextcolor', myTextColor); ls.setItem('ls_userbio', myBio); ls.setItem('ls_hidechats', myHideChats);
            ls.setItem('ls_userfav', myFav);
            ls.setItem('ls_useravatar', myAvatar); ls.setItem('ls_userbanner', myBanner);
            
            await syncUserProfile(); openProfile(myName);
        });

        async function fetchAndRenderMembers(roomName, listEl) {
            listEl.innerHTML = '<span style="color:var(--text-muted); font-size:13px;">Carregando...</span>';
            try {
                const rDoc = await db.collection('rooms').doc(roomName).get();
                if (!rDoc.exists) { listEl.innerHTML = '<span style="color:var(--text-muted); font-size:13px;">Sala não encontrada.</span>'; return; }
                const rData = rDoc.data();
                if (rData && rData.participants && rData.participants.length > 0) {
                    listEl.innerHTML = '';
                    const now = Date.now();
                    const isAdmMode = (rData.createdBy === myName);
                    for (const p of rData.participants) {
                        if (!userCache[p]) { const uDoc = await db.collection('users').doc(p).get(); if(uDoc.exists) userCache[p] = uDoc.data(); }
                        const isAdm = (rData.createdBy === p); const uData = userCache[p] || {}; const isOnline = uData.lastSeen && (now - uData.lastSeen.toMillis() < 300000); 
                        
                        const bgStyle = uData.avatar ? `url(${uData.avatar})` : (uData.color || '#6366f1');
                        const avText = uData.avatar ? '' : p.charAt(0).toUpperCase();
                        
                        const watchingTooltip = isOnline && uData.watching ? `\nAssistindo: ${uData.watching.replace(/"/g, '&quot;')}` : '';

                        const item = document.createElement('div'); item.className = 'ls-room-item'; item.style.cursor = 'pointer';
                        item.title = `${p}${watchingTooltip}`;
                        item.innerHTML = `
                            <div class="ls-room-avatar" style="width:36px; height:36px; font-size:14px; position:relative; background:${bgStyle}; color:${uData.textColor || '#fff'}">${avText}<div class="ls-online-dot" style="display: ${isOnline ? 'block' : 'none'};"></div></div>
                            <div class="ls-room-info" style="display:flex; align-items:center;"><span class="ls-room-name">${p}</span><div class="ls-tags-container" id="ls-member-tags-lobby-${p.replace(/\s/g, '')}"></div></div>
                        `;
                        
                        if (isAdmMode && p !== myName) {
                            const kickBtn = document.createElement('button');
                            kickBtn.innerHTML = '❌';
                            kickBtn.title = "Expulsar da sala";
                            kickBtn.style.cssText = 'background:none; border:none; cursor:pointer; padding:4px 8px; font-size:12px; margin-left:auto; z-index:10;';
                            kickBtn.addEventListener('click', async (e) => {
                                e.stopPropagation();
                                if(confirm(`Deseja realmente expulsar ${p} desta sala?`)) {
                                    try {
                                        await db.collection('rooms').doc(roomName).update({ participants: firebase.firestore.FieldValue.arrayRemove(p) });
                                        sendSystemAction(`SYSTEM_KICKED:${p}`);
                                        fetchAndRenderMembers(roomName, listEl);
                                    } catch(err) {}
                                }
                            });
                            item.appendChild(kickBtn);
                        }

                        item.addEventListener('click', () => { openProfile(p); });
                        listEl.appendChild(item);
                        item.querySelector(`#ls-member-tags-lobby-${p.replace(/\s/g, '')}`).innerHTML = buildTagsHTML(isAdm, uData);
                    }
                } else { listEl.innerHTML = '<span style="color:var(--text-muted); font-size:13px;">Nenhum membro encontrado.</span>'; }
            } catch(e) { listEl.innerHTML = '<span style="color:var(--text-muted); font-size:13px;">Erro ao carregar membros.</span>'; }
        }

        function renderSavedRooms() {
            const list = shadow.getElementById('ls-room-list');
            list.innerHTML = '';
            if(savedRooms.length === 0) { list.innerHTML = '<div style="text-align:center; color:var(--text-muted); margin-top:40px; font-size:14px; line-height:1.5;">Nenhum chat salvo.<br>Clique no <b>+</b> abaixo para começar.</div>'; return; }
            savedRooms.forEach((room, index) => {
                const item = document.createElement('div'); item.className = 'ls-room-item'; const initial = room.name.charAt(0).toUpperCase();
                let rawPass = room.rawPass || ''; let isMuted = mutedRooms.includes(room.name);
                item.innerHTML = `
                    <div class="ls-room-avatar">${initial}</div>
                    <div class="ls-room-info"><div class="ls-room-name">${room.name} ${isMuted ? '🔕' : ''}</div><div class="ls-room-status" id="ls-status-${room.name}">Toque para entrar</div></div>
                    <div class="ls-room-unread" id="ls-unread-${room.name}"></div>
                    <div class="ls-dropdown-container">
                        <button class="ls-room-options" data-index="${index}">⋮</button>
                        <div class="ls-dropdown-menu" id="ls-drop-${index}">
                            <button class="ls-dropdown-item" data-action="share" data-name="${room.name}" data-rawpass="${rawPass}">🔗 Compartilhar Sala</button>
                            <button class="ls-dropdown-item" data-action="members" data-name="${room.name}">👥 Ver Membros</button>
                            <button class="ls-dropdown-item" data-action="mute" data-name="${room.name}">${isMuted ? '🔔 Reativar Som' : '🔕 Silenciar Chat'}</button>
                            <button class="ls-dropdown-item" data-action="appearance" data-name="${room.name}">⚙️ Configurações da Sala</button>
                            <div style="height:1px; background:var(--border-color); margin:4px 0;" id="ls-menu-delete-divider"></div>
                            <button class="ls-dropdown-item danger" id="ls-menu-leave" style="display:none;">🚪 Sair da Sala</button>
                            <button class="ls-dropdown-item danger" id="ls-menu-delete">🗑️ Encerrar Sala</button>
                        </div>
                    </div>
                `;
                item.querySelector('.ls-room-info').addEventListener('click', () => autoJoinRoom(room.name, room.hash));
                item.querySelector('.ls-room-avatar').addEventListener('click', () => autoJoinRoom(room.name, room.hash));
                const optBtn = item.querySelector('.ls-room-options'); const dropMenu = item.querySelector(`#ls-drop-${index}`);
                optBtn.addEventListener('click', (e) => { e.stopPropagation(); shadow.querySelectorAll('.ls-dropdown-menu').forEach(m => { if(m !== dropMenu) m.classList.remove('show'); }); dropMenu.classList.toggle('show'); });
                dropMenu.querySelectorAll('.ls-dropdown-item').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        e.stopPropagation(); dropMenu.classList.remove('show');
                        if (btn.dataset.action === 'members') { membersOverlay.style.display = 'flex'; fetchAndRenderMembers(btn.dataset.name, shadow.getElementById('ls-members-list')); } 
                        else if (btn.dataset.action === 'mute') { const rName = btn.dataset.name; if(mutedRooms.includes(rName)) { mutedRooms = mutedRooms.filter(r => r !== rName); } else { mutedRooms.push(rName); } ls.setItem('ls_muted_rooms', JSON.stringify(mutedRooms)); renderSavedRooms(); } 
                        else if (btn.dataset.action === 'share') { let passToShare = btn.dataset.rawpass; if (!passToShare) { passToShare = prompt("Qual a senha dessa sala para incluir no convite?") || "[Sua Senha]"; if (passToShare !== "[Sua Senha]") { room.rawPass = passToShare; ls.setItem('ls_saved_rooms', JSON.stringify(savedRooms)); } } const link = `Vem assistir comigo no LidySync!\n🍿 Nome da Sala: ${btn.dataset.name}\n🔑 Senha: ${passToShare}\n\nCaso não tenha a extensão clique aqui para aprender a instalar: https://ofaceoff.github.io/LidySync/index.html`; navigator.clipboard.writeText(link); alert("Convite copiado!"); } 
                        else if (btn.dataset.action === 'appearance') { settingsOverlay.style.display = 'flex'; shadow.getElementById('ls-config-autoplay').checked = myAutoPlay; } 
                        else if(btn.dataset.action === 'remove') { savedRooms.splice(btn.dataset.index, 1); ls.setItem('ls_saved_rooms', JSON.stringify(savedRooms)); await syncUserProfile(); renderSavedRooms(); startLobbyListeners(); }
                        else if(btn.dataset.action === 'leave') {
                            if(!confirm("Tem certeza que deseja sair definitivamente desta sala?")) return;
                            try { await db.collection('rooms').doc(btn.dataset.name).collection('messages').add({ type: 'countdown', text: 'SYSTEM_LEFT_PERMANENTLY', sender: myName, deviceId: myDeviceId, color: myColor, roomKey: btn.dataset.name, timestamp: firebase.firestore.FieldValue.serverTimestamp(), deleted: false }); } catch(e){}
                            try { await db.collection('rooms').doc(btn.dataset.name).update({ participants: firebase.firestore.FieldValue.arrayRemove(myName) }); } catch(e){}
                            savedRooms.splice(btn.dataset.index, 1); ls.setItem('ls_saved_rooms', JSON.stringify(savedRooms)); await syncUserProfile(); renderSavedRooms(); startLobbyListeners();
                        }
                        else if(btn.dataset.action === 'delete') { 
                            if(!confirm("Encerrar e deletar a sala para todos?")) return; 
                            try { await db.collection('rooms').doc(btn.dataset.name).delete(); } catch(e){} 
                        }
                    });
                });
                
                const delBtn = dropMenu.querySelector('#ls-menu-delete');
                const leaveBtn = dropMenu.querySelector('#ls-menu-leave');
                const delDiv = dropMenu.querySelector('#ls-menu-delete-divider');
                db.collection('rooms').doc(room.name).get().then(doc => {
                    if (doc.exists) {
                        if (doc.data().createdBy !== myName) {
                            if (delBtn) delBtn.style.display = 'none';
                            if (leaveBtn) leaveBtn.style.display = 'flex';
                        } else {
                            if (delBtn) delBtn.style.display = 'flex';
                            if (leaveBtn) leaveBtn.style.display = 'none';
                        }
                    }
                }).catch(()=>{});

                list.appendChild(item);
            });
        }

        function startLobbyListeners() {
            stopLobbyListeners();
            savedRooms.forEach((room) => {
                const unsub = db.collection('rooms').doc(room.name).collection('messages')
                    .orderBy('timestamp', 'desc').limit(1).onSnapshot(snap => {
                        if (!snap.empty) {
                            const data = snap.docs[0].data(); const statusEl = shadow.getElementById(`ls-status-${room.name}`); const unreadEl = shadow.getElementById(`ls-unread-${room.name}`);
                            if (statusEl && !data.deleted) {
                                let msgText = data.text;
                                if (data.type === 'image') msgText = '📷 Imagem'; else if (data.type === 'gif') msgText = '🎞️ GIF'; else if (data.type === 'invite') msgText = '🔗 Convite'; else if (data.type === 'countdown') msgText = 'Ação do Sistema';
                                
                                if (data.text === 'SYSTEM_CREATED') msgText = 'Criou a sala';
                                else if (data.text === 'SYSTEM_FIRST_JOIN') msgText = 'Entrou na sala';
                                else if (data.text === 'SYSTEM_LEFT_PERMANENTLY') msgText = 'Saiu da sala';
                                else if (data.text.startsWith('SYSTEM_KICKED:')) msgText = 'Expulsou um membro';
                                else if (data.text === 'SYSTEM_WENT_AWAY') msgText = 'Foi embora';
                                else if (data.text === 'SYSTEM_PAUSE') msgText = 'Pausou a programação';
                                else if (data.text && data.text.startsWith('SYSTEM_')) { msgText = (myHideSys && (data.text === 'SYSTEM_JOIN' || data.text === 'SYSTEM_LEAVE')) ? 'Mensagem de Sistema' : 'Ação do Sistema'; }
                                
                                statusEl.innerText = `${data.sender}: ${msgText}`;
                            } else if (statusEl && data.deleted) { statusEl.innerText = `${data.sender}: 🚫 Mensagem apagada`; }

                            if (unreadEl) {
                                const lastRead = lastReadTimes[room.name] || 0; const msgTime = data.timestamp ? data.timestamp.toMillis() : Date.now();
                                if (msgTime > lastRead && data.sender !== myName) {
                                    unreadEl.style.display = 'block';
                                    if (!chatWindow.classList.contains('open') && !myIntegratedMode) {
                                        badge.style.display = 'flex'; badge.innerText = '!';
                                        if (myHideApp && myHideRevive) { fab.style.display = 'flex'; }
                                        if(!mutedRooms.includes(room.name)) playNotificationSound();
                                    }
                                } else { unreadEl.style.display = 'none'; }
                            }
                        }
                    });
                lobbyUnsubscribes.push(unsub);
            });
        }

        function stopLobbyListeners() { lobbyUnsubscribes.forEach(u => u()); lobbyUnsubscribes = []; }

        function saveRoomToLocalList(name, hash, rawPass) {
            const exists = savedRooms.find(r => r.name === name);
            if(!exists) { savedRooms.push({name, hash, rawPass}); ls.setItem('ls_saved_rooms', JSON.stringify(savedRooms)); } 
            else if (rawPass && !exists.rawPass) { exists.rawPass = rawPass; ls.setItem('ls_saved_rooms', JSON.stringify(savedRooms)); }
        }

        async function autoJoinRoom(roomName, savedHash) {
            try {
                const doc = await db.collection('rooms').doc(roomName).get();
                if(!doc.exists) { alert("Esta sala foi encerrada pelo dono."); savedRooms = savedRooms.filter(r => r.name !== roomName); ls.setItem('ls_saved_rooms', JSON.stringify(savedRooms)); await syncUserProfile(); renderSavedRooms(); startLobbyListeners(); return; }
                if(doc.data().password !== savedHash) { alert("A senha desta sala foi alterada. Por favor, adicione-a novamente pelo botão +"); return; }
                
                const isNewMember = !doc.data().participants || !doc.data().participants.includes(myName);
                
                currentRoom = roomName; currentRoomKey = roomName; ls.setItem('ls_current_room', currentRoom); ls.setItem('ls_room_key', currentRoomKey);
                await db.collection('rooms').doc(currentRoom).set({ participants: firebase.firestore.FieldValue.arrayUnion(myName) }, { merge: true }).catch(()=>{});
                
                if (isNewMember) sendSystemAction('SYSTEM_FIRST_JOIN');
                
                updateLastRead(currentRoom); checkScreenState();
            } catch(e) {}
        }

        shadow.getElementById('ls-close-add-modal').addEventListener('click', () => { addRoomOverlay.style.display = 'none'; });

        const inputRoom = shadow.getElementById('ls-lobby-room');
        const inputPass = shadow.getElementById('ls-lobby-pass');

        shadow.getElementById('ls-create-room-btn').addEventListener('click', async () => {
            const roomName = inputRoom.value.trim().toLowerCase();
            const roomPass = inputPass.value.trim();
            if(!roomName || !roomPass) return alert("Preencha o nome e a senha!");
            if(roomName.length > 80) return alert("O nome da sala deve ter no máximo 80 caracteres.");
            if(roomPass.length < 4 || roomPass.length > 16) return alert("A senha deve ter entre 4 e 16 caracteres.");

            try {
                const docRef = db.collection('rooms').doc(roomName);
                const doc = await docRef.get();
                if(doc.exists) return alert("Esta sala já existe! Clique em 'Entrar na Sala'.");
                const hashedPass = await hashPassword(roomPass);
                
                await docRef.set({ password: hashedPass, createdBy: myName, deviceId: myDeviceId, createdAt: firebase.firestore.FieldValue.serverTimestamp(), participants: [myName] });
                
                saveRoomToLocalList(roomName, hashedPass, roomPass);
                currentRoom = roomName; currentRoomKey = roomName;
                ls.setItem('ls_current_room', currentRoom); ls.setItem('ls_room_key', currentRoomKey);
                
                sendSystemAction('SYSTEM_CREATED'); updateLastRead(currentRoom); inputRoom.value = ''; inputPass.value = ''; checkScreenState();
            } catch (e) {}
        });

        shadow.getElementById('ls-join-room-btn').addEventListener('click', async () => {
            const roomName = inputRoom.value.trim().toLowerCase();
            const roomPass = inputPass.value.trim();
            if(!roomName || !roomPass) return alert("Preencha o nome e a senha!");
            try {
                const docRef = db.collection('rooms').doc(roomName);
                const doc = await docRef.get();
                if(!doc.exists) return alert("Sala não encontrada.");
                const hashedPass = await hashPassword(roomPass);
                if(doc.data().password !== hashedPass) return alert("Senha incorreta!");
                
                const isNewMember = !doc.data().participants || !doc.data().participants.includes(myName);
                
                saveRoomToLocalList(roomName, hashedPass, roomPass);
                currentRoom = roomName; currentRoomKey = roomName;
                ls.setItem('ls_current_room', currentRoom); ls.setItem('ls_room_key', currentRoomKey);
                
                await db.collection('rooms').doc(currentRoom).set({ participants: firebase.firestore.FieldValue.arrayUnion(myName) }, { merge: true }).catch(()=>{});
                
                if (isNewMember) sendSystemAction('SYSTEM_FIRST_JOIN');
                
                updateLastRead(currentRoom); inputRoom.value = ''; inputPass.value = ''; checkScreenState();
            } catch (e) {}
        });

        const chatMenuBtn = shadow.getElementById('ls-chat-menu-btn');
        const chatDropdown = shadow.getElementById('ls-chat-dropdown');

        chatMenuBtn.addEventListener('click', (e) => { e.stopPropagation(); chatDropdown.classList.toggle('show'); });
        shadow.getElementById('ls-menu-theater').addEventListener('click', () => { 
            chatDropdown.classList.remove('show'); 
            myIntegratedMode = !myIntegratedMode; 
            ls.setItem('ls_integrated', myIntegratedMode); 
            checkScreenState(); 
        });
        shadow.getElementById('ls-menu-share').addEventListener('click', () => {
            chatDropdown.classList.remove('show'); if(!currentRoom) return;
            let passToShare = ""; const roomData = savedRooms.find(r => r.name === currentRoom);
            if (roomData && roomData.rawPass) { passToShare = roomData.rawPass; } 
            else { passToShare = prompt("Qual a senha dessa sala para incluir no convite?") || "[Sua Senha]"; if (roomData && passToShare !== "[Sua Senha]") { roomData.rawPass = passToShare; ls.setItem('ls_saved_rooms', JSON.stringify(savedRooms)); } }
            const link = `Vem assistir comigo no LidySync!\n🍿 Nome da Sala: ${currentRoom}\n🔑 Senha: ${passToShare}\n\nCaso não tenha a extensão clique aqui para aprender a instalar: https://ofaceoff.github.io/LidySync/index.html`;
            navigator.clipboard.writeText(link); alert("Convite copiado!");
        });

        shadow.getElementById('ls-menu-settings').addEventListener('click', () => {
            chatDropdown.classList.remove('show');
            if (settingsOverlay.style.display === 'flex') { settingsOverlay.style.display = 'none'; } 
            else { settingsOverlay.style.display = 'flex'; shadow.getElementById('ls-config-autoplay').checked = myAutoPlay; }
        });

        shadow.getElementById('ls-close-settings-modal').addEventListener('click', () => { settingsOverlay.style.display = 'none'; editingRoomAppearance = null; });
        shadow.getElementById('ls-menu-members').addEventListener('click', () => { chatDropdown.classList.remove('show'); membersOverlay.style.display = 'flex'; fetchAndRenderMembers(currentRoom, shadow.getElementById('ls-members-list')); });
        shadow.getElementById('ls-close-members-modal').addEventListener('click', () => { membersOverlay.style.display = 'none'; });

        shadow.getElementById('ls-menu-leave').addEventListener('click', async () => {
            chatDropdown.classList.remove('show');
            if(!confirm("Tem certeza que deseja sair definitivamente desta sala?")) return;
            sendSystemAction('SYSTEM_LEFT_PERMANENTLY');
            try { await db.collection('rooms').doc(currentRoom).update({ participants: firebase.firestore.FieldValue.arrayRemove(myName) }); } catch(e){}
            savedRooms = savedRooms.filter(r => r.name !== currentRoom);
            ls.setItem('ls_saved_rooms', JSON.stringify(savedRooms));
            if (isTyping && currentRoom) { clearTimeout(typingTimeout); isTyping = false; }
            stopChatListeners(); currentRoom = null; currentRoomKey = null; currentRoomData = null; ls.removeItem('ls_current_room'); ls.removeItem('ls_room_key'); checkScreenState();
        });

        shadow.getElementById('ls-minimize-btn').addEventListener('click', () => {
            if (myIntegratedMode) { alert("O Chat está no Modo Teatro. Desative essa opção no menu ou nas configurações para minimizar a janela."); return; }
            chatWindow.classList.remove('open');
            if (myHideApp) fab.style.display = 'none'; else fab.style.display = 'flex';
            if (currentRoom) updateLastRead(currentRoom);
        });

        shadow.getElementById('ls-close-btn').addEventListener('click', () => { 
            if (myIntegratedMode) { alert("O Chat está no Modo Teatro. Desative essa opção no menu ou nas configurações para fechar o app."); return; }
            chatWindow.classList.remove('open'); 
            fab.style.display = 'none';
            if (currentRoom) updateLastRead(currentRoom);
        });
        
        shadow.getElementById('ls-menu-delete').addEventListener('click', async () => { 
            chatDropdown.classList.remove('show'); 
            if (currentRoomData && currentRoomData.createdBy !== myName) return alert("Apenas o Host da sala pode encerrá-la.");
            if(!confirm("Encerrar e deletar a sala para todos?")) return; 
            try { await db.collection('rooms').doc(currentRoom).delete(); } catch(e){} 
        });

        backBtn.addEventListener('click', () => { 
            if (isTyping && currentRoom) { 
                clearTimeout(typingTimeout); 
                isTyping = false; 
                db.collection('rooms').doc(currentRoom).update({ typing: firebase.firestore.FieldValue.arrayRemove(myName) }).catch(()=>{}); 
            }
            stopChatListeners(); 
            currentRoom = null; 
            currentRoomKey = null; 
            currentRoomData = null; 
            ls.removeItem('ls_current_room'); 
            ls.removeItem('ls_room_key'); 
            checkScreenState(); 
        });

        function startChatListeners() {
            if (!currentRoom) return;
            stopChatListeners(); 
            const roomJoinTime = Date.now(); isFirstSnapshot = true; messagesContainer.innerHTML = ''; userCache = {};
            const roomRef = db.collection('rooms').doc(currentRoom); const messagesRef = roomRef.collection('messages');

            roomListener = roomRef.onSnapshot(doc => {
                if (!doc.exists) {
                    alert("A sala foi encerrada pelo criador."); stopChatListeners(); currentRoom = null; currentRoomKey = null; currentRoomData = null; ls.removeItem('ls_current_room'); ls.removeItem('ls_room_key'); savedRooms = savedRooms.filter(r => r.name !== doc.id); ls.setItem('ls_saved_rooms', JSON.stringify(savedRooms)); checkScreenState();
                } else {
                    const newData = doc.data();
                    
                    if (newData.participants && !newData.participants.includes(myName)) {
                        alert("Você não faz mais parte desta sala (Saiu ou foi expulso).");
                        stopChatListeners(); currentRoom = null; currentRoomKey = null; currentRoomData = null; ls.removeItem('ls_current_room'); ls.removeItem('ls_room_key'); 
                        savedRooms = savedRooms.filter(r => r.name !== doc.id); ls.setItem('ls_saved_rooms', JSON.stringify(savedRooms)); checkScreenState();
                        return;
                    }

                    if (newData.createdBy !== myName && newData.syncId && (!currentRoomData || currentRoomData.syncId !== newData.syncId)) {
                        const v = document.querySelector('video');
                        if (v) {
                            isRemoteAction = true;
                            if (Math.abs(v.currentTime - newData.playbackTime) > 1.5) {
                                v.currentTime = newData.playbackTime;
                            }
                            if (newData.playbackState === 'playing' && v.paused) {
                                v.play().catch(()=>{});
                            } else if (newData.playbackState === 'paused' && !v.paused) {
                                v.pause();
                            }
                            setTimeout(() => { isRemoteAction = false; }, 1000);
                        }
                    }

                    currentRoomData = newData;

                    const deleteBtn = shadow.getElementById('ls-menu-delete');
                    const leaveBtn = shadow.getElementById('ls-menu-leave');
                    const deleteDiv = shadow.getElementById('ls-menu-delete-divider');
                    if (currentRoomData.createdBy === myName) {
                        if (deleteBtn) deleteBtn.style.display = 'flex';
                        if (leaveBtn) leaveBtn.style.display = 'none';
                        if (deleteDiv) deleteDiv.style.display = 'block';
                    } else {
                        if (deleteBtn) deleteBtn.style.display = 'none';
                        if (leaveBtn) leaveBtn.style.display = 'flex';
                        if (deleteDiv) deleteDiv.style.display = 'block';
                    }

                    if (currentRoomData.participants) { currentRoomData.participants.forEach(p => { if (!userCache[p]) { db.collection('users').doc(p).get().then(u => { if (u.exists) userCache[p] = u.data(); }); } }); }
                    
                    const typingEl = shadow.getElementById('ls-typing-indicator');
                    if (currentRoomData.typing && Array.isArray(currentRoomData.typing) && typingEl) {
                        const typers = currentRoomData.typing.filter(u => u !== myName);
                        if (typers.length === 1) {
                            typingEl.innerText = `${typers[0]} está digitando...`;
                            typingEl.style.display = 'block';
                        } else if (typers.length === 2) {
                            typingEl.innerText = `${typers[0]} e ${typers[1]} estão digitando...`;
                            typingEl.style.display = 'block';
                        } else if (typers.length >= 3) {
                            typingEl.innerText = `${typers[0]} e mais outras pessoas estão digitando...`;
                            typingEl.style.display = 'block';
                        } else {
                            typingEl.style.display = 'none';
                        }
                    } else if (typingEl) {
                        typingEl.style.display = 'none';
                    }
                }
            });

            messagesListener = messagesRef.orderBy('timestamp', 'asc').limitToLast(50).onSnapshot((snapshot) => {
                messagesContainer.innerHTML = '';
                let currentUnread = 0; const lastRead = lastReadTimes[currentRoom] || 0; const myCleanName = myName.replace(/\s/g, '').toLowerCase();
                
                let lastSender = null;
                let lastMsgType = null;
                let lastTimestamp = 0;

                snapshot.forEach((doc) => {
                    const data = doc.data(); const docId = doc.id; const isMe = data.sender === myName; const isAdm = currentRoomData && currentRoomData.createdBy === data.sender;
                    const msgTimeMs = data.timestamp ? data.timestamp.toMillis() : Date.now();
                    if (!isMe && !data.deleted) { if (msgTimeMs > lastRead) currentUnread++; }

                    let isSameSender = false;
                    if (lastSender === data.sender && lastMsgType === 'user' && (data.type === 'text' || data.type === 'image' || data.type === 'gif') && (msgTimeMs - lastTimestamp < 300000)) {
                        isSameSender = true;
                    }

                    const container = document.createElement('div');
                    
                    if (data.type === 'countdown') {
                        if (data.deleted) return; 
                        lastSender = null; lastMsgType = 'system'; lastTimestamp = msgTimeMs;
                        
                        if (data.text === 'SYSTEM_CREATED') {
                            container.className = 'ls-message-container system-msg-container';
                            container.innerHTML = `<div class="ls-message system-msg" style="background:transparent!important; box-shadow:none; border:none; padding:4px;">✨ <b>${data.sender}</b> criou a sala <span class="ls-msg-time">${formatTime(data.timestamp)}</span></div>`;
                        } else if (data.text === 'SYSTEM_FIRST_JOIN') {
                            container.className = 'ls-message-container system-msg-container';
                            container.innerHTML = `<div class="ls-message system-msg" style="background:transparent!important; box-shadow:none; border:none; padding:4px;">👋 <b>${data.sender}</b> agora faz parte dessa sala <span class="ls-msg-time">${formatTime(data.timestamp)}</span></div>`;
                        } else if (data.text === 'SYSTEM_LEFT_PERMANENTLY') {
                            container.className = 'ls-message-container system-msg-container';
                            container.innerHTML = `<div class="ls-message system-msg" style="background:transparent!important; box-shadow:none; border:none; padding:4px; opacity:0.6;">🚪 <b>${data.sender}</b> não faz mais parte dessa sala <span class="ls-msg-time">${formatTime(data.timestamp)}</span></div>`;
                        } else if (data.text.startsWith('SYSTEM_KICKED:')) {
                            const targetUser = data.text.split(':')[1];
                            container.className = 'ls-message-container system-msg-container';
                            container.innerHTML = `<div class="ls-message system-msg" style="background:rgba(239,68,68,0.1)!important; color:#ef4444; border:1px solid rgba(239,68,68,0.2); padding:6px 12px;">🚫 <b>${targetUser}</b> foi expulso da sala e não faz mais parte dela <span class="ls-msg-time">${formatTime(data.timestamp)}</span></div>`;
                        } else if (data.text === 'SYSTEM_WENT_AWAY') {
                            container.className = 'ls-message-container system-msg-container';
                            container.innerHTML = `<div class="ls-message system-msg" style="background:transparent!important; box-shadow:none; border:none; padding:4px; opacity:0.6;">🚶 <b>${data.sender}</b> foi embora <span class="ls-msg-time">${formatTime(data.timestamp)}</span></div>`;
                        } else if (data.text === 'SYSTEM_JOIN') {
                            if (myHideSys) return; 
                            container.className = 'ls-message-container system-msg-container';
                            container.innerHTML = `<div class="ls-message system-msg" style="background:transparent!important; box-shadow:none; border:none; padding:4px;">👋 <b>${data.sender}</b> entrou na sala <span class="ls-msg-time">${formatTime(data.timestamp)}</span></div>`;
                        } else if (data.text === 'SYSTEM_LEAVE') {
                            if (myHideSys) return; 
                            container.className = 'ls-message-container system-msg-container';
                            container.innerHTML = `<div class="ls-message system-msg" style="background:transparent!important; box-shadow:none; border:none; padding:4px; opacity:0.6;">🚪 <b>${data.sender}</b> saiu <span class="ls-msg-time">${formatTime(data.timestamp)}</span></div>`;
                        } else if (data.text === 'SYSTEM_PAUSE') {
                            container.className = 'ls-message-container system-msg-container';
                            container.innerHTML = `<div class="ls-message system-msg">⏸️ <b>${data.sender}</b> pausou a programação! <span class="ls-msg-time" style="display:block; margin-top:2px;">${formatTime(data.timestamp)}</span></div>`;
                        } else if (data.text === 'sincronizou com o anfitrião!') {
                            container.className = 'ls-message-container system-msg-container';
                            container.innerHTML = `<div class="ls-message system-msg">🔄 <b>${data.sender}</b> sincronizou com o anfitrião! <span class="ls-msg-time" style="display:block; margin-top:2px;">${formatTime(data.timestamp)}</span></div>`;
                        } else {
                            container.className = 'ls-message-container system-msg-container';
                            container.innerHTML = `<div class="ls-message system-msg">🎬 ${data.sender} ${data.text} <span class="ls-msg-time" style="display:block; margin-top:2px;">${formatTime(data.timestamp)}</span></div>`;
                        }
                    } else if (data.type === 'invite') {
                        if (data.deleted) return;
                        lastSender = null; lastMsgType = 'system'; lastTimestamp = msgTimeMs;
                        container.className = 'ls-message-container system-msg-container';
                        container.innerHTML = `
                            <div class="ls-message system-msg" style="background: var(--btn-primary-bg) !important; color: var(--btn-primary-color) !important; border:none; padding:0;">
                                <a href="${data.url}" target="_blank" style="color: inherit; text-decoration: none; display: block; padding: 10px 16px;">
                                    🍿 ${data.sender} convidou o chat para a programação atual!<br><small style="text-decoration:underline;">Clique para abrir</small>
                                    <span class="ls-msg-time" style="display:block; margin-top:4px; color:inherit; opacity:0.8;">${formatTime(data.timestamp)}</span>
                                </a>
                            </div>
                        `;
                    } else if (data.type === 'text' || data.type === 'image' || data.type === 'gif') {
                        container.className = `ls-message-container ${isMe ? 'sent' : 'received'}`;
                        if (isSameSender) container.style.marginTop = '-8px';
                        
                        const senderRow = document.createElement('div'); senderRow.className = 'ls-sender-row';
                        
                        if (!isSameSender) {
                            const nameLabel = document.createElement('span'); nameLabel.className = 'ls-sender-name'; nameLabel.innerText = data.sender; nameLabel.onclick = () => openProfile(data.sender); senderRow.appendChild(nameLabel);
                            const tagsContainer = document.createElement('span'); tagsContainer.className = 'ls-tags-container';
                            tagsContainer.innerHTML = buildTagsHTML(isAdm, userCache[data.sender]);
                            senderRow.appendChild(tagsContainer);
                        }
                        
                        const timeLabel = document.createElement('span'); timeLabel.className = 'ls-msg-time'; timeLabel.innerText = formatTime(data.timestamp); senderRow.appendChild(timeLabel);
                        
                        if (!data.deleted) {
                            const actionBtn = document.createElement('span'); actionBtn.className = 'ls-msg-action'; actionBtn.innerText = '↩️'; actionBtn.title = "Responder";
                            actionBtn.onclick = () => { replyTarget = { sender: data.sender, text: data.type === 'text' ? data.text : (data.type === 'image' ? 'Imagem' : 'GIF') }; shadow.getElementById('ls-reply-bar-text').innerHTML = `Respondendo <b>${data.sender}</b>: <span style="opacity:0.8;">${replyTarget.text.substring(0, 30)}...</span>`; shadow.getElementById('ls-reply-bar').style.display = 'block'; input.focus(); };
                            senderRow.appendChild(actionBtn);
                        }

                        if (isMe && !data.deleted) {
                            const delBtn = document.createElement('span'); delBtn.className = 'ls-msg-action'; delBtn.innerText = '🗑️'; delBtn.title = "Apagar";
                            delBtn.onclick = async () => { try { await messagesRef.doc(docId).set({ deleted: true }, { merge: true }); } catch (e) {} };
                            senderRow.appendChild(delBtn);
                        }
                        
                        const msgBubble = document.createElement('div'); msgBubble.className = 'ls-message';
                        if (data.type === 'image' || data.type === 'gif') msgBubble.style.padding = '4px';

                        if(data.textColor) { msgBubble.style.color = data.textColor; } else if (isMe) { msgBubble.style.color = '#ffffff'; }

                        if (data.deleted) {
                            msgBubble.classList.add('deleted-msg'); msgBubble.innerText = (data.type === 'text') ? "🚫 Mensagem apagada" : "🚫 Imagem apagada";
                        } else {
                            let replyHTML = '';
                            let formattedText = '';
                            
                            if (data.type === 'image' || data.type === 'gif') {
                                 if (data.url && data.url.includes('|-REPLY-|')) {
                                     const parts = data.url.split('|-REPLY-|');
                                     replyHTML = `<div style="background: rgba(0,0,0,0.2); border-left: 3px solid currentColor; padding: 4px 8px; margin-bottom: 6px; border-radius: 4px; font-size: 11px; opacity: 0.8;"><b>${escapeHTML(parts[0])}</b><br>${escapeHTML(parts[1])}</div>`;
                                     msgBubble.innerHTML = `${replyHTML}<img src="${parts[2]}">`;
                                 } else { msgBubble.innerHTML = `<img src="${data.url}">`; }
                            } else {
                                 formattedText = linkify(data.text);
                                 const replyMatch = formattedText.match(/^\[REPLY:(.*?)\|(.*?)\] /);
                                 if (replyMatch) {
                                     const blockquote = `<div style="background: rgba(0,0,0,0.2); border-left: 3px solid currentColor; padding: 4px 8px; margin-bottom: 6px; border-radius: 4px; font-size: 11px; opacity: 0.8;"><b>${replyMatch[1]}</b><br>${replyMatch[2]}</div>`;
                                     formattedText = formattedText.replace(replyMatch[0], blockquote);
                                 }
                                 
                                 const timeRegex = /\b(\d{1,2}:)?([0-5]?\d):([0-5]\d)\b/g;
                                 formattedText = formattedText.replace(timeRegex, (match) => {
                                     const parts = match.split(':').map(Number);
                                     let secs = 0;
                                     if (parts.length === 3) secs = parts[0] * 3600 + parts[1] * 60 + parts[2];
                                     else if (parts.length === 2) secs = parts[0] * 60 + parts[1];
                                     return `<span class="ls-timecode" data-time="${secs}" style="color: var(--highlight); text-decoration: underline; cursor: pointer; font-weight: bold;" title="Pular para ${match}">${match}</span>`;
                                 });

                                 formattedText = formattedText.replace(/(^|\s)@([a-zA-Z0-9_]+)/g, (match, space, nameMatch) => {
                                     if (nameMatch.toLowerCase() === myCleanName) return `${space}<span style="background: var(--fab-bg); color: var(--fab-color); padding: 2px 6px; border-radius: 8px; font-weight: bold; box-shadow: 0 0 10px rgba(99,102,241,0.5);">@${nameMatch}</span>`;
                                     else return `${space}<span style="color: #06b6d4; font-weight: bold;">@${nameMatch}</span>`;
                                 });
                                 msgBubble.innerHTML = formattedText;
                            }
                            if(isMe) { msgBubble.style.background = data.color || '#5b5cf6'; }
                        }
                        
                        msgBubble.querySelectorAll('img').forEach(img => {
                            img.addEventListener('click', () => {
                                viewerImg.src = img.src;
                                imageViewer.style.display = 'flex';
                                setTimeout(() => imageViewer.classList.add('show'), 10);
                            });
                        });
                        
                        msgBubble.querySelectorAll('.ls-timecode').forEach(el => {
                            el.addEventListener('click', () => {
                                const t = parseFloat(el.getAttribute('data-time'));
                                const v = document.querySelector('video');
                                if (v) { v.currentTime = t; v.play().catch(()=>{}); }
                            });
                        });
                        
                        container.appendChild(senderRow); container.appendChild(msgBubble);
                        
                        lastSender = data.sender;
                        lastMsgType = 'user';
                        lastTimestamp = msgTimeMs;
                    }
                    
                    if (data.type === 'party') {
                        lastSender = null; lastMsgType = 'system'; lastTimestamp = msgTimeMs;
                        if (msgTimeMs > roomJoinTime) {
                            const partyOverlay = shadow.getElementById('ls-party-overlay');
                            const ball = shadow.getElementById('ls-disco-ball');
                            if (partyOverlay) {
                                clearTimeout(lsPartyTimeout);
                                partyOverlay.style.display = 'flex';
                                partyOverlay.classList.add('party-active');
                                setTimeout(() => ball.classList.add('drop'), 100);
                                lsPartyTimeout = setTimeout(() => {
                                    partyOverlay.style.display = 'none';
                                    partyOverlay.classList.remove('party-active');
                                    ball.classList.remove('drop');
                                }, 10000);
                            }
                        }
                    } else if (data.type === 'stopparty') {
                        lastSender = null; lastMsgType = 'system'; lastTimestamp = msgTimeMs;
                        if (msgTimeMs > roomJoinTime) {
                            const partyOverlay = shadow.getElementById('ls-party-overlay');
                            const ball = shadow.getElementById('ls-disco-ball');
                            if (partyOverlay) {
                                clearTimeout(lsPartyTimeout);
                                partyOverlay.style.display = 'none';
                                partyOverlay.classList.remove('party-active');
                                ball.classList.remove('drop');
                            }
                        }
                    } else if (container.innerHTML !== "") {
                        messagesContainer.appendChild(container);
                    }
                });

                snapshot.docChanges().forEach((change) => {
                    const data = change.doc.data();
                    if (change.type === 'added' && !data.deleted) {
                        const msgTime = data.timestamp ? data.timestamp.toMillis() : Date.now();
                        if (msgTime > roomJoinTime) {
                            if (data.type === 'countdown') {
                                if (data.text === 'iniciou a programação!') runVisualCountdown(data.sender);
                                else if (data.text === 'SYSTEM_PAUSE' && myAutoPlay) document.querySelectorAll('video').forEach(v => v.pause());
                            }
                            if (data.sender !== myName && data.type !== 'party' && data.type !== 'stopparty') {
                                if (!chatWindow.classList.contains('open') && !myIntegratedMode) {
                                    if(!mutedRooms.includes(currentRoom)) playNotificationSound();
                                    unreadCount++; badge.style.display = 'flex'; badge.innerText = unreadCount > 5 ? '5+' : unreadCount;
                                    if (myHideApp && myHideRevive) fab.style.display = 'flex';
                                } else { if(!mutedRooms.includes(currentRoom)) playReceiveSound(); }
                            }
                        }
                    }
                });

                if (chatWindow.classList.contains('open')) { updateLastRead(currentRoom); unreadCount = 0; badge.style.display = 'none'; } 
                else if (currentUnread > 0 && !myIntegratedMode) { badge.style.display = 'flex'; badge.innerText = currentUnread > 5 ? '5+' : currentUnread; if (myHideApp && myHideRevive) fab.style.display = 'flex'; }
                scrollToBottom(); isFirstSnapshot = false;
            });
        }

        function stopChatListeners() { if (roomListener) roomListener(); if (messagesListener) messagesListener(); roomListener = null; messagesListener = null; }

        shadow.getElementById('ls-save-config-btn').addEventListener('click', async () => {
            const aPlay = shadow.getElementById('ls-config-autoplay').checked;
            myAutoPlay = aPlay;
            ls.setItem('ls_autoplay', myAutoPlay);
            settingsOverlay.style.display = 'none';
            editingRoomAppearance = null;
        });

        const scrollToBottom = () => { messagesContainer.scrollTop = messagesContainer.scrollHeight; };
        
        fab.addEventListener('click', () => { chatWindow.classList.add('open'); fab.style.display = 'none'; unreadCount = 0; badge.style.display = 'none'; if (currentRoom) updateLastRead(currentRoom); checkScreenState(); });

        const minimizeBtnObj = shadow.getElementById('ls-minimize-btn');
        minimizeBtnObj.addEventListener('click', () => {
            if (myIntegratedMode) { alert("O Chat está no Modo Teatro. Desative essa opção no menu ou nas configurações para minimizar a janela."); return; }
            chatWindow.classList.remove('open');
            if (myHideApp) fab.style.display = 'none'; else fab.style.display = 'flex';
            if (currentRoom) updateLastRead(currentRoom);
        });

        const closeBtnObj = shadow.getElementById('ls-close-btn');
        closeBtnObj.addEventListener('click', () => { 
            if (myIntegratedMode) { alert("O Chat está no Modo Teatro. Desative essa opção no menu ou nas configurações para fechar o app."); return; }
            chatWindow.classList.remove('open'); 
            fab.style.display = 'none';
            if (currentRoom) updateLastRead(currentRoom);
        });

        shadow.getElementById('ls-reply-bar-close').addEventListener('click', () => { replyTarget = null; shadow.getElementById('ls-reply-bar').style.display = 'none'; });

        const btnPlus = shadow.getElementById('ls-btn-plus'); const btnEmoji = shadow.getElementById('ls-btn-emoji'); const emojiPanel = shadow.getElementById('ls-emoji-panel'); const plusPanel = shadow.getElementById('ls-plus-panel');
        btnEmoji.addEventListener('click', () => { emojiPanel.style.display = emojiPanel.style.display === 'flex' ? 'none' : 'flex'; plusPanel.style.display = 'none'; });
        btnPlus.addEventListener('click', () => { plusPanel.style.display = plusPanel.style.display === 'flex' ? 'none' : 'flex'; emojiPanel.style.display = 'none'; });
        shadow.querySelectorAll('.ls-emoji-item').forEach(item => { item.addEventListener('click', (e) => { input.value += e.target.innerText; emojiPanel.style.display = 'none'; input.focus(); }); });

        input.addEventListener('keydown', (e) => {
            if (isMentioning && mentionPanel.style.display === 'flex') {
                const items = mentionPanel.querySelectorAll('.ls-mention-item');
                if (e.key === 'ArrowDown') {
                    e.preventDefault(); items[activeMentionIndex].classList.remove('active'); activeMentionIndex = (activeMentionIndex + 1) % items.length; items[activeMentionIndex].classList.add('active'); items[activeMentionIndex].scrollIntoView({block: 'nearest'});
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault(); items[activeMentionIndex].classList.remove('active'); activeMentionIndex = (activeMentionIndex - 1 + items.length) % items.length; items[activeMentionIndex].classList.add('active'); items[activeMentionIndex].scrollIntoView({block: 'nearest'});
                } else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(mentionMatches[activeMentionIndex]); } 
                else if (e.key === 'Escape') { mentionPanel.style.display = 'none'; isMentioning = false; }
            } else if (e.key === 'Enter') { sendMessage(); }
        });

        input.addEventListener('focus', () => { emojiPanel.style.display = 'none'; plusPanel.style.display = 'none'; });

        input.addEventListener('paste', (e) => {
            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            for (let index in items) {
                const item = items[index];
                if (item.kind === 'file' && item.type.indexOf('image/') === 0) {
                    const blob = item.getAsFile(); const reader = new FileReader();
                    reader.onload = async (event) => { compressImage(event.target.result, async (compressedUrl) => { await sendImageMsg(compressedUrl); }); };
                    reader.readAsDataURL(blob);
                }
            }
        });

        const countdownOverlay = shadow.getElementById('ls-countdown-overlay'); const countdownNumber = shadow.getElementById('ls-countdown-number');
        function runVisualCountdown(senderName) {
            countdownOverlay.style.display = 'flex'; shadow.getElementById('ls-countdown-text').innerText = `${senderName} vai dar play...`;
            let count = 3; countdownNumber.innerText = count; countdownNumber.style.color = "var(--highlight)"; 
            const timer = setInterval(() => {
                count--;
                if (count > 0) { countdownNumber.innerText = count; } 
                else if (count === 0) { countdownNumber.innerText = "PLAY!"; countdownNumber.style.color = "#10b981"; if (myAutoPlay) { try { const video = document.querySelector('video'); if (video) video.play(); } catch (e) {} } } 
                else { clearInterval(timer); countdownOverlay.style.display = 'none'; }
            }, 1000);
        }

        shadow.getElementById('btn-action-sharetime').addEventListener('click', () => {
            plusPanel.style.display = 'none';
            const v = document.querySelector('video');
            if (v) {
                const s = Math.floor(v.currentTime);
                const hrs = Math.floor(s / 3600);
                const mins = Math.floor((s % 3600) / 60);
                const secs = s % 60;
                const timeStr = hrs > 0 ? `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}` : `${mins}:${secs.toString().padStart(2, '0')}`;
                input.value += (input.value ? ' ' : '') + timeStr + ' ';
                input.focus();
            } else {
                alert("Nenhum vídeo encontrado para copiar o tempo.");
            }
        });

        shadow.getElementById('btn-action-sync').addEventListener('click', () => {
            plusPanel.style.display = 'none';
            if (!currentRoomData || typeof currentRoomData.playbackTime === 'undefined') return alert("O anfitrião ainda não reproduziu ou pausou o vídeo para sincronizar.");
            const v = document.querySelector('video');
            if (v) {
                isRemoteAction = true;
                v.currentTime = currentRoomData.playbackTime;
                if(currentRoomData.playbackState === 'playing') {
                    v.play().catch(()=>{});
                } else {
                    v.pause();
                }
                sendSystemAction('sincronizou com o anfitrião!');
                setTimeout(() => { isRemoteAction = false; }, 1000);
            } else {
                alert("Nenhum vídeo encontrado na tela.");
            }
        });

        shadow.getElementById('btn-action-invite').addEventListener('click', async () => {
            plusPanel.style.display = 'none'; if(!currentRoom || !currentRoomKey) return;
            if (checkFlood()) return;
            try { await db.collection('rooms').doc(currentRoom).collection('messages').add({ type: 'invite', text: 'convidou o chat para a programação atual!', url: window.location.href, sender: myName, deviceId: myDeviceId, color: myColor, roomKey: currentRoomKey, timestamp: firebase.firestore.FieldValue.serverTimestamp(), deleted: false }); updateLastRead(currentRoom); playSendSound(); } catch (e) {}
        });

        shadow.getElementById('btn-action-countdown').addEventListener('click', async () => { 
            plusPanel.style.display = 'none'; 
            if (checkFlood()) return;
            sendSystemAction('iniciou a programação!'); 
        });
        
        shadow.getElementById('btn-action-pause').addEventListener('click', async () => { 
            plusPanel.style.display = 'none'; 
            if (checkFlood()) return;
            sendSystemAction('SYSTEM_PAUSE'); 
        });

        shadow.getElementById('btn-action-gif').addEventListener('click', async () => {
            plusPanel.style.display = 'none'; const gifUrl = prompt("Cole o link do GIF:"); if(!gifUrl || !currentRoom) return; if(!currentRoomKey) return alert("Sessão inválida.");
            if (checkFlood()) return;
            let finalUrl = gifUrl;
            if (replyTarget) { finalUrl = `${replyTarget.sender}|-REPLY-|${replyTarget.text}|-REPLY-|${gifUrl}`; replyTarget = null; shadow.getElementById('ls-reply-bar').style.display = 'none'; }
            try { await db.collection('rooms').doc(currentRoom).collection('messages').add({ type: 'gif', url: finalUrl, sender: myName, deviceId: myDeviceId, color: myColor, roomKey: currentRoomKey, timestamp: firebase.firestore.FieldValue.serverTimestamp(), deleted: false }); updateLastRead(currentRoom); playSendSound(); } catch (e) {}
        });

        shadow.getElementById('btn-action-camera').addEventListener('click', async () => {
            plusPanel.style.display = 'none'; shadow.getElementById('ls-camera-overlay').style.display = 'flex';
            try { localStream = await navigator.mediaDevices.getUserMedia({ video: true }); shadow.getElementById('ls-camera-video').srcObject = localStream; } catch(e) { alert("Erro ao acessar a câmera."); shadow.getElementById('ls-camera-overlay').style.display = 'none'; }
        });

        shadow.getElementById('ls-close-camera').addEventListener('click', () => { if(localStream) localStream.getTracks().forEach(t => t.stop()); shadow.getElementById('ls-camera-overlay').style.display = 'none'; });

        shadow.getElementById('ls-capture-btn').addEventListener('click', async () => {
            const video = shadow.getElementById('ls-camera-video'); const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height); const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            if(localStream) localStream.getTracks().forEach(t => t.stop()); shadow.getElementById('ls-camera-overlay').style.display = 'none'; await sendImageMsg(dataUrl);
        });

        async function sendImageMsg(dataUrl) {
            if (!myName || !currentRoom || !currentRoomKey) return;
            if (checkFlood()) return;
            let finalUrl = dataUrl;
            if (replyTarget) { finalUrl = `${replyTarget.sender}|-REPLY-|${replyTarget.text}|-REPLY-|${dataUrl}`; replyTarget = null; shadow.getElementById('ls-reply-bar').style.display = 'none'; }
            try { await db.collection('rooms').doc(currentRoom).collection('messages').add({ type: 'image', url: finalUrl, sender: myName, deviceId: myDeviceId, color: myColor, roomKey: currentRoomKey, timestamp: firebase.firestore.FieldValue.serverTimestamp(), deleted: false }); updateLastRead(currentRoom); playSendSound(); } catch (e) {}
        }

        async function sendMessage() {
            const rawText = input.value.trim();
            if (!rawText || !myName || !currentRoom) return;
            if (rawText.length > 150) return alert("Mensagem muito longa (máximo 150 caracteres).");
            if (!currentRoomKey) return alert("Sessão inválida.");
            if (checkFlood()) return;

            if (rawText.startsWith('/')) {
                input.value = '';
                const parts = rawText.split(' ');
                const cmd = parts[0].toLowerCase();

                const myUserDoc = await db.collection('users').doc(myName).get();
                const myTags = myUserDoc.exists ? (myUserDoc.data().tags || []) : [];
                const isOwnerOrDev = myTags.includes('OWNER') || myTags.includes('DEV');

                if (cmd === '/timestamp') {
                    const roomInfo = await db.collection('rooms').doc(currentRoom).get();
                    if (roomInfo.exists) {
                        const created = roomInfo.data().createdAt ? roomInfo.data().createdAt.toDate().toLocaleString() : 'Desconhecida';
                        const creator = roomInfo.data().createdBy || 'Desconhecido';
                        const container = document.createElement('div');
                        container.className = 'ls-message-container system-msg-container';
                        container.innerHTML = `<div class="ls-message system-msg">⏱️ <b>Sala Criada por:</b> ${creator}<br><b>Data:</b> ${created}</div>`;
                        messagesContainer.appendChild(container);
                        scrollToBottom();
                    }
                    return;
                }

                if (cmd === '/party1' && isOwnerOrDev) {
                    try { await db.collection('rooms').doc(currentRoom).collection('messages').add({ type: 'party', text: 'iniciou uma festa!', sender: myName, deviceId: myDeviceId, color: myColor, roomKey: currentRoomKey, timestamp: firebase.firestore.FieldValue.serverTimestamp(), deleted: false }); updateLastRead(currentRoom); } catch (e) {}
                    return;
                }
                
                if (cmd === '/stopparty1' && isOwnerOrDev) {
                    try { await db.collection('rooms').doc(currentRoom).collection('messages').add({ type: 'stopparty', text: 'parou a festa!', sender: myName, deviceId: myDeviceId, color: myColor, roomKey: currentRoomKey, timestamp: firebase.firestore.FieldValue.serverTimestamp(), deleted: false }); updateLastRead(currentRoom); } catch (e) {}
                    return;
                }

                const container = document.createElement('div');
                container.className = 'ls-message-container system-msg-container';
                container.innerHTML = `<div class="ls-message system-msg" style="color:#ef4444;">⚠️ Comando não reconhecido ou você não tem permissão.</div>`;
                messagesContainer.appendChild(container);
                scrollToBottom();
                return;
            }

            let finalText = rawText;
            if (replyTarget) { finalText = `[REPLY:${replyTarget.sender}|${replyTarget.text}] ${rawText}`; replyTarget = null; shadow.getElementById('ls-reply-bar').style.display = 'none'; }
            
            input.value = '';
            
            if (isTyping) {
                clearTimeout(typingTimeout);
                isTyping = false;
                db.collection('rooms').doc(currentRoom).update({ typing: firebase.firestore.FieldValue.arrayRemove(myName) }).catch(()=>{});
            }

            try { await db.collection('rooms').doc(currentRoom).collection('messages').add({ type: 'text', text: finalText, sender: myName, deviceId: myDeviceId, color: myColor, textColor: myTextColor, roomKey: currentRoomKey, timestamp: firebase.firestore.FieldValue.serverTimestamp(), deleted: false }); updateLastRead(currentRoom); playSendSound(); } catch (e) {}
        }

        shadow.getElementById('ls-send-btn').addEventListener('click', sendMessage);

        const fabAddBtn = shadow.getElementById('ls-fab-add');
        if (fabAddBtn) {
            fabAddBtn.addEventListener('click', () => {
                addRoomOverlay.style.display = 'flex';
            });
        }

        if (lobbySettingsBtn) {
            lobbySettingsBtn.addEventListener('click', () => {
                lobbySettingsOverlay.style.display = 'flex';
                shadow.getElementById('ls-app-theme').value = ls.getItem('ls_theme') || '';
                shadow.getElementById('ls-app-sound').checked = ls.getItem('ls_sound') !== 'false';
                shadow.getElementById('ls-app-inchatsound').checked = myInChatSound;
                shadow.getElementById('ls-app-hidesys').checked = myHideSys;
                shadow.getElementById('ls-app-hide').checked = myHideApp;
                shadow.getElementById('ls-app-revive').checked = myHideRevive;
                shadow.getElementById('ls-app-integrated').checked = myIntegratedMode;
            });
        }

        const closeLobbyModal = shadow.getElementById('ls-close-lobby-modal');
        if (closeLobbyModal) {
            closeLobbyModal.addEventListener('click', () => {
                lobbySettingsOverlay.style.display = 'none';
            });
        }

        const saveLobbyConfigBtn = shadow.getElementById('ls-save-lobby-config-btn');
        if (saveLobbyConfigBtn) {
            saveLobbyConfigBtn.addEventListener('click', () => {
                const theme = shadow.getElementById('ls-app-theme').value;
                const sound = shadow.getElementById('ls-app-sound').checked;
                myInChatSound = shadow.getElementById('ls-app-inchatsound').checked;
                myHideSys = shadow.getElementById('ls-app-hidesys').checked;
                myHideApp = shadow.getElementById('ls-app-hide').checked;
                myHideRevive = shadow.getElementById('ls-app-revive').checked;
                myIntegratedMode = shadow.getElementById('ls-app-integrated').checked;

                ls.setItem('ls_theme', theme);
                ls.setItem('ls_sound', sound);
                ls.setItem('ls_inchat_sounds', myInChatSound);
                ls.setItem('ls_hide_sys', myHideSys);
                ls.setItem('ls_hide_app', myHideApp);
                ls.setItem('ls_hide_revive', myHideRevive);
                ls.setItem('ls_integrated', myIntegratedMode);

                shadow.getElementById('ls-wrapper').className = theme;
                lobbySettingsOverlay.style.display = 'none';
                checkScreenState();
            });
        }

        const wipeDataBtn = shadow.getElementById('ls-wipe-data-btn');
        if (wipeDataBtn) {
            wipeDataBtn.addEventListener('click', () => {
                if(confirm("Tem certeza que deseja desconectar e apagar todos os dados locais do LidySync?")) {
                    ls.clear();
                    sessionStorage.clear();
                    location.reload();
                }
            });
        }
        
        if (myHideApp) fab.style.display = 'none';
        checkScreenState();
        
        setInterval(() => {
            if (window.location.href !== lastUrl) {
                lastUrl = window.location.href;
                if (myIntegratedMode) checkScreenState();
            }
        }, 1000);
        
        setInterval(() => {
            if (!myName) return;
            const now = Date.now();
            const currentTitle = document.title || "LidySync";
            const titleChanged = currentTitle !== lastDocumentTitle;
            const needsPing = now - lastPingTime > 120000; 

            if ((titleChanged || needsPing) && document.visibilityState === 'visible') {
                lastDocumentTitle = currentTitle;
                lastPingTime = now;
                db.collection('users').doc(myName).update({ 
                    watching: currentTitle, 
                    lastSeen: firebase.firestore.FieldValue.serverTimestamp() 
                }).catch(()=>{});
            }

            if (currentRoom && currentRoomData && currentRoomData.createdBy === myName) {
                const v = document.querySelector('video');
                if (v && !v.paused) {
                    db.collection('rooms').doc(currentRoom).update({ playbackTime: v.currentTime }).catch(()=>{});
                }
            }
        }, 5000);
    }

    function tryInject() {
        if (document.getElementById('lidysync-host')) return;
        const target = document.body || document.documentElement;
        if (!target) {
            setTimeout(tryInject, 100);
            return;
        }
        injectUI();
    }
    tryInject();

})();