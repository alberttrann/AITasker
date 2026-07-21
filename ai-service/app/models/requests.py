"""
Request models for all LLM API endpoints.
"""
from pydantic import BaseModel



class Stage1Request(BaseModel):
    symptom_text: str
    archetypes:   list[dict] = []   # [{code, name, description}]
    void_codes:   list[dict] = []   # [{code, description}]


class Stage3VaguenessCheckRequest(BaseModel):
    archetype:         str
    probe_questions:   list[str] = []    # DB-fetched question texts
    probe_responses:   dict[str, str]
    is_self_technical: bool = False
    stage1_symptoms:   list[str] = []
    stage1_voids:      list[dict] = []


class Stage4RecommendRequest(BaseModel):
    stage1_symptoms:           list[str]
    stage2_archetype:          str
    stage3_probes:             dict
    void_list_json:            list[dict] = []
    is_self_technical:         bool = False
    additional_requirement_1:  str | None = None   
    estimated_budget_vnd:      int | None = None   


class Stage5Request(BaseModel):
    session_id:                  str
    stage1_symptoms:             list[str]
    stage2_archetype:            str
    stage3_probes:               dict
    stage4_tech_inputs:          dict
    void_list_json:              list[dict]
    is_self_technical:           bool = False
    estimated_budget_vnd:        int | None = None   
    critical_artifacts_required: list[dict] = []
    domains:     list[dict] = []    # [{code, name}]
    seams:       list[dict] = []    # [{code, name}]
    archetypes:  list[dict] = []    # [{code, name, description}]



class PortfolioEvalRequest(BaseModel):
    project_description: str
    decision_points:     str
    seam_code:           str
    seam_name:           str | None = None   # e.g. "Retrieval-generation"
    seam_description:    str | None = None   # full description from seam_definitions table
    all_seam_definitions: list[dict] = []    # [{code, name, description}]


class MatchingRequest(BaseModel):
    required_seams_json:   list[dict]
    required_domains_json: list[dict]
    expert_profiles:       list[dict]
    project_archetype:     str | None = None


class DisputeEvalRequest(BaseModel):
    criterion_text:          str
    deliverable_description: str
    files:                   list[str] = []
    # Context for better arbitration
    project_archetype:       str | None = None   # e.g. "3" = Classification
    milestone_context:       str | None = None   # milestone deliverable_statement
    prior_revision_count:    int = 0             # how many revision loops already happened


class CriterionCheckRequest(BaseModel):
    criterion_text:    str
    # Optional context for more targeted rewrite suggestions
    project_archetype: str | None = None   # e.g. "3" = Classification
    archetype_name:    str | None = None   # e.g. "Classification"
    milestone_context: str | None = None   # brief milestone deliverable description


class ServiceGenerateRequest(BaseModel):
    expert_capabilities: list[str]
    target_use_cases:    list[str]
    # Expert's verified competencies (passed from NestJS at call time)
    claimed_domains:     list[dict] = []  # [{code, name, depth}] from expertDomainDepths
    claimed_seams:       list[dict] = []  # [{code, name}] from expertSeamClaims
    # Price guidance from DB (replaces hardcoded tiers in prompt)
    price_guidance:      dict = {}        # {small_min, small_max, medium_min, medium_max, large_min}
    is_pro_expert:       bool = False

class MilestoneChatRequest(BaseModel):
    artifact_a:           dict
    milestone_framework:  list[dict]
    budget_context:       str = "No budget specified"
    terms_locked:         bool = False
    conversation_history: list[dict] = []
    user_message:         str
