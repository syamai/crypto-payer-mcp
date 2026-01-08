/**
 * Example: MCP Tool Usage
 *
 * This demonstrates how to call MCP tools directly using JSON-RPC.
 * In practice, Claude Desktop handles this automatically.
 *
 * Run: npm run example:client
 */

import { spawn } from 'child_process';
import { createInterface } from 'readline';

// ===========================================
// MCP JSON-RPC Helper
// ===========================================

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

class MCPClient {
  private process: ReturnType<typeof spawn>;
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }>();

  constructor() {
    this.process = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const rl = createInterface({ input: this.process.stdout! });
    rl.on('line', (line) => {
      try {
        const response: JsonRpcResponse = JSON.parse(line);
        const pending = this.pendingRequests.get(response.id);
        if (pending) {
          this.pendingRequests.delete(response.id);
          if (response.error) {
            pending.reject(new Error(response.error.message));
          } else {
            pending.resolve(response.result);
          }
        }
      } catch {
        // Ignore non-JSON lines (like stderr messages)
      }
    });
  }

  async request(method: string, params?: Record<string, unknown>): Promise<unknown> {
    const id = ++this.requestId;
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.process.stdin!.write(JSON.stringify(request) + '\n');
    });
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const result = await this.request('tools/call', {
      name,
      arguments: args,
    }) as { content: Array<{ type: string; text: string }> };

    if (result.content?.[0]?.text) {
      return JSON.parse(result.content[0].text);
    }
    return result;
  }

  async listTools(): Promise<unknown> {
    return this.request('tools/list');
  }

  close() {
    this.process.kill();
  }
}

// ===========================================
// Example Functions
// ===========================================

async function example1_CheckConfig(client: MCPClient) {
  console.log('\n' + '='.repeat(50));
  console.log('Example 1: Check Configuration');
  console.log('='.repeat(50));

  const config = await client.callTool('get_config');
  console.log('\nConfiguration:');
  console.log(JSON.stringify(config, null, 2));
}

async function example2_GenerateAuthHeader(client: MCPClient) {
  console.log('\n' + '='.repeat(50));
  console.log('Example 2: Generate Auth Header');
  console.log('='.repeat(50));

  const result = await client.callTool('generate_auth_header');
  console.log('\nAuth Header:');
  console.log(JSON.stringify(result, null, 2));
}

async function example3_BuildPaymentUrl(client: MCPClient) {
  console.log('\n' + '='.repeat(50));
  console.log('Example 3: Build Payment URL');
  console.log('='.repeat(50));

  const result = await client.callTool('build_payment_url', {
    paymentId: 'test-payment-id-12345',
  });
  console.log('\nPayment URL:');
  console.log(JSON.stringify(result, null, 2));
}

async function example4_ParseWebhookEvent(client: MCPClient) {
  console.log('\n' + '='.repeat(50));
  console.log('Example 4: Parse Webhook Event');
  console.log('='.repeat(50));

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
        transactionHash: '0xabc123def456...',
        explorerUrl: 'https://etherscan.io/tx/0xabc123def456...',
      },
    },
  };

  const result = await client.callTool('parse_webhook_event', { webhookBody });
  console.log('\nParsed Event:');
  console.log(JSON.stringify(result, null, 2));
}

async function example5_VerifyWebhook(client: MCPClient) {
  console.log('\n' + '='.repeat(50));
  console.log('Example 5: Verify Webhook Signature');
  console.log('='.repeat(50));

  const webhookBody = {
    event: 'DEPOSIT_COMPLETED',
    timestamp: Date.now(),
    data: {
      user: { id: 'user_123', name: 'john_doe' },
      result: { id: 'tx_abc123' },
    },
  };

  const result = await client.callTool('verify_webhook', {
    signature: 'invalid-test-signature',
    webhookBody,
  });
  console.log('\nVerification Result:');
  console.log(JSON.stringify(result, null, 2));
}

// ===========================================
// Main
// ===========================================

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║     Crypto Payer MCP - Client Usage Examples     ║');
  console.log('╚══════════════════════════════════════════════════╝');

  const client = new MCPClient();

  // Wait for server to initialize
  await new Promise(resolve => setTimeout(resolve, 1000));

  try {
    await example1_CheckConfig(client);
    await example2_GenerateAuthHeader(client);
    await example3_BuildPaymentUrl(client);
    await example4_ParseWebhookEvent(client);
    await example5_VerifyWebhook(client);

    console.log('\n' + '='.repeat(50));
    console.log('All examples completed!');
    console.log('='.repeat(50));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.close();
  }
}

main();
