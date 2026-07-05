import { Body, Get, Post } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { CurrentProject } from '../shared/decorators/current-project.decorator';
import * as database from '@app/database';
import { AddWebhookDto } from './webhooks.dto';
import { DashboardProjectController } from '../shared/decorators/dashboard.decorator';

@DashboardProjectController('webhooks')
export class WebhooksController {
  constructor(private service: WebhooksService) {}

  @Post()
  async createWebhook(
    @CurrentProject() project: database.Project,
    @Body() dto: AddWebhookDto,
  ) {
    const webhook = await this.service.upsertWebhook(project, dto);
    return webhook;
  }

  @Get()
  async getAll(@CurrentProject() project: database.Project) {
    return this.service.getAll(project);
  }
}
