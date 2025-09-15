import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { ParsedConfigData, AnalysisFinding, VendorName, CliCommandResponse, CliScriptResponse } from '../types';
import { GEMINI_TEXT_MODEL } from '../constants';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.warn("API_KEY is not set. Gemini API calls will fail. Ensure process.env.API_KEY is configured.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

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
  if (!API_KEY) throw new Error("API_KEY is not configured.");

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
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.1, // Lower temperature for more deterministic parsing
      },
    });
    
    const parsedJson = sanitizeAndParseJson(response.text);
    return parsedJson as ParsedConfigData;

  } catch (error) {
    console.error("Error parsing configuration with Gemini:", error);
    throw error;
  }
};

export const analyzeConfigurations = async (
  configs: ParsedConfigData[]
): Promise<AnalysisFinding[]> => {
  if (!API_KEY) throw new Error("API_KEY is not configured.");
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
        // Include partial config to check for things like port-security
        config: i.config,
    })).slice(0, 50), // Increased limit to provide more context
    svis: configToAnalyze.svis?.map(s => ({
        name: s.svi,
        description: s.additionalInfo.includes('Description:') ? s.additionalInfo.split('Description:')[1] : null,
    })).slice(0, 20),
    security: configToAnalyze.security, // Pass security compliance data
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
8. 'remediationCommands': An array of objects, where each object has a 'command' (the exact CLI command to run) and a 'context' (a brief explanation of what the command does, like 'Enter global configuration mode.'). For multi-line configurations, provide each command as a separate object in the array. If no direct command is applicable, return an empty array [].

Focus on these ${simplifiedConfig.vendor} specific areas:
- Security Risks: Missing 'service password-encryption', HTTP server enabled (no 'ip http server' or 'no ip http secure-server' is missing), insecure SNMP configurations, lack of AAA, missing 'switchport port-security' on access ports, interfaces without 'spanning-tree bpduguard enable'.
- Best Practices & Suggestions: Active interfaces, port-channels, or SVIs missing a 'description', inconsistent naming schemes, unused configurations.

Example finding for a missing description on interface GigabitEthernet1/0/1:
{
  "id": "best_practice_desc_gi1/0/1",
  "type": "Best Practice",
  "severity": "Low",
  "description": "Interface GigabitEthernet1/0/1 is missing a description.",
  "devicesInvolved": ["${simplifiedConfig.fileName}"],
  "details": { "interface": "GigabitEthernet1/0/1" },
  "recommendation": "It is best practice to add a descriptive label to all active interfaces to aid in troubleshooting and network management.",
  "remediationCommands": [
    { "command": "configure terminal", "context": "Enter global configuration mode." },
    { "command": "interface GigabitEthernet1/0/1", "context": "Enter interface configuration mode." },
    { "command": "description *** USER-FACING PORT ***", "context": "Set a descriptive label for the interface." },
    { "command": "end", "context": "Exit configuration mode." }
  ]
}

Respond ONLY with a JSON array of finding objects. The root of the response must be a valid JSON array.
If no issues are found, return an empty JSON array [].

Configuration:
---
${JSON.stringify(simplifiedConfig, null, 2)}
---
`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.3, 
      },
    });

    const parsedJson = sanitizeAndParseJson(response.text);
    
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


export const getCliCommand = async (
  query: string,
  vendor: VendorName
): Promise<CliCommandResponse> => {
  if (!API_KEY) throw new Error("API_KEY is not configured.");

  const prompt = `
You are an expert network engineer with deep knowledge of CLI commands for various vendors.
A user wants to know the command for a specific task on a ${vendor} device.

User's task: "${query}"

Provide the exact CLI command for ${vendor}. If there are variations (e.g., for different OS versions like IOS vs IOS-XE), mention them in the explanation.
Respond ONLY with a JSON object with two keys: "command" (string) and "explanation" (string).

Example for "show running config" on "Cisco":
{
  "command": "show running-config",
  "explanation": "Displays the currently active configuration on the device."
}
`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            command: { type: Type.STRING, description: "The CLI command." },
            explanation: { type: Type.STRING, description: "A brief explanation of the command." },
          },
          required: ["command", "explanation"],
        },
        temperature: 0.2,
      },
    });
    
    const parsedJson = sanitizeAndParseJson(response.text);
    return parsedJson as CliCommandResponse;

  } catch (error) {
    console.error("Error getting CLI command from Gemini:", error);
    throw error;
  }
};


export const generateCliScript = async (
  query: string,
  vendor: VendorName
): Promise<CliScriptResponse> => {
  if (!API_KEY) throw new Error("API_KEY is not configured.");

  const prompt = `
You are an expert network engineer who specializes in writing CLI configuration scripts for ${vendor} devices.
A user has described a configuration they want to apply. Create a complete, ordered CLI script to accomplish their goal.

Crucially, you MUST respect the command hierarchy. This means:
1.  Enter the correct configuration mode (e.g., 'configure terminal' for Cisco, 'configure' for Juniper).
2.  Navigate into specific contexts when needed (e.g., 'interface Vlan1').
3.  Exit contexts when you are done with them to return to the previous level (e.g., 'exit').
4.  End the configuration session where appropriate (e.g., 'end' for Cisco).

User's desired configuration: "${query}"

Respond ONLY with a JSON object containing a single key: "script". The value of "script" should be a single string containing the full, ready-to-paste CLI script, with each command on a new line.

Example for a simple Cisco request: "hostname is SW1 and set dns to 8.8.8.8"
{
  "script": "configure terminal\\nhostname SW1\\nip name-server 8.8.8.8\\nend"
}
`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            script: { type: Type.STRING, description: "The complete, new-line separated CLI script." },
          },
          required: ["script"],
        },
        temperature: 0.2,
      },
    });
    
    const parsedJson = sanitizeAndParseJson(response.text);
    return parsedJson as CliScriptResponse;

  } catch (error) {
    console.error("Error generating CLI script from Gemini:", error);
    throw error;
  }
};