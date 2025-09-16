import React, { useState } from 'react';
import { Site } from '../types';

interface SiteManagerProps {
  sites: Site[];
  onAddSite: (name: string) => void;
  onSelectSite: (siteId: string) => void;
  onDeleteSite: (siteId: string) => void;
  selectedSiteId: string | null;
  selectedCompanyId: string | null;
}

const SiteManager: React.FC<SiteManagerProps> = ({ sites, onAddSite, onSelectSite, onDeleteSite, selectedSiteId, selectedCompanyId }) => {
  const [newSiteName, setNewSiteName] = useState('');

  const handleAddSite = () => {
    if (newSiteName.trim()) {
      onAddSite(newSiteName.trim());
      setNewSiteName('');
    }
  };

  if (!selectedCompanyId) {
    return <div className="text-medium-text mt-4">Please select a company to see its sites.</div>;
  }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-2 text-dark-text">Sites</h3>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={newSiteName}
          onChange={(e) => setNewSiteName(e.target.value)}
          placeholder="New site name"
          className="bg-light-background border border-medium-background/50 text-dark-text rounded-lg p-2 flex-grow"
        />
        <button
          onClick={handleAddSite}
          className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700"
        >
          Add
        </button>
      </div>
      <ul className="space-y-2">
        {sites.map((site) => (
          <li
            key={site.id}
            onClick={() => onSelectSite(site.id)}
            className={`flex justify-between items-center p-2 rounded-lg cursor-pointer ${
              selectedSiteId === site.id
                ? 'bg-brand-primary text-white'
                : 'bg-light-background/80 hover:bg-medium-background/50 text-dark-text'
            }`}
          >
            <span>{site.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Are you sure you want to delete ${site.name}? This will delete all associated data.`)) {
                  onDeleteSite(site.id);
                }
              }}
              className="text-red-400 hover:text-red-600 font-bold text-lg ml-4"
            >
              &times;
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SiteManager;
