export type NombaEventType =
  | 'payment_success'
  | 'virtual_account.funded'
  | 'transfer.success'
  | 'transfer.failed'
  | 'mandate.debit_success'
  | 'payout_success'
  | 'payment_failed'
  | 'payment_reversal'
  | 'payout_failed'
  | 'payout_refund';

export interface NombaWebhookPayload {
  event_type: NombaEventType;
  requestId: string;
  data: NombaWebhookData;
}

export interface NombaWebhookData {
  merchant: Merchant;
  terminal: Record<string, unknown>;
  tokenizedCardData: TokenizedCardData;
  transaction: Transaction;
  customer: Customer;
  order: Order;
}

export interface Merchant {
  walletId: string;
  walletBalance: number;
  userId: string;
}

export interface TokenizedCardData {
  tokenKey: string;
  cardType: string;
  tokenExpiryYear: string;
  tokenExpiryMonth: string;
  cardPan: string;
}

export interface Transaction {
  fee: number;
  type: string;
  transactionId: string;
  cardIssuer: string;
  responseCode: string;
  originatingFrom: string;
  merchantTxRef: string;
  transactionAmount: number;
  time: string; // ISO 8601 timestamp
}

export interface Customer {
  billerId: string;
  productId: string;
}

export interface Order {
  amount: number;
  orderId: string;
  cardType: string;
  orderMetaData: OrderMetaData;
  accountId: string;
  cardLast4Digits: string;
  cardCurrency: string;
  customerEmail: string;
  isTokenizedCardPayment: string; // Consider changing to boolean if the API always returns a boolean
  orderReference: string;
  paymentMethod: string;
  callbackUrl: string;
  currency: string;
}

export interface OrderMetaData {
  region: string;
}
