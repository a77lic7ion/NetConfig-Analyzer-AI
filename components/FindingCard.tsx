

import React, { useState } from 'react';
import { AnalysisFinding } from '../types';

interface FindingCardProps {
  finding: AnalysisFinding;
}

const FindingCard: React.FC<FindingCardProps> = ({ finding }) => {
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  const handleCopy = (command: string) => {
    navigator.clipboard.writeText(command).then(() => {
      setCopiedCommand(command);
      setTimeout(() => setCopiedCommand(null), 2000); // Reset after 2 seconds
    });
  };

  const getSeverityStyles = (severity: string): { border: string; bg: string; text: string; titleText: string } => {
    switch (severity?.toLowerCase()) {
      case 'critical': return { border: 'border-red-600', bg: 'bg-red-900/40', text: 'text-red-300', titleText: 'text-red-400' };
      case 'high': return { border: 'border-red-500', bg: 'bg-red-900/30', text: 'text-red-300', titleText: 'text-red-400' };
      case 'medium': return { border: 'border-orange-500', bg: 'bg-orange-900/30', text: 'text-orange-300', titleText: 'text-orange-400' };
      case 'low': return { border: 'border-yellow-500', bg: 'bg-yellow-900/20', text: 'text-yellow-300', titleText: 'text-yellow-400' };
      default: return { border: 'border-sky-500', bg: 'bg-sky-900/20', text: 'text-sky-300', titleText: 'text-sky-400' };
    }
  };

  const getTypeBadgeStyles = (type: string): string => {
      switch (type?.toLowerCase()) {
        case 'conflict': return 'bg-red-500/80 text-white';
        case 'security risk': return 'bg-orange-500/80 text-white';
        case 'suggestion': return 'bg-sky-500/80 text-white';
        case 'best practice': return 'bg-green-500/80 text-white';
        default: return 'bg-gray-500/80 text-white';
      }
  }

  const styles = getSeverityStyles(finding.severity);

  return (
    <div className={`p-4 rounded-lg shadow-lg mb-4 border-l-4 ${styles.border} ${styles.bg}`}>
      <div className="flex justify-between items-start mb-2">
        <h3 className={`text-lg font-semibold ${styles.titleText}`}>
          {finding.description}
        </h3>
        <span className={`text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap ${getTypeBadgeStyles(finding.type)}`}>
            {finding.type}
        </span>
      </div>
      
      <div className="mb-3 text-sm flex flex-wrap gap-x-4 gap-y-1">
        <p className={`${styles.text}`}>
          <span className="font-medium text-dark-text">Severity:</span> {finding.severity}
        </p>
        <p className={`${styles.text}`}>
          <span className="font-medium text-dark-text">Devices:</span> {finding.devicesInvolved.join(', ')}
        </p>
      </div>

      {finding.details && (
        <div className={`text-sm ${styles.text} mb-3`}>
          <p className="font-medium text-dark-text mb-1">Details:</p>
          <pre className="p-2 bg-dark-background/70 rounded text-xs overflow-auto max-h-40 text-light-text border border-light-background">
            {typeof finding.details === 'string' 
              ? finding.details 
              : JSON.stringify(finding.details, null, 2)}
          </pre>
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-white/10">
         <p className="font-medium text-dark-text mb-1 text-sm text-green-400">Recommendation:</p>
         <p className="text-sm text-green-200">{finding.recommendation}</p>
      </div>

      {finding.remediationCommands && finding.remediationCommands.length > 0 && (
        <div className="mt-4 pt-3 border-t border-white/10">
            <h4 className="font-medium text-dark-text mb-2 text-sm text-cyan-400">Suggested Remediation Commands:</h4>
            <div className="p-3 bg-dark-background rounded text-sm font-mono text-gray-300 border border-light-background space-y-1">
                {finding.remediationCommands.map((cmd, index) => (
                    <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between group py-1">
                        <div className="flex items-center flex-grow">
                            <span className="text-gray-500 mr-2 select-none">$</span>
                            <code className="text-cyan-300 flex-grow pr-4">{cmd.command}</code>
                        </div>
                        <div className="flex items-center flex-shrink-0 pl-4 sm:pl-0 mt-1 sm:mt-0">
                            <span className="text-xs text-gray-400 italic mr-3">{cmd.context}</span>
                            <button 
                                onClick={() => handleCopy(cmd.command)}
                                className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                                aria-label={`Copy command: ${cmd.command}`}
                            >
                                {copiedCommand === cmd.command ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}
    </div>
  );
};

export default FindingCard;