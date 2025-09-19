import { ParsedConfigData, AnalysisFinding } from '../types';

export const analyzeHuaweiConfig = (config: ParsedConfigData): AnalysisFinding[] => {
    const findings: AnalysisFinding[] = [];
    const fileName = config.fileName || 'the device';

    // Check 1: SSH Server Not Enabled
    if (!config.security?.present.includes('SSH Enabled')) {
        findings.push({
            id: 'huawei_sec_ssh_disabled',
            type: 'Security Risk',
            severity: 'High',
            description: 'The SSH server (Stelnet) is not enabled.',
            devicesInvolved: [fileName],
            details: { check: 'Global Configuration' },
            recommendation: 'Enable the SSH server for secure remote management. Telnet is insecure and should be avoided.',
            remediationCommands: [
                { command: 'system-view', context: 'Enter system view.' },
                { command: 'stelnet server enable', context: 'Enable the SSH (Stelnet) server.' },
                { command: 'rsa local-key-pair create', context: 'Generate an RSA key pair (if not present).' },
            ],
        });
    }

    // Check 2: Insecure HTTP Server Enabled
    if (!config.security?.present.includes('HTTP Server Disabled')) {
        findings.push({
            id: 'huawei_sec_http_server_enabled',
            type: 'Security Risk',
            severity: 'High',
            description: 'The insecure HTTP server is enabled.',
            devicesInvolved: [fileName],
            details: { check: 'Global Configuration' },
            recommendation: 'The HTTP server is insecure. It should be disabled using "undo http server enable". Use HTTPS if web management is required.',
            remediationCommands: [
                { command: 'system-view', context: 'Enter system view.' },
                { command: 'undo http server enable', context: 'Disable the insecure HTTP server.' },
            ],
        });
    }
    
    // Check 3: Password Policy Not Enabled
    if (!config.security?.present.includes('Password Policy Enabled')) {
        findings.push({
            id: 'huawei_sec_no_password_policy',
            type: 'Security Risk',
            severity: 'Medium',
            description: 'The global password complexity policy is not enabled.',
            devicesInvolved: [fileName],
            details: { check: 'Global Configuration' },
            recommendation: 'Enable the password policy to enforce complexity requirements for local user accounts, making them harder to guess.',
            remediationCommands: [
                { command: 'system-view', context: 'Enter system view.' },
                { command: 'password-policy enable', context: 'Enable the password policy feature.' },
            ],
        });
    }

    // Check 4: Missing Interface Descriptions
    const interfacesWithoutDescription = (config.ports || [])
        .filter(p => p.status?.toLowerCase() !== 'down' && !p.port.toLowerCase().startsWith('eth-trunk') && !p.description);

    interfacesWithoutDescription.forEach(iface => {
        findings.push({
            id: `huawei_bp_no_desc_${iface.port.replace(/[^a-zA-Z0-9]/g, '')}`,
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
    
    // Check 5: Default Hostname
    if (!config.hostname || config.hostname.toLowerCase() === 'huawei') {
        findings.push({
            id: 'huawei_bp_default_hostname',
            type: 'Best Practice',
            severity: 'Low',
            description: 'The device has a default hostname ("Huawei").',
            devicesInvolved: [fileName],
            details: { currentHostname: config.hostname },
            recommendation: 'Assign a unique and descriptive hostname to the device for easier identification and management.',
            remediationCommands: [
                { command: 'system-view', context: 'Enter system view.' },
                { command: 'sysname YOUR_HOSTNAME_HERE', context: 'Set a unique hostname.' },
            ],
        });
    }


    return findings;
};
