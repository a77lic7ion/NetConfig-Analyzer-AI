declare var ipaddr: any;
import { ParsedConfigData, PortConfig, OspfInfo, VlanMapInfo, IpRangeInfo, SnmpInfo, SnmpAcl, DhcpPoolInfo, AaaInfo, ConnectionInfo, RoutingInfo, SecurityCompliance, SviInfo } from '../types';

// Helper functions (unchanged)
const ipToLong = (ip: string): number => {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
};

const longToIp = (long: number): string => {
    return [(long >>> 24), (long >>> 16) & 255, (long >>> 8) & 255, long & 255].join('.');
};

function getInitialParsedData(): ParsedConfigData {
    return {
        hostname: '',
        iosVersion: '',
        modelNumber: '',
        vlans: [],
        ipRanges: [],
        ospf: { status: 'Not configured', details: [], rawConfig: [], networks: [], passiveInterfaces: [] },
        snmp: { status: 'Not configured', details: [], acls: [] },
        svis: [],
        dhcpPools: [],
        aaa: { status: 'Not configured', details: [] },
        other: { dnsServers: '', domain: '' },
        connections: [],
        usernames: [],
        ports: [],
        uplinks: [],
        portChannels: [],
        routing: { defaultGateway: '', defaultRoute: '' },
        security: { present: [], missing: [] }
    };
}

function calculateSubnetInfo(ipAddress: string, subnetMask: string): Omit<IpRangeInfo, 'vlanId'|'svi'|'status'> {
    const errorResult = {
        ipAddress,
        network: "Error",
        usableRange: "Error",
        broadcast: "Error",
        subnetMask: subnetMask || "N/A",
        totalAddresses: 0,
        usableAddresses: 0,
        gateway: ipAddress,
    };

    if (!ipaddr.IPv4.isValid(ipAddress) || !ipaddr.IPv4.isValid(subnetMask)) {
        return errorResult;
    }

    try {
        const ipAsLong = ipToLong(ipAddress);
        const maskAsLong = ipToLong(subnetMask);
        
        const networkAsLong = ipAsLong & maskAsLong;
        const broadcastAsLong = networkAsLong | (~maskAsLong >>> 0);

        const networkAddr = longToIp(networkAsLong);
        const broadcastAddr = longToIp(broadcastAsLong);

        const prefix = ipaddr.IPv4.parse(subnetMask).prefixLengthFromSubnetMask();
        if (prefix === null) {
            return errorResult;
        }

        const totalAddresses = Math.pow(2, 32 - prefix);
        let usableAddresses = 0;
        let usableRange = "N/A";

        if (prefix < 31) {
             usableAddresses = totalAddresses > 2 ? totalAddresses - 2 : 0;
             if (usableAddresses > 0) {
                const firstUsable = longToIp(networkAsLong + 1);
                const lastUsable = longToIp(broadcastAsLong - 1);
                usableRange = `${firstUsable} - ${lastUsable}`;
             } else {
                 usableRange = "None (subnet too small)";
             }
        } else if (prefix === 31) {
            usableAddresses = 2;
            usableRange = `${networkAddr} - ${broadcastAddr}`;
        } else {
            usableAddresses = 1;
            usableRange = ipAddress;
        }
        
        return {
            ipAddress,
            network: networkAddr,
            usableRange: usableRange,
            broadcast: broadcastAddr,
            subnetMask: `${subnetMask} (/${prefix})`,
            totalAddresses,
            usableAddresses,
            gateway: ipAddress,
        };

    } catch (e) {
        console.error(`CRITICAL: Error in calculateSubnetInfo for ${ipAddress}/${subnetMask}:`, e);
        return errorResult;
    }
}

