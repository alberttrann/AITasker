import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { FastapiClient } from './fastapi.client';

@Injectable()
export class ElicitationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fastapiClient: FastapiClient,
  ) {}

  async createSession(userId: string) {
    // check for existing session, return if exists
    const existingSession = await this.prisma.elicitationSession.findFirst({
      where: {
        userId: userId,
        state: 'IN_PROGRESS',
      },
    });

    if (existingSession) {
      return existingSession;
    }

    // if not create session and set stage = 1
    return this.prisma.elicitationSession.create({
      data: {
        userId: userId,
        state: 'IN_PROGRESS',
        currentStage: 1,
      },
    });
  }

  async processStage1(sessionId: string, symptomText: string) {
    // fetch session and verify it's at stage 1
    const session = await this.prisma.elicitationSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Session not found.');
    }

    if (session.currentStage !== 1) {
      throw new BadRequestException('Session is not at stage 1.');
    }

    // call fastapi wrapper
    // makes HTTP POST request to ai service with sympton text
    const aiResponse = await this.fastapiClient.stage1Extract({
      symptom_text: symptomText,
    });

    // update the DB
    const updatedSession = await this.prisma.elicitationSession.update({
      where: { id: sessionId },
      data: {
        currentStage: 2,
        voidListJson: aiResponse.voids as any,
        updatedAt: new Date(),
      },
    });

    return updatedSession;
  }

  async processStage2(sessionId: string, archetype: string, acknowledgedVoidCodes?: string[]) {
    const session = await this.prisma.elicitationSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Session not found.');
    }

    if (session.currentStage !== 2) {
      throw new BadRequestException('Session is not at stage 2.');
    }

    // Mark acknowledged voids as injected: true inside void_list_json
    let updatedVoidList = session.voidListJson as Array<{ void_code: string; injected?: boolean }>;

    if (acknowledgedVoidCodes && acknowledgedVoidCodes.length > 0) {
      updatedVoidList = updatedVoidList.map((v) => ({
        ...v,
        injected: acknowledgedVoidCodes.includes(v.void_code) ? true : v.injected,
      }));
    }

    return this.prisma.elicitationSession.update({
      where: { id: sessionId },
      data: {
        archetype: archetype,
        voidListJson: updatedVoidList as any,
        currentStage: 3,
        updatedAt: new Date(),
      },
    });
  }
}
