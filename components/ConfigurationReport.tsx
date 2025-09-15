

import React, { ReactNode } from 'react';
import { ParsedConfigData, VendorName } from '../types';
import Section from './Section';
import VendorLogo from './VendorLogo';

const SimpleTable: React.FC<{ headers: string[], data: (string | number | ReactNode)[][] }> = ({ headers, data }) => (
  <div className="overflow-x-auto rounded-lg border border-light-background">
    <table className="min-w-full divide-y divide-light-background">
      <thead className="bg-light-background/80">
        <tr>
          {headers.map(header => (
            <th key={header} scope="col" className="px-4 py-3 text-left text-xs font-medium text-brand-primary uppercase tracking-wider">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="bg-medium-background/70 divide-y divide-light-background">
        {data.map((row, rowIndex) => (
          <tr key={rowIndex} className="hover:bg-light-background/50">
            {row.map((cell, cellIndex) => (
              <td key={cellIndex} className="px-4 py-3 whitespace-pre-wrap text-sm text-medium-text leading-relaxed">
                {cell}
              </td>
            ))}
          </tr>
        ))}
        {data.length === 0 && (
            <tr><td colSpan={headers.length} className="text-center py-4 text-light-text">No data available.</td></tr>
        )}
      </tbody>
    </table>
  </div>
);

const DetailItem: React.FC<{ label: string; value?: string | number | React.ReactNode }> = ({ label, value }) => {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) return null;
  return (
    <li className="flex flex-wrap"><strong className="font-semibold text-dark-text mr-2">{label}:</strong> <span className="text-medium-text">{value}</span></li>
  );
};

const RawConfigViewer: React.FC<{ title: string, configs: (string[] | undefined)[] }> = ({ title, configs }) => {
    const validConfigs = configs.filter(c => c && c.length > 0);
    if (validConfigs.length === 0) return null;

    return (
        <details className="mt-4">
            <summary className="cursor-pointer text-light-text hover:text-brand-primary text-sm">{title}</summary>
            {validConfigs.map((config, index) => (
                <pre key={index} className="mt-2 p-2 bg-dark-background rounded text-xs overflow-auto max-h-48 text-medium-text border border-light-background">
                    {config!.join('\n')}
                </pre>
            ))}
        </details>
    );
};


const ConfigurationReport: React.FC<{ config: ParsedConfigData }> = ({ config }) => {
    if (!config || !config.vendor) return <div className="text-center p-8">No configuration data to display.</div>;

    const allPorts = config.ports || [];
    // A port is considered "configured" if its config array has more than just the `interface...` line and the closing `!`
    const configuredPorts = allPorts.filter(p => p.config && p.config.length > 2);
    const unconfiguredPortsCount = allPorts.length - configuredPorts.length;

    const reportContent = (
        <>
            {/* --- RENDER LOGIC FOR DETAILED CISCO PARSED DATA --- */}
            {config.vendor === VendorName.CISCO && config.hostname ? (
                <div className="space-y-6">
                    <Section title="Device Information">
                        <div className="flex items-center gap-4">
                            <VendorLogo vendor={config.vendor} className="h-12 w-auto" />
                            <div>
                                <h3 className="text-2xl font-bold text-dark-text">{config.hostname}</h3>
                                <p className="text-sm text-light-text">{config.vendor}</p>
                            </div>
                        </div>
                        <ul className="space-y-1 text-medium-text mt-4 border-t border-light-background pt-4">
                            <DetailItem label="iOS Version" value={config.iosVersion} />
                            <DetailItem label="Model Number" value={config.modelNumber} />
                        </ul>
                    </Section>
                    <Section title="VLANs and Names">
                        <SimpleTable headers={["VLAN ID", "Name"]} data={config.vlans?.map(v => [v.id, v.name]) || []} />
                        <RawConfigViewer title="Show Raw VLAN Configs" configs={config.vlans?.map(v => v.rawConfig) || []} />
                    </Section>
                    {config.ipRanges && config.ipRanges.length > 0 && (
                        <Section title="Available IP Ranges">
                            <SimpleTable 
                                headers={["VLAN", "Network Address", "Usable IP Range", "Broadcast", "Subnet Mask", "Gateway", "Total IPs", "Usable IPs"]} 
                                data={config.ipRanges.map(r => [r.vlanId, r.network, r.usableRange, r.broadcast, r.subnetMask, r.gateway, r.totalAddresses, r.usableAddresses])} 
                            />
                        </Section>
                    )}
                    <Section title="SVIs and Assigned IPs">
                        <SimpleTable headers={["SVI", "IP Address", "Subnet Mask", "IP Helper-Address", "Status", "Additional Info"]} data={config.svis?.map(s => [s.svi, s.ipAddress, s.subnetMask, s.ipHelperAddress, s.status, s.additionalInfo]) || []} />
                        <RawConfigViewer title="Show Raw SVI Configs" configs={config.svis?.map(s => s.rawConfig) || []} />
                    </Section>
                    <Section title="Uplinks and Port Channels">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h4 className="font-semibold text-dark-text mb-2 border-b border-light-background pb-1">Uplinks</h4>
                                {(config.uplinks && config.uplinks.length > 0) ? (
                                    <ul className="list-disc list-inside space-y-1">
                                        {config.uplinks.map(uplinkName => {
                                            const portInfo = config.ports?.find(p => p.port === uplinkName);
                                            return (
                                                <li key={uplinkName} className="text-medium-text">
                                                    {uplinkName}
                                                    {portInfo?.description && <span className="text-light-text italic ml-2">- {portInfo.description}</span>}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                ) : <p className="text-light-text">None detected</p>}
                            </div>
                            <div>
                                <h4 className="font-semibold text-dark-text mb-2 border-b border-light-background pb-1">Port Channels</h4>
                                {(config.portChannels && config.portChannels.length > 0) ? (
                                    <ul className="list-disc list-inside space-y-1">
                                        {config.portChannels.map(pcName => {
                                            const portInfo = config.ports?.find(p => p.port === pcName);
                                            return (
                                                <li key={pcName} className="text-medium-text">
                                                    {pcName}
                                                    {portInfo?.description && <span className="text-light-text italic ml-2">- {portInfo.description}</span>}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                ) : <p className="text-light-text">None detected</p>}
                            </div>
                        </div>
                    </Section>
                    <Section title="Port Configurations">
                        <SimpleTable 
                            headers={["Port(s)", "Type", "Description", "Status", "Members"]} 
                            data={configuredPorts.map(p => [p.port, p.type, p.description, p.status, p.members.join(', ')])} 
                        />
                        {unconfiguredPortsCount > 0 && (
                            <p className="text-right text-sm text-light-text mt-2 italic">
                                And {unconfiguredPortsCount} other port(s) with default configuration.
                            </p>
                        )}
                        <RawConfigViewer title="Show Raw Configs for Listed Ports" configs={configuredPorts.map(p => p.config)} />
                    </Section>
                    <Section title="Routing Information">
                         <ul className="space-y-1">
                            <DetailItem label="Default Gateway" value={config.routing?.defaultGateway || 'Not configured'} />
                            <DetailItem label="Default Route" value={config.routing?.defaultRoute || 'Not configured'} />
                        </ul>
                    </Section>
                    <Section title="OSPF Configuration">
                        {config.ospf?.status === 'Configured' ? (
                            <>
                                <ul className="space-y-2 mb-4">
                                    <DetailItem label="Process ID" value={config.ospf.processId} />
                                    <DetailItem label="Router ID" value={config.ospf.routerId} />
                                </ul>

                                <h4 className="font-semibold text-dark-text mb-2 border-b border-light-background pb-1 mt-4">Advertised Networks</h4>
                                <SimpleTable 
                                    headers={["Network", "Wildcard Mask", "Area"]} 
                                    data={config.ospf.networks?.map(n => [n.network, n.wildcard, n.area]) || []} 
                                />

                                <h4 className="font-semibold text-dark-text mb-2 border-b border-light-background pb-1 mt-4">Passive Interfaces</h4>
                                {(config.ospf.passiveInterfaces && config.ospf.passiveInterfaces.length > 0) ? (
                                    <ul className="list-disc list-inside space-y-1 text-medium-text">
                                        {config.ospf.passiveInterfaces.map(iface => <li key={iface}>{iface}</li>)}
                                    </ul>
                                ) : <p className="text-light-text">None</p>}
                                
                                {config.ospf.details && config.ospf.details.length > 0 && (
                                   <>
                                     <h4 className="font-semibold text-dark-text mb-2 border-b border-light-background pb-1 mt-4">Other OSPF Details</h4>
                                      <ul className="list-disc list-inside space-y-1 text-medium-text">
                                          {config.ospf.details.map((d, i) => <li key={i}>{d}</li>)}
                                      </ul>
                                   </>
                                )}
                            </>
                        ) : <p className="text-light-text">Not configured</p>}
                        <RawConfigViewer title="Show Raw OSPF Config" configs={[config.ospf?.rawConfig]} />
                    </Section>
                    <Section title="Security Compliance">
                         <ul className="space-y-2">
                            <li><strong className="text-green-400">Present:</strong> {config.security?.present.join(', ') || 'None'}</li>
                            <li><strong className="text-yellow-400">Missing (Recommended):</strong> {config.security?.missing.join(', ') || 'None'}</li>
                        </ul>
                    </Section>
                    <Section title="DHCP, DNS, AAA, SNMP">
                         <ul className="space-y-4">
                            <li><strong className="text-dark-text">DNS Servers:</strong> {config.other?.dnsServers || 'N/A'}</li>
                            <li><strong className="text-dark-text">Domain Name:</strong> {config.other?.domain || 'N/A'}</li>
                            <li>
                                <strong className="text-dark-text">AAA Config:</strong>
                                <ul className="list-disc list-inside ml-4 mt-1">{config.aaa?.details.map((d,i) => <li key={i}>{d}</li>) || <li>{config.aaa?.status}</li>}</ul>
                            </li>
                             <li>
                                <strong className="text-dark-text">SNMP Config:</strong>
                                <ul className="list-disc list-inside ml-4 mt-1">{config.snmp?.details.map((d,i) => <li key={i}>{d}</li>) || <li>{config.snmp?.status}</li>}</ul>
                            </li>
                        </ul>
                         <RawConfigViewer title="Show Raw DHCP Pool Configs" configs={config.dhcpPools?.map(d => d.config) || []} />
                    </Section>
                    <Section title="Available Connections (VTY/Console)">
                        <SimpleTable 
                            headers={["Line", "Type", "Description", "Associated Usernames"]} 
                            data={config.connections?.map(c => [
                                `${c.type} ${c.range}`, 
                                c.type, 
                                c.description || '-',
                                c.usernames.join(', ')
                            ]) || []} 
                        />
                        <RawConfigViewer title="Show Raw Line Configs" configs={config.connections?.map(c => c.config) || []} />
                    </Section>
                    <Section title="Raw Configuration (Full)">
                         <details>
                            <summary className="cursor-pointer text-sm text-light-text hover:text-brand-primary">Show Full Raw Configuration</summary>
                            <pre className="mt-2 p-2 bg-dark-background rounded text-xs overflow-auto max-h-96 text-medium-text border border-light-background">
                                {config.rawConfig || 'N/A'}
                            </pre>
                         </details>
                    </Section>
                </div>
            ) : (
                // --- FALLBACK RENDER FOR GEMINI-PARSED DATA ---
                <Section title="Configuration Summary">
                    <div className="flex items-center gap-4 mb-4">
                        <VendorLogo vendor={config.vendor} className="h-12 w-auto" />
                        <div>
                            <h3 className="text-2xl font-bold text-dark-text">{config.deviceInfo?.hostname || config.fileName}</h3>
                            <p className="text-sm text-light-text">{config.vendor}</p>
                        </div>
                    </div>
                    <p className="text-light-text mb-4">This is a summary view. Detailed reporting is available for Cisco configs.</p>
                    <pre className="p-4 bg-medium-background/70 rounded-lg text-sm text-medium-text overflow-auto">
                        {JSON.stringify({
                            deviceInfo: config.deviceInfo,
                            interfaces: config.interfaces,
                            vlansSvis: config.vlansSvis,
                            routingProtocols: config.routingProtocols,
                            securityFeatures: config.securityFeatures,
                        }, null, 2)}
                    </pre>
                </Section>
            )}
        </>
    );
    
    return (
        <div id="config-report-content">
            {reportContent}
        </div>
    );
};

export default ConfigurationReport;