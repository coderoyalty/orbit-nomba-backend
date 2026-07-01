import { Interval, PrismaService, Project } from '@app/database';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NombaService } from '@orbit/nomba';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

@Injectable()
export class SubScriptionService {
  constructor(
    private prisma: PrismaService,
    private nombaService: NombaService,
  ) {}

  async subscribeToPlan(project: Project, dto: CreateSubscriptionDto) {
    /**
     * 1. verify plan price availability
     * 2. reject duplication of active subscriptions
     * 3. create customer if not found
     * 4. create incomplete subscription, and generate checkout link.
     */

    const price = await this.prisma.price.findFirst({
      where: {
        project_id: project.id,
        id: dto.priceId,
        is_active: true,
        plan: {
          is_active: true,
        },
      },
    });

    if (!price) {
      throw new NotFoundException(
        'Plan price not found. The provided id does not exist, or the plan is archived.',
      );
    }

    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const existingSub = await this.prisma.subscription.findFirst({
      where: {
        project_id: project.id,
        customer: {
          email: dto.customer.email,
        },
        OR: [
          // They already have a successfully running subscription
          {
            status: {
              in: ['active', 'trialing'],
            },
          },
          // They have a pending checkout that is STILL VALID
          {
            status: 'incomplete',
            createdAt: {
              gte: fortyEightHoursAgo,
            },
          },
        ],
      },
    });

    if (existingSub) {
      throw new ConflictException(
        existingSub.status === 'incomplete'
          ? 'You already have a pending checkout. Please complete it or wait for the link to expire.'
          : 'A subscription already exists for the provided customer.',
      );
    }

    const customer = await this.prisma.customer.upsert({
      where: {
        project_id_email: {
          project_id: project.id,
          email: dto.customer.email,
        },
      },
      create: {
        email: dto.customer.email,
        name: dto.customer.name,
        project_id: project.id,
        ...(dto.customer.meta && {
          meta: dto.customer.meta,
        }),
      },
      update: {},
    });

    const startDate = dto.startDate || new Date();

    const endDate = this.calculatePeriodEnd(
      startDate,
      price.billing_interval,
      price.billing_interval_count,
    );

    const subscription = await this.prisma.subscription.create({
      data: {
        project_id: project.id,
        price_id: price.id,
        customer_id: customer.id,
        current_period_start: startDate,
        current_period_end: endDate,
        status: 'incomplete',
      },
    });

    //TODO: set project environment
    const env = 'test';

    return await this.nombaService.generateCheckoutLink(
      {
        amount: price.unit_amount / 100,
        transaction_reference: subscription.id,
        customer_email: customer.email,
        redirect_url: dto.redirectUrl,
      },
      env,
    );
  }

  private calculatePeriodEnd(
    start: Date,
    interval: Interval,
    count: number,
  ): Date {
    const end = new Date(start);

    switch (interval) {
      case 'day':
        end.setDate(end.getDate() + count);
        break;

      case 'week':
        end.setDate(end.getDate() + count * 7);
        break;

      case 'month':
        end.setMonth(end.getMonth() + count);
        break;

      case 'year':
        end.setFullYear(end.getFullYear() + count);
        break;
    }

    return end;
  }
}
