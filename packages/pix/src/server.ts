import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerPixTools } from './tools/pix.js';
import { registerWithdrawalTools } from './tools/withdrawals.js';
import { registerInternalTransferTools } from './tools/internal_transfer.js';
import { registerAccountTools } from './tools/account.js';
import { registerReportsTools } from './tools/reports.js';
import { registerCallbacksTools } from './tools/callbacks.js';
import { registerInfractionsTools } from './tools/infractions.js';
import { VERSION } from './version.js';

export function createServer() {
  const server = new McpServer({
    name: 'payzu-mcp-pix',
    version: VERSION,
  });

  registerPixTools(server);
  registerWithdrawalTools(server);
  registerInternalTransferTools(server);
  registerAccountTools(server);
  registerReportsTools(server);
  registerCallbacksTools(server);
  registerInfractionsTools(server);

  return server;
}
