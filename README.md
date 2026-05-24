# PayZu MCP

Model Context Protocol servers for the [PayZu APIs](https://docs.payzu.com.br). Plug into Claude Desktop, Cursor, Continue, and any other MCP-compatible AI client so the assistant can call PayZu directly with typed tools.

## Packages

| Package | API | Tools | Install |
|---|---|---|---|
| [`payzu-mcp-pix`](packages/pix) | Pix Processamento | 29 | `npx -y payzu-mcp-pix` |
| [`payzu-mcp-conta-digital`](packages/conta-digital) | Conta Digital | 14 | `npx -y payzu-mcp-conta-digital` |

Load **only** the one for the API you're integrating. Two separate packages avoid the AI mixing up base URLs and capabilities.

## Quick start

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "payzu-pix": {
      "command": "npx",
      "args": ["-y", "payzu-mcp-pix"],
      "env": { "PAYZU_TOKEN": "<token>" }
    },
    "payzu-conta-digital": {
      "command": "npx",
      "args": ["-y", "payzu-mcp-conta-digital"],
      "env": { "PAYZU_TOKEN": "<token>" }
    }
  }
}
```

Restart Claude Desktop. Test by asking _"qual meu saldo PayZu?"_ — Claude will call `account.balance` automatically.

## Conventions enforced by all packages

- **Amounts in BRL decimals** (`99.90`, not `9990`). Centavos at input are rejected.
- **`clientReference` required** on all create operations for idempotency.
- **`callbackUrl` required** on creates so PayZu can notify status changes.
- **Auto-retry** on 5xx/429 with exponential backoff + jitter (3 attempts).
- **Errors include `requestId`** propagated from the API.
- **Zero admin endpoints** exposed — only public/user-facing API surface.

## Whitelabel tenants

If you use a PayZu whitelabel (PayEvo, Owem, Magen, E2ePay, Saq, PaySamba, BRZ), set the base URL env var:

```json
"env": {
  "PAYZU_TOKEN": "<your-tenant-token>",
  "PAYZU_API_URL": "https://api.<slug>.processamento.com/v1"
}
```

(Or `PAYZU_HUB_API_URL` for the Conta Digital package, if your tenant has one.)

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
- SKILL.md (compact AI reference): [docs.payzu.com.br/SKILL.md](https://docs.payzu.com.br/SKILL.md)
- llms-full.txt: [docs.payzu.com.br/llms-full.txt](https://docs.payzu.com.br/llms-full.txt)

## License

MIT
