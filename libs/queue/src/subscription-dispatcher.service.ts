import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { QueueNames, SubscriptionJobs } from './queue.constants';
import { Queue } from 'bullmq';
import { TrialSubscriptionJob } from './queue.types';

@Injectable()
export class SubscriptionDispatcher {
  constructor(
    @InjectQueue(QueueNames.SUBSCRIPTIONS)
    private readonly queue: Queue,
  ) {}

  async dispatchTrial(job: TrialSubscriptionJob) {
    return this.queue.add(SubscriptionJobs.TRIAL, job, {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: 100,
      removeOnFail: 1000,
    });
  }

  async dispatchFirstPayment(job: TrialSubscriptionJob) {
    return this.queue.add(SubscriptionJobs.FIRST_PAYMENT, job, {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: 100,
      removeOnFail: 1000,
    });
  }
}
