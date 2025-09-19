import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import OpenAI from 'openai';
import ollama from 'ollama';
import { ParsedConfigData, AnalysisFinding, VendorName, CliCommandResponse, CliScriptResponse } from '../types';
import { GEMINI_TEXT_MODEL } from '../constants';

let ai: GoogleGenAI | OpenAI | null = null;
let currentProvider: string | null = null;

const initializeAiProvider = () => {
    const provider = localStorage.getItem('aiProvider') || 'Gemini';
    const apiKey = localStorage.getItem('apiKey');

    if (provider === currentProvider && ai) {
        return;
    }

    currentProvider = provider;

    if (provider === 'Gemini') {
        if (!apiKey) {
            console.warn("API_KEY for Gemini is not set. Gemini API calls will fail.");
            ai = null;
            return;
        }
        ai = new GoogleGenAI(apiKey);
    } else if (provider === 'OpenAI') {
        if (!apiKey) {
            console.warn("API_KEY for OpenAI is not set. OpenAI API calls will fail.");
            ai = null;
            return;
        }
        ai = new OpenAI({ apiKey: apiKey, dangerouslyAllowBrowser: true });
    } else if (provider === 'Ollama') {
        // Ollama doesn't require an API key, but a running server.
        // The ollama package will automatically connect to the default http://localhost:11434
        ai = ollama;
    } else {
        ai = null;
    }
};

const sanitizeAndParseJson = (jsonString: string): any => {
  let cleanJsonString = jsonString.trim();
  const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
  const match = cleanJsonString.match(fenceRegex);
  if (match && match[2]) {
    cleanJsonString = match[2].trim();
  }
  try {
    return JSON.parse(cleanJsonString);
  } catch (e) {
    console.error("Failed to parse JSON response:", e, "Raw string:", jsonString);
    throw new Error(`Failed to parse AI response as JSON. Content: ${jsonString.substring(0,1000)}`);
  }
};

export const parseConfigurationWithGemini = async (
  configText: string,
  vendor: VendorName
): Promise<ParsedConfigData> => {
  initializeAiProvider();
  if (!ai || !(ai instanceof GoogleGenAI)) throw new Error("Gemini AI provider is not initialized.");

  const prompt = `
You are an expert network configuration parsing assistant.
Parse the following ${vendor} configuration text.
Extract structured data for the following categories:
- Device Information: Hostname (hostname), OS version (os_version), model, serial number (serial_number), uptime.
- Interfaces: Name (name), IP addresses (ip_address), subnet masks (subnet_mask), descriptions (description), status, speed/duplex, port-channels.
- VLANs & SVIs: VLAN IDs (vlan_id), names (name), SVI IP addresses (svi_ip_address), helper addresses, network ranges, free IPs.
- Routing Protocols: Protocol type, configurations, static routes, default gateways.
- Security Features: AAA, SSH, SNMP, password encryption, ACLs, firewall rules.
- Other Services: NTP, DNS, VTP, CDP/LLDP.

Respond ONLY with a JSON object. The root object should contain keys: "deviceInfo", "interfaces" (array), "vlansSvis" (array), "routingProtocols" (array), "securityFeatures" (array), "otherServices" (array).
Ensure all keys are camelCase. For example, use "osVersion" instead of "os_version".
If a category is not present or data is not found, you can return an empty object for deviceInfo or an empty array for list-based categories.

Configuration Text:
---
${configText}
---
`;

  try {
    const model = ai.getGenerativeModel({ model: GEMINI_TEXT_MODEL });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const parsedJson = sanitizeAndParseJson(text);
    return parsedJson as ParsedConfigData;

  } catch (error) {
    console.error("Error parsing configuration with Gemini:", error);
    throw error;
  }
};

