export const QueueNames = {
  SUBSCRIPTIONS: 'subscriptions',
  VERIFY: 'verifications',
  RENEWALS: 'renewals',
  WEBHOOK: 'outbound-webhook',
} as const;

export const SubscriptionJobs = {
  TRIAL: 'subscription-trial',
  FIRST_PAYMENT: 'first-payment',
} as const;
export type SubscriptionJobs =
  (typeof SubscriptionJobs)[keyof typeof SubscriptionJobs];

export const RenewalJobs = {
  TRIAL: 'renewal-trial',
  RENEW: 'renew-subscription',
  CHARGE_STATUS: 'verify-charge-status',
} as const;

export type RenewalJobs = (typeof RenewalJobs)[keyof typeof RenewalJobs];

export const WebhookJobs = {
  DISPATCH: 'dispatch',
};
