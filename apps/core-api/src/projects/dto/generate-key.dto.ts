import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export class GenerateKeyDto {
  @ApiPropertyOptional({ example: 'live', enum: ['live', 'test'] })
  @IsEnum(['live', 'test'])
  @IsOptional()
  environment?: 'live' | 'test';
}