export const analyzeConfigurationsWithGemini = async (
  configs: ParsedConfigData[]
): Promise<AnalysisFinding[]> => {
  initializeAiProvider();
  if (!ai || !(ai instanceof GoogleGenAI)) throw new Error("Gemini AI provider is not initialized.");
  if (configs.length === 0) return [];

  const configToAnalyze = configs[0];

  const simplifiedConfig = {
    fileName: configToAnalyze.fileName,
    vendor: configToAnalyze.vendor,
    hostname: configToAnalyze.hostname || configToAnalyze.deviceInfo?.hostname,
    interfaces: (configToAnalyze.interfaces || configToAnalyze.ports)?.map(i => ({
        name: i.name || i.port,
        description: i.description,
        status: i.status,
        config: i.config,
    })).slice(0, 50),
    svis: configToAnalyze.svis?.map(s => ({
        name: s.svi,
        description: s.additionalInfo.includes('Description:') ? s.additionalInfo.split('Description:')[1] : null,
    })).slice(0, 20),
    security: configToAnalyze.security,
  };

  const prompt = `
You are an expert Network Configuration Auditor for ${simplifiedConfig.vendor} devices.
Analyze the following JSON object representing a single parsed device configuration.
Identify configuration issues, security risks, and deviations from industry best practices.

For each finding, you MUST provide:
1. 'id': A unique string (e.g., "sec_risk_1").
2. 'type': "Security Risk", "Suggestion", or "Best Practice".
3. 'severity': "Critical", "High", "Medium", "Low", or "Info".
4. 'description': A concise description of the finding.
5. 'devicesInvolved': An array containing the single fileName or hostname.
6. 'details': An object or string with specific data related to the finding (e.g., the interface name).
7. 'recommendation': A clear, natural language explanation of how to fix the issue.
8. 'remediationCommands': An array of objects, where each object has a 'command' (the exact CLI command to run) and a 'context' (a brief explanation of what the command does).

Respond ONLY with a JSON array of finding objects. The root of the response must be a valid JSON array.
If no issues are found, return an empty JSON array [].
`;

  try {
    const model = ai.getGenerativeModel({ model: GEMINI_TEXT_MODEL });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const parsedJson = sanitizeAndParseJson(text);
    if (Array.isArray(parsedJson)) {
      return parsedJson.map((item, index) => ({
        ...item,
        id: item.id || `finding_${Date.now()}_${index}`,
      })) as AnalysisFinding[];
    }
    return [] as AnalysisFinding[];

  } catch (error) {
    console.error("Error analyzing configurations with Gemini:", error);
    throw error;
  }
};

export const getCliCommandWithGemini = async (
  query: string,
  vendor: VendorName
): Promise<CliCommandResponse> => {
  initializeAiProvider();
  if (!ai || !(ai instanceof GoogleGenAI)) throw new Error("Gemini AI provider is not initialized.");

  const prompt = `
You are an expert network engineer with deep knowledge of CLI commands for various vendors.
A user wants to know the command for a specific task on a ${vendor} device.

User's task: "${query}"

Provide the exact CLI command for ${vendor}. If there are variations (e.g., for different OS versions like IOS vs IOS-XE), mention them in the explanation.
Respond ONLY with a JSON object with two keys: "command" (string) and "explanation" (string).
`;

  try {
    const model = ai.getGenerativeModel({ model: GEMINI_TEXT_MODEL });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const parsedJson = sanitizeAndParseJson(text);
    return parsedJson as CliCommandResponse;

  } catch (error) {
    console.error("Error getting CLI command from Gemini:", error);
    throw error;
  }
};

export const generateCliScriptWithGemini = async (
  query: string,
  vendor: VendorName
): Promise<CliScriptResponse> => {
  initializeAiProvider();
  if (!ai || !(ai instanceof GoogleGenAI)) throw new Error("Gemini AI provider is not initialized.");

  const prompt = `
You are an expert network engineer who specializes in writing CLI configuration scripts for ${vendor} devices.
A user has described a configuration they want to apply. Create a complete, ordered CLI script to accomplish their goal.

Crucially, you MUST respect the command hierarchy.
Respond ONLY with a JSON object containing a single key: "script". The value of "script" should be a single string containing the full, ready-to-paste CLI script, with each command on a new line.
`;

  try {
    const model = ai.getGenerativeModel({ model: GEMINI_TEXT_MODEL });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const parsedJson = sanitizeAndParseJson(text);
    return parsedJson as CliScriptResponse;

  } catch (error) {
    console.error("Error generating CLI script from Gemini:", error);
    throw error;
  }
};

