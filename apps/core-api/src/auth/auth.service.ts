import { PrismaService } from '@app/database';
import { ConflictException, Injectable } from '@nestjs/common';
import { CreateAccountDto } from './dto/create-account.dto';
import bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

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
}
