/**
 * Crypto Payer MCP Server - Type Definitions
 * Based on the Crypto Payer Solution API documentation
 */

// ============================================
// Configuration Types
// ============================================

export interface CryptoPayerConfig {
  /** PLATFORM API base URL */
  platformApiUrl: string;
  /** PLATFORM domain URL for payment UI */
  platformDomainUrl: string;
  /** Operator ID provided by PLATFORM */
  operatorId: string;
  /** Operator secret key for authentication */
  operatorSecretKey: string;
  /** Public RSA key for webhook signature verification */
  operatorPublicRsaKey: string;
  /** Operator name for display */
  operatorName: string;
}

// ============================================
// API Response Types
// ============================================

export interface ApiSuccessResponse<T> {
  result: true;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  result: false;
  errorCode: string;
  message: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ============================================
// Authentication Types
// ============================================

export interface AuthenticateResponse {
  userId: number | string;
  userName: string;
  userEmail: string;
}

// ============================================
// Balance Types
// ============================================

export interface UserBalanceResponse {
  userId: number | string;
  userName: string;
  balance: string;
}

// ============================================
// Payment Types
// ============================================

export interface RequestPaymentResponse {
  paymentId: string;
}

export interface PaymentUrlParams {
  paymentId: string;
  operatorId: string;
  operatorName: string;
}

// ============================================
// Webhook Event Types
// ============================================

export type WebhookEventType =
  | 'DEPOSIT_PROCESSING'
  | 'DEPOSIT_COMPLETED'
  | 'WITHDRAW_REQUESTED'
  | 'WITHDRAW_REJECTED'
  | 'WITHDRAW_APPROVED'
  | 'WITHDRAW_PENDING'
  | 'WITHDRAW_PROCESSING'
  | 'WITHDRAW_COMPLETED'
  | 'WITHDRAW_FAILED';

export interface WebhookUser {
  id: string;
  name: string;
}

export interface WebhookBlock {
  blockHeight?: string;
  blockHash?: string;
}

export interface WebhookFee {
  networkFee?: string;
  gasPrice?: string;
}

export interface WebhookAmount {
  amount: string;
  requestedAmount: string;
  netAmount?: string;
  amountUSD?: string | null;
}

export interface WebhookNetwork {
  networkId: string;
  symbol: string;
  name: string;
}

export interface WebhookInstrument {
  symbol: string;
  name: string;
  contractAddress: string;
}

export interface WebhookResultFull {
  id: string;
  block?: WebhookBlock;
  fee?: WebhookFee;
  amount?: WebhookAmount;
  network?: WebhookNetwork;
  instrument?: WebhookInstrument;
  from?: string;
  to?: string;
  transactionHash?: string;
  explorerUrl?: string;
}

export interface WebhookResultMinimal {
  id: string;
}

export interface WebhookEventBase {
  event: WebhookEventType;
  timestamp: number | string;
}

export interface WebhookEventWithFullResult extends WebhookEventBase {
  event:
    | 'DEPOSIT_PROCESSING'
    | 'DEPOSIT_COMPLETED'
    | 'WITHDRAW_REQUESTED'
    | 'WITHDRAW_PROCESSING'
    | 'WITHDRAW_COMPLETED';
  data: {
    user: WebhookUser;
    result: WebhookResultFull;
  };
}

export interface WebhookEventWithMinimalResult extends WebhookEventBase {
  event:
    | 'WITHDRAW_REJECTED'
    | 'WITHDRAW_APPROVED'
    | 'WITHDRAW_PENDING'
    | 'WITHDRAW_FAILED';
  data: {
    user: WebhookUser;
    result: WebhookResultMinimal;
  };
}

export type WebhookEvent = WebhookEventWithFullResult | WebhookEventWithMinimalResult;

// ============================================
// Error Codes
// ============================================

export const ErrorCodes = {
  OPERATOR_ERROR_400: 'Bad request',
  OPERATOR_ERROR_401: 'Application unauthorized',
  OPERATOR_USER_ERROR_401: 'User unauthorized',
  OPERATOR_ERROR_403: 'Application does not have permission',
  OPERATOR_USER_ERROR_403: 'Application user does not have permission',
  OPERATOR_ERROR_404: 'Operator not found',
  INTERNAL_SERVER_ERROR: 'Server encountered an unexpected condition',
} as const;

export type ErrorCode = keyof typeof ErrorCodes;
