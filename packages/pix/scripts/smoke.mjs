#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createHttp } from '../dist/client.js';
import { createServer } from '../dist/server.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

const ANTHROPIC_OPENAI_TOOL_NAME = /^[a-zA-Z0-9_-]{1,64}$/;
const GEMINI_TOOL_NAME = /^[a-zA-Z_][a-zA-Z0-9_.-]{0,63}$/;
const TIMEOUT_MS = 15000;

const active = { child: null };

const EXPECTED_TOOLS = [
  'pix_create',
  'pix_get',
  'pix_qr_code',
  'pix_proof',
  'withdraw_create',
  'withdraw_get',
  'withdraw_by_qr',
  'withdraw_read_qr',
  'withdraw_dict',
  'withdraw_proof',
  'internal_transfer_create',
  'internal_transfer_get',
  'account_profile',
  'account_balance',
  'reports_list_transactions',
  'reports_get_transaction',
  'reports_create_csv',
  'reports_list_jobs',
  'reports_get_job',
  'reports_download',
  'callbacks_list',
  'callbacks_get',
  'callbacks_resend',
  'callbacks_resend_bulk',
  'infractions_list',
  'infractions_get',
  'infractions_create_defense',
  'infractions_list_defenses',
  'infractions_get_defense',
  'refund_create',
  'webhooks_create',
  'webhooks_list',
  'webhooks_get',
  'webhooks_update',
  'webhooks_delete',
  'webhooks_rotate_secret',
  'webhooks_sent_quantity',
  'webhooks_sent_detail',
  'reports_bank_statements',
  'reports_bank_statement',
  'reports_deposit_pending',
  'reports_deposit_pending_get',
  'reports_summary',
  'callbacks_resend_webhook',
  'callbacks_resend_webhook_bulk',
  'callbacks_create_secret',
  'callbacks_rotate_secret',
];

const RETIRED_TOOLS = ['account_pix_keys'];

const CASH_OUT_TOOLS = ['withdraw_create', 'withdraw_by_qr', 'internal_transfer_create', 'refund_create'];

function bail(message) {
  console.error(`SMOKE FALHOU: ${message}`);
  if (active.child) active.child.kill('SIGKILL');
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
  active.child = child;
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

async function listHostedTools() {
  const http = createHttp({ token: 'dummy-token', baseUrl: 'http://127.0.0.1:9' });
  const server = createServer(http, { enableCashOut: false });
  const client = new Client({ name: 'payzu-smoke', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  const { tools } = await client.listTools();
  await client.close();
  return tools.map((tool) => tool.name);
}

function isAnnotated(tool) {
  const hints = tool.annotations ?? {};
  if (!tool.title || typeof hints.readOnlyHint !== 'boolean') return false;
  return hints.readOnlyHint || typeof hints.destructiveHint === 'boolean';
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
  const unannotated = tools.filter((tool) => !isAnnotated(tool)).map((tool) => tool.name);
  if (unannotated.length > 0) bail(`tools sem title ou sem readOnlyHint/destructiveHint: ${unannotated.join(', ')}`);
  const unguarded = CASH_OUT_TOOLS.filter(
    (name) => tools.find((tool) => tool.name === name)?.annotations?.destructiveHint !== true,
  );
  if (unguarded.length > 0) bail(`tools que tiram dinheiro sem destructiveHint: ${unguarded.join(', ')}`);

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
