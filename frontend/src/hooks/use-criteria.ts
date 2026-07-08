import apiClient from "@/lib/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface VerifyCriterionDto {
  verification_comment?: string;
}

interface VerifyCriterionVariable {
  criterionId: string;
  body: VerifyCriterionDto;
}

interface RevisionNoteDto {
  revision_note: string;
}

interface RevisionNoteVariable {
  criterionId: string;
  body: RevisionNoteDto;
}

export function useVerifyCriterion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ criterionId, body }: VerifyCriterionVariable) => {
      const { data } = await apiClient.put<boolean>(
        `/criteria/${criterionId}/verify`,
        body,
      );
      return data;
    },

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["criterias", variables.criterionId],
      });
    },
  });
}
