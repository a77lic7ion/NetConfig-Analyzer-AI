import { ParsedConfigData, AnalysisFinding } from '../types';

export const analyzeCiscoConfig = (config: ParsedConfigData): AnalysisFinding[] => {
    const findings: AnalysisFinding[] = [];
    const fileName = config.fileName || 'the device';

    // Check 1: Service Password Encryption
    if (!config.security?.present.includes('Password Encryption')) {
        findings.push({
            id: 'cisco_sec_no_password_encryption',
            type: 'Security Risk',
            severity: 'Medium',
            description: 'The "service password-encryption" command is missing.',
            devicesInvolved: [fileName],
            details: { check: 'Global Configuration' },
            recommendation: 'Enable password encryption to prevent casual viewing of clear-text passwords in the configuration file. This is a foundational security best practice.',
            remediationCommands: [
                { command: 'configure terminal', context: 'Enter global configuration mode.' },
                { command: 'service password-encryption', context: 'Enable password encryption service.' },
            ],
        });
    }

    // Check 2: Insecure HTTP Server
    if (!config.security?.present.includes('HTTP/HTTPS Server Disabled')) {
        findings.push({
            id: 'cisco_sec_http_server_enabled',
            type: 'Security Risk',
            severity: 'High',
            description: 'The insecure HTTP server is enabled.',
            devicesInvolved: [fileName],
            details: { check: 'Global Configuration' },
            recommendation: 'The HTTP server is insecure as it transmits data in clear text. It should be disabled. If web management is required, use the secure HTTPS server instead.',
            remediationCommands: [
                { command: 'configure terminal', context: 'Enter global configuration mode.' },
                { command: 'no ip http server', context: 'Disable the insecure HTTP server.' },
                { command: 'no ip http secure-server', context: 'Ensure the secure server is also disabled if not used.' },
            ],
        });
    }

    // Check 3: Missing Interface Descriptions
    const interfacesWithoutDescription = (config.ports || [])
        .filter(p => p.status?.toLowerCase() !== 'disabled' && !p.port.toLowerCase().startsWith('port-channel') && !p.description);

    interfacesWithoutDescription.forEach(iface => {
        findings.push({
            id: `cisco_bp_no_desc_${iface.port.replace(/[^a-zA-Z0-9]/g, '')}`,
            type: 'Best Practice',
            severity: 'Low',
            description: `Interface ${iface.port} is active but missing a description.`,
            devicesInvolved: [fileName],
            details: { interface: iface.port, status: iface.status },
            recommendation: 'Add a descriptive label to all active interfaces to aid in network management and troubleshooting.',
            remediationCommands: [
                { command: 'configure terminal', context: 'Enter global configuration mode.' },
                { command: `interface ${iface.port}`, context: 'Enter interface configuration mode.' },
                { command: 'description *** YOUR_DESCRIPTION_HERE ***', context: 'Set a descriptive label.' },
            ],
        });
    });

    // Check 4: Missing Port Security on Access Ports
    const accessPortsWithoutPortSecurity = (config.ports || [])
        .filter(p => 
            p.type?.toLowerCase().includes('access') &&
            !p.config.some(c => c.includes('switchport port-security'))
        );

    if (accessPortsWithoutPortSecurity.length > 0) {
         findings.push({
            id: 'cisco_sec_missing_port_security',
            type: 'Security Risk',
            severity: 'Medium',
            description: `Found ${accessPortsWithoutPortSecurity.length} access port(s) without port-security enabled.`,
            devicesInvolved: [fileName],
            details: { ports: accessPortsWithoutPortSecurity.map(p => p.port).join(', ') },
            recommendation: 'Enable port-security on all access ports to mitigate MAC spoofing and flooding attacks by limiting the number of allowed MAC addresses.',
            remediationCommands: accessPortsWithoutPortSecurity.flatMap(p => [
                { command: 'configure terminal', context: 'Enter global configuration mode.' },
                { command: `interface ${p.port}`, context: `Enter config for ${p.port}.` },
                { command: 'switchport port-security', context: 'Enable port security.' },
            ]),
        });
    }

    // Check 5: Missing BPDU Guard on Access Ports
     const accessPortsWithoutBpduGuard = (config.ports || [])
        .filter(p => 
            p.type?.toLowerCase().includes('access') &&
            !p.config.some(c => c.includes('spanning-tree bpduguard enable'))
        );
    
    if (accessPortsWithoutBpduGuard.length > 0) {
        findings.push({
            id: 'cisco_bp_missing_bpduguard',
            type: 'Best Practice',
            severity: 'Medium',
            description: `Found ${accessPortsWithoutBpduGuard.length} access port(s) without BPDU Guard enabled.`,
            devicesInvolved: [fileName],
            details: { ports: accessPortsWithoutBpduGuard.map(p => p.port).join(', ') },
            recommendation: 'Enable BPDU Guard on all access ports to prevent unauthorized switches from joining the spanning-tree topology, which can cause network instability.',
            remediationCommands: accessPortsWithoutBpduGuard.flatMap(p => [
                 { command: 'configure terminal', context: 'Enter global configuration mode.' },
                { command: `interface ${p.port}`, context: `Enter config for ${p.port}.` },
                { command: 'spanning-tree bpduguard enable', context: 'Enable BPDU Guard.' },
            ]),
        });
    }

    // Check 6: Default Hostname
    if (!config.hostname || config.hostname.toLowerCase() === 'switch') {
        findings.push({
            id: 'cisco_bp_default_hostname',
            type: 'Best Practice',
            severity: 'Low',
            description: 'The device has a default hostname (e.g., "Switch").',
            devicesInvolved: [fileName],
            details: { currentHostname: config.hostname },
            recommendation: 'Assign a unique and descriptive hostname to the device for easier identification and management on the network.',
            remediationCommands: [
                { command: 'configure terminal', context: 'Enter global configuration mode.' },
                { command: 'hostname YOUR_HOSTNAME_HERE', context: 'Set a unique hostname.' },
            ],
        });
    }

    return findings;
};
