import { apiClient } from "@/lib/api-client";
import type { ShortlistDto } from "@t/api.types";

/**
 * Fetch the shortlist of matched experts for a published project.
 */
export async function getShortlist(projectId: string) {
  const { data } = await apiClient.get<ShortlistDto | MatchResult[]>(
    `/matching/${projectId}/shortlist`
  );
  
  // Patch for backend mismatch: If backend returns an array directly, wrap it.
  if (Array.isArray(data)) {
    return { results: data };
  }
  
  return data as ShortlistDto;
}
