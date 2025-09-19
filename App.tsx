import React, { useState, useCallback, ChangeEvent, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { APP_TITLE, APP_SUBTITLE, SUPPORTED_VENDORS_DATA, PIE_CHART_DATA, CORE_FEATURES_DATA, GEMINI_TEXT_MODEL } from './constants';
import { UploadedFile, ParsedConfigData, AnalysisFinding, VendorName, PieChartData, CliCommandResponse, CliScriptResponse, LlmSettings, LlmProvider, ChatMessage } from './types';
import { parseConfiguration } from './services/parserService';
import { getCliCommand, generateCliScript, askAboutAnalysis } from './services/geminiService';
import { runAnalysis } from './services/analysisService';
import { initDB, saveFindings, getAllFindings, clearFindings } from './services/dbService';
import Section from './components/Section';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorMessage from './components/ErrorMessage';
import ConfigurationReport from './components/ConfigurationReport';
import FindingCard from './components/FindingCard';
import FeatureCard from './components/FeatureCard';
import VendorLogo from './components/VendorLogo';
import CliHelper from './components/CliHelper';
import ScriptWriter from './components/ScriptWriter';
import SettingsModal from './components/SettingsModal';
import ChatAgent from './components/ChatAgent';

const DEFAULT_LLM_SETTINGS: LlmSettings = {
  provider: LlmProvider.GEMINI,
  openAi: {
    apiKey: '',
    model: 'gpt-4-turbo',
  },
  ollama: {
    baseUrl: 'http://localhost:11434',
    model: 'llama3',
  },
  useLlmForAnalysis: false,
};

const App: React.FC = () => {
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [parsedConfig, setParsedConfig] = useState<ParsedConfigData | null>(null);
  const [analysisFindings, setAnalysisFindings] = useState<AnalysisFinding[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentVendor, setCurrentVendor] = useState<VendorName>(SUPPORTED_VENDORS_DATA[0].name);
  const [isDbReady, setIsDbReady] = useState(false);

  // Settings State
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [llmSettings, setLlmSettings] = useState<LlmSettings>(DEFAULT_LLM_SETTINGS);

  // State for CLI Helper
  const [cliQuery, setCliQuery] = useState<string>('');
  const [cliVendor, setCliVendor] = useState<VendorName>(SUPPORTED_VENDORS_DATA[0].name);
  const [cliResult, setCliResult] = useState<CliCommandResponse | null>(null);
  const [isCliLoading, setIsCliLoading] = useState<boolean>(false);
  const [cliError, setCliError] = useState<string | null>(null);

  // State for Script Writer
  const [scriptWriterQuery, setScriptWriterQuery] = useState<string>('');
  const [scriptWriterVendor, setScriptWriterVendor] = useState<VendorName>(SUPPORTED_VENDORS_DATA[0].name);
  const [scriptWriterResult, setScriptWriterResult] = useState<CliScriptResponse | null>(null);
  const [isScriptWriterLoading, setIsScriptWriterLoading] = useState<boolean>(false);
  const [scriptWriterError, setScriptWriterError] = useState<string | null>(null);

  // State for Chat Agent
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatQuery, setChatQuery] = useState<string>('');
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const featureIcons: { [key: string]: React.ReactNode } = {
    ingestion: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>,
    parsing: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>,
    analysis: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    reporting: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    export: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    'cli-helper': <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>,
  };

  useEffect(() => {
    const initializeApp = async () => {
        try {
            await initDB();
            setIsDbReady(true);
            const savedSettings = localStorage.getItem('llmSettings');
            if (savedSettings) {
              setLlmSettings(JSON.parse(savedSettings));
            }
        } catch (e) {
            console.error("Failed to initialize database:", e);
            setError("Could not initialize local database.");
        }
    };
    initializeApp();
  }, []);
  
  const handleSaveSettings = (settings: LlmSettings) => {
    setLlmSettings(settings);
    localStorage.setItem('llmSettings', JSON.stringify(settings));
    setIsSettingsModalOpen(false);
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setUploadedFile(null);
    setParsedConfig(null);
    setAnalysisFindings([]);
    
    const file = event.target.files?.[0];
    if (file) {
      setIsLoading(true);
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      try {
        const content = await file.text();
        const newFile: UploadedFile = {
            id: `file-${Date.now()}`,
            name: file.name,
            content: content,
            vendor: currentVendor,
        };
        setUploadedFile(newFile);

        const newParsedConfig = await parseConfiguration(newFile);
        setParsedConfig(newParsedConfig);
      } catch (err) {
        console.error("Error parsing configuration:", err);
        setError(`Failed to parse file: ${(err as Error).message}`);
        if(fileInput) fileInput.value = '';
        setUploadedFile(null);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setParsedConfig(null);
    setAnalysisFindings([]);
    setError(null);
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if(fileInput) fileInput.value = '';
  };

  const handleRunAnalysis = useCallback(async () => {
    if (!parsedConfig) { 
      setError("Please parse a configuration file first.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const findings = await runAnalysis(parsedConfig, llmSettings);
      setAnalysisFindings(findings);
      if (isDbReady) {
        await saveFindings(findings);
      }
    } catch (err) {
      console.error("Error detecting findings:", err);
      setError(`Failed to run analysis: ${(err as Error).message}`);
    }
    setIsLoading(false);
  }, [parsedConfig, isDbReady, llmSettings]);

  const handleGetCliCommand = useCallback(async () => {
    if (!cliQuery) {
        setCliError("Please enter a command description.");
        return;
    }
    setIsCliLoading(true);
    setCliError(null);
    setCliResult(null);
    try {
        const result = await getCliCommand(cliQuery, cliVendor, llmSettings);
        setCliResult(result);
    } catch (err) {
        console.error("Error getting CLI command:", err);
        setCliError(`Failed to get command: ${(err as Error).message}`);
    } finally {
        setIsCliLoading(false);
    }
  }, [cliQuery, cliVendor, llmSettings]);

  const handleGenerateScript = useCallback(async () => {
    if (!scriptWriterQuery) {
        setScriptWriterError("Please describe the configuration you want to create.");
        return;
    }
    setIsScriptWriterLoading(true);
    setScriptWriterError(null);
    setScriptWriterResult(null);
    try {
        const result = await generateCliScript(scriptWriterQuery, scriptWriterVendor, llmSettings);
        setScriptWriterResult(result);
    } catch (err) {
        console.error("Error generating script:", err);
        setScriptWriterError(`Failed to generate script: ${(err as Error).message}`);
    } finally {
        setIsScriptWriterLoading(false);
    }
  }, [scriptWriterQuery, scriptWriterVendor, llmSettings]);
  
  const handleSendChatMessage = useCallback(async () => {
    if (!chatQuery.trim() || !analysisFindings.length) return;

    const newUserMessage: ChatMessage = { role: 'user', content: chatQuery };
    setChatHistory(prev => [...prev, newUserMessage]);
    setChatQuery('');
    setIsChatLoading(true);
    setChatError(null);

    try {
        const reportAsString = JSON.stringify(analysisFindings, null, 2);
        const response = await askAboutAnalysis(reportAsString, chatHistory, chatQuery, llmSettings);

        const newAgentMessage: ChatMessage = {
            role: 'agent',
            content: response.text,
            sources: response.sources
        };
        setChatHistory(prev => [...prev, newAgentMessage]);

    } catch (err) {
        console.error("Error with chat agent:", err);
        const errorMessage = `Chat agent failed: ${(err as Error).message}`;
        setChatError(errorMessage);
        const errorChatMessage: ChatMessage = {
            role: 'agent',
            content: `Sorry, I encountered an error. Please try again.\nError: ${errorMessage}`
        };
        setChatHistory(prev => [...prev, errorChatMessage]);

    } finally {
        setIsChatLoading(false);
    }
}, [chatQuery, analysisFindings, chatHistory, llmSettings]);


  const handleExportToHtml = () => {
    if (!parsedConfig) {
      setError("No report to export.");
      return;
    }

    const reportElement = document.getElementById('full-report-container');
    if (!reportElement) {
      setError("Could not find report content to export.");
      return;
    }
    
    const filename = `NetConfig_Full_Report_${(parsedConfig.hostname || 'report').replace(/[^a-zA-Z0-9]/g, '_')}.html`;
    
    setIsLoading(true);
    setError(null);

    try {
      const tailwindScript = `<script src="https://cdn.tailwindcss.com"><\/script>`;
      const tailwindConfig = `
      <script>
        tailwind.config = {
          theme: {
            extend: {
              colors: {
                'brand-primary': '#F97316',
                'brand-secondary': '#FB923C',
                'brand-accent': '#EF4444',
                'dark-background': '#000000',
                'medium-background': '#111827',
                'light-background': '#1F2937',
                'dark-text': '#F9FAFB',
                'medium-text': '#D1D5DB',
                'light-text': '#9CA3AF',
              }
            }
          }
        }
      <\/script>`;
      
      const fontAndBaseStyles = `
      <style>
        @font-face {
          font-family: 'Inter';
          font-style: normal;
          font-weight: 300 700;
          font-display: swap;
          src: url(https://fonts.gstatic.com/s/inter/v13/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa2ZL7W0Q.woff2) format('woff2');
          unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
        }
        body {
          font-family: 'Inter', sans-serif;
          background-color: #000000;
          color: #F9FAFB;
          padding: 2rem;
        }
        .exported-container {
            max-width: 1280px;
            margin: auto;
        }
      </style>`;

      const reportHtml = reportElement.innerHTML;
      
      const fullHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${filename.replace('.html', '')}</title>
            ${tailwindScript}
            ${tailwindConfig}
            ${fontAndBaseStyles}
        </head>
        <body class="bg-dark-background">
            <div class="exported-container">
                ${reportHtml}
            </div>
        </body>
        </html>
      `;

      const blob = new Blob([fullHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error("Failed to export to HTML:", err);
      setError(`Failed to export to HTML. Error: ${(err as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearAll = async () => {
    setUploadedFile(null);
    setParsedConfig(null);
    setAnalysisFindings([]);
    setError(null);
    setChatHistory([]);
    setChatQuery('');
    setChatError(null);
    if(isDbReady) {
        await clearFindings();
    }
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if(fileInput) fileInput.value = '';
  };
  
  const handleVendorChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setCurrentVendor(e.target.value as VendorName);
  };

  const renderFileUploadSection = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <div title="Select the network device vendor before uploading the configuration file.">
            <label htmlFor="vendor-select" className="block text-sm font-medium text-light-text mb-1">Select Vendor:</label>
            <select
                id="vendor-select"
                value={currentVendor}
                onChange={handleVendorChange}
                className="w-full bg-light-background border border-medium-background/50 text-dark-text rounded-lg p-2.5 focus:ring-brand-primary focus:border-brand-primary"
            >
                {SUPPORTED_VENDORS_DATA.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
            </select>
        </div>
        <div title="Click to browse and upload a configuration file for the selected vendor.">
            <label htmlFor="file-upload" className="block text-sm font-medium text-light-text mb-1">Upload Config & Parse ({SUPPORTED_VENDORS_DATA.find(v => v.name === currentVendor)?.extensions.join(', ')}):</label>
            <div className="flex items-center">
                <label htmlFor="file-upload" className="cursor-pointer bg-brand-primary text-white font-bold py-2 px-4 rounded-lg hover:bg-brand-secondary transition-colors">
                    Browse...
                </label>
                <input id="file-upload" type="file" className="hidden" onChange={handleFileChange} accept={SUPPORTED_VENDORS_DATA.find(v => v.name === currentVendor)?.extensions.join(',')} />
                {/* FIX: Replaced template literal with single quotes to avoid parsing issues in some toolchains. */}
                <span className="ml-3 text-light-text">{uploadedFile ? '1 file selected.' : 'No file selected.'}</span>
            </div>
        </div>
        {uploadedFile && (
          <div className="md:col-span-2">
            <h4 className="text-light-text font-semibold mb-2">Uploaded File:</h4>
            <div className="flex items-center justify-between bg-light-background/60 p-2 rounded-md">
                <div className="flex items-center gap-3">
                  <VendorLogo vendor={uploadedFile.vendor} className="h-6 w-auto" />
                  <span className="text-sm text-medium-text">{uploadedFile.name}</span>
                </div>
                <button onClick={handleRemoveFile} className="text-red-400 hover:text-red-600 font-bold text-lg">&times;</button>
            </div>
          </div>
        )}
    </div>
  );

  return (
    <div className="min-h-screen text-dark-text">
       {isSettingsModalOpen && (
        <SettingsModal
          currentSettings={llmSettings}
          onSave={handleSaveSettings}
          onClose={() => setIsSettingsModalOpen(false)}
        />
      )}
      <header className="text-center py-8 relative">
        <h1 className="text-4xl md:text-5xl font-bold text-brand-primary">{APP_TITLE}</h1>
        <p className="text-md md:text-lg text-medium-text mt-2">{APP_SUBTITLE}</p>
        <button
          onClick={() => setIsSettingsModalOpen(true)}
          className="absolute top-8 right-8 p-2 rounded-full text-medium-text hover:text-dark-text hover:bg-light-background/50 transition-colors"
          aria-label="Open settings"
          title="Configure LLM provider (Gemini, OpenAI, Ollama) and other application settings."
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/>
          </svg>
        </button>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <Section title="Core Features" className="py-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {CORE_FEATURES_DATA.map((feature) => (
                    <FeatureCard 
                        key={feature.id}
                        icon={featureIcons[feature.id] || featureIcons['parsing']}
                        title={feature.title} 
                        description={feature.description} 
                    />
                ))}
            </div>
        </Section>

        <Section title="1. Import Config & Parse" className="bg-medium-background/80">
            {renderFileUploadSection()}
             <div className="mt-6 flex flex-col md:flex-row md:justify-start gap-4">
                <button 
                  onClick={handleRunAnalysis} 
                  disabled={isLoading || !parsedConfig} 
                  className="w-full md:w-auto bg-sky-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-sky-700 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
                  title={
                    llmSettings.useLlmForAnalysis
                      ? "Sends the parsed configuration to the selected AI model for a deep audit of security, best practices, and potential issues."
                      : "Performs a fast, offline analysis using a built-in set of rules for the selected vendor."
                  }
                >
                    {/* FIX: Replaced template literal with string concatenation to avoid parsing issues. */}
                    {isLoading ? 'Analyzing...' : '2. Run ' + (llmSettings.useLlmForAnalysis ? 'AI' : 'Local') + ' Analysis'}
                </button>
                <button 
                  onClick={handleClearAll} 
                  disabled={isLoading} 
                  className="w-full md:w-auto bg-red-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
                  title="Removes the uploaded file, parsed data, and analysis results from the view."
                >
                    Clear All
                </button>
            </div>
        </Section>

        <Section title="CLI Command Helper">
          <CliHelper 
              query={cliQuery}
              onQueryChange={setCliQuery}
              vendor={cliVendor}
              onVendorChange={setCliVendor}
              onSubmit={handleGetCliCommand}
              isLoading={isCliLoading}
              error={cliError}
              result={cliResult}
          />
        </Section>

        <Section title="Automated CLI Script Writer">
          <ScriptWriter
            query={scriptWriterQuery}
            onQueryChange={setScriptWriterQuery}
            vendor={scriptWriterVendor}
            onVendorChange={setScriptWriterVendor}
            onSubmit={handleGenerateScript}
            isLoading={isScriptWriterLoading}
            error={scriptWriterError}
            result={scriptWriterResult}
          />
        </Section>


        <ErrorMessage message={error || ''} />

        {isLoading && <LoadingSpinner text={isLoading ? 'Processing...' : 'Loading...'} />}

        {parsedConfig && (
            <>
                <div className="flex justify-end mb-4">
                    <button 
                        onClick={handleExportToHtml} 
                        className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-500" 
                        disabled={isLoading}
                    >
                        {isLoading ? 'Exporting...' : (analysisFindings.length > 0 ? 'Export Full Report to HTML' : 'Export Report to HTML')}
                    </button>
                </div>
                
                <div id="full-report-container">
                    <Section title="Configuration Report">
                        <ConfigurationReport config={parsedConfig} />
                    </Section>
        
                    {analysisFindings.length > 0 && (
                        <Section title="Configuration Analysis & Recommendations">
                            {analysisFindings.map((finding) => (
                                <FindingCard key={finding.id} finding={finding} />
                            ))}
                        </Section>
                    )}
                </div>

                {analysisFindings.length > 0 && (
                    <div id="chat-agent-container" className="mt-8">
                        <Section title="Chat with Report Agent">
                            <ChatAgent 
                                chatHistory={chatHistory}
                                query={chatQuery}
                                onQueryChange={setChatQuery}
                                onSubmit={handleSendChatMessage}
                                isLoading={isChatLoading}
                                error={chatError}
                            />
                        </Section>
                    </div>
                )}
            </>
        )}
      </main>
      <footer className="text-center py-4 text-xs text-light-text">
        <p>&copy; {new Date().getFullYear()} NetConfig Analyzer. Created by an AfflictedAI.</p>
      </footer>
    </div>
  );
};

export default App;