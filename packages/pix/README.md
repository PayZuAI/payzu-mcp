# payzu-mcp-pix

MCP server for the [PayZu Pix Processamento](https://docs.payzu.com.br/docs/pix-processamento) API. Plugs into Antigravity, Claude Code, Claude Desktop, Cursor, Windsurf, and any other MCP-compatible AI client to let the assistant call PayZu's Pix API directly with typed tools.

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
| `PAYZU_TOKEN` | yes | — | Bearer token from the dashboard: [Processamento](https://web.payzu.processamento.com/credentials) or [Hub](https://hub.payzu.com.br/settings/tokens) |
| `PAYZU_API_URL` | no | `https://api.payzu.processamento.com/v1` | Override for whitelabel tenants |

## Revoking access

The hosted server issues stateless OAuth tokens that wrap your API token, so there is no server-side session to delete. To cut off a connected client, rotate your API token in the dashboard ([Processamento](https://web.payzu.processamento.com/credentials) / [Hub](https://hub.payzu.com.br/settings/tokens)) — every issued token stops working at the API on the next call.

## Tools

Each tool description links to the corresponding endpoint page in [docs.payzu.com.br](https://docs.payzu.com.br/docs/pix-processamento).

### Pix charges (4)
- `pix_create` — POST /pix
- `pix_get` — GET /pix
- `pix_qr_code` — GET /pix/qr-code/{transactionId}
- `pix_proof` — GET /proof/{id}

### Withdrawals (6)
- `withdraw_create` — POST /withdraw (by Pix key)
- `withdraw_get` — GET /withdraw
- `withdraw_by_qr` — POST /withdraw/qrcode
- `withdraw_read_qr` — POST /pix/qrcode/read
- `withdraw_dict` — GET /pix/key?pixKey={key}
- `withdraw_proof` — GET /withdraw/proof/{id}

### Internal transfer (2)
- `internal_transfer_create` — POST /internal-transfer
- `internal_transfer_get` — GET /internal-transfer

### Account (2)
- `account_profile` — GET /user
- `account_balance` — GET /user/balance

### Reports (6)
- `reports_list_transactions` — GET /user/transactions
- `reports_get_transaction` — GET /user/transactions/{id}
- `reports_create_csv` — POST /user/report
- `reports_list_jobs` — GET /user/report
- `reports_get_job` — GET /user/report/{id}
- `reports_download` — POST /user/report/{id}/download

### Callbacks (4)
- `callbacks_list` — GET /user/callbacks
- `callbacks_get` — GET /user/callbacks/{id}
- `callbacks_resend` — POST /user/callbacks/resend/{transactionId}
- `callbacks_resend_bulk` — POST /user/callbacks/resend

### MED Infractions (5)
- `infractions_list` — GET /user/infractions
- `infractions_get` — GET /user/infractions/{id}
- `infractions_create_defense` — POST /user/infractions/{id}/defenses (multipart)
- `infractions_list_defenses` — GET /user/infractions/{id}/defenses
- `infractions_get_defense` — GET /user/infractions/{id}/defenses/{defenseId}

## Breaking change in 0.3.0

Tool names moved from dots to underscores (`pix.create` -> `pix_create`). Dots are rejected by the Anthropic and OpenAI APIs (`^[a-zA-Z0-9_-]{1,64}$`), which silently broke every MCP client backed by those models. Update any tool allowlists that reference the old names. This release also fixes the request body of `withdraw_read_qr` (`emv`), `internal_transfer_create` (`payerAccountNumber`/`receiverAccountNumber`) and `infractions_create_defense` (multipart `defense` + `files`).

## Conventions enforced

- **Amounts always in BRL decimals** (`99.90`, not `9990`). The MCP rejects centavos at input validation.
- **`clientReference` required** on all create operations for idempotency.
- **`callbackUrl` required** on creates so PayZu can notify when status changes.
- **Auto-retry** on 5xx/429 with exponential backoff + jitter (3 attempts max).
- **Errors include `errorCode` and `requestId`** — log them and send to support if you need to investigate.

## Custom base URL

If your account uses a custom Pix Processamento endpoint, override the default via env:

```json
"env": {
  "PAYZU_TOKEN": "<your-token>",
  "PAYZU_API_URL": "https://api.example.processamento.com/v1"
}
```

All 29 tools work identically against any compatible endpoint.

## Links

- Documentation: https://docs.payzu.com.br/docs/pix-processamento
- OpenAPI: https://docs.payzu.com.br/openapi.json
- llms-full.txt: https://docs.payzu.com.br/pix-processamento/llms-full.txt
- Issues: https://github.com/PayZuAI/payzu-mcp/issues
- npm SDKs: `npm install payzu-pix`

## License

MIT
