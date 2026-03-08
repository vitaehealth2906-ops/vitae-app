/*
    VITAE — Servidor para conectar wearables (GRÁTIS)

    Conecta direto nas APIs oficiais de cada wearable.
    Sem intermediário, sem custo.

    COMO USAR:
    1. Crie um app em developer.whoop.com (grátis)
       → Redirect URI: http://localhost:3001/callback/whoop
    2. Cole o Client ID e Client Secret abaixo
    3. Rode: npm start
    4. Clique em "WHOOP" no protótipo
*/

const express = require('express');
const cors = require('cors');
const app = express();

const PORT = 3001;

// ============================================
//  COLE SUAS CREDENCIAIS AQUI:
// ============================================

// WHOOP — pega em developer.whoop.com
const WHOOP_CLIENT_ID     = 'COLE_SEU_CLIENT_ID_AQUI';
const WHOOP_CLIENT_SECRET = 'COLE_SEU_CLIENT_SECRET_AQUI';

// OURA — pega em cloud.ouraring.com/personal-access-tokens
const OURA_ACCESS_TOKEN   = 'COLE_SEU_TOKEN_AQUI';

// ============================================

app.use(cors());
app.use(express.json());

// Guarda tokens dos wearables conectados
let tokens = {};

// ==========================================
//  WHOOP — OAuth2 (grátis)
// ==========================================

// Passo 1: Redireciona pro login do Whoop
app.get('/connect', (req, res) => {
    const provider = req.query.provider;

    if (provider === 'whoop') {
        if (WHOOP_CLIENT_ID === 'COLE_SEU_CLIENT_ID_AQUI') {
            return res.status(500).json({ error: 'Configure o WHOOP_CLIENT_ID no server.js!' });
        }

        const authUrl = 'https://api.prod.whoop.com/oauth/oauth2/auth'
            + '?client_id=' + encodeURIComponent(WHOOP_CLIENT_ID)
            + '&response_type=code'
            + '&redirect_uri=' + encodeURIComponent(`http://localhost:${PORT}/callback/whoop`)
            + '&scope=' + encodeURIComponent('read:recovery read:sleep read:workout read:profile read:body_measurement read:cycles')
            + '&state=vitae';

        return res.json({ url: authUrl });
    }

    if (provider === 'oura') {
        if (OURA_ACCESS_TOKEN === 'COLE_SEU_TOKEN_AQUI') {
            return res.status(500).json({ error: 'Configure o OURA_ACCESS_TOKEN no server.js!' });
        }
        // Oura com Personal Access Token não precisa de OAuth
        // Já tá conectado, só confirma
        tokens.oura = OURA_ACCESS_TOKEN;
        return res.json({ direct: true });
    }

    if (provider === 'garmin') {
        return res.status(501).json({ error: 'Garmin requer aprovação manual no programa de desenvolvedor. Em breve!' });
    }

    if (provider === 'apple') {
        return res.status(501).json({ error: 'Apple Watch requer app iOS nativo. Disponível na versão mobile!' });
    }

    return res.status(400).json({ error: 'Provider não suportado' });
});

// Passo 2: Whoop redireciona de volta pra cá após o login
app.get('/callback/whoop', async (req, res) => {
    const code = req.query.code;

    if (!code) {
        return res.send(errorPage('Código de autenticação não recebido'));
    }

    try {
        // Troca o code por um access_token
        const tokenRes = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                client_id: WHOOP_CLIENT_ID,
                client_secret: WHOOP_CLIENT_SECRET,
                redirect_uri: `http://localhost:${PORT}/callback/whoop`
            })
        });

        const tokenData = await tokenRes.json();

        if (tokenData.access_token) {
            tokens.whoop = tokenData.access_token;
            console.log('');
            console.log('  ✓ WHOOP conectado com sucesso!');
            console.log('  → Token salvo. Dados prontos pra acessar.');
            console.log('');
            return res.send(successPage('WHOOP'));
        } else {
            console.error('Erro no token:', tokenData);
            return res.send(errorPage('Erro ao obter token: ' + JSON.stringify(tokenData)));
        }
    } catch (err) {
        console.error('Erro:', err.message);
        return res.send(errorPage(err.message));
    }
});

// ==========================================
//  ROTAS DE DADOS — Puxa dados do wearable
// ==========================================

