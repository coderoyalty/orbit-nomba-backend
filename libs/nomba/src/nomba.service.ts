import { Injectable } from '@nestjs/common';
import { NombaAuthService } from './nomba-auth.service';

@Injectable()
export class NombaService {
  constructor(private readonly nombaAuthService: NombaAuthService) {}
}