export const parseConfigurationWithOpenAI = async (
  configText: string,
  vendor: VendorName
): Promise<ParsedConfigData> => {
  initializeAiProvider();
  if (!ai || !(ai instanceof OpenAI)) throw new Error("OpenAI provider is not initialized.");

  const prompt = `
You are an expert network configuration parsing assistant.
Parse the following ${vendor} configuration text.
Extract structured data for the following categories:
- Device Information: Hostname (hostname), OS version (os_version), model, serial number (serial_number), uptime.
- Interfaces: Name (name), IP addresses (ip_address), subnet masks (subnet_mask), descriptions (description), status, speed/duplex, port-channels.
- VLANs & SVIs: VLAN IDs (vlan_id), names (name), SVI IP addresses (svi_ip_address), helper addresses, network ranges, free IPs.
- Routing Protocols: Protocol type, configurations, static routes, default gateways.
- Security Features: AAA, SSH, SNMP, password encryption, ACLs, firewall rules.
- Other Services: NTP, DNS, VTP, CDP/LLDP.

Respond ONLY with a JSON object. The root object should contain keys: "deviceInfo", "interfaces" (array), "vlansSvis" (array), "routingProtocols" (array), "securityFeatures" (array), "otherServices" (array).
Ensure all keys are camelCase. For example, use "osVersion" instead of "os_version".
If a category is not present or data is not found, you can return an empty object for deviceInfo or an empty array for list-based categories.
`;

  try {
    const response = await ai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
            { role: "system", content: prompt },
            { role: "user", content: configText }
        ],
        response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
        throw new Error("No content in OpenAI response");
    }
    const parsedJson = sanitizeAndParseJson(content);
    return parsedJson as ParsedConfigData;

  } catch (error) {
    console.error("Error parsing configuration with OpenAI:", error);
    throw error;
  }
};

export const analyzeConfigurationsWithOpenAI = async (
  configs: ParsedConfigData[]
): Promise<AnalysisFinding[]> => {
  initializeAiProvider();
  if (!ai || !(ai instanceof OpenAI)) throw new Error("OpenAI provider is not initialized.");
  if (configs.length === 0) return [];

  const configToAnalyze = configs[0];

  const simplifiedConfig = {
    fileName: configToAnalyze.fileName,
    vendor: configToAnalyze.vendor,
    hostname: configToAnalyze.hostname || configToAnalyze.deviceInfo?.hostname,
    interfaces: (configToAnalyze.interfaces || configToAnalyze.ports)?.map(i => ({
        name: i.name || i.port,
        description: i.description,
        status: i.status,
        config: i.config,
    })).slice(0, 50),
    svis: configToAnalyze.svis?.map(s => ({
        name: s.svi,
        description: s.additionalInfo.includes('Description:') ? s.additionalInfo.split('Description:')[1] : null,
    })).slice(0, 20),
    security: configToAnalyze.security,
  };

  const prompt = `
You are an expert Network Configuration Auditor for ${simplifiedConfig.vendor} devices.
Analyze the following JSON object representing a single parsed device configuration.
Identify configuration issues, security risks, and deviations from industry best practices.

For each finding, you MUST provide:
1. 'id': A unique string (e.g., "sec_risk_1").
2. 'type': "Security Risk", "Suggestion", or "Best Practice".
3. 'severity': "Critical", "High", "Medium", "Low", or "Info".
4. 'description': A concise description of the finding.
5. 'devicesInvolved': An array containing the single fileName or hostname.
6. 'details': An object or string with specific data related to the finding (e.g., the interface name).
7. 'recommendation': A clear, natural language explanation of how to fix the issue.
8. 'remediationCommands': An array of objects, where each object has a 'command' (the exact CLI command to run) and a 'context' (a brief explanation of what the command does).

Respond ONLY with a JSON array of finding objects. The root of the response must be a valid JSON array.
If no issues are found, return an empty JSON array [].
`;

  try {
    const response = await ai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
            { role: "system", content: prompt },
            { role: "user", content: JSON.stringify(simplifiedConfig, null, 2) }
        ],
        response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
        throw new Error("No content in OpenAI response");
    }
    const parsedJson = sanitizeAndParseJson(content);
    if (Array.isArray(parsedJson)) {
      return parsedJson.map((item, index) => ({
        ...item,
        id: item.id || `finding_${Date.now()}_${index}`,
      })) as AnalysisFinding[];
    }
    return [] as AnalysisFinding[];

  } catch (error) {
    console.error("Error analyzing configurations with OpenAI:", error);
    throw error;
  }
};

