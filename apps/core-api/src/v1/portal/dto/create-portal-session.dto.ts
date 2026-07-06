import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePortalSessionDto {
  @ApiProperty({
    description: 'The subscription ID to manage.',
    example: 'sub_123',
  })
  @IsNotEmpty()
  @IsString()
  subscriptionId!: string;
}
