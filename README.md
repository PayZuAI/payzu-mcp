# PayZu MCP

Model Context Protocol servers for the [PayZu APIs](https://docs.payzu.com.br). Plug into Antigravity, Claude Code, Claude Desktop, Cursor, Windsurf, and any other MCP-compatible AI client so the assistant can call PayZu directly with typed tools.

## Packages

| Package | API | Tools | Install |
|---|---|---|---|
| [`payzu-mcp-pix`](packages/pix) | Pix Processamento | 29 | `npx -y payzu-mcp-pix` |

## Hosted server (no install)

Point any MCP client that supports remote servers at the hosted endpoint — no Node, no install:

```
https://mcp.payzu.com.br/mcp
```

[![Install in Cursor](https://img.shields.io/badge/Cursor-Install_payzu--pix-000000?logo=cursor)](https://cursor.com/en/install-mcp?name=payzu-pix&config=eyJ1cmwiOiJodHRwczovL21jcC5wYXl6dS5jb20uYnIvbWNwIn0=)
[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_payzu--pix-0098FF?logo=githubcopilot)](https://insiders.vscode.dev/redirect/mcp/install?name=payzu-pix&config=%7B%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fmcp.payzu.com.br%2Fmcp%22%7D)

- **claude.ai / Claude Desktop** — Settings → Connectors → *Add custom connector* → paste the URL. A PayZu authorization page opens; paste your API token once and you're connected (OAuth — the client never sees or stores the token).
- **Claude Code** — `claude mcp add --transport http payzu-pix https://mcp.payzu.com.br/mcp` (OAuth prompt on first use), or pass the token directly with `--header "Authorization: Bearer <token>"`.
- **Cursor / Windsurf / VS Code** — use the buttons above or add `{"url": "https://mcp.payzu.com.br/mcp"}` to your MCP config.

The server is stateless and holds no credentials: OAuth access tokens are sealed wrappers around your own API token, decrypted per request and forwarded to the PayZu API — exactly as if you called the API directly.

## Local server (stdio)

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "payzu-pix": {
      "command": "npx",
      "args": ["-y", "payzu-mcp-pix"],
      "env": { "PAYZU_TOKEN": "<token>" }
    }
  }
}
```

Restart Claude Desktop. Test by asking _"qual meu saldo PayZu?"_ — Claude will call `account_balance` automatically.

## Conventions

- **Amounts in BRL decimals** (`99.90`, not `9990`). Centavos at input are rejected.
- **`clientReference` required** on all create operations for idempotency.
- **`callbackUrl` required** on creates so PayZu can notify status changes.
- **Auto-retry** on 5xx/429 with exponential backoff + jitter (3 attempts).
- **Errors include `errorCode` and `requestId`** propagated from the API.
- **Zero admin endpoints** exposed — only public/user-facing API surface.

## Custom base URL

Override the default base URL via env (useful if your account uses a custom endpoint):

```json
"env": {
  "PAYZU_TOKEN": "<your-token>",
  "PAYZU_API_URL": "https://api.example.processamento.com/v1"
}
```

## Development

```bash
pnpm install
pnpm -r build
cd packages/pix && PAYZU_TOKEN=xxx node dist/index.js  # stdio mode
```

Test with MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node packages/pix/dist/index.js
```

## Related

- Documentation: [docs.payzu.com.br](https://docs.payzu.com.br)
- SDKs: [`payzu-pix`](https://www.npmjs.com/package/payzu-pix) (npm), [`payzu-pix`](https://pypi.org/project/payzu-pix/) (pypi)
- llms-full.txt: [docs.payzu.com.br/llms-full.txt](https://docs.payzu.com.br/llms-full.txt)

## License

MIT
