#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

const ANTHROPIC_OPENAI_TOOL_NAME = /^[a-zA-Z0-9_-]{1,64}$/;
const GEMINI_TOOL_NAME = /^[a-zA-Z_][a-zA-Z0-9_.-]{0,63}$/;
const TIMEOUT_MS = 15000;
const HOSTED_PORT = 18765;

const active = { children: [] };

const READ_ONLY = { readOnlyHint: true };
const ADDITIVE = { readOnlyHint: false, destructiveHint: false };
const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true };

const EXPECTED_HINTS = {
  pix_create: ADDITIVE,
  pix_get: READ_ONLY,
  pix_qr_code: READ_ONLY,
  pix_proof: READ_ONLY,
  withdraw_create: DESTRUCTIVE,
  withdraw_get: READ_ONLY,
  withdraw_by_qr: DESTRUCTIVE,
  withdraw_read_qr: READ_ONLY,
  withdraw_dict: READ_ONLY,
  withdraw_proof: READ_ONLY,
  internal_transfer_create: DESTRUCTIVE,
  internal_transfer_get: READ_ONLY,
  account_profile: READ_ONLY,
  account_balance: READ_ONLY,
  reports_list_transactions: READ_ONLY,
  reports_get_transaction: READ_ONLY,
  reports_create_csv: ADDITIVE,
  reports_list_jobs: READ_ONLY,
  reports_get_job: READ_ONLY,
  reports_download: READ_ONLY,
  callbacks_list: READ_ONLY,
  callbacks_get: READ_ONLY,
  callbacks_resend: ADDITIVE,
  callbacks_resend_bulk: ADDITIVE,
  infractions_list: READ_ONLY,
  infractions_get: READ_ONLY,
  infractions_create_defense: DESTRUCTIVE,
  infractions_list_defenses: READ_ONLY,
  infractions_get_defense: READ_ONLY,
  refund_create: DESTRUCTIVE,
  webhooks_create: ADDITIVE,
  webhooks_list: READ_ONLY,
  webhooks_get: READ_ONLY,
  webhooks_update: DESTRUCTIVE,
  webhooks_delete: DESTRUCTIVE,
  webhooks_rotate_secret: DESTRUCTIVE,
  webhooks_sent_quantity: READ_ONLY,
  webhooks_sent_detail: READ_ONLY,
  reports_bank_statements: READ_ONLY,
  reports_bank_statement: READ_ONLY,
  reports_deposit_pending: READ_ONLY,
  reports_deposit_pending_get: READ_ONLY,
  reports_summary: READ_ONLY,
  callbacks_resend_webhook: ADDITIVE,
  callbacks_resend_webhook_bulk: ADDITIVE,
  callbacks_create_secret: ADDITIVE,
  callbacks_rotate_secret: DESTRUCTIVE,
};

const EXPECTED_TOOLS = Object.keys(EXPECTED_HINTS);

const RETIRED_TOOLS = ['account_pix_keys'];

const CASH_OUT_TOOLS = ['withdraw_create', 'withdraw_by_qr', 'internal_transfer_create', 'refund_create'];

function bail(message) {
  console.error(`SMOKE FALHOU: ${message}`);
  active.children.forEach((child) => child.kill('SIGKILL'));
  process.exit(1);
}

function parseLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    bail(`linha não-JSON recebida no stdout: ${line}`);
  }
}