export const getCliCommandWithOpenAI = async (
  query: string,
  vendor: VendorName
): Promise<CliCommandResponse> => {
  initializeAiProvider();
  if (!ai || !(ai instanceof OpenAI)) throw new Error("OpenAI provider is not initialized.");

  const prompt = `
You are an expert network engineer with deep knowledge of CLI commands for various vendors.
A user wants to know the command for a specific task on a ${vendor} device.

User's task: "${query}"

Provide the exact CLI command for ${vendor}. If there are variations (e.g., for different OS versions like IOS vs IOS-XE), mention them in the explanation.
Respond ONLY with a JSON object with two keys: "command" (string) and "explanation" (string).
`;

  try {
    const response = await ai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
            { role: "system", content: prompt }
        ],
        response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
        throw new Error("No content in OpenAI response");
    }
    const parsedJson = sanitizeAndParseJson(content);
    return parsedJson as CliCommandResponse;

  } catch (error) {
    console.error("Error getting CLI command from OpenAI:", error);
    throw error;
  }
};

export const generateCliScriptWithOpenAI = async (
  query: string,
  vendor: VendorName
): Promise<CliScriptResponse> => {
  initializeAiProvider();
  if (!ai || !(ai instanceof OpenAI)) throw new Error("OpenAI provider is not initialized.");

  const prompt = `
You are an expert network engineer who specializes in writing CLI configuration scripts for ${vendor} devices.
A user has described a configuration they want to apply. Create a complete, ordered CLI script to accomplish their goal.

Crucially, you MUST respect the command hierarchy.
Respond ONLY with a JSON object containing a single key: "script". The value of "script" should be a single string containing the full, ready-to-paste CLI script, with each command on a new line.
`;

  try {
    const response = await ai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
            { role: "system", content: prompt },
            { role: "user", content: query }
        ],
        response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
        throw new Error("No content in OpenAI response");
    }
    const parsedJson = sanitizeAndParseJson(content);
    return parsedJson as CliScriptResponse;

  } catch (error) {
    console.error("Error generating CLI script from OpenAI:", error);
    throw error;
  }
};

export const parseConfigurationWithOllama = async (
  configText: string,
  vendor: VendorName
): Promise<ParsedConfigData> => {
  initializeAiProvider();
  if (!ai || ai === null || typeof ai.chat !== 'function') throw new Error("Ollama provider is not initialized or does not have a chat method.");

  const prompt = `
You are an expert network configuration parsing assistant.
Parse the following ${vendor} configuration text.
Extract structured data for the following categories:
- Device Information: Hostname (hostname), OS version (os_version), model, serial number (serial_number), uptime.
- Interfaces: Name (name), IP addresses (ip_address), subnet masks (subnet_mask), descriptions (description), status, speed/duplex, port-channels.
- VLANs & SVIs: VLAN IDs (vlan_id), names (name), SVI IP addresses (svi_ip_address), helper addresses, network ranges, free IPs.
- Routing Protocols: Protocol type, configurations, static routes, default gateways.
- Security Features: AAA, SSH, SNMP, password encryption, ACLs, firewall rules.
- Other Services: NTP, DNS, VTP, CDP/LLDP.

Respond ONLY with a JSON object. The root object should contain keys: "deviceInfo", "interfaces" (array), "vlansSvis" (array), "routingProtocols" (array), "securityFeatures" (array), "otherServices" (array).
Ensure all keys are camelCase. For example, use "osVersion" instead of "os_version".
If a category is not present or data is not found, you can return an empty object for deviceInfo or an empty array for list-based categories.
`;

  try {
    const response = await ai.chat({
        model: "llama3.1",
        messages: [
            { role: "system", content: prompt },
            { role: "user", content: configText }
        ],
        format: "json",
    });

    const content = response.message?.content;
    if (!content) {
        throw new Error("No content in Ollama response");
    }
    const parsedJson = sanitizeAndParseJson(content);
    return parsedJson as ParsedConfigData;

  } catch (error) {
    console.error("Error parsing configuration with Ollama:", error);
    throw error;
  }
};

