import { Prisma } from '@app/database';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
  ValidateNested,
} from 'class-validator';

class CustomerDto {
  @ApiProperty({
    description: 'The customer email address.',
    example: 'jane.doe@example.com',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'The full name of the customer.',
    example: 'Jane Doe',
  })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({
    description:
      'Optional custom metadata to associate with the customer. This is stored as JSON and can contain any additional information required by your application.',
    required: false,
    example: {
      customerId: 'cust_12345',
      company: 'Acme Inc.',
      region: 'NG',
    },
  })
  @IsObject()
  @IsOptional()
  meta?: Prisma.InputJsonObject;
}

export class CreateSubscriptionDto {
  @ApiProperty({
    description: 'Details of the customer to subscribe to the plan.',
    type: () => CustomerDto,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => CustomerDto)
  customer!: CustomerDto;

  @ApiProperty({
    description:
      'The ID of the active plan price the customer is subscribing to.',
    example: 'price_01JYB7J1JQJX8K9R4Y5M6N7P8Q',
  })
  @IsString()
  @IsNotEmpty()
  priceId!: string;

  @ApiProperty({
    description:
      'The URL to redirect the customer to after a successful payment.',
    example: 'https://example.com/subscriptions/success',
  })
  @IsUrl()
  redirectUrl!: string;
}
