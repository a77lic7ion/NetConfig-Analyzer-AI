import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { ParsedConfigData, AnalysisFinding, VendorName, CliCommandResponse, CliScriptResponse, LlmSettings, LlmProvider, ChatMessage } from '../types';
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

export const askAboutAnalysis = async (
  analysisReport: string,
  chatHistory: ChatMessage[],
  query: string,
  settings: LlmSettings
): Promise<{ text: string; sources?: any[] }> => {
  const systemInstruction = `You are an expert network security assistant. Your goal is to help the user understand the provided network configuration analysis report.
- The user will ask questions about the findings in the report.
- Your primary context is the JSON analysis report provided below.
- Do not just recite the findings from the report. Instead, EXPLAIN their significance. For example, if a finding says "HTTP server is enabled", explain WHY this is a security risk (e.g., clear-text credentials).
- For any finding, concept, or term the user asks about (e.g., "What is BPDU Guard?", "Tell me more about insecure VTY lines"), you MUST use your web search capability to find detailed explanations, best practices, and reference materials.
- Synthesize the information from the report and your web search into a comprehensive, easy-to-understand answer.
- You MUST always cite the web pages you used as sources for your information.
- If the question is completely unrelated to the report, answer it using your general knowledge and web search.`;

  const historyFormatted = chatHistory.map(m => `${m.role}: ${m.content}`).join('\n');

  const prompt = `
${systemInstruction}

ANALYSIS REPORT:
\`\`\`json
${analysisReport}
\`\`\`

CHAT HISTORY:
${historyFormatted}

USER'S NEW QUESTION:
"${query}"

Based on the above report and history, please answer the user's new question. Your response should be plain text, not JSON.`;

  if (settings.provider === LlmProvider.GEMINI) {
    if (!API_KEY) throw new Error("Google Gemini API Key is not configured.");
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const response = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.3,
      },
    });

    const text = response.text;
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    const sources = groundingChunks.map((chunk: any) => chunk.web).filter(Boolean);

    return { text, sources };
  } else {
    // For OpenAI/Ollama, they don't support grounding, so we can't use web search.
    // Adjust the prompt for them to not mention web search and to return a JSON object.
     const nonGeminiSystemInstruction = `You are an expert network security assistant. Your primary role is to answer questions about the provided network configuration analysis report.
      - The report is provided in JSON format below.
      - When a user asks a question, base your answer on the information within the report.
      - Do not just recite the findings. Explain their significance and provide context based on general network security best practices. For example, if a finding says "HTTP server is enabled", explain WHY this is a security risk.
      - If the question cannot be answered from the report, state that the information is not available in the analysis.
      - Do not invent details not present in the report.
      - Respond ONLY with a JSON object containing a single key: "answer", which should be a string.`;
      
      const nonGeminiPrompt = `
      ${nonGeminiSystemInstruction}

      ANALYSIS REPORT:
      \`\`\`json
      ${analysisReport}
      \`\`\`

      CHAT HISTORY:
      ${historyFormatted}

      USER'S NEW QUESTION:
      "${query}"

      Answer the user's question in JSON format.`;

    const response = await getLlmResponse(nonGeminiPrompt, settings);
    return { text: response.answer, sources: [] };
  }
};