import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { NombaService } from '@orbit/nomba';
import { SubscriptionDispatcher } from '@queue/queue/subscription-dispatcher.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private nombaService: NombaService,
    private subDispatcher: SubscriptionDispatcher,
  ) {}
}
