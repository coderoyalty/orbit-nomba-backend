import { PrismaService } from '@app/database';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { QueueNames, SubscriptionJobs } from '@queue/queue';
import { Job } from 'bullmq';
import { SubscriptionService } from './subscription.service';

@Processor(QueueNames.SUBSCRIPTIONS)
export class SubscriptionProcessor extends WorkerHost {
  private readonly logger = new Logger(SubscriptionProcessor.name);

  constructor(private service: SubscriptionService) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`Processing job "${job.name}" (${job.id})`);

    switch (job.name) {
      case SubscriptionJobs.TRIAL:
        return await this.service.processTrial(job);

      case SubscriptionJobs.FIRST_PAYMENT:
        return await this.service.processFirstPayment(job);
      default:
        throw new Error(`Unknown job type: ${job.name}`);
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error) {
    this.logger.error(`Job ${job?.id} failed: ${error.message}`, error.stack);
  }
}
