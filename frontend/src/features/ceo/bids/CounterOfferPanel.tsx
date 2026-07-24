import { useState } from 'react';
import { Form, Formik } from 'formik';
import * as Yup from 'yup';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/modal';
import { useCreateOffer } from '@/hooks/use-bids';
import type { BidOfferDto, MilestoneOfferTermDto } from '@/types/api.types';

const schema = Yup.object({
  milestones: Yup.array().of(
    Yup.object({
      deliverable_statement: Yup.string().trim().required('Deliverable is required'),
      price_vnd: Yup.number()
        .integer()
        .positive()
        .max(100000000000, 'Price must be realistic (Max 100 Billion VND)')
        .required('Price is required'),
      estimated_duration_days: Yup.number()
        .integer()
        .positive()
        .max(1000, 'Duration must be realistic (Max 1000 days)')
        .optional(),
      criteria_text: Yup.string().trim().required('At least one criterion is required'),
    }),
  ).min(1).required(),
});

type EditableTerm = MilestoneOfferTermDto & { criteria_text: string };

export default function CounterOfferPanel({
  bidId,
  currentOffer,
  onCancel,
  onSuccess,
}: {
  bidId: string;
  currentOffer: BidOfferDto;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const createOffer = useCreateOffer();
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState<(() => void) | null>(null);

  const initialValues = {
    milestones: currentOffer.milestones.map((term): EditableTerm => ({
      ...term,
      price_vnd: term.price_vnd ?? 0,
      criteria_text: term.criteria.map((criterion) => criterion.criterion_text).join('\n'),
    })),
  };

  return (
    <>
      <Formik
        initialValues={initialValues}
        validationSchema={schema}
        onSubmit={(values, helpers) => {
        const isUnchanged = JSON.stringify(values.milestones) === JSON.stringify(initialValues.milestones);
        
        const submitFn = () => {
          const milestones = values.milestones.map(({ criteria_text, ...term }) => ({
            ...term,
            price_vnd: Number(term.price_vnd),
            estimated_duration_days: term.estimated_duration_days
              ? Number(term.estimated_duration_days)
              : undefined,
            criteria: criteria_text
              .split('\n')
              .map((criterion) => criterion.trim())
              .filter(Boolean)
              .map((criterion_text) => ({ criterion_text, is_required: true })),
          }));
          createOffer.mutate(
            { bidId, body: { respondingToVersion: currentOffer.version, milestones } },
            { onSuccess, onSettled: () => helpers.setSubmitting(false) },
          );
        };

        if (isUnchanged) {
          setPendingSubmit(() => submitFn);
          setShowConfirm(true);
          helpers.setSubmitting(false);
        } else {
          submitFn();
        }
      }}
    >
      {({ values, errors, touched, handleChange, isSubmitting }) => (
        <Form className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/30 p-5">
          <div>
            <h2 className="font-semibold text-slate-900">Create counter offer</h2>
            <p className="mt-1 text-xs text-slate-500">Editing deliverables or criteria sends the offer back to Tech Team review.</p>
          </div>
          {values.milestones.map((milestone, index) => (
            <fieldset key={milestone.milestone_number} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
              <legend className="px-2 text-sm font-semibold text-slate-700">Milestone {milestone.milestone_number}</legend>
              <label className="block text-xs font-medium text-slate-600" htmlFor={`input-counter-deliverable-${index}`}>
                Deliverable
                <textarea id={`input-counter-deliverable-${index}`} name={`milestones.${index}.deliverable_statement`} value={milestone.deliverable_statement} onChange={handleChange} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-slate-600" htmlFor={`input-counter-price-${index}`}>
                  Price (VND)
                  <input id={`input-counter-price-${index}`} name={`milestones.${index}.price_vnd`} type="number" min={1} value={milestone.price_vnd ?? ''} onChange={handleChange} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <label className="text-xs font-medium text-slate-600" htmlFor={`input-counter-duration-${index}`}>
                  Duration (days)
                  <input id={`input-counter-duration-${index}`} name={`milestones.${index}.estimated_duration_days`} type="number" min={1} value={milestone.estimated_duration_days ?? ''} onChange={handleChange} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </label>
              </div>
              <label className="block text-xs font-medium text-slate-600" htmlFor={`input-counter-criteria-${index}`}>
                Acceptance criteria (one per line)
                <textarea id={`input-counter-criteria-${index}`} name={`milestones.${index}.criteria_text`} value={milestone.criteria_text} onChange={handleChange} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </label>
              {touched.milestones?.[index] && errors.milestones?.[index] ? (
                <div className="text-xs text-red-600">
                  {typeof errors.milestones[index] === 'string' 
                    ? errors.milestones[index] 
                    : Object.values(errors.milestones[index] as Record<string, string>).map((err, i) => (
                        <p key={i}>• {err}</p>
                      ))}
                </div>
              ) : null}
            </fieldset>
          ))}
          {createOffer.error ? <p className="text-sm text-red-600">{(createOffer.error as any)?.response?.data?.message?.message || (createOffer.error as any)?.response?.data?.message || 'Counter offer failed.'}</p> : null}
          <div className="flex justify-end gap-3">
            <Button id="btn-cancel-counter-offer" type="button" variant="ghost" onClick={onCancel} className="cursor-pointer">Cancel</Button>
            <Button id="btn-submit-counter-offer" type="submit" variant="primary" disabled={isSubmitting || createOffer.isPending} className="cursor-pointer disabled:cursor-not-allowed">
              {createOffer.isPending ? 'Sending…' : 'Send counter offer'}
            </Button>
          </div>
        </Form>
      )}
    </Formik>

      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => {
          setShowConfirm(false);
          setPendingSubmit(null);
        }}
        onConfirm={() => {
          if (pendingSubmit) pendingSubmit();
          setShowConfirm(false);
          setPendingSubmit(null);
        }}
        title="No Changes Detected"
        confirmText="Submit Anyway"
        cancelText="Review Again"
        isInfo
      >
        You haven't made any changes to the milestones, prices, or criteria. Are you sure you want to submit the exact same offer back?
      </ConfirmModal>
    </>
  );
}
