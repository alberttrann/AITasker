"""
Simulation scenarios — POST /llm/portfolio-eval

NestJS trigger: PortfolioService.submitPortfolioEntry(expert_id, seam_code, ...)

NestJS flow:
  1. Expert submits portfolio entry for a specific seam boundary
  2. NestJS increments expert_seam_claims.submission_count
  3. NestJS calls this endpoint
  4. passed_boolean=True  → verification_tier = EVIDENCE_BACKED
     passed_boolean=False → increment failure_count, check lockout threshold
  5. NestJS writes platform_decisions row with confidence + gap_advisory

Business rules enforced IN CODE (not LLM):
  BR-VER-03: passed_boolean = (confidence_score >= 0.85) — code computed
  gap_advisory must be None when passed, non-null when failed — code enforced
  Score clamped to [0.0, 1.0] — code enforced

Seam boundary reference (from portfolio_eval.txt prompt):
  A↔C = LLM output quality contract
  A↔D = Retrieval-generation contract
  D↔E = Embedding pipeline contract
  A↔B = Deployment-inference contract
  B↔E = Monitoring-pipeline contract
  D↔F = Model-vector alignment
  C↔E = Ground-truth pipeline
  C↔F = Evaluation-model feedback loop
  E↔F = Training data pipeline
  A↔F = Fine-tuned model integration
"""

import httpx
from simulations.framework.grader import (
    Check, Scenario,
    shape_status_ok, shape_field_present, shape_score_in_range, shape_field_type,
    rule_threshold_equals_bool, rule_advisory_null_on_pass,
    quality_equals, quality_score_meets, quality_score_below, quality_not_equals,
)

PASS_THRESHOLD = 0.85


# Shared check sets

def _shape_checks() -> list[Check]:
    """Structural checks NestJS depends on — applied to every scenario."""
    return [
        shape_status_ok(),
        shape_field_present("confidence_score"),
        shape_score_in_range("confidence_score", 0.0, 1.0),
        shape_field_present("passed_boolean"),
        shape_field_type("passed_boolean", bool),
        shape_field_present("gap_advisory"),   # nullable — presence check only
    ]


def _rule_checks() -> list[Check]:
    """
    Business rules enforced in portfolio_evaluator.py.
    These MUST pass regardless of LLM output — they are code guarantees.
    """
    return [
        rule_threshold_equals_bool(
            "confidence_score", "passed_boolean", PASS_THRESHOLD
        ),
        rule_advisory_null_on_pass("passed_boolean", "gap_advisory"),
    ]


# Custom quality checks

def _expects_pass() -> list[Check]:
    """Quality expectation for a strong, seam-specific submission."""
    return [
        quality_score_meets("confidence_score", PASS_THRESHOLD),
        quality_equals("passed_boolean", True),
    ]


def _expects_fail() -> list[Check]:
    """Quality expectation for a weak or mismatched submission."""
    return [
        quality_score_below("confidence_score", PASS_THRESHOLD),
        quality_equals("passed_boolean", False),
    ]


def _gap_advisory_substantive(min_len: int = 30) -> Check:
    """
    Quality: on failure, gap_advisory should name a specific gap — not be generic.
    The expert uses this to understand exactly what evidence is missing.
    """
    def fn(s, b):
        advisory = b.get("gap_advisory")
        if advisory is None:
            # Passing scenario — advisory correctly absent
            return True, "gap_advisory=None (passed scenario)"
        if not isinstance(advisory, str):
            return False, f"gap_advisory is {type(advisory).__name__}, expected str"
        ok = len(advisory) >= min_len
        return ok, f"len={len(advisory)}: {repr(advisory[:100])}"
    return Check(
        "QUALITY",
        f"gap_advisory is substantive (>= {min_len} chars) when present",
        fn,
    )


# SCENARIOS

