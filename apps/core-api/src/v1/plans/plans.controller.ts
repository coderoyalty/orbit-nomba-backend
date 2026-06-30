import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { PlansService } from './plans.service';
import { ClientApiProject } from '../../shared/decorators/client-project.decorator';
import * as database from '@app/database';
import { ApiKeyGuard } from '../../shared/guards/api-key.guard';

@UseGuards(ApiKeyGuard)
@Controller('v1/plans')
export class PlansController {
  constructor(private service: PlansService) {}

  @Get()
  findAll(@ClientApiProject() project: database.Project) {
    return this.service.findAll(project);
  }

  @Get('/:id')
  findOne(
    @ClientApiProject() project: database.Project,
    @Param('id') id: string,
  ) {
    return this.service.findOne(project, id);
  }
}
