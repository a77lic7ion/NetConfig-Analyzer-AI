import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { ParsedConfigData, AnalysisFinding, VendorName, CliCommandResponse, CliScriptResponse, LlmSettings, LlmProvider, ChatMessage } from '../types';

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

const callGemini = async (prompt: string, settings: LlmSettings, schema?: any): Promise<string> => {
  if (!settings.gemini.apiKey) throw new Error("Google Gemini API Key is not configured.");
  const ai = new GoogleGenAI({ apiKey: settings.gemini.apiKey });
  const response: GenerateContentResponse = await ai.models.generateContent({
    model: settings.gemini.model || "gemini-2.0-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      ...(schema && { responseSchema: schema }),
      temperature: 0.2,
    },
  });
  return response.text;
};

const callOpenAiCompatible = async (
    url: string,
    apiKey: string,
    model: string,
    prompt: string,
    providerName: string,
    extraHeaders: Record<string, string> = {}
): Promise<string> => {
    if (!apiKey && providerName !== 'Ollama') throw new Error(`${providerName} API Key is not configured.`);

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(apiKey && { 'Authorization': `Bearer ${apiKey}` }),
            ...extraHeaders
        },
        body: JSON.stringify({
            model: model,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0.2,
        })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
        throw new Error(`${providerName} API Error: ${error.error?.message || error.message || response.statusText}`);
    }
    const data = await response.json();
    return data.choices[0].message.content;
};

const callClaude = async (prompt: string, settings: LlmSettings): Promise<string> => {
    if (!settings.anthropic.apiKey) throw new Error("Claude API Key is not configured.");
    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': settings.anthropic.apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: settings.anthropic.model,
            max_tokens: 4096,
            messages: [{ role: "user", content: prompt + "\n\nIMPORTANT: Respond ONLY with a valid JSON object." }],
            temperature: 0.2,
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Claude API Error: ${error.error?.message || response.statusText}`);
    }
    const data = await response.json();
    return data.content[0].text;
};

const callOllama = async (prompt: string, settings: LlmSettings): Promise<string> => {
    if (!settings.ollama.baseUrl || !settings.ollama.model) throw new Error("Ollama Base URL or Model is not configured.");
    const response = await fetch(`${settings.ollama.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: settings.ollama.model,
            prompt: prompt,
            format: 'json',
            stream: false,
            options: { temperature: 0.2 }
        })
    });
     if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(`Ollama API Error: ${error.error || response.statusText}`);
    }
    const data = await response.json();
    return data.response;
};

