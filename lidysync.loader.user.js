// ==UserScript==
// @name         LidySync Loader
// @version      3.7
// @description  LidySync Loader
// @author       Face Off & FStudio
// @icon         https://raw.githubusercontent.com/OFaceOff/LidySync/refs/heads/main/docs/assets/img/favicon.ico

// @match *://*.ofaceoff.github.io/LidySync/*
// @match *://*.netflix.com/*
// @match *://*.primevideo.com/*
// @match *://*.disneyplus.com/*
// @match *://*.hbomax.com/*
// @match *://*.max.com/*
// @match *://*.hulu.com/*
// @match *://*.paramountplus.com/*
// @match *://*.tv.apple.com/*
// @match *://*.crunchyroll.com/*
// @match *://*.peacocktv.com/*
// @match *://*.starplus.com/*
// @match *://*.globoplay.globo.com/*
// @match *://*.discoveryplus.com/*
// @match *://*.pluto.tv/*
// @match *://*.tubitv.com/*
// @match *://*.plex.tv/*
// @match *://*.rakuten.tv/*
// @match *://*.mubi.com/*

// @updateURL    https://raw.githubusercontent.com/OFaceOff/LidySync/main/lidysync.loader.user.js
// @downloadURL  https://raw.githubusercontent.com/OFaceOff/LidySync/main/lidysync.loader.user.js

// @grant        none
// @run-at       document-start
// ==/UserScript==

