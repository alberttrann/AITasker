import { useArtifactB } from '@/hooks/use-projects';
import { Spinner } from '@/components/ui/Spinner';
import { Card, CardContent } from '@/components/ui/Card';
import { LockKeyhole, Database, Code2, FileJson, Link as LinkIcon, AlertTriangle } from 'lucide-react';
import { ensureExternalUrl } from '@/lib/utils';

interface ExpertArtifactBViewProps {
  projectId: string;
  isAuthorized: boolean;
}

export default function ArtifactBView({ projectId, isAuthorized }: ExpertArtifactBViewProps) {
  const { data: artifactB, isLoading, error } = useArtifactB(projectId, isAuthorized);

  if (!isAuthorized) {
    return (
      <Card className="border-dashed border-slate-300 bg-slate-50">
        <CardContent className="flex flex-col items-center justify-center p-10 text-center text-slate-500">
          <div className="mb-4 rounded-full bg-slate-200 p-4 text-slate-400 shadow-inner">
            <LockKeyhole size={28} />
          </div>
          <h3 className="mb-2 text-base font-bold text-slate-700">Technical Specifications Locked</h3>
          <p className="text-sm max-w-md leading-relaxed">
            Artifact B contains sensitive client infrastructure details. It will unlock automatically once both you and the client have signed the Non-Disclosure Agreement (NDA).
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12">
          <Spinner size="lg" className="text-emerald-600" />
        </CardContent>
      </Card>
    );
  }

  if (error || !artifactB) {
    const errorMsg = (error as any)?.response?.data?.message || 'Could not retrieve technical constraints. Ensure NDAs are completed.';
    return (
      <Card className="border-rose-200 bg-rose-50">
        <CardContent className="flex items-start gap-3 p-5 text-rose-700">
          <AlertTriangle size={20} className="shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold text-rose-900">Access Denied or Error</p>
            <p className="text-rose-700 mt-1">{errorMsg}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-emerald-200 shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-300">
      <div className="bg-emerald-50 border-b border-emerald-100 px-6 py-4 flex items-center gap-2">
        <Code2 className="text-emerald-600" size={20} />
        <h3 className="font-bold text-emerald-900 text-lg">Technical Specifications (Artifact B)</h3>
      </div>
      <CardContent className="p-6 space-y-8">
        {/* Tech Stack */}
        {artifactB.stack_tags && artifactB.stack_tags.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Technical Stack</h4>
            <div className="flex flex-wrap gap-2">
              {artifactB.stack_tags.map((tag) => (
                <span key={tag} className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 shadow-sm">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Integration Method */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <LinkIcon size={14} /> Integration Method
            </h4>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed min-h-[100px]">
              {artifactB.integration_method || 'Not specified.'}
            </div>
          </div>

          {/* Legacy Volume */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Database size={14} /> Legacy Volume
            </h4>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed min-h-[100px]">
              {artifactB.legacy_volume || 'Not specified.'}
            </div>
          </div>
        </div>

        {/* Schemas & Contracts */}
        {(artifactB.schemas?.length > 0 || artifactB.contracts?.length > 0) && (
          <div className="border-t border-slate-100 pt-6">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <FileJson size={14} /> Technical Artifacts & Links
            </h4>
            <div className="space-y-3">
              {artifactB.schemas?.map((url, i) => {
                const { href, isLink } = ensureExternalUrl(url);
                return (
                  <div key={`schema-${i}`} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-emerald-300 transition-colors">
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded uppercase tracking-wider shrink-0">Schema</span>
                    {isLink ? (
                      <a href={href} target="_blank" rel="noreferrer" className="text-sm font-mono text-blue-600 hover:text-blue-800 hover:underline truncate">
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
                  <div key={`contract-${i}`} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-emerald-300 transition-colors">
                    <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-1 rounded uppercase tracking-wider shrink-0">Contract</span>
                    {isLink ? (
                      <a href={href} target="_blank" rel="noreferrer" className="text-sm font-mono text-purple-600 hover:text-purple-800 hover:underline truncate">
                        {url}
                      </a>
                    ) : (
                      <span className="text-sm font-mono text-slate-700 truncate">{url}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}