import { PrismaService } from '@app/database';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { QueueNames, RenewalJobs } from '@queue/queue';
import { Queue } from 'bullmq';

@Injectable()
export class RenewalsScheduler {
  private readonly logger = new Logger(RenewalsScheduler.name);
  constructor(
    private prisma: PrismaService,
    @InjectQueue(QueueNames.RENEWALS)
    private readonly queue: Queue,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async scheduleExpiredTrials() {
    const now = new Date();

    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        status: 'trialing',
        trial_end: {
          lte: now,
        },
      },
      orderBy: {
        trial_end: 'asc',
      },
    });

    this.logger.log(
      `Running schedule for expired trials. No of expired subscriptions to process: ${subscriptions.length}.`,
    );

    for (const subscription of subscriptions) {
      this.queue.add(
        RenewalJobs.TRIAL,
        {
          subscriptionId: subscription.id,
        },
        {
          jobId: `renew:${subscription.id}:${subscription.trial_end?.getTime()}`,
        },
      );
    }
  }
}
