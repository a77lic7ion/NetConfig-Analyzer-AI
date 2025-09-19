import { UploadedFile, ParsedConfigData, VendorName } from '../types';
import { parseCiscoConfigLocal } from './ciscoParser';
import { parseJuniperConfigLocal } from './juniperParser';
import { parseHuaweiConfigLocal } from './huaweiParser';
import { parseH3cConfigLocal } from './h3cParser';
import { parseConfigurationWithAI } from './aiService';

const parseConfigurationLocal = (file: UploadedFile): ParsedConfigData => {
    switch (file.vendor) {
        case VendorName.CISCO:
            return parseCiscoConfigLocal(file.content);
        case VendorName.JUNIPER:
            return parseJuniperConfigLocal(file.content);
        case VendorName.HUAWEI:
            return parseHuaweiConfigLocal(file.content);
        case VendorName.H3C:
            return parseH3cConfigLocal(file.content);
        default:
            throw new Error(`No local parser available for vendor: ${file.vendor}`);
    }
};

/**
 * Orchestrates the parsing of a configuration file.
 * It selects the appropriate parser (local or Gemini) based on a setting.
 * @param file The uploaded file object containing content and vendor info.
 * @param useAiParsing A boolean to determine whether to use AI parsing.
 * @returns A promise that resolves to the parsed configuration data.
 */
export const parseConfiguration = async (file: UploadedFile, useAiParsing: boolean = false): Promise<ParsedConfigData> => {
    let parsedData: ParsedConfigData;

    if (useAiParsing) {
        parsedData = await parseConfigurationWithAI(file.content, file.vendor);
    } else {
        parsedData = await Promise.resolve(parseConfigurationLocal(file));
    }
    
    // Add metadata that is not part of the core parsing logic to the final object
    const finalData: ParsedConfigData = {
        ...parsedData,
        fileName: file.name,
        vendor: file.vendor,
        rawConfig: file.content
    };
    
    return finalData;
};