function consolidatePortRange(ports: PortConfig[]): PortConfig[] {
    if (!ports || ports.length === 0) return [];

    const consolidated: PortConfig[] = [];
    let currentRange: { start: string, end: string, config: string[], type: string, description: string, status: string, members: string[] } | null = null;

    const filteredPorts = ports.filter(port => port && typeof port.port === 'string' && port.port.trim() !== '');

    filteredPorts.sort((a, b) => {
        const portA = a.port;
        const portB = b.port;
        const portPattern = /^([A-Za-z-]+)(\d+(?:\/\d+)*)$/;
        const matchA = portA.match(portPattern);
        const matchB = portB.match(portPattern);
        if (!matchA || !matchB) return portA.localeCompare(portB);
        const [, typeA, numA] = matchA;
        const [, typeB, numB] = matchB;
        if (typeA !== typeB) return typeA.localeCompare(typeB);
        const numASplit = numA.split('/').map(Number);
        const numBSplit = numB.split('/').map(Number);
        for (let i = 0; i < Math.max(numASplit.length, numBSplit.length); i++) {
            const partA = numASplit[i] || 0;
            const partB = numBSplit[i] || 0;
            if (partA !== partB) return partA - partB;
        }
        return 0;
    });

    filteredPorts.forEach((port) => {
        const configToCompare = JSON.stringify((port.config || []).slice(1));
        
        if (!currentRange) {
            currentRange = { start: port.port, end: port.port, config: port.config, type: port.type, description: port.description, status: port.status, members: port.members };
        } else {
            const portPattern = /^([A-Za-z-]+)(\d+(?:\/\d+)*)$/;
            const matchCurrent = currentRange.end.match(portPattern);
            const matchPort = port.port.match(portPattern);

            if (!matchCurrent || !matchPort) {
                consolidated.push({ port: currentRange.start === currentRange.end ? currentRange.start : `${currentRange.start} - ${currentRange.end}`, ...currentRange });
                currentRange = { start: port.port, end: port.port, config: port.config, type: port.type, description: port.description, status: port.status, members: port.members };
                return;
            }

            const [, currentType, currentNum] = matchCurrent;
            const [, portType, portNum] = matchPort;
            const currentNumSplit = currentNum.split('/').map(Number);
            const portNumSplit = portNum.split('/').map(Number);

            const isSequential = currentType === portType &&
                currentNumSplit.length === portNumSplit.length &&
                currentNumSplit.slice(0, -1).every((val, idx) => val === portNumSplit[idx]) &&
                portNumSplit[currentNumSplit.length - 1] === currentNumSplit[currentNumSplit.length - 1] + 1;
            
            const currentConfigToCompare = JSON.stringify((currentRange.config || []).slice(1));
            const haveSameConfig = currentConfigToCompare === configToCompare;

            const haveSameProperties = currentRange.type === port.type &&
                                       currentRange.description === port.description &&
                                       currentRange.status === port.status &&
                                       JSON.stringify(currentRange.members) === JSON.stringify(port.members);

            if (isSequential && haveSameConfig && haveSameProperties) {
                currentRange.end = port.port;
            } else {
                consolidated.push({ port: currentRange.start === currentRange.end ? currentRange.start : `${currentRange.start} - ${currentRange.end}`, ...currentRange });
                currentRange = { start: port.port, end: port.port, config: port.config, type: port.type, description: port.description, status: port.status, members: port.members };
            }
        }
    });
    if (currentRange) {
        consolidated.push({ port: currentRange.start === currentRange.end ? currentRange.start : `${currentRange.start} - ${currentRange.end}`, ...currentRange });
    }
    return consolidated;
}


// --- Refactored Parsing Functions ---

const parseDeviceInfo = (lines: string[], data: ParsedConfigData) => {
    for (const line of lines) {
        let match;
        if ((match = line.match(/^hostname\s+(\S+)/))) data.hostname = match[1];
        else if ((match = line.match(/^version\s+(\S+)/))) data.iosVersion = match[1];
        else if ((match = line.match(/^switch\s+\d+\s+provision\s+(\S+)/))) data.modelNumber = match[1];
        else if ((match = line.match(/^ip\s+name-server\s+(.+)/))) data.other.dnsServers = match[1];
        else if ((match = line.match(/^ip\s+domain\s+name\s+(.+)/))) data.other.domain = match[1];
    }
};

