import React, { useState, useEffect, useCallback } from 'react';
import { LlmSettings, LlmProvider } from '../types';
import { testConnection, fetchModels } from '../services/llmService';

interface SettingsModalProps {
  currentSettings: LlmSettings;
  onSave: (settings: LlmSettings) => void;
  onClose: () => void;
}

interface ModelSelectorProps {
    providerKey: keyof Omit<LlmSettings, 'provider' | 'useLlmForAnalysis'>;
    currentModel: string;
    availableModels: string[];
    isFetchingModels: boolean;
    onRefresh: () => void;
    onModelChange: (model: string) => void;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
    currentModel,
    availableModels,
    isFetchingModels,
    onRefresh,
    onModelChange
}) => {
    const [showCustom, setShowCustom] = useState(!availableModels.includes(currentModel) && availableModels.length > 0);

    useEffect(() => {
        setShowCustom(!availableModels.includes(currentModel) && availableModels.length > 0);
    }, [availableModels, currentModel]);

    return (
        <div>
          <label className="block text-sm font-medium text-light-text mb-1 flex justify-between">
              <span>Model</span>
              <button
                  onClick={onRefresh}
                  className="text-xs text-brand-primary hover:underline flex items-center gap-1"
                  disabled={isFetchingModels}
              >
                  {isFetchingModels ? '...' : 'Refresh'}
              </button>
          </label>
          <div className="flex flex-col gap-2">
              <select
                  value={showCustom ? 'custom' : currentModel}
                  onChange={e => {
                      if (e.target.value === 'custom') {
                          setShowCustom(true);
                      } else {
                          setShowCustom(false);
                          onModelChange(e.target.value);
                      }
                  }}
                  className="w-full bg-light-background border border-medium-background/50 text-dark-text rounded-lg p-2.5"
              >
                  {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
                  <option value="custom">-- Custom / Other --</option>
              </select>
              {(showCustom || availableModels.length === 0) && (
                  <input
                      type="text"
                      value={currentModel}
                      onChange={e => onModelChange(e.target.value)}
                      className="w-full bg-light-background border border-medium-background/50 text-dark-text rounded-lg p-2.5"
                      placeholder="Enter model ID..."
                  />
              )}
          </div>
        </div>
    );
};

const SettingsModal: React.FC<SettingsModalProps> = ({ currentSettings, onSave, onClose }) => {
  const [settings, setSettings] = useState<LlmSettings>(currentSettings);
  const [testStatus, setTestStatus] = useState<{ loading: boolean; success?: boolean; error?: string }>({ loading: false });
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleRefreshModels = useCallback(async () => {
    setIsFetchingModels(true);
    try {
        const models = await fetchModels(settings);
        setAvailableModels(models);
    } catch (e) {
        console.error("Failed to fetch models:", e);
    } finally {
        setIsFetchingModels(false);
    }
  }, [settings]);

  useEffect(() => {
      handleRefreshModels();
      setTestStatus({ loading: false });
  }, [settings.provider]);

  const handleTestConnection = async () => {
    setTestStatus({ loading: true });
    try {
      const success = await testConnection(settings);
      setTestStatus({ loading: false, success });
    } catch (e) {
      setTestStatus({ loading: false, success: false, error: (e as Error).message });
    }
  };

  const handleSave = () => {
    onSave(settings);
  };

  const getProviderKey = (provider: LlmProvider): keyof Omit<LlmSettings, 'provider' | 'useLlmForAnalysis'> => {
    switch (provider) {
        case LlmProvider.OPENAI: return 'openAi';
        case LlmProvider.CLAUDE: return 'anthropic';
        case LlmProvider.XAI: return 'xAi';
        case LlmProvider.OPENROUTER: return 'openRouter';
        default: return provider as any;
    }
  };

  const updateNestedSetting = (providerKey: keyof Omit<LlmSettings, 'provider' | 'useLlmForAnalysis'>, field: string, value: string) => {
      setSettings(prev => ({
          ...prev,
          [providerKey]: {
              ...(prev[providerKey] as any),
              [field]: value
          }
      }));
  };


  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="bg-medium-background w-full max-w-2xl rounded-xl shadow-2xl border border-light-background/50 p-6 m-4 max-h-[90vh] overflow-y-auto"
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
              <option value={LlmProvider.CLAUDE}>Anthropic Claude</option>
              <option value={LlmProvider.DEEPSEEK}>Deepseek</option>
              <option value={LlmProvider.OLLAMA}>Ollama (Local)</option>
              <option value={LlmProvider.XAI}>x.ai (Grok)</option>
              <option value={LlmProvider.CLOUDFLARE}>Cloudflare Workers AI</option>
              <option value={LlmProvider.MISTRAL}>Mistral AI</option>
              <option value={LlmProvider.HUGGINGFACE}>Hugging Face</option>
              <option value={LlmProvider.OPENROUTER}>OpenRouter</option>
            </select>
          </div>

          <div className="p-4 border border-medium-background/50 rounded-lg space-y-4">
              <h3 className="font-semibold text-dark-text capitalize">{settings.provider.replace('-', ' ')} Configuration</h3>

              {settings.provider === LlmProvider.CLOUDFLARE ? (
                  <>
                    <div>
                        <label htmlFor="cloudflare-account-id" className="block text-sm font-medium text-light-text mb-1">Account ID</label>
                        <input
                            id="cloudflare-account-id"
                            type="text"
                            value={settings.cloudflare.accountId}
                            onChange={e => updateNestedSetting('cloudflare', 'accountId', e.target.value)}
                            className="w-full bg-light-background border border-medium-background/50 text-dark-text rounded-lg p-2.5"
                        />
                    </div>
                    <div>
                        <label htmlFor="cloudflare-api-token" className="block text-sm font-medium text-light-text mb-1">API Token</label>
                        <input
                            id="cloudflare-api-token"
                            type="password"
                            value={settings.cloudflare.apiToken}
                            onChange={e => updateNestedSetting('cloudflare', 'apiToken', e.target.value)}
                            className="w-full bg-light-background border border-medium-background/50 text-dark-text rounded-lg p-2.5"
                        />
                    </div>
                    <ModelSelector
                        providerKey="cloudflare"
                        currentModel={settings.cloudflare.model}
                        availableModels={availableModels}
                        isFetchingModels={isFetchingModels}
                        onRefresh={handleRefreshModels}
                        onModelChange={m => updateNestedSetting('cloudflare', 'model', m)}
                    />
                  </>
              ) : settings.provider === LlmProvider.OLLAMA ? (
                  <>
                    <div>
                        <label htmlFor="ollama-base-url" className="block text-sm font-medium text-light-text mb-1">Base URL</label>
                        <input
                            id="ollama-base-url"
                            type="text"
                            value={settings.ollama.baseUrl}
                            onChange={e => updateNestedSetting('ollama', 'baseUrl', e.target.value)}
                            className="w-full bg-light-background border border-medium-background/50 text-dark-text rounded-lg p-2.5"
                        />
                    </div>
                    <ModelSelector
                        providerKey="ollama"
                        currentModel={settings.ollama.model}
                        availableModels={availableModels}
                        isFetchingModels={isFetchingModels}
                        onRefresh={handleRefreshModels}
                        onModelChange={m => updateNestedSetting('ollama', 'model', m)}
                    />
                  </>
              ) : (
                  <>
                    <div>
                        <label htmlFor="llm-api-key" className="block text-sm font-medium text-light-text mb-1">API Key</label>
                        <input
                            id="llm-api-key"
                            type="password"
                            value={(settings[getProviderKey(settings.provider)] as any).apiKey}
                            onChange={e => updateNestedSetting(getProviderKey(settings.provider), 'apiKey', e.target.value)}
                            className="w-full bg-light-background border border-medium-background/50 text-dark-text rounded-lg p-2.5"
                            placeholder="Enter your API key"
                        />
                    </div>
                    <ModelSelector
                        providerKey={getProviderKey(settings.provider)}
                        currentModel={(settings[getProviderKey(settings.provider)] as any).model}
                        availableModels={availableModels}
                        isFetchingModels={isFetchingModels}
                        onRefresh={handleRefreshModels}
                        onModelChange={m => updateNestedSetting(getProviderKey(settings.provider), 'model', m)}
                    />
                  </>
              )}

              <div className="flex items-center gap-4 pt-2">
                  <button
                    onClick={handleTestConnection}
                    disabled={testStatus.loading}
                    className="py-1.5 px-4 rounded bg-light-background hover:bg-light-background/70 text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {testStatus.loading ? 'Testing...' : 'Test Connection'}
                  </button>
                  {testStatus.success === true && <span className="text-green-500 text-sm font-medium">✓ Connection Successful</span>}
                  {testStatus.success === false && <span className="text-red-500 text-sm font-medium">✗ Failed: {testStatus.error}</span>}
              </div>
          </div>

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
