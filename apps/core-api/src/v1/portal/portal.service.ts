import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '@app/database';
import { JwtService } from '@nestjs/jwt';
import { ProjectContext } from '../../shared/decorators/client-project.decorator';
import { CreatePortalSessionDto } from './dto/create-portal-session.dto';
import { WebhookDispatcher } from '@queue/queue/webhook.dispatcher';

const WebhookEventType = {
  SUBSCRIPTION_CREATED: 'subscription.created',
  SUBSCRIPTION_ACTIVE: 'subscription.active',
  SUBSCRIPTION_PAST_DUE: 'subscription.past_due',
  SUBSCRIPTION_CANCELED: 'subscription.canceled',
} as const;
import { ConfigService } from '@nestjs/config';
import { NombaService } from '@orbit/nomba';

@Injectable()
export class PortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly webhookDispatcher: WebhookDispatcher,
    private readonly nombaService: NombaService,
  ) {}

  async createSession(projectCtx: ProjectContext, dto: CreatePortalSessionDto) {
    const { project, environment } = projectCtx;
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        id: dto.subscriptionId,
        project_id: project.id,
        environment,
      },
    });
    if (!subscription) {
      throw new NotFoundException('Subscription not found.');
    }
    const token = await this.jwtService.signAsync(
      {
        subscriptionId: subscription.id,
        projectId: project.id,
        customerId: subscription.customer_id,
        environment,
      },
      {
        secret: this.configService.getOrThrow<string>('PORTAL_JWT_SECRET'),
        expiresIn: '15mins',
      },
    );
    return { token };
  }

  async createDashboardSession(dto: CreatePortalSessionDto) {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        id: dto.subscriptionId,
      },
    });
    if (!subscription) {
      throw new NotFoundException('Subscription not found.');
    }
    const token = await this.jwtService.signAsync(
      {
        subscriptionId: subscription.id,
        projectId: subscription.project_id,
        customerId: subscription.customer_id,
        environment: subscription.environment,
      },
      {
        secret: this.configService.getOrThrow<string>('PORTAL_JWT_SECRET'),
        expiresIn: '15mins',
      },
    );
    return { token };
  }

  async validateToken(token: string) {
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.getOrThrow<string>('PORTAL_JWT_SECRET'),
      });
      return payload;
    } catch (err) {
      throw new UnauthorizedException(
        'Invalid or expired portal session token.',
      );
    }
  }

  async getSessionDetails(payload: any) {
    const sub = await this.prisma.subscription.findFirst({
      where: {
        id: payload.subscriptionId,
        project_id: payload.projectId,
      },
      include: {
        customer: true,
        paymentMethod: true,
        price: {
          include: {
            plan: true,
          },
        },
        invoices: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
    if (!sub) {
      throw new NotFoundException('Subscription not found.');
    }
    return sub;
  }

  async cancelSubscription(payload: any) {
    const sub = await this.prisma.subscription.update({
      where: { id: payload.subscriptionId },
      data: {
        status: 'canceled',
        canceled_at: new Date(),
      },
      include: {
        price: {
          include: {
            plan: true,
          },
        },
      },
    });

    const webhookPayload = {
      subscription: sub,
      plan: {
        ...sub.price.plan,
        price: { ...sub.price, plan: undefined },
      },
    };

    const event = await this.prisma.webhookEvent.create({
      data: {
        environment: sub.environment,
        payload: webhookPayload,
        type: WebhookEventType.SUBSCRIPTION_CANCELED,
        project_id: sub.project_id,
      },
    });

    await this.webhookDispatcher.dispatch({ webhookEventId: event.id });

    return sub;
  }

  async updatePaymentMethod(
    payload: any,
    dto: { last4: string; brand: string },
  ) {
    const pm = await this.prisma.paymentMethod.create({
      data: {
        project_id: payload.projectId,
        customer_id: payload.customerId,
        provider_token: 'tok_' + Math.random().toString(36).slice(2, 8),
        last4: dto.last4,
        brand: dto.brand,
        environment: payload.environment,
        is_default: true,
      },
    });

    const sub = await this.prisma.subscription.update({
      where: { id: payload.subscriptionId },
      data: {
        payment_method_id: pm.id,
      },
      include: {
        paymentMethod: true,
      },
    });
    return sub;
  }

  async setupPaymentMethod(
    payload: any,
    dto: { redirectUrl: string },
  ) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: payload.subscriptionId },
      include: { customer: true },
    });
    if (!subscription) {
      throw new NotFoundException('Subscription not found.');
    }

    const orderReference = `card_update:${subscription.id}:${Date.now()}`;

    const checkoutLink = await this.nombaService.generateCheckoutLink(
      {
        amount: 100, // ₦100 validation fee
        transaction_reference: orderReference,
        customer_email: subscription.customer.email,
        redirect_url: dto.redirectUrl,
      },
      payload.environment,
    );

    return checkoutLink;
  }

  async changePlan(payload: any, dto: { planId: string }) {
    const sub = await this.prisma.subscription.findUnique({
      where: { id: payload.subscriptionId },
      include: { price: true },
    });
    if (!sub) {
      throw new NotFoundException('Subscription not found.');
    }

    const newPrice = await this.prisma.price.findFirst({
      where: {
        plan_id: dto.planId,
        project_id: payload.projectId,
        is_active: true,
      },
    });
    if (!newPrice) {
      throw new NotFoundException('No active price found for the selected plan.');
    }

    const now = new Date();
    let current_period_start = sub.current_period_start;
    let current_period_end = sub.current_period_end;
    let status = sub.status;

    if (sub.status === 'trialing' || sub.status === 'incomplete') {
      // Trial phase: Just swap the price ID, preserve the trial end dates.
    } else {
      const oldPrice = sub.price;
      const intervalChanged =
        oldPrice.billing_interval !== newPrice.billing_interval ||
        oldPrice.billing_interval_count !== newPrice.billing_interval_count;

      if (intervalChanged || newPrice.unit_amount > oldPrice.unit_amount) {
        // Upgrade or Billing Cycle Interval Change: Reset billing cycle and bill new amount
        current_period_start = now;
        current_period_end = this.calculatePeriodEnd(
          now,
          newPrice.billing_interval,
          newPrice.billing_interval_count,
        );
        status = 'active';

        // Create an invoice record for the payment capture
        await this.prisma.invoice.create({
          data: {
            amount: newPrice.unit_amount,
            due_at: now,
            paid_at: now,
            environment: sub.environment,
            status: 'paid',
            subscription_id: sub.id,
            customer_id: sub.customer_id,
            project_id: sub.project_id,
            period_start: current_period_start,
            period_end: current_period_end,
          },
        });
      } else {
        // Downgrade: Grandfather the current period at the paid amount, cheaper price applies next cycle
        // Keep current period start and end intact.
      }
    }

    const updatedSub = await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        price_id: newPrice.id,
        current_period_start,
        current_period_end,
        status,
      },
      include: {
        price: {
          include: {
            plan: true,
          },
        },
      },
    });

    const webhookPayload = {
      subscription: updatedSub,
      plan: {
        ...updatedSub.price.plan,
        price: { ...updatedSub.price, plan: undefined },
      },
    };

    const event = await this.prisma.webhookEvent.create({
      data: {
        environment: updatedSub.environment,
        payload: webhookPayload,
        type: WebhookEventType.SUBSCRIPTION_ACTIVE,
        project_id: updatedSub.project_id,
      },
    });

    await this.webhookDispatcher.dispatch({ webhookEventId: event.id });

    return updatedSub;
  }

  private calculatePeriodEnd(start: Date, interval: string, count: number): Date {
    const end = new Date(start);
    if (interval === 'day') {
      end.setDate(end.getDate() + count);
    } else if (interval === 'week') {
      end.setDate(end.getDate() + count * 7);
    } else if (interval === 'month') {
      end.setMonth(end.getMonth() + count);
    } else if (interval === 'year') {
      end.setFullYear(end.getFullYear() + count);
    }
    return end;
  }

  async getPlans(payload: any) {
    const plans = await this.prisma.plan.findMany({
      where: {
        project_id: payload.projectId,
        is_active: true,
      },
      include: {
        prices: true,
      },
    });
    return plans;
  }
}
