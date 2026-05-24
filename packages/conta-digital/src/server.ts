import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerDepositsTools } from './tools/deposits.js';
import { registerWithdrawalsTools } from './tools/withdrawals.js';
import { registerAccountTools } from './tools/account.js';

export function createServer() {
  const server = new McpServer({
    name: 'payzu-mcp-conta-digital',
    version: '0.1.0',
  });

  registerDepositsTools(server);
  registerWithdrawalsTools(server);
  registerAccountTools(server);

  return server;
}
