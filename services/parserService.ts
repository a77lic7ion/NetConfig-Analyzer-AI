import { UploadedFile, ParsedConfigData, VendorName } from '../types';
import { parseCiscoConfigLocal } from './ciscoParser';
import { parseConfigurationWithGemini } from './geminiService';

/**
 * Orchestrates the parsing of a configuration file.
 * It selects the appropriate parser (local or Gemini) based on the vendor.
 * @param file The uploaded file object containing content and vendor info.
 * @returns A promise that resolves to the parsed configuration data.
 */
export const parseConfiguration = async (file: UploadedFile): Promise<ParsedConfigData> => {
    let parsedData: ParsedConfigData;

    if (file.vendor === VendorName.CISCO) {
        // Local parser is synchronous, wrap in promise to have a consistent async interface
        parsedData = await Promise.resolve(parseCiscoConfigLocal(file.content));
    } else {
        // Use Gemini for other vendors
        // The Gemini response is expected to be in the legacy format.
        parsedData = await parseConfigurationWithGemini(file.content, file.vendor);
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
