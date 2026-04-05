# 🎬 LidySync

![LydySync Logo](docs/assets/img/logo.png)

LidySync é um userscript para Tampermonkey que transforma qualquer site com vídeo em uma experiência de *watch party*, permitindo assistir conteúdos sincronizados com outras pessoas enquanto utiliza um chat em tempo real integrado diretamente na página.

---

## 📑 Sumário
- [✨ Visão Geral](#-visão-geral)
- [🚀 Funcionalidades](#-funcionalidades)
- [🛠️ Tecnologias](#-tecnologias)
- [📦 Instalação](#-instalação)
- [📖 Como Usar](#-como-usar)
- [🏗️ Estrutura do Projeto](#-estrutura-do-projeto)
- [🔒 Segurança](#-segurança)
- [🤝 Contribuição](#-contribuição)
- [📄 Licença](#-licença)

---

## ✨ Visão Geral

O LidySync permite criar salas privadas onde usuários assistem vídeos sincronizados enquanto interagem via chat em tempo real.

Ele funciona diretamente em sites como:
- Netflix
- YouTube
- Prime Video
- Disney+
- E qualquer site com `<video>` HTML5

Tudo isso sem necessidade de backend próprio, utilizando Firebase para sincronização em tempo real.

---

## 🚀 Funcionalidades

- 🎥 Sincronização de vídeo em tempo real
- 💬 Chat integrado com:
  - Emojis, GIFs e imagens
  - Menções (@usuário)
  - Respostas (reply)
  - Indicador de digitação
- 🏠 Sistema de salas com senha
- 👑 Controle de host (play sincronizado)
- 🎭 Modo Teatro (chat integrado ao layout)
- ⏱️ Timecodes clicáveis
- 🎨 Temas personalizados
- 🛡️ Sistema anti-flood e moderação
- 🔐 Criptografia de senhas (SHA-256)

---

## 🛠️ Tecnologias

- JavaScript (ES6+)
- Firebase (Firestore + Auth)
- Shadow DOM
- Tampermonkey API
- Canvas API

---

## 📦 Instalação

### 1. Instale o Tampermonkey

Baixe a extensão oficial:

👉 https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo

--

👉 https://www.tampermonkey.net/

---

### 2. Instale o Loader do LidySync

1. Abra o Tampermonkey
2. Clique em **"Create a new script"**
3. Apague tudo e cole o código do `lidysync.loader.js`
4. Salve

---

### 3. Pronto!

Agora basta acessar qualquer site compatível (ex: YouTube, Netflix, etc.) e o LidySync será carregado automaticamente.

✔️ O script se atualiza sozinho  
✔️ Não é necessário reinstalar

---

## 📖 Como Usar

1. Abra um site com vídeo
2. Aguarde o carregamento do LidySync
3. Crie ou entre em uma sala
4. Compartilhe o nome da sala com amigos
5. Use o chat e sincronize o vídeo

---

## 🏗️ Estrutura do Projeto

```
docs/
 ├── assets/
 │   ├── css/
 │   ├── img/
 │   └── js/
 ├── index.html
 ├── guide.html
 └── 404.html

lidysync.loader.js
lidysync.user.js
README.md
```

---

## 🔒 Segurança

- Senhas criptografadas com SHA-256
- Dados sensíveis não são expostos
- Sistema anti-flood integrado
- Controle de permissões por usuário

---

## 🤝 Contribuição

Contribuições são bem-vindas!

1. Fork o projeto
2. Crie uma branch
3. Faça suas alterações
4. Abra um Pull Request

---

## 📄 Licença

Veja os termos de uso na [Licença](./LICENSE).

---

## ⚠️ Aviso

LidySync não hospeda, distribui ou altera conteúdo de vídeo. Ele apenas sincroniza reprodução entre usuários e faz a interação entre eles.
