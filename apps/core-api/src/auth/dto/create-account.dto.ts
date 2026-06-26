import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsStrongPassword,
} from 'class-validator';

import { Transform } from 'class-transformer';

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;

    return value.toLowerCase();
  })
  email!: string;

  @IsStrongPassword({ minLength: 6 })
  @IsNotEmpty()
  password!: string;
}
