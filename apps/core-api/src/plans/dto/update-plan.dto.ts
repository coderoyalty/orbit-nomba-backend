import { CreatePlanDto } from './create-plan.dto';
import { PickType } from '@nestjs/swagger';

export class UpdatePlanDto extends PickType(CreatePlanDto, [
  'name',
  'description',
  'dunning_enabled',
  'trial_days',
]) {}
