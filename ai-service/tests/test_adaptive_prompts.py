import pytest
from unittest.mock import AsyncMock, patch
from app.models.requests import Stage3VaguenessCheckRequest, Stage5Request
from app.services import elicitation_engine

@pytest.mark.asyncio
async def test_stage3_prompt_injection_for_non_technical():
    """Verify that is_self_technical=False injects the forgiveness clause into the prompt."""
    
    mock_llm = AsyncMock(return_value={"vague_answers": []})
    
    with patch("app.services.elicitation_engine.llm_client.call_llm_json_with_system", new=mock_llm):
        request = Stage3VaguenessCheckRequest(
            archetype="1",
            probe_responses={"q1": "a1"},
            is_self_technical=False  # Non-technical CEO
        )
        
        await elicitation_engine.stage3_vagueness_check(request)
        
        # Capture the system prompt sent to the LLM
        system_prompt_used = mock_llm.call_args.kwargs["system"]
        
        assert "IMPORTANT CONTEXT: The user is a non-technical business executive." in system_prompt_used
        assert "Be highly forgiving" in system_prompt_used

@pytest.mark.asyncio
async def test_stage3_no_injection_for_technical():
    """Verify that is_self_technical=True bypasses the forgiveness clause."""
    
    mock_llm = AsyncMock(return_value={"vague_answers": []})
    
    with patch("app.services.elicitation_engine.llm_client.call_llm_json_with_system", new=mock_llm):
        request = Stage3VaguenessCheckRequest(
            archetype="1",
            probe_responses={"q1": "a1"},
            is_self_technical=True  # Technical User
        )
        
        await elicitation_engine.stage3_vagueness_check(request)
        
        system_prompt_used = mock_llm.call_args.kwargs["system"]
        
        assert "IMPORTANT CONTEXT: The user is a non-technical business executive." not in system_prompt_used

@pytest.mark.asyncio
async def test_stage5_prompt_injection_for_non_technical():
    """Verify Stage 5 Synthesis adjusts jargon for non-technical users."""
    
    mock_llm = AsyncMock(return_value={
        "required_seams_json": [], "required_domains_json": [], 
        "milestone_framework_json": [], "artifact_a_json": {}, 
        "artifact_b_json": {}, "completeness_score": 0.90
    })
    
    with patch("app.services.elicitation_engine.llm_client.call_llm_json_with_system", new=mock_llm):
        request = Stage5Request(
            session_id="123",
            stage1_symptoms=["x"],
            stage2_archetype="1",
            stage3_probes={"x":"y"},
            stage4_tech_inputs={"x":"y"},
            void_list_json=[],
            is_self_technical=False
        )
        
        await elicitation_engine.stage5_synthesize(request)
        
        system_prompt_used = mock_llm.call_args.kwargs["system"]
        
        assert "IMPORTANT CONTEXT: The user is a non-technical business executive." in system_prompt_used
        assert "avoiding deep architectural jargon" in system_prompt_used