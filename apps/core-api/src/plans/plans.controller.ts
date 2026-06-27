import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { PlansService } from './plans.service';
import { CreatePlanDto, PriceDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { DashboardAuthGuard } from '../shared/guards/dashboard-auth.guard';
import { ProjectAccessGuard } from '../projects/guards/project-access.guard';
import { CurrentProject } from '../shared/decorators/current-project.decorator';
import type { Project } from '@app/database';
import { ApiParam } from '@nestjs/swagger';
import { ChangePriceDto } from './dto/change-price.dto';

@ApiParam({
  name: 'projectId',
  type: String,
  description: 'Project ID',
})
@UseGuards(DashboardAuthGuard, ProjectAccessGuard)
@Controller('dashboard/projects/:projectId/plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Post()
  create(
    @Body() createPlanDto: CreatePlanDto,
    @CurrentProject() project: Project,
  ) {
    return this.plansService.create(project, createPlanDto);
  }

  @Get()
  findAll(@CurrentProject() project: Project) {
    return this.plansService.findAll(project);
  }

  @Get(':id')
  findOne(@CurrentProject() project: Project, @Param('id') id: string) {
    return this.plansService.findOne(project, id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePlanDto: UpdatePlanDto) {
    return this.plansService.update(id, updatePlanDto);
  }

  @Post(':id/prices')
  addPrice(
    @Param('id') id: string,
    @Body() dto: PriceDto,
    @CurrentProject() project: Project,
  ) {
    return this.plansService.addPrice(id, dto, project);
  }

  @Post(':planId/prices/:priceId/change-price')
  changePlanPrice(
    @Param('planId') planId: string,
    @Param('priceId') priceId: string,
    @Body() dto: ChangePriceDto,
    @CurrentProject() project: Project,
  ) {
    return this.plansService.changePrice({ priceId, planId }, dto, project);
  }

  @Delete(':id')
  deprecatePlan(@Param('id') id: string, @CurrentProject() project: Project) {
    return this.plansService.deprecatePlan(id, project);
  }

  @Post(':planId/cancel-subscriptions')
  cancelPlanSubscriptions(
    @Param('planId') planId: string,
    @CurrentProject() project: Project,
  ) {
    return this.plansService.cancelPlanSubscriptions(planId, project);
  }
}
