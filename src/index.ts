#!/usr/bin/env node

/**
 * Crypto Payer MCP Server
 *
 * MCP Server for integrating with Crypto Payer Solution API.
 * Provides tools for:
 * - Requesting payment sessions
 * - Generating authentication headers
 * - Verifying webhook signatures
 * - Building payment URLs
 */

import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { config as dotenvConfig } from 'dotenv';

// Load .env file from multiple possible locations
function loadEnvFile(): string | null {
  const envPaths = [
    // 1. Custom path from environment variable
    process.env.CRYPTO_PAYER_ENV_FILE,
    // 2. Current working directory
    join(process.cwd(), '.env'),
    // 3. Home directory with specific name
    join(homedir(), '.crypto-payer-mcp.env'),
    // 4. Home directory .config folder
    join(homedir(), '.config', 'crypto-payer-mcp', '.env'),
  ].filter(Boolean) as string[];

  for (const envPath of envPaths) {
    if (existsSync(envPath)) {
      dotenvConfig({ path: envPath });
      return envPath;
    }
  }

  // Fallback: try default dotenv behavior
  dotenvConfig();
  return null;
}

const loadedEnvPath = loadEnvFile();

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import {
  generateOperatorAuthorization,
  verifyWebhookSignature,
  validatePublicKey,
} from './crypto.js';
import type {
  CryptoPayerConfig,
  ApiResponse,
  RequestPaymentResponse,
  WebhookEvent,
} from './types.js';

// ============================================
// Configuration
// ============================================

function getConfig(): CryptoPayerConfig {
  const config: CryptoPayerConfig = {
    platformApiUrl:
      process.env.CRYPTO_PAYER_API_URL || 'https://dev-api.bclass-solution.com/v1',
    platformDomainUrl:
      process.env.CRYPTO_PAYER_DOMAIN_URL || 'https://dev-front.bclass-solution.com',
    operatorId: process.env.CRYPTO_PAYER_OPERATOR_ID || '',
    operatorSecretKey: process.env.CRYPTO_PAYER_SECRET_KEY || '',
    operatorPublicRsaKey: process.env.CRYPTO_PAYER_PUBLIC_KEY || '',
    operatorName: process.env.CRYPTO_PAYER_OPERATOR_NAME || '',
  };

  return config;
}

// ============================================
// Tool Definitions
// ============================================

