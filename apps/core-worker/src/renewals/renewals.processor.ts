import { Processor, WorkerHost } from '@nestjs/bullmq';
import { QueueNames } from '@queue/queue';
import { Job } from 'bullmq';
import { RenewalsService } from './renewals.service';
import { Logger } from '@nestjs/common';
import { RenewalJobs } from '@queue/queue';

@Processor(QueueNames.RENEWALS)
export class RenewalsProcessor extends WorkerHost {
  private readonly logger = new Logger(RenewalsProcessor.name);

  constructor(private service: RenewalsService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name as RenewalJobs) {
      case RenewalJobs.PROCESS_TRIAL:
        await this.service.processTrialSubscriptionRenewal(job);
        break;
      case RenewalJobs.PROCESS_SUBSCRIPTION:
        await this.service.processSubscriptionRenewal(job);
        break;
      case RenewalJobs.PROCESS_DUNNING:
        await this.service.processDunningRetry(job);
        break;
      case RenewalJobs.CHARGE_STATUS:
        await this.service.processChargeStatus(job);
        break;
      default:
        this.logger.error(`Unknown job type: ${job.name}`);
        throw new Error(`Unknown job type: ${job.name}`);
    }
  }
}
