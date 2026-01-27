import { ParsedConfigData, AnalysisFinding, VendorName, LlmSettings } from '../types';
import { analyzeCiscoConfig } from './ciscoAnalysis';
import { analyzeHuaweiConfig } from './huaweiAnalysis';
import { analyzeJuniperConfig } from './juniperAnalysis';
import { analyzeH3cConfig } from './h3cAnalysis';
import { analyzeConfiguration as analyzeWithLlm } from './llmService';

/**
 * Runs a local, rule-based analysis on the configuration.
 * @param config The parsed configuration data object.
 * @returns An array of analysis findings.
 */
const runLocalAnalysis = (config: ParsedConfigData): AnalysisFinding[] => {
    switch (config.vendor) {
        case VendorName.CISCO:
            return analyzeCiscoConfig(config);
        case VendorName.HUAWEI:
            return analyzeHuaweiConfig(config);
        case VendorName.JUNIPER:
            return analyzeJuniperConfig(config);
        case VendorName.H3C:
            return analyzeH3cConfig(config);
        default:
            return [{
                id: 'no-analyzer',
                type: 'Suggestion',
                severity: 'Info',
                description: `Local analysis is not yet implemented for ${config.vendor}.`,
                devicesInvolved: [config.fileName || 'unknown'],
                details: {},
                recommendation: 'Use the AI-powered CLI helper or enable AI Analysis in Settings for insights on this configuration.',
                remediationCommands: []
            }];
    }
};

/**
 * Orchestrates the analysis of a parsed configuration file.
 * It selects either the LLM-based engine or the local rule-based engine based on user settings.
 * @param config The parsed configuration data object.
 * @param settings The current LLM settings.
 * @returns A promise that resolves to an array of analysis findings.
 */
export const runAnalysis = async (config: ParsedConfigData, settings: LlmSettings): Promise<AnalysisFinding[]> => {
    if (settings.useLlmForAnalysis) {
        return analyzeWithLlm(config, settings);
    }
    // Using a resolved promise for local analysis to maintain a consistent async interface
    return Promise.resolve(runLocalAnalysis(config));
};
