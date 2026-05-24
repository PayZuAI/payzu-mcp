import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import express from 'express';
import axios from 'axios';

export interface OauthConfig {
  publicUrl: string;
  tokenKey: Buffer;
  apiUrl: string;
}

const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const AUTH_CODE_TTL_MS = 60 * 1000;

const ACCESS_PREFIX = 'pzmcp_at_';
const REFRESH_PREFIX = 'pzmcp_rt_';
const CODE_PREFIX = 'pzmcp_code_';
const CLIENT_PREFIX = 'pzmcp_client_';

function seal(key: Buffer, payload: Record<string, unknown>): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url');
}

function unseal(key: Buffer, sealed: string): Record<string, unknown> | undefined {
  try {
    const raw = Buffer.from(sealed, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const plaintext = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]);
    return JSON.parse(plaintext.toString('utf8'));
  } catch {
    return undefined;
  }
}

const MCP_HOST = /^mcp\.payzu\.(com\.br|processamento\.(com|io))$/;

export function requestPublicUrl(req: express.Request, fallback: string): string {
  const host = req.get('host');
  const proto = (req.get('x-forwarded-proto') ?? req.protocol ?? 'https').split(',')[0].trim();
  return host && MCP_HOST.test(host) ? `${proto}://${host}` : fallback;
}

export function resolvePayzuToken(config: OauthConfig, bearer: string): string | undefined {
  if (!bearer.startsWith(ACCESS_PREFIX)) return bearer;
  const payload = unseal(config.tokenKey, bearer.slice(ACCESS_PREFIX.length));
  if (!payload || payload.kind !== 'access' || typeof payload.token !== 'string') return undefined;
  if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return undefined;
  return payload.token;
}

