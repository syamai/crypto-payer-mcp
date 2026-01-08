/**
 * Crypto Payer MCP Server - Cryptographic Utilities
 * Handles authentication header generation and webhook signature verification
 */

import { createHash, createVerify } from 'crypto';

/**
 * Generate SHA-512 hash of a value
 * @param value - The string value to hash
 * @returns Hexadecimal hash string
 */
export function toSha512Hash(value: string): string {
  return createHash('sha512').update(value, 'utf-8').digest('hex');
}

/**
 * Generate X-Operator-Authorization header value
 * Used for authenticating requests to the PLATFORM API
 *
 * @param operatorId - The operator ID provided by PLATFORM
 * @param operatorSecretKey - The operator secret key provided by PLATFORM
 * @returns The authorization header value (e.g., "Basic xxx...")
 *
 * @example
 * ```typescript
 * const authHeader = generateOperatorAuthorization(
 *   '260f52c4-927b-46ff-46ff-32305f8e3a0c',
 *   'taF7MpUtCN6Wf51FocrKPlERfSamiWt7pJynC57mVFEUic8vPHTBdfpPggQGlylB'
 * );
 * // Returns: "Basic <base64-encoded-sha512-hash>"
 * ```
 */
export function generateOperatorAuthorization(
  operatorId: string,
  operatorSecretKey: string
): string {
  const hashInput = `${operatorId}:${operatorSecretKey}`;
  const hash = toSha512Hash(hashInput);
  const base64Encoded = Buffer.from(hash, 'utf8').toString('base64');
  return `Basic ${base64Encoded}`;
}

/**
 * Verify webhook signature using RSA-SHA512
 * Used to validate that webhook events came from the PLATFORM
 *
 * @param publicKey - The operator's public RSA key (PEM format)
 * @param signature - The signature from x-payer-signature header (base64)
 * @param data - The data object from the webhook body to verify
 * @returns true if signature is valid, false otherwise
 *
 * @example
 * ```typescript
 * const isValid = verifyWebhookSignature(
 *   publicKeyPem,
 *   req.headers['x-payer-signature'],
 *   req.body.data
 * );
 * ```
 */
export function verifyWebhookSignature(
  publicKey: string,
  signature: string,
  data: unknown
): boolean {
  try {
    if (typeof signature !== 'string' || !signature) {
      return false;
    }

    const message = JSON.stringify(data);
    const verifier = createVerify('RSA-SHA512');
    verifier.write(message);
    verifier.end();

    return verifier.verify(publicKey, signature, 'base64');
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return false;
  }
}

/**
 * Parse and validate a PEM-formatted public key
 * @param pemKey - The PEM-formatted public key string
 * @returns The cleaned PEM key or null if invalid
 */
export function validatePublicKey(pemKey: string): string | null {
  try {
    // Normalize line endings and remove extra whitespace
    const normalizedKey = pemKey
      .replace(/\\n/g, '\n')
      .replace(/\r\n/g, '\n')
      .trim();

    // Check for PEM format markers
    if (
      !normalizedKey.includes('-----BEGIN PUBLIC KEY-----') ||
      !normalizedKey.includes('-----END PUBLIC KEY-----')
    ) {
      return null;
    }

    return normalizedKey;
  } catch {
    return null;
  }
}
