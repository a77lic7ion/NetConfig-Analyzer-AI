import React, { useState, useEffect } from 'react';

interface SettingsProps {
    onClose: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onClose }) => {
    const [provider, setProvider] = useState('Gemini');
    const [apiKey, setApiKey] = useState('');
    const [useAiParsing, setUseAiParsing] = useState(false);

    useEffect(() => {
        const storedProvider = localStorage.getItem('aiProvider');
        const storedApiKey = localStorage.getItem('apiKey');
        const storedUseAiParsing = localStorage.getItem('useAiParsing');

        if (storedProvider) setProvider(storedProvider);
        if (storedApiKey) setApiKey(storedApiKey);
        if (storedUseAiParsing) setUseAiParsing(storedUseAiParsing === 'true');
    }, []);

    const handleSave = () => {
        localStorage.setItem('aiProvider', provider);
        localStorage.setItem('apiKey', apiKey);
        localStorage.setItem('useAiParsing', String(useAiParsing));
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg p-8 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-white mb-4">Settings</h2>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="ai-provider" className="block text-sm font-medium text-gray-300">AI Provider</label>
                        <select id="ai-provider" value={provider} onChange={(e) => setProvider(e.target.value)} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5 mt-1 focus:ring-brand-primary focus:border-brand-primary">
                            <option>Gemini</option>
                            <option>OpenAI</option>
                            <option>Ollama</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="api-key" className="block text-sm font-medium text-gray-300">API Key</label>
                        <input type="password" id="api-key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5 mt-1 focus:ring-brand-primary focus:border-brand-primary" />
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-300">Use AI Parsing</span>
                        <label htmlFor="ai-parsing-toggle" className="inline-flex relative items-center cursor-pointer">
                            <input type="checkbox" id="ai-parsing-toggle" checked={useAiParsing} onChange={() => setUseAiParsing(!useAiParsing)} className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-focus:ring-4 peer-focus:ring-brand-primary peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary"></div>
                        </label>
                    </div>
                </div>
                <div className="mt-6 flex justify-end space-x-4">
                    <button onClick={onClose} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-500 transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleSave} className="bg-brand-primary text-white font-bold py-2 px-4 rounded-lg hover:bg-brand-secondary transition-colors">
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Settings;