export const analyzeConfigurationsWithOllama = async (
  configs: ParsedConfigData[]
): Promise<AnalysisFinding[]> => {
  initializeAiProvider();
  if (!ai || ai === null || typeof ai.chat !== 'function') throw new Error("Ollama provider is not initialized or does not have a chat method.");
  if (configs.length === 0) return [];

  const configToAnalyze = configs[0];

  const simplifiedConfig = {
    fileName: configToAnalyze.fileName,
    vendor: configToAnalyze.vendor,
    hostname: configToAnalyze.hostname || configToAnalyze.deviceInfo?.hostname,
    interfaces: (configToAnalyze.interfaces || configToAnalyze.ports)?.map(i => ({
        name: i.name || i.port,
        description: i.description,
        status: i.status,
        config: i.config,
    })).slice(0, 50),
    svis: configToAnalyze.svis?.map(s => ({
        name: s.svi,
        description: s.additionalInfo.includes('Description:') ? s.additionalInfo.split('Description:')[1] : null,
    })).slice(0, 20),
    security: configToAnalyze.security,
  };

  const prompt = `
You are an expert Network Configuration Auditor for ${simplifiedConfig.vendor} devices.
Analyze the following JSON object representing a single parsed device configuration.
Identify configuration issues, security risks, and deviations from industry best practices.

For each finding, you MUST provide:
1. 'id': A unique string (e.g., "sec_risk_1").
2. 'type': "Security Risk", "Suggestion", or "Best Practice".
3. 'severity': "Critical", "High", "Medium", "Low", or "Info".
4. 'description': A concise description of the finding.
5. 'devicesInvolved': An array containing the single fileName or hostname.
6. 'details': An object or string with specific data related to the finding (e.g., the interface name).
7. 'recommendation': A clear, natural language explanation of how to fix the issue.
8. 'remediationCommands': An array of objects, where each object has a 'command' (the exact CLI command to run) and a 'context' (a brief explanation of what the command does).

Respond ONLY with a JSON array of finding objects. The root of the response must be a valid JSON array.
If no issues are found, return an empty JSON array [].
`;

  try {
    const response = await ai.chat({
        model: "llama3.1",
        messages: [
            { role: "system", content: prompt },
            { role: "user", content: JSON.stringify(simplifiedConfig, null, 2) }
        ],
        format: "json",
    });

    const content = response.message?.content;
    if (!content) {
        throw new Error("No content in Ollama response");
    }
    const parsedJson = sanitizeAndParseJson(content);
    if (Array.isArray(parsedJson)) {
      return parsedJson.map((item, index) => ({
        ...item,
        id: item.id || `finding_${Date.now()}_${index}`,
      })) as AnalysisFinding[];
    }
    return [] as AnalysisFinding[];

  } catch (error) {
    console.error("Error analyzing configurations with Ollama:", error);
    throw error;
  }
};

export const getCliCommandWithOllama = async (
  query: string,
  vendor: VendorName
): Promise<CliCommandResponse> => {
  initializeAiProvider();
  if (!ai || ai === null || typeof ai.chat !== 'function') throw new Error("Ollama provider is not initialized or does not have a chat method.");

  const prompt = `
You are an expert network engineer with deep knowledge of CLI commands for various vendors.
A user wants to know the command for a specific task on a ${vendor} device.

User's task: "${query}"

Provide the exact CLI command for ${vendor}. If there are variations (e.g., for different OS versions like IOS vs IOS-XE), mention them in the explanation.
Respond ONLY with a JSON object with two keys: "command" (string) and "explanation" (string).
`;

  try {
    const response = await ai.chat({
        model: "llama3.1",
        messages: [
            { role: "system", content: prompt }
        ],
        format: "json",
    });

    const content = response.message?.content;
    if (!content) {
        throw new Error("No content in Ollama response");
    }
    const parsedJson = sanitizeAndParseJson(content);
    return parsedJson as CliCommandResponse;

  } catch (error) {
    console.error("Error getting CLI command from Ollama:", error);
    throw error;
  }
};

