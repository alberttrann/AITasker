from pydantic import BaseModel


class Stage1Request(BaseModel):
    symptom_text: str

class Stage5Request(BaseModel):
    session_id:          str
    stage1_symptoms:     list[str]
    stage2_archetype:    str
    stage3_probes:       dict
    stage4_tech_inputs:  dict
    void_list_json:      list[dict]


class PortfolioEvalRequest(BaseModel):
    project_description: str
    decision_points:     str
    seam_code:           str


class MatchingRequest(BaseModel):
    required_seams_json:   list[dict]
    required_domains_json: list[dict]
    expert_profiles:       list[dict]


class DisputeEvalRequest(BaseModel):
    criterion_text:          str
    deliverable_description: str
    files:                   list[str] = []


class CriterionCheckRequest(BaseModel):
    criterion_text: str


class ServiceGenerateRequest(BaseModel):
    expert_capabilities: list[str]
    target_use_cases:    list[str]

