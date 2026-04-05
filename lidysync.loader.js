// ==UserScript==
// @name         LidySync Loader
// @version      2.0
// @description  LidySync Loader
// @author       Face Off & FStudio
// @icon         https://raw.githubusercontent.com/OFaceOff/LidySync/refs/heads/main/docs/assets/img/favicon.ico

// @updateURL   https://raw.githubusercontent.com/OFaceOff/LidySync/main/lidysync.loader.js
// @downloadURL https://raw.githubusercontent.com/OFaceOff/LidySync/main/lidysync.loader.js

// @match  *://*.ofaceoff.github.io/LidySync/*
// @match  *://*.netflix.com/*
// @match  *://*.primevideo.com/*
// @match  *://*.disneyplus.com/*
// @match  *://*.hbomax.com/*
// @match  *://*.max.com/*
// @match  *://*.hulu.com/*
// @match  *://*.paramountplus.com/*
// @match  *://*.tv.apple.com/*
// @match  *://*.crunchyroll.com/*
// @match  *://*.peacocktv.com/*
// @match  *://*.youtube.com/*
// @match  *://*.youtube-nocookie.com/*
// @match  *://*.starplus.com/*
// @match  *://*.globoplay.globo.com/*
// @match  *://*.discoveryplus.com/*
// @match  *://*.pluto.tv/*
// @match  *://*.tubitv.com/*
// @match  *://*.plex.tv/*
// @match  *://*.rakuten.tv/*
// @match  *://*.mubi.com/*

// @grant        none
// @run-at       document-start
// ==/UserScript==

(async function () {
    'use strict';

    const SCRIPT_URL = "https://raw.githubusercontent.com/OFaceOff/LidySync/main/lidysync.user.js";
    const LOADER_URL = "https://raw.githubusercontent.com/OFaceOff/LidySync/main/lidysync.loader.js";
    const CURRENT_VERSION = "2.0";

    function showNotification(message) {
        if (localStorage.getItem("lidysync_disable_notifications") === "true") return;

        const box = document.createElement("div");
        box.innerHTML = `
            <div style="
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: #0f172a;
                color: #f9fafb;
                border: 1px solid rgba(255,255,255,0.06);
                padding: 12px 14px;
                border-radius: 10px;
                font-size: 13px;
                z-index: 999999;
                backdrop-filter: blur(10px);
                box-shadow: 0 8px 25px rgba(0,0,0,0.4);
                max-width: 260px;
                font-family: sans-serif;
            ">
                <div style="margin-bottom:6px;">${message}</div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <button id="ls-hide" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:11px;">
                        Não mostrar mais
                    </button>
                    <button id="ls-close" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:14px;">
                        ✕
                    </button>
                </div>
            </div>
        `;

        document.documentElement.appendChild(box);

        box.querySelector("#ls-close").onclick = () => box.remove();

        box.querySelector("#ls-hide").onclick = () => {
            localStorage.setItem("lidysync_disable_notifications", "true");
            box.remove();
        };

        setTimeout(() => box.remove(), 10000);
    }

    async function checkLoaderUpdate() {
        try {
            const res = await fetch(LOADER_URL + "?t=" + Date.now());
            const text = await res.text();
            const match = text.match(/@version\s+([0-9.]+)/);

            if (match && match[1] !== CURRENT_VERSION) {
                showNotification("Nova versão do LidySync disponível 🚀 Atualize o script!");
            }
        } catch { }
    }

    async function loadScript(url) {
        return new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = url;
            s.onload = resolve;
            s.onerror = () => reject(new Error("Erro ao carregar: " + url));
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
                const res = await fetch(url + "?t=" + Date.now());

                if (!res.ok) throw new Error(res.status);

                const text = await res.text();

                if (!text || text.length < 50) throw new Error("Script inválido");

                return text;

            } catch (err) {
                if (i === attempts) throw err;
                await new Promise(r => setTimeout(r, 1000 * i));
            }
        }
    }

    try {
        checkLoaderUpdate();
        await loadFirebase();
        const code = await fetchWithRetry(SCRIPT_URL);
        (new Function(code))();
    } catch (err) {
        console.error("[LidySync] Erro:", err);
        showNotification("Erro ao carregar LidySync ⚠️");
    }

})();