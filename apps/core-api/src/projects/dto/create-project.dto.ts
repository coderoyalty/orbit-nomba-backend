import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({ example: 'MovieNaija' })
  @IsString()
  @MinLength(2)
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    example: 'friendly subscription-based alternative for Netflix.',
  })
  @IsString()
  @IsNotEmpty()
  description!: string;
}
