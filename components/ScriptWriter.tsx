import React, { useState, useId } from 'react';
import { VendorName, CliScriptResponse } from '../types';
import { SUPPORTED_VENDORS_DATA } from '../constants';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';

interface ScriptWriterProps {
  query: string;
  onQueryChange: (query: string) => void;
  vendor: VendorName;
  onVendorChange: (vendor: VendorName) => void;
  onSubmit: () => void;
  isLoading: boolean;
  error: string | null;
  result: CliScriptResponse | null;
}

interface FormVlan {
  key: string;
  id: string;
  name: string;
}

interface FormSvi {
  key: string;
  vlanId: string;
  ip: string;
  mask: string;
  description: string;
  enabled: boolean;
}

interface FormInterfaceRange {
    key: string;
    range: string;
    description: string;
    mode: 'access' | 'trunk';
    accessVlan?: string;
    trunkVlans?: string;
    portfast?: boolean;
    bpduguard?: boolean;
    portsecurity?: boolean;
}

const initialVlanState = (): FormVlan => ({ key: crypto.randomUUID(), id: '', name: '' });
const initialSviState = (): FormSvi => ({ key: crypto.randomUUID(), vlanId: '', ip: '', mask: '', description: '', enabled: true });
const initialInterfaceState = (): FormInterfaceRange => ({ key: crypto.randomUUID(), range: '', description: '', mode: 'access', accessVlan: '', trunkVlans: '', portfast: true, bpduguard: true, portsecurity: false });

