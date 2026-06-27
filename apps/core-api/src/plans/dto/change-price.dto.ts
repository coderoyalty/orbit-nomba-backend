import { PickType } from '@nestjs/swagger';
import { PriceDto } from './create-plan.dto';

export class ChangePriceDto extends PickType(PriceDto, ['unit_amount']) {}
