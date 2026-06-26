import React, { useState } from 'react';
import { apiClient } from '../../../lib/api-client'; 
import Stage4Submitted from './Stage4Submitted';

export default function Stage4Form() {
  // Lấy handoff session ID từ sessionStorage
  const sessionId = sessionStorage.getItem('handoff_sessionId');

  // Trạng thái các trường dữ liệu (Chuỗi chuẩn - String)
  const [scaleAndInfrastructure, setScaleAndInfrastructure] = useState('');
  const [integrationMethod, setIntegrationMethod] = useState('');
  const [legacyVolume, setLegacyVolume] = useState('');

  // Trạng thái danh sách Tech Stack (Hỗ trợ nút Add và hiển thị dạng thẻ tag)
  const [techStackList, setTechStackList] = useState<string[]>([]);
  const [techStackInput, setTechStackInput] = useState('');

  // Trạng thái danh sách URL (Mảng - Array)
  const [schemas, setSchemas] = useState<string[]>([]);
  const [schemaInput, setSchemaInput] = useState('');
  const [contracts, setContracts] = useState<string[]>([]);
  const [contractInput, setContractInput] = useState('');

  // Trạng thái xử lý UI
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Thêm/Xóa Tech Stack
  const addTechStack = () => {
    const trimmed = techStackInput.trim();
    if (trimmed) {
      if (!techStackList.includes(trimmed)) {
        setTechStackList([...techStackList, trimmed]);
      }
      setTechStackInput('');
      setError(null);
    }
  };

  const removeTechStack = (indexToRemove: number) => {
    setTechStackList(techStackList.filter((_, i) => i !== indexToRemove));
  };

  // Thêm/Xóa Schema URL
  const addSchema = () => {
    const trimmed = schemaInput.trim();
    if (trimmed) {
      if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        setError('Please enter a valid URL (starting with http:// or https://)');
        return;
      }
      if (!schemas.includes(trimmed)) {
        setSchemas([...schemas, trimmed]);
      }
      setSchemaInput('');
      setError(null);
    }
  };

  const removeSchema = (indexToRemove: number) => {
    setSchemas(schemas.filter((_, i) => i !== indexToRemove));
  };

  // Thêm/Xóa Contract URL
  const addContract = () => {
    const trimmed = contractInput.trim();
    if (trimmed) {
      if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        setError('Please enter a valid URL (starting with http:// or https://)');
        return;
      }
      if (!contracts.includes(trimmed)) {
        setContracts([...contracts, trimmed]);
      }
      setContractInput('');
      setError(null);
    }
  };

  const removeContract = (indexToRemove: number) => {
    setContracts(contracts.filter((_, i) => i !== indexToRemove));
  };

  // Submit dữ liệu về Backend
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId) return;

    // Tự động thêm nội dung đang gõ dở ở ô Tech Stack vào danh sách nếu có
    let finalTechStack = [...techStackList];
    if (techStackInput.trim()) {
      const trimmedInput = techStackInput.trim();
      if (!finalTechStack.includes(trimmedInput)) {
        finalTechStack.push(trimmedInput);
      }
    }

    if (
      !scaleAndInfrastructure.trim() ||
      !integrationMethod.trim() ||
      !legacyVolume.trim() ||
      finalTechStack.length === 0
    ) {
      setError('Please fill in all the required technical context fields (including at least one Tech Stack).');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    // Ghép mảng thành một chuỗi phân tách bởi dấu phẩy
    const techStackString = finalTechStack.join(', ');

    try {
      // Gửi song song cả hai chuẩn đặt tên camelCase và snake_case 
      // để ngăn chặn hoàn toàn lỗi crash 500 hoặc validate 400 ở backend
      await apiClient.put(`/elicitation/${sessionId}/stage4-handoff`, {
        // scaleAndInfrastructure
        scaleAndInfrastructure,
        scale_infrastructure: scaleAndInfrastructure,

        // integrationMethod
        integrationMethod,
        integration_method: integrationMethod,

        // legacyVolume / data_available
        legacyVolume,
        data_available: legacyVolume,

        // current_stack
        current_stack: techStackString,
        currentStack: techStackString,

        // URL lists
        schemas,
        contracts,
      });

      // Dọn dẹp session ID khỏi storage khi thành công
      sessionStorage.removeItem('handoff_sessionId');
      setIsSubmitting(false);
      setIsSubmitted(true);
    } catch (err: any) {
      setIsSubmitting(false);
      const serverMessage = err.response?.data?.message;
      setError(
        Array.isArray(serverMessage)
          ? serverMessage[0]
          : serverMessage || 'An unexpected error occurred during submission. Please try again.'
      );
    }
  };

  if (!sessionId) {
    return (
      <div className="max-w-6xl mx-auto py-16 px-4 text-center font-body">
        <div className="text-error text-5xl mb-4">⚠️</div>
        <h3 className="text-xl font-semibold text-primary mb-2 font-headline">
          Session ID Missing
        </h3>
        <p className="text-secondary">
          Please make sure you have used the correct handoff link provided by your CEO.
        </p>
      </div>
    );
  }

  if (isSubmitted) {
    return <Stage4Submitted />;
  }

  return (
    <div className="max-w-6xl mx-auto py-10 px-8 bg-surface rounded-lg shadow-md border border-secondary/15 my-8 font-body">
      <h2 className="text-2xl font-bold text-primary mb-2 font-headline leading-[1.25]">
        Complete Technical Context
      </h2>
      <p className="text-sm text-secondary mb-8 leading-relaxed">
        Your CEO has invited you to provide structural and infrastructural details of your system. 
        Your context is crucial to accurately match the best AI experts for this workspace.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Scale & Infrastructure */}
        <div>
          <label className="block text-sm font-semibold text-primary mb-1">
            Scale & Infrastructure <span className="text-error">*</span>
          </label>
          <p className="text-xs text-secondary mb-2">
            Describe your current deployment setup, request volumes, and overall cloud infrastructure.
          </p>
          <textarea
            value={scaleAndInfrastructure}
            onChange={(e) => setScaleAndInfrastructure(e.target.value)}
            className="w-full min-h-[112px] border border-secondary/20 hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary-bg rounded p-3 text-sm text-primary bg-surface outline-none transition-all"
            placeholder="e.g., We deploy on GCP GKE, autoscaling from 10 to 50 pods, handling ~1.5M requests/day using PostgreSQL..."
            required
          />
        </div>

        {/* Integration Method */}
        <div>
          <label className="block text-sm font-semibold text-primary mb-1">
            Integration Method <span className="text-error">*</span>
          </label>
          <p className="text-xs text-secondary mb-2">
            How will the AI model or application integrate with your existing APIs or workflows?
          </p>
          <textarea
            value={integrationMethod}
            onChange={(e) => setIntegrationMethod(e.target.value)}
            className="w-full min-h-[96px] border border-secondary/20 hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary-bg rounded p-3 text-sm text-primary bg-surface outline-none transition-all"
            placeholder="e.g., RESTful APIs, message-driven queue using Apache Kafka, or direct database sink..."
            required
          />
        </div>

        {/* Legacy Data Volume */}
        <div>
          <label className="block text-sm font-semibold text-primary mb-1">
            Legacy Data Volume <span className="text-error">*</span>
          </label>
          <p className="text-xs text-secondary mb-2">
            Mention the size, formats, and storage locations of historical data available for tuning or validation.
          </p>
          <textarea
            value={legacyVolume}
            onChange={(e) => setLegacyVolume(e.target.value)}
            className="w-full min-h-[96px] border border-secondary/20 hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary-bg rounded p-3 text-sm text-primary bg-surface outline-none transition-all"
            placeholder="e.g., ~2TB of tabular transaction history in BigQuery, and around 500GB of unstructured logs..."
            required
          />
        </div>

        {/* Current Tech Stack */}
        <div>
          <label className="block text-sm font-semibold text-primary mb-1">
            Current Tech Stack <span className="text-error">*</span>
          </label>
          <p className="text-xs text-secondary mb-2">
            Add technology tags that your system currently uses (e.g., Python, NestJS, AWS, Kafka).
          </p>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={techStackInput}
              onChange={(e) => setTechStackInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTechStack();
                }
              }}
              className="flex-1 h-[42px] px-3 border border-secondary/20 hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary-bg rounded text-sm text-primary bg-surface outline-none transition-all"
              placeholder="e.g., Python, NestJS, Docker, AWS (Press Enter or Click Add)"
            />
            <button
              type="button"
              onClick={addTechStack}
              className="h-[42px] px-4 border border-primary text-primary rounded text-sm font-medium hover:bg-primary-bg transition-all"
            >
              Add
            </button>
          </div>
          {techStackList.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2 p-3 bg-surface-base border border-secondary/20 rounded">
              {techStackList.map((tag, index) => (
                <div
                  key={index}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-tertiary/10 text-tertiary text-xs font-medium rounded-full"
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => removeTechStack(index)}
                    className="hover:text-error font-bold text-sm leading-none focus:outline-none transition-colors"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Schemas */}
        <div>
          <label className="block text-sm font-semibold text-primary mb-1">
            Schemas / Data Models <span className="text-xs font-normal text-secondary">(Optional)</span>
          </label>
          <p className="text-xs text-secondary mb-2">
            Provide schema links to help experts understand your tables and payload contracts.
          </p>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={schemaInput}
              onChange={(e) => setSchemaInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSchema();
                }
              }}
              className="flex-1 h-[42px] px-3 border border-secondary/20 hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary-bg rounded text-sm text-primary bg-surface outline-none"
              placeholder="e.g., https://yourdomain.com/schemas/user-table.json"
            />
            <button
              type="button"
              onClick={addSchema}
              className="h-[42px] px-4 border border-primary text-primary rounded text-sm font-medium hover:bg-primary-bg transition-all"
            >
              Add
            </button>
          </div>
          {schemas.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2 p-3 bg-surface-base border border-secondary/20 rounded">
              {schemas.map((url, index) => (
                <div
                  key={index}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-tertiary/10 text-tertiary text-xs font-medium rounded-full"
                >
                  <span className="truncate max-w-[240px]">{url}</span>
                  <button
                    type="button"
                    onClick={() => removeSchema(index)}
                    className="hover:text-error font-bold text-sm leading-none focus:outline-none transition-colors"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contracts */}
        <div>
          <label className="block text-sm font-semibold text-primary mb-1">
            API Contracts / Specs <span className="text-xs font-normal text-secondary">(Optional)</span>
          </label>
          <p className="text-xs text-secondary mb-2">
            Provide Swagger, OpenAPI, or other endpoint schema spec URLs.
          </p>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={contractInput}
              onChange={(e) => setContractInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addContract();
                }
              }}
              className="flex-1 h-[42px] px-3 border border-secondary/20 hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary-bg rounded text-sm text-primary bg-surface outline-none"
              placeholder="e.g., https://api.yourdomain.com/v1/swagger-spec.yaml"
            />
            <button
              type="button"
              onClick={addContract}
              className="h-[42px] px-4 border border-primary text-primary rounded text-sm font-medium hover:bg-primary-bg transition-all"
            >
              Add
            </button>
          </div>
          {contracts.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2 p-3 bg-surface-base border border-secondary/20 rounded">
              {contracts.map((url, index) => (
                <div
                  key={index}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-tertiary/10 text-tertiary text-xs font-medium rounded-full"
                >
                  <span className="truncate max-w-[240px]">{url}</span>
                  <button
                    type="button"
                    onClick={() => removeContract(index)}
                    className="hover:text-error font-bold text-sm leading-none focus:outline-none transition-colors"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Khung hiển thị lỗi từ hệ thống */}
        {error && (
          <div className="p-3.5 bg-coral-light border border-coral/20 text-coral rounded text-xs font-medium">
            {error}
          </div>
        )}

        {/* Nút Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-[48px] bg-primary text-white rounded font-semibold text-sm hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          {isSubmitting ? 'Submitting Technical Context...' : 'Submit Technical Context →'}
        </button>
      </form>
    </div>
  );
}