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
import { EmailValidatorService } from '../auth/email-validator.service';
const COMPLETENESS_GATE = 0.70;

const VOID_TO_STAGE: Record<string, number> = {
  UNCLEAR_SUCCESS_METRIC: 3,
  TIMELINE_UNREALISTIC:   3,
  INTEGRATION_UNCLEAR:    4,
  MISSING_TECHNICAL_ARTIFACT: 4,
};

const HANDOFF_TOKEN_EXPIRY = '72h';
const TECH_TEAM_USER_ID_KEY = '_tech_team_user_id';

export interface ProjectPublishedEvent {
  projectId:  string;
  candidates: MatchResult[];
}

@Injectable()
export class ElicitationService {
  constructor(
    private readonly prisma:                PrismaService,
    private readonly fastapiClient:         FastapiClient,
    private readonly jwtService:            JwtService,
    private readonly authService:           AuthService,
    private readonly matchingHelper:        MatchingHelperService,
    private readonly eventEmitter:          EventEmitter2,
    private readonly emailValidatorService: EmailValidatorService, 
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

    let gateResult = undefined;
    if (session.state === 'RETURNED') {
      const decision = await this.prisma.platformDecision.findFirst({
        where: { entityId: session.id, decisionType: 'SPEC_AUTO_RETURN' },
        orderBy: { createdAt: 'desc' },
      });
      if (decision) {
        gateResult = {
          gate_passed: false,
          completeness_score: decision.llmConfidence,
          advisory_note: decision.advisoryNote,
          return_to_stage: session.currentStage,
          flagged_void: null,
        };
      }
    }

    return {
      ...session,
      project_id: session.project?.id,
      projectId: session.project?.id,
      gateResult,
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

    // LLM skip: if content is identical to what's already stored, skip AI call
    if (
      session.stage1SymptomsJson &&
      session.stage1OriginalInput === symptomText.trim()
    ) {
      if (session.currentStage === 1) {
        return this.prisma.elicitationSession.update({
          where: { id: sessionId },
          data: { currentStage: 2 },
        });
      }
      return session; 
    }

    // Fetch live config for prompt template rendering 
    const [archetypes, voidCodesRaw] = await Promise.all([
      this.prisma.archetypeDefinition.findMany({
        where: { isActive: true }, orderBy: { sortOrder: 'asc' },
        select: { code: true, name: true, description: true },
      }),
      // Void codes are now DB-driven via VoidCodeDefinition table (Step 3/4 above).
      // Admin can add/edit/remove void types without code redeployment.
      this.prisma.voidCodeDefinition.findMany({
        where: { isActive: true }, orderBy: { sortOrder: 'asc' },
        select: { code: true, description: true },
      }),
    ]);

    const aiResponse = await this.fastapiClient.stage1Extract({
      symptom_text: symptomText,
      archetypes,
      void_codes: voidCodesRaw,
    });
    if (!aiResponse.symptoms || aiResponse.symptoms.length === 0) {
      throw new BadRequestException(
        'Your description does not contain any recognizable technical or business symptoms. Please provide more detail about your project.'
      );
    }

    // Try to extract budget signal from scale_signals if AI surfaced one
    const budgetSignal = (aiResponse.scale_signals as any)?.budget_vnd ?? null;

    return this.prisma.elicitationSession.update({
      where: { id: sessionId },
      data: {
        currentStage:               2,
        stage1OriginalInput:        symptomText.trim(),
        stage1SymptomsJson:         aiResponse.symptoms as any,
        voidListJson:               aiResponse.voids as any,
        recommendedArchetypesJson:  (aiResponse.recommended_archetypes ?? []) as any,
        estimatedBudgetVnd:         budgetSignal ? BigInt(budgetSignal) : undefined,
        criticalArtifactsJson:      (aiResponse.critical_artifacts_required ?? []) as any,
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
        `Based on your Stage 1 symptoms, please select one of the AI-recommended archetypes instead.`
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

    // Fetch probe questions dynamically from DB
    const questions = await this.prisma.probeQuestion.findMany({
      where: { archetypeCode: session.archetype, isActive: true },
      orderBy: { displayOrder: 'asc' },
      select: { questionText: true },
    });
    if (questions.length === 0) {
      throw new BadRequestException(
        `No probe questions configured for archetype ${session.archetype}. Please ask admin to configure them.`,
      );
    }
    const requiredQuestions = questions.map((q) => q.questionText);

    const missing = requiredQuestions.filter(
      (q) => !probeResponses[q] || probeResponses[q].trim().length === 0,
    );
    if (missing.length > 0) {
      throw new BadRequestException(
        `All ${requiredQuestions.length} probe questions must be answered. Missing: ${missing.join(' | ')}`,
      );
    }

    let vaguenessResult;
    try {
      vaguenessResult = await this.fastapiClient.stage3VaguenessCheck({
        archetype:        session.archetype,
        probe_questions:  requiredQuestions,
        probe_responses:  probeResponses,
        // pass symptom context so AI can check relevancy
        stage1_symptoms:  (session.stage1SymptomsJson as string[]) ?? [],
        stage1_voids:     (session.voidListJson as any[]) ?? [],
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
    if (session.currentStage !== 4 && session.currentStage !== 5) {
      throw new BadRequestException(`Session is at stage ${session.currentStage}, expected stage 4 or 5 (retry).`);
    }

    const techInputs = {
      current_stack:            dto.current_stack,
      data_available:           dto.data_available,
      latency_requirement:      dto.latency_requirement ?? null,
      additional_requirement_1: dto.additional_requirement_1 ?? null,
      // include submitted artifact content
      technical_artifacts:      dto.technical_artifacts ?? {},
    };

    // check which critical artifacts are still missing
    const criticalArtifacts = (session.criticalArtifactsJson as any[]) ?? [];
    const submittedKeys = Object.entries(dto.technical_artifacts ?? {})
      .filter(([, content]) => content.trim().length > 0)
      .map(([key]) => key);
    const missingArtifacts = criticalArtifacts.filter(
      (a: any) => !submittedKeys.includes(a.artifact_key),
    );

    const updated = await this.prisma.elicitationSession.update({
      where: { id: sessionId },
      data: {
        currentStage:         5,
        stage4TechInputsJson: techInputs as any,
        state:                'IN_PROGRESS',
        updatedAt:            new Date(),
      },
    });

    const updatedSession = await this.prisma.elicitationSession.update({
      where: { id: sessionId },
      data: {
        currentStage:         5,
        stage4TechInputsJson: techInputs as any,
        stage4DraftJson:      null,    // draft consumed on submit
        state:                'IN_PROGRESS',
        updatedAt:            new Date(),
      },
    });

    return {
      session: updatedSession,
      // FE shows these as warnings (not a hard block — CEO can still publish)
      missingArtifacts,
    };
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

    if (session.currentStage !== 4 && session.currentStage !== 5) {
      throw new BadRequestException(`Session is at stage ${session.currentStage}, expected stage 4 or 5 (retry).`);
    }

    const techInputs = {
      current_stack:            dto.current_stack,
      data_available:           dto.data_available,
      latency_requirement:      dto.latency_requirement ?? null,
      additional_requirement_1: dto.additional_requirement_1 ?? null,
      // include submitted artifact content
      technical_artifacts:      dto.technical_artifacts ?? {},
      // Persist the exact handoff submitter with this session. This internal
      // value is removed before the technical context is sent to the AI service.
      [TECH_TEAM_USER_ID_KEY]:   techTeamUserId,
    };

    // check which critical artifacts are still missing
    const criticalArtifacts = (session.criticalArtifactsJson as any[]) ?? [];
    const submittedKeys = Object.entries(dto.technical_artifacts ?? {})
      .filter(([, content]) => content.trim().length > 0)
      .map(([key]) => key);
    const missingArtifacts = criticalArtifacts.filter(
      (a: any) => !submittedKeys.includes(a.artifact_key),
    );

    const updated = await this.prisma.elicitationSession.update({
      where: { id: sessionId },
      data: {
        currentStage:         5,
        stage4TechInputsJson: techInputs as any,
        stage4DraftJson:      null,    // draft consumed on submit
        state:                'IN_PROGRESS',
        updatedAt:            new Date(),
      },
    });

    this.eventEmitter.emit('socket.broadcast', {
      userId: session.userId, // The CEO
      event: 'notification:generic',
      payload: {
        type: 'system',
        title: 'Technical Context Submitted',
        body: 'Your Tech Lead has completed Stage 4. Synthesis will begin shortly.',
      }
    });

    return {
      session: updated,
      // FE shows these as warnings (not a hard block — CEO can still publish)
      missingArtifacts,
    };
  }

  async processStage5(sessionId: string, userId: string) {
    const session = await this.findSessionOrThrow(sessionId);
    this.assertOwnership(session, userId);           
    this.assertStage(session, 5);                    

    const techTeamUserId = await this.resolveTechTeamUserId(session, userId);
    return this.runSynthesis(session, techTeamUserId);
  }

  async inviteTechTeam(sessionId: string, ceoUserId: string, email: string) {
    const session = await this.findSessionOrThrow(sessionId);
    this.assertOwnership(session, ceoUserId);

    const normalizedEmail =
      typeof email === 'string' ? email.trim().toLowerCase() : '';

    // Verify the email is legitimate (MX + disposable block) before generating link
    await this.emailValidatorService.assertValidEmail(normalizedEmail);

    const jti = randomUUID();

    const inviteToken = await this.jwtService.signAsync(
      {
        sessionId: session.id,
        ceoId:     ceoUserId,
        email:     normalizedEmail,
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
      `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/register/handoff/${inviteToken}`;

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

    const techTeamUserId = await this.resolveTechTeamUserId(session, userId);
    return this.runSynthesis(session, techTeamUserId);
  }

  // Private helpers
  async saveDraft(
    sessionId: string,
    userId: string,
    symptomTextDraft: string,
  ): Promise<{ saved: boolean; reason?: string }> {
    const session = await this.findSessionOrThrow(sessionId);
    this.assertOwnership(session, userId);

    if (session.currentStage !== 1) {
      return { saved: false, reason: 'stage_already_submitted' };
    }
    if (session.state !== 'IN_PROGRESS') {
      return { saved: false, reason: 'session_not_active' };
    }

    await this.prisma.elicitationSession.update({
      where: { id: sessionId },
      data: { symptomTextDraft },
    });

    return { saved: true };
  }

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

  private getRecordedTechTeamUserId(session: any): string | undefined {
    const inputs = session.stage4TechInputsJson;
    if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs)) return undefined;
    const userId = (inputs as Record<string, unknown>)[TECH_TEAM_USER_ID_KEY];
    return typeof userId === 'string' && userId.length > 0 ? userId : undefined;
  }

  private async resolveTechTeamUserId(session: any, ceoUserId: string): Promise<string | undefined> {
    const recordedUserId = this.getRecordedTechTeamUserId(session);
    if (recordedUserId) return recordedUserId;
    if (session.scenarioType === 'SCENARIO_B') return undefined;

    // Legacy sessions did not persist the Stage 4 submitter. Repair only the
    // unambiguous case instead of assigning an arbitrary Tech Team profile.
    const unlinkedProfiles = await this.prisma.techTeamProfile.findMany({
      where: { linkedClientId: ceoUserId, linkedProjectId: null },
      select: { userId: true },
      take: 2,
    });
    return unlinkedProfiles.length === 1 ? unlinkedProfiles[0].userId : undefined;
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

    // Fetch live config from DB to inject into prompt templates
    const [domains, seams, archetypes] = await Promise.all([
      this.prisma.domainDefinition.findMany({
        where: { isActive: true }, orderBy: { sortOrder: 'asc' },
        select: { code: true, name: true },
      }),
      this.prisma.seamDefinition.findMany({
        where: { isActive: true }, orderBy: { sortOrder: 'asc' },
        select: { code: true, name: true },
      }),
      this.prisma.archetypeDefinition.findMany({
        where: { isActive: true }, orderBy: { sortOrder: 'asc' },
        select: { code: true, name: true, description: true },
      }),
    ]);

    const stage4TechInputs = {
      ...((session.stage4TechInputsJson as Record<string, unknown>) ?? {}),
    };
    delete stage4TechInputs[TECH_TEAM_USER_ID_KEY];

    const stage5Request = {
      session_id:                    session.id,
      stage1_symptoms:               session.stage1SymptomsJson as string[],
      stage2_archetype:              session.archetype!,
      stage3_probes:                 session.stage3ProbesJson      as Record<string, unknown>,
      stage4_tech_inputs:            stage4TechInputs,
      void_list_json:                (session.voidListJson as Array<Record<string, unknown>>) ?? [],
      is_self_technical:             effectiveSelfTechnical,
      estimated_budget_vnd:          session.estimatedBudgetVnd
                                       ? Number(session.estimatedBudgetVnd)
                                       : null,
      // pass critical artifacts and what was submitted
      critical_artifacts_required:   (session.criticalArtifactsJson as any[]) ?? [],
      // live config for Jinja2 template rendering
      domains,
      seams,
      archetypes,
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

  async recommendTechContext(sessionId: string, userId: string, additionalRequirement?: string) {
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
        additional_requirement_1: additionalRequirement, // ← FIX: matches interface
        void_list_json: (session.voidListJson as any[]) ?? [],
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
          clientId:                  session.userId,
          elicitationSessionId:      session.id,
          projectName:               artifactA.project_name ?? 'Untitled AI Project',
          state:                     'PUBLISHED',
          archetype:                 artifactA.archetype   ?? null,
          tier:                      artifactA.volume_tier ?? null,
          selfTechnical:             effectiveSelfTechnical,
          requiredSeamsJson:         synthesis.required_seams_json      as any,
          requiredDomainsJson:       synthesis.required_domains_json    as any,
          milestoneFrameworkJson:    synthesis.milestone_framework_json as any,
          artifactAJson:             synthesis.artifact_a_json          as any,
          artifactBJson:             synthesis.artifact_b_json          as any,
          estimatedTotalCostVnd:     synthesis.estimated_total_cost_vnd && !isNaN(Number(synthesis.estimated_total_cost_vnd))
                                       ? BigInt(Math.round(Number(synthesis.estimated_total_cost_vnd)))
                                       : null,
          estimatedTotalDurationDays: synthesis.estimated_total_duration_days && !isNaN(Number(synthesis.estimated_total_duration_days))
                                       ? Math.round(Number(synthesis.estimated_total_duration_days))
                                       : null,
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
      
      // 1. Ưu tiên cái Void do AI ở Stage 5 vừa soi ra 
      // 2. Nếu AI quên trả về, fallback xài cái Void chưa fix từ Stage 1
      flaggedVoid = synthesis.flagged_void ?? anyUnfixed?.void_code ?? null;

      if (flaggedVoid) {
        // Tự động map cái Void đó về đúng Stage cần sửa
        returnToStage = VOID_TO_STAGE[flaggedVoid] ?? 1;
        advisoryNote =
          `Your project specification scored ${pct}% completeness. ` +
          `Please revisit Stage ${returnToStage} and provide more detail about ` +
          `${flaggedVoid.replace(/_/g, ' ').toLowerCase()}.`;
      } else {
        // 3. Ultimate Fallback: Điểm bị trừ vì technical mỏng, chứ không vướng Void cụ thể nào.
        // Đẩy về Stage 4 an toàn nhất.
        returnToStage = 4;
        advisoryNote = 
          `Your project specification scored ${pct}% completeness. While your initial problem ` +
          `description was clear, the technical context is currently too thin for experts ` +
          `to accurately bid on. Please revisit Stage 4 and add more architectural details.`;
      }
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
    if (targetStage > session.currentStage) throw new BadRequestException('Can only revert backwards.');

    const data: any = { currentStage: targetStage, state: 'IN_PROGRESS', updatedAt: new Date() };

    // if (targetStage <= 4) data.stage4TechInputsJson = null;
    // if (targetStage <= 3) {
    //   data.stage3ProbesJson = null;
    //   data.scenarioType = null;
    // }
    // if (targetStage <= 2) {
    //   data.archetype = null;
    //   data.recommendedArchetypesJson = null;
    // }
    // if (targetStage === 1) {
    //   data.stage1SymptomsJson = null;
    //   data.voidListJson = [];
    // }

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

  async saveStage4Draft(sessionId: string, userId: string, draftJson: Record<string, unknown>) {
    const session = await this.findSessionOrThrow(sessionId);
    this.assertOwnership(session, userId);

    if (session.currentStage !== 4 && session.currentStage !== 5) {
      return { saved: false, reason: 'stage_not_applicable' };
    }

    await this.prisma.elicitationSession.update({
      where: { id: sessionId },
      data: { stage4DraftJson: draftJson as any },
    });

    return { saved: true };
  }
}
