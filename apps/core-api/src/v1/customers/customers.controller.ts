import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { ClientApiProject } from '../../shared/decorators/client-project.decorator';
import * as database from '@app/database';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ApiKeyGuard } from '../../shared/guards/api-key.guard';

@UseGuards(ApiKeyGuard)
@Controller('v1/customers')
export class CustomersController {
  constructor(private service: CustomersService) {}

  @Post()
  create(
    @ClientApiProject() project: database.Project,
    @Body() dto: CreateCustomerDto,
  ) {
    return this.service.create(project, dto);
  }

  @Get(':id')
  findOne(
    @ClientApiProject() project: database.Project,
    @Param('id') id: string,
  ) {
    return this.service.findOne(project, id);
  }
}
