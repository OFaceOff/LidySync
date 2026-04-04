// ==UserScript==
// @name         LidySync
// @namespace    https://github.com/OFaceOff
// @version      22.2
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

    function playNotificationSound() {
        if (localStorage.getItem('ls_sound') === 'false') return;
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
            osc.start();
            osc.stop(ctx.currentTime + 0.1);
        } catch (e) {}
    }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag]));
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
            let width = img.width;
            let height = img.height;
            const max = 800;
            if (width > height && width > max) {
                height *= max / width;
                width = max;
            } else if (height > max) {
                width *= max / height;
                height = max;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            callback(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = dataUrl;
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
        host.style.cssText = 'position: fixed !important; bottom: 90px !important; right: 20px !important; z-index: 2147483647 !important; pointer-events: none !important;';
        
        const shadow = host.attachShadow({ mode: 'open' });

        const style = document.createElement('style');
        style.textContent = `
            * { box-sizing: border-box; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; }
            
            #ls-wrapper {
                --bg-base: #0f172a;
                --bg-surface: #1e293b;
                --bg-overlay: rgba(15, 23, 42, 0.85);
                --bg-modal: #0f172a;
                --text-primary: #f8fafc;
                --text-muted: #94a3b8;
                --border-color: rgba(255,255,255,0.08);
                --glass-blur: blur(0px);
                --received-msg: #1e293b;
                --fab-bg: linear-gradient(135deg, #6366f1, #8b5cf6);
                --fab-color: #ffffff;
                --fab-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
                --btn-primary-bg: linear-gradient(135deg, #6366f1, #8b5cf6);
                --btn-primary-color: #ffffff;
                --btn-secondary-bg: #1e293b;
                pointer-events: auto; display: flex; flex-direction: column; align-items: flex-end; position: relative;
            }

            #ls-wrapper.theme-light {
                --bg-base: #f1f5f9;
                --bg-surface: #ffffff;
                --bg-overlay: rgba(241, 245, 249, 0.85);
                --bg-modal: #f1f5f9;
                --text-primary: #0f172a;
                --text-muted: #64748b;
                --border-color: rgba(0,0,0,0.1);
                --glass-blur: blur(0px);
                --received-msg: #ffffff;
                --fab-bg: #ffffff;
                --fab-color: #6366f1;
                --fab-shadow: 0 4px 15px rgba(0,0,0,0.15);
                --btn-primary-bg: #6366f1;
                --btn-primary-color: #ffffff;
                --btn-secondary-bg: #e2e8f0;
            }

            #ls-wrapper.theme-glass {
                --bg-base: rgba(15, 23, 42, 0.35);
                --bg-surface: rgba(255, 255, 255, 0.15);
                --bg-overlay: rgba(15, 23, 42, 0.3);
                --bg-modal: rgba(15, 23, 42, 0.95);
                --text-primary: #ffffff;
                --text-muted: #cbd5e1;
                --border-color: rgba(255,255,255,0.25);
                --glass-blur: blur(20px);
                --received-msg: rgba(255, 255, 255, 0.2);
                --fab-bg: rgba(255, 255, 255, 0.2);
                --fab-color: #ffffff;
                --fab-shadow: 0 4px 15px rgba(0,0,0,0.3);
                --btn-primary-bg: rgba(255, 255, 255, 0.3);
                --btn-primary-color: #ffffff;
                --btn-secondary-bg: rgba(0, 0, 0, 0.3);
            }

            #ls-wrapper.theme-hellokitty {
                --bg-base: #fff0f5;
                --bg-surface: #ffffff;
                --bg-overlay: rgba(255, 240, 245, 0.9);
                --bg-modal: #fff0f5;
                --text-primary: #be185d;
                --text-muted: #f472b6;
                --border-color: rgba(244, 114, 182, 0.3);
                --glass-blur: blur(0px);
                --received-msg: #fce7f3;
                --fab-bg: linear-gradient(135deg, #f472b6, #db2777);
                --fab-color: #ffffff;
                --fab-shadow: 0 4px 15px rgba(219, 39, 119, 0.3);
                --btn-primary-bg: linear-gradient(135deg, #f472b6, #db2777);
                --btn-primary-color: #ffffff;
                --btn-secondary-bg: #fbcfe8;
            }
            
            ::-webkit-scrollbar { width: 6px; }
            ::-webkit-scrollbar-thumb { background: var(--text-muted); border-radius: 6px; opacity: 0.5; }
            
            #ls-fab { width: 60px; height: 60px; background: var(--fab-bg); color: var(--fab-color); border-radius: 50%; display: flex; justify-content: center; align-items: center; cursor: pointer; box-shadow: var(--fab-shadow); backdrop-filter: var(--glass-blur); -webkit-backdrop-filter: var(--glass-blur); transition: transform 0.2s, box-shadow 0.2s; position: relative; }
            #ls-fab:hover { transform: scale(1.08); }
            #ls-fab svg { stroke: currentColor; }
            #ls-fab svg polygon { fill: currentColor; stroke: currentColor; }
            
            #ls-unread-badge { position: absolute; top: -4px; right: -4px; background: #ef4444; color: white; font-size: 12px; font-weight: 800; border-radius: 50%; min-width: 22px; height: 22px; display: none; align-items: center; justify-content: center; border: 2px solid var(--bg-base); z-index: 10; padding: 0 4px; }

            #ls-chat-window { width: 350px; height: 580px; background-color: var(--bg-base); border-radius: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.6); display: none; flex-direction: column; margin-bottom: 15px; overflow: hidden; border: 1px solid var(--border-color); position: relative; backdrop-filter: var(--glass-blur); -webkit-backdrop-filter: var(--glass-blur); transition: background-color 0.3s, backdrop-filter 0.3s; resize: both; min-width: 300px; min-height: 400px; max-width: 90vw; max-height: 90vh; }
            #ls-chat-window.open { display: flex; animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
            @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
            
            #ls-header { background-color: var(--bg-overlay); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); color: var(--text-primary); padding: 16px; display: flex; justify-content: space-between; align-items: center; font-size: 15px; font-weight: 600; z-index: 10; border-bottom: 1px solid var(--border-color); cursor: grab; }
            #ls-header:active { cursor: grabbing; }
            .ls-header-btns { display: flex; gap: 8px; align-items: center; cursor: default; }
            .ls-header-btn { cursor: pointer; color: var(--text-muted); font-size: 18px; background: none; border: none; transition: color 0.2s; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px;}
            .ls-header-btn:hover { color: var(--text-primary); background: rgba(128,128,128,0.1); }
            
            .ls-dropdown-container { position: relative; }
            .ls-dropdown-menu { position: absolute; right: 0; top: calc(100% + 5px); background-color: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); display: none; flex-direction: column; min-width: 180px; z-index: 50; overflow: hidden; }
            .ls-dropdown-menu.show { display: flex; animation: fadeIn 0.15s ease-out; }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
            .ls-dropdown-item { padding: 12px 16px; color: var(--text-primary); font-size: 13.5px; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: 0.2s; background: none; border: none; text-align: left; width: 100%; font-weight: 500; }
            .ls-dropdown-item:hover { background-color: rgba(128,128,128,0.1); }
            .ls-dropdown-item.danger { color: #ef4444; }
            
            .ls-screen { flex: 1; display: none; flex-direction: column; padding: 20px; background-color: transparent; gap: 16px; position: relative; overflow-y: auto;}
            
            #ls-room-list { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; padding-bottom: 70px; }
            .ls-room-item { display: flex; align-items: center; padding: 12px; background: rgba(128,128,128,0.05); border: 1px solid var(--border-color); border-radius: 12px; cursor: pointer; transition: 0.2s; position: relative; }
            .ls-room-item:hover { background: rgba(128,128,128,0.1); }
            .ls-room-avatar { width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #8b5cf6); display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px; color: white; margin-right: 12px; flex-shrink: 0; position: relative; }
            .ls-online-dot { position: absolute; bottom: 0; right: 0; width: 12px; height: 12px; background: #22c55e; border-radius: 50%; border: 2px solid var(--bg-surface); display: none; }
            .ls-room-info { flex: 1; overflow: hidden; }
            .ls-room-name { color: var(--text-primary); font-weight: 600; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 6px; }
            .ls-room-status { color: var(--text-muted); font-size: 12px; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .ls-room-unread { width: 10px; height: 10px; background: #ef4444; border-radius: 50%; display: none; margin-left: 8px; flex-shrink: 0; }
            .ls-room-options { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 8px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: 0.2s; margin-left: 4px; }
            .ls-room-options:hover { background: rgba(128,128,128,0.1); color: var(--text-primary); }

            /* TAGS UI */
            .ls-tags-container { display: inline-flex; gap: 4px; align-items: center; vertical-align: middle; }
            .ls-tag { font-size: 8px; font-weight: 800; padding: 2px 5px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
            .ls-tag-adm { background-color: #ef4444; color: #ffffff; }
            .ls-tag-dev { background-color: #eab308; color: #000000; }
            .ls-tag-owner { background-color: #a855f7; color: #ffffff; }
            .ls-tag-dobiel { background-color: #fbcfe8; color: #be185d; }
            .ls-tag-generic { background-color: rgba(128,128,128,0.2); color: inherit; }

            #ls-fab-add { position: absolute; bottom: 20px; right: 20px; width: 50px; height: 50px; background: var(--fab-bg); color: var(--fab-color); border-radius: 50%; display: flex; justify-content: center; align-items: center; cursor: pointer; box-shadow: var(--fab-shadow); font-size: 24px; transition: 0.2s; z-index: 20; border: none; backdrop-filter: var(--glass-blur); -webkit-backdrop-filter: var(--glass-blur); }
            #ls-fab-add:hover { transform: scale(1.1); }

            .ls-modal-overlay { position: absolute; top: 54px; left: 0; width: 100%; height: calc(100% - 54px); background-color: var(--bg-modal); z-index: 30; display: none; flex-direction: column; padding: 24px; gap: 16px; overflow-y: auto; }

            .ls-label { color: var(--text-muted); font-size: 12px; font-weight: 600; margin-bottom: 6px; display: block; text-transform: uppercase; letter-spacing: 0.5px; }
            
            .ls-input-wrapper { position: relative; width: 100%; display: flex; align-items: center; }
            .ls-input-text, .ls-select { background-color: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 10px; padding: 12px; color: var(--text-primary); outline: none; font-size: 14px; width: 100%; transition: all 0.2s; }
            .ls-input-text:focus, .ls-select:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15); }
            .ls-pass-toggle { position: absolute; right: 12px; background: none; border: none; cursor: pointer; color: var(--text-muted); display: flex; align-items: center; justify-content: center; padding: 4px; border-radius: 4px; }
            .ls-pass-toggle:hover { color: var(--text-primary); background: rgba(128,128,128,0.1); }
            
            .ls-input-color { width: 100%; height: 42px; border: none; border-radius: 10px; cursor: pointer; background: none; padding: 0; }
            .ls-input-color::-webkit-color-swatch-wrapper { padding: 0; }
            .ls-input-color::-webkit-color-swatch { border: 1px solid var(--border-color); border-radius: 10px; }
            
            .ls-checkbox-group { display: flex; align-items: flex-start; gap: 10px; color: var(--text-primary); font-size: 13.5px; margin-top: 5px; cursor: pointer; line-height: 1.5; }
            
            .ls-btn-primary { background: var(--btn-primary-bg); color: var(--btn-primary-color); border: none; border-radius: 10px; padding: 14px; font-weight: 600; cursor: pointer; margin-top: 10px; transition: all 0.2s; width: 100%; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            .ls-btn-primary:hover { transform: translateY(-1px); filter: brightness(1.1); }
            .ls-btn-secondary { background-color: var(--btn-secondary-bg); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 10px; padding: 14px; font-weight: 600; cursor: pointer; transition: 0.2s; width: 100%; font-size: 14px; }
            .ls-btn-secondary:hover { filter: brightness(1.2); }
            .ls-btn-danger { background-color: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 10px; padding: 14px; font-weight: 600; cursor: pointer; transition: 0.2s; width: 100%; font-size: 14px; }
            .ls-btn-danger:hover { background-color: #ef4444; color: white; }
            
            .ls-config-section { background: rgba(128,128,128,0.05); padding: 16px; border-radius: 12px; border: 1px solid var(--border-color); margin-bottom: 8px;}
            
            #ls-chat-area { flex: 1; display: none; flex-direction: column; overflow: hidden; position: relative; }
            #ls-messages { flex: 1; padding: 20px 16px; overflow-y: auto; background-color: transparent; display: flex; flex-direction: column; gap: 14px; }
            
            #ls-reply-bar { display: none; background: rgba(0,0,0,0.2); padding: 8px 12px; border-left: 3px solid #6366f1; margin: 0 16px 10px; border-radius: 4px; font-size: 12px; color: var(--text-muted); position: relative; }
            #ls-reply-bar-close { position: absolute; right: 8px; top: 8px; cursor: pointer; font-size: 14px; color: inherit; border: none; background: none; }
            
            .ls-message-container { display: flex; flex-direction: column; max-width: 85%; position: relative; }
            .ls-message-container.sent { align-self: flex-end; align-items: flex-end; }
            .ls-message-container.received { align-self: flex-start; align-items: flex-start; }
            
            .ls-sender-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; padding: 0 4px; }
            .ls-sender-name { font-size: 11px; color: var(--text-muted); font-weight: 600; letter-spacing: 0.3px; }
            .ls-msg-time { font-size: 9px; color: var(--text-muted); opacity: 0.7; font-weight: normal; margin-left: 4px; }
            
            .ls-msg-action { display: none; cursor: pointer; font-size: 13px; filter: grayscale(100%); transition: 0.2s; opacity: 0.6; margin: 0 2px; }
            .ls-msg-action:hover { filter: grayscale(0%); opacity: 1; transform: scale(1.1); }
            .ls-message-container:hover .ls-msg-action { display: inline-block; }
            
            .ls-message { padding: 10px 14px; font-size: 14px; line-height: 1.45; color: #ffffff; word-wrap: break-word; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
            .ls-message img { max-width: 100%; border-radius: 8px; display: block; margin-top: 4px; }
            
            .ls-message-container.system-msg-container { max-width: 95%; align-self: center; margin: 6px 0; }
            .ls-message.system-msg { background: rgba(128, 128, 128, 0.1) !important; color: var(--text-muted); text-align: center; font-weight: 500; border-radius: 12px !important; font-size: 12px; border: 1px solid rgba(128, 128, 128, 0.2); box-shadow: none; padding: 6px 12px; }
            .ls-message.deleted-msg { background-color: transparent !important; color: var(--text-muted); font-style: italic; border: 1px solid var(--border-color); border-radius: 12px !important; font-size: 13px; box-shadow: none; }
            
            .sent .ls-message:not(.deleted-msg) { border-radius: 14px 14px 4px 14px; }
            .received .ls-message:not(.deleted-msg) { border-radius: 14px 14px 14px 4px; background-color: var(--received-msg) !important; color: var(--text-primary); border: 1px solid var(--border-color); }
            
            #ls-input-area { display: flex; padding: 12px 16px; background-color: var(--bg-overlay); gap: 10px; align-items: center; position: relative; flex-wrap: nowrap; border-top: 1px solid var(--border-color); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
            .ls-icon-btn { flex-shrink: 0; background: none; border: none; color: var(--text-muted); font-size: 22px; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 4px; transition: color 0.2s, transform 0.2s; border-radius: 8px; }
            .ls-icon-btn:hover { color: var(--text-primary); background: rgba(128,128,128,0.1); transform: scale(1.05); }
            
            #ls-input { flex-grow: 1; min-width: 0; background-color: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 20px; padding: 10px 16px; color: var(--text-primary); outline: none; font-size: 14px; transition: 0.2s; }
            #ls-input:focus { border-color: #6366f1; }
            
            #ls-send-btn { flex-shrink: 0; background: var(--btn-primary-bg); color: var(--btn-primary-color); border: none; border-radius: 50%; width: 40px; height: 40px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); transition: transform 0.2s; }
            #ls-send-btn:hover { transform: scale(1.05); }
            
            .ls-popup-panel { position: absolute; bottom: 70px; background-color: var(--bg-surface); border-radius: 16px; padding: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); display: none; z-index: 20; border: 1px solid var(--border-color); }
            #ls-emoji-panel { left: 16px; width: 280px; display: flex; flex-wrap: wrap; gap: 6px; padding: 12px; }
            .ls-emoji-item { font-size: 20px; cursor: pointer; text-align: center; border-radius: 8px; transition: 0.1s; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; }
            .ls-emoji-item:hover { background-color: rgba(128,128,128,0.1); transform: scale(1.1); }
            
            #ls-plus-panel { left: 16px; width: 260px; flex-direction: column; gap: 4px; }
            .ls-action-item { color: var(--text-primary); padding: 12px; cursor: pointer; font-size: 14px; border-radius: 10px; display: flex; align-items: center; gap: 10px; font-weight: 500; transition: 0.2s; }
            .ls-action-item:hover { background-color: rgba(128,128,128,0.1); color: var(--text-primary); }

            #ls-countdown-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); z-index: 100; display: none; flex-direction: column; justify-content: center; align-items: center; }
            #ls-countdown-number { font-size: 110px; font-weight: 700; color: #a5b4fc; text-shadow: 0 0 40px rgba(99, 102, 241, 0.5); animation: pop 1s infinite; letter-spacing: -2px; }
            #ls-countdown-text { color: #cbd5e1; font-size: 16px; margin-top: 15px; font-weight: 500; letter-spacing: 0.5px;}
            @keyframes pop { 0% { transform: scale(0.8); opacity: 0.5; } 50% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); opacity: 0.8; } }
        `;

        const emojis = ['😀','😂','😍','🥰','😎','😭','😡','😱','🍿','🎬','🍕','🥂','👍','👎','❤️','🔥'];
        const svgEye = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
        const svgEyeOff = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

        const wrapper = document.createElement('div');
        wrapper.id = 'ls-wrapper';
        
        let storedTheme = localStorage.getItem('ls_theme');
        wrapper.className = storedTheme !== null ? storedTheme : 'theme-glass';
        
        wrapper.innerHTML = `
            <div id="ls-chat-window">
                <div id="ls-header">
                    <span id="ls-header-title" style="display:flex; align-items:center; gap:8px; user-select:none;">
                        <button class="ls-header-btn" id="ls-back-btn" style="display:none; margin-left:-8px; margin-right:4px;" title="Voltar ao Lobby">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                        </button>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path><polygon points="10.5,9 15.5,12 10.5,15" fill="currentColor" stroke="currentColor" stroke-width="1"></polygon></svg>
                        <span id="ls-header-text">LidySync</span>
                    </span>
                    <div class="ls-header-btns">
                        <button class="ls-header-btn" id="ls-lobby-settings-btn" title="Configurações do Perfil" style="display:none;">⚙️</button>
                        <div class="ls-dropdown-container" id="ls-chat-menu-container" style="display:none;">
                            <button class="ls-header-btn" id="ls-chat-menu-btn" title="Opções da Sala">⋮</button>
                            <div class="ls-dropdown-menu" id="ls-chat-dropdown">
                                <button class="ls-dropdown-item" id="ls-menu-members">👥 Ver Membros</button>
                                <button class="ls-dropdown-item" id="ls-menu-settings">🎨 Aparência da Sala</button>
                                <div style="height:1px; background:var(--border-color); margin:4px 0;"></div>
                                <button class="ls-dropdown-item danger" id="ls-menu-delete">🗑️ Encerrar Sala</button>
                            </div>
                        </div>
                        <button class="ls-header-btn" id="ls-close-btn" title="Ocultar Chat">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        </button>
                    </div>
                </div>
                
                <div id="ls-setup-area" class="ls-screen">
                    <div style="text-align: center; margin-bottom: 10px;">
                        <span style="font-size: 32px; font-weight: 800; background: linear-gradient(135deg, #6366f1, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; display: block; margin-bottom: 4px;">LidySync</span>
                        <span style="color: var(--text-primary); font-size: 16px; font-weight: 600;">Bem-vindo!</span>
                    </div>
                    <div><span class="ls-label">Nome de Usuário</span><input type="text" class="ls-input-text" id="ls-setup-name" placeholder="Ex: Amor" maxlength="100" /></div>
                    <div><span class="ls-label">Cor da sua Bolha</span><input type="color" class="ls-input-color" id="ls-setup-color" value="#6366f1" /></div>
                    <button class="ls-btn-primary" id="ls-setup-btn">Começar</button>
                </div>

                <div id="ls-lobby-area" class="ls-screen" style="padding: 16px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="color: var(--text-primary); font-size: 18px; font-weight: 700;">Meus Chats</span>
                    </div>
                    <div id="ls-room-list"></div>
                    <button id="ls-fab-add" title="Nova Sala">+</button>
                </div>

                <div id="ls-lobby-settings-overlay" class="ls-modal-overlay">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 5px;">
                        <span style="color: var(--text-primary); font-size: 20px; font-weight: 700;">Configurações do App</span>
                        <button id="ls-close-lobby-modal" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:16px;">✕</button>
                    </div>
                    <div class="ls-config-section">
                        <span class="ls-label">Perfil</span>
                        <div style="margin-bottom: 12px;"><input type="text" class="ls-input-text" id="ls-edit-name" placeholder="Apelido" maxlength="100" /></div>
                        <div><span class="ls-label">Cor da Bolha</span><input type="color" class="ls-input-color" id="ls-edit-color" /></div>
                    </div>
                    <div class="ls-config-section">
                        <span class="ls-label">Preferências Globais</span>
                        <select class="ls-select" id="ls-app-theme" style="margin-bottom: 12px;">
                            <option value="theme-glass">Tema Glassmorfismo (Padrão)</option>
                            <option value="">Tema Escuro</option>
                            <option value="theme-light">Tema Claro</option>
                            <option value="theme-hellokitty">Tema Hello Kitty</option>
                        </select>
                        <label class="ls-checkbox-group">
                            <input type="checkbox" id="ls-app-sound" checked>
                            <span><b>Sons de Notificação</b></span>
                        </label>
                    </div>
                    <div class="ls-config-section">
                        <span class="ls-label">Visibilidade do App</span>
                        <label class="ls-checkbox-group">
                            <input type="checkbox" id="ls-app-hide">
                            <span><b>Modo Silencioso (Ocultar)</b><br><small style="color: var(--text-muted);">Some ao fechar. Requer F5 para voltar.</small></span>
                        </label>
                        <label class="ls-checkbox-group">
                            <input type="checkbox" id="ls-app-revive" checked>
                            <span><b>Despertar com Notificação</b><br><small style="color: var(--text-muted);">Reaparece se chegar mensagem.</small></span>
                        </label>
                    </div>
                    <div class="ls-config-section" style="margin-top:auto;">
                        <button class="ls-btn-danger" id="ls-wipe-data-btn">Desconectar e Apagar Dados</button>
                    </div>
                    <button class="ls-btn-primary" id="ls-save-lobby-config-btn" style="margin-top: 10px;">Salvar Alterações</button>
                </div>

                <div id="ls-add-room-overlay" class="ls-modal-overlay">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px;">
                        <span style="color: var(--text-primary); font-size: 18px; font-weight: 700;">Nova Conexão</span>
                        <button id="ls-close-add-modal" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:16px;">✕</button>
                    </div>
                    <div><span class="ls-label">Nome da Sala</span><input type="text" class="ls-input-text" id="ls-lobby-room" placeholder="Max 80 caracteres" maxlength="80" /></div>
                    <div style="margin-top: 12px;">
                        <span class="ls-label">Senha de Acesso (4 a 16 carac.)</span>
                        <div class="ls-input-wrapper">
                            <input type="password" class="ls-input-text" id="ls-lobby-pass" placeholder="***" style="padding-right: 40px;" maxlength="16" />
                            <button class="ls-pass-toggle" id="ls-toggle-pass-1">${svgEyeOff}</button>
                        </div>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 20px;">
                        <button class="ls-btn-primary" id="ls-join-room-btn">Entrar na Sala</button>
                        <button class="ls-btn-secondary" id="ls-create-room-btn">Criar Nova Sala</button>
                    </div>
                </div>

                <div id="ls-settings-overlay" class="ls-modal-overlay">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 5px;">
                        <span style="color: var(--text-primary); font-size: 18px; font-weight: 700;">Aparência da Sala</span>
                        <button id="ls-close-settings-modal" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:16px;">✕</button>
                    </div>
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
                            <span><b>Sincronizar Fundo</b><br><small style="color: var(--text-muted);">Muda o visual para todos na sala.</small></span>
                        </label>
                    </div>
                    <div class="ls-config-section">
                        <span class="ls-label">Sistema</span>
                        <label class="ls-checkbox-group">
                            <input type="checkbox" id="ls-config-autoplay" checked>
                            <span>Tentar Play Automático pós-Countdown</span>
                        </label>
                    </div>
                    <button class="ls-btn-primary" id="ls-save-config-btn" style="margin-top: auto;">Salvar Alterações</button>
                </div>

                <div id="ls-members-overlay" class="ls-modal-overlay">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 5px;">
                        <span style="color: var(--text-primary); font-size: 18px; font-weight: 700;">Membros da Sala</span>
                        <button id="ls-close-members-modal" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:16px;">✕</button>
                    </div>
                    <div id="ls-members-list" style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px; overflow-y: auto;"></div>
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

                <div id="ls-chat-area">
                    <div id="ls-messages"></div>
                    <div id="ls-reply-bar">
                        <span id="ls-reply-bar-text"></span>
                        <button id="ls-reply-bar-close">✕</button>
                    </div>
                    <div id="ls-countdown-overlay">
                        <div id="ls-countdown-number">3</div>
                        <div id="ls-countdown-text">Preparando...</div>
                    </div>
                    <div id="ls-emoji-panel" class="ls-popup-panel">${emojis.map(e => `<span class="ls-emoji-item">${e}</span>`).join('')}</div>
                    <div id="ls-plus-panel" class="ls-popup-panel">
                        <div class="ls-action-item" id="btn-action-invite">🔗 Convidar para ver programação</div>
                        <div class="ls-action-item" id="btn-action-countdown">⏱️ Play Sincronizado</div>
                        <div class="ls-action-item" id="btn-action-pause">⏸️ Pausar Sincronizado</div>
                        <div class="ls-action-item" id="btn-action-gif">🎞️ Adicionar GIF</div>
                        <div class="ls-action-item" id="btn-action-camera">📷 Tirar Foto</div>
                    </div>
                    <div id="ls-input-area">
                        <button class="ls-icon-btn" id="ls-btn-plus">➕</button>
                        <button class="ls-icon-btn" id="ls-btn-emoji">😀</button>
                        <input type="text" id="ls-input" placeholder="Mensagem..." autocomplete="off" maxlength="350" />
                        <button id="ls-send-btn">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left:-2px;"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                        </button>
                    </div>
                </div>
            </div>
            <div id="ls-fab">
                <div id="ls-unread-badge">0</div>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                    <polygon points="10.5,9 15.5,12 10.5,15" fill="currentColor" stroke="currentColor" stroke-width="1"></polygon>
                </svg>
            </div>
        `;

        shadow.appendChild(style);
        shadow.appendChild(wrapper);
        target.appendChild(host);

        const fab = shadow.getElementById('ls-fab');
        const badge = shadow.getElementById('ls-unread-badge');
        const chatWindow = shadow.getElementById('ls-chat-window');
        const closeBtn = shadow.getElementById('ls-close-btn');
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
        const messagesContainer = shadow.getElementById('ls-messages');
        const input = shadow.getElementById('ls-input');

        let myDeviceId = localStorage.getItem('ls_device_id');
        if (!myDeviceId) {
            myDeviceId = crypto.randomUUID();
            localStorage.setItem('ls_device_id', myDeviceId);
        }

        let myName = localStorage.getItem('ls_username');
        let myColor = localStorage.getItem('ls_usercolor') || '#6366f1';
        let currentRoom = localStorage.getItem('ls_current_room'); 
        let currentRoomKey = localStorage.getItem('ls_room_key'); 
        
        let savedRooms = JSON.parse(localStorage.getItem('ls_saved_rooms') || '[]');
        let lastReadTimes = JSON.parse(localStorage.getItem('ls_last_read') || '{}');
        
        let myBgType = localStorage.getItem('ls_bg_type') || 'color';
        let myBgColor = localStorage.getItem('ls_bg_color') || '#0f172a';
        let myBgImage = localStorage.getItem('ls_bg_image') || '';
        let mySyncBg = localStorage.getItem('ls_sync_bg') === 'true'; 
        let myAutoPlay = localStorage.getItem('ls_autoplay') !== 'false'; 
        let myHideApp = localStorage.getItem('ls_hide_app') === 'true';
        let myHideRevive = localStorage.getItem('ls_hide_revive') !== 'false';
        
        let editingRoomAppearance = null;
        let unreadCount = 0;
        let replyTarget = null;

        let roomListener = null;
        let messagesListener = null;
        let settingsListener = null;
        let isFirstSnapshot = true;
        let localStream = null;
        let lobbyUnsubscribes = [];
        let currentRoomData = null;
        let userCache = {};

        // === DRAG & RESIZE LOGIC ===
        const header = shadow.getElementById('ls-header');
        let isDragging = false, startX, startY, currentLeft, currentTop;

        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.ls-header-btns') || e.target.closest('button')) return;
            isDragging = true;
            
            const rect = chatWindow.getBoundingClientRect();
            if (chatWindow.style.position !== 'fixed') {
                chatWindow.style.position = 'fixed';
                chatWindow.style.margin = '0';
                chatWindow.style.bottom = 'auto';
                chatWindow.style.right = 'auto';
            }
            currentLeft = rect.left;
            currentTop = rect.top;
            
            chatWindow.style.left = currentLeft + 'px';
            chatWindow.style.top = currentTop + 'px';
            
            startX = e.clientX; 
            startY = e.clientY;
            chatWindow.style.transition = 'none';
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            startX = e.clientX;
            startY = e.clientY;
            
            currentLeft += dx;
            currentTop += dy;
            
            chatWindow.style.left = currentLeft + 'px';
            chatWindow.style.top = currentTop + 'px';
        });

        window.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                chatWindow.style.transition = 'background-color 0.3s, backdrop-filter 0.3s';
            }
        });

        shadow.addEventListener('click', (e) => {
            if(!e.target.closest('.ls-dropdown-container')) {
                shadow.querySelectorAll('.ls-dropdown-menu').forEach(m => m.classList.remove('show'));
            }
        });

        shadow.getElementById('ls-toggle-pass-1').addEventListener('click', (e) => {
            const inputField = shadow.getElementById('ls-lobby-pass');
            if (inputField.type === 'password') {
                inputField.type = 'text';
                e.currentTarget.innerHTML = svgEye;
            } else {
                inputField.type = 'password';
                e.currentTarget.innerHTML = svgEyeOff;
            }
        });

        function formatTime(timestamp) {
            if (!timestamp) return "";
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        function updateLastRead(roomName) {
            lastReadTimes[roomName] = Date.now();
            localStorage.setItem('ls_last_read', JSON.stringify(lastReadTimes));
        }

        async function sendSystemAction(actionText) {
            if(!currentRoom || !currentRoomKey) return;
            try {
                await db.collection('rooms').doc(currentRoom).collection('messages').add({
                    type: 'countdown', 
                    text: actionText, 
                    sender: myName, 
                    color: myColor,
                    roomKey: currentRoomKey,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(), 
                    deleted: false
                });
            } catch(e){}
        }

        function checkScreenState() {
            settingsOverlay.style.display = 'none';
            addRoomOverlay.style.display = 'none';
            lobbySettingsOverlay.style.display = 'none';
            membersOverlay.style.display = 'none';
            editingRoomAppearance = null;
            
            if (myName) {
                db.collection('users').doc(myName).set({ color: myColor, deviceId: myDeviceId, lastSeen: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true }).catch(()=>{});
            }

            if (!myName) {
                setupArea.style.display = 'flex';
                lobbyArea.style.display = 'none';
                chatArea.style.display = 'none';
                chatMenuContainer.style.display = 'none';
                lobbySettingsBtn.style.display = 'none';
                backBtn.style.display = 'none';
                headerText.innerText = "LidySync";
                stopLobbyListeners();
            } else if (!currentRoom || !currentRoomKey) {
                setupArea.style.display = 'none';
                lobbyArea.style.display = 'flex';
                chatArea.style.display = 'none';
                chatMenuContainer.style.display = 'none';
                lobbySettingsBtn.style.display = 'flex';
                backBtn.style.display = 'none';
                headerText.innerText = `Lobby (${myName})`;
                renderSavedRooms();
                startLobbyListeners();
            } else {
                setupArea.style.display = 'none';
                lobbyArea.style.display = 'none';
                chatArea.style.display = 'flex';
                chatMenuContainer.style.display = 'block';
                lobbySettingsBtn.style.display = 'none';
                backBtn.style.display = 'flex';
                headerText.innerText = `${currentRoom}`;
                if (!mySyncBg) applyBackground(myBgType, myBgColor, myBgImage);
                stopLobbyListeners();
                startChatListeners();
            }
        }

        function renderSavedRooms() {
            const list = shadow.getElementById('ls-room-list');
            list.innerHTML = '';
            
            if(savedRooms.length === 0) {
                list.innerHTML = '<div style="text-align:center; color:var(--text-muted); margin-top:40px; font-size:14px; line-height:1.5;">Nenhum chat salvo.<br>Clique no <b>+</b> abaixo para começar.</div>';
                return;
            }
            
            savedRooms.forEach((room, index) => {
                const item = document.createElement('div');
                item.className = 'ls-room-item';
                const initial = room.name.charAt(0).toUpperCase();
                
                item.innerHTML = `
                    <div class="ls-room-avatar">${initial}</div>
                    <div class="ls-room-info">
                        <div class="ls-room-name">${room.name}</div>
                        <div class="ls-room-status" id="ls-status-${room.name}">Toque para entrar</div>
                    </div>
                    <div class="ls-room-unread" id="ls-unread-${room.name}"></div>
                    <div class="ls-dropdown-container">
                        <button class="ls-room-options" data-index="${index}">⋮</button>
                        <div class="ls-dropdown-menu" id="ls-drop-${index}">
                            <button class="ls-dropdown-item" data-action="share" data-name="${room.name}" data-pass="${room.hash}">🔗 Compartilhar</button>
                            <button class="ls-dropdown-item" data-action="appearance" data-name="${room.name}">🎨 Aparência do Chat</button>
                            <div style="height:1px; background:var(--border-color); margin:4px 0;"></div>
                            <button class="ls-dropdown-item" data-action="remove" data-index="${index}">Remover da Lista</button>
                        </div>
                    </div>
                `;
                
                item.querySelector('.ls-room-info').addEventListener('click', () => autoJoinRoom(room.name, room.hash));
                item.querySelector('.ls-room-avatar').addEventListener('click', () => autoJoinRoom(room.name, room.hash));
                
                const optBtn = item.querySelector('.ls-room-options');
                const dropMenu = item.querySelector(`#ls-drop-${index}`);
                
                optBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    shadow.querySelectorAll('.ls-dropdown-menu').forEach(m => { if(m !== dropMenu) m.classList.remove('show'); });
                    dropMenu.classList.toggle('show');
                });
                
                dropMenu.querySelectorAll('.ls-dropdown-item').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        dropMenu.classList.remove('show');
                        if (btn.dataset.action === 'share') {
                            const link = `Vem assistir comigo no LidySync!\n🍿 Sala: ${btn.dataset.name}\n(Insira a senha se houver)`;
                            navigator.clipboard.writeText(link);
                            alert("Convite copiado!");
                        } else if (btn.dataset.action === 'appearance') {
                            editingRoomAppearance = btn.dataset.name;
                            settingsOverlay.style.display = 'flex';
                            db.collection('rooms').doc(btn.dataset.name).collection('settings').doc('shared').get().then(doc => {
                                if(doc.exists) {
                                    try {
                                        const d = JSON.parse(doc.data().theme);
                                        shadow.getElementById('ls-config-bg-type').value = d.bgType || 'color';
                                        shadow.getElementById('ls-config-bg-type').dispatchEvent(new Event('change'));
                                        shadow.getElementById('ls-config-bg-color').value = d.bgColor || '#0f172a';
                                        shadow.getElementById('ls-config-bg-image').value = d.bgImage || '';
                                        shadow.getElementById('ls-config-sync').checked = true;
                                    } catch(e){}
                                }
                            });
                        } else if(btn.dataset.action === 'remove') {
                            savedRooms.splice(btn.dataset.index, 1);
                            localStorage.setItem('ls_saved_rooms', JSON.stringify(savedRooms));
                            renderSavedRooms();
                            startLobbyListeners();
                        }
                    });
                });
                list.appendChild(item);
            });
        }

        function startLobbyListeners() {
            stopLobbyListeners();
            savedRooms.forEach((room) => {
                const unsub = db.collection('rooms').doc(room.name).collection('messages')
                    .orderBy('timestamp', 'desc').limit(1)
                    .onSnapshot(snap => {
                        if (!snap.empty) {
                            const data = snap.docs[0].data();
                            const statusEl = shadow.getElementById(`ls-status-${room.name}`);
                            const unreadEl = shadow.getElementById(`ls-unread-${room.name}`);
                            if (statusEl && !data.deleted) {
                                let msgText = data.text;
                                if (data.type === 'image') msgText = '📷 Imagem';
                                else if (data.type === 'gif') msgText = '🎞️ GIF';
                                else if (data.type === 'invite') msgText = '🔗 Convite';
                                else if (data.type === 'countdown') msgText = 'Ação do Sistema';
                                
                                if (data.text.startsWith('SYSTEM_')) msgText = 'Ação do Sistema';

                                statusEl.innerText = `${data.sender}: ${msgText}`;
                            } else if (statusEl && data.deleted) {
                                statusEl.innerText = `${data.sender}: 🚫 Mensagem apagada`;
                            }

                            if (unreadEl) {
                                const lastRead = lastReadTimes[room.name] || 0;
                                const msgTime = data.timestamp ? data.timestamp.toMillis() : Date.now();
                                if (msgTime > lastRead && data.sender !== myName) {
                                    unreadEl.style.display = 'block';
                                    if (!chatWindow.classList.contains('open')) {
                                        badge.style.display = 'flex';
                                        badge.innerText = '!';
                                        if (myHideApp && myHideRevive) {
                                            fab.style.display = 'flex';
                                        }
                                    }
                                } else {
                                    unreadEl.style.display = 'none';
                                }
                            }
                        }
                    });
                lobbyUnsubscribes.push(unsub);
            });
        }

        function stopLobbyListeners() {
            lobbyUnsubscribes.forEach(u => u());
            lobbyUnsubscribes = [];
        }

        function saveRoomToLocalList(name, hash) {
            const exists = savedRooms.find(r => r.name === name);
            if(!exists) {
                savedRooms.push({name, hash});
                localStorage.setItem('ls_saved_rooms', JSON.stringify(savedRooms));
            }
        }

        async function autoJoinRoom(roomName, savedHash) {
            try {
                const doc = await db.collection('rooms').doc(roomName).get();
                if(!doc.exists) {
                    alert("Esta sala foi encerrada pelo dono.");
                    savedRooms = savedRooms.filter(r => r.name !== roomName);
                    localStorage.setItem('ls_saved_rooms', JSON.stringify(savedRooms));
                    renderSavedRooms();
                    startLobbyListeners();
                    return;
                }
                if(doc.data().password !== savedHash) {
                    alert("A senha desta sala foi alterada. Por favor, adicione-a novamente pelo botão +");
                    return;
                }
                currentRoom = roomName; currentRoomKey = roomName;
                localStorage.setItem('ls_current_room', currentRoom); localStorage.setItem('ls_room_key', currentRoomKey);
                
                db.collection('rooms').doc(currentRoom).set({ participants: firebase.firestore.FieldValue.arrayUnion(myName) }, { merge: true }).catch(()=>{});
                
                sendSystemAction('SYSTEM_JOIN');
                updateLastRead(currentRoom);
                checkScreenState();
            } catch(e) {}
        }

        shadow.getElementById('ls-setup-btn').addEventListener('click', async () => {
            const name = shadow.getElementById('ls-setup-name').value.trim();
            if (!name) return alert("Digite um apelido!");
            if (name.length > 100) return alert("O apelido deve ter no máximo 100 caracteres.");

            try {
                const userDoc = await db.collection('users').doc(name).get();
                if (userDoc.exists && userDoc.data().deviceId !== myDeviceId) {
                    return alert("Este apelido já está em uso por outra pessoa. Escolha outro.");
                }
            } catch (e) {}

            myName = name;
            myColor = shadow.getElementById('ls-setup-color').value;
            localStorage.setItem('ls_username', myName);
            localStorage.setItem('ls_usercolor', myColor);
            db.collection('users').doc(myName).set({ color: myColor, deviceId: myDeviceId, lastSeen: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true }).catch(()=>{});
            checkScreenState();
        });

        lobbySettingsBtn.addEventListener('click', () => {
            if (lobbySettingsOverlay.style.display === 'flex') {
                lobbySettingsOverlay.style.display = 'none';
            } else {
                lobbySettingsOverlay.style.display = 'flex';
                shadow.getElementById('ls-edit-name').value = myName || '';
                shadow.getElementById('ls-edit-color').value = myColor || '#6366f1';
                shadow.getElementById('ls-app-theme').value = localStorage.getItem('ls_theme') !== null ? localStorage.getItem('ls_theme') : 'theme-glass';
                shadow.getElementById('ls-app-sound').checked = localStorage.getItem('ls_sound') !== 'false';
                shadow.getElementById('ls-app-hide').checked = myHideApp;
                shadow.getElementById('ls-app-revive').checked = myHideRevive;
            }
        });

        shadow.getElementById('ls-close-lobby-modal').addEventListener('click', () => {
            lobbySettingsOverlay.style.display = 'none';
        });

        shadow.getElementById('ls-save-lobby-config-btn').addEventListener('click', async () => {
            const name = shadow.getElementById('ls-edit-name').value.trim();
            
            if (name && name !== myName) {
                if (name.length > 100) return alert("O apelido deve ter no máximo 100 caracteres.");
                try {
                    const userDoc = await db.collection('users').doc(name).get();
                    if (userDoc.exists && userDoc.data().deviceId !== myDeviceId) {
                        return alert("Este apelido já está em uso por outra pessoa. Escolha outro.");
                    }
                } catch(e) {}
                myName = name;
            } else if (name) {
                myName = name;
            }

            myColor = shadow.getElementById('ls-edit-color').value;
            
            const selectedTheme = shadow.getElementById('ls-app-theme').value;
            const soundEnabled = shadow.getElementById('ls-app-sound').checked;
            myHideApp = shadow.getElementById('ls-app-hide').checked;
            myHideRevive = shadow.getElementById('ls-app-revive').checked;

            localStorage.setItem('ls_username', myName);
            localStorage.setItem('ls_usercolor', myColor);
            localStorage.setItem('ls_theme', selectedTheme);
            localStorage.setItem('ls_sound', soundEnabled);
            localStorage.setItem('ls_hide_app', myHideApp);
            localStorage.setItem('ls_hide_revive', myHideRevive);
            
            wrapper.className = selectedTheme;
            db.collection('users').doc(myName).set({ color: myColor, deviceId: myDeviceId, lastSeen: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true }).catch(()=>{});

            lobbySettingsOverlay.style.display = 'none';
            checkScreenState();
        });

        shadow.getElementById('ls-wipe-data-btn').addEventListener('click', () => {
            if(!confirm("Deseja apagar todos os seus dados e salas salvas deste navegador?")) return;
            localStorage.clear(); 
            myName = null; currentRoom = null; currentRoomKey = null; savedRooms = [];
            myDeviceId = crypto.randomUUID();
            localStorage.setItem('ls_device_id', myDeviceId);
            wrapper.className = 'theme-glass';
            checkScreenState();
        });

        shadow.getElementById('ls-fab-add').addEventListener('click', () => { addRoomOverlay.style.display = 'flex'; });
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
                
                await docRef.set({ password: hashedPass, createdBy: myName, createdAt: firebase.firestore.FieldValue.serverTimestamp(), participants: [myName] });
                
                saveRoomToLocalList(roomName, hashedPass);
                currentRoom = roomName; currentRoomKey = roomName;
                localStorage.setItem('ls_current_room', currentRoom); localStorage.setItem('ls_room_key', currentRoomKey);
                
                sendSystemAction('SYSTEM_JOIN');
                updateLastRead(currentRoom);
                inputRoom.value = ''; inputPass.value = ''; checkScreenState();
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
                saveRoomToLocalList(roomName, hashedPass);
                currentRoom = roomName; currentRoomKey = roomName;
                localStorage.setItem('ls_current_room', currentRoom); localStorage.setItem('ls_room_key', currentRoomKey);
                
                db.collection('rooms').doc(currentRoom).set({ participants: firebase.firestore.FieldValue.arrayUnion(myName) }, { merge: true }).catch(()=>{});
                
                sendSystemAction('SYSTEM_JOIN');
                updateLastRead(currentRoom);
                inputRoom.value = ''; inputPass.value = ''; checkScreenState();
            } catch (e) {}
        });

        const chatMenuBtn = shadow.getElementById('ls-chat-menu-btn');
        const chatDropdown = shadow.getElementById('ls-chat-dropdown');

        chatMenuBtn.addEventListener('click', (e) => { e.stopPropagation(); chatDropdown.classList.toggle('show'); });

        shadow.getElementById('ls-menu-settings').addEventListener('click', () => {
            chatDropdown.classList.remove('show');
            if (settingsOverlay.style.display === 'flex') {
                settingsOverlay.style.display = 'none';
            } else {
                settingsOverlay.style.display = 'flex';
                shadow.getElementById('ls-config-bg-type').value = myBgType;
                shadow.getElementById('ls-config-bg-type').dispatchEvent(new Event('change')); 
                shadow.getElementById('ls-config-bg-color').value = myBgColor;
                shadow.getElementById('ls-config-bg-image').value = myBgImage;
                shadow.getElementById('ls-config-sync').checked = mySyncBg;
                shadow.getElementById('ls-config-autoplay').checked = myAutoPlay;
            }
        });

        shadow.getElementById('ls-close-settings-modal').addEventListener('click', () => { 
            settingsOverlay.style.display = 'none'; 
            editingRoomAppearance = null;
        });

        shadow.getElementById('ls-menu-members').addEventListener('click', () => {
            chatDropdown.classList.remove('show');
            membersOverlay.style.display = 'flex';
            
            const list = shadow.getElementById('ls-members-list');
            list.innerHTML = '<span style="color:var(--text-muted); font-size:13px;">Carregando...</span>';
            
            if (currentRoomData && currentRoomData.participants) {
                list.innerHTML = '';
                const now = Date.now();

                currentRoomData.participants.forEach(p => {
                    const item = document.createElement('div');
                    item.className = 'ls-room-item';
                    item.style.cursor = 'default';
                    
                    const isAdm = (currentRoomData.createdBy === p);
                    const isOnline = userCache[p] && userCache[p].lastSeen && (now - userCache[p].lastSeen.toMillis() < 300000); 

                    item.innerHTML = `
                        <div class="ls-room-avatar" style="width:36px; height:36px; font-size:14px; position:relative;">
                            ${p.charAt(0).toUpperCase()}
                            <div class="ls-online-dot" style="display: ${isOnline ? 'block' : 'none'};"></div>
                        </div>
                        <div class="ls-room-info" style="display:flex; align-items:center;">
                            <span class="ls-room-name">${p}</span>
                            <div class="ls-tags-container" id="ls-member-tags-${p.replace(/\s/g, '')}"></div>
                        </div>
                    `;
                    list.appendChild(item);
                    
                    const tContainer = item.querySelector(`#ls-member-tags-${p.replace(/\s/g, '')}`);
                    if (isAdm) tContainer.innerHTML += `<span class="ls-tag ls-tag-adm">ADM</span>`;
                    
                    if (userCache[p] && userCache[p].tags) {
                        userCache[p].tags.forEach(t => {
                            let c = 'ls-tag-generic';
                            if (t === 'DEV') c = 'ls-tag-dev';
                            if (t === 'OWNER') c = 'ls-tag-owner';
                            if (t === 'Do Biel') c = 'ls-tag-dobiel';
                            tContainer.innerHTML += `<span class="ls-tag ${c}">${t}</span>`;
                        });
                    }
                });
            } else {
                list.innerHTML = '<span style="color:var(--text-muted); font-size:13px;">Nenhum membro encontrado.</span>';
            }
        });

        shadow.getElementById('ls-close-members-modal').addEventListener('click', () => { 
            membersOverlay.style.display = 'none'; 
        });

        backBtn.addEventListener('click', () => {
            sendSystemAction('SYSTEM_LEAVE');
            stopChatListeners();
            currentRoom = null; currentRoomKey = null; currentRoomData = null;
            localStorage.removeItem('ls_current_room'); localStorage.removeItem('ls_room_key');
            checkScreenState();
        });

        shadow.getElementById('ls-menu-delete').addEventListener('click', async () => {
            chatDropdown.classList.remove('show');
            if(!confirm("Encerrar e deletar a sala para todos?")) return;
            try { await db.collection('rooms').doc(currentRoom).delete(); } catch(e){}
        });

        function startChatListeners() {
            if (!currentRoom) return;
            stopChatListeners(); 

            isFirstSnapshot = true;
            messagesContainer.innerHTML = '';
            userCache = {};
            
            const roomRef = db.collection('rooms').doc(currentRoom);
            const messagesRef = roomRef.collection('messages');
            const settingsRef = roomRef.collection('settings').doc('shared');

            roomListener = roomRef.onSnapshot(doc => {
                if (!doc.exists) {
                    alert("A sala foi encerrada pelo criador.");
                    stopChatListeners(); 
                    currentRoom = null; currentRoomKey = null; currentRoomData = null;
                    localStorage.removeItem('ls_current_room'); localStorage.removeItem('ls_room_key'); 
                    savedRooms = savedRooms.filter(r => r.name !== doc.id);
                    localStorage.setItem('ls_saved_rooms', JSON.stringify(savedRooms));
                    checkScreenState();
                } else {
                    currentRoomData = doc.data();
                    if (currentRoomData.participants) {
                        currentRoomData.participants.forEach(p => {
                            if (!userCache[p]) {
                                db.collection('users').doc(p).get().then(u => {
                                    if (u.exists) userCache[p] = u.data();
                                });
                            }
                        });
                    }
                }
            });

            settingsListener = settingsRef.onSnapshot(doc => {
                if (doc.exists && mySyncBg) {
                    try {
                        const data = JSON.parse(doc.data().theme);
                        applyBackground(data.bgType, data.bgColor, data.bgImage);
                    } catch(e){}
                }
            });

            messagesListener = messagesRef.orderBy('timestamp', 'asc').limitToLast(50).onSnapshot((snapshot) => {
                messagesContainer.innerHTML = '';
                
                let currentUnread = 0;
                const lastRead = lastReadTimes[currentRoom] || 0;

                snapshot.forEach((doc) => {
                    const data = doc.data();
                    const docId = doc.id; 
                    const isMe = data.sender === myName;
                    const isAdm = currentRoomData && currentRoomData.createdBy === data.sender;
                    
                    if (!isMe && !data.deleted) {
                        const msgTime = data.timestamp ? data.timestamp.toMillis() : Date.now();
                        if (msgTime > lastRead) currentUnread++;
                    }

                    const container = document.createElement('div');
                    
                    if (data.type === 'countdown') {
                        if (data.deleted) return; 
                        
                        container.className = 'ls-message-container system-msg-container';
                        
                        if (data.text === 'SYSTEM_JOIN') {
                            container.innerHTML = `<div class="ls-message system-msg" style="background:transparent!important; box-shadow:none; border:none; padding:4px;">👋 <b>${data.sender}</b> entrou na sala <span class="ls-msg-time">${formatTime(data.timestamp)}</span></div>`;
                        } else if (data.text === 'SYSTEM_LEAVE') {
                            container.innerHTML = `<div class="ls-message system-msg" style="background:transparent!important; box-shadow:none; border:none; padding:4px; opacity:0.6;">🚪 <b>${data.sender}</b> saiu <span class="ls-msg-time">${formatTime(data.timestamp)}</span></div>`;
                        } else if (data.text === 'SYSTEM_PAUSE') {
                            container.innerHTML = `<div class="ls-message system-msg">⏸️ <b>${data.sender}</b> pausou a sincronização! <span class="ls-msg-time" style="display:block; margin-top:2px;">${formatTime(data.timestamp)}</span></div>`;
                            if (myAutoPlay) { document.querySelectorAll('video').forEach(v => v.pause()); }
                        } else {
                            container.innerHTML = `<div class="ls-message system-msg">🎬 ${data.sender} ${data.text} <span class="ls-msg-time" style="display:block; margin-top:2px;">${formatTime(data.timestamp)}</span></div>`;
                        }

                    } else {
                        container.className = `ls-message-container ${isMe ? 'sent' : 'received'}`;
                        
                        const senderRow = document.createElement('div');
                        senderRow.className = 'ls-sender-row';
                        
                        const nameLabel = document.createElement('span');
                        nameLabel.className = 'ls-sender-name';
                        nameLabel.innerText = data.sender;
                        senderRow.appendChild(nameLabel);

                        const tagsContainer = document.createElement('span');
                        tagsContainer.className = 'ls-tags-container';
                        if (isAdm) tagsContainer.innerHTML += `<span class="ls-tag ls-tag-adm">ADM</span>`;
                        if (userCache[data.sender] && userCache[data.sender].tags) {
                            userCache[data.sender].tags.forEach(t => {
                                let c = 'ls-tag-generic';
                                if (t === 'DEV') c = 'ls-tag-dev';
                                if (t === 'OWNER') c = 'ls-tag-owner';
                                if (t === 'Do Biel') c = 'ls-tag-dobiel';
                                tagsContainer.innerHTML += `<span class="ls-tag ${c}">${t}</span>`;
                            });
                        }
                        senderRow.appendChild(tagsContainer);

                        const timeLabel = document.createElement('span');
                        timeLabel.className = 'ls-msg-time';
                        timeLabel.innerText = formatTime(data.timestamp);
                        senderRow.appendChild(timeLabel);
                        
                        if (!data.deleted) {
                            const actionBtn = document.createElement('span');
                            actionBtn.className = 'ls-msg-action';
                            actionBtn.innerText = '↩️';
                            actionBtn.title = "Responder";
                            actionBtn.onclick = () => {
                                replyTarget = { sender: data.sender, text: data.type === 'text' ? data.text : (data.type === 'image' ? 'Imagem' : 'GIF') };
                                shadow.getElementById('ls-reply-bar-text').innerHTML = `Respondendo <b>${data.sender}</b>: <span style="opacity:0.8;">${replyTarget.text.substring(0, 30)}...</span>`;
                                shadow.getElementById('ls-reply-bar').style.display = 'block';
                                input.focus();
                            };
                            senderRow.appendChild(actionBtn);
                        }

                        if (isMe && !data.deleted) {
                            const delBtn = document.createElement('span');
                            delBtn.className = 'ls-msg-action';
                            delBtn.innerText = '🗑️';
                            delBtn.title = "Apagar";
                            delBtn.onclick = async () => { try { await messagesRef.doc(docId).set({ deleted: true }, { merge: true }); } catch (e) {} };
                            senderRow.appendChild(delBtn);
                        }
                        
                        const msgBubble = document.createElement('div');
                        msgBubble.className = 'ls-message';

                        if (data.deleted) {
                            msgBubble.classList.add('deleted-msg');
                            msgBubble.innerText = "🚫 Mensagem apagada";
                        } else if (data.type === 'invite') {
                            msgBubble.style.padding = '0';
                            msgBubble.style.background = 'var(--btn-primary-bg)';
                            msgBubble.style.color = 'var(--btn-primary-color)';
                            msgBubble.style.border = 'none';
                            msgBubble.innerHTML = `<a href="${data.url}" target="_blank" style="color: inherit; text-decoration: none; display: block; padding: 10px 16px;">🍿 ${data.sender} convidou você para ver a programação atual!<br><small style="text-decoration:underline;">Clique para abrir</small></a>`;
                        } else if (data.type === 'image' || data.type === 'gif') {
                            msgBubble.style.padding = '4px';
                            if(isMe) msgBubble.style.background = data.color || '#6366f1';
                            
                            let replyHTML = '';
                            if (data.url && data.url.includes('|-REPLY-|')) {
                                const parts = data.url.split('|-REPLY-|');
                                const rSender = parts[0];
                                const rText = parts[1];
                                const actualUrl = parts[2];
                                replyHTML = `<div style="background: rgba(0,0,0,0.2); border-left: 3px solid currentColor; padding: 4px 8px; margin-bottom: 6px; border-radius: 4px; font-size: 11px; opacity: 0.8;"><b>${escapeHTML(rSender)}</b><br>${escapeHTML(rText)}</div>`;
                                msgBubble.innerHTML = `${replyHTML}<img src="${actualUrl}">`;
                            } else {
                                msgBubble.innerHTML = `<img src="${data.url}">`;
                            }
                        } else {
                            if(isMe) msgBubble.style.background = data.color || '#6366f1';
                            
                            let formattedText = linkify(data.text);
                            const replyMatch = formattedText.match(/^\[REPLY:(.*?)\|(.*?)\] /);
                            if (replyMatch) {
                                const rSender = replyMatch[1];
                                const rText = replyMatch[2];
                                const blockquote = `<div style="background: rgba(0,0,0,0.2); border-left: 3px solid currentColor; padding: 4px 8px; margin-bottom: 6px; border-radius: 4px; font-size: 11px; opacity: 0.8;"><b>${rSender}</b><br>${rText}</div>`;
                                formattedText = formattedText.replace(replyMatch[0], blockquote);
                            }
                            msgBubble.innerHTML = formattedText;
                        }

                        container.appendChild(senderRow);
                        container.appendChild(msgBubble);
                    }
                    messagesContainer.appendChild(container);
                });

                snapshot.docChanges().forEach((change) => {
                    const data = change.doc.data();
                    if (change.type === 'added' && data.type === 'countdown' && !isFirstSnapshot && !data.deleted) {
                        if (data.text === 'iniciou a sincronização!') runVisualCountdown(data.sender);
                    }
                    if (change.type === 'added' && !isFirstSnapshot && data.sender !== myName && !data.deleted) {
                        playNotificationSound();
                        
                        const msgTime = data.timestamp ? data.timestamp.toMillis() : Date.now();
                        const lastRead = lastReadTimes[currentRoom] || 0;
                        
                        if (msgTime > lastRead && !chatWindow.classList.contains('open')) {
                            unreadCount++;
                            badge.style.display = 'flex';
                            badge.innerText = unreadCount > 5 ? '5+' : unreadCount;
                            if (myHideApp && myHideRevive) {
                                fab.style.display = 'flex';
                            }
                        }
                    }
                });

                if (chatWindow.classList.contains('open')) {
                    updateLastRead(currentRoom);
                    unreadCount = 0;
                    badge.style.display = 'none';
                } else if (currentUnread > 0) {
                    badge.style.display = 'flex';
                    badge.innerText = currentUnread > 5 ? '5+' : currentUnread;
                    if (myHideApp && myHideRevive) {
                        fab.style.display = 'flex';
                    }
                }
                
                scrollToBottom();
                isFirstSnapshot = false;
            });
        }

        function stopChatListeners() {
            if (roomListener) roomListener(); if (messagesListener) messagesListener(); if (settingsListener) settingsListener();
            roomListener = null; messagesListener = null; settingsListener = null;
        }

        function applyBackground(type, color, imageUrl) {
            messagesContainer.parentElement.style.backgroundColor = '';
            if (type === 'image' && imageUrl) {
                messagesContainer.style.background = `linear-gradient(rgba(15, 23, 42, 0.7), rgba(15, 23, 42, 0.7)), url("${imageUrl}") center/cover`;
            } else if (type === 'color' && color && color !== '#0f172a') {
                messagesContainer.style.background = 'transparent'; 
                messagesContainer.parentElement.style.backgroundColor = color;
            } else {
                messagesContainer.style.background = 'transparent';
            }
        }

        const bgTypeSelect = shadow.getElementById('ls-config-bg-type');
        const bgColorWrapper = shadow.getElementById('ls-bg-color-wrapper');
        const bgImageWrapper = shadow.getElementById('ls-bg-image-wrapper');

        bgTypeSelect.addEventListener('change', (e) => {
            if (e.target.value === 'image') { bgColorWrapper.style.display = 'none'; bgImageWrapper.style.display = 'block'; } 
            else { bgColorWrapper.style.display = 'block'; bgImageWrapper.style.display = 'none'; }
        });

        shadow.getElementById('ls-save-config-btn').addEventListener('click', async () => {
            const bType = bgTypeSelect.value; 
            const bColor = shadow.getElementById('ls-config-bg-color').value;
            const bImage = shadow.getElementById('ls-config-bg-image').value; 
            const bSync = shadow.getElementById('ls-config-sync').checked;
            const aPlay = shadow.getElementById('ls-config-autoplay').checked;
            
            if (editingRoomAppearance) {
                try {
                    await db.collection('rooms').doc(editingRoomAppearance).collection('settings').doc('shared').set({
                        theme: JSON.stringify({ bgType: bType, bgColor: bColor, bgImage: bImage })
                    }, {merge: true});
                } catch(e){}
            } else {
                myBgType = bType; myBgColor = bColor; myBgImage = bImage; mySyncBg = bSync; myAutoPlay = aPlay;
                localStorage.setItem('ls_bg_type', myBgType); localStorage.setItem('ls_bg_color', myBgColor);
                localStorage.setItem('ls_bg_image', myBgImage); localStorage.setItem('ls_sync_bg', mySyncBg);
                localStorage.setItem('ls_autoplay', myAutoPlay);
                
                if (mySyncBg && currentRoom) {
                    try {
                        await db.collection('rooms').doc(currentRoom).collection('settings').doc('shared').set({
                            theme: JSON.stringify({ bgType: myBgType, bgColor: myBgColor, bgImage: myBgImage })
                        }, {merge: true});
                    } catch (e) {}
                } else { applyBackground(myBgType, myBgColor, myBgImage); }
            }
            
            settingsOverlay.style.display = 'none'; 
            editingRoomAppearance = null;
            scrollToBottom();
        });

        const scrollToBottom = () => { messagesContainer.scrollTop = messagesContainer.scrollHeight; };
        
        fab.addEventListener('click', () => { 
            chatWindow.classList.add('open'); 
            fab.style.display = 'none'; 
            unreadCount = 0;
            badge.style.display = 'none';
            if (currentRoom) updateLastRead(currentRoom);
            checkScreenState(); 
        });

        closeBtn.addEventListener('click', () => { 
            chatWindow.classList.remove('open'); 
            if (myHideApp) {
                fab.style.display = 'none';
            } else {
                fab.style.display = 'flex';
            }
            if (currentRoom) updateLastRead(currentRoom);
        });

        shadow.getElementById('ls-reply-bar-close').addEventListener('click', () => {
            replyTarget = null;
            shadow.getElementById('ls-reply-bar').style.display = 'none';
        });

        const btnPlus = shadow.getElementById('ls-btn-plus');
        const btnEmoji = shadow.getElementById('ls-btn-emoji');
        const emojiPanel = shadow.getElementById('ls-emoji-panel');
        const plusPanel = shadow.getElementById('ls-plus-panel');

        btnEmoji.addEventListener('click', () => { emojiPanel.style.display = emojiPanel.style.display === 'flex' ? 'none' : 'flex'; plusPanel.style.display = 'none'; });
        btnPlus.addEventListener('click', () => { plusPanel.style.display = plusPanel.style.display === 'flex' ? 'none' : 'flex'; emojiPanel.style.display = 'none'; });

        shadow.querySelectorAll('.ls-emoji-item').forEach(item => {
            item.addEventListener('click', (e) => { input.value += e.target.innerText; emojiPanel.style.display = 'none'; input.focus(); });
        });

        input.addEventListener('focus', () => { emojiPanel.style.display = 'none'; plusPanel.style.display = 'none'; });

        input.addEventListener('paste', (e) => {
            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            for (let index in items) {
                const item = items[index];
                if (item.kind === 'file' && item.type.indexOf('image/') === 0) {
                    const blob = item.getAsFile();
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                        compressImage(event.target.result, async (compressedUrl) => {
                           await sendImageMsg(compressedUrl);
                        });
                    };
                    reader.readAsDataURL(blob);
                }
            }
        });

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

        shadow.getElementById('btn-action-invite').addEventListener('click', async () => {
            plusPanel.style.display = 'none';
            if(!currentRoom || !currentRoomKey) return;
            try {
                await db.collection('rooms').doc(currentRoom).collection('messages').add({
                    type: 'invite', 
                    text: 'convidou você para ver a programação atual!', 
                    url: window.location.href,
                    sender: myName, 
                    color: myColor,
                    roomKey: currentRoomKey,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(), 
                    deleted: false
                });
                updateLastRead(currentRoom);
            } catch (e) {}
        });

        shadow.getElementById('btn-action-countdown').addEventListener('click', async () => {
            plusPanel.style.display = 'none';
            sendSystemAction('iniciou a sincronização!');
        });

        shadow.getElementById('btn-action-pause').addEventListener('click', async () => {
            plusPanel.style.display = 'none';
            sendSystemAction('SYSTEM_PAUSE');
        });

        shadow.getElementById('btn-action-gif').addEventListener('click', async () => {
            plusPanel.style.display = 'none';
            const gifUrl = prompt("Cole o link do GIF:");
            if(!gifUrl || !currentRoom) return;
            if(!currentRoomKey) return alert("Sessão inválida.");
            
            let finalUrl = gifUrl;
            if (replyTarget) {
                finalUrl = `${replyTarget.sender}|-REPLY-|${replyTarget.text}|-REPLY-|${gifUrl}`;
                replyTarget = null;
                shadow.getElementById('ls-reply-bar').style.display = 'none';
            }

            try {
                await db.collection('rooms').doc(currentRoom).collection('messages').add({
                    type: 'gif', 
                    url: finalUrl,
                    sender: myName, 
                    color: myColor,
                    roomKey: currentRoomKey,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(), 
                    deleted: false
                });
                updateLastRead(currentRoom);
            } catch (e) {}
        });

        shadow.getElementById('btn-action-camera').addEventListener('click', async () => {
            plusPanel.style.display = 'none';
            shadow.getElementById('ls-camera-overlay').style.display = 'flex';
            try {
                localStream = await navigator.mediaDevices.getUserMedia({ video: true });
                shadow.getElementById('ls-camera-video').srcObject = localStream;
            } catch(e) {
                alert("Erro ao acessar a câmera.");
                shadow.getElementById('ls-camera-overlay').style.display = 'none';
            }
        });

        shadow.getElementById('ls-close-camera').addEventListener('click', () => {
            if(localStream) localStream.getTracks().forEach(t => t.stop());
            shadow.getElementById('ls-camera-overlay').style.display = 'none';
        });

        shadow.getElementById('ls-capture-btn').addEventListener('click', async () => {
            const video = shadow.getElementById('ls-camera-video');
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            
            if(localStream) localStream.getTracks().forEach(t => t.stop());
            shadow.getElementById('ls-camera-overlay').style.display = 'none';
            await sendImageMsg(dataUrl);
        });

        async function sendImageMsg(dataUrl) {
            if (!myName || !currentRoom || !currentRoomKey) return;
            
            let finalUrl = dataUrl;
            if (replyTarget) {
                finalUrl = `${replyTarget.sender}|-REPLY-|${replyTarget.text}|-REPLY-|${dataUrl}`;
                replyTarget = null;
                shadow.getElementById('ls-reply-bar').style.display = 'none';
            }

            try {
                await db.collection('rooms').doc(currentRoom).collection('messages').add({
                    type: 'image', 
                    url: finalUrl, 
                    sender: myName, 
                    color: myColor, 
                    roomKey: currentRoomKey,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(), 
                    deleted: false
                });
                updateLastRead(currentRoom);
            } catch (e) {}
        }

        async function sendMessage() {
            const rawText = input.value.trim();
            if (!rawText || !myName || !currentRoom) return;
            if (rawText.length > 350) return alert("Mensagem muito longa (máximo 350 caracteres).");
            if (!currentRoomKey) return alert("Sessão inválida.");
            
            let finalText = rawText;
            if (replyTarget) {
                finalText = `[REPLY:${replyTarget.sender}|${replyTarget.text}] ${rawText}`;
                replyTarget = null;
                shadow.getElementById('ls-reply-bar').style.display = 'none';
            }

            input.value = '';
            try {
                await db.collection('rooms').doc(currentRoom).collection('messages').add({
                    type: 'text', 
                    text: finalText, 
                    sender: myName, 
                    color: myColor, 
                    roomKey: currentRoomKey,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(), 
                    deleted: false
                });
                updateLastRead(currentRoom);
            } catch (e) {}
        }

        shadow.getElementById('ls-send-btn').addEventListener('click', sendMessage);
        input.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
        
        if (myHideApp) fab.style.display = 'none';
        checkScreenState();
    }

    const interval = setInterval(() => { if (document.body) injectUI(); }, 1000);

})();