const tools: Tool[] = [
  {
    name: 'request_payment',
    description: `Request a new payment session from Crypto Payer PLATFORM.
Returns a paymentId that can be used to construct the payment URL.
Requires user access token for authentication.`,
    inputSchema: {
      type: 'object',
      properties: {
        userAccessToken: {
          type: 'string',
          description: 'The user access token from OPERATOR system',
        },
      },
      required: ['userAccessToken'],
    },
  },
  {
    name: 'generate_auth_header',
    description: `Generate the X-Operator-Authorization header value for PLATFORM API requests.
Uses SHA-512 hash of operator credentials encoded in Base64.`,
    inputSchema: {
      type: 'object',
      properties: {
        operatorId: {
          type: 'string',
          description:
            'The operator ID (optional, uses env CRYPTO_PAYER_OPERATOR_ID if not provided)',
        },
        operatorSecretKey: {
          type: 'string',
          description:
            'The operator secret key (optional, uses env CRYPTO_PAYER_SECRET_KEY if not provided)',
        },
      },
      required: [],
    },
  },
  {
    name: 'verify_webhook',
    description: `Verify the signature of a webhook event from PLATFORM.
Uses RSA-SHA512 signature verification with the operator's public key.`,
    inputSchema: {
      type: 'object',
      properties: {
        signature: {
          type: 'string',
          description: 'The x-payer-signature header value from the webhook request',
        },
        webhookBody: {
          type: 'object',
          description: 'The complete webhook request body containing event and data',
          properties: {
            event: { type: 'string' },
            timestamp: { type: ['number', 'string'] },
            data: { type: 'object' },
          },
          required: ['event', 'data'],
        },
        publicKey: {
          type: 'string',
          description:
            'The public RSA key in PEM format (optional, uses env CRYPTO_PAYER_PUBLIC_KEY if not provided)',
        },
      },
      required: ['signature', 'webhookBody'],
    },
  },
  {
    name: 'build_payment_url',
    description: `Build the complete payment URL for redirecting users to the PLATFORM payment page.
Combines the platform domain with paymentId and operator information.`,
    inputSchema: {
      type: 'object',
      properties: {
        paymentId: {
          type: 'string',
          description: 'The payment ID received from request_payment',
        },
        operatorId: {
          type: 'string',
          description:
            'The operator ID (optional, uses env CRYPTO_PAYER_OPERATOR_ID if not provided)',
        },
        operatorName: {
          type: 'string',
          description:
            'The operator name (optional, uses env CRYPTO_PAYER_OPERATOR_NAME if not provided)',
        },
      },
      required: ['paymentId'],
    },
  },
  {
    name: 'parse_webhook_event',
    description: `Parse and extract information from a webhook event.
Returns structured data about the transaction including user, amount, network, and status.`,
    inputSchema: {
      type: 'object',
      properties: {
        webhookBody: {
          type: 'object',
          description: 'The complete webhook request body',
          properties: {
            event: { type: 'string' },
            timestamp: { type: ['number', 'string'] },
            data: { type: 'object' },
          },
          required: ['event', 'data'],
        },
      },
      required: ['webhookBody'],
    },
  },
  {
    name: 'get_config',
    description: `Get the current Crypto Payer configuration (with sensitive values masked).
Useful for debugging and verifying environment setup.`,
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

// ============================================
// Tool Input Schemas (Zod)
// ============================================

const RequestPaymentInputSchema = z.object({
  userAccessToken: z.string(),
});

const GenerateAuthHeaderInputSchema = z.object({
  operatorId: z.string().optional(),
  operatorSecretKey: z.string().optional(),
});

const VerifyWebhookInputSchema = z.object({
  signature: z.string(),
  webhookBody: z.object({
    event: z.string(),
    timestamp: z.union([z.number(), z.string()]),
    data: z.record(z.unknown()),
  }),
  publicKey: z.string().optional(),
});

const BuildPaymentUrlInputSchema = z.object({
  paymentId: z.string(),
  operatorId: z.string().optional(),
  operatorName: z.string().optional(),
});

const ParseWebhookEventInputSchema = z.object({
  webhookBody: z.object({
    event: z.string(),
    timestamp: z.union([z.number(), z.string()]),
    data: z.record(z.unknown()),
  }),
});

// ============================================
// Tool Handlers
// ============================================

async function handleRequestPayment(
  userAccessToken: string
): Promise<ApiResponse<RequestPaymentResponse>> {
  const config = getConfig();

  if (!config.operatorId || !config.operatorSecretKey) {
    return {
      result: false,
      errorCode: 'CONFIG_ERROR',
      message:
        'Missing operator credentials. Set CRYPTO_PAYER_OPERATOR_ID and CRYPTO_PAYER_SECRET_KEY',
    };
  }

  const authHeader = generateOperatorAuthorization(
    config.operatorId,
    config.operatorSecretKey
  );

  try {
    const response = await fetch(
      `${config.platformApiUrl}/operator/request-payment`,
      {
        method: 'GET',
        headers: {
          'X-Operator-Authorization': authHeader,
          'X-Operator-Id': config.operatorId,
          'X-User-Authorization': userAccessToken,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();
    return data as ApiResponse<RequestPaymentResponse>;
  } catch (error) {
    return {
      result: false,
      errorCode: 'NETWORK_ERROR',
      message: error instanceof Error ? error.message : 'Network request failed',
    };
  }
}

function handleGenerateAuthHeader(
  operatorId?: string,
  operatorSecretKey?: string
): { authHeader: string } | { error: string } {
  const config = getConfig();
  const id = operatorId || config.operatorId;
  const secret = operatorSecretKey || config.operatorSecretKey;

  if (!id || !secret) {
    return {
      error:
        'Missing operator credentials. Provide them as parameters or set environment variables.',
    };
  }

  return {
    authHeader: generateOperatorAuthorization(id, secret),
  };
}

function handleVerifyWebhook(
  signature: string,
  webhookBody: { event: string; data: Record<string, unknown> },
  publicKey?: string
): { isValid: boolean; event: string; message: string } {
  const config = getConfig();
  const key = publicKey || config.operatorPublicRsaKey;

  if (!key) {
    return {
      isValid: false,
      event: webhookBody.event,
      message: 'Missing public key. Provide it as parameter or set CRYPTO_PAYER_PUBLIC_KEY',
    };
  }

  const validatedKey = validatePublicKey(key);
  if (!validatedKey) {
    return {
      isValid: false,
      event: webhookBody.event,
      message: 'Invalid public key format. Must be PEM format.',
    };
  }

  const isValid = verifyWebhookSignature(validatedKey, signature, webhookBody.data);

  return {
    isValid,
    event: webhookBody.event,
    message: isValid ? 'Signature verified successfully' : 'Signature verification failed',
  };
}

function handleBuildPaymentUrl(
  paymentId: string,
  operatorId?: string,
  operatorName?: string
): { url: string; params: Record<string, string> } {
  const config = getConfig();
  const id = operatorId || config.operatorId;
  const name = operatorName || config.operatorName;

  const params = new URLSearchParams({
    paymentId,
    id: id || '',
    name: name || '',
  });

  const url = `${config.platformDomainUrl}?${params.toString()}`;

  return {
    url,
    params: {
      paymentId,
      id: id || '',
      name: name || '',
    },
  };
}

function handleParseWebhookEvent(webhookBody: WebhookEvent): {
  eventType: string;
  category: 'deposit' | 'withdraw';
  status: string;
  timestamp: string;
  user: { id: string; name: string } | null;
  transactionId: string | null;
  amount: { amount: string; currency: string; network: string } | null;
  blockchain: { txHash: string; explorerUrl: string } | null;
} {
  const event = webhookBody.event;
  const timestamp =
    typeof webhookBody.timestamp === 'number'
      ? new Date(webhookBody.timestamp).toISOString()
      : webhookBody.timestamp;

  const category = event.startsWith('DEPOSIT') ? 'deposit' : 'withdraw';
  const status = event.split('_').slice(1).join('_').toLowerCase();

  const user = webhookBody.data?.user
    ? {
        id: String(webhookBody.data.user.id),
        name: webhookBody.data.user.name,
      }
    : null;

  const result = webhookBody.data?.result;
  const transactionId = result?.id || null;

  let amount = null;
  let blockchain = null;

  if ('amount' in (result || {})) {
    const fullResult = result as {
      amount?: { amount: string };
      instrument?: { symbol: string };
      network?: { name: string };
      transactionHash?: string;
      explorerUrl?: string;
    };

    if (fullResult.amount) {
      amount = {
        amount: fullResult.amount.amount,
        currency: fullResult.instrument?.symbol || 'UNKNOWN',
        network: fullResult.network?.name || 'UNKNOWN',
      };
    }

    if (fullResult.transactionHash) {
      blockchain = {
        txHash: fullResult.transactionHash,
        explorerUrl: fullResult.explorerUrl || '',
      };
    }
  }

  return {
    eventType: event,
    category,
    status,
    timestamp,
    user,
    transactionId,
    amount,
    blockchain,
  };
}

function handleGetConfig(): {
  envFile: string;
  platformApiUrl: string;
  platformDomainUrl: string;
  operatorId: string;
  operatorSecretKey: string;
  operatorPublicRsaKey: string;
  operatorName: string;
  isConfigured: boolean;
} {
  const config = getConfig();

  return {
    envFile: loadedEnvPath || '(not found - using environment variables)',
    platformApiUrl: config.platformApiUrl,
    platformDomainUrl: config.platformDomainUrl,
    operatorId: config.operatorId ? `${config.operatorId.slice(0, 8)}...` : '(not set)',
    operatorSecretKey: config.operatorSecretKey ? '****' : '(not set)',
    operatorPublicRsaKey: config.operatorPublicRsaKey ? '(set)' : '(not set)',
    operatorName: config.operatorName || '(not set)',
    isConfigured: Boolean(
      config.operatorId && config.operatorSecretKey && config.operatorPublicRsaKey
    ),
  };
}

// ============================================
// MCP Server Setup
// ============================================

const server = new Server(
  {
    name: 'crypto-payer-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'request_payment': {
        const input = RequestPaymentInputSchema.parse(args);
        const result = await handleRequestPayment(input.userAccessToken);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'generate_auth_header': {
        const input = GenerateAuthHeaderInputSchema.parse(args);
        const result = handleGenerateAuthHeader(input.operatorId, input.operatorSecretKey);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'verify_webhook': {
        const input = VerifyWebhookInputSchema.parse(args);
        const result = handleVerifyWebhook(
          input.signature,
          input.webhookBody as { event: string; data: Record<string, unknown> },
          input.publicKey
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'build_payment_url': {
        const input = BuildPaymentUrlInputSchema.parse(args);
        const result = handleBuildPaymentUrl(
          input.paymentId,
          input.operatorId,
          input.operatorName
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'parse_webhook_event': {
        const input = ParseWebhookEventInputSchema.parse(args);
        const result = handleParseWebhookEvent(input.webhookBody as WebhookEvent);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'get_config': {
        const result = handleGetConfig();
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      content: [{ type: 'text', text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
});

// ============================================
// Start Server
// ============================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Crypto Payer MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
