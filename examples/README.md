# Crypto Payer MCP - Examples

## Overview

This directory contains example implementations for integrating with Crypto Payer Solution using the MCP server.

## Files

| File | Description |
|------|-------------|
| `operator-server.ts` | Sample OPERATOR API server (Express.js) |
| `mcp-client-usage.ts` | MCP client usage examples |

## 1. OPERATOR Server Example

The `operator-server.ts` file shows how to implement the required OPERATOR API endpoints that PLATFORM will call:

### Required Endpoints

```
GET  /authenticate   - Verify user token, return user info
GET  /user/balance   - Return user's balance
POST /notify         - Receive webhook notifications
```

### Run the Server

```bash
# Install dependencies
npm install express

# Run the server
npx ts-node examples/operator-server.ts

# Or with node
npx tsc examples/operator-server.ts
node examples/operator-server.js
```

### Test Endpoints

```bash
# Test authenticate
curl -H "Authorization: Bearer user-token-123" http://localhost:3000/authenticate

# Test balance
curl -H "Authorization: Bearer user-token-123" http://localhost:3000/user/balance

# Test webhook (without signature verification)
curl -X POST http://localhost:3000/notify \
  -H "Content-Type: application/json" \
  -H "x-payer-signature: test-signature" \
  -d '{"event":"DEPOSIT_COMPLETED","data":{"user":{"id":"1","name":"test"}}}'
```

## 2. MCP Client Usage Example

The `mcp-client-usage.ts` file demonstrates how to use the MCP server programmatically.

### Run Examples

```bash
# Run all examples
npx ts-node examples/mcp-client-usage.ts

# Run specific example
npx ts-node examples/mcp-client-usage.ts payment
npx ts-node examples/mcp-client-usage.ts webhook
npx ts-node examples/mcp-client-usage.ts auth
```

## Integration Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   OPERATOR      │     │   MCP Server    │     │    PLATFORM     │
│   (Your Site)   │     │ (crypto-payer)  │     │ (Crypto Payer)  │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │ 1. User clicks        │                       │
         │    "Deposit/Withdraw" │                       │
         │──────────────────────>│                       │
         │                       │                       │
         │                       │ 2. request_payment    │
         │                       │──────────────────────>│
         │                       │                       │
         │                       │ 3. authenticate       │
         │<──────────────────────│<──────────────────────│
         │                       │                       │
         │ 4. Return user data   │                       │
         │──────────────────────>│──────────────────────>│
         │                       │                       │
         │                       │ 5. Return paymentId   │
         │                       │<──────────────────────│
         │                       │                       │
         │ 6. build_payment_url  │                       │
         │<──────────────────────│                       │
         │                       │                       │
         │ 7. Redirect user to   │                       │
         │    payment URL        │                       │
         │───────────────────────────────────────────────>│
         │                       │                       │
         │                       │                       │ 8. User completes
         │                       │                       │    transaction
         │                       │                       │
         │ 9. Webhook notify     │                       │
         │<──────────────────────────────────────────────│
         │                       │                       │
         │ 10. verify_webhook    │                       │
         │──────────────────────>│                       │
         │                       │                       │
         │ 11. Update balance    │                       │
         │    in database        │                       │
         │                       │                       │
```

## Claude Desktop Integration

When using Claude Desktop, the MCP client is handled automatically. You just need to:

1. Configure `.env` file with your credentials
2. Add MCP server to Claude Desktop config
3. Ask Claude to help with Crypto Payer operations

### Example Prompts for Claude

```
"Check my Crypto Payer configuration"

"Request a new payment session for user token abc123"

"Build a payment URL for payment ID xyz789"

"Verify this webhook signature: [paste signature]"

"Parse this webhook event and tell me what happened: [paste event]"
```
