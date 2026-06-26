import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CurrentAccount } from '../auth/decorators/current-account.decorator';
import { CreateProjectDto } from './dto/create-project.dto';
import { DashboardAuthGuard } from '../auth/guards/dashboard-auth.guard';

@UseGuards(DashboardAuthGuard)
@Controller('dashboard/projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async create(
    @CurrentAccount('sub') accountId: string,
    @Body() dto: CreateProjectDto,
  ) {
    const project = await this.projectsService.create(accountId, dto);
    return project;
  }

  @Get()
  async findAll(@CurrentAccount('sub') accountId: string) {
    const projects = await this.projectsService.findAll(accountId);
    return projects;
  }

  @Delete(':id')
  async deleteOne(
    @CurrentAccount('sub') accountId: string,
    @Param('id') id: string,
  ) {
    return this.projectsService.deleteOne(id, accountId);
  }

  @Post(':id/keys')
  async generateApiKeys(
    @CurrentAccount('sub') acctId: string,
    @Param('id') projectId: string,
  ) {
    const data = await this.projectsService.generateApiKeys(acctId, projectId);

    return data;
  }
}
