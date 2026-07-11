"""
Response models for all LLM API endpoints.
"""
from pydantic import BaseModel


class VoidItem(BaseModel):
    void_code: str
    severity:  str   # HIGH | MEDIUM | LOW

class CriticalArtifact(BaseModel):
    """Issue 4: an artifact Stage 1 AI says must be submitted before synthesis."""
    artifact_key:        str   # snake_case key used in technical_artifacts dict
    label:               str   # human-readable name e.g. "Compliance Ruleset"
    reason:              str   # why this is critical for scope accuracy
    placeholder_prompt:  str   # what to show the user to request this artifact

class Stage1Response(BaseModel):
    symptoms:                    list[str]
    scale_signals:               dict
    voids:                       list[VoidItem]
    recommended_archetypes:      list[str] = []
    critical_artifacts_required: list[CriticalArtifact] = []   


class VaguenessFlag(BaseModel):
    question:    str
    reason:      str

class RelevancyFlag(BaseModel):
    """Issue 2: answer doesn't address the project's actual context."""
    question: str
    issue:    str   # e.g. "Answer describes a restaurant booking system but project is AdTech compliance"

class Stage3VaguenessCheckResponse(BaseModel):
    vague_answers:      list[VaguenessFlag] = []
    irrelevant_answers: list[RelevancyFlag] = []   

class Stage4RecommendResponse(BaseModel):
    recommended_stack:          str
    recommended_integration:    str
    recommended_legacy_volume:  str


class Stage5Response(BaseModel):
    required_seams_json:            list[dict]
    required_domains_json:          list[dict]
    milestone_framework_json:       list[dict]
    artifact_a_json:                dict
    artifact_b_json:                dict
    completeness_score:             float
    estimated_total_cost_vnd:       int | None = None    
    estimated_total_duration_days:  int | None = None    

class PortfolioEvalResponse(BaseModel):
    confidence_score: float
    passed_boolean:   bool
    gap_advisory:     str | None = None

class GapMapItem(BaseModel):
    seam_code: str
    color:     str

class MatchResult(BaseModel):
    expert_id:       str
    composite_score: float
    strength_label:  str
    gap_map:         list[GapMapItem]

class DisputeEvalResponse(BaseModel):
    confidence_score: float
    finding:          str      # "expert_wins" | "client_wins"
    reasoning:        str = "" # brief explanation — shown to admin in manual review queue

class CriterionCheckResponse(BaseModel):
    is_subjective:        bool
    suggestions:          list[str]
    severity:             str = "LOW"    # LOW | MEDIUM | HIGH — how risky is this criterion?
    context_note:         str | None = None  # why it's risky in this project context

class ServiceGenerateResponse(BaseModel):
    title:               str
    description:         str
    scope:               list[str]   
    timeline:            str         
    suggested_price_vnd: int
    suggested_domains:   list[str] = []
    suggested_seams:     list[str] = []
    pricing_rationale:   str       = ""

class MilestoneChatResponse(BaseModel):
    reply:          str
    suggested_edit: dict | None = None