const parseVlans = (lines: string[], data: ParsedConfigData) => {
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let match;
        if ((match = line.match(/^vlan\s+(\d+)/))) {
            const vlanId = match[1];
            let vlanName = 'Unnamed';
            const vlanRawConfig = [line];
            if (i + 1 < lines.length && lines[i + 1].match(/^\s*name\s+(.+)/)) {
                vlanName = lines[i + 1].match(/^\s*name\s+(.+)/)![1];
                vlanRawConfig.push(lines[i + 1].trim());
                i++;
            }
            data.vlans!.push({ id: vlanId, name: vlanName, rawConfig: vlanRawConfig });
        }
    }
};

const parseRouting = (lines: string[], data: ParsedConfigData) => {
    for (const line of lines) {
        let match;
        if ((match = line.match(/^ip\s+default-gateway\s+(\S+)/))) data.routing.defaultGateway = match[1];
        else if ((match = line.match(/^ip\s+route\s+0\.0\.0\.0\s+0\.0\.0\.0\s+(\S+)/))) data.routing.defaultRoute = match[1];
    }
};

const parseInterfaces = (lines: string[], data: ParsedConfigData) => {
    let currentInterface: PortConfig | null = null;
    for (const line of lines) {
        let match;
        if ((match = line.match(/^interface\s+(?!Vlan\d+)(\S+)/))) {
            const interfaceName = match[1];
            currentInterface = { port: interfaceName, type: 'Physical', config: [line], description: '', status: 'N/A', members: [] };
            data.ports!.push(currentInterface);
            if (interfaceName.toLowerCase().startsWith('port-channel') && !data.portChannels!.includes(interfaceName)) {
                data.portChannels!.push(interfaceName);
            }
            if (line.match(/UPLINK/i)) data.uplinks!.push(currentInterface.port);
        } else if (currentInterface) {
            if ((match = line.match(/^\s*description\s+(.+)/))) {
                currentInterface.description = match[1];
                if (currentInterface.description.match(/UPLINK/i) && !data.uplinks!.includes(currentInterface.port)) {
                    data.uplinks!.push(currentInterface.port);
                }
            }
            if (line.includes('shutdown')) currentInterface.status = 'Disabled';
            else if (currentInterface.status === 'N/A') currentInterface.status = 'Enabled';
            if ((match = line.match(/^\s*switchport\s+mode\s+(\S+)/))) currentInterface.type = match[1];
            if ((match = line.match(/^\s*channel-group\s+(\d+)\s+mode\s+(\S+)/))) {
                const pc = `Port-channel${match[1]}`;
                currentInterface.members.push(`${pc} (${match[2]})`);
                if (!data.portChannels!.includes(pc)) data.portChannels!.push(pc);
            }
            currentInterface.config.push(line);
            if (line.startsWith('!')) currentInterface = null;
        }
    }
};

const parseSvis = (lines: string[], data: ParsedConfigData) => {
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        let match;
        if ((match = line.match(/^interface\s+Vlan(\d+)/))) {
            const vlanId = match[1];
            const sviName = `Vlan${vlanId}`;
            let ipAddress = 'No IP address', subnetMask = '', ipHelperAddress = 'N/A', sviStatus = 'Enabled';
            const additionalInfo: string[] = [];
            const sviRawConfig = [line];

            let j = i + 1;
            while (j < lines.length && !lines[j].startsWith('!')) {
                const subLine = lines[j];
                sviRawConfig.push(subLine);
                let subMatch;
                if ((subMatch = subLine.match(/^\s*ip\s+address\s+([\d.]+)\s+([\d.]+)/))) {
                    [, ipAddress, subnetMask] = subMatch;
                } else if ((subMatch = subLine.match(/^\s*ip\s+helper-address\s+(\S+)/))) {
                    ipHelperAddress = subMatch[1];
                } else if (subLine.includes('shutdown')) {
                    sviStatus = 'Disabled';
                    additionalInfo.push('shutdown');
                } else if ((subMatch = subLine.match(/^\s*description\s+(.+)/))) {
                    additionalInfo.push(`Description: ${subMatch[1]}`);
                }
                j++;
            }
            if (j < lines.length && lines[j].startsWith('!')) {
                sviRawConfig.push(lines[j]);
            }
            data.svis!.push({ svi: sviName, vlanId, ipAddress, subnetMask, ipHelperAddress, status: sviStatus, additionalInfo: additionalInfo.join(', '), rawConfig: sviRawConfig });
            if (ipAddress !== 'No IP address' && subnetMask) {
                const subnetInfo = calculateSubnetInfo(ipAddress, subnetMask);
                data.ipRanges!.push({ vlanId, svi: sviName, ...subnetInfo, status: sviStatus });
            }
            i = j;
        }
    }
};

