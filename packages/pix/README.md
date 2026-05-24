# payzu-mcp-pix

MCP server for the [PayZu Pix Processamento](https://docs.payzu.com.br/docs/pix-processamento) API. Plugs into Claude Desktop, Cursor, Continue, and any other MCP-compatible AI client to let the assistant call PayZu's Pix API directly with typed tools.

**29 tools** spanning Pix charges, withdrawals, internal transfers, account info, reports, callbacks and MED infractions. No admin endpoints exposed.

## Install

### Claude Desktop / Continue

Add to `claude_desktop_config.json` (`~/Library/Application Support/Claude/` on macOS, `%APPDATA%\Claude\` on Windows):

```json
{
  "mcpServers": {
    "payzu-pix": {
      "command": "npx",
      "args": ["-y", "payzu-mcp-pix"],
      "env": {
        "PAYZU_TOKEN": "<your-bearer-token-from-dashboard>"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project (or `~/.cursor/mcp.json` globally):

```json
{
  "mcpServers": {
    "payzu-pix": {
      "command": "npx",
      "args": ["-y", "payzu-mcp-pix"],
      "env": { "PAYZU_TOKEN": "..." }
    }
  }
}
```

## Configuration

| Env var | Required | Default | Description |
|---|---|---|---|
| `PAYZU_TOKEN` | yes | — | Bearer token from [abrirconta.payzu.com.br](https://abrirconta.payzu.com.br) |
| `PAYZU_API_URL` | no | `https://api.payzu.processamento.com/v1` | Override for whitelabel tenants |

## Tools

Each tool description links to the corresponding endpoint page in [docs.payzu.com.br](https://docs.payzu.com.br/docs/pix-processamento).

### Pix charges (4)
- `pix.create` — POST /pix
- `pix.get` — GET /pix
- `pix.qr_code` — GET /pix/qr-code/{id}
- `pix.proof` — GET /proof/{id}

### Withdrawals (6)
- `withdraw.create` — POST /withdraw (by Pix key)
- `withdraw.get` — GET /withdraw
- `withdraw.by_qr` — POST /withdraw/qrcode
- `withdraw.read_qr` — POST /pix/qrcode/read
- `withdraw.dict` — GET /pix-key/{key}
- `withdraw.proof` — GET /withdraw/proof/{id}

### Internal transfer (2)
- `internal_transfer.create` — POST /internal-transfer
- `internal_transfer.get` — GET /internal-transfer

### Account (2)
- `account.profile` — GET /user
- `account.balance` — GET /user/balance

### Reports (6)
- `reports.list_transactions` — GET /user/transactions
- `reports.get_transaction` — GET /user/transactions/{id}
- `reports.create_csv` — POST /user/report
- `reports.list_jobs` — GET /user/reports
- `reports.get_job` — GET /user/report/{id}
- `reports.download` — GET /user/report/{id}/download

### Callbacks (4)
- `callbacks.list` — GET /user/callbacks
- `callbacks.get` — GET /user/callback/{id}
- `callbacks.resend` — POST /user/callback/{id}/resend
- `callbacks.resend_bulk` — POST /user/callbacks/resend

### MED Infractions (5)
- `infractions.list` — GET /infractions
- `infractions.get` — GET /infractions/{id}
- `infractions.create_defense` — POST /infractions/{id}/defense
- `infractions.list_defenses` — GET /infractions/{id}/defenses
- `infractions.get_defense` — GET /infractions/{id}/defense/{defenseId}

## Conventions enforced

- **Amounts always in BRL decimals** (`99.90`, not `9990`). The MCP rejects centavos at input validation.
- **`clientReference` required** on all create operations for idempotency.
- **`callbackUrl` required** on creates so PayZu can notify when status changes.
- **Auto-retry** on 5xx/429 with exponential backoff + jitter (3 attempts max).
- **Errors include `requestId`** — log it and send to support if you need to investigate.

## Whitelabel tenants

If you're on PayEvo, Owem, Magen, E2ePay, Saq or PaySamba, set `PAYZU_API_URL` to your tenant's base URL:

```json
"env": {
  "PAYZU_TOKEN": "PE_...",
  "PAYZU_API_URL": "https://api.payevo.processamento.com/v1"
}
```

All 29 tools work identically — same engine, different brand.

## Links

- Documentation: https://docs.payzu.com.br/docs/pix-processamento
- OpenAPI: https://docs.payzu.com.br/openapi.json
- llms-full.txt: https://docs.payzu.com.br/pix-processamento/llms-full.txt
- SKILL.md (compact reference for AI): https://docs.payzu.com.br/pix-processamento/SKILL.md
- Issues: https://github.com/PayZuPlus/payzu-mcp/issues
- npm SDKs: `npm install payzu-pix`

## License

MIT
