import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { PrismaService, Project } from '@app/database';

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async create(project: Project, dto: CreatePlanDto) {
    const plan = await this.prisma.plan.create({
      data: {
        name: dto.name,
        description: dto.description,
        project: { connect: { id: project.id } },
        prices: {
          create: {
            billing_interval: dto.price.interval,
            billing_interval_count: dto.price.interval_count,
            unit_amount: dto.price.unit_amount,
            is_active: true,
            project: { connect: { id: project.id } },
          },
        },
      },

      include: {
        prices: true,
      },
    });

    return plan;
  }

  async findAll(project: Project) {
    const plans = await this.prisma.plan.findMany({
      where: {
        project: project,
      },
      include: {
        prices: true,
      },
    });

    return plans;
  }

  async findOne(project: Project, id: string) {
    const plan = await this.prisma.plan.findFirst({
      where: {
        id: id,
        project_id: project.id,
      },
      include: {
        prices: {
          include: {
            _count: {
              select: {
                subscriptions: true,
              },
            },
          },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException('Plan not found.');
    }

    return plan;
  }

  async update(id: string, dto: UpdatePlanDto) {
    const plan = await this.prisma.plan.findFirst({ where: { id: id } });

    if (!plan) {
      throw new NotFoundException('Plan not found.');
    }

    const updatedPlan = this.prisma.plan.update({
      where: {
        id: id,
      },
      data: { name: dto.name, description: dto.description },
    });

    return updatedPlan;
  }
}
