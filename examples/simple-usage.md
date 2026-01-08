# Simple Usage Guide

## Claude Desktop에서 MCP 사용하기

### Step 1: .env 파일 생성

```bash
# ~/.crypto-payer-mcp.env 파일 생성
cat > ~/.crypto-payer-mcp.env << 'EOF'
CRYPTO_PAYER_OPERATOR_ID=your-operator-id
CRYPTO_PAYER_SECRET_KEY=your-secret-key
CRYPTO_PAYER_OPERATOR_NAME=Your Company
CRYPTO_PAYER_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA...
-----END PUBLIC KEY-----"
EOF
```

### Step 2: Claude Desktop 설정

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "crypto-payer": {
      "command": "npx",
      "args": ["-y", "crypto-payer-mcp"]
    }
  }
}
```

### Step 3: Claude에게 요청하기

Claude Desktop을 재시작한 후, 다음과 같이 요청하세요:

---

**설정 확인:**
> "Crypto Payer 설정을 확인해줘"

**결제 요청:**
> "사용자 토큰 'user-abc-123'으로 결제 세션을 요청해줘"

**결제 URL 생성:**
> "결제 ID 'payment-xyz-789'로 결제 URL을 만들어줘"

**Webhook 검증:**
> "이 webhook 이벤트가 유효한지 확인해줘:
> ```json
> {
>   "event": "DEPOSIT_COMPLETED",
>   "timestamp": 1746776884590,
>   "data": { ... }
> }
> ```
> 서명: abc123signature..."

**Webhook 파싱:**
> "이 webhook 이벤트를 파싱해서 어떤 일이 일어났는지 알려줘"

---

## 프로그래밍 방식으로 사용하기

### Node.js에서 MCP 도구 호출

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function main() {
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['-y', 'crypto-payer-mcp'],
  });

  const client = new Client({ name: 'my-app', version: '1.0.0' });
  await client.connect(transport);

  // 설정 확인
  const config = await client.callTool({
    name: 'get_config',
    arguments: {},
  });
  console.log(config);

  // 결제 요청
  const payment = await client.callTool({
    name: 'request_payment',
    arguments: { userAccessToken: 'user-token-123' },
  });
  console.log(payment);

  await client.close();
}
```

## 전체 연동 플로우

```
1. 사용자가 "입금" 버튼 클릭
   ↓
2. OPERATOR 서버가 MCP로 request_payment 호출
   ↓
3. PLATFORM이 OPERATOR의 /authenticate 호출하여 사용자 확인
   ↓
4. paymentId 반환
   ↓
5. MCP로 build_payment_url 호출하여 URL 생성
   ↓
6. 사용자를 해당 URL로 리다이렉트
   ↓
7. 사용자가 암호화폐 입금 완료
   ↓
8. PLATFORM이 OPERATOR의 /notify로 webhook 전송
   ↓
9. MCP로 verify_webhook 호출하여 서명 검증
   ↓
10. MCP로 parse_webhook_event 호출하여 이벤트 파싱
   ↓
11. 사용자 잔액 업데이트
```

## Webhook 이벤트 처리 예제

```typescript
// Express.js webhook endpoint
app.post('/notify', async (req, res) => {
  const signature = req.headers['x-payer-signature'];

  // MCP로 서명 검증
  const verifyResult = await mcpClient.callTool({
    name: 'verify_webhook',
    arguments: {
      signature,
      webhookBody: req.body,
    },
  });

  const { isValid } = JSON.parse(verifyResult.content[0].text);

  if (!isValid) {
    return res.status(401).send('Invalid signature');
  }

  // MCP로 이벤트 파싱
  const parseResult = await mcpClient.callTool({
    name: 'parse_webhook_event',
    arguments: { webhookBody: req.body },
  });

  const event = JSON.parse(parseResult.content[0].text);

  // 이벤트 타입에 따라 처리
  switch (event.eventType) {
    case 'DEPOSIT_COMPLETED':
      await updateUserBalance(event.user.id, event.amount.amount, 'add');
      break;
    case 'WITHDRAW_COMPLETED':
      await updateUserBalance(event.user.id, event.amount.amount, 'subtract');
      break;
  }

  res.send('ok');
});
```
