import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AdminPromptsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPrompts() {
    return this.prisma.promptTemplate.findMany({
      orderBy: { stage: 'asc' },
      select: { id: true, stage: true, description: true, version: true, updatedAt: true },
    });
  }

  async getPrompt(stage: string) {
    const record = await this.prisma.promptTemplate.findUnique({ where: { stage } });
    if (!record) throw new NotFoundException(`No DB template for stage: ${stage}`);
    return record;
  }

  async upsertPrompt(stage: string, dto: { templateText: string; description?: string }) {
    return this.prisma.promptTemplate.upsert({
      where: { stage },
      create: { stage, templateText: dto.templateText, description: dto.description },
      update: { templateText: dto.templateText, description: dto.description, version: { increment: 1 } },
    });
  }

  async resetToDefault(stage: string) {
    // Delete the DB record so FastAPI falls back to the .txt file
    await this.prisma.promptTemplate.deleteMany({ where: { stage } });
    return { message: `Stage '${stage}' will now use the default .txt file.` };
  }
}