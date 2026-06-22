import { JwtService } from '@nestjs/jwt';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService }    from '../database/prisma.service';
import { FastapiClient }    from './fastapi.client';
import { Stage4Dto }        from './dto/stage4.dto';
import { Stage4HandoffDto } from './dto/stage4-handoff.dto';

const COMPLETENESS_GATE = 0.70;

const VOID_TO_STAGE: Record<string, number> = {
  UNCLEAR_SUCCESS_METRIC: 3,
  TIMELINE_UNREALISTIC:   3,
  INTEGRATION_UNCLEAR:    4,
  // All others (NO_GROUND_TRUTH, NO_BASELINE, DATA_PRIVACY, SCOPE_CREEP) → Stage 1
};

const INVITE_TOKEN_EXPIRY = '24h'; // separate from login tokens (7d) — invites should be short-lived

@Injectable()
export class ElicitationService {
  constructor(
    private readonly prisma:        PrismaService,
    private readonly fastapiClient: FastapiClient,
    private readonly jwtService:    JwtService,
  ) {}

  
  
  async inviteTechTeam(sessionId: string, email: string, ceoUserId: string) {
    const session = await this.findSessionOrThrow(sessionId);
    this.assertOwnership(session, ceoUserId);
  

    const inviteToken = await this.jwtService.signAsync(
      {
        sessionId:    session.id,
        ceoId:        ceoUserId,
        invitedEmail: email,
        purpose:      'tech-team-handoff', // distinguishes from login/access tokens 
      },
      { expiresIn: INVITE_TOKEN_EXPIRY },
    );
  
    // NOTE: no email-sending utility exists in this codebase (confirmed —
    // no mail.service.ts anywhere, consistent with the no-email-verification
    // decision made earlier). The invite link is returned directly in the
    // response. The CEO is responsible for sharing it with their tech team
    // member through whatever channel they use (Slack, Zalo, etc).
    const inviteLink = `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/tech-team/register?token=${inviteToken}`;
  
    return {
      invite_token: inviteToken,
      invite_link:  inviteLink,
      expires_in:   INVITE_TOKEN_EXPIRY,
    };
  }    

  // Session creation
  async createSession(userId: string) {
    const existing = await this.prisma.elicitationSession.findFirst({
      where: { userId, state: 'IN_PROGRESS' },
    });
    if (existing) return existing;

    return this.prisma.elicitationSession.create({
      data: { userId, state: 'IN_PROGRESS', currentStage: 1 },
    });
  }

  // Read session 
  // verify the requesting user owns this session before returning it.
  async getSession(sessionId: string, userId: string) {
    const session = await this.findSessionOrThrow(sessionId);
    this.assertOwnership(session, userId);
    return session;
  }

