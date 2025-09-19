import React, { useState, useCallback, ChangeEvent, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { APP_TITLE, APP_SUBTITLE, SUPPORTED_VENDORS_DATA, PIE_CHART_DATA, CORE_FEATURES_DATA, GEMINI_TEXT_MODEL } from './constants';
import { UploadedFile, ParsedConfigData, AnalysisFinding, VendorName, PieChartData, CliCommandResponse, CliScriptResponse } from './types';
import { parseConfiguration } from './services/parserService';
import { analyzeConfigurations, getCliCommand, generateCliScript } from './services/aiService';
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
import Settings from './components/Settings';

declare var jspdf: any;
declare var htmlToImage: any;

const App: React.FC = () => {
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [parsedConfig, setParsedConfig] = useState<ParsedConfigData | null>(null);
  const [analysisFindings, setAnalysisFindings] = useState<AnalysisFinding[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentVendor, setCurrentVendor] = useState<VendorName>(SUPPORTED_VENDORS_DATA[0].name);
  const [isDbReady, setIsDbReady] = useState(false);

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
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [useAiParsing, setUseAiParsing] = useState<boolean>(false);

  useEffect(() => {
    const storedUseAiParsing = localStorage.getItem('useAiParsing');
    if (storedUseAiParsing) {
      setUseAiParsing(storedUseAiParsing === 'true');
    }
  }, [isSettingsOpen]);

  const featureIcons: { [key: string]: React.ReactNode } = {
    ingestion: <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>,
    parsing: <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>,
    analysis: <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    reporting: <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    export: <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    'cli-helper': <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>,
  };

  useEffect(() => {
    const initializeApp = async () => {
        try {
            await initDB();
            setIsDbReady(true);
            // Do not load previous findings to ensure a clean start
        } catch (e) {
            console.error("Failed to initialize database:", e);
            setError("Could not initialize local database.");
        }
    };
    initializeApp();
  }, []);

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

        const newParsedConfig = await parseConfiguration(newFile, useAiParsing);
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
      const findings = await analyzeConfigurations([parsedConfig]);
      setAnalysisFindings(findings);
      if (isDbReady) {
        await saveFindings(findings);
      }
    } catch (err) {
      console.error("Error detecting findings:", err);
      setError(`Failed to run analysis: ${(err as Error).message}`);
    }
    setIsLoading(false);
  }, [parsedConfig, isDbReady]);

  const handleGetCliCommand = useCallback(async () => {
    if (!cliQuery) {
        setCliError("Please enter a command description.");
        return;
    }
    setIsCliLoading(true);
    setCliError(null);
    setCliResult(null);
    try {
        const result = await getCliCommand(cliQuery, cliVendor);
        setCliResult(result);
    } catch (err) {
        console.error("Error getting CLI command:", err);
        setCliError(`Failed to get command: ${(err as Error).message}`);
    } finally {
        setIsCliLoading(false);
    }
  }, [cliQuery, cliVendor]);

  const handleGenerateScript = useCallback(async () => {
    if (!scriptWriterQuery) {
        setScriptWriterError("Please describe the configuration you want to create.");
        return;
    }
    setIsScriptWriterLoading(true);
    setScriptWriterError(null);
    setScriptWriterResult(null);
    try {
        const result = await generateCliScript(scriptWriterQuery, scriptWriterVendor);
        setScriptWriterResult(result);
    } catch (err) {
        console.error("Error generating script:", err);
        setScriptWriterError(`Failed to generate script: ${(err as Error).message}`);
    } finally {
        setIsScriptWriterLoading(false);
    }
  }, [scriptWriterQuery, scriptWriterVendor]);

  const handleExport = async (elementId: string, filename: string, orientation: 'p' | 'l' = 'p') => {
    const reportElement = document.getElementById(elementId);
    if (!reportElement) {
        setError(`Could not find content with ID: ${elementId}`);
        return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
        const dataUrl = await htmlToImage.toPng(reportElement, { 
            quality: 0.98,
            backgroundColor: '#111827',
            pixelRatio: 2,
        });
        
        const { jsPDF } = jspdf;
        const pdf = new jsPDF({
            orientation: orientation,
            unit: 'pt',
            format: 'a4'
        });

        const img = new Image();
        img.src = dataUrl;
        await new Promise((resolve, reject) => { 
            img.onload = resolve;
            img.onerror = reject;
        });

        const imgWidth = img.width;
        const imgHeight = img.height;
        
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        const ratio = pdfWidth / imgWidth;
        const scaledImgHeight = imgHeight * ratio;

        let heightLeft = scaledImgHeight;
        let position = 0;

        pdf.addImage(dataUrl, 'PNG', 0, position, pdfWidth, scaledImgHeight);
        heightLeft -= pdfHeight;

        while (heightLeft > 0) {
            position -= pdfHeight;
            pdf.addPage();
            pdf.addImage(dataUrl, 'PNG', 0, position, pdfWidth, scaledImgHeight);
            heightLeft -= pdfHeight;
        }
        
        pdf.save(filename);
        
    } catch (err) {
        console.error("Failed to export to PDF:", err);
        setError(`Failed to export to PDF. Error: ${(err as Error).message}`);
    } finally {
        setIsLoading(false);
    }
  };

  const handleExportToPdf = () => {
    if (!parsedConfig) {
      setError("No report to export.");
      return;
    };
    const filename = `NetConfig_Full_Report_${(parsedConfig.hostname || 'report').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    handleExport('full-report-container', filename, 'p');
  };

  const handleClearAll = async () => {
    setUploadedFile(null);
    setParsedConfig(null);
    setAnalysisFindings([]);
    setError(null);
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
        <div>
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
        <div>
            <label htmlFor="file-upload" className="block text-sm font-medium text-light-text mb-1">Upload Config & Parse ({SUPPORTED_VENDORS_DATA.find(v => v.name === currentVendor)?.extensions.join(', ')}):</label>
            <div className="flex items-center">
                <label htmlFor="file-upload" className="cursor-pointer bg-brand-primary text-white font-bold py-2 px-4 rounded-lg hover:bg-brand-secondary transition-colors">
                    Browse...
                </label>
                <input id="file-upload" type="file" className="hidden" onChange={handleFileChange} accept={SUPPORTED_VENDORS_DATA.find(v => v.name === currentVendor)?.extensions.join(',')} />
                <span className="ml-3 text-light-text">{uploadedFile ? `1 file selected.` : 'No file selected.'}</span>
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
      <header className="text-center py-8 relative">
        <h1 className="text-4xl md:text-5xl font-bold text-brand-primary">{APP_TITLE}</h1>
        <p className="text-md md:text-lg text-medium-text mt-2">{APP_SUBTITLE}</p>
        <button onClick={() => setIsSettingsOpen(true)} className="absolute top-4 right-4 bg-gray-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors">
            Settings
        </button>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {isSettingsOpen && <Settings onClose={() => setIsSettingsOpen(false)} />}
        <Section title="1. Import Config & Parse" className="bg-medium-background/80">
            {renderFileUploadSection()}
             <div className="mt-6 flex flex-col md:flex-row md:justify-start gap-4">
                <button onClick={handleRunAnalysis} disabled={isLoading || !parsedConfig} className="w-full md:w-auto bg-sky-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-sky-700 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed">
                    {isLoading ? 'Analyzing...' : '2. Run Analysis'}
                </button>
                <button onClick={handleClearAll} disabled={isLoading} className="w-full md:w-auto bg-red-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed">
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
                        onClick={handleExportToPdf} 
                        className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-500" 
                        disabled={isLoading}
                    >
                        {isLoading ? 'Exporting...' : (analysisFindings.length > 0 ? 'Export Full Report to PDF' : 'Export Report to PDF')}
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
            </>
        )}

        {parsedConfig === null && analysisFindings.length === 0 && !isLoading && (
            <Section title="System Architecture & Features">
                <h3 className="text-xl font-semibold text-center text-dark-text mb-6">Core Features</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
        )}
      </main>
      <footer className="text-center py-4 text-xs text-light-text">
        <p>&copy; {new Date().getFullYear()} NetConfig Analyzer. Created by an AI agent.</p>
      </footer>
    </div>
  );
};

export default App;