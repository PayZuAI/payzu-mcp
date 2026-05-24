# payzu-mcp-conta-digital

MCP server for the [PayZu Conta Digital](https://docs.payzu.com.br/docs/conta-digital) API. Plugs into Claude Desktop, Cursor, Continue, and other MCP-compatible AI clients.

**14 tools** spanning Pix deposits, withdrawals (Pix key, bank data, TED, QR, internal transfer), and account management (balance, profile, statement, summary).

## Install

### Claude Desktop / Continue

`~/Library/Application Support/Claude/claude_desktop_config.json` (or Windows equivalent):

```json
{
  "mcpServers": {
    "payzu-conta-digital": {
      "command": "npx",
      "args": ["-y", "payzu-mcp-conta-digital"],
      "env": {
        "PAYZU_TOKEN": "<your-bearer-token>"
      }
    }
  }
}
```

### Cursor

`.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "payzu-conta-digital": {
      "command": "npx",
      "args": ["-y", "payzu-mcp-conta-digital"],
      "env": { "PAYZU_TOKEN": "..." }
    }
  }
}
```

## Configuration

| Env var | Required | Default | Description |
|---|---|---|---|
| `PAYZU_TOKEN` | yes | — | Bearer token from [abrirconta.payzu.com.br](https://abrirconta.payzu.com.br) |
| `PAYZU_HUB_API_URL` | no | `https://pix.payzu.io/v1` | Conta Digital base URL |

## Tools

### Deposits (4)
- `deposits.create_pix` — POST /pix
- `deposits.get_pix` — GET /pix/{id}
- `deposits.proof` — GET /proof/{id}
- `deposits.refund` — POST /pix/refund/{id}

### Withdrawals (6)
- `withdraw.by_pix_key` — POST /withdraw (chave Pix)
- `withdraw.by_bank_data` — POST /withdraw/bank-data
- `withdraw.ted` — POST /ted
- `withdraw.by_qr` — POST /withdraw/qrcode
- `withdraw.internal_transfer` — POST /internal-transfer
- `withdraw.proof` — GET /proof/{id}

### Account (4)
- `account.balance` — GET /user/balance
- `account.profile` — GET /user
- `account.transactions` — GET /user/transactions
- `account.summary` — GET /user/summary

## Conventions

- Amounts in **BRL decimals** (`99.90`, never `9990`).
- `clientReference` required on creates for idempotency.
- `callbackUrl` HTTPS público, responde 2xx em 5s, dedupe por `id + status`.
- Auto-retry on 5xx/429 with backoff (3 attempts).
- Errors include `requestId`.

## Conta Digital vs Pix Processamento

Use Conta Digital se você precisa de **conta bancária completa** (Pix + TED + transferência interna + cartão + saldo + extrato).
Use [payzu-mcp-pix](https://www.npmjs.com/package/payzu-mcp-pix) se você precisa de **alto volume de Pix puro** com MED, callbacks API e relatórios CSV assíncronos.

## Links

- Documentation: https://docs.payzu.com.br/docs/conta-digital
- OpenAPI: https://docs.payzu.com.br/openapi/payzu-conta-digital-api.json
- llms-full.txt: https://docs.payzu.com.br/conta-digital/llms-full.txt
- SKILL.md: https://docs.payzu.com.br/conta-digital/SKILL.md
- Issues: https://github.com/PayZuPlus/payzu-mcp/issues

## License

MIT
