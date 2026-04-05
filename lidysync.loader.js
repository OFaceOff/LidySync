// ==UserScript==
// @name         LidySync Loader
// @version      3.1
// @description  LidySync Loader
// @author       Face Off & FStudio
// @icon         https://raw.githubusercontent.com/OFaceOff/LidySync/refs/heads/main/docs/assets/img/favicon.ico

// @match  *://*.ofaceoff.github.io/LidySync/*
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

// @updateURL    https://raw.githubusercontent.com/OFaceOff/LidySync/main/lidysync.loader.js
// @downloadURL  https://raw.githubusercontent.com/OFaceOff/LidySync/main/lidysync.loader.js

// @grant        none
// @run-at       document-start
// ==/UserScript==

(async function () {
    'use strict';

    const SCRIPT_URL = "https://raw.githubusercontent.com/OFaceOff/LidySync/main/lidysync.user.js";
    const CURRENT_VERSION = "3.1";

    function createNotification(html) {
        if (localStorage.getItem("lidysync_disable_notifications") === "true") return;

        const div = document.createElement("div");
        div.innerHTML = `
            <div style="
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: rgba(2,6,23,0.85);
                backdrop-filter: blur(16px);
                color: #f9fafb;
                padding: 12px 14px;
                border-radius: 10px;
                font-size: 12px;
                z-index: 999999;
                box-shadow: 0 8px 25px rgba(91,92,246,0.4);
                border: 1px solid rgba(255,255,255,0.06);
                max-width: 260px;
                font-family: sans-serif;
            ">
                ${html}
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px;">
                    <button id="ls-close" style="background:none;border:none;color:#94a3b8;cursor:pointer;">✕</button>
                    <button id="ls-disable" style="background:none;border:none;color:#06b6d4;cursor:pointer;font-size:11px;">
                        Não mostrar novamente
                    </button>
                </div>
            </div>
        `;

        document.documentElement.appendChild(div);

        const remove = () => div.remove();

        div.querySelector("#ls-close").onclick = remove;

        div.querySelector("#ls-disable").onclick = () => {
            localStorage.setItem("lidysync_disable_notifications", "true");
            remove();
        };

        setTimeout(remove, 8000);
    }

    function showUpdateNotification(oldV, newV) {
        createNotification(`
            <div>
                LidySync atualizado 🚀<br>
                <span style="color:#94a3b8">${oldV} → ${newV}</span>
            </div>
        `);
    }

    function showErrorNotification() {
        createNotification(`
            <div style="color:#f87171;">
                Erro ao instalar nova versão do LidySync Loader ⚠️<br>
                <span style="color:#94a3b8">
                    Contate o suporte para ajuda
                </span>
            </div>
        `);
    }

    function checkVersion() {
        const last = localStorage.getItem("lidysync_loader_version");

        if (last && last !== CURRENT_VERSION) {
            showUpdateNotification(last, CURRENT_VERSION);
        }

        localStorage.setItem("lidysync_loader_version", CURRENT_VERSION);
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
        checkVersion();

        await loadFirebase();

        const code = await fetchWithRetry(SCRIPT_URL);

        (new Function(code))();

    } catch (err) {
        console.error("[LidySync] Erro no loader:", err);
        showErrorNotification();
    }

})();