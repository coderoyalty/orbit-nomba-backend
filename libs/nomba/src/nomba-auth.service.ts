import {
  Global,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { config } from 'dotenv';

interface CachedToken {
  accessToken: string;
  expiresAt: number; // Timestamp in milliseconds
}

interface TokenIssueResponse {
  access_token: string;
  businessId: string;
  expiresAt: string;
}

@Injectable()
export class NombaAuthService {
  private accountId: string = '';
  private liveToken: CachedToken | null = null;
  private testToken: CachedToken | null = null;
  private url: string = '';

  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {
    this.accountId = configService.getOrThrow('NOMBA_ACCOUNT_ID');
    this.url = configService.getOrThrow('NOMBA_URL');
  }

  /**
   * Retrieves a valid token and account ID for the requested environment.
   */
  async getAuthContext(env: 'live' | 'test') {
    const cached = env === 'live' ? this.liveToken : this.testToken;

    const now = Date.now();
    const bufferWindow = 1000 * 60 * 5; // 5mins

    if (cached && cached.expiresAt > now + bufferWindow) {
      return { token: cached.accessToken };
    }

    const data = await this.exchangeCredentials(env);
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

    try {
      const { data: res } = await firstValueFrom(
        this.httpService.post<TokenIssueResponse>(
          `${this.url}/auth/token/issue`,
          data,
          {
            headers: {
              accountId: this.accountId,
            },
          },
        ),
      );

      const expiresAt = new Date(res.expiresAt).getTime();

      if (env === 'live') {
        this.liveToken = {
          accessToken: res.access_token,
          expiresAt,
        };
      } else {
        this.testToken = { accessToken: res.access_token, expiresAt };
      }
    } catch (err) {
      throw new InternalServerErrorException(
        `Failed to authenticate with Nomba API (${env === 'live' ? 'Live' : 'Test'})`,
      );
    }
  }
}
