import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { WebhookService } from './webhook.service';

import { NombaWebhookGuard } from '@orbit/nomba/guard/webhook.guard';
import * as nomba from '@orbit/nomba/dto/nomba.dto';

@Controller('webhook')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @UseGuards(NombaWebhookGuard)
  @Post('nomba')
  @HttpCode(HttpStatus.OK)
  handle(@Body() data: nomba.NombaWebhookPayload) {
    return this.webhookService.handleNomba(data);
  }
}
