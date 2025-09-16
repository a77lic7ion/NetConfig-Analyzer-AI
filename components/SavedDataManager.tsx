import React, { useState } from 'react';
import { SavedParsedConfig, SavedCliScript, ParsedConfigData } from '../types';

interface SavedDataManagerProps {
  savedConfigs: SavedParsedConfig[];
  savedScripts: SavedCliScript[];
  onLoadConfig: (config: ParsedConfigData) => void;
  onDeleteConfig: (id: string) => void;
  onDeleteScript: (id: string) => void;
  selectedSiteId: string | null;
}

const SavedDataManager: React.FC<SavedDataManagerProps> = ({ savedConfigs, savedScripts, onLoadConfig, onDeleteConfig, onDeleteScript, selectedSiteId }) => {
  const [activeTab, setActiveTab] = useState<'configs' | 'scripts'>('configs');

  if (!selectedSiteId) {
    return null; // Don't render anything if no site is selected
  }

  return (
    <div className="mt-6">
      <div className="flex border-b border-medium-background/50">
        <button
          onClick={() => setActiveTab('configs')}
          className={`py-2 px-4 text-sm font-medium ${activeTab === 'configs' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-light-text hover:bg-medium-background/20'}`}
        >
          Saved Configs ({savedConfigs.length})
        </button>
        <button
          onClick={() => setActiveTab('scripts')}
          className={`py-2 px-4 text-sm font-medium ${activeTab === 'scripts' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-light-text hover:bg-medium-background/20'}`}
        >
          Saved Scripts ({savedScripts.length})
        </button>
      </div>

      <div className="mt-4">
        {activeTab === 'configs' && (
          <ul className="space-y-2">
            {savedConfigs.map(config => (
              <li key={config.id} className="flex justify-between items-center bg-light-background/60 p-2 rounded-md">
                <div>
                  <p className="font-semibold text-dark-text">{config.hostname || 'Unnamed Config'}</p>
                  <p className="text-xs text-medium-text">Saved on: {new Date(config.savedAt).toLocaleString()}</p>
                </div>
                <div>
                  <button onClick={() => onLoadConfig(config)} className="text-sm bg-blue-600 text-white font-bold py-1 px-3 rounded-lg hover:bg-blue-700 mr-2">Load</button>
                  <button onClick={() => onDeleteConfig(config.id)} className="text-sm bg-red-600 text-white font-bold py-1 px-3 rounded-lg hover:bg-red-700">Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {activeTab === 'scripts' && (
          <ul className="space-y-2">
            {savedScripts.map(script => (
              <li key={script.id} className="flex justify-between items-center bg-light-background/60 p-2 rounded-md">
                 <div>
                  <p className="font-semibold text-dark-text truncate" title={script.query}>Query: "{script.query}"</p>
                  <p className="text-xs text-medium-text">Saved on: {new Date(script.savedAt).toLocaleString()}</p>
                </div>
                <div>
                  <button onClick={() => onDeleteScript(script.id)} className="text-sm bg-red-600 text-white font-bold py-1 px-3 rounded-lg hover:bg-red-700">Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default SavedDataManager;
