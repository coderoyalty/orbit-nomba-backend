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
      await this.prisma.webhookEvent.update({
        where: {
          id: event.id,
        },
        data: {
          status: 'failed',
        },
      });
      return; // or throw error?
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

    const stringifiedBody = `${timestamp}:${webhookBody}`;

    const signature = crypto
      .createHmac('', endpoint.signing_secret)
      .update(stringifiedBody)
      .digest('hex');

    const headers = {
      'x-orbit-signature': signature,
      'x-orbit-timestamp': timestamp,
      'x-orbit-event-id': event.id,
      'x-orbit-event-type': event.type,
    };

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

    await this.prisma.webhookEvent.update({
      where: { id: event.id },
      data: {
        status: 'delivered',
        attempts: job.attemptsMade + 1,
      },
    });

    // sign payload
    // call webhook endpoint.
    // depending on the feedback, retry or update the event.
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
