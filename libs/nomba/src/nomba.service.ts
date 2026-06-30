import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { NombaAuthService } from './nomba-auth.service';
import { EnvironmentType } from './types';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

interface AccountLookupResponse {
  accountName: string;
  accountNumber: string;
}

interface AccountLookupPayload {
  bankCode: string;
  accountNumber: string;
}

export interface CheckoutPayload {
  transaction_reference: string; // The incomplete Prisma Subscription ID
  amount: number; // Ensure this is in the lowest denomination (e.g., Kobo)
  customer_email: string;
  redirect_url: string;
}

@Injectable()
export class NombaService {
  private logger = new Logger();

  constructor(
    private readonly nombaAuth: NombaAuthService,
    private http: HttpService,
  ) {}

  async accountLookup(
    payload: AccountLookupPayload,
    env: EnvironmentType,
  ): Promise<AccountLookupResponse> {
    try {
      const config = await this.requestConfig(env, '/transfers/bank/lookup');

      const { data } = await firstValueFrom(
        this.http.post(config.url, payload, {
          headers: { ...config.header },
        }),
      );

      return data.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        console.log(error.request);

        switch (error.response?.status) {
          case 400:
            throw new BadRequestException(error.response?.data);

          case 401:
            throw new UnauthorizedException();

          case 404:
            throw new NotFoundException("Account number doesn't exist.");

          default:
            throw new InternalServerErrorException(
              'Unable to complete account lookup.',
            );
        }
      }

      throw new InternalServerErrorException(
        'Unable to complete account lookup.',
      );
    }
  }

  async generateCheckoutLink(payload: CheckoutPayload, env: EnvironmentType) {
    const config = await this.requestConfig(env, '/checkout/order');

    const orderPayload = {
      order: {
        orderReference: payload.transaction_reference,
        customerEmail: payload.customer_email,
        amount: payload.amount.toString(),
        currency: 'NGN',
        callbackUrl: payload.redirect_url,
        allowedPaymentMethods: ['Card'],
      },
      tokenizeCard: 'true',
    };

    try {
      const res = await firstValueFrom(
        this.http.post(config.url, orderPayload, {
          headers: { ...config.header },
        }),
      );
      return res;
    } catch (error) {
      console.log((error as AxiosError).message);
      throw error;
    }
  }

  async listTokenizeCards(env: EnvironmentType) {
    const config = await this.requestConfig(
      env,
      '/checkout/tokenized-card-data',
    );

    const { data } = await firstValueFrom(
      this.http.get(config.url, {
        headers: {
          ...config.header,
        },
      }),
    );

    return data;
  }

  private async requestConfig(env: EnvironmentType, endpoint: string = '') {
    const ctx = await this.nombaAuth.getAuthContext(env);

    const headerPayload = {
      Authorization: `Bearer ${ctx.token}`,
      accountId: ctx.accountId,
    };

    const baseUrl = this.nombaAuth.getUrl(env);

    const fullUrl = new URL(
      endpoint.replace(/^\/+/, ''),
      baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`,
    ).toString();

    return {
      header: headerPayload,
      url: fullUrl,
    };
  }
}
