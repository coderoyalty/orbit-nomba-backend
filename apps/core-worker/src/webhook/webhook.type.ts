export const WebhookEventType = {
  SUBSCRIPTION_CREATED: 'subscription.created',
  SUBSCRIPTION_ACTIVE: 'subscription.active',
  SUBSCRIPTION_PAST_DUE: 'subscription.past_due',
  SUBSCRIPTION_CANCELED: 'subscription.canceled',
  PAYMENT_FAILED: 'invoice.failed',
} as const;
export type WebhookEventType =
  (typeof WebhookEventType)[keyof typeof WebhookEventType];
