import React, { ChangeEvent, useState } from 'react';
import { VendorName, CliCommandResponse } from '../types';
import { SUPPORTED_VENDORS_DATA } from '../constants';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';

interface CliHelperProps {
  query: string;
  onQueryChange: (query: string) => void;
  vendor: VendorName;
  onVendorChange: (vendor: VendorName) => void;
  onSubmit: () => void;
  isLoading: boolean;
  error: string | null;
  result: CliCommandResponse | null;
}

const CliHelper: React.FC<CliHelperProps> = ({
  query,
  onQueryChange,
  vendor,
  onVendorChange,
  onSubmit,
  isLoading,
  error,
  result,
}) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    if (result?.command) {
      navigator.clipboard.writeText(result.command).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000); // Revert after 2 seconds
      });
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-light-text">Describe a task, and the AI will provide the corresponding CLI command for the selected vendor.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
            <label htmlFor="cli-query" className="block text-sm font-medium text-light-text mb-1">Task description:</label>
            <input
                id="cli-query"
                type="text"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="e.g., show the running configuration"
                className="w-full bg-light-background border border-medium-background/50 text-dark-text rounded-lg p-2.5 focus:ring-brand-primary focus:border-brand-primary"
            />
        </div>
        <div>
            <label htmlFor="cli-vendor-select" className="block text-sm font-medium text-light-text mb-1">Target Vendor:</label>
            <select
                id="cli-vendor-select"
                value={vendor}
                onChange={(e) => onVendorChange(e.target.value as VendorName)}
                className="w-full bg-light-background border border-medium-background/50 text-dark-text rounded-lg p-2.5 focus:ring-brand-primary focus:border-brand-primary"
            >
                {SUPPORTED_VENDORS_DATA.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
            </select>
        </div>
      </div>
      <button
        onClick={onSubmit}
        disabled={isLoading || !query}
        className="w-full md:w-auto bg-sky-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-sky-700 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Getting Command...' : 'Get Command'}
      </button>

      {isLoading && <LoadingSpinner text="Querying AI..." />}
      <ErrorMessage message={error || ''} />
      
      {result && (
        <div className="mt-4 p-4 bg-light-background/50 rounded-lg border border-medium-background/50">
            <h4 className="font-semibold text-dark-text mb-2">Result:</h4>
            <div className="relative">
                <pre className="p-3 bg-dark-background rounded text-lg text-green-300 font-mono whitespace-pre-wrap break-words pr-12">
                    <code>{result.command}</code>
                </pre>
                <button
                    onClick={handleCopy}
                    className="absolute top-2 right-2 p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                    aria-label="Copy command"
                >
                    {isCopied ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                    )}
                </button>
            </div>
            <p className="mt-2 text-sm text-medium-text">{result.explanation}</p>
        </div>
      )}
    </div>
  );
};

export default CliHelper;