export const generateCliScriptWithOllama = async (
  query: string,
  vendor: VendorName
): Promise<CliScriptResponse> => {
  initializeAiProvider();
  if (!ai || ai === null || typeof ai.chat !== 'function') throw new Error("Ollama provider is not initialized or does not have a chat method.");

  const prompt = `
You are an expert network engineer who specializes in writing CLI configuration scripts for ${vendor} devices.
A user has described a configuration they want to apply. Create a complete, ordered CLI script to accomplish their goal.

Crucially, you MUST respect the command hierarchy.
Respond ONLY with a JSON object containing a single key: "script". The value of "script" should be a single string containing the full, ready-to-paste CLI script, with each command on a new line.
`;

  try {
    const response = await ai.chat({
        model: "llama3.1",
        messages: [
            { role: "system", content: prompt },
            { role: "user", content: query }
        ],
        format: "json",
    });

    const content = response.message?.content;
    if (!content) {
        throw new Error("No content in Ollama response");
    }
    const parsedJson = sanitizeAndParseJson(content);
    return parsedJson as CliScriptResponse;

  } catch (error) {
    console.error("Error generating CLI script from Ollama:", error);
    throw error;
  }
};

export const parseConfigurationWithAI = async (
  configText: string,
  vendor: VendorName
): Promise<ParsedConfigData> => {
    initializeAiProvider();
    const provider = localStorage.getItem('aiProvider') || 'Gemini';

    if (provider === 'Gemini') {
        return parseConfigurationWithGemini(configText, vendor);
    } else if (provider === 'OpenAI') {
        return parseConfigurationWithOpenAI(configText, vendor);
    } else if (provider === 'Ollama') {
        return parseConfigurationWithOllama(configText, vendor);
    } else {
        throw new Error('No AI provider selected');
    }
};

export const analyzeConfigurations = async (
  configs: ParsedConfigData[]
): Promise<AnalysisFinding[]> => {
    initializeAiProvider();
    const provider = localStorage.getItem('aiProvider') || 'Gemini';

    if (provider === 'Gemini') {
        return analyzeConfigurationsWithGemini(configs);
    } else if (provider === 'OpenAI') {
        return analyzeConfigurationsWithOpenAI(configs);
    } else if (provider === 'Ollama') {
        return analyzeConfigurationsWithOllama(configs);
    } else {
        throw new Error('No AI provider selected');
    }
};

export const getCliCommand = async (
  query: string,
  vendor: VendorName
): Promise<CliCommandResponse> => {
    initializeAiProvider();
    const provider = localStorage.getItem('aiProvider') || 'Gemini';

    if (provider === 'Gemini') {
        return getCliCommandWithGemini(query, vendor);
    } else if (provider === 'OpenAI') {
        return getCliCommandWithOpenAI(query, vendor);
    } else if (provider === 'Ollama') {
        return getCliCommandWithOllama(query, vendor);
    } else {
        throw new Error('No AI provider selected');
    }
};

export const generateCliScript = async (
  query: string,
  vendor: VendorName
): Promise<CliScriptResponse> => {
    initializeAiProvider();
    const provider = localStorage.getItem('aiProvider') || 'Gemini';

    if (provider === 'Gemini') {
        return generateCliScriptWithGemini(query, vendor);
    } else if (provider === 'OpenAI') {
        return generateCliScriptWithOpenAI(query, vendor);
    } else if (provider === 'Ollama') {
        return generateCliScriptWithOllama(query, vendor);
    } else {
        throw new Error('No AI provider selected');
    }
};
