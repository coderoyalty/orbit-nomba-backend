import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiKeyGuard } from '../../shared/guards/api-key.guard';
import { DashboardAuthGuard } from '../../shared/guards/dashboard-auth.guard';
import { PortalService } from './portal.service';
import * as clientProjectDecorator from '../../shared/decorators/client-project.decorator';
import { CreatePortalSessionDto } from './dto/create-portal-session.dto';

@Controller('v1/portal')
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  @UseGuards(ApiKeyGuard)
  @Post('sessions')
  async createSession(
    @clientProjectDecorator.ApiProjectContext()
    ctx: clientProjectDecorator.ProjectContext,
    @Body() dto: CreatePortalSessionDto,
  ) {
    return this.portalService.createSession(ctx, dto);
  }

  @UseGuards(DashboardAuthGuard)
  @Post('dashboard-sessions')
  async createDashboardSession(@Body() dto: CreatePortalSessionDto) {
    return this.portalService.createDashboardSession(dto);
  }

  private extractToken(authorization?: string): string {
    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or invalid Authorization header.',
      );
    }
    return authorization.substring(7);
  }

  @Get('session')
  async getSession(@Headers('authorization') authHeader?: string) {
    const token = this.extractToken(authHeader);
    const payload = await this.portalService.validateToken(token);
    return this.portalService.getSessionDetails(payload);
  }

  @Post('subscription/cancel')
  async cancelSubscription(@Headers('authorization') authHeader?: string) {
    const token = this.extractToken(authHeader);
    const payload = await this.portalService.validateToken(token);
    return this.portalService.cancelSubscription(payload);
  }

  @Post('subscription/payment-method')
  async updatePaymentMethod(
    @Body() dto: { last4: string; brand: string },
    @Headers('authorization') authHeader?: string,
  ) {
    const token = this.extractToken(authHeader);
    const payload = await this.portalService.validateToken(token);
    return this.portalService.updatePaymentMethod(payload, dto);
  }

  @Post('subscription/change-plan')
  async changePlan(
    @Body() dto: { planId: string },
    @Headers('authorization') authHeader?: string,
  ) {
    const token = this.extractToken(authHeader);
    const payload = await this.portalService.validateToken(token);
    return this.portalService.changePlan(payload, dto);
  }

  @Get('plans')
  async getPlans(@Headers('authorization') authHeader?: string) {
    const token = this.extractToken(authHeader);
    const payload = await this.portalService.validateToken(token);
    return this.portalService.getPlans(payload);
  }
}
