/**
 * Example: MCP Client Usage
 *
 * This demonstrates how to use the Crypto Payer MCP server
 * programmatically from a Node.js application.
 *
 * In practice, Claude Desktop or other MCP clients handle this automatically.
 * This example is for understanding the flow and testing.
 *
 * Run: npx ts-node examples/mcp-client-usage.ts
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

// ===========================================
// MCP Client Setup
// ===========================================

async function createMCPClient(): Promise<Client> {
  // Spawn the MCP server process
  const serverProcess = spawn('node', ['dist/index.js'], {
    env: {
      ...process.env,
      // You can set env vars here or use .env file
      // CRYPTO_PAYER_OPERATOR_ID: 'your-id',
      // CRYPTO_PAYER_SECRET_KEY: 'your-secret',
    },
  });

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/index.js'],
  });

  const client = new Client({
    name: 'example-client',
    version: '1.0.0',
  });

  await client.connect(transport);
  return client;
}

// ===========================================
// Example: Complete Payment Flow
// ===========================================

async function examplePaymentFlow() {
  console.log('='.repeat(60));
  console.log('Crypto Payer MCP - Payment Flow Example');
  console.log('='.repeat(60));

  const client = await createMCPClient();

  try {
    // Step 1: Check configuration
    console.log('\n📋 Step 1: Check configuration');
    const configResult = await client.callTool({
      name: 'get_config',
      arguments: {},
    });
    console.log('Config:', JSON.parse((configResult.content[0] as { text: string }).text));

    // Step 2: Request payment session
    console.log('\n💳 Step 2: Request payment session');
    const paymentResult = await client.callTool({
      name: 'request_payment',
      arguments: {
        userAccessToken: 'user-token-123', // From your auth system
      },
    });
    const paymentResponse = JSON.parse((paymentResult.content[0] as { text: string }).text);
    console.log('Payment response:', paymentResponse);

    if (paymentResponse.result && paymentResponse.data?.paymentId) {
      // Step 3: Build payment URL
      console.log('\n🔗 Step 3: Build payment URL');
      const urlResult = await client.callTool({
        name: 'build_payment_url',
        arguments: {
          paymentId: paymentResponse.data.paymentId,
        },
      });
      const urlResponse = JSON.parse((urlResult.content[0] as { text: string }).text);
      console.log('Payment URL:', urlResponse.url);
      console.log('\n→ Redirect user to this URL to complete payment');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

// ===========================================
// Example: Verify Webhook
// ===========================================

async function exampleWebhookVerification() {
  console.log('\n' + '='.repeat(60));
  console.log('Crypto Payer MCP - Webhook Verification Example');
  console.log('='.repeat(60));

  const client = await createMCPClient();

  try {
    // Example webhook payload (as received from PLATFORM)
    const webhookBody = {
      event: 'DEPOSIT_COMPLETED',
      timestamp: Date.now(),
      data: {
        user: {
          id: 'user_123',
          name: 'john_doe',
        },
        result: {
          id: 'tx_abc123',
          amount: {
            amount: '100.00',
            requestedAmount: '100.00',
            netAmount: '100.00',
          },
          network: {
            networkId: 'eth-mainnet',
            symbol: 'ETH',
            name: 'Ethereum',
          },
          instrument: {
            symbol: 'USDT',
            name: 'Tether USD',
            contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          },
          transactionHash: '0xabc123...',
          explorerUrl: 'https://etherscan.io/tx/0xabc123...',
        },
      },
    };

    // Verify webhook signature
    console.log('\n🔐 Verifying webhook signature...');
    const verifyResult = await client.callTool({
      name: 'verify_webhook',
      arguments: {
        signature: 'example-base64-signature', // From x-payer-signature header
        webhookBody,
      },
    });
    console.log('Verification result:', JSON.parse((verifyResult.content[0] as { text: string }).text));

    // Parse webhook event
    console.log('\n📦 Parsing webhook event...');
    const parseResult = await client.callTool({
      name: 'parse_webhook_event',
      arguments: {
        webhookBody,
      },
    });
    const parsed = JSON.parse((parseResult.content[0] as { text: string }).text);
    console.log('Parsed event:', parsed);

    console.log(`
📊 Event Summary:
   Type: ${parsed.eventType}
   Category: ${parsed.category}
   Status: ${parsed.status}
   User: ${parsed.user?.name} (${parsed.user?.id})
   Amount: ${parsed.amount?.amount} ${parsed.amount?.currency}
   Network: ${parsed.amount?.network}
   TX Hash: ${parsed.blockchain?.txHash}
`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

// ===========================================
// Example: Generate Auth Header
// ===========================================

async function exampleAuthHeader() {
  console.log('\n' + '='.repeat(60));
  console.log('Crypto Payer MCP - Auth Header Generation Example');
  console.log('='.repeat(60));

  const client = await createMCPClient();

  try {
    // Generate auth header using .env credentials
    console.log('\n🔑 Generating X-Operator-Authorization header...');
    const result = await client.callTool({
      name: 'generate_auth_header',
      arguments: {},
    });
    const authResponse = JSON.parse((result.content[0] as { text: string }).text);

    if (authResponse.authHeader) {
      console.log('Auth header generated successfully!');
      console.log('Header value:', authResponse.authHeader.substring(0, 50) + '...');
      console.log(`
Use this header in your API requests to PLATFORM:
  headers: {
    'X-Operator-Authorization': '${authResponse.authHeader.substring(0, 30)}...',
    'X-Operator-Id': 'your-operator-id',
    'X-User-Authorization': 'user-access-token'
  }
`);
    } else {
      console.log('Error:', authResponse.error);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

// ===========================================
// Run Examples
// ===========================================

async function main() {
  const args = process.argv.slice(2);
  const example = args[0] || 'all';

  switch (example) {
    case 'payment':
      await examplePaymentFlow();
      break;
    case 'webhook':
      await exampleWebhookVerification();
      break;
    case 'auth':
      await exampleAuthHeader();
      break;
    case 'all':
    default:
      await examplePaymentFlow();
      await exampleWebhookVerification();
      await exampleAuthHeader();
  }
}

main().catch(console.error);