function parseRedirectUri(value: unknown): URL | undefined {
  if (typeof value !== 'string') return undefined;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }
  if (url.protocol === 'https:') return url;
  if (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return url;
  return undefined;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function consentPage(params: Record<string, string>, clientName?: string, error?: string): string {
  const hidden = Object.entries(params)
    .map(([name, value]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`)
    .join('\n      ');
  const requester = clientName ? `<strong>${escapeHtml(clientName)}</strong>` : 'Um assistente de IA';
  const redirectHost = parseRedirectUri(params.redirect_uri)?.host ?? '';
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Conectar conta PayZu</title>
<link rel="icon" href="/favicon.ico">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
  :root {
    --background: 150 10% 96%;
    --foreground: 220 12% 25%;
    --primary: 147 64% 42%;
    --primary-foreground: 0 0% 100%;
    --card: 0 0% 100%;
    --card-foreground: 220 12% 25%;
    --border: 220 10% 90%;
    --muted: 0 0% 89.43%;
    --muted-foreground: 220 8% 46%;
    --destructive: 0 100% 65%;
    --radius: 0.75rem;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --background: 220 21% 9%;
      --foreground: 220 10% 95%;
      --primary: 147 77% 61%;
      --primary-foreground: 220 20% 5%;
      --card: 220 18% 11%;
      --card-foreground: 220 10% 95%;
      --border: 220 15% 18%;
      --muted: 220 16% 14%;
      --muted-foreground: 220 10% 55%;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    font-family: 'Montserrat', -apple-system, system-ui, sans-serif;
    background: hsl(var(--background));
    color: hsl(var(--foreground));
  }
  .shell {
    width: 100%;
    max-width: 880px;
    display: flex;
    background: hsl(var(--card));
    color: hsl(var(--card-foreground));
    border: 1px solid hsl(var(--border));
    border-radius: calc(var(--radius) + 8px);
    overflow: hidden;
    box-shadow: 0 0 20px hsl(var(--primary) / 0.15), 0 0 40px hsl(var(--primary) / 0.05);
  }
  .form-side {
    flex: 1 1 55%;
    padding: 48px 44px 36px;
    min-width: 0;
  }
  .panel {
    flex: 1 1 45%;
    position: relative;
    background: hsl(var(--primary));
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding: 40px 36px;
    color: #fff;
  }
  .panel img.bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    mix-blend-mode: soft-light;
    opacity: 0.9;
  }
  .panel-content { position: relative; }
  .panel h2 { font-size: 22px; font-weight: 500; letter-spacing: -0.02em; margin: 0 0 8px; }
  .panel p { font-size: 13px; font-weight: 300; line-height: 1.6; margin: 0 0 28px; opacity: 0.9; }
  .panel .brand { font-size: 11px; font-weight: 300; opacity: 0.75; letter-spacing: 0.04em; }
  @media (max-width: 820px) {
    .panel { display: none; }
    .form-side { padding: 28px 20px 22px; }
    body { padding: 12px; }
    .shell { border-radius: var(--radius); }
    .logo { height: 28px; margin-bottom: 22px; }
    h1 { margin: 0 0 10px; }
  }
  .logo { height: 34px; display: block; margin-bottom: 24px; }
  h1 { font-size: 20px; font-weight: 300; letter-spacing: -0.02em; margin: 0 0 14px; }
  .sub {
    font-size: 13px;
    font-weight: 300;
    line-height: 1.6;
    color: hsl(var(--muted-foreground));
    margin: 0 0 20px;
  }
  .sub strong { font-weight: 500; color: hsl(var(--foreground)); }
  .perms { list-style: none; margin: 0 0 18px; padding: 0; }
  .dest { font-size: 12px; font-weight: 300; line-height: 1.5; color: hsl(var(--muted-foreground)); background: hsl(var(--muted) / 0.5); border-radius: var(--radius); padding: 10px 12px; margin: 0 0 20px; }
  .dest strong { color: hsl(var(--foreground)); font-weight: 500; }
  .perms li {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    font-weight: 300;
    line-height: 1.5;
    padding: 4px 0;
  }
  .perms svg { flex: none; width: 15px; height: 15px; color: hsl(var(--primary)); }
  label {
    display: block;
    font-size: 11px;
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: hsl(var(--muted-foreground));
    margin: 0 0 8px;
  }
  .field { position: relative; }
  input[type=password], input[type=text] {
    width: 100%;
    height: 44px;
    padding: 0 46px 0 14px;
    border: 0;
    border-radius: var(--radius);
    background: hsl(var(--muted) / 0.6);
    color: hsl(var(--foreground));
    font-family: inherit;
    font-size: 14px;
    caret-color: hsl(var(--primary));
    outline: none;
  }
  input:focus { box-shadow: 0 0 0 2px hsl(var(--primary) / 0.5); }
  input::placeholder { color: hsl(var(--muted-foreground)); font-weight: 300; }
  .toggle {
    position: absolute;
    right: 4px;
    top: 50%;
    transform: translateY(-50%);
    border: 0;
    background: transparent;
    color: hsl(var(--muted-foreground));
    width: 38px;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    cursor: pointer;
  }
  .toggle:hover { color: hsl(var(--foreground)); }
  .toggle svg { width: 18px; height: 18px; }
  .submit {
    width: 100%;
    height: 44px;
    margin-top: 20px;
    border: 0;
    border-radius: var(--radius);
    background: hsl(var(--primary));
    color: hsl(var(--primary-foreground));
    font-family: inherit;
    font-size: 14px;
    font-weight: 400;
    cursor: pointer;
    box-shadow: 0 0 10px hsl(var(--primary) / 0.1);
    transition: opacity 0.15s;
  }
  .submit:hover { opacity: 0.9; }
  .submit:disabled { opacity: 0.6; cursor: default; }
  .err {
    background: hsl(var(--destructive) / 0.1);
    color: hsl(var(--destructive));
    border-radius: var(--radius);
    padding: 12px 14px;
    font-size: 13px;
    line-height: 1.5;
    margin: 0 0 16px;
  }
  .help {
    margin-top: 28px;
    padding-top: 20px;
    border-top: 1px solid hsl(var(--border));
  }
  .help-title {
    font-size: 11px;
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: hsl(var(--muted-foreground));
    margin: 0 0 10px;
  }
  .help-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border: 1px solid hsl(var(--border));
    border-radius: var(--radius);
    margin-bottom: 8px;
    font-size: 13px;
    color: hsl(var(--foreground));
    text-decoration: none;
    transition: border-color 0.15s;
  }
  .help-row:hover { border-color: hsl(var(--primary)); }
  .help-go { color: hsl(var(--primary)); font-weight: 500; font-size: 12px; white-space: nowrap; }
  .help-tutorial {
    display: block;
    text-align: center;
    font-size: 12px;
    font-weight: 300;
    color: hsl(var(--muted-foreground));
    margin-top: 12px;
    text-decoration: none;
  }
  .help-tutorial:hover { color: hsl(var(--foreground)); text-decoration: underline; }
</style>
</head>
<body>
  <div class="shell">
    <div class="form-side">
      <picture>
        <source srcset="/brand/logo-dark.png" media="(prefers-color-scheme: dark)">
        <img class="logo" src="/brand/logo.png" alt="PayZu">
      </picture>
      <h1>Conectar sua conta</h1>
      <p class="sub">${requester} está pedindo acesso à sua conta PayZu. Com a sua autorização, ele poderá:</p>
      <ul class="perms">
        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Criar e consultar cobranças Pix</li>
        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Ver saldo, transações e relatórios</li>
        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Acompanhar callbacks e infrações</li>
      </ul>
      ${redirectHost ? `<p class="dest">Ao autorizar, você retorna para <strong>${escapeHtml(redirectHost)}</strong>. Só continue se foi você quem iniciou esta conexão.</p>` : ''}
      ${error ? `<div class="err">${error}</div>` : ''}
      <form method="post" action="/authorize" id="consent">
        ${hidden}
        <label for="token">Token de API</label>
        <div class="field">
          <input type="password" id="token" name="token" autocomplete="off" required placeholder="Cole seu token">
          <button type="button" class="toggle" id="toggle" aria-label="Mostrar token">
            <svg id="eye-show" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
            <svg id="eye-hide" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none"><path d="m3 3 18 18"/><path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-2.4 3.3"/><path d="M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7a10 10 0 0 0 3.4-.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>
          </button>
        </div>
        <button type="submit" class="submit" id="submit">Autorizar</button>
      </form>
      <div class="help">
        <div class="help-title">Onde encontro meu token?</div>
        <a class="help-row" href="https://web.payzu.processamento.com/credentials" target="_blank" rel="noopener"><span>Processamento</span><span class="help-go">Pegar token →</span></a>
        <a class="help-row" href="https://hub.payzu.com.br/settings/tokens" target="_blank" rel="noopener"><span>Hub</span><span class="help-go">Pegar token →</span></a>
        <a class="help-tutorial" href="https://suporte.payzu.com.br/portal/pt-br/kb/articles/api-payzu-acessar-e-administrar-token-de-api-no-dashboard" target="_blank" rel="noopener">Ver o tutorial completo na central de ajuda</a>
      </div>
    </div>
    <div class="panel">
      <picture>
        <source srcset="/brand/bg-dark.jpg" media="(prefers-color-scheme: dark)">
        <img class="bg" src="/brand/bg.jpg" alt="">
      </picture>
      <div class="panel-content">
        <h2>Pagamentos inteligentes</h2>
        <p>Conectamos empresas, pessoas e inteligência para tornar cada pagamento mais simples e seguro.</p>
        <div class="brand">PayZu · O futuro dos pagamentos digitais</div>
      </div>
    </div>
  </div>
<script>
  const toggle = document.getElementById('toggle');
  const token = document.getElementById('token');
  toggle.addEventListener('click', () => {
    const hiddenNow = token.type === 'password';
    token.type = hiddenNow ? 'text' : 'password';
    document.getElementById('eye-show').style.display = hiddenNow ? 'none' : '';
    document.getElementById('eye-hide').style.display = hiddenNow ? '' : 'none';
    toggle.setAttribute('aria-label', hiddenNow ? 'Ocultar token' : 'Mostrar token');
  });
  document.getElementById('consent').addEventListener('submit', () => {
    const submit = document.getElementById('submit');
    submit.disabled = true;
    submit.textContent = 'Autorizando…';
  });
</script>
</body>
</html>`;
}

function oauthError(res: express.Response, status: number, error: string, description: string) {
  res.status(status).json({ error, error_description: description });
}

const CONSENT_CSP = "default-src 'none'; img-src 'self'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'";

function sendConsent(res: express.Response, status: number, html: string) {
  res
    .status(status)
    .set('Content-Security-Policy', CONSENT_CSP)
    .set('X-Frame-Options', 'DENY')
    .type('html')
    .send(html);
}

export function createOauthRouter(config: OauthConfig): express.Router {
  const router = express.Router();

  const metadataFor = (base: string) => ({
    issuer: base,
    authorization_endpoint: `${base}/authorize`,
    token_endpoint: `${base}/token`,
    registration_endpoint: `${base}/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['payzu'],
  });

  const sendMeta = (req: express.Request, res: express.Response) => {
    res.json(metadataFor(requestPublicUrl(req, config.publicUrl)));
  };

  router.get('/.well-known/oauth-authorization-server', sendMeta);
  router.get('/.well-known/openid-configuration', sendMeta);
  router.get(['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp'], (req, res) => {
    const base = requestPublicUrl(req, config.publicUrl);
    res.json({
      resource: base,
      resource_name: 'PayZu',
      resource_documentation: 'https://docs.payzu.com.br/docs/pix-processamento/mcp',
      authorization_servers: [base],
      bearer_methods_supported: ['header'],
    });
  });

  router.post('/register', express.json(), (req, res) => {
    const redirectUris = req.body?.redirect_uris;
    const valid = Array.isArray(redirectUris)
      && redirectUris.length > 0
      && redirectUris.length <= 10
      && redirectUris.every((u: unknown) => parseRedirectUri(u) !== undefined);
    if (!valid) {
      oauthError(res, 400, 'invalid_client_metadata', 'redirect_uris must be a non-empty array of https URLs');
      return;
    }
    const clientName = typeof req.body?.client_name === 'string' ? req.body.client_name.slice(0, 60) : undefined;
    const clientId = CLIENT_PREFIX + seal(config.tokenKey, { kind: 'client', redirectUris, name: clientName });
    res.status(201).json({
      client_id: clientId,
      redirect_uris: redirectUris,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    });
  });

  function validateClient(clientId: string | undefined, redirectUri: string | undefined): { name?: string } | undefined {
    if (!clientId?.startsWith(CLIENT_PREFIX) || !redirectUri) return undefined;
    const payload = unseal(config.tokenKey, clientId.slice(CLIENT_PREFIX.length));
    const valid = payload?.kind === 'client'
      && Array.isArray(payload.redirectUris)
      && payload.redirectUris.includes(redirectUri);
    if (!valid) return undefined;
    return { name: typeof payload?.name === 'string' ? payload.name : undefined };
  }

  router.get('/authorize', (req, res) => {
    const { client_id, redirect_uri, state, code_challenge, code_challenge_method, response_type } = req.query as Record<string, string | undefined>;
    const client = validateClient(client_id, redirect_uri);
    if (!client) {
      res.status(400).send('Requisição de autorização inválida.');
      return;
    }
    if (response_type !== 'code' || !code_challenge || code_challenge_method !== 'S256') {
      res.status(400).send('Requisição de autorização inválida.');
      return;
    }
    sendConsent(res, 200, consentPage({
      client_id: client_id ?? '',
      redirect_uri: redirect_uri ?? '',
      state: state ?? '',
      code_challenge,
    }, client.name));
  });

  router.post('/authorize', express.urlencoded({ extended: false }), async (req, res) => {
    const { client_id, redirect_uri, state, code_challenge, token } = req.body as Record<string, string | undefined>;
    const client = validateClient(client_id, redirect_uri);
    if (!client || !code_challenge || !token) {
      res.status(400).send('Requisição de autorização inválida.');
      return;
    }
    const rerender = (message: string) => {
      sendConsent(res, 401, consentPage({
        client_id: client_id ?? '',
        redirect_uri: redirect_uri ?? '',
        state: state ?? '',
        code_challenge,
      }, client.name, message));
    };
    try {
      const check = await axios.get(`${config.apiUrl}/user`, {
        headers: { Authorization: `Bearer ${token.trim()}` },
        timeout: 10_000,
        validateStatus: () => true,
      });
      if (check.status !== 200) {
        rerender('Token inválido ou sem acesso. Confira no painel e tente novamente.');
        return;
      }
    } catch {
      rerender('Não foi possível validar o token agora. Tente novamente.');
      return;
    }
    const code = CODE_PREFIX + seal(config.tokenKey, {
      kind: 'code',
      token: token.trim(),
      challenge: code_challenge,
      clientId: client_id,
      redirectUri: redirect_uri,
      exp: Date.now() + AUTH_CODE_TTL_MS,
    });
    const target = new URL(redirect_uri as string);
    target.searchParams.set('code', code);
    if (state) target.searchParams.set('state', state);
    res.redirect(302, target.toString());
  });

  router.post('/token', express.urlencoded({ extended: false }), (req, res) => {
    const { grant_type } = req.body as Record<string, string | undefined>;

    if (grant_type === 'authorization_code') {
      const { code, code_verifier, client_id, redirect_uri } = req.body as Record<string, string | undefined>;
      if (!code?.startsWith(CODE_PREFIX) || !code_verifier || !redirect_uri) {
        oauthError(res, 400, 'invalid_grant', 'Malformed authorization code');
        return;
      }
      const payload = unseal(config.tokenKey, code.slice(CODE_PREFIX.length));
      if (!payload || payload.kind !== 'code' || typeof payload.exp !== 'number' || Date.now() > payload.exp) {
        oauthError(res, 400, 'invalid_grant', 'Expired or invalid authorization code');
        return;
      }
      if (client_id !== payload.clientId || redirect_uri !== payload.redirectUri) {
        oauthError(res, 400, 'invalid_grant', 'Client mismatch');
        return;
      }
      const expected = Buffer.from(String(payload.challenge));
      const actual = Buffer.from(createHash('sha256').update(code_verifier).digest('base64url'));
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
        oauthError(res, 400, 'invalid_grant', 'PKCE verification failed');
        return;
      }
      res.json(issueTokens(config, String(payload.token)));
      return;
    }

    if (grant_type === 'refresh_token') {
      const { refresh_token } = req.body as Record<string, string | undefined>;
      if (!refresh_token?.startsWith(REFRESH_PREFIX)) {
        oauthError(res, 400, 'invalid_grant', 'Malformed refresh token');
        return;
      }
      const payload = unseal(config.tokenKey, refresh_token.slice(REFRESH_PREFIX.length));
      if (!payload || payload.kind !== 'refresh' || typeof payload.exp !== 'number' || Date.now() > payload.exp) {
        oauthError(res, 400, 'invalid_grant', 'Expired or invalid refresh token');
        return;
      }
      res.json(issueTokens(config, String(payload.token)));
      return;
    }

    oauthError(res, 400, 'unsupported_grant_type', 'Use authorization_code or refresh_token');
  });

  return router;
}

function issueTokens(config: OauthConfig, payzuToken: string) {
  return {
    access_token: ACCESS_PREFIX + seal(config.tokenKey, { kind: 'access', token: payzuToken, exp: Date.now() + ACCESS_TOKEN_TTL_MS }),
    token_type: 'Bearer',
    expires_in: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
    refresh_token: REFRESH_PREFIX + seal(config.tokenKey, { kind: 'refresh', token: payzuToken, exp: Date.now() + REFRESH_TOKEN_TTL_MS }),
    scope: 'payzu',
  };
}