function createClient() {
  const child = spawn(process.execPath, ['dist/index.js'], {
    env: { ...process.env, PAYZU_TOKEN: 'dummy-token', PAYZU_API_URL: 'http://127.0.0.1:9' },
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  active.children.push(child);
  const pending = new Map();
  const state = { buffer: '', nextId: 1 };

  child.on('error', (err) => bail(`falha ao iniciar o processo: ${err.message}`));
  child.on('exit', (code, signal) => {
    if (pending.size > 0) {
      bail(`processo encerrou antes de responder (code=${code}, signal=${signal})`);
    }
  });

  child.stdout.on('data', (chunk) => {
    state.buffer += chunk.toString();
    const lines = state.buffer.split('\n');
    state.buffer = lines.pop() ?? '';
    for (const line of lines.filter((l) => l.trim().length > 0)) {
      const message = parseLine(line);
      const resolve = pending.get(message.id);
      if (resolve) {
        pending.delete(message.id);
        resolve(message);
      }
    }
  });

  function request(method, params) {
    const id = state.nextId;
    state.nextId += 1;
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    return new Promise((resolve) => pending.set(id, resolve));
  }

  function notify(method) {
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method })}\n`);
  }

  return { child, request, notify };
}

async function waitForHealth(url, attemptsLeft = 50) {
  const healthy = await fetch(url).then((res) => res.ok, () => false);
  if (healthy) return;
  if (attemptsLeft === 0) bail(`servidor hospedado não respondeu em ${url}`);
  await new Promise((resolve) => setTimeout(resolve, 100));
  await waitForHealth(url, attemptsLeft - 1);
}

async function listHostedTools() {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'MCP_ENABLE_CASHOUT'));
  const child = spawn(process.execPath, ['dist/remote.js'], {
    env: { ...env, PORT: String(HOSTED_PORT), MCP_TOKEN_KEY: '00'.repeat(32), PAYZU_API_URL: 'http://127.0.0.1:9' },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  active.children.push(child);
  const base = `http://127.0.0.1:${HOSTED_PORT}`;
  await waitForHealth(`${base}/healthz`);
  const res = await fetch(`${base}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: 'Bearer smoke-token',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
  });
  const body = await res.text();
  child.kill('SIGTERM');
  const data = body.split('\n').find((line) => line.startsWith('data: '));
  if (!data) bail(`tools/list do hospedado sem resposta: ${body}`);
  return JSON.parse(data.slice('data: '.length)).result.tools.map((tool) => tool.name);
}

function hasExpectedHints(tool) {
  const expected = EXPECTED_HINTS[tool.name];
  return Boolean(tool.title) && Object.entries(expected).every(([key, value]) => tool.annotations?.[key] === value);
}

async function main() {
  const timer = setTimeout(() => bail(`timeout de ${TIMEOUT_MS}ms excedido`), TIMEOUT_MS);
  const { child, request, notify } = createClient();

  const init = await request('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'payzu-smoke', version: '0.0.0' },
  });
  if (init.error) bail(`initialize retornou erro: ${JSON.stringify(init.error)}`);
  const reported = init.result?.serverInfo?.version;
  if (reported !== pkg.version) bail(`serverInfo.version=${reported}, esperado ${pkg.version}`);

  notify('notifications/initialized');

  const list = await request('tools/list', {});
  if (list.error) bail(`tools/list retornou erro: ${JSON.stringify(list.error)}`);
  const names = (list.result?.tools ?? []).map((tool) => tool.name);
  const retired = RETIRED_TOOLS.filter((name) => names.includes(name));
  if (retired.length > 0) bail(`tools de rota removida ainda registradas: ${retired.join(', ')}`);
  if (names.length !== EXPECTED_TOOLS.length) {
    bail(`tools/list retornou ${names.length} tools, esperado ${EXPECTED_TOOLS.length}`);
  }
  const invalid = names.filter(
    (name) => !ANTHROPIC_OPENAI_TOOL_NAME.test(name) || !GEMINI_TOOL_NAME.test(name),
  );
  if (invalid.length > 0) bail(`nomes de tool inválidos para Anthropic/OpenAI/Gemini: ${invalid.join(', ')}`);
  const missing = EXPECTED_TOOLS.filter((name) => !names.includes(name));
  const extra = names.filter((name) => !EXPECTED_TOOLS.includes(name));
  if (missing.length > 0 || extra.length > 0) {
    bail(`divergência de tools. faltando: [${missing.join(', ')}] extras: [${extra.join(', ')}]`);
  }

  const tools = list.result.tools;
  const misannotated = tools.filter((tool) => !hasExpectedHints(tool)).map((tool) => tool.name);
  if (misannotated.length > 0) bail(`tools sem title ou com anotação diferente da esperada: ${misannotated.join(', ')}`);

  const hostedNames = await listHostedTools();
  const expectedHosted = EXPECTED_TOOLS.filter((name) => !CASH_OUT_TOOLS.includes(name));
  const hostedMissing = expectedHosted.filter((name) => !hostedNames.includes(name));
  const hostedExtra = hostedNames.filter((name) => !expectedHosted.includes(name));
  if (hostedMissing.length > 0 || hostedExtra.length > 0) {
    bail(`divergência no hospedado. faltando: [${hostedMissing.join(', ')}] extras: [${hostedExtra.join(', ')}]`);
  }

  const call = await request('tools/call', { name: 'account_balance', arguments: {} });
  if (call.error) bail(`tools/call retornou erro de protocolo: ${JSON.stringify(call.error)}`);
  if (call.result?.isError !== true) bail('account_balance com API inalcançável deveria retornar isError=true');
  const text = call.result?.content?.[0]?.text ?? '';
  if (!text.startsWith('[network]')) bail(`erro de rede deveria ser limpo "[network] ...", veio: ${text}`);

  clearTimeout(timer);
  child.kill('SIGTERM');
  console.log(`SMOKE OK: ${names.length} tools anotadas (${hostedNames.length} no hospedado), versão ${reported}, erro limpo "${text}"`);
}

main().catch((err) => bail(err instanceof Error ? err.message : String(err)));
