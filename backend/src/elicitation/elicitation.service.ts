import { randomUUID } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService }          from '../database/prisma.service';
import { FastapiClient, MatchResult } from './fastapi.client';
import { AuthService }            from '../auth/auth.service';
import { MatchingHelperService }  from '../shared/matching/matching-helper.service';
import { Stage4Dto }              from './dto/stage4.dto';
import { Stage4HandoffDto }       from './dto/stage4-handoff.dto';

const COMPLETENESS_GATE = 0.70;

const VOID_TO_STAGE: Record<string, number> = {
  UNCLEAR_SUCCESS_METRIC: 3,
  TIMELINE_UNREALISTIC:   3,
  INTEGRATION_UNCLEAR:    4,
};

const HANDOFF_TOKEN_EXPIRY = '72h';

const ARCHETYPE_PROBE_QUESTIONS: Record<string, [string, string, string, string]> = {
  '1': [
    'Roughly how many people will search or ask questions per day?',
    'When someone gets a wrong or unhelpful answer, what do you expect to happen next?',
    'Does this need to pull from documents/systems you already have, and which ones?',
    'How quickly does an answer need to appear after someone asks?',
  ],
  '2': [
    'Roughly how many users will see recommendations, and how often?',
    'What should happen if someone ignores or dislikes a recommendation?',
    'Where do you already track what users like/buy/view — any existing system?',
    'How fresh do recommendations need to be (instant, hourly, daily)?',
  ],
  '3': [
    'Roughly how many items need classifying per day?',
    'What should happen when the system isn\u2019t confident about a classification?',
    'Where does the data to classify come from today — any existing system?',
    'How quickly does a classification decision need to be made?',
  ],
  '4': [
    'Roughly how much content needs generating per day/week?',
    'What happens if generated content is wrong or inappropriate — who reviews it?',
    'Does generated content need to match an existing brand voice/system/template?',
    'How long can someone wait for content to be generated?',
  ],
  '5': [
    'How far ahead are you trying to predict, and how often do you need a new prediction?',
    'What happens today when a prediction turns out wrong?',
    'What historical data do you already have to learn from?',
    'How quickly after new data arrives do you need an updated prediction?',
  ],
  '6': [
    'Roughly how many items (images/audio/video) need processing per day?',
    'What should happen when the system can\u2019t confidently interpret an input?',
    'Where does this input data come from today — any existing system?',
    'How quickly does processing need to complete after input arrives?',
  ],
};

export interface ProjectPublishedEvent {
  projectId:  string;
  candidates: MatchResult[];
}

@Injectable()
export class ElicitationService {
  constructor(
    private readonly prisma:         PrismaService,
    private readonly fastapiClient:  FastapiClient,
    private readonly jwtService:     JwtService,
    private readonly authService:    AuthService,
    private readonly matchingHelper: MatchingHelperService,
    private readonly eventEmitter:   EventEmitter2,
  ) {}

  async createSession(userId: string) {
    const existing = await this.prisma.elicitationSession.findFirst({
      where: { userId, state: 'IN_PROGRESS' },
    });
    if (existing) return existing;

    return this.prisma.elicitationSession.create({
      data: { userId, state: 'IN_PROGRESS', currentStage: 1 },
    });
  }

  async getSession(sessionId: string, userId: string) {
    const session = await this.prisma.elicitationSession.findUnique({
      where: { id: sessionId },
      include: { project: { select: { id: true } } },
    });
    if (!session) throw new NotFoundException('Elicitation session not found.');
    this.assertOwnership(session, userId);
    return {
      ...session,
      project_id: session.project?.id,
      projectId: session.project?.id,
    };
  }