(async function () {
    'use strict';

    const SCRIPT_URL = "https://raw.githubusercontent.com/OFaceOff/LidySync/main/lidysync.user.js";
    const LOADER_URL = "https://raw.githubusercontent.com/OFaceOff/LidySync/main/lidysync.loader.user.js";
    const CURRENT_VERSION = "3.7";

    function logError(contexto, erroTecnico) {
        const hora = new Date().toLocaleTimeString();
        console.log(`%c[LidySync ⚠️] ${hora} - ${contexto}`, "color: #ef4444; font-weight: bold; font-size: 13px;", erroTecnico || "");
    }

    function createNotification(html, isError = false, duration = 8000) {
        if (document.getElementById("ls-notification-container")) return;

        const container = document.createElement("div");
        container.id = "ls-notification-container";
        container.style.cssText = "margin:0 !important; padding:0 !important; position:fixed !important; z-index:2147483647 !important;";

        container.innerHTML = `
            <div style="
                position: fixed !important; 
                bottom: 20px !important; 
                right: 100px !important; 
                width: calc(100vw - 40px) !important; 
                max-width: 320px !important; 
                box-sizing: border-box !important; 
                background: rgba(${isError ? '45, 15, 15' : '2, 6, 23'}, 0.82) !important; 
                backdrop-filter: blur(24px) !important; 
                -webkit-backdrop-filter: blur(24px) !important; 
                color: #f9fafb !important; 
                padding: 16px !important; 
                border-radius: 12px !important; 
                font-size: 13px !important; 
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(${isError ? '239, 68, 68' : '255, 255, 255'}, 0.08) inset !important; 
                border: 1px solid rgba(${isError ? '239, 68, 68' : '255, 255, 255'}, 0.1) !important; 
                font-family: sans-serif !important; 
                display: block !important;
            ">
                <button id="ls-close" style="position:absolute !important; top:10px !important; right:12px !important; background:none !important; border:none !important; color:#94a3b8 !important; cursor:pointer !important; font-size:14px !important; padding:4px !important; line-height:1 !important; transition: color 0.2s !important;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#94a3b8'">✕</button>
                ${html}
            </div>
        `;

        document.documentElement.appendChild(container);
        const remove = () => container.remove();
        container.querySelector("#ls-close").onclick = remove;
        if (duration > 0) setTimeout(remove, duration);
    }

    function showSpecificError(titulo, desc) {
        createNotification(`
            <div style="display: flex !important; align-items: flex-start !important; gap: 12px !important; padding-right: 15px !important;">
                <div style="display: flex !important; align-items: center !important; justify-content: center !important; width: 34px !important; height: 34px !important; border-radius: 50% !important; background: rgba(239, 68, 68, 0.1) !important; border: 1px solid rgba(239, 68, 68, 0.2) !important; flex-shrink: 0 !important; margin-top: 2px !important;">
                    <svg style="width: 18px !important; height: 18px !important; color: #ef4444 !important;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <div style="line-height: 1.4 !important;">
                    <strong style="color: #f8fafc !important; font-size: 13.5px !important; font-weight: 600 !important;">${titulo}</strong><br>
                    <span style="color: #94a3b8 !important; font-size: 12px !important;">${desc}</span>
                    <div style="margin-top: 12px !important; font-size: 11px !important;">
                        <span style="color: #cbd5e1 !important; display: block !important; margin-bottom: 6px !important;">Canais de suporte Oficiais:</span>
                        <a href="https://discord.gg/4nSXkv4zwp" target="_blank" style="color: #fca5a5 !important; text-decoration: none !important; background: rgba(252, 165, 165, 0.1) !important; padding: 3px 6px !important; border-radius: 4px !important; border: 1px solid rgba(252, 165, 165, 0.2) !important; transition: all 0.2s;" onmouseover="this.style.background='rgba(252,165,165,0.2)'; this.style.borderColor='rgba(252,165,165,0.4)';" onmouseout="this.style.background='rgba(252,165,165,0.1)'; this.style.borderColor='rgba(252,165,165,0.2)';">Discord</a>
                        <span style="color: #475569 !important; margin: 0 4px !important;">|</span>
                        <a href="https://ofaceoff.github.io/LidySync/" target="_blank" style="color: #fca5a5 !important; text-decoration: none !important; background: rgba(252, 165, 165, 0.1) !important; padding: 3px 6px !important; border-radius: 4px !important; border: 1px solid rgba(252, 165, 165, 0.2) !important; transition: all 0.2s;" onmouseover="this.style.background='rgba(252,165,165,0.2)'; this.style.borderColor='rgba(252,165,165,0.4)';" onmouseout="this.style.background='rgba(252,165,165,0.1)'; this.style.borderColor='rgba(252,165,165,0.2)';">Site Oficial</a>
                    </div>
                </div>
            </div>
        `, true, 15000);
    }

    async function checkForLoaderUpdates() {
        try {
            const res = await fetch(LOADER_URL + "?t=" + Date.now(), { cache: "no-store" });
            const text = await res.text();
            const versionMatch = text.match(/@version\s+([\d\.]+)/);
            if (versionMatch) {
                const githubVersion = versionMatch[1];
                if (parseFloat(githubVersion) > parseFloat(CURRENT_VERSION)) {
                    createNotification(`
                        <div style="margin-bottom: 14px !important; padding-right: 20px !important; line-height: 1.4 !important;">
                            <strong style="color: #fff !important; font-size: 14px !important;">Atualização Disponível! 🚀</strong><br>
                            <span style="color:#94a3b8 !important; font-size: 12px !important;">LidySync Loader: ${CURRENT_VERSION} → ${githubVersion}</span><br>
                            
                            <div style="margin-top: 12px !important; font-size: 11.5px !important; color: #cbd5e1 !important; background: rgba(255, 255, 255, 0.05) !important; padding: 10px !important; border-radius: 8px !important; border: 1px solid rgba(255, 255, 255, 0.03) !important;">
                                <div style="display: flex !important; align-items: center !important; flex-wrap: wrap !important; gap: 5px !important; margin-bottom: 6px !important;">
                                    <span>Ao abrir a nova aba clique em</span>
                                    <strong style="color: #38bdf8 !important; background: rgba(56, 189, 248, 0.15) !important; padding: 2px 5px !important; border-radius: 4px !important; border: 1px solid rgba(56, 189, 248, 0.3) !important; white-space: nowrap !important;">ATUALIZAR</strong>
                                </div>
                                <span style="display: block !important; font-size: 11px !important; color: #94a3b8 !important;">Após atualizar, <strong style="color: #e2e8f0 !important;">recarregue esta página (F5)</strong>.</span>
                            </div>
                        </div>
                        <a href="${LOADER_URL}" target="_blank" style="display: block !important; text-align: center !important; background: #0284c7 !important; color: #fff !important; padding: 10px 0 !important; border-radius: 8px !important; text-decoration: none !important; font-weight: bold !important; font-size: 13px !important; transition: background 0.2s !important; box-shadow: 0 2px 4px rgba(0,0,0,0.2) !important;" onmouseover="this.style.background='#0369a1'" onmouseout="this.style.background='#0284c7'">Clique aqui para Atualizar</a>
                    `, false, 0);
                }
            }
        } catch (e) {
            logError("Checagem de atualização falhou", e);
        }
    }

    function checkSuccessUpdate() {
        const last = localStorage.getItem("lidysync_last_run_version");
        if (last && parseFloat(CURRENT_VERSION) > parseFloat(last)) {
            createNotification(`
                <div style="display: flex !important; align-items: center !important; gap: 12px !important; padding-right: 15px !important;">
                    <div style="display: flex !important; align-items: center !important; justify-content: center !important; width: 34px !important; height: 34px !important; border-radius: 50% !important; background: rgba(16, 185, 129, 0.1) !important; border: 1px solid rgba(16, 185, 129, 0.2) !important; flex-shrink: 0 !important;">
                        <svg style="width: 18px !important; height: 18px !important; color: #10b981 !important;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <div style="line-height: 1.4 !important;">
                        <strong style="color: #f8fafc !important; font-size: 13.5px !important; font-weight: 600 !important;">Atualizado com sucesso!</strong><br>
                        <span style="color: #94a3b8 !important; font-size: 12px !important;">LidySync → ${CURRENT_VERSION}</span>
                    </div>
                </div>
            `, false, 15000);
        }
        localStorage.setItem("lidysync_last_run_version", CURRENT_VERSION);
    }

    async function loadFirebase() {
        if (window.firebase) return;
        const libs = [
            "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js",
            "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js",
            "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"
        ];

        for (const lib of libs) {
            await new Promise((resolve, reject) => {
                const s = document.createElement("script");
                s.src = lib;
                s.onload = resolve;
                s.onerror = () => reject(new Error("FIREBASE_ERROR"));
                document.head.appendChild(s);
            });
        }
    }

    async function fetchWithRetry(url, attempts = 3) {
        for (let i = 1; i <= attempts; i++) {
            try {
                const res = await fetch(url + "?t=" + Date.now(), { cache: "no-store" });
                if (!res.ok) throw new Error("HTTP_" + res.status);
                const text = await res.text();
                if (!text || text.length < 50) throw new Error("EMPTY");
                return text;
            } catch (err) {
                if (i === attempts) throw new Error("GITHUB_ERROR");
                await new Promise(r => setTimeout(r, 1000 * i));
            }
        }
    }

    try {
        checkSuccessUpdate();
        checkForLoaderUpdates();
        await loadFirebase();
        const code = await fetchWithRetry(SCRIPT_URL);
        (new Function(code))();
    } catch (err) {
        logError("Falha Crítica", err);
        if (err.message === "FIREBASE_ERROR") {
            showSpecificError("Erro no Banco de Dados", "Não foi possível carregar o Firebase. Tente recarregar a página.");
        } else if (err.message === "GITHUB_ERROR") {
            showSpecificError("Falha de Conexão", "O servidor do LidySync falhou. Verifique sua internet ou tente mais tarde.");
        } else {
            showSpecificError("Erro Fatal no LidySync", "Algo deu errado ao iniciar o script principal.");
        }
    }
})();