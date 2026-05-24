#!/usr/bin/env node
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { bool, cleanEnv, port, str, url } from 'envalid';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createHttp } from './client.js';
import { createServer } from './server.js';
import { createOauthRouter, resolvePayzuToken, requestPublicUrl } from './oauth.js';
import { VERSION } from './version.js';

const env = cleanEnv(process.env, {
  PORT: port({ default: 8080 }),
  PAYZU_API_URL: url({
    default: 'https://api.payzu.processamento.com/v1',
    desc: 'Base URL of the Pix Processamento API',
  }),
  MCP_PUBLIC_URL: url({
    default: 'https://mcp.payzu.processamento.com',
    desc: 'Public base URL of this MCP server (OAuth issuer)',
  }),
  MCP_TOKEN_KEY: str({
    desc: '32-byte hex key for sealing OAuth tokens',
  }),
  MCP_ENABLE_CASHOUT: bool({
    default: false,
    desc: 'Expose withdrawal/transfer tools. Keep false on the shared hosted server: one egress IP defeats per-account IP whitelisting for cash-out.',
  }),
});

const oauthConfig = {
  publicUrl: env.MCP_PUBLIC_URL,
  tokenKey: Buffer.from(env.MCP_TOKEN_KEY, 'hex'),
  apiUrl: env.PAYZU_API_URL,
};

if (oauthConfig.tokenKey.length !== 32) {
  throw new Error('MCP_TOKEN_KEY must be 32 bytes hex-encoded');
}

const app = express();
app.set('trust proxy', true);
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', name: 'payzu-mcp-pix', version: VERSION });
});

const assetsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');

app.get(['/favicon.ico', '/favicon.png', '/icon.png', '/apple-touch-icon.png'], (_req, res) => {
  res.type('png').sendFile(join(assetsDir, 'icon.png'));
});

const BRAND_ASSETS: Record<string, { file: string; type: string }> = {
  'logo.png': { file: 'brand-logo.png', type: 'png' },
  'logo-dark.png': { file: 'brand-logo-dark.png', type: 'png' },
  'bg.jpg': { file: 'brand-bg.jpg', type: 'jpg' },
  'bg-dark.jpg': { file: 'brand-bg-dark.jpg', type: 'jpg' },
};

app.get('/brand/:name', (req, res) => {
  const asset = BRAND_ASSETS[req.params.name];
  if (!asset) {
    res.status(404).end();
    return;
  }
  res.type(asset.type).set('Cache-Control', 'public, max-age=86400').sendFile(join(assetsDir, asset.file));
});

app.get('/', (_req, res) => {
  res.redirect(301, 'https://ia.payzu.com.br/');
});

app.use(createOauthRouter(oauthConfig));

function extractBearer(header: string | undefined): string | undefined {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
}

app.post('/mcp', express.json({ limit: '2mb' }), async (req, res) => {
  const bearer = extractBearer(req.header('authorization'));
  const token = bearer ? resolvePayzuToken(oauthConfig, bearer) : undefined;
  if (!token) {
    res
      .status(401)
      .set('WWW-Authenticate', `Bearer resource_metadata="${requestPublicUrl(req, env.MCP_PUBLIC_URL)}/.well-known/oauth-protected-resource"`)
      .json({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: 'Missing or invalid credentials. Authenticate via OAuth or send "Authorization: Bearer <PAYZU_TOKEN>" (create one in the dashboard: https://web.payzu.processamento.com/credentials).',
        },
        id: null,
      });
    return;
  }

  const server = createServer(createHttp({ token, baseUrl: env.PAYZU_API_URL }), {
    enableCashOut: env.MCP_ENABLE_CASHOUT,
  });
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  res.on('close', () => {
    void transport.close();
    void server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    process.stderr.write(`[payzu-mcp-pix] request error: ${err instanceof Error ? err.message : String(err)}\n`);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
});

const methodNotAllowed = (_req: express.Request, res: express.Response) => {
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed. This server is stateless: use POST /mcp.' },
    id: null,
  });
};

app.get('/mcp', methodNotAllowed);
app.delete('/mcp', methodNotAllowed);

app.listen(env.PORT, () => {
  process.stderr.write(`[payzu-mcp-pix] remote v${VERSION} listening on :${env.PORT}\n`);
});
