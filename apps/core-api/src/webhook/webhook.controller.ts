import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { WebhookService } from './webhook.service';

import { type Request, type Response } from 'express';
import { NombaWebhookGuard } from '@orbit/nomba/guard/webhook.guard';

@Controller('webhook')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @UseGuards(NombaWebhookGuard)
  @Post('nomba')
  handle(@Body() data: any) {
    console.log(data);
  }
}
