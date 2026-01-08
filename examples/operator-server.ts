/**
 * Example: OPERATOR API Server
 *
 * This is a sample implementation of the OPERATOR API endpoints
 * that must be provided for Crypto Payer PLATFORM integration.
 *
 * Required endpoints:
 * - GET /authenticate - Verify user belongs to OPERATOR
 * - GET /user/balance - Get user's balance
 * - POST /notify - Receive webhook notifications
 *
 * Run: npx ts-node examples/operator-server.ts
 */

import express, { Request, Response, NextFunction } from 'express';
import { createVerify } from 'crypto';

const app = express();
app.use(express.json());

// ===========================================
// Configuration
// ===========================================

const PORT = process.env.PORT || 3000;

// Public key from PLATFORM for webhook signature verification
const PLATFORM_PUBLIC_KEY = process.env.PLATFORM_PUBLIC_KEY || `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA0+6wd9OJQpK60ZI7qnZG
...your-public-key-here...
-----END PUBLIC KEY-----`;

// ===========================================
// Mock Database (replace with real DB)
// ===========================================

interface User {
  id: number;
  name: string;
  email: string;
  balance: string;
  accessToken: string;
}

const users: Map<string, User> = new Map([
  ['user-token-123', {
    id: 1,
    name: 'john_doe',
    email: 'john@example.com',
    balance: '1000.00',
    accessToken: 'user-token-123'
  }],
  ['user-token-456', {
    id: 2,
    name: 'jane_smith',
    email: 'jane@example.com',
    balance: '2500.50',
    accessToken: 'user-token-456'
  }]
]);

// ===========================================
// Helper Functions
// ===========================================

function getUserByToken(token: string): User | undefined {
  return users.get(token);
}

function verifyWebhookSignature(
  publicKey: string,
  signature: string,
  data: unknown
): boolean {
  try {
    const message = JSON.stringify(data);
    const verifier = createVerify('RSA-SHA512');
    verifier.write(message);
    verifier.end();
    return verifier.verify(publicKey, signature, 'base64');
  } catch {
    return false;
  }
}

// ===========================================
// Middleware: Extract Bearer Token
// ===========================================

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

// ===========================================
// API Endpoints
// ===========================================

/**
 * GET /authenticate
 *
 * PLATFORM calls this endpoint to verify that a user belongs to OPERATOR.
 * Returns user information if the access token is valid.
 */
app.get('/authenticate', (req: Request, res: Response) => {
  const token = extractBearerToken(req);

  if (!token) {
    return res.status(401).json({
      result: false,
      errorCode: 'OPERATOR_USER_ERROR_401',
      message: 'User unauthorized. Missing or invalid token.'
    });
  }

  const user = getUserByToken(token);

  if (!user) {
    return res.status(401).json({
      result: false,
      errorCode: 'OPERATOR_USER_ERROR_401',
      message: 'User unauthorized. Invalid token.'
    });
  }

  // Return user data to PLATFORM
  res.json({
    result: true,
    data: {
      userId: user.id,
      userName: user.name,
      userEmail: user.email
    }
  });
});

/**
 * GET /user/balance
 *
 * PLATFORM calls this endpoint to check user's balance
 * before allowing withdrawal requests.
 */
app.get('/user/balance', (req: Request, res: Response) => {
  const token = extractBearerToken(req);

  if (!token) {
    return res.status(401).json({
      result: false,
      errorCode: 'OPERATOR_USER_ERROR_401',
      message: 'User unauthorized. Missing or invalid token.'
    });
  }

  const user = getUserByToken(token);

  if (!user) {
    return res.status(401).json({
      result: false,
      errorCode: 'OPERATOR_USER_ERROR_401',
      message: 'User unauthorized. Invalid token.'
    });
  }

  res.json({
    result: true,
    data: {
      userId: user.id,
      userName: user.name,
      balance: user.balance
    }
  });
});

/**
 * POST /notify
 *
 * PLATFORM calls this endpoint to notify OPERATOR about
 * transaction events (deposits, withdrawals).
 */
app.post('/notify', (req: Request, res: Response) => {
  const signature = req.headers['x-payer-signature'] as string;

  if (!signature) {
    console.error('[Webhook] Missing signature header');
    return res.status(401).json({
      result: false,
      errorCode: 'SIGNATURE_MISSING',
      message: 'Missing x-payer-signature header'
    });
  }

  // Verify webhook signature
  const { event, data } = req.body;
  const isValid = verifyWebhookSignature(PLATFORM_PUBLIC_KEY, signature, data);

  if (!isValid) {
    console.error('[Webhook] Invalid signature');
    return res.status(401).json({
      result: false,
      errorCode: 'SIGNATURE_INVALID',
      message: 'Invalid webhook signature'
    });
  }

  // Process the webhook event
  console.log(`[Webhook] Received event: ${event}`);
  console.log('[Webhook] Data:', JSON.stringify(data, null, 2));

  // Handle different event types
  switch (event) {
    case 'DEPOSIT_PROCESSING':
      console.log(`[Deposit] Processing deposit for user ${data.user.id}`);
      break;

    case 'DEPOSIT_COMPLETED':
      console.log(`[Deposit] Completed! User ${data.user.id} deposited ${data.result.amount?.amount}`);
      // TODO: Update user balance in your database
      // updateUserBalance(data.user.id, data.result.amount.amount, 'add');
      break;

    case 'WITHDRAW_REQUESTED':
      console.log(`[Withdraw] User ${data.user.id} requested withdrawal of ${data.result.amount?.amount}`);
      break;

    case 'WITHDRAW_APPROVED':
      console.log(`[Withdraw] Withdrawal ${data.result.id} approved`);
      break;

    case 'WITHDRAW_COMPLETED':
      console.log(`[Withdraw] Completed! User ${data.user.id} withdrew ${data.result.amount?.amount}`);
      // TODO: Update user balance in your database
      // updateUserBalance(data.user.id, data.result.amount.amount, 'subtract');
      break;

    case 'WITHDRAW_REJECTED':
      console.log(`[Withdraw] Withdrawal ${data.result.id} rejected`);
      // TODO: Refund the reserved balance
      break;

    case 'WITHDRAW_FAILED':
      console.log(`[Withdraw] Withdrawal ${data.result.id} failed`);
      // TODO: Refund the reserved balance
      break;

    default:
      console.log(`[Webhook] Unknown event: ${event}`);
  }

  // Always respond with 'ok' to acknowledge receipt
  res.send('ok');
});

// ===========================================
// Error Handler
// ===========================================

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[Error]', err);
  res.status(500).json({
    result: false,
    errorCode: 'INTERNAL_SERVER_ERROR',
    message: 'Server encountered an unexpected condition.'
  });
});

// ===========================================
// Start Server
// ===========================================

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║         Crypto Payer OPERATOR Server (Sample)            ║
╠══════════════════════════════════════════════════════════╣
║  Endpoints:                                              ║
║  • GET  /authenticate  - Verify user token               ║
║  • GET  /user/balance  - Get user balance                ║
║  • POST /notify        - Receive webhooks                ║
╠══════════════════════════════════════════════════════════╣
║  Test tokens:                                            ║
║  • user-token-123 (john_doe, balance: 1000.00)          ║
║  • user-token-456 (jane_smith, balance: 2500.50)        ║
╚══════════════════════════════════════════════════════════╝

Server running on http://localhost:${PORT}
  `);
});

export default app;
