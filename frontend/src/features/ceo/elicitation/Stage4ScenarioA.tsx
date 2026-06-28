import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/input';
import { submitStage4, handleElicitationError, type GateResult } from '@/hooks/use-elicitation';
import { X } from 'lucide-react';

interface Stage4AProps {
  sessionId: string;
  onComplete: (data: { gateResult: GateResult }) => void;
  onError: (msg: string) => void;
}

export default function Stage4ScenarioA({ sessionId, onComplete, onError }: Stage4AProps) {
  const [scaleAndInfrastructure, setScaleAndInfrastructure] = useState('');
  const [integrationMethod, setIntegrationMethod] = useState('');
  const [legacyVolume, setLegacyVolume] = useState('');
  const [schemas, setSchemas] = useState<string[]>([]);
  const [contracts, setContracts] = useState<string[]>([]);
  const [schemaInput, setSchemaInput] = useState('');
  const [contractInput, setContractInput] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = scaleAndInfrastructure.trim().length > 0 && integrationMethod.trim().length > 0 && legacyVolume.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      const data = await submitStage4(sessionId, scaleAndInfrastructure.trim(), integrationMethod.trim(), legacyVolume.trim(), schemas, contracts);
      onComplete({ gateResult: data as GateResult });
    } catch (err: any) {
      onError(handleElicitationError(err).message || 'Failed to submit technical context.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addUrl = (type: 'schema' | 'contract') => {
    if (type === 'schema' && schemaInput.trim()) {
      setSchemas([...schemas, schemaInput.trim()]);
      setSchemaInput('');
    } else if (type === 'contract' && contractInput.trim()) {
      setContracts([...contracts, contractInput.trim()]);
      setContractInput('');
    }
  };

  const ta = "w-full rounded-lg border border-slate-200 bg-surface px-4 py-3 text-body text-primary placeholder:text-secondary transition-shadow hover:border-primary focus:border-2 focus:border-primary focus:ring-[3px] focus:ring-primary/10 focus:outline-none";

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-h2 font-headline text-primary">Stage 4 of 5</h2>
        <p className="text-body-sm text-secondary">Technical Context — since you marked yourself as technical, please fill in these details about your infrastructure.</p>
      </div>
      <div className="space-y-6">
        <div className="space-y-2">
          <Label>Scale and Infrastructure</Label>
          <p className="text-caption text-secondary">Describe your current infrastructure and scale.</p>
          <textarea value={scaleAndInfrastructure} onChange={(e) => setScaleAndInfrastructure(e.target.value)} placeholder="e.g. AWS EKS, 500k req/day…" rows={3} className={ta} />
        </div>
        <div className="space-y-2">
          <Label>Integration Method</Label>
          <p className="text-caption text-secondary">How do you prefer to integrate with the AI service?</p>
          <textarea value={integrationMethod} onChange={(e) => setIntegrationMethod(e.target.value)} placeholder="e.g. REST APIs…" rows={3} className={ta} />
        </div>
        <div className="space-y-2">
          <Label>Legacy Volume</Label>
          <p className="text-caption text-secondary">How much legacy data do you have?</p>
          <textarea value={legacyVolume} onChange={(e) => setLegacyVolume(e.target.value)} placeholder="e.g. ~2TB in S3…" rows={2} className={ta} />
        </div>
        
        <div className="space-y-2">
          <Label>Schemas (Optional)</Label>
          <p className="text-caption text-secondary">Links to your data schemas.</p>
          <div className="flex gap-2">
            <input value={schemaInput} onChange={e => setSchemaInput(e.target.value)} placeholder="https://..." className="flex-1 rounded-lg border border-slate-200 bg-surface px-4 py-3 text-body text-primary focus:border-primary focus:ring-[3px] focus:ring-primary/10 focus:outline-none" onKeyDown={e => e.key === 'Enter' && addUrl('schema')} />
            <Button variant="secondary" onClick={() => addUrl('schema')}>Add</Button>
          </div>
          {schemas.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {schemas.map((url, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs">
                  {url.length > 40 ? url.substring(0, 40) + '...' : url}
                  <button onClick={() => setSchemas(schemas.filter((_, j) => j !== i))} className="ml-1 text-red-500 hover:text-red-700"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Contracts (Optional)</Label>
          <p className="text-caption text-secondary">Links to your API contracts.</p>
          <div className="flex gap-2">
            <input value={contractInput} onChange={e => setContractInput(e.target.value)} placeholder="https://..." className="flex-1 rounded-lg border border-slate-200 bg-surface px-4 py-3 text-body text-primary focus:border-primary focus:ring-[3px] focus:ring-primary/10 focus:outline-none" onKeyDown={e => e.key === 'Enter' && addUrl('contract')} />
            <Button variant="secondary" onClick={() => addUrl('contract')}>Add</Button>
          </div>
          {contracts.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {contracts.map((url, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs">
                  {url.length > 40 ? url.substring(0, 40) + '...' : url}
                  <button onClick={() => setContracts(contracts.filter((_, j) => j !== i))} className="ml-1 text-red-500 hover:text-red-700"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between pt-4">
        <span className="text-caption text-secondary" />
        <Button variant="primary" disabled={!canSubmit || isSubmitting} onClick={handleSubmit}>
          {isSubmitting ? 'Submitting…' : 'Submit & Generate PRD →'}
        </Button>
      </div>
    </div>
  );
}