  // Stage 1 — Extract symptoms and voids
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
        currentStage:       2,
        stage1SymptomsJson: aiResponse.symptoms as any,
        voidListJson:       aiResponse.voids    as any,
        // if this is a re-do after a returned session, flip back to IN_PROGRESS now that the CEO is actively fixing it.
        state:              'IN_PROGRESS',
        updatedAt:          new Date(),
      },
    });
  }

  // Stage 2 — Lock archetype, acknowledge voids
  async processStage2(
    sessionId:              string,
    archetype:              string,
    userId:                 string,
    acknowledgedVoidCodes?: string[],
  ) {
    const session = await this.findSessionOrThrow(sessionId);
    this.assertOwnership(session, userId);   
    this.assertStage(session, 2);

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

  // Stage 3 — Save probe responses 
  async processStage3(
    sessionId:      string,
    probeResponses: Record<string, string>,
    userId:         string,
  ) {
    const session = await this.findSessionOrThrow(sessionId);
    this.assertOwnership(session, userId);  
    this.assertStage(session, 3);

    return this.prisma.elicitationSession.update({
      where: { id: sessionId },
      data: {
        currentStage:     4,
        stage3ProbesJson: probeResponses as any,
        state:            'IN_PROGRESS',  
        updatedAt:        new Date(),
      },
    });
  }

  // Stage 4 — Save technical context (CEO fills directly, Scenario A)
  async processStage4(sessionId: string, dto: Stage4Dto, userId: string) {
    const session = await this.findSessionOrThrow(sessionId);
    this.assertOwnership(session, userId);   
    this.assertStage(session, 4);

    const techInputs = {
      current_stack:       dto.current_stack,
      data_available:      dto.data_available,
      latency_requirement: dto.latency_requirement ?? null,
    };

    return this.prisma.elicitationSession.update({
      where: { id: sessionId },
      data: {
        currentStage:         5,
        stage4TechInputsJson: techInputs as any,
        state:                'IN_PROGRESS', 
        updatedAt:            new Date(),
      },
    });
  }

  // Stage 4 Handoff — Tech Team submits technical context (Scenario B)
  // Ownership model is different here: the CALLER is the tech team member,not the CEO who owns the session. 
  // We verify the tech team member is linked to the session's owning CEO instead of checking direct ownership.
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

    // The CEO has no mechanism to be notified that the Tech Team has submitted.
    // This requires a Socket.io gateway (EventsGateway) or notification row, neither of which exists yet in the codebase. 
    // The frontend's waiting for tech team screen will need to poll GET /sessions/:id until currentStage === 5 as a stopgap until sockets are wired.
    // TODO: emit `elicitation:stage4-handoff-complete` to session.userId once EventsGateway exists.

    return updated;
  }

  // Confirm — triggers Stage 5 synthesis + quality gate 
  async confirmSession(sessionId: string, userId: string): Promise<
     | { gate_passed: true;  completeness_score: number; project_id: string }
     | { gate_passed: false; completeness_score: number; flagged_void: string | null;
         return_to_stage: number; advisory_note: string }
   > {
    const session = await this.findSessionOrThrow(sessionId);
    this.assertOwnership(session, userId);   

    // explicitly block re-confirming an already-completed session.
    if (session.state === 'COMPLETED') {
      throw new ConflictException(
        'This session has already been published as a project.',
      );
    }

    if (session.currentStage !== 5) {
      throw new BadRequestException(
        `Session is at stage ${session.currentStage}. All 4 stages must be completed before confirming.`,
      );
    }

    this.assertAllStagesComplete(session);

    const stage5Request = {
      session_id:         session.id,
      stage1_symptoms:    session.stage1SymptomsJson as string[],
      stage2_archetype:   session.archetype!,
      stage3_probes:      session.stage3ProbesJson      as Record<string, unknown>,
      stage4_tech_inputs: session.stage4TechInputsJson  as Record<string, unknown>,
      void_list_json:     (session.voidListJson as Array<Record<string, unknown>>) ?? [],
    };

    // Fcatch ai-service failures explicitly 
    let synthesis;
    try {
      synthesis = await this.fastapiClient.stage5Synthesize(stage5Request);
    } catch (err) {
      throw new BadRequestException(
        'Project synthesis failed — the AI service did not respond in time. ' +
        'Please try confirming again in a moment.',
      );
    }

    const gatePassed = synthesis.completeness_score >= COMPLETENESS_GATE;

    return gatePassed
      ? this.handleGatePassed(session, synthesis)
      : this.handleGateFailed(session, synthesis);
  }

  // Private helpers 

  private async findSessionOrThrow(sessionId: string) {
    const session = await this.prisma.elicitationSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Elicitation session not found.');
    return session;
  }

  // central ownership check used by every session-scoped method.
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

  private async handleGatePassed(session: any, synthesis: any): Promise<{
    gate_passed: true;
    completeness_score: number;
    project_id: string;
   }> {
    const artifactA = synthesis.artifact_a_json as any;

    let project;
    try {
      project = await this.prisma.project.create({
        data: {
          clientId:               session.userId,
          elicitationSessionId:   session.id,
          state:                  'PUBLISHED',
          archetype:              artifactA.archetype   ?? null,
          tier:                   artifactA.volume_tier ?? null,
          selfTechnical:          false, // TODO: derive from user.selfTechnical once auth/ is complete
          requiredSeamsJson:      synthesis.required_seams_json      as any,
          requiredDomainsJson:    synthesis.required_domains_json    as any,
          milestoneFrameworkJson: synthesis.milestone_framework_json as any,
          artifactAJson:          synthesis.artifact_a_json          as any,
          artifactBJson:          synthesis.artifact_b_json          as any,
        },
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new ConflictException(
          'This session has already been published as a project.',
        );
      }
      throw err;
    }

    await this.prisma.elicitationSession.update({
      where: { id: session.id },
      data:  { state: 'COMPLETED', updatedAt: new Date() },
    });

    // TODO (Cao Minh): once projects/ is implemented, trigger matching here:
    // await this.projectsService.triggerMatching(project.id);

    return {
      gate_passed:        true,
      completeness_score: synthesis.completeness_score,
      project_id:         project.id,
    };
  }

  private async handleGateFailed(session: any, synthesis: any): Promise<{
     gate_passed: false;
     completeness_score: number;
     flagged_void: string | null;
     return_to_stage: number;
     advisory_note: string;
   }> {
    const voids = (
      session.voidListJson as Array<{ void_code: string; severity: string; injected?: boolean }>
    ) ?? [];

    const unfixedHighVoid = voids.find((v) => v.severity === 'HIGH' && !v.injected);
    const unfixedAnyVoid  = voids.find((v) => !v.injected);
    const flaggedVoid     = unfixedHighVoid ?? unfixedAnyVoid ?? voids[0];

    const returnToStage = VOID_TO_STAGE[flaggedVoid?.void_code ?? ''] ?? 1;
    const pct            = Math.round(synthesis.completeness_score * 100);

    await this.prisma.elicitationSession.update({
      where: { id: session.id },
      data: {
        state:        'RETURNED_TO_CLIENT',
        currentStage: returnToStage,
        updatedAt:    new Date(),
      },
    });

    return {
      gate_passed:        false,
      completeness_score: synthesis.completeness_score,
      flagged_void:        flaggedVoid?.void_code ?? null,
      return_to_stage:     returnToStage,
      advisory_note:
        `Your project specification scored ${pct}% completeness (minimum 70% required). ` +
        `Please revisit Stage ${returnToStage} and provide more detail about ` +
        `${flaggedVoid?.void_code?.replace(/_/g, ' ').toLowerCase() ?? 'the flagged area'}.`,
    };
  }
}