import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../../shared/guards/api-key.guard';
import { SubScriptionService } from './subscriptions.service';
import {
  ApiProjectContext,
  type ProjectContext,
} from '../../shared/decorators/client-project.decorator';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

@UseGuards(ApiKeyGuard)
@Controller('v1/subscriptions')
export class SubscriptionsController {
  constructor(private service: SubScriptionService) {}

  @Post()
  async subscribeCustomer(
    @ApiProjectContext() ctx: ProjectContext,
    @Body() dto: CreateSubscriptionDto,
  ) {
    return this.service.subscribeToPlan(ctx, dto);
  }
}
