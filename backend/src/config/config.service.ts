import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ConfigReadService {
  constructor(private readonly prisma: PrismaService) {}

  getDomains() {
    return this.prisma.domainDefinition.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, code: true, name: true, description: true, sortOrder: true },
    });
  }

  getSeams() {
    return this.prisma.seamDefinition.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, code: true, name: true, description: true, sortOrder: true },
    });
  }

  getArchetypes() {
    return this.prisma.archetypeDefinition.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, code: true, name: true, description: true, sortOrder: true },
    });
  }

  getProbeQuestions(archetypeCode: string) {
    return this.prisma.probeQuestion.findMany({
      where: { archetypeCode, isActive: true },
      orderBy: { displayOrder: 'asc' },
      select: { id: true, archetypeCode: true, questionText: true, displayOrder: true },
    });
  }

  getSubscriptionPackages(role?: string) {
    return this.prisma.subscriptionPackage.findMany({
      where: {
        isActive: true,
        ...(role ? { role: role.toUpperCase() } : {}),
      },
      orderBy: { role: 'asc' },
      select: {
        id:             true,
        role:           true,
        name:           true,
        priceVnd:       true,
        durationMonths: true,
      },
    });
  }

  getVoidCodes() {
    return this.prisma.voidCodeDefinition.findMany({
      where:   { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select:  { id: true, code: true, name: true, description: true, severity: true },
    });
  }

  async getAllConfig() {
    const [domains, seams, archetypes, voidCodes, subscriptionPackages] = await Promise.all([
      this.getDomains(),
      this.getSeams(),
      this.getArchetypes(),
      this.getVoidCodes(),
      this.getSubscriptionPackages(),
    ]);
    return { domains, seams, archetypes, voidCodes, subscriptionPackages };
  }
}