import {
  Controller, Get, NotFoundException, Param,
  Headers, UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Controller('internal')
export class InternalController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /internal/prompts/:stage
   * Called by FastAPI's PromptService with a 60s TTL cache.
   * Returns the DB prompt template if it exists; 404 if not (FastAPI falls back to .txt file).
   * Protected by INTERNAL_SERVICE_TOKEN — not exposed to the public API.
   */
  @Get('prompts/:stage')
  async getPromptTemplate(
    @Param('stage') stage: string,
    @Headers('x-internal-token') token: string,
  ) {
    if (token !== process.env.INTERNAL_SERVICE_TOKEN) {
      throw new UnauthorizedException('Invalid internal token.');
    }
    const record = await this.prisma.promptTemplate.findUnique({ where: { stage } });
    if (!record) throw new NotFoundException(`No DB template for stage: ${stage}`);
    return { stage: record.stage, templateText: record.templateText, version: record.version };
  }
}