SCENARIOS: list[Scenario] = [

    # 1. A↔C STRONG — LLM output quality boundary 
    Scenario(
        name="A_C_STRONG",
        nestjs_context="PortfolioService.submitPortfolioEntry() "
                       "— Expert submits evidence for A↔C seam (LLM output ↔ AI Eval Quality)",
        method="POST",
        path="/llm/portfolio-eval",
        payload={
            "seam_code": "A↔C",
            "project_description": (
                "Built an enterprise document QA system for a 500-lawyer legal firm. "
                "The system retrieves relevant case law from a 300k document corpus "
                "and generates cited summaries. 40,000 queries per month."
            ),
            "decision_points": (
                "At the A↔C seam (LLM output quality contract): "
                "Evaluated BERTScore vs ROUGE-L — chose BERTScore because legal language "
                "has low lexical overlap with reference answers; ROUGE-L gave misleading "
                "high scores on documents using different legal phrasing for the same concept. "
                "Benchmarked 3 evaluation frameworks (RAGAS, TruLens, custom pipeline) on "
                "150 annotated QA pairs — RAGAS chosen for its faithfulness + answer_relevancy "
                "components which directly model hallucination risk. "
                "Set rejection threshold at BERTScore F1 < 0.72: calibrated by plotting "
                "threshold vs manual-labelled accuracy on 150 pairs — 0.72 gave 91% agreement "
                "with human reviewers at acceptable latency cost. "
                "Added claim-level grounding check: if any atomic claim in output not found "
                "in retrieved chunks, the answer is rejected and retrieval re-queried. "
                "Failure mode discovered: BERTScore underscored technical Latin legal terms "
                "(mens rea, actus reus) — added domain-specific token weighting. "
                "Outcome: hallucination rate dropped from 23% to 3.8% on 200-item holdout set."
            ),
        },
        checks=[
            *_shape_checks(),
            *_rule_checks(),
            *_expects_pass(),
            _gap_advisory_substantive(),
        ],
        manual_review=[
            "Does the decision point address the A↔C boundary specifically — "
            "the CONTRACT between LLM output and evaluation, not just model selection?",
            "Is the BERTScore threshold decision evidence-backed (calibration on 150 pairs)?",
            "Is the failure mode (Latin legal terms) a genuine seam-boundary insight?",
        ],
    ),

    # 2. A↔D STRONG — Retrieval-generation boundary
    Scenario(
        name="A_D_STRONG",
        nestjs_context="PortfolioService.submitPortfolioEntry() "
                       "— Expert submits evidence for A↔D seam (Retrieval ↔ Generation)",
        method="POST",
        path="/llm/portfolio-eval",
        payload={
            "seam_code": "A↔D",
            "project_description": (
                "Built a production RAG pipeline for a 500-lawyer firm. Retrieves "
                "relevant case law from a 300k-document corpus in Pinecone and "
                "generates cited summaries. 50,000 monthly queries, p95 latency <200ms."
            ),
            "decision_points": (
                "At the A↔D retrieval-generation boundary: "
                "Evaluated text-embedding-3-large vs Cohere embed-v3 vs BGE-large on "
                "a holdout of 150 annotated query-document pairs. "
                "BGE-large: nDCG@10=0.83 but 40% higher latency vs text-embedding-3-large: "
                "nDCG@10=0.79. Chose text-embedding-3-large — the 200ms SLA was a hard "
                "contractual requirement from the firm; 4% nDCG trade-off was acceptable. "
                "Implemented hybrid dense+sparse (BM25) retrieval with RRF reranking: "
                "+0.06 nDCG improvement over pure dense. "
                "Added cross-encoder reranker (ms-marco-MiniLM-L-6-v2) as final filter "
                "before generation — hallucination rate dropped from 22% to 4% on "
                "50 golden annotated queries. "
                "Failure mode: reranker added 180ms latency, pushing p95 over SLA. "
                "Resolution: ran reranker only when top-1 similarity score < 0.78 "
                "(ambiguous retrieval) — reduced latency impact to 35ms on average."
            ),
        },
        checks=[
            *_shape_checks(),
            *_rule_checks(),
            *_expects_pass(),
            _gap_advisory_substantive(),
        ],
        manual_review=[
            "Does the decision address the A↔D boundary specifically — the CONTRACT "
            "between retrieval quality and what the generator receives?",
            "Is the SLA trade-off decision (nDCG vs latency) well-reasoned?",
            "Is the failure mode (reranker latency) a genuine seam-boundary insight "
            "with a measured resolution?",
        ],
    ),

    # 3. D↔E STRONG — Embedding pipeline boundary
    Scenario(
        name="D_E_STRONG",
        nestjs_context="PortfolioService.submitPortfolioEntry() "
                       "— Expert submits evidence for D↔E seam (Vector DB ↔ Data Pipeline)",
        method="POST",
        path="/llm/portfolio-eval",
        payload={
            "seam_code": "D↔E",
            "project_description": (
                "Customer service RAG system for a telco with 5 million support tickets "
                "as the corpus. New tickets arrive at ~500,000/day. "
                "Required: fresh embeddings within 1 hour of ticket creation."
            ),
            "decision_points": (
                "At the D↔E embedding pipeline boundary: "
                "Batch vs streaming ingestion: chose hourly batch over real-time streaming. "
                "Rationale: at 500k/day, streaming caused Weaviate index fragmentation "
                "leading to 40% query latency increase after 72h. Batch at 1h intervals "
                "maintained stable p95 query latency at 85ms. Acceptable staleness: "
                "1h vs 0s — support agents work with tickets >2h old on average. "
                "Embedding model: BAAI/bge-large-en-v1.5 (1024 dims) vs "
                "text-embedding-3-small (1536 dims). "
                "bge-large-en outperformed by 6.1% nDCG@10 on our support-ticket "
                "evaluation set (300 annotated queries) despite lower dimensionality. "
                "Cost trade-off: bge-large-en at ~$0.0004/1k tokens vs $0.00002/1k — "
                "10x more expensive but $40/month absolute cost at our 5M doc scale: "
                "acceptable. "
                "Dimension reduction: tested PCA to 512 dims — 1.8% nDCG loss, rejected. "
                "Staleness management: added 90-day TTL on tickets older than 1 year "
                "to prevent index bloat (would have grown to 450GB in year 2). "
                "Failure mode: after model fine-tuning, embedding space shifted causing "
                "30% retrieval quality drop. Added cosine similarity distribution "
                "monitoring — alerts when p5 of daily similarity scores drops >15% "
                "from 30-day baseline, triggering full corpus re-embedding."
            ),
        },
        checks=[
            *_shape_checks(),
            *_rule_checks(),
            *_expects_pass(),
            _gap_advisory_substantive(),
        ],
        manual_review=[
            "Does the decision address D↔E specifically — the boundary between how "
            "data enters the vector store and how the vector store is queried?",
            "Is the batch-vs-streaming decision backed by concrete latency measurements?",
            "Is the embedding drift failure mode a genuine D↔E insight (not just "
            "a general ML monitoring story)?",
        ],
    ),

    # 4. A↔B STRONG — Deployment-inference boundary 
    Scenario(
        name="A_B_STRONG",
        nestjs_context="PortfolioService.submitPortfolioEntry() "
                       "— Expert submits evidence for A↔B seam (LLM App ↔ MLOps/Deployment)",
        method="POST",
        path="/llm/portfolio-eval",
        payload={
            "seam_code": "A↔B",
            "project_description": (
                "Customer-facing AI chat assistant serving 100,000 daily requests "
                "for a retail company. Strict SLA: p95 latency < 2s, 99.9% uptime. "
                "Self-hosted open-source model to avoid per-token API costs at scale."
            ),
            "decision_points": (
                "At the A↔B deployment-inference boundary: "
                "Serving framework: evaluated vLLM vs TGI vs Ollama on A10G GPU. "
                "vLLM: 4.2x throughput improvement over TGI at batch_size=16; "
                "Ollama: inadequate for concurrent requests (single-threaded). "
                "Chose vLLM — throughput advantage directly reduced GPU count from 4 to 2 "
                "nodes, saving $3,200/month. "
                "Model selection: Mistral-7B-Instruct vs GPT-3.5-turbo. "
                "Mistral at $0.0002/1k tokens vs $0.002 (10x cheaper). "
                "Quality delta: 8% lower on internal eval set of 200 annotated "
                "customer queries — acceptable given 10x cost saving at 100k req/day. "
                "Canary deployment strategy: 5% traffic for 48h. "
                "Rollback triggers: p95 latency >3s OR error rate >0.5% — set after "
                "analysing 30 days of production traffic distribution. "
                "GPU choice: A10G vs A100. A10G gave 85% of A100 throughput at 40% cost. "
                "At our load profile (mostly short contexts <2k tokens), A100's additional "
                "HBM bandwidth offered diminishing returns. "
                "Failure mode: vLLM memory fragmentation after 6h of sustained load at "
                "batch_size=64 — manifested as OOM errors. Resolution: rolling restart "
                "every 4h during low-traffic windows (3-4am) with prewarmed standby instance "
                "to maintain zero-downtime. Zero customer-visible incidents since deployment."
            ),
        },
        checks=[
            *_shape_checks(),
            *_rule_checks(),
            *_expects_pass(),
            _gap_advisory_substantive(),
        ],
        manual_review=[
            "Does the decision address A↔B specifically — the boundary between the "
            "LLM application logic and the serving infrastructure?",
            "Is the vLLM vs TGI comparison evidence-backed with specific throughput numbers?",
            "Is the failure mode (memory fragmentation at batch_size=64) a genuine "
            "A↔B seam insight with a production-grade resolution?",
        ],
    ),

    # 5. A↔D WEAK — Generic, no seam-specific evidence
    Scenario(
        name="A_D_WEAK",
        nestjs_context="PortfolioService.submitPortfolioEntry() "
                       "— Expert submits a generic, vague portfolio entry with no seam specificity",
        method="POST",
        path="/llm/portfolio-eval",
        payload={
            "seam_code": "A↔D",
            "project_description": (
                "I built a RAG chatbot for a client using LangChain and OpenAI. "
                "The system could answer questions about their internal documents."
            ),
            "decision_points": (
                "I used LangChain with Chroma as the vector store and GPT-4 for generation. "
                "The retrieval worked well and the model gave good answers. "
                "I chose cosine similarity for retrieval because that is what the "
                "documentation recommended. We deployed it to AWS and the client "
                "was satisfied with the final results."
            ),
        },
        checks=[
            *_shape_checks(),
            *_rule_checks(),
            *_expects_fail(),
            _gap_advisory_substantive(30),
        ],
        manual_review=[
            "Is gap_advisory specific — does it name exactly which of the 4 signal "
            "types is missing (decision points, trade-off reasoning, failure modes, "
            "measurable outcomes)?",
            "Does the advisory point to the seam boundary itself "
            "(retrieval-generation contract) rather than giving generic advice?",
        ],
    ),

    # 6. A↔D BORDERLINE — Near threshold, incomplete evidence 
    Scenario(
        name="A_D_BORDERLINE",
        nestjs_context="PortfolioService.submitPortfolioEntry() "
                       "— Expert submits a submission with partial seam evidence — near 0.85",
        method="POST",
        path="/llm/portfolio-eval",
        payload={
            "seam_code": "A↔D",
            "project_description": (
                "Internal knowledge base search system for a 2,000-person company. "
                "Covers 8,000 documents across HR, engineering, and legal departments."
            ),
            "decision_points": (
                "At the retrieval boundary: I evaluated OpenAI text-embedding-ada-002 "
                "vs Cohere embed-v3. Chose OpenAI — the team was already using their API "
                "and reducing vendor complexity was a business priority. "
                "Used top-k=5 retrieval before sending context to GPT-4. "
                "Added a low-confidence fallback: if the top retrieved document "
                "had similarity score < 0.65, the system responds with "
                "'I could not find a confident answer — please contact HR directly'. "
                "This reduced hallucinations in production to near zero based on user "
                "complaints, which dropped from 12/month to 1/month after adding the threshold. "
                "Support ticket volume decreased approximately 30% over the first quarter."
            ),
        },
        checks=[
            # Shape and rule checks are always enforced
            *_shape_checks(),
            *_rule_checks(),
            # We do NOT assert a specific pass/fail — near-threshold outcome is non-deterministic.
            # Only verify the score is in a reasonable range (model engaged with the submission).
            quality_score_meets("confidence_score", 0.40),
            _gap_advisory_substantive(20),
        ],
        manual_review=[
            "Score should be somewhere near 0.85 — borderline. Was the outcome "
            "PASS or FAIL? Neither is definitively correct for this submission.",
            "If FAIL: does gap_advisory specifically name what is missing? "
            "Likely: missing trade-off benchmarks (vendor convenience ≠ performance reason) "
            "and/or no discussion of failure modes at the retrieval-generation boundary.",
            "If PASS: did the complaint-reduction metric (12→1/month) provide sufficient "
            "measurable outcome evidence to tip it over the threshold?",
            "Is the similarity threshold decision (0.65) treated as seam-specific "
            "evidence by the model?",
        ],
    ),

    # 7. WRONG_SEAM_MISMATCH — D↔E work submitted for A↔C seam
    Scenario(
        name="WRONG_SEAM_MISMATCH",
        nestjs_context="PortfolioService.submitPortfolioEntry() "
                       "— Expert submits strong D↔E work for the wrong seam (A↔C requested)",
        method="POST",
        path="/llm/portfolio-eval",
        payload={
            "seam_code": "A↔C",   # seam being evaluated
            "project_description": (
                "Search pipeline for an e-commerce company with 2 million product listings. "
                "System serves 500,000 product searches per day."
            ),
            "decision_points": (
                "I designed the embedding ingestion pipeline to process 2M product listings "
                "daily. Key decision: chose FAISS over Pinecone — at 2M docs and 500k "
                "queries/day, self-hosted FAISS cost $400/month vs Pinecone's $2,800/month "
                "with acceptable 3ms latency overhead. "
                "Implemented incremental indexing: only re-embed products where title, "
                "description, or price changed — reduced daily embedding compute by 85%. "
                "Used product ID + content hash for change detection. "
                "Built embedding drift monitoring using cosine similarity distribution: "
                "alerts when p5 drops >15% from 30-day baseline, triggering re-embedding. "
                "Failure mode: discovered that seasonal products (Christmas decorations) "
                "clustered incorrectly due to temporal token bias in embeddings — "
                "implemented time-decay weighting to push seasonal products into "
                "correct semantic neighborhoods."
            ),
        },
        checks=[
            *_shape_checks(),
            *_rule_checks(),
            # This submission is about D↔E (embedding pipeline) not A↔C (LLM output quality).
            # The model should detect the seam mismatch and score low.
            *_expects_fail(),
            _gap_advisory_substantive(30),
        ],
        manual_review=[
            "Did the model detect the seam mismatch? The submission describes excellent "
            "D↔E embedding pipeline work but A↔C requires evidence of LLM output quality "
            "decisions (evaluation frameworks, hallucination detection, output contracts).",
            "Does gap_advisory name the specific missing A↔C evidence rather than "
            "criticising the quality of the D↔E work (which is actually strong)?",
            "If the model PASSED this — that is a prompt failure. The seam boundary "
            "description in the prompt should prevent passing mismatched evidence.",
        ],
    ),

    # 8. B↔E STRONG — Monitoring-pipeline boundary 
    Scenario(
        name="B_E_STRONG",
        nestjs_context="PortfolioService.submitPortfolioEntry() "
                       "— Expert submits evidence for B↔E seam (MLOps ↔ Data Pipeline)",
        method="POST",
        path="/llm/portfolio-eval",
        payload={
            "seam_code": "B↔E",
            "project_description": (
                "Production ML pipeline for churn prediction at a retail bank. "
                "Model scores 200,000 customers monthly. Business impact: "
                "each prevented churn saves ~$1,200 ARR on average."
            ),
            "decision_points": (
                "At the B↔E monitoring-pipeline boundary: "
                "Monitoring framework: evaluated Evidently vs Whylogs vs custom solution. "
                "Chose Evidently — 3-week faster time-to-production vs custom. "
                "Whylogs lacked column-level drift reports needed by our data team. "
                "Drift detection threshold: Jensen-Shannon divergence > 0.15 on feature "
                "distributions triggers P2 alert. Calibrated on 6 months of historical "
                "data: 0.15 corresponds to a 4-6% F1 drop in backtesting — actionable "
                "but not yet business-critical. "
                "Re-training trigger: automatically queues re-training when drift detected "
                "OR when F1 on weekly held-out validation set drops below 0.78 "
                "(2% below production threshold of 0.80). "
                "Alert routing: P1 (F1 < 0.75 OR >10% prediction distribution shift) → "
                "on-call engineer + model owner; P2 (drift only) → model owner only. "
                "Reduces alert fatigue vs alerting on-call for minor drift. "
                "Failure mode: batch prediction latency doubled during monthly salary "
                "runs — payroll features spiked, causing feature extraction to hit "
                "database connection pool limits. Resolution: pre-computed payroll "
                "features cached with 6h TTL, reducing extraction time from 4.2s to 0.8s. "
                "Outcome: model degradation incidents reduced from 4 per quarter to 0 "
                "over 6 months post-implementation."
            ),
        },
        checks=[
            *_shape_checks(),
            *_rule_checks(),
            *_expects_pass(),
            _gap_advisory_substantive(),
        ],
        manual_review=[
            "Does the decision address B↔E specifically — the boundary between "
            "MLOps monitoring and the data pipeline that feeds training/inference?",
            "Is the JS divergence threshold (0.15 → 4-6% F1 drop) backed by "
            "calibration evidence, not just a default value?",
            "Is the failure mode (payroll feature latency spike) a genuine B↔E "
            "seam insight — not just a general infrastructure story?",
        ],
    ),

]