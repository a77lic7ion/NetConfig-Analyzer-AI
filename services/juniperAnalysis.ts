import { ParsedConfigData, AnalysisFinding } from '../types';

export const analyzeJuniperConfig = (config: ParsedConfigData): AnalysisFinding[] => {
    const findings: AnalysisFinding[] = [];
    const fileName = config.fileName || 'the device';

    // Check 1: Insecure Telnet Service Enabled
    if (config.security?.missing.includes('Telnet Enabled (Insecure)')) {
        findings.push({
            id: 'juniper_sec_telnet_enabled',
            type: 'Security Risk',
            severity: 'High',
            description: 'The insecure Telnet service is enabled under [system services].',
            devicesInvolved: [fileName],
            details: { path: '[system services telnet]' },
            recommendation: 'Telnet is insecure as it transmits data in clear text. It should be disabled in favor of SSH.',
            remediationCommands: [
                { command: 'configure', context: 'Enter configuration mode.' },
                { command: 'delete system services telnet', context: 'Disable the insecure Telnet service.' },
                { command: 'commit', context: 'Commit the configuration change.' },
            ],
        });
    }

    // Check 2: Insecure HTTP Service Enabled
    if (config.security?.missing.includes('HTTP Web Management Enabled (Insecure)')) {
        findings.push({
            id: 'juniper_sec_http_enabled',
            type: 'Security Risk',
            severity: 'High',
            description: 'Insecure HTTP web management is enabled under [system services web-management].',
            devicesInvolved: [fileName],
            details: { path: '[system services web-management http]' },
            recommendation: 'HTTP web management is insecure. It should be disabled. Use the secure HTTPS service if web management is required.',
            remediationCommands: [
                { command: 'configure', context: 'Enter configuration mode.' },
                { command: 'delete system services web-management http', context: 'Disable the insecure HTTP service.' },
                 { command: 'commit', context: 'Commit the configuration change.' },
            ],
        });
    }

    // Check 3: Missing Interface Descriptions
    const interfacesWithoutDescription = (config.ports || [])
        .filter(p => p.status?.toLowerCase() !== 'down' && !p.port.toLowerCase().startsWith('ae') && !p.description);

    interfacesWithoutDescription.forEach(iface => {
        findings.push({
            id: `juniper_bp_no_desc_${iface.port.replace(/[^a-zA-Z0-9]/g, '')}`,
            type: 'Best Practice',
            severity: 'Low',
            description: `Interface ${iface.port} is active but missing a description.`,
            devicesInvolved: [fileName],
            details: { interface: iface.port, status: iface.status },
            recommendation: 'Add a descriptive label to all active interfaces to aid in network management and troubleshooting.',
            remediationCommands: [
                { command: 'configure', context: 'Enter configuration mode.' },
                { command: `set interfaces ${iface.port} description "*** YOUR_DESCRIPTION_HERE ***"`, context: 'Set a descriptive label.' },
                { command: 'commit', context: 'Commit the configuration change.' },
            ],
        });
    });

    // Check 4: Default Hostname
    if (!config.hostname) {
        findings.push({
            id: 'juniper_bp_default_hostname',
            type: 'Best Practice',
            severity: 'Low',
            description: 'The device does not have a configured hostname.',
            devicesInvolved: [fileName],
            details: { check: '[system host-name]' },
            recommendation: 'Assign a unique and descriptive hostname to the device for easier identification and management.',
            remediationCommands: [
                { command: 'configure', context: 'Enter configuration mode.' },
                { command: 'set system host-name YOUR_HOSTNAME_HERE', context: 'Set a unique hostname.' },
                { command: 'commit', context: 'Commit the configuration change.' },
            ],
        });
    }
    
    // Check 5: AAA (authentication-order) not configured
    if (config.aaa?.status !== 'Configured') {
         findings.push({
            id: 'juniper_sec_no_aaa',
            type: 'Security Risk',
            severity: 'Medium',
            description: 'Centralized authentication (AAA) order is not configured.',
            devicesInvolved: [fileName],
            details: { path: '[system authentication-order]' },
            recommendation: 'Configure an authentication order (e.g., radius, tacplus, password) to use centralized authentication servers. This improves security and manageability over local-only passwords.',
            remediationCommands: [
                { command: 'configure', context: 'Enter configuration mode.' },
                { command: 'set system authentication-order [ radius tacplus password ]', context: 'Set the desired authentication order.' },
                { command: 'commit', context: 'Commit the configuration change.' },
            ],
        });
    }

    return findings;
};
