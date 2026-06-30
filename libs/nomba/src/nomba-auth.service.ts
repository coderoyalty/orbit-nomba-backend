import {
  Global,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { config } from 'dotenv';
import { EnvironmentType } from './types';

interface CachedToken {
  accessToken: string;
  expiresAt: number; // Timestamp in milliseconds
}

interface TokenIssueResponse {
  data: { access_token: string; businessId: string; expiresAt: string };
}

@Injectable()
export class NombaAuthService {
  private logger = new Logger();

  public readonly accountId: string = '';
  public readonly subAccountId: string = '';
  private liveToken: CachedToken | null = null;
  private testToken: CachedToken | null = null;
  private readonly url: string = '';
  private readonly sandboxUrl: string = '';

  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {
    this.accountId = configService.getOrThrow('NOMBA_ACCOUNT_ID');
    this.subAccountId = configService.getOrThrow('NOMBA_SUB_ACCOUNT_ID');
    this.url = configService.getOrThrow('NOMBA_URL');
    this.sandboxUrl = configService.getOrThrow('NOMBA_SANDBOX_URL');
  }

  /**
   * Retrieves a valid token and account ID for the requested environment.
   */

  async getAuthContext(env: EnvironmentType) {
    const cached = env === 'live' ? this.liveToken : this.testToken;

    const now = Date.now();
    const bufferWindow = 1000 * 60 * 5; // 5mins

    if (cached && cached.expiresAt > now + bufferWindow) {
      return {
        token: cached.accessToken,
        accountId: this.accountId,
        subAccountId: this.subAccountId,
      };
    }

    await this.exchangeCredentials(env);

    const token = env === 'live' ? this.liveToken : this.testToken;

    return {
      token: token!.accessToken,
      accountId: this.accountId,
      subAccountId: this.subAccountId,
    };
  }

  /**
   * Executes the OAuth 2.0 client_credentials flow
   */

  private async exchangeCredentials(env: 'live' | 'test') {
    const clientId =
      env === 'live'
        ? this.configService.getOrThrow('NOMBA_LIVE_CLIENT_ID')
        : this.configService.getOrThrow('NOMBA_TEST_CLIENT_ID');

    const clientSecret =
      env === 'live'
        ? this.configService.getOrThrow('NOMBA_LIVE_PRIVATE_KEY')
        : this.configService.getOrThrow('NOMBA_TEST_PRIVATE_KEY');

    const data = { grant_type: 'client_credentials', clientId, clientSecret };
    const url = this.getUrl(env);

    const endpoint = `${url}/auth/token/issue`;

    try {
      const { data: res } = await firstValueFrom(
        this.httpService.post<TokenIssueResponse>(endpoint, data, {
          headers: {
            accountId: this.accountId,
          },
        }),
      );

      const expiresAt = new Date(res.data.expiresAt).getTime();

      if (env === 'live') {
        this.liveToken = {
          accessToken: res.data.access_token,
          expiresAt,
        };
      } else {
        this.testToken = { accessToken: res.data.access_token, expiresAt };
      }
    } catch (error) {
      this.logger.error(`Failed to authenticate with Nomba API (${env}).`);

      throw error;
    }
  }

  getUrl(env: EnvironmentType) {
    if (env === 'live') {
      return this.url;
    } else {
      return this.sandboxUrl;
    }
  }
}
