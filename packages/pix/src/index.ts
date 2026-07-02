#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { env } from './env.js';
import { VERSION } from './version.js';

async function main() {
  process.stderr.write(`[payzu-mcp-pix] starting v${VERSION} baseURL=${env.PAYZU_API_URL}\n`);
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`[payzu-mcp-pix] listening on stdio\n`);
}

main().catch((err) => {
  process.stderr.write(`[payzu-mcp-pix] fatal: ${err?.message ?? err}\n`);
  process.exit(1);
});
