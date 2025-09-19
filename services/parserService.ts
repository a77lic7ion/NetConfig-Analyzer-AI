import { UploadedFile, ParsedConfigData, VendorName } from '../types';
import { parseCiscoConfigLocal } from './ciscoParser';
import { parseHuaweiConfigLocal } from './huaweiParser';
import { parseJuniperConfigLocal } from './juniperParser';
import { parseH3cConfigLocal } from './h3cParser';

/**
 * Orchestrates the parsing of a configuration file.
 * It selects the appropriate local parser based on the vendor.
 * @param file The uploaded file object containing content and vendor info.
 * @returns A promise that resolves to the parsed configuration data.
 */
export const parseConfiguration = async (file: UploadedFile): Promise<ParsedConfigData> => {
    let parsedData: ParsedConfigData;

    // Use a dedicated local parser for each vendor for speed and consistency.
    switch (file.vendor) {
        case VendorName.CISCO:
            parsedData = parseCiscoConfigLocal(file.content);
            break;
        case VendorName.HUAWEI:
            parsedData = parseHuaweiConfigLocal(file.content);
            break;
        case VendorName.JUNIPER:
            parsedData = parseJuniperConfigLocal(file.content);
            break;
        case VendorName.H3C:
            parsedData = parseH3cConfigLocal(file.content);
            break;
        default:
            // This case should ideally not be reached if UI only allows supported vendors.
            throw new Error(`No local parser available for vendor: ${file.vendor}`);
    }
    
    // Wrap in a resolved promise to maintain a consistent async interface.
    await Promise.resolve();

    // Add metadata that is not part of the core parsing logic to the final object
    const finalData: ParsedConfigData = {
        ...parsedData,
        fileName: file.name,
        vendor: file.vendor,
        rawConfig: file.content
    };
    
    return finalData;
};
