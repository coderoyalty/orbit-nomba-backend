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
  async schedulerExpiredSubscriptionsRenewal() {
    const now = new Date();

    // 1. Sweep expired trials (status = trialing, trial_end <= now)
    const trialingSubscriptions = await this.prisma.subscription.findMany({
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
      `Running schedule for expired trials. No of expired trials to process: ${trialingSubscriptions.length}.`,
    );

    for (const subscription of trialingSubscriptions) {
      await this.queue.add(
        RenewalJobs.PROCESS_TRIAL,
        {
          subscriptionId: subscription.id,
        },
        {
          jobId: `renew-trial:${subscription.id}:${subscription.trial_end?.getTime()}`,
        },
      );
    }

    // 2. Sweep expired active subscriptions (status = active, current_period_end <= now)
    const activeSubscriptions = await this.prisma.subscription.findMany({
      where: {
        status: 'active',
        current_period_end: {
          lte: now,
        },
      },
      orderBy: {
        current_period_end: 'asc',
      },
    });

    this.logger.log(
      `Running schedule for expired active subscriptions. No to process: ${activeSubscriptions.length}.`,
    );

    for (const subscription of activeSubscriptions) {
      await this.queue.add(
        RenewalJobs.PROCESS_SUBSCRIPTION,
        {
          subscriptionId: subscription.id,
        },
        {
          jobId: `renew-active:${subscription.id}:${subscription.current_period_end?.getTime()}`,
        },
      );
    }
  }
}
