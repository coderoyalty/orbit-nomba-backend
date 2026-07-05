import { Interval } from '@app/database';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class PriceDto {
  @ApiProperty({
    description: 'Dictates the base unit of time',
    example: Interval.day,
  })
  @IsEnum(Interval)
  interval!: Interval;

  @ApiProperty({
    description: 'multiplier applied to the interval',
    example: 30,
  })
  @IsInt()
  @Min(1)
  interval_count!: number;

  @ApiProperty({
    description: 'Amount in the currency unit e.g N50 is 5,000 kobo',
    example: 5000_00,
  })
  @IsInt()
  @Min(0)
  unit_amount!: number;
}

export class CreatePlanDto {
  @ApiProperty({ example: 'Starter' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({
    example: 'Fair video quality, and 1 download devices.',
  })
  @IsString()
  description: string = '';

  @ApiProperty({
    description: 'price object',
    type: () => PriceDto,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => PriceDto)
  price!: PriceDto;

  @ApiPropertyOptional({
    description:
      'Number of days for free trial. Optional means none. Minimum of 1 when provided',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  trial_days?: number;
}
