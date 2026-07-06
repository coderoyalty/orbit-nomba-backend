import { PrismaService } from '@app/database';
import { HttpService } from '@nestjs/axios';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { QueueNames } from '@queue/queue';
import { DispatchWebhookPayload } from '@queue/queue/webhook.dispatcher';
import { Job } from 'bullmq';
import crypto from 'node:crypto';
import { firstValueFrom } from 'rxjs';

@Processor(QueueNames.WEBHOOK)
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(
    private prisma: PrismaService,
    private httpService: HttpService,
  ) {
    super();
  }

  async process(job: Job<DispatchWebhookPayload>): Promise<void> {
    const data = job.data;
    this.logger.log(
      `Processing Webhook Job: Event ID=${data.webhookEventId}, Attempt=${job.attemptsMade + 1}`,
    );

    const event = await this.prisma.webhookEvent.findUniqueOrThrow({
      where: { id: data.webhookEventId },
      include: {
        project: {
          include: { webhooks: true },
        },
      },
    });

    const endpoint = event.project.webhooks.find(
      (value) => value.environment === event.environment,
    );

    if (!endpoint) {
      this.logger.warn(
        `No webhook endpoint configured for event ID=${event.id}, environment=${event.environment}, project ID=${event.project_id}`,
      );
      await this.prisma.webhookEvent.update({
        where: {
          id: event.id,
        },
        data: {
          status: 'failed',
        },
      });
      return;
    }

    await this.prisma.webhookEvent.update({
      where: { id: event.id },
      data: {
        status: 'processing',
        attempts: job.attemptsMade + 1,
        last_attempt_at: new Date(),
      },
    });

    //construct the payload

    const webhookBody = {
      event_type: event.type,
      data: event.payload,
    };

    const timestamp = event.createdAt.toString();

    const stringifiedBody = `${timestamp}:${JSON.stringify(webhookBody)}`;

    const signature = crypto
      .createHmac('sha256', endpoint.signing_secret)
      .update(stringifiedBody)
      .digest('hex');

    const headers = {
      'x-orbit-signature': signature,
      'x-orbit-timestamp': timestamp,
      'x-orbit-event-id': event.id,
      'x-orbit-event-type': event.type,
    };

    this.logger.log(
      `Dispatching webhook event=${event.type} to url=${endpoint.url}`,
    );

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          endpoint.url,
          { ...webhookBody },
          {
            timeout: 20_000,
            headers: {
              'Content-Type': 'application/json',
              ...headers,
            },
          },
        ),
      );

      this.logger.log(
        `Webhook event=${event.id} successfully delivered. Status=${response.status}`,
      );

      await this.prisma.webhookEvent.update({
        where: { id: event.id },
        data: {
          status: 'delivered',
          attempts: job.attemptsMade + 1,
        },
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to deliver webhook event=${event.id} to url=${endpoint.url}. Error=${errMsg}`,
      );
      throw error;
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<DispatchWebhookPayload>) {
    if (job.attemptsMade < (job.opts.attempts ?? 1)) {
      return;
    }

    await this.prisma.webhookEvent.update({
      where: {
        id: job.data.webhookEventId,
      },
      data: {
        status: 'failed',
        attempts: job.attemptsMade,
      },
    });
  }
}
