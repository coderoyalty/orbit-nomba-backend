import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { PlansService } from './plans.service';
import {
  ApiProjectContext,
  type ProjectContext,
} from '../../shared/decorators/client-project.decorator';
import { ApiKeyGuard } from '../../shared/guards/api-key.guard';

@UseGuards(ApiKeyGuard)
@Controller('v1/plans')
export class PlansController {
  constructor(private service: PlansService) {}

  @Get()
  findAll(@ApiProjectContext() ctx: ProjectContext) {
    return this.service.findAll(ctx.project);
  }

  @Get('/:id')
  findOne(@ApiProjectContext() ctx: ProjectContext, @Param('id') id: string) {
    return this.service.findOne(ctx.project, id);
  }
}
