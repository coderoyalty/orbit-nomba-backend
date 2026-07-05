import { PrismaService, Project } from '@app/database';
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ProjectContext } from '../../shared/decorators/client-project.decorator';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async create(
    { project, environment }: ProjectContext,
    dto: CreateCustomerDto,
  ) {
    const customer = await this.prisma.customer.create({
      data: {
        email: dto.email.toLowerCase(),
        project_id: project.id,
        name: dto.name,
        metadata: dto.metadata,
        environment,
      },
    });

    return customer;
  }

  async findOne({ project, environment }: ProjectContext, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: id,
        project_id: project.id,
      },
      include: {
        // fetch the single active subscription.
        subscriptions: {
          where: {
            status: {
              in: ['active', 'trialing', 'past_due', 'incomplete'],
            },
          },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },

        // fetch unpaid invoices.
        invoices: {
          where: {
            status: {
              in: ['pending', 'failed'],
            },
            due_at: {
              lt: new Date(), // Due date is in the past
            },
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer does not exist');
    }

    return customer;
  }
}
