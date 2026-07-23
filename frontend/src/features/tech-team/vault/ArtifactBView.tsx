import { useArtifactB } from '@/hooks/use-projects';
import { Spinner } from '@/components/ui/Spinner';
import { Card, CardContent } from '@/components/ui/Card';
import { Database, Code2, FileJson, Link as LinkIcon, AlertTriangle, ShieldCheck } from 'lucide-react';
import { ensureExternalUrl } from '@/lib/utils';

interface TechTeamArtifactBViewProps {
  projectId: string;
}

export default function ArtifactBView({ projectId }: TechTeamArtifactBViewProps) {
  // Tech Team is implicitly authorized to view their assigned project's Artifact B, 
  // so we pass `enabled: true` to the hook.
  const { data: artifactB, isLoading, error } = useArtifactB(projectId, true);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Spinner size="md" className="text-blue-600" />
      </div>
    );
  }

  if (error || !artifactB) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 flex items-start gap-3 text-rose-700 shadow-sm">
        <AlertTriangle size={24} className="shrink-0 mt-0.5 text-rose-500" />
        <div className="text-sm">
          <p className="font-bold text-rose-900 text-base">Vault Access Denied</p>
          <p className="text-rose-700 mt-1">Could not retrieve technical constraints from the secure vault. You may not be linked to this project.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck className="text-blue-600" size={24} />
        <h3 className="font-bold text-slate-900 text-xl">Secure Technical Vault (Artifact B)</h3>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
            
            {/* Left side */}
            <div className="p-8 space-y-8 bg-slate-50/50">
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Code2 size={16} className="text-blue-500" /> Technical Stack
                </h4>
                {artifactB.stack_tags && artifactB.stack_tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {artifactB.stack_tags.map((tag) => (
                      <span key={tag} className="px-3 py-1.5 bg-white text-slate-700 text-sm font-semibold rounded-lg border border-slate-200 shadow-sm">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 italic bg-white p-3 rounded-lg border border-slate-100">No stack tags specified.</p>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <LinkIcon size={16} className="text-blue-500" /> Integration Method
                </h4>
                <p className="text-sm text-slate-800 leading-relaxed bg-white p-4 rounded-xl border border-slate-200 shadow-sm min-h-[100px]">
                  {artifactB.integration_method || 'Not specified.'}
                </p>
              </div>
            </div>

            {/* Right side */}
            <div className="p-8 space-y-8 bg-white">
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Database size={16} className="text-emerald-500" /> Legacy Volume
                </h4>
                <p className="text-sm text-slate-800 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100 min-h-[100px]">
                  {artifactB.legacy_volume || 'Not specified.'}
                </p>
              </div>

              {/* Schemas & Contracts */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <FileJson size={16} className="text-purple-500" /> Artifacts & Assets
                </h4>
                
                {(!artifactB.schemas?.length && !artifactB.contracts?.length) ? (
                  <p className="text-sm text-slate-500 italic p-4 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                    No external technical artifacts provided by the CEO during scoping.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {artifactB.schemas?.map((url, i) => {
                      const { href, isLink } = ensureExternalUrl(url);
                      return (
                        <div key={`schema-${i}`} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors shadow-sm">
                          <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded uppercase tracking-wider shrink-0">Schema</span>
                          {isLink ? (
                            <a href={href} target="_blank" rel="noreferrer" className="text-sm font-mono text-blue-600 hover:underline truncate">
                              {url}
                            </a>
                          ) : (
                            <span className="text-sm font-mono text-slate-700 truncate">{url}</span>
                          )}
                        </div>
                      );
                    })}
                    {artifactB.contracts?.map((url, i) => {
                      const { href, isLink } = ensureExternalUrl(url);
                      return (
                        <div key={`contract-${i}`} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors shadow-sm">
                          <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-1 rounded uppercase tracking-wider shrink-0">Contract</span>
                          {isLink ? (
                            <a href={href} target="_blank" rel="noreferrer" className="text-sm font-mono text-purple-600 hover:underline truncate">
                              {url}
                            </a>
                          ) : (
                            <span className="text-sm font-mono text-slate-700 truncate">{url}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

          </div>
        </CardContent>
      </Card>
    </div>
  );
}