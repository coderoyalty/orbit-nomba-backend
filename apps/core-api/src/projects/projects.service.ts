import { PrismaService } from '@app/database';
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
      },
    });

    return projects;
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

  async generateApiKeys(acctId: string, projectId: string) {
    const prefix = 'sk_live';
    const secret_key = this.generateRandomString();
    const hash = this.hashApiKey(secret_key);

    const existingKey = await this.prisma.projectApiKey.findFirst({
      where: { project: { id: projectId, account_id: acctId } },
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
          key_prefix: prefix,
          key_hash: hash,
        },
      });

      return {
        secret_key: `${prefix}_${secret_key}`,
      };
    }

    await this.prisma.projectApiKey.create({
      data: {
        key_prefix: prefix,
        key_hash: hash,
        project: { connect: { id: projectId, account_id: acctId } },
      },
    });

    return {
      secret_key: `${prefix}_${secret_key}`,
    };
  }

  private generateRandomString(length: number = 32): string {
    return crypto.randomBytes(length).toString('base64url');
  }

  private hashApiKey(rawKey: string): string {
    return crypto.createHash('sha256').update(rawKey).digest('hex');
  }
}
