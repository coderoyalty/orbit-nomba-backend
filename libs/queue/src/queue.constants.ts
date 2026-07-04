export const QueueNames = {
  SUBSCRIPTIONS: 'subscriptions',
  VERIFY: 'verifications',
  RENEWALS: 'renewals',
} as const;

export const SubscriptionJobs = {
  TRIAL: 'trial',
  FIRST_PAYMENT: 'first-payment',
  RENEW: 'renew',
  CHARGE_TRIAL: 'charge-trial',
} as const;
export type SubscriptionJobs =
  (typeof SubscriptionJobs)[keyof typeof SubscriptionJobs];

export const RenewalJobs = {
  TRIAL: 'renewal-trial',
  CHARGE_STATUS: 'verify-charge-status',
} as const;

export type RenewalJobs = (typeof RenewalJobs)[keyof typeof RenewalJobs];

export const VerifyJobs = {
  CHARGE_STATUS: 'verify-charge-status',
} as const;

export type VerifyJobs = (typeof VerifyJobs)[keyof typeof VerifyJobs];
