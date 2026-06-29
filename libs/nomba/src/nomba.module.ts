import { Module } from '@nestjs/common';
import { NombaService } from './nomba.service';
import { NombaAuthService } from './nomba-auth.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  providers: [NombaService, NombaAuthService],
  exports: [NombaService],
})
export class NombaModule {}
