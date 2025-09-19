import { ParsedConfigData, AnalysisFinding, VendorName } from '../types';
import { analyzeCiscoConfig } from './ciscoAnalysis';
import { analyzeHuaweiConfig } from './huaweiAnalysis';
import { analyzeJuniperConfig } from './juniperAnalysis';
import { analyzeH3cConfig } from './h3cAnalysis';

/**
 * Orchestrates the local analysis of a parsed configuration file.
 * It selects the appropriate vendor-specific analysis engine.
 * This function is deterministic and works offline.
 * @param config The parsed configuration data object.
 * @returns A promise that resolves to an array of analysis findings.
 */
export const runLocalAnalysis = async (config: ParsedConfigData): Promise<AnalysisFinding[]> => {
    let findings: AnalysisFinding[] = [];

    // Dispatch to the correct vendor-specific analysis engine
    switch (config.vendor) {
        case VendorName.CISCO:
            findings = analyzeCiscoConfig(config);
            break;
        case VendorName.HUAWEI:
            findings = analyzeHuaweiConfig(config);
            break;
        case VendorName.JUNIPER:
            findings = analyzeJuniperConfig(config);
            break;
        case VendorName.H3C:
            findings = analyzeH3cConfig(config);
            break;
        default:
            // Return a default finding if no specific analyzer is available
            return [{
                id: 'no-analyzer',
                type: 'Suggestion',
                severity: 'Info',
                description: `Local analysis is not yet implemented for ${config.vendor}.`,
                devicesInvolved: [config.fileName || 'unknown'],
                details: {},
                recommendation: 'Use the AI-powered CLI helper for specific queries about this configuration.',
                remediationCommands: []
            }];
    }
    
    // Using a resolved promise to maintain a consistent async interface with the rest of the app
    return Promise.resolve(findings);
};
