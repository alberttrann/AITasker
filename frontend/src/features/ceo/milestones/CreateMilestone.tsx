import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Formik, Form, Field, FieldArray } from "formik";
import * as Yup from "yup";
import { useEngagement, useEngagementMilestones } from "@/hooks/use-engagements";
import { useProject } from "@/hooks/use-projects";
import { useCreateMilestone } from "@/hooks/use-milestones";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { ArrowLeft, Plus, Trash2, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { formatVND } from "@/lib/utils";

const validationSchema = Yup.object().shape({
  milestones: Yup.array().of(
    Yup.object().shape({
      deliverable_statement: Yup.string()
        .required("Deliverable statement is required")
        .min(10, "Deliverable statement must be at least 10 characters"),
      payment_amount_vnd: Yup.number()
        .required("Payment amount is required")
        .positive("Payment amount must be greater than zero")
        .min(10000, "Minimum payment amount is 10,000 VND"),
      sign_off_authority: Yup.string()
        .oneOf(["CEO", "TECH_TEAM", "JOINT"], "Invalid sign-off authority")
        .required("Sign-off authority is required"),
      criteria: Yup.array()
        .of(
          Yup.object().shape({
            criterion_text: Yup.string()
              .required("Acceptance criterion description is required")
              .min(5, "Criterion description must be at least 5 characters"),
            is_required: Yup.boolean().default(true),
          })
        )
        .min(1, "At least one acceptance criterion is required"),
    })
  ),
});

export default function CreateMilestone() {
  const { engagementId } = useParams<{ engagementId: string }>();
  const navigate = useNavigate();

  const [creatingIndex, setCreatingIndex] = useState<number | null>(null);

  // Fetch engagement and project context to pull blueprint drafts
  const {
    data: engagement,
    isLoading: isLoadingEngagement,
    error: engagementError,
  } = useEngagement(engagementId);

  const projectId = engagement?.projectId || (engagement as any)?.project_id;
  const { data: project, isLoading: isLoadingProject } = useProject(projectId);

  const {
    data: milestonesData,
    isLoading: isLoadingMilestones,
    error: milestonesError,
  } = useEngagementMilestones(engagementId);

  const createMilestoneMutation = useCreateMilestone();

  const isLoading = isLoadingEngagement || isLoadingProject || isLoadingMilestones;
  const error = engagementError || milestonesError;

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !engagement) {
    const errorMsg =
      (error as any)?.response?.data?.message ||
      "Failed to load context for milestone creation.";
    return (
      <div className="w-full max-w-[1440px] px-6 mx-auto py-8">
        <ErrorBanner message={errorMsg} />
        <Button
          variant="outline"
          onClick={() => navigate(-1)}
          className="mt-4 inline-flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft size={16} /> Go Back
        </Button>
      </div>
    );
  }

  // Filter draft blueprint milestones that have not yet been instantiated in the database
  const instantiatedMilestones = milestonesData ?? [];
  const draftFramework = project?.milestoneFrameworkJson || (project as any)?.milestone_framework_json || [];

  const pendingDrafts = draftFramework.filter((draft: any) => {
    const num = draft.milestone_number || draft.milestoneNumber;
    return !instantiatedMilestones.some(
      (m: any) => m.milestoneNumber === num || m.milestone_number === num
    );
  });

  const nextMilestoneNumber = (milestonesData?.length ?? 0) + 1;

  // Prefill initial values using the pending drafts from the project framework
  const initialMilestones =
    pendingDrafts.length > 0
      ? pendingDrafts.map((draft: any) => {
          const draftCriteria =
            draft.criteria || draft.acceptanceCriteria || draft.acceptance_criteria || [];
          const criteriaList =
            Array.isArray(draftCriteria) && draftCriteria.length > 0
              ? draftCriteria.map((c: any) => ({
                  criterion_text: typeof c === "string" ? c : c.criterionText || c.criterion_text || "",
                  is_required: c.isRequired !== undefined ? c.isRequired : c.is_required !== undefined ? c.is_required : true,
                }))
              : [{ criterion_text: "", is_required: true }];

          return {
            engagement_id: engagementId || "",
            milestone_number: draft.milestone_number || draft.milestoneNumber,
            deliverable_statement: draft.deliverable_statement || draft.deliverableStatement || "",
            payment_amount_vnd:
              draft.payment_amount_vnd !== undefined
                ? draft.payment_amount_vnd
                : draft.paymentAmountVnd || 0,
            sign_off_authority: (draft.sign_off_authority ||
              draft.signOffAuthority ||
              "CEO") as "CEO" | "TECH_TEAM" | "JOINT",
            criteria: criteriaList,
          };
        })
      : [
          {
            engagement_id: engagementId || "",
            milestone_number: nextMilestoneNumber,
            deliverable_statement: "",
            payment_amount_vnd: 0,
            sign_off_authority: "CEO" as const,
            criteria: [{ criterion_text: "", is_required: true }],
          },
        ];

  const initialValues = {
    milestones: initialMilestones,
  };

  const handleSubmit = async (values: typeof initialValues, { setSubmitting }: any) => {
    try {
      // Create milestones sequentially to prevent database locks or sequencing violations
      for (let i = 0; i < values.milestones.length; i++) {
        setCreatingIndex(i);
        await createMilestoneMutation.mutateAsync(values.milestones[i]);
      }
      setCreatingIndex(null);
      setSubmitting(false);
      navigate(`/ceo/engagements/${engagementId}/milestones`);
    } catch (err) {
      setCreatingIndex(null);
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-[900px] px-6 mx-auto py-8 font-body">
      {/* Back button */}
      <button
        onClick={() => navigate(`/ceo/engagements/${engagementId}/milestones`)}
        className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
      >
        <ArrowLeft size={16} /> Back to Milestones
      </button>

      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {pendingDrafts.length > 0 ? "Instantiate Draft Milestones" : "Create Custom Milestones"}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {pendingDrafts.length > 0
              ? `Review and instantiate the ${pendingDrafts.length} draft milestones defined in your project framework.`
              : "Define and initialize custom milestones for execution."}
          </p>
        </div>
      </div>

      <Formik
        enableReinitialize={true}
        initialValues={initialValues}
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
      >
        {({ values, errors, touched, setFieldValue, isSubmitting }) => (
          <Form className="space-y-8">
            <FieldArray name="milestones">
              {({ push, remove }) => (
                <div className="space-y-8">
                  {values.milestones.map((m, index) => {
                    const milestoneErrors = (errors.milestones?.[index] as any) || {};
                    const milestoneTouched = (touched.milestones?.[index] as any) || {};

                    return (
                      <Card
                        key={index}
                        className="shadow-md border border-slate-200 rounded-xl overflow-hidden bg-white hover:border-emerald-100 transition-colors"
                      >
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                              {index + 1}
                            </span>
                            <h2 className="font-bold text-slate-800">
                              Milestone #{m.milestone_number}
                            </h2>
                          </div>
                          {values.milestones.length > 1 && (
                            <button
                              type="button"
                              id={`btn-delete-card-${index}`}
                              onClick={() => remove(index)}
                              className="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-slate-200/50 transition-colors cursor-pointer"
                              title="Delete this milestone card"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>

                        <CardContent className="p-6 space-y-6">
                          {/* Deliverable Statement */}
                          <div className="space-y-2">
                            <label
                              htmlFor={`milestones[${index}].deliverable_statement`}
                              className="text-sm font-semibold text-slate-700 block"
                            >
                              Deliverable Statement
                            </label>
                            <Field
                              as="textarea"
                              id={`input-deliverable-statement-${index}`}
                              name={`milestones[${index}].deliverable_statement`}
                              rows={3}
                              placeholder="Describe deliverables and outputs..."
                              className={`w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none ${
                                milestoneTouched.deliverable_statement &&
                                milestoneErrors.deliverable_statement
                                  ? "border-red-300 bg-red-50/10 focus:ring-red-500"
                                  : "border-slate-200"
                              }`}
                            />
                            {milestoneTouched.deliverable_statement &&
                              milestoneErrors.deliverable_statement && (
                                <p className="text-xs text-red-500 flex items-center gap-1">
                                  <AlertCircle size={12} /> {milestoneErrors.deliverable_statement}
                                </p>
                              )}
                          </div>

                          {/* Grid of details */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Payment amount */}
                            <div className="space-y-2">
                              <label
                                htmlFor={`milestones[${index}].payment_amount_vnd`}
                                className="text-sm font-semibold text-slate-700 block"
                              >
                                Payment Amount (VND)
                              </label>
                              <div
                                className={`relative flex items-center rounded-lg border px-4 py-3 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-transparent transition-all ${
                                  milestoneTouched.payment_amount_vnd &&
                                  milestoneErrors.payment_amount_vnd
                                    ? "border-red-300 bg-red-50/10 focus-within:ring-red-500"
                                    : "border-slate-200"
                                }`}
                              >
                                <CurrencyInput
                                  id={`input-payment-amount-vnd-${index}`}
                                  value={m.payment_amount_vnd || undefined}
                                  onChange={(val) =>
                                    setFieldValue(`milestones[${index}].payment_amount_vnd`, val ?? 0)
                                  }
                                  placeholder="e.g. 15.000.000"
                                  className="text-slate-800 text-sm font-semibold pr-8"
                                />
                                <span className="absolute right-4 text-xs font-bold text-slate-400 font-mono">
                                  VND
                                </span>
                              </div>
                              {milestoneTouched.payment_amount_vnd &&
                              milestoneErrors.payment_amount_vnd ? (
                                <p className="text-xs text-red-500 flex items-center gap-1">
                                  <AlertCircle size={12} /> {milestoneErrors.payment_amount_vnd}
                                </p>
                              ) : (
                                m.payment_amount_vnd > 0 && (
                                  <p className="text-xs text-emerald-600 font-semibold font-mono">
                                    ≈ {formatVND(m.payment_amount_vnd)}
                                  </p>
                                )
                              )}
                            </div>

                            {/* Sign-off Authority */}
                            <div className="space-y-2">
                              <label
                                htmlFor={`milestones[${index}].sign_off_authority`}
                                className="text-sm font-semibold text-slate-700 block"
                              >
                                Sign-off Authority
                              </label>
                              <Field
                                as="select"
                                id={`select-sign-off-authority-${index}`}
                                name={`milestones[${index}].sign_off_authority`}
                                className={`w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none cursor-pointer bg-white text-slate-800 ${
                                  milestoneTouched.sign_off_authority &&
                                  milestoneErrors.sign_off_authority
                                    ? "border-red-300 focus:ring-red-500"
                                    : "border-slate-200"
                                }`}
                              >
                                <option value="CEO">CEO Only</option>
                                <option value="TECH_TEAM">Internal Tech Team</option>
                                <option value="JOINT">Joint Sign-off (CEO & Tech Team)</option>
                              </Field>
                              {milestoneTouched.sign_off_authority &&
                                milestoneErrors.sign_off_authority && (
                                  <p className="text-xs text-red-500 flex items-center gap-1">
                                    <AlertCircle size={12} /> {milestoneErrors.sign_off_authority}
                                  </p>
                                )}
                            </div>
                          </div>

                          {/* Acceptance Criteria Sub-Array */}
                          <div className="border-t border-slate-100 pt-6 space-y-4">
                            <div>
                              <h3 className="text-sm font-bold text-slate-800">
                                Acceptance Criteria
                              </h3>
                            </div>

                            <FieldArray name={`milestones[${index}].criteria`}>
                              {({ push: pushCrit, remove: removeCrit }) => (
                                <div className="space-y-3">
                                  {m.criteria.map((_, critIndex) => {
                                    const criterionErrors =
                                      (milestoneErrors.criteria?.[critIndex] as any) || {};
                                    const criterionTouched =
                                      (milestoneTouched.criteria?.[critIndex] as any) || {};

                                    return (
                                      <div
                                        key={critIndex}
                                        className="p-4 border border-slate-100 rounded-lg bg-slate-50/50 space-y-3 relative group"
                                      >
                                        {m.criteria.length > 1 && (
                                          <button
                                            type="button"
                                            id={`btn-delete-criterion-${index}-${critIndex}`}
                                            onClick={() => removeCrit(critIndex)}
                                            className="absolute top-4 right-4 text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-slate-200/50 transition-colors cursor-pointer"
                                            title="Remove criterion"
                                          >
                                            <Trash2 size={16} />
                                          </button>
                                        )}

                                        <div className="space-y-1 pr-8">
                                          <label
                                            htmlFor={`milestones[${index}].criteria[${critIndex}].criterion_text`}
                                            className="text-xs font-semibold text-slate-500 block"
                                          >
                                            Criterion #{critIndex + 1}
                                          </label>
                                          <Field
                                            type="text"
                                            id={`input-criterion-text-${index}-${critIndex}`}
                                            name={`milestones[${index}].criteria[${critIndex}].criterion_text`}
                                            placeholder="Criterion description..."
                                            className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none bg-white ${
                                              criterionTouched.criterion_text &&
                                              criterionErrors.criterion_text
                                                ? "border-red-300 bg-red-50/10 focus:ring-red-500"
                                                : "border-slate-200"
                                            }`}
                                          />
                                          {criterionTouched.criterion_text &&
                                            criterionErrors.criterion_text && (
                                              <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                                                <AlertCircle size={10} />{" "}
                                                {criterionErrors.criterion_text}
                                              </p>
                                            )}
                                        </div>
                                      </div>
                                    );
                                  })}

                                  {typeof milestoneErrors.criteria === "string" && (
                                    <p className="text-xs text-red-500 flex items-center gap-1">
                                      <AlertCircle size={12} /> {milestoneErrors.criteria}
                                    </p>
                                  )}

                                  <Button
                                    type="button"
                                    id={`btn-add-criterion-${index}`}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => pushCrit({ criterion_text: "", is_required: true })}
                                    className="inline-flex items-center gap-1 text-slate-700 hover:bg-slate-100 cursor-pointer"
                                  >
                                    <Plus size={14} /> Add Criterion
                                  </Button>
                                </div>
                              )}
                            </FieldArray>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}

                  {/* Add custom milestone card */}
                  <Button
                    type="button"
                    id="btn-add-milestone-card"
                    variant="outline"
                    onClick={() =>
                      push({
                        engagement_id: engagementId || "",
                        milestone_number: values.milestones.length + 1,
                        deliverable_statement: "",
                        payment_amount_vnd: 0,
                        sign_off_authority: "CEO" as const,
                        criteria: [{ criterion_text: "", is_required: true }],
                      })
                    }
                    className="w-full flex items-center justify-center gap-2 py-4 border-dashed border-2 text-slate-600 border-slate-300 hover:border-emerald-500 hover:text-emerald-600 cursor-pointer rounded-xl"
                  >
                    <Plus size={18} /> Add Custom Milestone Card
                  </Button>
                </div>
              )}
            </FieldArray>

            {/* Global API submission error banner */}
            {createMilestoneMutation.isError && (
              <ErrorBanner
                message={
                  (createMilestoneMutation.error as any)?.response?.data?.message ||
                  "Failed to create milestones. Check details and try again."
                }
              />
            )}

            {/* Submitting Status Overlay */}
            {creatingIndex !== null && (
              <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100 flex flex-col items-center gap-4 max-w-sm text-center">
                  <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                  <div>
                    <h3 className="font-bold text-slate-800">Creating Milestones</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Instantiating milestone {creatingIndex + 1} of {values.milestones.length}...
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Actions Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-6">
              <Button
                type="button"
                id="btn-cancel-milestones"
                variant="outline"
                onClick={() => navigate(`/ceo/engagements/${engagementId}/milestones`)}
                className="cursor-pointer"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                id="btn-submit-milestones"
                variant="primary"
                disabled={isSubmitting || createMilestoneMutation.isPending}
                className="inline-flex items-center gap-2 cursor-pointer"
              >
                {createMilestoneMutation.isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Instantiating...
                  </>
                ) : (
                  "Create Pending Milestones"
                )}
              </Button>
            </div>
          </Form>
        )}
      </Formik>
    </div>
  );
}