// Dados do Whoop (recovery, sleep, etc.)
app.get('/data/whoop', async (req, res) => {
    if (!tokens.whoop) {
        return res.status(401).json({ error: 'Whoop não conectado' });
    }

    try {
        // Busca perfil
        const profileRes = await fetch('https://api.prod.whoop.com/developer/v1/user/profile/basic', {
            headers: { 'Authorization': 'Bearer ' + tokens.whoop }
        });
        const profile = await profileRes.json();

        // Busca recovery mais recente
        const recoveryRes = await fetch('https://api.prod.whoop.com/developer/v1/recovery?limit=1', {
            headers: { 'Authorization': 'Bearer ' + tokens.whoop }
        });
        const recovery = await recoveryRes.json();

        // Busca sono mais recente
        const sleepRes = await fetch('https://api.prod.whoop.com/developer/v1/activity/sleep?limit=1', {
            headers: { 'Authorization': 'Bearer ' + tokens.whoop }
        });
        const sleep = await sleepRes.json();

        res.json({
            connected: true,
            provider: 'whoop',
            profile,
            recovery: recovery.records?.[0] || null,
            sleep: sleep.records?.[0] || null
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Dados do Oura
app.get('/data/oura', async (req, res) => {
    if (!tokens.oura) {
        return res.status(401).json({ error: 'Oura não conectado' });
    }

    try {
        const today = new Date().toISOString().split('T')[0];
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

        const sleepRes = await fetch(`https://api.ouraring.com/v2/usercollection/daily_sleep?start_date=${weekAgo}&end_date=${today}`, {
            headers: { 'Authorization': 'Bearer ' + tokens.oura }
        });
        const sleep = await sleepRes.json();

        res.json({
            connected: true,
            provider: 'oura',
            sleep: sleep.data || []
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
//  PÁGINAS DE SUCESSO / ERRO
// ==========================================

function successPage(provider) {
    return `<!DOCTYPE html>
    <html><head><title>VITAE — Conectado!</title></head>
    <body style="background:#0A0A0A;color:#fff;font-family:Inter,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;flex-direction:column;gap:16px;">
        <div style="width:80px;height:80px;border-radius:50%;background:rgba(74,217,164,0.1);border:2px solid #4AD9A4;display:flex;align-items:center;justify-content:center;">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#4AD9A4" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h2 style="color:#4AD9A4;margin:0;font-size:22px;">${provider} conectado!</h2>
        <p style="color:rgba(255,255,255,0.4);font-size:14px;">Pode fechar esta aba e voltar ao app.</p>
        <script>
            if (window.opener) {
                window.opener.postMessage({ type: 'terra-connected', success: true, provider: '${provider.toLowerCase()}' }, '*');
                setTimeout(() => window.close(), 2000);
            }
        </script>
    </body></html>`;
}

function errorPage(msg) {
    return `<!DOCTYPE html>
    <html><head><title>VITAE — Erro</title></head>
    <body style="background:#0A0A0A;color:#fff;font-family:Inter,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;flex-direction:column;gap:16px;">
        <h2 style="color:#D94452;margin:0;">Erro na conexão</h2>
        <p style="color:rgba(255,255,255,0.4);font-size:13px;max-width:400px;text-align:center;">${msg}</p>
        <script>
            if (window.opener) {
                window.opener.postMessage({ type: 'terra-connected', success: false }, '*');
                setTimeout(() => window.close(), 4000);
            }
        </script>
    </body></html>`;
}

// ==========================================
//  START
// ==========================================

app.listen(PORT, () => {
    console.log('');
    console.log('  ✦ VITAE Wearable Server rodando!');
    console.log('  → http://localhost:' + PORT);
    console.log('');

    const status = (val, placeholder) => val === placeholder ? '✗ Não configurado' : '✓ Configurado';

    console.log('  Wearables:');
    console.log('  → WHOOP:  ' + status(WHOOP_CLIENT_ID, 'COLE_SEU_CLIENT_ID_AQUI'));
    console.log('  → Oura:   ' + status(OURA_ACCESS_TOKEN, 'COLE_SEU_TOKEN_AQUI'));
    console.log('  → Garmin: Em breve (requer aprovação)');
    console.log('  → Apple:  Requer app iOS nativo');
    console.log('');

    if (WHOOP_CLIENT_ID === 'COLE_SEU_CLIENT_ID_AQUI') {
        console.log('  Pra conectar seu Whoop:');
        console.log('  1. Acesse developer.whoop.com');
        console.log('  2. Crie um app com redirect: http://localhost:' + PORT + '/callback/whoop');
        console.log('  3. Cole o Client ID e Secret neste arquivo');
        console.log('');
    }
});
