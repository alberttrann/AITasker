import React, { useState } from 'react';
import { useGetDodItems, useCreateDodItem, useDeleteDodItem } from '@/hooks/use-dod';
import { Plus, Trash2, Loader2, ListTodo } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function DoDEditor({ milestoneId }: { milestoneId: string }) {
  const { data: dodItems, isLoading } = useGetDodItems(milestoneId);
  const createDod = useCreateDodItem();
  const deleteDod = useDeleteDodItem();

  const [newText, setNewText] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = () => {
    if (!newText.trim()) return;
    createDod.mutate({
      milestoneId,
      body: { item_description: newText, is_required: true }
    }, {
      onSuccess: () => {
        setNewText("");
        setIsAdding(false);
      }
    });
  };

  if (isLoading) return <div className="py-2"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>;

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-bold text-slate-700">Definition of Done (DoD)</h4>
        {!isAdding && (
          <button onClick={() => setIsAdding(true)} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
            <Plus className="w-3 h-3" /> Add
          </button>
        )}
      </div>

      <div className="space-y-2">
        {dodItems?.map((d: any) => (
          <div key={d.id} className="group flex items-start justify-between gap-3 p-2 bg-slate-50 rounded-lg border border-slate-100">
            <div className="flex items-start gap-2 flex-1">
              <ListTodo className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-slate-700 leading-snug">{d.itemDescription || d.item_description}</p>
            </div>
            <button 
              onClick={() => deleteDod.mutate({ itemId: d.id, milestoneId })}
              disabled={deleteDod.isPending}
              className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {dodItems?.length === 0 && !isAdding && (
          <p className="text-xs text-slate-500 italic">No DoD items defined.</p>
        )}
      </div>

      {isAdding && (
        <div className="mt-3 flex gap-2">
          <input 
            type="text" 
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="E.g., All unit tests passing"
            className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            autoFocus
          />
          <Button size="sm" variant="primary" onClick={handleAdd} disabled={!newText.trim() || createDod.isPending}>
            {createDod.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setIsAdding(false)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