const ScriptWriter: React.FC<ScriptWriterProps> = ({
  query,
  onQueryChange,
  vendor,
  onVendorChange,
  onSubmit,
  isLoading,
  error,
  result,
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const [isSaveCommandCopied, setIsSaveCommandCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'form' | 'manual'>('form');

  // Form State
  const [hostname, setHostname] = useState('');
  const [enablePasswordEncryption, setEnablePasswordEncryption] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [vlans, setVlans] = useState<FormVlan[]>([]);
  const [svis, setSvis] = useState<FormSvi[]>([]);
  const [interfaces, setInterfaces] = useState<FormInterfaceRange[]>([]);
  const [defaultGateway, setDefaultGateway] = useState('');
  const [dnsServers, setDnsServers] = useState('');
  const [ntpServers, setNtpServers] = useState('');
  const formId = useId();

  const handleCopy = () => {
    if (result?.script) {
      navigator.clipboard.writeText(result.script).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      });
    }
  };

  const handleSaveScript = () => {
    if (!result?.script) return;
    const blob = new Blob([result.script], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const scriptHostname = hostname || 'config';
    const vendorExtension = vendor === VendorName.JUNIPER ? 'conf' : 'cfg';
    link.download = `${scriptHostname}_${new Date().toISOString().split('T')[0]}.${vendorExtension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getSaveCommand = (vendor: VendorName): string => {
      switch (vendor) {
          case VendorName.CISCO:
              return 'write memory';
          case VendorName.JUNIPER:
              return 'commit';
          case VendorName.HUAWEI:
          case VendorName.H3C:
              return 'save';
          default:
              return 'copy running-config startup-config';
      }
  }

  const handleCopySaveCommand = () => {
      const command = getSaveCommand(vendor);
      navigator.clipboard.writeText(command).then(() => {
          setIsSaveCommandCopied(true);
          setTimeout(() => setIsSaveCommandCopied(false), 2000);
      });
  }

  const updateListItem = <T,>(list: T[], setList: React.Dispatch<React.SetStateAction<T[]>>, key: string, field: keyof T, value: any) => {
    setList(list.map(item => (item as any).key === key ? { ...item, [field]: value } : item));
  };
  const addListItem = <T,>(setList: React.Dispatch<React.SetStateAction<T[]>>, initialState: T) => setList(prev => [...prev, initialState]);
  const removeListItem = <T,>(list: T[], setList: React.Dispatch<React.SetStateAction<T[]>>, key: string) => setList(list.filter(item => (item as any).key !== key));

  const generatePromptFromForm = (): string => {
    const parts: string[] = [];
    if (hostname) parts.push(`Set the hostname to "${hostname}".`);
    if (enablePasswordEncryption) parts.push("Enable service password-encryption.");
    if (username && password) parts.push(`Create a user named "${username}" with a secret password of "${password}".`);
    
    vlans.forEach(v => {
      if (v.id) parts.push(`Create VLAN ${v.id}${v.name ? ` named "${v.name}"` : ''}.`);
    });

    svis.forEach(s => {
      if (s.vlanId && s.ip && s.mask) {
        let sviStr = `Configure interface Vlan${s.vlanId} with IP address ${s.ip} ${s.mask}`;
        if (s.description) sviStr += ` and a description of "${s.description}"`;
        sviStr += s.enabled ? " and enable it (no shutdown)." : " and disable it (shutdown).";
        parts.push(sviStr);
      }
    });

    interfaces.forEach(i => {
        if (i.range) {
            const configParts: string[] = [];
            if (i.description) configParts.push(`description "${i.description}"`);
            if (i.mode === 'access') {
                configParts.push(`switchport mode access`);
                if(i.accessVlan) configParts.push(`switchport access vlan ${i.accessVlan}`);
            } else {
                configParts.push(`switchport mode trunk`);
                if (i.trunkVlans) configParts.push(`switchport trunk allowed vlan ${i.trunkVlans}`);
            }
            if (i.portfast) configParts.push('spanning-tree portfast');
            if (i.bpduguard) configParts.push('spanning-tree bpduguard enable');
            if (i.portsecurity) configParts.push('switchport port-security');

            if (configParts.length > 0) {
                parts.push(`For the interface range ${i.range}, apply these settings: ${configParts.join(', ')}.`);
            }
        }
    });

    if (defaultGateway) parts.push(`Set the default gateway to ${defaultGateway}.`);
    if (dnsServers) parts.push(`Set the DNS name servers to ${dnsServers}.`);
    if (ntpServers) parts.push(`Set the NTP servers to ${ntpServers}.`);

    return parts.join(' ');
  }

  const handleGenerateScript = () => {
    if (activeTab === 'form') {
        const prompt = generatePromptFromForm();
        if(!prompt) return; // Don't submit if form is empty
        onQueryChange(prompt);
        // Defer submission to next tick to allow parent state to update
        setTimeout(onSubmit, 0);
    } else {
        if (!query) return;
        onSubmit();
    }
  };

  const renderForm = () => (
    <div className="space-y-6">
        {/* --- Device Basics --- */}
        <div className="p-4 bg-light-background/30 rounded-lg border border-medium-background/30">
            <h4 className="font-semibold text-dark-text mb-3">Device Basics</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor={`${formId}-hostname`} className="block text-sm font-medium text-light-text mb-1">Hostname</label>
                    <input id={`${formId}-hostname`} type="text" value={hostname} onChange={e => setHostname(e.target.value)} placeholder="e.g., CORE-SW-01" className="w-full bg-light-background border border-medium-background/50 text-dark-text rounded-lg p-2 focus:ring-brand-primary focus:border-brand-primary" />
                </div>
                 <div>
                    <label htmlFor={`${formId}-default-gateway`} className="block text-sm font-medium text-light-text mb-1">Default Gateway</label>
                    <input id={`${formId}-default-gateway`} type="text" value={defaultGateway} onChange={e => setDefaultGateway(e.target.value)} placeholder="e.g., 192.168.1.254" className="w-full bg-light-background border border-medium-background/50 text-dark-text rounded-lg p-2 focus:ring-brand-primary focus:border-brand-primary" />
                </div>
            </div>
        </div>

        {/* --- Security --- */}
        <div className="p-4 bg-light-background/30 rounded-lg border border-medium-background/30">
            <h4 className="font-semibold text-dark-text mb-3">Security</h4>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor={`${formId}-username`} className="block text-sm font-medium text-light-text mb-1">Admin Username</label>
                    <input id={`${formId}-username`} type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g., admin" className="w-full bg-light-background border border-medium-background/50 text-dark-text rounded-lg p-2 focus:ring-brand-primary focus:border-brand-primary" />
                </div>
                 <div>
                    <label htmlFor={`${formId}-password`} className="block text-sm font-medium text-light-text mb-1">Admin Password</label>
                    <input id={`${formId}-password`} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Use a strong password" className="w-full bg-light-background border border-medium-background/50 text-dark-text rounded-lg p-2 focus:ring-brand-primary focus:border-brand-primary" />
                </div>
            </div>
             <div className="mt-4">
                <label className="flex items-center gap-2 text-sm text-light-text">
                    <input type="checkbox" checked={enablePasswordEncryption} onChange={e => setEnablePasswordEncryption(e.target.checked)} className="rounded bg-light-background border-medium-background/50 text-brand-primary focus:ring-brand-primary" />
                    Enable Password Encryption (`service password-encryption`)
                </label>
            </div>
        </div>
        
        {/* --- VLANs & SVIs --- */}
        <div className="p-4 bg-light-background/30 rounded-lg border border-medium-background/30 space-y-4">
            <div>
                <h4 className="font-semibold text-dark-text mb-2">VLANs</h4>
                {vlans.map((vlan, index) => (
                    <div key={vlan.key} className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2 items-center">
                        <input type="number" value={vlan.id} onChange={e => updateListItem(vlans, setVlans, vlan.key, 'id', e.target.value)} placeholder="VLAN ID" className="bg-light-background border border-medium-background/50 text-dark-text rounded-lg p-2" />
                        <input type="text" value={vlan.name} onChange={e => updateListItem(vlans, setVlans, vlan.key, 'name', e.target.value)} placeholder="VLAN Name" className="bg-light-background border border-medium-background/50 text-dark-text rounded-lg p-2" />
                        <button onClick={() => removeListItem(vlans, setVlans, vlan.key)} className="text-red-400 hover:text-red-600 font-bold justify-self-start md:justify-self-center">&times; Remove</button>
                    </div>
                ))}
                <button onClick={() => addListItem(setVlans, initialVlanState())} className="text-sm py-1 px-3 mt-2 rounded bg-sky-600/50 hover:bg-sky-600 transition-colors">+ Add VLAN</button>
            </div>
             <div className="border-t border-medium-background/30 pt-4">
                <h4 className="font-semibold text-dark-text mb-2">SVIs (VLAN Interfaces)</h4>
                 {svis.map((svi, index) => (
                    <div key={svi.key} className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2 items-center">
                        <input type="number" value={svi.vlanId} onChange={e => updateListItem(svis, setSvis, svi.key, 'vlanId', e.target.value)} placeholder="VLAN ID" className="bg-light-background border border-medium-background/50 text-dark-text rounded-lg p-2" />
                        <input type="text" value={svi.ip} onChange={e => updateListItem(svis, setSvis, svi.key, 'ip', e.target.value)} placeholder="IP Address" className="bg-light-background border border-medium-background/50 text-dark-text rounded-lg p-2" />
                        <input type="text" value={svi.mask} onChange={e => updateListItem(svis, setSvis, svi.key, 'mask', e.target.value)} placeholder="Subnet Mask" className="bg-light-background border border-medium-background/50 text-dark-text rounded-lg p-2" />
                        <button onClick={() => removeListItem(svis, setSvis, svi.key)} className="text-red-400 hover:text-red-600 font-bold justify-self-start md:justify-self-center">&times; Remove</button>
                    </div>
                ))}
                <button onClick={() => addListItem(setSvis, initialSviState())} className="text-sm py-1 px-3 mt-2 rounded bg-sky-600/50 hover:bg-sky-600 transition-colors">+ Add SVI</button>
            </div>
        </div>

        {/* --- Interface Config --- */}
        <div className="p-4 bg-light-background/30 rounded-lg border border-medium-background/30 space-y-4">
             <h4 className="font-semibold text-dark-text">Interface Configuration</h4>
             {interfaces.map((iface, index) => (
                <div key={iface.key} className="p-3 bg-dark-background/30 rounded-lg border border-medium-background/20 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
                        <input type="text" value={iface.range} onChange={e => updateListItem(interfaces, setInterfaces, iface.key, 'range', e.target.value)} placeholder="e.g., Gig1/0/1-24" className="md:col-span-2 bg-light-background border-medium-background/50 rounded-lg p-2" />
                        <select value={iface.mode} onChange={e => updateListItem(interfaces, setInterfaces, iface.key, 'mode', e.target.value)} className="bg-light-background border-medium-background/50 rounded-lg p-2">
                            <option value="access">Access</option>
                            <option value="trunk">Trunk</option>
                        </select>
                        <button onClick={() => removeListItem(interfaces, setInterfaces, iface.key)} className="text-red-400 hover:text-red-600 font-bold justify-self-start md:justify-self-center">&times; Remove Range</button>
                    </div>
                    <input type="text" value={iface.description} onChange={e => updateListItem(interfaces, setInterfaces, iface.key, 'description', e.target.value)} placeholder="Description (e.g., User Ports)" className="w-full bg-light-background border-medium-background/50 rounded-lg p-2" />
                     {iface.mode === 'access' ? (
                        <input type="number" value={iface.accessVlan} onChange={e => updateListItem(interfaces, setInterfaces, iface.key, 'accessVlan', e.target.value)} placeholder="Access VLAN ID" className="w-full bg-light-background border-medium-background/50 rounded-lg p-2" />
                    ) : (
                        <input type="text" value={iface.trunkVlans} onChange={e => updateListItem(interfaces, setInterfaces, iface.key, 'trunkVlans', e.target.value)} placeholder="Allowed VLANs (e.g., 10,20,30-40)" className="w-full bg-light-background border-medium-background/50 rounded-lg p-2" />
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                        <label className="flex items-center gap-2"><input type="checkbox" checked={iface.portfast} onChange={e => updateListItem(interfaces, setInterfaces, iface.key, 'portfast', e.target.checked)} className="rounded bg-light-background text-brand-primary" /> PortFast</label>
                        <label className="flex items-center gap-2"><input type="checkbox" checked={iface.bpduguard} onChange={e => updateListItem(interfaces, setInterfaces, iface.key, 'bpduguard', e.target.checked)} className="rounded bg-light-background text-brand-primary" /> BPDU Guard</label>
                        <label className="flex items-center gap-2"><input type="checkbox" checked={iface.portsecurity} onChange={e => updateListItem(interfaces, setInterfaces, iface.key, 'portsecurity', e.target.checked)} className="rounded bg-light-background text-brand-primary" /> Port Security</label>
                    </div>
                </div>
             ))}
             <button onClick={() => addListItem(setInterfaces, initialInterfaceState())} className="text-sm py-1 px-3 mt-2 rounded bg-sky-600/50 hover:bg-sky-600 transition-colors">+ Add Interface Range</button>
        </div>

        {/* --- Services --- */}
         <div className="p-4 bg-light-background/30 rounded-lg border border-medium-background/30">
            <h4 className="font-semibold text-dark-text mb-3">Core Services</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor={`${formId}-dns`} className="block text-sm font-medium text-light-text mb-1">DNS Servers</label>
                    <input id={`${formId}-dns`} type="text" value={dnsServers} onChange={e => setDnsServers(e.target.value)} placeholder="e.g., 8.8.8.8" className="w-full bg-light-background border border-medium-background/50 text-dark-text rounded-lg p-2 focus:ring-brand-primary focus:border-brand-primary" />
                </div>
                 <div>
                    <label htmlFor={`${formId}-ntp`} className="block text-sm font-medium text-light-text mb-1">NTP Servers</label>
                    <input id={`${formId}-ntp`} type="text" value={ntpServers} onChange={e => setNtpServers(e.target.value)} placeholder="e.g., pool.ntp.org" className="w-full bg-light-background border border-medium-background/50 text-dark-text rounded-lg p-2 focus:ring-brand-primary focus:border-brand-primary" />
                </div>
            </div>
        </div>

    </div>
  )

  const renderManual = () => (
    <div className="space-y-4">
      <p className="text-light-text">Describe the configuration you need, and the AI will generate a complete, ordered CLI script for the selected vendor.</p>
      <div className="md:col-span-2">
          <label htmlFor="script-writer-query" className="block text-sm font-medium text-light-text mb-1">Desired configuration:</label>
          <textarea
              id="script-writer-query"
              rows={4}
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="e.g., Set hostname to CORE-SW-01. Create VLAN 10 named SERVERS. Configure interface VLAN 10 with IP 10.1.10.1/24 and enable it."
              className="w-full bg-light-background border border-medium-background/50 text-dark-text rounded-lg p-2.5 focus:ring-brand-primary focus:border-brand-primary"
          />
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
        {/* Vendor Selector */}
        <div>
            <label htmlFor="script-writer-vendor-select" className="block text-sm font-medium text-light-text mb-1">Target Vendor:</label>
            <select
                id="script-writer-vendor-select"
                value={vendor}
                onChange={(e) => onVendorChange(e.target.value as VendorName)}
                className="w-full md:w-1/3 bg-light-background border border-medium-background/50 text-dark-text rounded-lg p-2.5 focus:ring-brand-primary focus:border-brand-primary"
            >
                {SUPPORTED_VENDORS_DATA.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
            </select>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-medium-background/50">
            <button onClick={() => setActiveTab('form')} className={`py-2 px-4 text-sm font-medium ${activeTab === 'form' ? 'border-b-2 border-brand-primary text-brand-primary' : 'text-light-text hover:text-dark-text'}`}>
                Quick Setup
            </button>
            <button onClick={() => setActiveTab('manual')} className={`py-2 px-4 text-sm font-medium ${activeTab === 'manual' ? 'border-b-2 border-brand-primary text-brand-primary' : 'text-light-text hover:text-dark-text'}`}>
                Advanced Input
            </button>
        </div>

        {/* Content */}
        <div className="mt-4">
            {activeTab === 'form' ? renderForm() : renderManual()}
        </div>
      
      <button
        onClick={handleGenerateScript}
        disabled={isLoading}
        className="w-full md:w-auto bg-green-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Generating Script...' : 'Generate Script'}
      </button>

      {isLoading && <LoadingSpinner text="Writing script..." />}
      <ErrorMessage message={error || ''} />
      
      {result && (
        <div className="mt-4 p-4 bg-light-background/50 rounded-lg border border-medium-background/50">
            <div className="flex flex-wrap gap-2 justify-between items-center mb-2">
              <h4 className="font-semibold text-dark-text">Generated Script:</h4>
              <div className="flex flex-wrap items-center gap-2">
                 <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 text-sm py-1 px-3 rounded text-gray-300 hover:text-white bg-gray-600/50 hover:bg-gray-600 transition-colors"
                    aria-label="Copy script"
                >
                    {isCopied ? (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          Copied!
                        </>
                    ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                          Copy Script
                        </>
                    )}
                </button>
                 <button
                    onClick={handleSaveScript}
                    className="flex items-center gap-2 text-sm py-1 px-3 rounded text-gray-300 hover:text-white bg-gray-600/50 hover:bg-gray-600 transition-colors"
                    aria-label="Save script to file"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Save Script
                </button>
                <button
                    onClick={handleCopySaveCommand}
                    className="flex items-center gap-2 text-sm py-1 px-3 rounded text-gray-300 hover:text-white bg-gray-600/50 hover:bg-gray-600 transition-colors"
                    aria-label="Copy save command"
                >
                    {isSaveCommandCopied ? (
                         <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          Copied!
                        </>
                    ) : (
                        <>
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                           Copy Save Cmd
                        </>
                    )}
                </button>
              </div>
            </div>
            <pre className="p-3 bg-dark-background rounded text-sm text-cyan-200 font-mono whitespace-pre-wrap break-words max-h-96 overflow-auto">
                <code>{result.script}</code>
            </pre>
        </div>
      )}
    </div>
  );
};

export default ScriptWriter;