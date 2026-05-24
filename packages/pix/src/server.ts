import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AxiosInstance } from 'axios';
import { registerPixTools } from './tools/pix.js';
import { registerWithdrawalTools } from './tools/withdrawals.js';
import { registerInternalTransferTools } from './tools/internal_transfer.js';
import { registerAccountTools } from './tools/account.js';
import { registerReportsTools } from './tools/reports.js';
import { registerCallbacksTools } from './tools/callbacks.js';
import { registerInfractionsTools } from './tools/infractions.js';
import { VERSION } from './version.js';

export interface ServerOptions {
  enableCashOut?: boolean;
}

export function createServer(http: AxiosInstance, options: ServerOptions = {}) {
  const server = new McpServer({
    name: 'payzu-mcp-pix',
    title: 'PayZu Pix',
    version: VERSION,
  });

  registerPixTools(server, http);
  registerAccountTools(server, http);
  registerReportsTools(server, http);
  registerCallbacksTools(server, http);
  registerInfractionsTools(server, http);
  registerWithdrawalTools(server, http, options.enableCashOut);
  registerInternalTransferTools(server, http, options.enableCashOut);

  return server;
}
