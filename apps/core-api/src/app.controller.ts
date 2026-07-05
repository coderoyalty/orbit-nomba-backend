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
  async getHello() {
    const data = await this.nombaService.chargeCard(
      {
        order: {
          transaction_reference: '1234667812000',
          amount: 1,
          customer_email: 'akannie33@gmail.com',
          redirect_url: 'coderoyalty.outray.app',
        },
        token: '5185122670',
      },
      'live',
    );

    console.log(data);

    // return this.nombaService.verifyTransaction(
    //   { id: '1234567', type: 'orderReference' },
    //   'live',
    // );
    // return { message: 'Orbit — A Subscriptions Engine built on Nomba' };
  }

  @Get('/account/lookup')
  accountLookup(): any {
    return this.nombaService.accountLookup(
      { bankCode: '044', accountNumber: '1703986561' },
      'live',
    );
  }

  @Get('/verify-transaction')
  async verifyTransaction() {
    const data = await this.nombaService.verifyTransaction(
      { id: '1234667812000', type: 'orderReference' },
      'live',
    );

    return { nomba: data };
  }

  @Post('/account/checkout')
  async checkoutLink(@Body() body: any) {
    return this.nombaService.generateCheckoutLink(body, 'live');
  }

  @Get('/tokenized-cards')
  async tokenizedCard() {
    return this.nombaService.listTokenizeCards('live');
  }
}
