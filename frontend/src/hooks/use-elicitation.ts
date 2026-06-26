import { useMutation, useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export function useElicitation(sessionId?: string) {
  const sessionQuery = useQuery({
    queryKey: ['elicitation', 'session', sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      const { data } = await apiClient.get(`/elicitation/sessions/${sessionId}`);
      return data;
    },
    enabled: !!sessionId,
  });

  const inviteTechTeam = useMutation({
    mutationFn: async (payload: { sessionId: string; emails: string[] }) => {
      const { data } = await apiClient.post(`/elicitation/sessions/${payload.sessionId}/invite`, {
        emails: payload.emails,
      });
      return data;
    },
  });

  return {
    session: sessionQuery.data,
    isLoadingSession: sessionQuery.isLoading,
    inviteTechTeam,
  };
}
