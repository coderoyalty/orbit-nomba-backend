import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../../shared/guards/api-key.guard';
import { SubScriptionService } from './subscriptions.service';
import { ClientApiProject } from '../../shared/decorators/client-project.decorator';
import * as database from '@app/database';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

@UseGuards(ApiKeyGuard)
@Controller('v1/subscriptions')
export class SubscriptionsController {
  constructor(private service: SubScriptionService) {}

  @Post()
  async subscribeCustomer(
    @ClientApiProject() project: database.Project,
    @Body() dto: CreateSubscriptionDto,
  ) {
    return this.service.subscribeToPlan(project, dto);
  }
}
