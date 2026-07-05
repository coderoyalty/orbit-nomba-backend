import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service';
import {
  ApiProjectContext,
  type ProjectContext,
} from '../../shared/decorators/client-project.decorator';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ApiKeyGuard } from '../../shared/guards/api-key.guard';

@UseGuards(ApiKeyGuard)
@Controller('v1/customers')
export class CustomersController {
  constructor(private service: CustomersService) {}

  @Post()
  create(
    @ApiProjectContext() ctx: ProjectContext,
    @Body() dto: CreateCustomerDto,
  ) {
    return this.service.create(ctx, dto);
  }

  @Get(':id')
  findOne(@ApiProjectContext() ctx: ProjectContext, @Param('id') id: string) {
    return this.service.findOne(ctx, id);
  }
}
