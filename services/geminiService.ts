import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { ParsedConfigData, AnalysisFinding, VendorName, CliCommandResponse, CliScriptResponse, LlmSettings, LlmProvider } from '../types';
import { GEMINI_TEXT_MODEL } from '../constants';

const API_KEY = process.env.API_KEY;

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
    throw new Error(`Failed to parse AI response as JSON. Content: ${jsonString.substring(0, 1000)}`);
  }
};

const callGemini = async (prompt: string, schema?: any): Promise<string> => {
  if (!API_KEY) throw new Error("Google Gemini API Key is not configured.");
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const response: GenerateContentResponse = await ai.models.generateContent({
    model: GEMINI_TEXT_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      ...(schema && { responseSchema: schema }),
      temperature: 0.2,
    },
  });
  return response.text;
};

const callOpenAI = async (prompt: string, settings: LlmSettings): Promise<string> => {
    if (!settings.openAi.apiKey) throw new Error("OpenAI API Key is not configured in settings.");
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.openAi.apiKey}`
        },
        body: JSON.stringify({
            model: settings.openAi.model,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0.2,
        })
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API Error: ${error.error.message}`);
    }
    const data = await response.json();
    return data.choices[0].message.content;
};

const callOllama = async (prompt: string, settings: LlmSettings): Promise<string> => {
    if (!settings.ollama.baseUrl || !settings.ollama.model) throw new Error("Ollama Base URL or Model is not configured in settings.");
    const response = await fetch(`${settings.ollama.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: settings.ollama.model,
            prompt: prompt,
            format: 'json',
            stream: false
        })
    });
     if (!response.ok) {
        const error = await response.json();
        throw new Error(`Ollama API Error: ${error.error}`);
    }
    const data = await response.json();
    return data.response;
};

const getLlmResponse = async (prompt: string, settings: LlmSettings, schema?: any): Promise<any> => {
    let responseText: string;
    switch (settings.provider) {
        case LlmProvider.GEMINI:
            responseText = await callGemini(prompt, schema);
            break;
        case LlmProvider.OPENAI:
            responseText = await callOpenAI(prompt, settings);
            break;
        case LlmProvider.OLLAMA:
            responseText = await callOllama(prompt, settings);
            break;
        default:
            throw new Error(`Unsupported LLM provider: ${settings.provider}`);
    }
    return sanitizeAndParseJson(responseText);
};

export const getCliCommand = async (query: string, vendor: VendorName, settings: LlmSettings): Promise<CliCommandResponse> => {
  const prompt = `You are an expert network engineer with deep knowledge of CLI commands for various vendors. A user wants to know the command for a specific task on a ${vendor} device. User's task: "${query}". Provide the exact CLI command for ${vendor}. If there are variations (e.g., for different OS versions like IOS vs IOS-XE), mention them in the explanation. Respond ONLY with a JSON object with two keys: "command" (string) and "explanation" (string).`;
  const schema = {
      type: Type.OBJECT,
      properties: {
        command: { type: Type.STRING, description: "The CLI command." },
        explanation: { type: Type.STRING, description: "A brief explanation of the command." },
      },
      required: ["command", "explanation"],
  };
  return getLlmResponse(prompt, settings, schema);
};

export const generateCliScript = async (query: string, vendor: VendorName, settings: LlmSettings): Promise<CliScriptResponse> => {
  const prompt = `You are an expert network engineer who specializes in writing CLI configuration scripts for ${vendor} devices. A user has described a configuration they want to apply. Create a complete, ordered CLI script to accomplish their goal. Crucially, you MUST respect the command hierarchy (e.g., 'configure terminal', then 'interface Vlan1', then 'exit'). End the configuration session where appropriate. User's desired configuration: "${query}". Respond ONLY with a JSON object containing a single key: "script". The value of "script" should be a single string containing the full, ready-to-paste CLI script, with each command on a new line.`;
  const schema = {
      type: Type.OBJECT,
      properties: {
        script: { type: Type.STRING, description: "The complete, new-line separated CLI script." },
      },
      required: ["script"],
  };
  return getLlmResponse(prompt, settings, schema);
};

export const analyzeConfiguration = async (config: ParsedConfigData, settings: LlmSettings): Promise<AnalysisFinding[]> => {
  const prompt = `You are an expert network security and operations analyst. Analyze the following ${config.vendor} configuration. Identify security risks, departures from best practices, and potential operational conflicts. For each finding, provide a description, severity, recommendation, and suggested CLI remediation commands. Respond ONLY with a JSON array of objects. Each object in the array should conform to this structure: { "id": "unique_id", "type": "Security Risk" | "Best Practice" | "Suggestion", "severity": "Critical" | "High" | "Medium" | "Low" | "Info", "description": "...", "devicesInvolved": ["${config.fileName}"], "details": { ... }, "recommendation": "...", "remediationCommands": [{ "command": "...", "context": "..." }] }. Configuration: --- ${config.rawConfig} ---`;
  
  // Note: Schema for complex arrays is not fully supported by Gemini's responseSchema, but the prompt is structured to guide all models correctly.
  return getLlmResponse(prompt, settings);
};
