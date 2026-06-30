import { Prisma } from '@app/database';
import {
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEmail()
  email!: string;

  @IsObject()
  metadata!: Prisma.InputJsonObject;
}
