import { ConflictException, Injectable } from '@nestjs/common';
import { AddWebhookDto } from './webhooks.dto';
import { PrismaService, Project } from '@app/database';

@Injectable()
export class WebhooksService {
  constructor(private prisma: PrismaService) {}

  async upsertWebhook(project: Project, dto: AddWebhookDto) {
    const webhook = await this.prisma.webhookEndpoint.upsert({
      where: {
        project_id_environment: {
          project_id: project.id,
          environment: dto.environment,
        },
      },
      update: {
        url: dto.url,
        signing_secret: dto.signing_secret,
      },
      create: {
        project_id: project.id,
        url: dto.url,
        signing_secret: dto.signing_secret,
        environment: dto.environment,
      },
    });

    return webhook;
  }

  async getAll(project: Project) {
    return await this.prisma.webhookEndpoint.findMany({
      where: {
        project_id: project.id,
      },
    });
  }
}
