import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });

    super({ adapter });
  }

  async onModuleInit() {
    this.logger.log('Initialize DB connection.');
    await this.$connect();
    this.logger.log('DB connected successfully.');
  }

  async onModuleDestroy() {
    this.logger.log('Closing DB connection.');
    await this.$disconnect();
    this.logger.log('DB connection closed.');
  }
}
