import React, { useState } from 'react';
import { Company } from '../types';

interface CompanyManagerProps {
  companies: Company[];
  onAddCompany: (name: string) => void;
  onSelectCompany: (companyId: string) => void;
  onDeleteCompany: (companyId: string) => void;
  selectedCompanyId: string | null;
  onExport: () => void;
}

const CompanyManager: React.FC<CompanyManagerProps> = ({ companies, onAddCompany, onSelectCompany, onDeleteCompany, selectedCompanyId, onExport }) => {
  const [newCompanyName, setNewCompanyName] = useState('');

  const handleAddCompany = () => {
    if (newCompanyName.trim()) {
      onAddCompany(newCompanyName.trim());
      setNewCompanyName('');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold text-dark-text">Companies</h3>
        <button
            onClick={onExport}
            disabled={!selectedCompanyId}
            className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-500"
        >
            Export Company
        </button>
      </div>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={newCompanyName}
          onChange={(e) => setNewCompanyName(e.target.value)}
          placeholder="New company name"
          className="bg-light-background border border-medium-background/50 text-dark-text rounded-lg p-2 flex-grow"
        />
        <button
          onClick={handleAddCompany}
          className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700"
        >
          Add
        </button>
      </div>
      <ul className="space-y-2">
        {companies.map((company) => (
          <li
            key={company.id}
            onClick={() => onSelectCompany(company.id)}
            className={`flex justify-between items-center p-2 rounded-lg cursor-pointer ${
              selectedCompanyId === company.id
                ? 'bg-brand-primary text-white'
                : 'bg-light-background/80 hover:bg-medium-background/50 text-dark-text'
            }`}
          >
            <span>{company.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Are you sure you want to delete ${company.name}? This will delete all associated sites and data.`)) {
                  onDeleteCompany(company.id);
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

export default CompanyManager;
