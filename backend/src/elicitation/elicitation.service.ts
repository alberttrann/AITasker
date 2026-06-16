import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { FastapiClient } from './fastapi.client';

@Injectable()
export class ElicitationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fastapiClient: FastapiClient,
  ) {}

  // Session creation 
  // Blueprint: INSERT elicitation_sessions with current_stage=1, state=IN_PROGRESS.
  // Return existing IN_PROGRESS session if one already exists for this user - prevents duplicate sessions when the CEO navigates away and returns.
  async createSession(userId: string) {
    const existingSession = await this.prisma.elicitationSession.findFirst({
      where: { userId, state: 'IN_PROGRESS' },
    });

    if (existingSession) {
      return existingSession;
    }

    return this.prisma.elicitationSession.create({
      data: {
        userId,
        state: 'IN_PROGRESS',
        currentStage: 1,
      },
    });
  }

  // Stage 1 - Extract symptoms and voids
  // Blueprint: CEO free-text -> FastAPI stage1-extract -> persist symptoms + voids
  // -> advance to stage 2.
  //
  // FIX (blocking): aiResponse.symptoms was previously discarded.
  // Stage 5 synthesis needs stage1SymptomsJson to build the Stage5Request.
  // Both symptoms AND voids are persisted here; neither can be lost.
  async processStage1(sessionId: string, symptomText: string) {
    const session = await this.prisma.elicitationSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) throw new NotFoundException('Elicitation session not found.');

    if (session.currentStage !== 1) {
      throw new BadRequestException(
        `Session is at stage ${session.currentStage}, expected stage 1.`,
      );
    }

    // Call ai-service 
    const aiResponse = await this.fastapiClient.stage1Extract({
      symptom_text: symptomText,
    });

    // Persist BOTH extracted symptoms and detected voids.
    // stage1SymptomsJson is required by processStage5 when building the
    // Stage5Request.stage1_symptoms field for the synthesis call.
    return this.prisma.elicitationSession.update({
      where: { id: sessionId },
      data: {
        currentStage:        2,
        stage1SymptomsJson:  aiResponse.symptoms as any,
        voidListJson:        aiResponse.voids    as any,
        updatedAt:           new Date(),
      },
    });
  }

  // Stage 2 - Lock archetype, acknowledge voids
  // Blueprint: CEO selects project archetype -> archetype locked on session ->
  // advance to stage 3.
  //
  // acknowledgedVoidCodes: list of void_code strings the CEO explicitly saw and
  // accepted. Accepted voids are marked injected:true in void_list_json so the
  // quality gate knows which voids the CEO has been warned about.
  async processStage2(
    sessionId: string,
    archetype: string,
    acknowledgedVoidCodes?: string[],
  ) {
    const session = await this.prisma.elicitationSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) throw new NotFoundException('Elicitation session not found.');

    if (session.currentStage !== 2) {
      throw new BadRequestException(
        `Session is at stage ${session.currentStage}, expected stage 2.`,
      );
    }

    // Mark acknowledged voids as injected:true so the quality gate can
    // distinguish "CEO was warned and proceeded" from "void was undetected".
    let updatedVoidList = (
      session.voidListJson as Array<{ void_code: string; injected?: boolean }>
    ) ?? [];

    if (acknowledgedVoidCodes?.length) {
      updatedVoidList = updatedVoidList.map((v) => ({
        ...v,
        injected: acknowledgedVoidCodes.includes(v.void_code) ? true : v.injected,
      }));
    }

    return this.prisma.elicitationSession.update({
      where: { id: sessionId },
      data: {
        archetype:    archetype,
        voidListJson: updatedVoidList as any,
        currentStage: 3,
        updatedAt:    new Date(),
      },
    });
  }

  // Stage 3, 4, 5
  // TODO: implement processStage3, processStage4, processStage5.
  //
  // processStage5 will call fastapiClient.stage5Synthesize() and must build
  // Stage5Request using:
  //   session.stage1SymptomsJson  -> stage1_symptoms
  //   session.archetype           -> stage2_archetype
  //   session.stage3ProbesJson    -> stage3_probes
  //   session.stage4TechInputsJson-> stage4_tech_inputs
  //   session.voidListJson        -> void_list_json
  // All five fields must exist on the session before calling synthesize.
}