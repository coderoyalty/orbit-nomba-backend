import { PrismaService } from '@app/database';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CreateAccountDto } from './dto/create-account.dto';
import bcrypt from 'bcrypt';
import { LoginAccountDto } from './dto/login-account.dto';
import { ConfigService } from '@nestjs/config';
import { JWT_SECRET_NAME } from './constants';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async create(dto: CreateAccountDto) {
    const existing = await this.prisma.account.findFirst({
      where: {
        email: dto.email,
      },
    });

    if (existing) {
      throw new ConflictException('Email address already in use.');
    }

    const salt = 10;
    const password_hash = await bcrypt.hash(dto.password, salt);
    const newAccount = await this.prisma.account.create({
      data: {
        name: dto.name,
        email: dto.email.toLowerCase(),
        password_hash: password_hash,
      },
      omit: { password_hash: true },
    });

    return newAccount;
  }

  async validateAccount(dto: LoginAccountDto) {
    const account = await this.prisma.account.findUnique({
      where: { email: dto.email },
    });

    if (!account) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(dto.password, account.password_hash);

    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { password_hash, ...result } = account;

    return result;
  }

  async generateToken(accountId: string, email: string) {
    const payload = { sub: accountId, email };

    const secret = this.config.getOrThrow<string>(JWT_SECRET_NAME);
    const key = this.jwtService.sign(payload, {
      secret,
    });
    return key;
  }
}
