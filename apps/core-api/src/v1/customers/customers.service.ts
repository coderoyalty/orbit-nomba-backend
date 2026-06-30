import { PrismaService, Project } from '@app/database';
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCustomerDto } from './dto/create-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async create(project: Project, dto: CreateCustomerDto) {
    const customer = await this.prisma.customer.create({
      data: {
        email: dto.email.toLowerCase(),
        project_id: project.id,
        name: dto.name,
        metadata: dto.metadata,
      },
    });

    return customer;
  }

  async findOne(project: Project, id: string) {
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
