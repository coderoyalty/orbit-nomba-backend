import { PartialType } from '@nestjs/mapped-types';
import { CreatePlanDto } from './create-plan.dto';
import { PickType } from '@nestjs/swagger';

export class UpdatePlanDto extends PickType(CreatePlanDto, [
  'name',
  'description',
]) {}
