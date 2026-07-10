import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AdminConfigService {
  constructor(private readonly prisma: PrismaService) {}

  // Domains 
  listDomains()  { return this.prisma.domainDefinition.findMany({ orderBy: { sortOrder: 'asc' } }); }

  async createDomain(dto: { code: string; name: string; description?: string; sortOrder?: number }) {
    return this.prisma.domainDefinition.create({ data: dto });
  }

  async updateDomain(id: string, dto: { name?: string; description?: string; isActive?: boolean; sortOrder?: number }) {
    await this._findOrThrow('domainDefinition', id);
    return this.prisma.domainDefinition.update({ where: { id }, data: dto });
  }

  async deleteDomain(id: string) {
    await this._findOrThrow('domainDefinition', id);
    return this.prisma.domainDefinition.update({ where: { id }, data: { isActive: false } });
  }

  // Seams
  listSeams()  { return this.prisma.seamDefinition.findMany({ orderBy: { sortOrder: 'asc' } }); }

  async createSeam(dto: { code: string; name: string; description?: string; sortOrder?: number }) {
    return this.prisma.seamDefinition.create({ data: dto });
  }

  async updateSeam(id: string, dto: { name?: string; description?: string; isActive?: boolean; sortOrder?: number }) {
    await this._findOrThrow('seamDefinition', id);
    return this.prisma.seamDefinition.update({ where: { id }, data: dto });
  }

  async deleteSeam(id: string) {
    await this._findOrThrow('seamDefinition', id);
    return this.prisma.seamDefinition.update({ where: { id }, data: { isActive: false } });
  }

  // Archetypes
  listArchetypes()  { return this.prisma.archetypeDefinition.findMany({ orderBy: { sortOrder: 'asc' } }); }

  async createArchetype(dto: { code: string; name: string; description?: string; sortOrder?: number }) {
    return this.prisma.archetypeDefinition.create({ data: dto });
  }

  async updateArchetype(id: string, dto: { name?: string; description?: string; isActive?: boolean; sortOrder?: number }) {
    await this._findOrThrow('archetypeDefinition', id);
    return this.prisma.archetypeDefinition.update({ where: { id }, data: dto });
  }

  async deleteArchetype(id: string) {
    await this._findOrThrow('archetypeDefinition', id);
    return this.prisma.archetypeDefinition.update({ where: { id }, data: { isActive: false } });
  }

  // Probe Questions
  listProbeQuestions(archetypeCode?: string) {
    return this.prisma.probeQuestion.findMany({
      where: archetypeCode ? { archetypeCode } : undefined,
      orderBy: [{ archetypeCode: 'asc' }, { displayOrder: 'asc' }],
    });
  }

  async createProbeQuestion(dto: { archetypeCode: string; questionText: string; displayOrder?: number }) {
    return this.prisma.probeQuestion.create({ data: dto });
  }

  async updateProbeQuestion(id: string, dto: { questionText?: string; displayOrder?: number; isActive?: boolean }) {
    await this._findOrThrow('probeQuestion', id);
    return this.prisma.probeQuestion.update({ where: { id }, data: dto });
  }

  async deleteProbeQuestion(id: string) {
    await this._findOrThrow('probeQuestion', id);
    return this.prisma.probeQuestion.update({ where: { id }, data: { isActive: false } });
  }

  // Void Codes
  listVoidCodes() {
    return this.prisma.voidCodeDefinition.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async createVoidCode(dto: {
    code: string; name: string; description: string;
    severity?: string; sortOrder?: number;
  }) {
    return this.prisma.voidCodeDefinition.create({ data: dto });
  }

  async updateVoidCode(id: string, dto: {
    name?: string; description?: string; severity?: string;
    isActive?: boolean; sortOrder?: number;
  }) {
    await this._findOrThrow('voidCodeDefinition', id);
    return this.prisma.voidCodeDefinition.update({ where: { id }, data: dto });
  }

  async deleteVoidCode(id: string) {
    await this._findOrThrow('voidCodeDefinition', id);
    return this.prisma.voidCodeDefinition.update({ where: { id }, data: { isActive: false } });
  }

  // Private
  private async _findOrThrow(model: string, id: string) {
    const record = await (this.prisma as any)[model].findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`${model} ${id} not found.`);
    return record;
  }
}