// ==UserScript==
// @name         LidySync Loader
// @version      3.2
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
// @match *://*.youtube.com/*
// @match *://*.youtube-nocookie.com/*
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

    // Link do código principal (não muda)
    const SCRIPT_URL = "https://raw.githubusercontent.com/OFaceOff/LidySync/main/lidysync.user.js";
    // Link do loader atualizado com o ".user.js" no final
    const LOADER_URL = "https://raw.githubusercontent.com/OFaceOff/LidySync/main/lidysync.loader.user.js";
    const CURRENT_VERSION = "3.2";

    function createNotification(html, isError = false, autoClose = true) {
        const disable = localStorage.getItem("lidysync_disable_notifications") === "true";

        if (!isError && disable) return;

        const div = document.createElement("div");
        div.innerHTML = `
            <div style="
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: rgba(2,6,23,0.85);
                backdrop-filter: blur(16px);
                color: #f9fafb;
                padding: 14px;
                border-radius: 10px;
                font-size: 13px;
                z-index: 999999;
                box-shadow: 0 8px 25px rgba(91,92,246,0.4);
                border: 1px solid rgba(255,255,255,0.1);
                max-width: 280px;
                font-family: sans-serif;
                position: relative;
            ">
                <button id="ls-close" style="
                    position:absolute;
                    top:8px;
                    right:10px;
                    background:none;
                    border:none;
                    color:#94a3b8;
                    cursor:pointer;
                    font-size:14px;
                ">✕</button>

                ${html}

                ${!isError ? `
                <div style="margin-top:10px; text-align: center;">
                    <button id="ls-disable" style="
                        background:none;
                        border:none;
                        color:#64748b;
                        cursor:pointer;
                        font-size:11px;
                        text-decoration: underline;
                    ">
                        Não mostrar novamente
                    </button>
                </div>
                ` : ""}
            </div>
        `;

        document.documentElement.appendChild(div);

        const remove = () => div.remove();

        div.querySelector("#ls-close").onclick = remove;

        if (!isError) {
            div.querySelector("#ls-disable").onclick = () => {
                localStorage.setItem("lidysync_disable_notifications", "true");
                remove();
            };
        }

        if (autoClose) {
            setTimeout(remove, isError ? 12000 : 8000);
        }
    }

    async function checkForLoaderUpdates() {
        try {
            // Usa cache buster (?t=Data) pra garantir que pega a versão real de agora do GitHub
            const res = await fetch(LOADER_URL + "?t=" + Date.now(), { cache: "no-store" });
            const text = await res.text();
            
            const versionMatch = text.match(/@version\s+([\d\.]+)/);
            
            if (versionMatch) {
                const githubVersion = versionMatch[1];
                
                if (parseFloat(githubVersion) > parseFloat(CURRENT_VERSION)) {
                    createNotification(`
                        <div style="margin-bottom: 12px; padding-right: 15px;">
                            <strong style="color: #fff; font-size: 14px;">Atualização Disponível! 🚀</strong><br>
                            <span style="color:#94a3b8; font-size: 12px;">LidySync Loader: ${CURRENT_VERSION} → ${githubVersion}</span>
                        </div>
                        <a href="${LOADER_URL}" style="
                            display: block;
                            text-align: center;
                            background: #06b6d4;
                            color: #ffffff;
                            padding: 8px 0;
                            border-radius: 6px;
                            text-decoration: none;
                            font-weight: bold;
                            font-size: 13px;
                            transition: background 0.2s;
                        " onmouseover="this.style.background='#0891b2'" onmouseout="this.style.background='#06b6d4'">
                            Clique aqui para Atualizar
                        </a>
                    `, false, false); // false = notificação não fecha sozinha
                }
            }
        } catch (e) {
            console.log("[LidySync] Erro ao checar atualização do Loader:", e);
        }
    }

    function showErrorNotification() {
        createNotification(`
            <div style="color:#f87171;">
                Erro ao carregar o LidySync ⚠️<br>
                <span style="color:#94a3b8; font-size: 12px;">
                    Contate o <a href="https://discord.gg/4nSXkv4zwp" target="_blank" style="color:#06b6d4;">suporte</a>,
                    ou verifique o <a href="https://ofaceoff.github.io/LidySync/" target="_blank" style="color:#06b6d4;">site oficial</a>.
                </span>
            </div>
        `, true);
    }

    async function loadScript(url) {
        return new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = url;
            s.onload = () => resolve();
            s.onerror = () => reject();
            document.head.appendChild(s);
        });
    }

    async function loadFirebase() {
        if (window.firebase) return;
        const libs = [
            "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js",
            "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js",
            "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"
        ];
        for (const lib of libs) {
            await loadScript(lib);
        }
    }

    async function fetchWithRetry(url, attempts = 3) {
        for (let i = 1; i <= attempts; i++) {
            try {
                const res = await fetch(url + "?t=" + Date.now(), { cache: "no-store" });
                if (!res.ok) throw new Error();
                const text = await res.text();
                if (!text || text.length < 50) throw new Error();
                return text;
            } catch {
                if (i === attempts) throw new Error("Falha ao baixar script");
                await new Promise(r => setTimeout(r, 1000 * i));
            }
        }
    }

    try {
        // 1. Checa se há atualização do Loader e mostra botão (se houver)
        checkForLoaderUpdates();

        // 2. Carrega as dependências
        await loadFirebase();

        // 3. Puxa e executa o código principal sempre atualizado
        const code = await fetchWithRetry(SCRIPT_URL);
        (new Function(code))();

    } catch (err) {
        console.error("[LidySync] Erro no loader:", err);
        showErrorNotification();
    }

})();