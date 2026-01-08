# Crypto Payer MCP Server

[![npm version](https://badge.fury.io/js/crypto-payer-mcp.svg)](https://www.npmjs.com/package/crypto-payer-mcp)
[![CI](https://github.com/anthropics/crypto-payer-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/anthropics/crypto-payer-mcp/actions/workflows/ci.yml)

MCP (Model Context Protocol) Server for [Crypto Payer Solution](https://bclass-solution.com) - cryptocurrency payment integration.

## Quick Start

### Using npx (Recommended)

```bash
npx crypto-payer-mcp
```

### Global Installation

```bash
npm install -g crypto-payer-mcp
crypto-payer-mcp
```

## Claude Desktop Configuration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "crypto-payer": {
      "command": "npx",
      "args": ["-y", "crypto-payer-mcp"],
      "env": {
        "CRYPTO_PAYER_OPERATOR_ID": "your-operator-id",
        "CRYPTO_PAYER_SECRET_KEY": "your-secret-key",
        "CRYPTO_PAYER_PUBLIC_KEY": "-----BEGIN PUBLIC KEY-----\nMIICIjAN...\n-----END PUBLIC KEY-----",
        "CRYPTO_PAYER_OPERATOR_NAME": "Your Operator Name"
      }
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `request_payment` | Request a new payment session from PLATFORM |
| `generate_auth_header` | Generate X-Operator-Authorization header |
| `verify_webhook` | Verify webhook signature (RSA-SHA512) |
| `build_payment_url` | Build payment page URL |
| `parse_webhook_event` | Parse webhook event data |
| `get_config` | Get current configuration (masked) |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CRYPTO_PAYER_OPERATOR_ID` | Yes | Operator ID from PLATFORM |
| `CRYPTO_PAYER_SECRET_KEY` | Yes | Secret key from PLATFORM |
| `CRYPTO_PAYER_PUBLIC_KEY` | Yes | RSA public key for webhook verification |
| `CRYPTO_PAYER_OPERATOR_NAME` | Yes | Your operator display name |
| `CRYPTO_PAYER_API_URL` | No | API URL (default: testnet) |
| `CRYPTO_PAYER_DOMAIN_URL` | No | Domain URL (default: testnet) |

## API Endpoints

| Environment | API URL | Domain URL |
|-------------|---------|------------|
| **Testnet** | `https://dev-api.bclass-solution.com/v1` | `https://dev-front.bclass-solution.com` |
| **Mainnet** | `https://api.bclass-solution.com/v1` | `https://bclass-solution.com` |

## Usage Examples

### 1. Request Payment

```
Tool: request_payment
Input: { "userAccessToken": "user-jwt-token-from-your-system" }

Output: {
  "result": true,
  "data": { "paymentId": "eGrtTN7mIHTtd0uNLGnPweKtz2qXcVoq" }
}
```

### 2. Build Payment URL

```
Tool: build_payment_url
Input: { "paymentId": "eGrtTN7mIHTtd0uNLGnPweKtz2qXcVoq" }

Output: {
  "url": "https://dev-front.bclass-solution.com?paymentId=eGrtTN7mIHTtd0uNLGnPweKtz2qXcVoq&id=xxx&name=xxx"
}
```

### 3. Verify Webhook

```
Tool: verify_webhook
Input: {
  "signature": "base64-signature-from-header",
  "webhookBody": {
    "event": "DEPOSIT_COMPLETED",
    "timestamp": 1746776884590,
    "data": { "user": {...}, "result": {...} }
  }
}

Output: { "isValid": true, "event": "DEPOSIT_COMPLETED", "message": "Signature verified" }
```

### 4. Parse Webhook Event

```
Tool: parse_webhook_event
Input: {
  "webhookBody": {
    "event": "DEPOSIT_COMPLETED",
    "timestamp": 1746776884590,
    "data": {
      "user": { "id": "user_123", "name": "john" },
      "result": {
        "id": "tx_abc",
        "amount": { "amount": "100", ... },
        "instrument": { "symbol": "USDT", ... }
      }
    }
  }
}

Output: {
  "eventType": "DEPOSIT_COMPLETED",
  "category": "deposit",
  "status": "completed",
  "user": { "id": "user_123", "name": "john" },
  "amount": { "amount": "100", "currency": "USDT", "network": "Ethereum" }
}
```

## Supported Webhook Events

### Deposit Events
- `DEPOSIT_PROCESSING` - Deposit is being processed
- `DEPOSIT_COMPLETED` - Deposit completed successfully

### Withdraw Events
- `WITHDRAW_REQUESTED` - Withdrawal requested by user
- `WITHDRAW_REJECTED` - Withdrawal rejected by admin
- `WITHDRAW_APPROVED` - Withdrawal approved by admin
- `WITHDRAW_PENDING` - Withdrawal pending
- `WITHDRAW_PROCESSING` - Withdrawal being processed
- `WITHDRAW_COMPLETED` - Withdrawal completed
- `WITHDRAW_FAILED` - Withdrawal failed

## Development

```bash
# Clone the repository
git clone https://github.com/anthropics/crypto-payer-mcp.git
cd crypto-payer-mcp

# Install dependencies
npm install

# Build
npm run build

# Run locally
npm start
```

## License

MIT - see [LICENSE](LICENSE)
