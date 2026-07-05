import { Environment } from '@app/database';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';

export class AddWebhookDto {
  @ApiProperty({
    description: 'The webhook endpoint URL.',
    example: 'https://example.com/webhooks/orbit',
  })
  @IsNotEmpty()
  @IsUrl({ require_tld: false })
  url!: string;

  @ApiProperty({
    description: 'Secret used to verify webhook signatures.',
    example: '3d6d2c6b7f8a9e0f123456789abcdef',
    minLength: 5,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(5)
  signing_secret!: string;

  @ApiProperty({
    description: 'Environment where the webhook should receive events.',
    enum: Environment,
    example: Environment.test,
  })
  @IsEnum(Environment)
  environment!: Environment;
}
