// pull FastapiClient out into its own leaf module with zero upward dependencies.
// Everything else (ElicitationModule, ProjectsModule, the new MatchingHelperModule) imports THIS, never each other, for the FastapiClient dependency specifically.
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FastapiClient } from './fastapi.client';

@Module({
  imports: [ConfigModule],
  providers: [FastapiClient],
  exports: [FastapiClient],
})
export class FastapiClientModule {}
