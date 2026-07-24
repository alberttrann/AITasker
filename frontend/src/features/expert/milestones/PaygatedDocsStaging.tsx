import { useState } from 'react';
import { FileText, Plus, X, Upload, Lock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/Spinner';
import { useUploadDocument, useUploadBulkDocuments } from '@/hooks/use-submissions';
import type { PaygatedDocumentDto } from '@/types/api.types';

interface PaygatedDocsStagingProps {
  milestoneId: string;
}


export default function PaygatedDocsStaging({ milestoneId }: PaygatedDocsStagingProps) {
  const uploadDocument = useUploadDocument();
  const uploadBulkDocuments = useUploadBulkDocuments();

  const [urls, setUrls] = useState<string[]>(['']);
  const [stagedThisSession, setStagedThisSession] = useState<PaygatedDocumentDto[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const isPending = uploadDocument.isPending || uploadBulkDocuments.isPending;

  const addUrlField = () => setUrls((prev) => [...prev, '']);
  const removeUrlField = (index: number) =>
    setUrls((prev) => prev.filter((_, i) => i !== index));
  const updateUrlField = (index: number, value: string) =>
    setUrls((prev) => prev.map((u, i) => (i === index ? value : u)));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmed = urls.map((u) => u.trim()).filter(Boolean);
    if (trimmed.length === 0) {
      setFormError('Add at least one document URL.');
      return;
    }

    if (trimmed.length === 1) {
      uploadDocument.mutate(
        { milestoneId, body: { document_url: trimmed[0] } },
        {
          onSuccess: (doc) => {
            setStagedThisSession((prev) => [...prev, doc]);
            setUrls(['']);
          },
          onError: (err: any) => {
            setFormError(
              err?.response?.data?.message?.[0] ||
                err?.response?.data?.message ||
                'Failed to stage document.',
            );
          },
        },
      );
    } else {
      uploadBulkDocuments.mutate(
        { milestoneId, body: { documentUrls: trimmed } },
        {
          onSuccess: () => {
            setStagedThisSession((prev) => [
              ...prev,
              ...trimmed.map((url) => ({
                id: `local-${url}-${Date.now()}`,
                milestoneId,
                documentUrl: url,
                releaseState: 'STAGED' as const,
                stagedAt: new Date().toISOString(),
                releasedAt: null,
              })),
            ]);
            setUrls(['']);
          },
          onError: (err: any) => {
            setFormError(
              err?.response?.data?.message?.[0] ||
                err?.response?.data?.message ||
                'Failed to stage documents.',
            );
          },
        },
      );
    }
  };

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex items-center gap-2 mb-1">
        <FileText size={18} className="text-slate-500" />
        <h3 className="text-base font-bold text-slate-900">Pay-Gated Technical Documents</h3>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Stage detailed technical documents (specs, architecture diagrams, credentials, etc.)
        now. They'll automatically unlock to the client and tech team the moment this
        milestone is funded — you don't need to come back and do anything else.
      </p>

      {stagedThisSession.length > 0 && (
        <div className="mb-4 space-y-2">
          {stagedThisSession.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
            >
              <Lock size={14} className="text-amber-500 shrink-0" />
              <span className="truncate flex-1 text-slate-700">{doc.documentUrl}</span>
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                Staged
              </span>
            </div>
          ))}
          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <CheckCircle2 size={12} />
            {stagedThisSession.length} document{stagedThisSession.length === 1 ? '' : 's'} staged this session — will unlock automatically once funded.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {urls.map((url, i) => (
          <div key={i} className="flex gap-2">
            <Input
              type="url"
              placeholder="https://..."
              value={url}
              onChange={(e) => updateUrlField(i, e.target.value)}
              disabled={isPending}
            />
            {urls.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeUrlField(i)}
                disabled={isPending}
                className="shrink-0 text-slate-400 hover:text-rose-600"
              >
                <X size={16} />
              </Button>
            )}
          </div>
        ))}

        {formError && <p className="text-xs text-red-600">{formError}</p>}

        <div className="flex items-center justify-between gap-3 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addUrlField}
            disabled={isPending}
            className="text-slate-500"
          >
            <Plus size={14} className="mr-1" />
            Add another
          </Button>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? (
              <>
                <Spinner size="sm" className="mr-1.5" />
                Staging...
              </>
            ) : (
              <>
                <Upload size={14} className="mr-1.5" />
                Stage Document{urls.filter((u) => u.trim()).length > 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}