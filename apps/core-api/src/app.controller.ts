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

  @Get()
  getHello() {
    this.subDispatcher.dispatchTrial({
      brand: 'Verve',
      last4: '1234',
      subscriptionId: '',
      token: '',
    });
    return { message: 'Orbit — A Subscriptions Engine built on Nomba' };
  }

  @Get('/account/lookup')
  accountLookup(): any {
    return this.nombaService.accountLookup(
      { bankCode: '044', accountNumber: '1703986561' },
      'live',
    );
  }

  @Post('/account/checkout')
  async checkoutLink(@Body() body: any) {
    return this.nombaService.generateCheckoutLink(body, 'live');
  }

  @Get('/tokenized-cards')
  async tokenizedCard() {
    return this.nombaService.listTokenizeCards('test');
  }
}
