import React, { useState, useEffect } from 'react';
import { LlmSettings, LlmProvider } from '../types';

interface SettingsModalProps {
  currentSettings: LlmSettings;
  onSave: (settings: LlmSettings) => void;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ currentSettings, onSave, onClose }) => {
  const [settings, setSettings] = useState<LlmSettings>(currentSettings);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleSave = () => {
    onSave(settings);
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="bg-medium-background w-full max-w-2xl rounded-xl shadow-2xl border border-light-background/50 p-6 m-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-brand-primary">LLM API Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
        </div>

        <div className="space-y-6">
          {/* Provider Selection */}
          <div>
            <label htmlFor="llm-provider" className="block text-sm font-medium text-light-text mb-1">LLM Provider</label>
            <select
              id="llm-provider"
              value={settings.provider}
              onChange={e => setSettings({ ...settings, provider: e.target.value as LlmProvider })}
              className="w-full bg-light-background border border-medium-background/50 text-dark-text rounded-lg p-2.5 focus:ring-brand-primary focus:border-brand-primary"
            >
              <option value={LlmProvider.GEMINI}>Google Gemini</option>
              <option value={LlmProvider.OPENAI}>OpenAI</option>
              <option value={LlmProvider.OLLAMA}>Ollama (Local)</option>
            </select>
          </div>

          {/* Conditional Settings */}
          {settings.provider === LlmProvider.GEMINI && (
            <div className="p-3 bg-light-background/50 rounded-md text-sm text-medium-text">
              Google Gemini uses the `API_KEY` environment variable provided by the platform. No additional configuration is needed.
            </div>
          )}

          {settings.provider === LlmProvider.OPENAI && (
            <div className="space-y-4 p-4 border border-medium-background/50 rounded-lg">
                <h3 className="font-semibold text-dark-text">OpenAI Configuration</h3>
                <div>
                    <label htmlFor="openai-api-key" className="block text-sm font-medium text-light-text mb-1">API Key</label>
                    <input
                        id="openai-api-key"
                        type="password"
                        value={settings.openAi.apiKey}
                        onChange={e => setSettings({ ...settings, openAi: { ...settings.openAi, apiKey: e.target.value } })}
                        className="w-full bg-light-background border border-medium-background/50 text-dark-text rounded-lg p-2.5"
                        placeholder="sk-..."
                    />
                </div>
                <div>
                    <label htmlFor="openai-model" className="block text-sm font-medium text-light-text mb-1">Model Name</label>
                    <input
                        id="openai-model"
                        type="text"
                        value={settings.openAi.model}
                        onChange={e => setSettings({ ...settings, openAi: { ...settings.openAi, model: e.target.value } })}
                        className="w-full bg-light-background border border-medium-background/50 text-dark-text rounded-lg p-2.5"
                        placeholder="e.g., gpt-4-turbo"
                    />
                </div>
            </div>
          )}

          {settings.provider === LlmProvider.OLLAMA && (
            <div className="space-y-4 p-4 border border-medium-background/50 rounded-lg">
                <h3 className="font-semibold text-dark-text">Ollama Configuration</h3>
                 <div>
                    <label htmlFor="ollama-base-url" className="block text-sm font-medium text-light-text mb-1">Base URL</label>
                    <input
                        id="ollama-base-url"
                        type="text"
                        value={settings.ollama.baseUrl}
                        onChange={e => setSettings({ ...settings, ollama: { ...settings.ollama, baseUrl: e.target.value } })}
                        className="w-full bg-light-background border border-medium-background/50 text-dark-text rounded-lg p-2.5"
                    />
                </div>
                <div>
                    <label htmlFor="ollama-model" className="block text-sm font-medium text-light-text mb-1">Model Name</label>
                    <input
                        id="ollama-model"
                        type="text"
                        value={settings.ollama.model}
                        onChange={e => setSettings({ ...settings, ollama: { ...settings.ollama, model: e.target.value } })}
                        className="w-full bg-light-background border border-medium-background/50 text-dark-text rounded-lg p-2.5"
                        placeholder="e.g., llama3"
                    />
                </div>
            </div>
          )}

           {/* Analysis Toggle */}
          <div className="pt-4 border-t border-medium-background/50">
            <label className="flex items-center gap-3 text-sm font-medium text-light-text cursor-pointer">
              <input
                type="checkbox"
                checked={settings.useLlmForAnalysis}
                onChange={e => setSettings({ ...settings, useLlmForAnalysis: e.target.checked })}
                className="h-5 w-5 rounded bg-light-background border-medium-background/50 text-brand-primary focus:ring-brand-primary"
              />
              <span>Use LLM for Configuration Analysis (instead of local rules)</span>
            </label>
             <p className="text-xs text-light-text mt-1 pl-8">When enabled, the "Run Analysis" button will send the config to the selected LLM for a comprehensive audit. When disabled, it uses fast, built-in local checks.</p>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-4">
          <button 
            onClick={onClose}
            className="py-2 px-4 rounded-lg bg-light-background hover:bg-light-background/70 text-dark-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="py-2 px-6 rounded-lg bg-brand-primary hover:bg-brand-secondary text-white font-bold transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
