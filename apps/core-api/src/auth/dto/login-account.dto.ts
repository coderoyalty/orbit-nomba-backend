import { PickType } from '@nestjs/swagger';
import { CreateAccountDto } from './create-account.dto';

export class LoginAccountDto extends PickType(CreateAccountDto, [
  'email',
  'password',
]) {}
