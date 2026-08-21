# Razorpay Remote MCP (Cursor) — local only

**Do not commit** API secrets or base64 merchant tokens.

Use this to let the Cursor agent inspect Razorpay **Test Mode** payments/orders.
Product runtime still uses **tenant Model B keys** (AURELIA Admin / `DEMO_RAZORPAY_*` in `backend/.env`).

Docs: [Razorpay Remote MCP](https://razorpay.com/docs/mcp-server/remote/)

## 1. Encode merchant token (local shell)

```bash
echo -n 'rzp_test_YOUR_KEY:YOUR_SECRET' | base64
```

## 2. Add to Cursor user MCP config

Typical path: `~/.cursor/mcp.json` (user-level, not this repo).

Use streamable HTTP endpoint **`https://mcp.razorpay.com/mcp`** (not deprecated `/sse`):

```json
{
  "mcpServers": {
    "razorpay": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://mcp.razorpay.com/mcp",
        "--header",
        "Authorization: Basic ${RAZORPAY_MERCHANT_TOKEN}"
      ],
      "env": {
        "RAZORPAY_MERCHANT_TOKEN": "<paste-base64-token-here>"
      }
    }
  }
}
```

Exact Cursor field names may vary by Cursor version — follow the **Cursor** section on the Razorpay Remote MCP page if the shape differs.

## 3. Restart Cursor

Ask: **Show me available Razorpay tools**

## Security

- Test Mode keys only until go-live.
- Never paste Key Secret into git, docs, or agent transcripts again if avoidable; rotate if exposed.
- Webhook URL for local: `ngrok` → `POST /api/public/webhooks/razorpay` (optional; Checkout `pay/confirm` works without it).
