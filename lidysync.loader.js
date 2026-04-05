// ==UserScript==
// @name         LidySync Loader
// @version      1.1
// @description  LidySync Loader
// @author       Face Off & FStudio
// @icon         https://raw.githubusercontent.com/OFaceOff/LidySync/refs/heads/main/docs/assets/img/favicon.ico

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

// @grant        none
// @run-at       document-start
// ==/UserScript==

(async function () {
    'use strict';

    const SCRIPT_URL = "https://raw.githubusercontent.com/OFaceOff/LidySync/main/lidysync.user.js";

    async function loadScript(url) {
        return new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = url;
            s.onload = () => resolve();
            s.onerror = () => reject(new Error("Erro ao carregar: " + url));
            document.head.appendChild(s);
        });
    }

    async function loadFirebase() {
        if (window.firebase) {
            console.log("[LidySync] Firebase já carregado");
            return;
        }

        console.log("[LidySync] Carregando Firebase...");

        const libs = [
            "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js",
            "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js",
            "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"
        ];

        for (const lib of libs) {
            await loadScript(lib);
        }

        console.log("[LidySync] Firebase carregado com sucesso");
    }

    async function fetchWithRetry(url, attempts = 3) {
        for (let i = 1; i <= attempts; i++) {
            try {
                const res = await fetch(url + "?t=" + Date.now(), {
                    cache: "no-store"
                });

                if (!res.ok) throw new Error("Status: " + res.status);

                const text = await res.text();

                if (!text || text.length < 50) {
                    throw new Error("Script vazio");
                }

                return text;

            } catch (err) {
                console.warn(`[LidySync] Tentativa ${i} falhou`, err);

                if (i === attempts) throw err;

                await new Promise(r => setTimeout(r, 1000 * i));
            }
        }
    }

    try {
        console.log("[LidySync] Iniciando loader...");

        await loadFirebase();

        const code = await fetchWithRetry(SCRIPT_URL);

        (new Function(code))();

        console.log("[LidySync] Script carregado com sucesso 🚀");

    } catch (err) {
        console.error("[LidySync] Erro no loader:", err);
    }

})();