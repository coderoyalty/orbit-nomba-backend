import { PrismaService, Project } from '@app/database';
import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(project: Project) {
    const plans = await this.prisma.plan.findMany({
      where: {
        project_id: project.id,
        is_active: true,
      },
      include: {
        prices: {
          where: {
            is_active: true,
          },
        },
      },
    });

    return plans;
  }

  async findOne(project: Project, planId: string) {
    const plan = await this.prisma.plan.findFirst({
      where: {
        id: planId,
        project_id: project.id,
      },
      include: { prices: { where: { is_active: true } } },
    });

    if (!plan || !plan.is_active) {
      throw new NotFoundException('Plan not found');
    }

    return plan;
  }
}