const callCloudflare = async (prompt: string, settings: LlmSettings): Promise<string> => {
    if (!settings.cloudflare.accountId || !settings.cloudflare.apiToken) throw new Error("Cloudflare Account ID or API Token is not configured.");
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${settings.cloudflare.accountId}/ai/run/${settings.cloudflare.model}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${settings.cloudflare.apiToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            messages: [{ role: "user", content: prompt + "\n\nIMPORTANT: Respond ONLY with a valid JSON object." }],
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Cloudflare API Error: ${error.errors?.[0]?.message || response.statusText}`);
    }
    const data = await response.json();
    return data.result.response;
};

const callHuggingFace = async (prompt: string, settings: LlmSettings): Promise<string> => {
    if (!settings.huggingface.apiKey) throw new Error("Hugging Face API Key is not configured.");
    const response = await fetch(`https://api-inference.huggingface.co/models/${settings.huggingface.model}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${settings.huggingface.apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            inputs: prompt + "\n\nJSON Output:",
            parameters: { return_full_text: false, max_new_tokens: 1024 }
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Hugging Face API Error: ${error.error || response.statusText}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data[0].generated_text : data.generated_text;
};

const getLlmResponse = async (prompt: string, settings: LlmSettings, schema?: any): Promise<any> => {
    let responseText: string;
    switch (settings.provider) {
        case LlmProvider.GEMINI:
            responseText = await callGemini(prompt, settings, schema);
            break;
        case LlmProvider.OPENAI:
            responseText = await callOpenAiCompatible("https://api.openai.com/v1/chat/completions", settings.openAi.apiKey, settings.openAi.model, prompt, "OpenAI");
            break;
        case LlmProvider.CLAUDE:
            responseText = await callClaude(prompt, settings);
            break;
        case LlmProvider.DEEPSEEK:
            responseText = await callOpenAiCompatible("https://api.deepseek.com/chat/completions", settings.deepseek.apiKey, settings.deepseek.model, prompt, "Deepseek");
            break;
        case LlmProvider.OLLAMA:
            responseText = await callOllama(prompt, settings);
            break;
        case LlmProvider.XAI:
            responseText = await callOpenAiCompatible("https://api.x.ai/v1/chat/completions", settings.xAi.apiKey, settings.xAi.model, prompt, "x.ai");
            break;
        case LlmProvider.CLOUDFLARE:
            responseText = await callCloudflare(prompt, settings);
            break;
        case LlmProvider.MISTRAL:
            responseText = await callOpenAiCompatible("https://api.mistral.ai/v1/chat/completions", settings.mistral.apiKey, settings.mistral.model, prompt, "Mistral");
            break;
        case LlmProvider.HUGGINGFACE:
            responseText = await callHuggingFace(prompt, settings);
            break;
        case LlmProvider.OPENROUTER:
            responseText = await callOpenAiCompatible(
                "https://openrouter.ai/api/v1/chat/completions",
                settings.openRouter.apiKey,
                settings.openRouter.model,
                prompt,
                "OpenRouter",
                {
                    "HTTP-Referer": window.location.origin,
                    "X-Title": "NetConfig Analyzer"
                }
            );
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
  const prompt = `You are an expert network security and operations analyst. Analyze the following ${config.vendor} configuration. Identify security risks, departures from best practices, and potential operational conflicts. For each finding, provide a description, severity, recommendation, and suggested CLI remediation commands.

  Respond ONLY with a JSON object containing a "findings" key, which is an array of objects. Each object in the array should conform to this structure:
  {
    "id": "unique_id",
    "type": "Security Risk" | "Best Practice" | "Suggestion",
    "severity": "Critical" | "High" | "Medium" | "Low" | "Info",
    "description": "...",
    "devicesInvolved": ["${config.fileName}"],
    "details": {},
    "recommendation": "...",
    "remediationCommands": [{ "command": "...", "context": "..." }]
  }

  Configuration: --- ${config.rawConfig} ---`;

  const result = await getLlmResponse(prompt, settings);
  return Array.isArray(result) ? result : (result.findings || []);
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
- For any finding, concept, or term the user asks about (e.g., "What is BPDU Guard?", "Tell me more about insecure VTY lines"), you MUST provide detailed explanations, best practices, and reference materials.
- Synthesize the information from the report into a comprehensive, easy-to-understand answer.
- If the question is completely unrelated to the report, answer it using your general knowledge.`;

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

Based on the above report and history, please answer the user's new question. Your response should be plain text. If using Gemini and it supports grounding, it may provide sources.`;

  if (settings.provider === LlmProvider.GEMINI) {
    if (!settings.gemini.apiKey) throw new Error("Google Gemini API Key is not configured.");
    const ai = new GoogleGenAI({ apiKey: settings.gemini.apiKey });
    const response = await ai.models.generateContent({
      model: settings.gemini.model || "gemini-2.0-flash",
      contents: prompt,
      config: {
        // tools: [{ googleSearch: {} }], // Re-enable if needed, but keeping it simple for now
        temperature: 0.3,
      },
    });

    const text = response.text;
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    const sources = groundingChunks.map((chunk: any) => chunk.web).filter(Boolean);

    return { text, sources };
  } else {
    // For others, return plain text response
     const nonGeminiSystemInstruction = `You are an expert network security assistant. Your primary role is to answer questions about the provided network configuration analysis report.
      - The report is provided in JSON format below.
      - When a user asks a question, base your answer on the information within the report.
      - Do not just recite the findings. Explain their significance and provide context.
      - If the question cannot be answered from the report, state that the information is not available in the analysis.
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

// --- Test Connection & Fetch Models ---

export const testConnection = async (settings: LlmSettings): Promise<boolean> => {
    try {
        const testPrompt = "Respond with 'pong' in JSON format: {\"ping\": \"pong\"}";
        const response = await getLlmResponse(testPrompt, settings);
        return response.ping === 'pong' || !!response;
    } catch (e) {
        console.error("Connection test failed:", e);
        throw e;
    }
};

export const fetchModels = async (settings: LlmSettings): Promise<string[]> => {
    switch (settings.provider) {
        case LlmProvider.OPENAI: {
            const response = await fetch("https://api.openai.com/v1/models", {
                headers: { 'Authorization': `Bearer ${settings.openAi.apiKey}` }
            });
            if (!response.ok) return [];
            const data = await response.json();
            return data.data.map((m: any) => m.id).filter((id: string) => id.startsWith('gpt'));
        }
        case LlmProvider.OLLAMA: {
            const response = await fetch(`${settings.ollama.baseUrl}/api/tags`);
            if (!response.ok) return [];
            const data = await response.json();
            return data.models.map((m: any) => m.name);
        }
        case LlmProvider.MISTRAL: {
            const response = await fetch("https://api.mistral.ai/v1/models", {
                headers: { 'Authorization': `Bearer ${settings.mistral.apiKey}` }
            });
            if (!response.ok) return [];
            const data = await response.json();
            return data.data.map((m: any) => m.id);
        }
        case LlmProvider.OPENROUTER: {
            const response = await fetch("https://openrouter.ai/api/v1/models");
            if (!response.ok) return [];
            const data = await response.json();
            return data.data.map((m: any) => m.id);
        }
        case LlmProvider.GEMINI:
            return ["gemini-2.0-flash", "gemini-2.0-flash-lite-preview-02-05", "gemini-1.5-flash", "gemini-1.5-pro"];
        case LlmProvider.CLAUDE:
            return ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"];
        case LlmProvider.DEEPSEEK:
            return ["deepseek-chat", "deepseek-reasoner"];
        case LlmProvider.XAI:
            return ["grok-2-1212", "grok-2-vision-1212", "grok-beta"];
        case LlmProvider.HUGGINGFACE:
            return ["meta-llama/Llama-3.1-8B-Instruct", "mistralai/Mistral-7B-Instruct-v0.3", "microsoft/Phi-3-mini-4k-instruct"];
        default:
            return [];
    }
};
