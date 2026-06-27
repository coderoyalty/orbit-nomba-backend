import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreatePlanDto, PriceDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { PrismaService, Project } from '@app/database';
import { ChangePriceDto } from './dto/change-price.dto';

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

  async addPrice(id: string, dto: PriceDto, project: Project) {
    const plan = await this.prisma.plan.findFirst({
      where: {
        id: id,
        project_id: project.id,
      },
    });

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    const newPrice = await this.prisma.price.create({
      data: {
        billing_interval: dto.interval,

        billing_interval_count: dto.interval_count,
        unit_amount: dto.unit_amount,

        plan_id: plan.id,
        project_id: project.id,
        is_active: true,
      },
    });

    return newPrice;
  }

  async archivePrice(
    params: { planId: string; priceId: string },
    project: Project,
  ) {
    const result = await this.prisma.price.update({
      where: {
        id: params.priceId,
        plan_id: params.planId,
        project_id: project.id,
      },
      data: {
        is_active: false,
      },
    });

    return { message: 'Price successfully archived' };
  }

  /**
   * Grandfathering for plans.
   *
   * At an attempt to change the amount of a plan price, create a new plan price, and deactivate the previous one. Previous subscriptions will remain on the old plan price, new subscribers use the new plan price. If there's a need to use the new plan price for all subscribers, migrate the subscribers from the old price plan, to the new price plan.
   */
  async changePrice(
    params: { planId: string; priceId: string },
    dto: ChangePriceDto,
    project: Project,
  ) {
    const price = await this.prisma.$transaction(async (tx) => {
      const price = await tx.price.findFirst({
        where: {
          id: params.priceId,
          plan_id: params.planId,
          project_id: project.id,
        },
      });

      if (!price) {
        throw new NotFoundException('Price not found');
      }

      if (price.unit_amount === dto.unit_amount) {
        throw new BadRequestException(
          "There's a price conflict. Changing to the same price will cause redundant plan price.",
        );
      }

      await tx.price.update({
        where: { id: price.id },
        data: {
          is_active: false,
        },
      });

      const newPrice = await tx.price.create({
        data: {
          billing_interval: price.billing_interval,
          billing_interval_count: price.billing_interval_count,
          unit_amount: dto.unit_amount,
          plan_id: price.plan_id,
          project_id: price.project_id,
        },
      });

      return newPrice;
    });

    return price;
  }

  async deprecatePlan(id: string, project: Project) {
    const plan = await this.prisma.plan.findFirst({
      where: {
        id: id,
        project_id: project.id,
      },
    });

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    await this.prisma.$transaction(async (tx) => {
      const associatedPrices = await tx.price.findMany({
        where: { plan_id: id },
        select: { id: true },
      });

      const priceIds = associatedPrices.map((p) => p.id);

      await tx.plan.update({
        where: {
          id: id,
        },
        data: {
          is_active: false,
        },
      });

      if (priceIds.length > 0) {
        await tx.price.updateMany({
          where: {
            id: { in: priceIds },
          },
          data: {
            is_active: false,
          },
        });
      }
    });

    return { message: `Successfully deprecated '${plan.name}'` };
  }

  async cancelPlanSubscriptions(planId: string, project: Project) {
    await this.prisma.$transaction(async (tx) => {
      const associatedPrices = await tx.price.findMany({
        where: {
          plan_id: planId,
          project_id: project.id,
        },
        select: { id: true },
      });

      const priceIds = associatedPrices.map((p) => p.id);

      if (priceIds.length === 0) return { count: 0 };

      const result = await tx.subscription.updateMany({
        where: {
          price_id: { in: priceIds },
          status: 'active',
          cancel_at_period_end: false, // Only touch subscriptions not already cancelling
        },
        data: {
          cancel_at_period_end: true,
        },
      });

      return {
        message: `Successfully queued ${result.count} subscriptions for cancellation at period end.`,
      };
    });
  }
}
