import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { NombaAuthService } from './nomba-auth.service';
import { EnvironmentType, NombaSuccessResponse } from './types';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom } from 'rxjs';
import axios, { AxiosError } from 'axios';

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

type AsyncFn<TResult> = () => Promise<TResult>;

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

  async generateCheckoutLink(
    payload: CheckoutPayload,
    env: EnvironmentType,
    meta?: Record<string, string>,
  ) {
    const config = await this.requestConfig(env, '/checkout/order');

    const orderPayload = {
      order: {
        orderReference: payload.transaction_reference,
        customerEmail: payload.customer_email,
        amount: payload.amount.toString(),
        currency: 'NGN',
        callbackUrl: payload.redirect_url,
        allowedPaymentMethods: ['Card'],
        accountId: this.nombaAuth.subAccountId,
      },
      tokenizeCard: 'true',
      meta,
    };

    try {
      const res = await firstValueFrom(
        this.http.post(config.url, orderPayload, {
          headers: { ...config.header },
        }),
      );
      return res.data;
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

  async refundTransaction<T>(transactionId: string, env: EnvironmentType) {
    const config = await this.requestConfig(env, '/checkout/refund');

    const { data } = await this.execute(async () => {
      const data = await firstValueFrom(
        this.http.post<T>(
          config.url,
          { transactionId },
          {
            headers: { ...config.header },
          },
        ),
      );

      return data;
    });

    return data;
  }

  async verifyTransaction<T>(
    transaction: {
      id: string;
      type: 'orderReference' | 'transactionRef';
    },
    env: EnvironmentType,
  ): Promise<T> {
    const config = await this.requestConfig(
      env,
      `/transactions/accounts/${this.nombaAuth.subAccountId}/single`,
    );

    return this.execute(async () => {
      const { data } = await firstValueFrom(
        this.http.get<T>(config.url, {
          params: {
            [transaction.type]: transaction.id,
          },
          headers: config.header,
        }),
      );

      return data;
    });
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

  private async execute<TResult>(fn: AsyncFn<TResult>): Promise<TResult> {
    try {
      return await fn();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        this.mapAxiosError(err);
      }

      throw err;
    }
  }

  private mapAxiosError(error: AxiosError): never {
    switch (error.response?.status) {
      case 400:
        throw new BadRequestException(error.response.data);

      case 401:
        throw new UnauthorizedException();

      case 404:
        throw new NotFoundException();

      default:
        throw new InternalServerErrorException();
    }
  }
}