  async setSelfTechnical(sessionId: string, userId: string, selfTechnical: boolean) {
    const session = await this.findSessionOrThrow(sessionId);
    this.assertOwnership(session, userId);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    const overrides = ((user.selfTechnicalProjects as any[]) ?? []).filter(
      (o) => o.sessionId !== sessionId,
    );
    overrides.push({ sessionId, override: selfTechnical });

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { selfTechnicalProjects: overrides as any },
    });

    const access_token = await this.authService.jwtGeneratePayload(updatedUser);

    return { access_token, selfTechnical };
  }

  private getEffectiveSelfTechnical(session: { id: string; userId: string }, user: any): boolean {
    const overrides = (user.selfTechnicalProjects as any[]) ?? [];
    const override = overrides.find((o) => o.sessionId === session.id);
    return override ? override.override : (user.selfTechnical ?? false);
  }

  async processStage1(sessionId: string, symptomText: string, userId: string) {
    const session = await this.findSessionOrThrow(sessionId);
    this.assertOwnership(session, userId);
    this.assertStage(session, 1);

    const aiResponse = await this.fastapiClient.stage1Extract({
      symptom_text: symptomText,
    });

    return this.prisma.elicitationSession.update({
      where: { id: sessionId },
      data: {
        currentStage:               2,
        stage1SymptomsJson:         aiResponse.symptoms as any,
        voidListJson:               aiResponse.voids as any,
        recommendedArchetypesJson:  (aiResponse.recommended_archetypes ?? []) as any,
        state:                      'IN_PROGRESS',
        updatedAt:                  new Date(),
      },
    });
  }

  async processStage2(
    sessionId:              string,
    archetype:              string,
    userId:                 string,
    acknowledgedVoidCodes?: string[],
  ) {
    const session = await this.findSessionOrThrow(sessionId);
    this.assertOwnership(session, userId);
    this.assertStage(session, 2);

    const recommended = (session.recommendedArchetypesJson as string[]) ?? [];
    if (recommended.length > 0 && !recommended.includes(archetype)) {
      throw new BadRequestException(
        `Archetype ${archetype} is not among the AI-recommended options for this project: ` +
        `${recommended.join(', ')}.`,
      );
    }

    let updatedVoids = (
      session.voidListJson as Array<{ void_code: string; injected?: boolean }>
    ) ?? [];

    if (acknowledgedVoidCodes?.length) {
      updatedVoids = updatedVoids.map((v) => ({
        ...v,
        injected: acknowledgedVoidCodes.includes(v.void_code) ? true : v.injected,
      }));
    }

    return this.prisma.elicitationSession.update({
      where: { id: sessionId },
      data: {
        archetype:    archetype,
        voidListJson: updatedVoids as any,
        currentStage: 3,
        state:        'IN_PROGRESS',
        updatedAt:    new Date(),
      },
    });
  }

  async processStage3(
    sessionId:      string,
    probeResponses: Record<string, string>,
    userId:         string,
  ) {
    const session = await this.findSessionOrThrow(sessionId);
    this.assertOwnership(session, userId);
    this.assertStage(session, 3);

    if (!session.archetype) {
      throw new BadRequestException('Session has no archetype locked — complete Stage 2 first.');
    }

    const requiredQuestions = ARCHETYPE_PROBE_QUESTIONS[session.archetype];
    if (!requiredQuestions) {
      throw new BadRequestException(`No probe questions defined for archetype ${session.archetype}.`);
    }

    const missing = requiredQuestions.filter(
      (q) => !probeResponses[q] || probeResponses[q].trim().length === 0,
    );
    if (missing.length > 0) {
      throw new BadRequestException(
        `All 4 probe questions must be answered. Missing: ${missing.join(' | ')}`,
      );
    }

    let vaguenessResult;
    try {
      vaguenessResult = await this.fastapiClient.stage3VaguenessCheck({
        archetype:       session.archetype,
        probe_responses: probeResponses,
      });
    } catch (err) {
      vaguenessResult = { vague_answers: [] };
    }

    if (vaguenessResult.vague_answers?.length > 0) {
      return { advanced: false, vague_answers: vaguenessResult.vague_answers };
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const effectiveSelfTechnical = this.getEffectiveSelfTechnical(session, user);
    const scenarioType = effectiveSelfTechnical ? 'SCENARIO_B' : 'SCENARIO_A';

    await this.prisma.elicitationSession.update({
      where: { id: sessionId },
      data: {
        currentStage:     4,
        stage3ProbesJson: probeResponses as any,
        scenarioType:     scenarioType,
        state:            'IN_PROGRESS',
        updatedAt:        new Date(),
      },
    });

    return {
      advanced:        true,
      currentStage:    4,
      stage4_required: true,
      scenario_type:   scenarioType,
    };
  }

  async processStage4(sessionId: string, dto: Stage4Dto, userId: string) {
    const session = await this.findSessionOrThrow(sessionId);
    this.assertOwnership(session, userId);
    this.assertStage(session, 4);

    const techInputs = {
      current_stack:       dto.current_stack,
      data_available:      dto.data_available,
      latency_requirement: dto.latency_requirement ?? null,
    };

    const updated = await this.prisma.elicitationSession.update({
      where: { id: sessionId },
      data: {
        currentStage:         5,
        stage4TechInputsJson: techInputs as any,
        state:                'IN_PROGRESS',
        updatedAt:            new Date(),
      },
    });

    return this.runSynthesis(updated);
  }

  async processStage4Handoff(
    sessionId:      string,
    dto:            Stage4HandoffDto,
    techTeamUserId: string,
  ) {
    const session = await this.findSessionOrThrow(sessionId);

    const techProfile = await this.prisma.techTeamProfile.findUnique({
      where: { userId: techTeamUserId },
    });

    if (!techProfile || techProfile.linkedClientId !== session.userId) {
      throw new UnauthorizedException(
        'Tech Team member is not linked to the CEO who owns this session.',
      );
    }

    this.assertStage(session, 4);

    const techInputs = {
      current_stack:       dto.current_stack,
      data_available:      dto.data_available,
      latency_requirement: dto.latency_requirement ?? null,
    };

    const updated = await this.prisma.elicitationSession.update({
      where: { id: sessionId },
      data: {
        currentStage:         5,
        stage4TechInputsJson: techInputs as any,
        state:                'IN_PROGRESS',
        updatedAt:            new Date(),
      },
    });

    return this.runSynthesis(updated, techTeamUserId);
  }

  async inviteTechTeam(sessionId: string, ceoUserId: string) {
    const session = await this.findSessionOrThrow(sessionId);
    this.assertOwnership(session, ceoUserId);

    const jti = randomUUID();

    const inviteToken = await this.jwtService.signAsync(
      {
        sessionId: session.id,
        ceoId:     ceoUserId,
        jti:       jti,
        purpose:   'tech-team-handoff',
      },
      { expiresIn: HANDOFF_TOKEN_EXPIRY },
    );

    await this.prisma.elicitationSession.update({
      where: { id: sessionId },
      data: {
        handoffTokenJti:   jti,
        handoffConsumedAt: null,
      },
    });

    const inviteLink =
      `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/tech-team/register?token=${inviteToken}`;

    return {
      invite_token: inviteToken,
      invite_link:  inviteLink,
      expires_in:   HANDOFF_TOKEN_EXPIRY,
    };
  }

  async retryFailedSynthesis(sessionId: string, userId: string) {
    const session = await this.findSessionOrThrow(sessionId);
    this.assertOwnership(session, userId);

    if (session.state === 'COMPLETED') {
      throw new ConflictException('This session has already been published as a project.');
    }
    if (session.currentStage !== 5) {
      throw new BadRequestException(
        `Session is at stage ${session.currentStage}. All 4 stages must be completed first.`,
      );
    }

    return this.runSynthesis(session);
  }

  // Private helpers

  private async findSessionOrThrow(sessionId: string) {
    const session = await this.prisma.elicitationSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Elicitation session not found.');
    return session;
  }

  private assertOwnership(session: { userId: string }, userId: string) {
    if (session.userId !== userId) {
      throw new ForbiddenException('You do not have access to this session.');
    }
  }

  private assertStage(session: { currentStage: number }, expected: number) {
    if (session.currentStage !== expected) {
      throw new BadRequestException(
        `Session is at stage ${session.currentStage}, expected stage ${expected}.`,
      );
    }
  }

  private assertAllStagesComplete(session: any) {
    const missing: string[] = [];
    if (!session.stage1SymptomsJson)   missing.push('stage 1 (symptoms)');
    if (!session.archetype)            missing.push('stage 2 (archetype)');
    if (!session.stage3ProbesJson)     missing.push('stage 3 (probes)');
    if (!session.stage4TechInputsJson) missing.push('stage 4 (technical context)');

    if (missing.length > 0) {
      throw new BadRequestException(
        `Cannot synthesise: missing data from ${missing.join(', ')}.`,
      );
    }
  }

  private async runSynthesis(session: any, techTeamUserId?: string): Promise<
    | { gate_passed: true;  completeness_score: number; project_id: string }
    | { gate_passed: false; completeness_score: number; flagged_void: string | null;
        return_to_stage: number; advisory_note: string }
  > {
    if (session.state === 'COMPLETED') {
      throw new ConflictException('This session has already been published as a project.');
    }

    this.assertAllStagesComplete(session);

    const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
    const effectiveSelfTechnical = this.getEffectiveSelfTechnical(session, user);

    const stage5Request = {
      session_id:         session.id,
      stage1_symptoms:    session.stage1SymptomsJson as string[],
      stage2_archetype:   session.archetype!,
      stage3_probes:      session.stage3ProbesJson      as Record<string, unknown>,
      stage4_tech_inputs: session.stage4TechInputsJson  as Record<string, unknown>,
      void_list_json:     (session.voidListJson as Array<Record<string, unknown>>) ?? [],
      is_self_technical:  effectiveSelfTechnical,
    };

    let synthesis;
    try {
      synthesis = await this.fastapiClient.stage5Synthesize(stage5Request);
    } catch (err) {
      throw new BadRequestException(
        'Project synthesis failed — the AI service did not respond in time. ' +
        'Please try again in a moment.',
      );
    }

    const completenessOk = synthesis.completeness_score >= COMPLETENESS_GATE;

    const voids = (
      session.voidListJson as Array<{ void_code: string; severity: string; injected?: boolean }>
    ) ?? [];
    const unresolvedHardVoid = voids.find((v) => v.severity === 'HIGH' && !v.injected);
    const noHardVoidsOk = !unresolvedHardVoid;

    // this candidate list, fetched ONCE here, is reused directly by
    // handleGatePassed's event payload — no second ai-service /llm/matching
    // call happens after publish anymore.
    let candidates: MatchResult[] = [];
    try {
      candidates = await this.matchingHelper.scoreEligibleExperts(
        synthesis.required_seams_json,
        synthesis.required_domains_json,
        (synthesis.artifact_a_json as any)?.archetype ?? session.archetype,
        session.userId,
      );
    } catch {
      candidates = [];
    }
    const candidatesOk = candidates.length >= 1;

    const gatePassed = completenessOk && noHardVoidsOk && candidatesOk;

    if (gatePassed) {
      return this.handleGatePassed(session, synthesis, candidates, techTeamUserId);
    }

    return this.handleGateFailed(session, synthesis, {
      completenessOk,
      noHardVoidsOk,
      candidatesOk,
      unresolvedHardVoid,
    });
  }

  async recommendTechContext(sessionId: string, userId: string) {
    const session = await this.findSessionOrThrow(sessionId);
    this.assertOwnership(session, userId);

    if (session.currentStage < 4) {
      throw new BadRequestException('Cannot recommend tech context before Stage 3 is complete.');
    }

    try {
      const response = await this.fastapiClient.stage4Recommend({
        stage1_symptoms: session.stage1SymptomsJson as string[],
        stage2_archetype: session.archetype!,
        stage3_probes: session.stage3ProbesJson as Record<string, unknown>,
      });
      return response;
    } catch (err) {
      throw new ServiceUnavailableException('AI Architect is currently unavailable.');
    }
  }

  private async handleGatePassed(
    session: any,
    synthesis: any,
    candidates: MatchResult[],
    techTeamUserId?: string,
  ): Promise<{
    gate_passed: true;
    completeness_score: number;
    project_id: string;
  }> {
    const artifactA = synthesis.artifact_a_json as any;

    const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
    const effectiveSelfTechnical = this.getEffectiveSelfTechnical(session, user);

    let project;
    try {
      project = await this.prisma.project.create({
        data: {
          clientId:               session.userId,
          elicitationSessionId:   session.id,
          projectName:            artifactA.project_name ?? 'Untitled AI Project',
          state:                  'PUBLISHED',
          archetype:              artifactA.archetype   ?? null,
          tier:                   artifactA.volume_tier ?? null,
          selfTechnical:          effectiveSelfTechnical,
          requiredSeamsJson:      synthesis.required_seams_json      as any,
          requiredDomainsJson:    synthesis.required_domains_json    as any,
          milestoneFrameworkJson: synthesis.milestone_framework_json as any,
          artifactAJson:          synthesis.artifact_a_json          as any,
          artifactBJson:          synthesis.artifact_b_json          as any,
        },
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new ConflictException('This session has already been published as a project.');
      }
      throw err;
    }

    await this.prisma.elicitationSession.update({
      where: { id: session.id },
      data:  { state: 'COMPLETED', updatedAt: new Date() },
    });

    // link the SPECIFIC Tech Team member who submitted Stage 4
    // for this session (if Scenario B) to the new project.
    if (techTeamUserId) {
      await this.prisma.techTeamProfile.update({
        where: { userId: techTeamUserId },
        data:  { linkedProjectId: project.id },
      });
    }

    // event-emitter pattern
    this.eventEmitter.emit('project.published', {
      projectId:  project.id,
      candidates: candidates,
    } as ProjectPublishedEvent);
 
    await this.prisma.platformDecision.create({
      data: {
        decisionType:  'ELICITATION_SYNTHESIS',
        entityType:    'projects',
        entityId:      project.id,
        llmConfidence: synthesis.completeness_score,
        decision:      'PUBLISHED',
      },
    });
 
    return {
      gate_passed:        true,
      completeness_score: synthesis.completeness_score,
      project_id:         project.id,
    };
  }

  private async handleGateFailed(
    session: any,
    synthesis: any,
    gateDetail: {
      completenessOk:      boolean;
      noHardVoidsOk:       boolean;
      candidatesOk:        boolean;
      unresolvedHardVoid?: { void_code: string };
    },
  ): Promise<{
    gate_passed: false;
    completeness_score: number;
    flagged_void: string | null;
    return_to_stage: number;
    advisory_note: string;
  }> {
    const pct = Math.round(synthesis.completeness_score * 100);

    let returnToStage = 1;
    let advisoryNote: string;
    let flaggedVoid: string | null = null;

    if (!gateDetail.noHardVoidsOk && gateDetail.unresolvedHardVoid) {
      flaggedVoid   = gateDetail.unresolvedHardVoid.void_code;
      returnToStage = VOID_TO_STAGE[flaggedVoid] ?? 1;
      advisoryNote =
        `Your project specification has an unresolved critical gap: ` +
        `${flaggedVoid.replace(/_/g, ' ').toLowerCase()}. ` +
        `Please revisit Stage ${returnToStage} and address it before publishing.`;
    } else if (!gateDetail.completenessOk) {
      const voids = (
        session.voidListJson as Array<{ void_code: string; severity: string; injected?: boolean }>
      ) ?? [];
      const anyUnfixed = voids.find((v) => !v.injected);
      flaggedVoid   = anyUnfixed?.void_code ?? null;
      returnToStage = VOID_TO_STAGE[flaggedVoid ?? ''] ?? 1;
      advisoryNote =
        `Your project specification scored ${pct}% completeness (minimum 70% required). ` +
        `Please revisit Stage ${returnToStage} and provide more detail` +
        (flaggedVoid ? ` about ${flaggedVoid.replace(/_/g, ' ').toLowerCase()}.` : '.');
    } else {
      returnToStage = session.currentStage;
      advisoryNote =
        `Your project specification is complete and well-defined, but we don't ` +
        `currently have any qualified experts available for this combination of ` +
        `skills. Your project will remain in draft — please check back soon, or ` +
        `adjust scope if you'd like to try a different approach.`;
    }

    await this.prisma.elicitationSession.update({
      where: { id: session.id },
      data: {
        state:        'RETURNED',
        currentStage: returnToStage,
        updatedAt:    new Date(),
      },
    });
 
    await this.prisma.platformDecision.create({
      data: {
        decisionType:  'SPEC_AUTO_RETURN',
        entityType:    'elicitation_sessions',
        entityId:      session.id,
        llmConfidence: synthesis.completeness_score,
        decision:      'RETURNED',
        advisoryNote:  advisoryNote,
      },
    });

    return {
      gate_passed:        false,
      completeness_score: synthesis.completeness_score,
      flagged_void:        flaggedVoid,
      return_to_stage:     returnToStage,
      advisory_note:       advisoryNote,
    };
  }

  async getSessions(userId: string) {
    return this.prisma.elicitationSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: { project: { select: { id: true, state: true } } },
    });
  }

  // 1. Get the currently active IN_PROGRESS session for the banner
  async getActiveSession(userId: string) {
    const session = await this.prisma.elicitationSession.findFirst({
      where: { userId, state: 'IN_PROGRESS' },
    });
    return session || null;
  }

  // 2. Abandon a session so the user can "Start Over"
  async abandonSession(sessionId: string, userId: string) {
    const session = await this.findSessionOrThrow(sessionId);
    this.assertOwnership(session, userId);
    if (session.state === 'COMPLETED') throw new ConflictException('Already completed.');

    return this.prisma.elicitationSession.update({
      where: { id: sessionId },
      data: { state: 'ABANDONED', updatedAt: new Date() },
    });
  }

  // 3. Get session history 
  async getSessionHistory(userId: string) {
    return this.prisma.elicitationSession.findMany({
      where: { userId, state: { in: ['ABANDONED', 'RETURNED'] } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async continueSession(sessionId: string, userId: string) {
    const session = await this.findSessionOrThrow(sessionId);
    this.assertOwnership(session, userId);
    if (session.state === 'COMPLETED') throw new ConflictException('Already completed.');

    return this.prisma.elicitationSession.update({
      where: { id: sessionId },
      data: { state: 'IN_PROGRESS', updatedAt: new Date() },
    });
  }

  async revertSession(sessionId: string, userId: string, targetStage: number) {
    const session = await this.findSessionOrThrow(sessionId);
    this.assertOwnership(session, userId);

    if (session.state === 'COMPLETED') throw new ConflictException('Already completed.');
    if (targetStage >= session.currentStage) throw new BadRequestException('Can only revert backwards.');

    const data: any = { currentStage: targetStage, state: 'IN_PROGRESS', updatedAt: new Date() };

    if (targetStage <= 4) data.stage4TechInputsJson = null;
    if (targetStage <= 3) {
      data.stage3ProbesJson = null;
      data.scenarioType = null;
    }
    if (targetStage <= 2) {
      data.archetype = null;
      data.recommendedArchetypesJson = null;
    }
    if (targetStage === 1) {
      data.stage1SymptomsJson = null;
      data.voidListJson = [];
    }

    return this.prisma.elicitationSession.update({
      where: { id: sessionId },
      data,
    });
  }

  async deleteSession(sessionId: string, userId: string) {
    const session = await this.findSessionOrThrow(sessionId);
    this.assertOwnership(session, userId);

    if (session.state === 'COMPLETED') {
      throw new ConflictException('Cannot delete a session that has already been published as a project.');
    }

    await this.prisma.elicitationSession.delete({
      where: { id: sessionId },
    });

    return { success: true, message: 'Session deleted successfully.' };
  }
}