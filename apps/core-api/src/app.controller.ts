import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { NombaService } from '@orbit/nomba';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private nombaService: NombaService,
  ) {}

  @Get()
  getHello() {
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
