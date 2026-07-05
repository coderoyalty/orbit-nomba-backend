import { Environment, PrismaService } from '@app/database';
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import crypto from 'node:crypto';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async create(accountId: string, dto: CreateProjectDto) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId },
    });

    if (!account) {
      throw new UnauthorizedException('Cannot create project');
    }

    const project = await this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        account: { connect: account },
      },
    });

    return project;
  }

  async findAll(accountId: string) {
    const projects = await this.prisma.project.findMany({
      where: {
        account: { id: accountId },
      },
      include: {
        webhooks: {},
        apiKeys: {},
      },
    });

    return projects;
  }

  //TODO: pagination.
  async findCustomers(projectId: string, accountId: string, env: Environment) {
    const customers = await this.prisma.customer.findMany({
      where: {
        project: {
          id: projectId,
          account_id: accountId,
        },
        environment: env,
      },
    });

    return customers;
  }

  //TODO: pagination, subscriptions filtering.
  async findSubscriptions(
    projectId: string,
    accountId: string,
    env: Environment,
  ) {
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        project: { id: projectId, account_id: accountId },
        environment: env,
      },
      include: {
        customer: true,
        paymentMethod: true,
        price: {
          include: {
            plan: true,
          },
        },
      },
    });

    return subscriptions;
  }

  async deleteOne(projectId: string, accountId: string) {
    const ifExist = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        account_id: accountId,
      },
    });

    if (!ifExist) {
      throw new NotFoundException('Project not found');
    }
    const project = await this.prisma.project.delete({
      where: {
        id: projectId,
      },
    });

    return { message: 'Successfully deleted', project: project };
  }

  async generateApiKeys(acctId: string, projectId: string, env: 'live' | 'test' = 'live') {
    const prefix = env === 'live' ? 'sk_live' : 'sk_test';
    const secret_key = this.generateRandomString();
    const hash = this.hashApiKey(secret_key);
    const fullSecretKey = `${prefix}_${secret_key}`;

    const existingKey = await this.prisma.projectApiKey.findFirst({
      where: {
        project: { id: projectId, account_id: acctId },
        key_prefix: prefix,
      },
    });

    if (existingKey) {
      await this.prisma.projectApiKey.update({
        where: {
          key_prefix_key_hash: {
            key_prefix: existingKey.key_prefix,
            key_hash: existingKey.key_hash,
          },
        },
        data: {
          key_hash: hash,
          secret_key: fullSecretKey,
        },
      });

      return {
        secret_key: fullSecretKey,
      };
    }

    await this.prisma.projectApiKey.create({
      data: {
        key_prefix: prefix,
        key_hash: hash,
        secret_key: fullSecretKey,
        project: { connect: { id: projectId, account_id: acctId } },
      },
    });

    return {
      secret_key: fullSecretKey,
    };
  }

  private generateRandomString(length: number = 32): string {
    return crypto.randomBytes(length).toString('base64url');
  }

  private hashApiKey(rawKey: string): string {
    return crypto.createHash('sha256').update(rawKey).digest('hex');
  }
}