const parseOspf = (lines: string[], data: ParsedConfigData) => {
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let match;
        if ((match = line.match(/^router\s+ospf\s+(\d+)/))) {
            data.ospf.status = 'Configured';
            data.ospf.processId = match[1];
            data.ospf.rawConfig.push(line);

            let j = i + 1;
            while (j < lines.length && !lines[j].startsWith('!')) {
                const subLine = lines[j];
                data.ospf.rawConfig.push(subLine);
                let subMatch;
                if ((subMatch = subLine.match(/^\s*router-id\s+([\d.]+)/))) data.ospf.routerId = subMatch[1];
                else if ((subMatch = subLine.match(/^\s*network\s+([\d.]+)\s+([\d.]+)\s+area\s+(\S+)/))) data.ospf.networks.push({ network: subMatch[1], wildcard: subMatch[2], area: subMatch[3] });
                else if ((subMatch = subLine.match(/^\s*passive-interface\s+(\S+)/))) data.ospf.passiveInterfaces.push(subMatch[1]);
                else data.ospf.details.push(subLine);
                j++;
            }
            i = j;
        }
    }
};

const parseSnmp = (lines: string[], data: ParsedConfigData) => {
    let currentAcl: SnmpAcl | null = null;
    for (const line of lines) {
        let match;
        if (line.match(/^snmp-server\s+(.+)/)) {
            data.snmp.status = 'Configured';
            data.snmp.details.push(line.replace(/^snmp-server\s+/, ''));
        } else if ((match = line.match(/^ip\s+access-list\s+standard\s+(\S+)/)) && line.includes('snmp')) {
            const aclName = match[1];
            data.snmp.status = 'Configured';
            currentAcl = { name: aclName, rules: [line] };
            data.snmp.acls.push(currentAcl);
        } else if (currentAcl && (line.match(/^\s*permit\s+(.+)/) || line.match(/^\s*deny\s+(.+)/))) {
            currentAcl.rules.push(line);
        } else if (currentAcl && line.startsWith('!')) {
            currentAcl = null;
        }
    }
};

const parseDhcpPools = (lines: string[], data: ParsedConfigData) => {
    let currentDhcpPool: DhcpPoolInfo | null = null;
    for (const line of lines) {
        let match;
        if ((match = line.match(/^ip\s+dhcp\s+pool\s+(\S+)/))) {
            currentDhcpPool = { name: match[1], config: [line] };
            data.dhcpPools!.push(currentDhcpPool);
        } else if (currentDhcpPool) {
            if (line.match(/^\s*network\s+([\d.]+)\s+([\d.]+)/) || line.match(/^\s*default-router\s+(\S+)/) || line.match(/^\s*dns-server\s+(.+)/)) {
                currentDhcpPool.config.push(line);
            } else if (line.startsWith('!')) {
                currentDhcpPool = null;
            }
        }
    }
};

const parseAaa = (lines: string[], data: ParsedConfigData) => {
    let inAaaSection = false;
    for (const line of lines) {
        let match;
        if (line.includes('aaa new-model')) {
            data.aaa.status = 'Configured';
            inAaaSection = true;
            data.aaa.details.push('AAA Enabled');
            data.security.present.push('AAA Authentication');
        } else if (inAaaSection) {
            if ((match = line.match(/^aaa\s+authentication\s+(.+)/))) data.aaa.details.push(`Authentication: ${match[1]}`);
            else if ((match = line.match(/^aaa\s+authorization\s+(.+)/))) data.aaa.details.push(`Authorization: ${match[1]}`);
            else if ((match = line.match(/^aaa\s+accounting\s+(.+)/))) data.aaa.details.push(`Accounting: ${match[1]}`);
            else if (line.startsWith('!')) inAaaSection = false;
        }
    }
};

