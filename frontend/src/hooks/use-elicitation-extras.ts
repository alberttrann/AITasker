import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';
 
export async function saveDraft(
  sessionId: string,
  symptomTextDraft: string,
): Promise<{ saved: boolean; reason?: string }> {
  const { data } = await apiClient.patch(
    `/elicitation/sessions/${sessionId}/draft`,
    { symptomTextDraft },
  );
  return data;
}
 

export async function retrySynthesis(sessionId: string): Promise<unknown> {
  const { data } = await apiClient.post(
    `/elicitation/sessions/${sessionId}/retry-synthesis`,
  );
  return data;
}
 

export async function setSelfTechnical(
  sessionId: string,
  selfTechnical: boolean,
): Promise<void> {
  const { data } = await apiClient.put(
    `/elicitation/sessions/${sessionId}/self-technical`,
    { selfTechnical },
  );
  // Backend re-issues a JWT with updated selfTechnical claim
  if (data?.access_token) {
    useAuthStore.getState().setTokens(data.access_token, '');
  }
}