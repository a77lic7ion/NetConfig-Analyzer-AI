import { ParsedConfigData, AnalysisFinding } from '../types';

export const analyzeH3cConfig = (config: ParsedConfigData): AnalysisFinding[] => {
    const findings: AnalysisFinding[] = [];
    const fileName = config.fileName || 'the device';

    // Check 1: Missing Interface Descriptions
    const interfacesWithoutDescription = (config.ports || [])
        .filter(p => p.status?.toLowerCase() !== 'down' && !p.port.toLowerCase().startsWith('bridge-aggregation') && !p.description);

    interfacesWithoutDescription.forEach(iface => {
        findings.push({
            id: `h3c_bp_no_desc_${iface.port.replace(/[^a-zA-Z0-9]/g, '')}`,
            type: 'Best Practice',
            severity: 'Low',
            description: `Interface ${iface.port} is active but missing a description.`,
            devicesInvolved: [fileName],
            details: { interface: iface.port, status: iface.status },
            recommendation: 'Add a descriptive label to all active interfaces to aid in network management and troubleshooting.',
            remediationCommands: [
                { command: 'system-view', context: 'Enter system view.' },
                { command: `interface ${iface.port}`, context: 'Enter interface view.' },
                { command: 'description *** YOUR_DESCRIPTION_HERE ***', context: 'Set a descriptive label.' },
            ],
        });
    });

    // Check 2: Default Hostname
    if (!config.hostname || config.hostname.toLowerCase() === 'h3c') {
        findings.push({
            id: 'h3c_bp_default_hostname',
            type: 'Best Practice',
            severity: 'Low',
            description: 'The device has a default hostname ("H3C").',
            devicesInvolved: [fileName],
            details: { currentHostname: config.hostname },
            recommendation: 'Assign a unique and descriptive hostname to the device for easier identification and management.',
            remediationCommands: [
                { command: 'system-view', context: 'Enter system view.' },
                { command: 'sysname YOUR_HOSTNAME_HERE', context: 'Set a unique hostname.' },
            ],
        });
    }

    // Check 3: Port Security on Access Ports (Example)
    const accessPortsWithoutPortSecurity = (config.ports || [])
        .filter(p => 
            p.type?.toLowerCase().includes('access') &&
            !p.config.some(c => c.includes('port-security'))
        );

    if (accessPortsWithoutPortSecurity.length > 0) {
         findings.push({
            id: 'h3c_sec_missing_port_security',
            type: 'Security Risk',
            severity: 'Medium',
            description: `Found ${accessPortsWithoutPortSecurity.length} access port(s) without port-security enabled.`,
            devicesInvolved: [fileName],
            details: { ports: accessPortsWithoutPortSecurity.map(p => p.port).join(', ') },
            recommendation: 'Enable port-security on all access-layer switch ports to prevent unauthorized devices from connecting to the network.',
            remediationCommands: accessPortsWithoutPortSecurity.flatMap(p => [
                { command: 'system-view', context: 'Enter system view.' },
                { command: `interface ${p.port}`, context: `Enter config for ${p.port}.` },
                { command: 'port-security enable', context: 'Enable port security.' },
            ]),
        });
    }

    return findings;
};
