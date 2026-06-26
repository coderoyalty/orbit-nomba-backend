import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsStrongPassword,
} from 'class-validator';

import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAccountDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'jane@doe.com' })
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;

    return value.toLowerCase();
  })
  email!: string;

  @ApiProperty({
    example: 'Abcd123@',
    description: 'Min Length of 6 characters Alphanumeric combination',
  })
  @IsStrongPassword({ minLength: 6 })
  @IsNotEmpty()
  password!: string;
}
