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
  UseInterceptors,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CurrentAccount } from '../shared/decorators/current-account.decorator';
import { CreateProjectDto } from './dto/create-project.dto';
import { DashboardAuthGuard } from '../shared/guards/dashboard-auth.guard';
import { ActiveEnv } from '../shared/decorators/env.decorator';
import { Environment } from '@app/database';
import { DashboardEnvInterceptor } from '../shared/interceptors/dashboard-env.interceptors';

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

  @UseInterceptors(DashboardEnvInterceptor)
  @Get(':id/customers')
  async findAllCustomers(
    @CurrentAccount('sub') accountId: string,
    @ActiveEnv() env: Environment,
    @Param('id') id: string,
  ) {
    return this.projectsService.findCustomers(id, accountId, env);
  }

  @UseInterceptors(DashboardEnvInterceptor)
  @Get(':id/subscriptions')
  async findSubscriptions(
    @CurrentAccount('sub') accountId: string,
    @ActiveEnv() env: Environment,
    @Param('id') id: string,
  ) {
    return this.projectsService.findSubscriptions(id, accountId, env);
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