const parseUsernames = (lines: string[], data: ParsedConfigData) => {
    for (const line of lines) {
        let match;
        if ((match = line.match(/^username\s+(\S+)/))) {
            data.usernames!.push({ name: match[1], config: line });
        }
    }
};

const parseConnections = (lines: string[], data: ParsedConfigData) => {
    let currentLine: ConnectionInfo | null = null;
    for (const line of lines) {
        let match;
        if ((match = line.match(/^line\s+(con|vty)\s+(\d+\s+\d+|\d+)/))) {
            const [, type, range] = match;
            currentLine = { type, range, config: [line], usernames: [] };
            data.connections!.push(currentLine);
        } else if (currentLine) {
            if (line.startsWith('!')) {
                currentLine = null;
            } else {
                currentLine.config.push(line);
                if ((match = line.match(/^\s*description\s+(.+)/))) {
                    currentLine.description = match[1];
                } else if (line.includes('login local') && data.usernames!.length > 0) {
                    currentLine.usernames = data.usernames!.map(u => u.name);
                }
            }
        }
    }
};

const parseSecurity = (lines: string[], data: ParsedConfigData) => {
    const securityChecks = {
        'Password Encryption': (l: string) => l.includes('service password-encryption'),
        'SSH Enabled': (l: string) => l.includes('ip ssh'),
        'HTTP/HTTPS Server Disabled': (l: string) => l.includes('no ip http server') && l.includes('no ip http secure-server'),
        'DHCP Snooping': (l: string) => l.includes('ip dhcp snooping'),
        'Dynamic ARP Inspection': (l: string) => l.includes('ip arp inspection'),
    };

    for (const line of lines) {
        for (const [key, check] of Object.entries(securityChecks)) {
            if (check(line) && !data.security.present.includes(key)) {
                data.security.present.push(key);
            }
        }
        let match;
        if ((match = line.match(/^vtp\s+mode\s+(\S+)/)) && !data.security.present.some(p => p.startsWith('VTP Mode:'))) {
            data.security.present.push(`VTP Mode: ${match[1]}`);
        }
    }

    if (data.ports!.some(p => p.config.some(c => c.includes('switchport port-security')))) {
        data.security.present.push('Port Security on Access Ports');
    }
    if (data.ports!.some(p => p.config.some(c => c.includes('spanning-tree bpduguard enable')))) {
        data.security.present.push('BPDU Guard');
    }

    const allPossibleSecurityItems = [
        'Password Encryption', 'VTP Mode: off', 'SSH Enabled', 'HTTP/HTTPS Server Disabled',
        'Port Security on Access Ports', 'BPDU Guard', 'DHCP Snooping', 'Dynamic ARP Inspection'
    ];

    data.security.missing = allPossibleSecurityItems.filter(
        f => !data.security.present.some(p => p.includes(f.split(':')[0]))
    );
};


export function parseCiscoConfigLocal(configText: string): ParsedConfigData {
    const data = getInitialParsedData();
    const lines = configText.split('\n').map(line => line.trim());

    parseDeviceInfo(lines, data);
    parseVlans(lines, data);
    parseRouting(lines, data);
    parseInterfaces(lines, data);
    parseSvis(lines, data);
    parseOspf(lines, data);
    parseSnmp(lines, data);
    parseDhcpPools(lines, data);
    parseUsernames(lines, data); // Must be before parseAaa and parseConnections
    parseAaa(lines, data);
    parseConnections(lines, data);

    // Consolidate ports after they have all been parsed
    data.ports = consolidatePortRange(data.ports!);

    // Security parsing needs to happen after ports have been parsed
    parseSecurity(lines, data);

    return data;
}
