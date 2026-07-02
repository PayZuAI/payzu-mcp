#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

const ANTHROPIC_OPENAI_TOOL_NAME = /^[a-zA-Z0-9_-]{1,64}$/;
const GEMINI_TOOL_NAME = /^[a-zA-Z_][a-zA-Z0-9_.-]{0,63}$/;
const TIMEOUT_MS = 15000;

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
];

function bail(message) {
  console.error(`SMOKE FALHOU: ${message}`);
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

  const call = await request('tools/call', { name: 'account_balance', arguments: {} });
  if (call.error) bail(`tools/call retornou erro de protocolo: ${JSON.stringify(call.error)}`);
  if (call.result?.isError !== true) bail('account_balance com API inalcançável deveria retornar isError=true');
  const text = call.result?.content?.[0]?.text ?? '';
  if (!text.startsWith('[network]')) bail(`erro de rede deveria ser limpo "[network] ...", veio: ${text}`);

  clearTimeout(timer);
  child.kill('SIGTERM');
  console.log(`SMOKE OK: ${names.length} tools válidas, versão ${reported}, erro limpo "${text}"`);
}

main().catch((err) => bail(err instanceof Error ? err.message : String(err)));
