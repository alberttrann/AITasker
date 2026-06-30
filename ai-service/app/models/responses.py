from pydantic import BaseModel


class VoidItem(BaseModel):
    void_code: str
    severity:  str

class Stage1Response(BaseModel):
    symptoms:      list[str]
    scale_signals: dict
    voids:         list[VoidItem]
    # 3-5 AI-recommended archetype codes, most-likely-first.
    recommended_archetypes: list[str] = []

class Stage5Response(BaseModel):
    required_seams_json:    list[dict]
    required_domains_json:  list[dict]
    milestone_framework_json: list[dict]
    artifact_a_json:         dict
    artifact_b_json:         dict
    completeness_score:      float


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
    finding:          str


class CriterionCheckResponse(BaseModel):
    is_subjective: bool
    suggestions:   list[str]


class ServiceGenerateResponse(BaseModel):
    title:               str
    description:         str
    scope:               str
    timeline:            str
    suggested_price_vnd: int


# Stage 3 vagueness check on behavioral probe answers.
class VaguenessFlag(BaseModel):
    question: str
    reason:   str

class Stage3VaguenessCheckResponse(BaseModel):
    vague_answers: list[VaguenessFlag] = []

class Stage4RecommendResponse(BaseModel):
    recommended_stack: str
    recommended_integration: str
    recommended_legacy_volume: str