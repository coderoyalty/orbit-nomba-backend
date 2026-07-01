import { Interval, PrismaService, Project } from '@app/database';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NombaService } from '@orbit/nomba';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { ProjectContext } from '../../shared/decorators/client-project.decorator';

const CARD_AUTHORIZATION_AMOUNT = 100_00; // #100 in kobo

@Injectable()
export class SubScriptionService {
  constructor(
    private prisma: PrismaService,
    private nombaService: NombaService,
  ) {}

  async subscribeToPlan(
    { project, environment }: ProjectContext,
    dto: CreateSubscriptionDto,
  ) {
    const price = await this.prisma.price.findFirst({
      where: {
        project_id: project.id,
        id: dto.priceId,
        is_active: true,
        plan: {
          is_active: true,
        },
      },
      include: { plan: true },
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
    const { subscription, customer } = await this.prisma.$transaction(
      async (tx) => {
        const customer = await tx.customer.upsert({
          where: {
            project_id_email_environment: {
              project_id: project.id,
              email: dto.customer.email,
              environment,
            },
          },
          create: {
            email: dto.customer.email,
            name: dto.customer.name,
            project_id: project.id,
            ...(dto.customer.meta && {
              meta: dto.customer.meta,
            }),
            environment: 'test',
          },
          update: {},
        });

        const subscription = await tx.subscription.create({
          data: {
            project_id: project.id,
            price_id: price.id,
            customer_id: customer.id,
            status: 'incomplete',
            environment: 'test',
          },
        });

        return { subscription, customer };
      },
    );

    //TODO: set project environment
    const env = 'test';

    const priceAmount =
      (price.plan.trial_days > 0
        ? CARD_AUTHORIZATION_AMOUNT
        : price.unit_amount) / 100;

    return await this.nombaService.generateCheckoutLink(
      {
        amount: priceAmount,
        transaction_reference: subscription.id,
        customer_email: customer.email,
        redirect_url: dto.redirectUrl,
      },
      env,
    );
  }
}
