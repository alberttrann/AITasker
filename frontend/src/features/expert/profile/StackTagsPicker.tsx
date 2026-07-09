import React, { useState } from 'react';
import { useExpertProfile } from '@/hooks/use-expert-profile';
import { Spinner } from '@/components/ui/Spinner';

interface StackTagsPickerProps {
  initialTags: string[];
  initialModel: string;
  initialBio: string;
  onSave: (tags: string[], model: string, bio: string) => void;
}

const SUGGESTED_TAGS = [
  'Python', 'TypeScript', 'React', 'Next.js', 'Docker', 'Kubernetes', 
  'TensorFlow', 'PyTorch', 'LangChain', 'Kafka', 'PostgreSQL', 'Redis', 'AWS', 'GCP'
];

const MODELS = [
  { value: 'MILESTONE', label: 'Milestone-based', desc: 'Fixed-price per milestone, clear deliverables' },
  { value: 'HOURLY',     label: 'Hourly',         desc: 'Bill by the hour, flexible scope' },
  { value: 'HYBRID',     label: 'Hybrid',         desc: 'Mix of milestone + hourly for discovery phases' },
];

export default function StackTagsPicker({ initialTags, initialModel, initialBio, onSave }: StackTagsPickerProps) {
  const [tags, setTags] = useState<string[]>(initialTags || []);
  const [inputValue, setInputValue] = useState('');
  const [model, setModel] = useState(initialModel || 'MILESTONE');
  const [bio, setBio] = useState(initialBio || '');
  const { saveStackAndModel } = useExpertProfile();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addTag = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
    }
    setInputValue('');
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const USE_MOCK = false;
      if (USE_MOCK) {
        await new Promise(r => setTimeout(r, 800));
      } else {
        await saveStackAndModel.mutateAsync({
          engagementModel: model,
          stackTagsJson: tags,
          archetypeHistoryJson: [],
          bio,
        });
      }
      onSave(tags, model, bio);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to save profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Bio Section */}
      <div>
        <h2 className="text-xl font-bold mb-2">Professional Bio</h2>
        <p className="text-gray-500 text-sm mb-4">Write a short bio describing your expertise and background.</p>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="I am an AI engineer with 5 years of experience..."
          className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none resize-y min-h-[120px]"
        />
      </div>

      <hr className="border-gray-200" />

      {/* Stack Tags Section */}
      <div>
        <h2 className="text-xl font-bold mb-2">Tech Stack & Tools</h2>
        <p className="text-gray-500 text-sm mb-4">Add the technologies you are most proficient in.</p>
        
        <div className="mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Python, LangChain..."
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button
              type="button"
              onClick={addTag}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-medium transition-colors"
            >
              Add
            </button>
          </div>
          
          <div className="flex flex-wrap gap-2 mt-4">
            {tags.map(tag => (
              <span key={tag} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-sm font-medium">
                {tag}
                <button 
                  onClick={() => removeTag(tag)} 
                  className="hover:text-red-500 focus:outline-none ml-1 flex items-center justify-center w-4 h-4 rounded-full hover:bg-blue-100"
                >
                  ×
                </button>
              </span>
            ))}
            {tags.length === 0 && (
              <span className="text-gray-400 text-sm italic py-1.5">No tags added yet.</span>
            )}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Suggested</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_TAGS.filter(t => !tags.includes(t)).slice(0, 10).map(tag => (
              <button 
                key={tag} 
                onClick={() => setTags([...tags, tag])}
                className="px-3 py-1 bg-gray-50 hover:bg-gray-200 border border-gray-200 rounded-full text-xs font-medium text-gray-600 transition-colors"
              >
                + {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      <hr className="border-gray-200" />

      {/* Engagement Model Section */}
      <div>
        <h2 className="text-xl font-bold mb-2">Preferred Engagement Model</h2>
        <p className="text-gray-500 text-sm mb-4">How do you prefer to structure your work and billing?</p>
        
        <div className="space-y-3">
          {MODELS.map(m => (
            <label 
              key={m.value} 
              className={`block p-4 border rounded-xl cursor-pointer transition-colors ${
                model === m.value ? 'border-blue-500 bg-blue-50/50 shadow-sm' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <input 
                  type="radio" 
                  name="model" 
                  value={m.value} 
                  checked={model === m.value}
                  onChange={() => setModel(m.value)} 
                  className="w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500" 
                />
                <span className="font-bold text-gray-900 ml-3">{m.label}</span>
              </div>
              <p className="text-sm text-gray-500 ml-8 mt-1">{m.desc}</p>
            </label>
          ))}
        </div>
      </div>

      <div className="pt-4 flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSubmitting}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Spinner size="sm" className="text-white" />
              Saving...
            </>
          ) : (
            'Save & Continue'
          )}
        </button>
      </div>
    </div>
  );
}
