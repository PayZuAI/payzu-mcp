#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { env } from './env.js';

async function main() {
  process.stderr.write(`[payzu-mcp-conta-digital] starting v0.1.0 baseURL=${env.PAYZU_HUB_API_URL}\n`);
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`[payzu-mcp-conta-digital] listening on stdio\n`);
}

main().catch((err) => {
  process.stderr.write(`[payzu-mcp-conta-digital] fatal: ${err?.message ?? err}\n`);
  process.exit(1);
});
