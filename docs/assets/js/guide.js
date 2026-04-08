async function fetchLatestVersion() {
    const versionDisplay = document.getElementById('ls-version-display');
    try {
        const response = await fetch('https://raw.githubusercontent.com/OFaceOff/LidySync/main/lidysync.user.js');
        if (!response.ok) throw new Error('Erro ao buscar o arquivo');
        const text = await response.text();
        const versionMatch = text.match(/\/\/\s*@version\s+([\d\.]+)/i);

        if (versionMatch && versionMatch[1]) {
            versionDisplay.textContent = `Versão Atual do LidySync: ${versionMatch[1]}`;
        } else {
            versionDisplay.textContent = `Versão Atual do LidySync: Desconhecida`;
        }
    } catch (error) {
        versionDisplay.textContent = `Versão Atual do LidySync: Offline`;
    }
}

async function fetchLoaderCode() {
    const codeElement = document.getElementById('loader-code');
    try {
        const response = await fetch('https://raw.githubusercontent.com/OFaceOff/LidySync/main/lidysync.loader.user.js');
        if (!response.ok) throw new Error('Erro ao buscar o arquivo loader');
        const text = await response.text();
        codeElement.textContent = text;
    } catch (error) {
        console.warn('Exibindo versão local do loader devido a falha na rede.');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    fetchLatestVersion();
    fetchLoaderCode();
});

const observerOptions = { root: null, threshold: 0.1, rootMargin: "0px 0px -50px 0px" };
const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('active');
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

document.querySelectorAll('.reveal').forEach(el => {
    observer.observe(el);
});

function copyCode() {
    const codeText = document.getElementById('loader-code').innerText;
    const btn = document.querySelector('.copy-btn');

    navigator.clipboard.writeText(codeText).then(() => {
        const originalText = btn.innerText;
        btn.innerText = "Copiado! ✔️";
        btn.style.background = "#10b981";
        btn.style.borderColor = "#10b981";
        btn.style.color = "#fff";

        setTimeout(() => {
            btn.innerText = originalText;
            btn.style.background = "";
            btn.style.borderColor = "";
            btn.style.color = "";
        }, 2500);
    }).catch(err => {
        alert('Erro ao copiar o código. Por favor, selecione e copie manualmente.');
    });
}