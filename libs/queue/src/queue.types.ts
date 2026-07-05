import { EnvironmentType } from '@orbit/nomba';

export interface TrialSubscriptionJob {
  subscriptionId: string;
  environment: EnvironmentType;
  token: string;
  last4: string;
  brand: string;

  transaction: {
    id: string;
    amount: number;
  };
}
