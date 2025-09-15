
declare var ipaddr: any;
import { ParsedConfigData, PortConfig, OspfNetwork, OspfInfo, VlanMapInfo, IpRangeInfo, SnmpInfo, SnmpAcl, DhcpPoolInfo, AaaInfo, ConnectionInfo, RoutingInfo, SecurityCompliance, SviInfo } from '../types';

// Helper functions for IP calculation
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

    // Use ipaddr.js for validation, which is what it's good at.
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
            usableAddresses = 2; // Point-to-point links are usable (RFC 3021)
            usableRange = `${networkAddr} - ${broadcastAddr}`;
        } else { // prefix === 32
            usableAddresses = 1; // Host route
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
        // Compare config *without* the `interface ...` line.
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

            // Also compare other properties that are parsed separately to be safe.
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

export function parseCiscoConfigLocal(configText: string): ParsedConfigData {
    const data = getInitialParsedData();
    
    const lines = configText.split('\n').map(line => line.trim());

    let inInterfaceSection = false, inSviSection = false, inOSPFSection = false, inSnmpAcl = false, inDhcpPool = false, inAaaSection = false, inLineSection = false;
    let currentInterface: PortConfig | null = null, currentSvi: SviInfo | null = null, currentAcl: SnmpAcl | null = null, currentDhcpPool: DhcpPoolInfo | null = null, currentLine: ConnectionInfo | null = null;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.match(/^hostname\s+(\S+)/)) data.hostname = line.match(/^hostname\s+(\S+)/)![1];
        if (line.match(/^version\s+(\S+)/)) data.iosVersion = line.match(/^version\s+(\S+)/)![1];
        if (line.match(/^switch\s+\d+\s+provision\s+(\S+)/)) data.modelNumber = line.match(/^switch\s+\d+\s+provision\s+(\S+)/)![1];
        if (line.match(/^vlan\s+(\d+)/)) {
            const vlanId = line.match(/^vlan\s+(\d+)/)![1];
            let vlanName = 'Unnamed';
            const vlanRawConfig = [line];
            if (i + 1 < lines.length && lines[i + 1].match(/^\s*name\s+(.+)/)) {
                vlanName = lines[i + 1].match(/^\s*name\s+(.+)/)![1]; 
                vlanRawConfig.push(lines[i + 1].trim());
                i++;
            }
            data.vlans!.push({ id: vlanId, name: vlanName, rawConfig: vlanRawConfig });
        }
        if (line.match(/^ip\s+default-gateway\s+(\S+)/)) data.routing!.defaultGateway = line.match(/^ip\s+default-gateway\s+(\S+)/)![1];
        if (line.match(/^ip\s+route\s+0\.0\.0\.0\s+0\.0\.0\.0\s+(\S+)/)) data.routing!.defaultRoute = line.match(/^ip\s+route\s+0\.0\.0\.0\s+0\.0\.0\.0\s+(\S+)/)![1];
        if (line.match(/^ip\s+name-server\s+(.+)/)) data.other!.dnsServers = line.match(/^ip\s+name-server\s+(.+)/)![1];
        else if (line.match(/^ip\s+domain\s+name\s+(.+)/)) data.other!.domain = line.match(/^ip\s+domain\s+name\s+(.+)/)![1];

        if (line.match(/^interface\s+(?!Vlan\d+)(\S+)/)) {
            inInterfaceSection = true;
            const interfaceName = line.match(/^interface\s+(?!Vlan\d+)(\S+)/)![1];
            currentInterface = { port: interfaceName, type: 'Physical', config: [line], description: '', status: 'N/A', members: [] };
            data.ports!.push(currentInterface);

            if(interfaceName.toLowerCase().startsWith('port-channel') && !data.portChannels!.includes(interfaceName)) {
                data.portChannels!.push(interfaceName);
            }
            if (line.match(/UPLINK/i) || (i + 1 < lines.length && lines[i + 1]?.match(/description.*UPLINK/i))) data.uplinks!.push(currentInterface.port);
        } else if (inInterfaceSection && currentInterface) {
            if (line.match(/^\s*description\s+(.+)/)) {
                currentInterface.description = line.match(/^\s*description\s+(.+)/)![1];
                if (currentInterface.description.match(/UPLINK/i) && !data.uplinks!.includes(currentInterface.port)) data.uplinks!.push(currentInterface.port);
            }
            if (line.includes('shutdown')) currentInterface.status = 'Disabled'; else if (currentInterface.status === 'N/A') currentInterface.status = 'Enabled';
            if (line.match(/^\s*switchport\s+mode\s+(\S+)/)) currentInterface.type = line.match(/^\s*switchport\s+mode\s+(\S+)/)![1];
            if (line.match(/^\s*channel-group\s+(\d+)\s+mode\s+(\S+)/)) {
                const cg = line.match(/^\s*channel-group\s+(\d+)\s+mode\s+(\S+)/)!;
                const pc = `Port-channel${cg[1]}`;
                currentInterface.members.push(`${pc} (${cg[2]})`);
                if (!data.portChannels!.includes(pc)) data.portChannels!.push(pc);
            }
            currentInterface.config.push(line);
            if (line.match(/^!/)) { inInterfaceSection = false; currentInterface = null; }
        }

        if (line.match(/^interface\s+Vlan(\d+)/)) {
            const vlanId = line.match(/^interface\s+Vlan(\d+)/)![1], sviName = `Vlan${vlanId}`;
            let ipAddress = 'No IP address', subnetMask = '', ipHelperAddress = 'N/A', additionalInfo: string[] = [], sviStatus = 'Enabled';
            const sviRawConfig = [line];
            let j = i + 1;
            while (j < lines.length && !lines[j].match(/^!/)) {
                const subLine = lines[j];
                sviRawConfig.push(subLine);
                if (subLine.match(/^\s*ip\s+address\s+([\d.]+)\s+([\d.]+)/)) {
                    [ ,ipAddress, subnetMask] = subLine.match(/^\s*ip\s+address\s+([\d.]+)\s+([\d.]+)/)!;
                } else if (subLine.match(/^\s*ip\s+helper-address\s+(\S+)/)) ipHelperAddress = subLine.match(/^\s*ip\s+helper-address\s+(\S+)/)![1];
                else if (subLine.includes('shutdown')) { sviStatus = 'Disabled'; additionalInfo.push('shutdown'); }
                else if (subLine.match(/^\s*description\s+(.+)/)) additionalInfo.push(`Description: ${subLine.match(/^\s*description\s+(.+)/)![1]}`);
                j++;
            }
            if(j < lines.length && lines[j].match(/^!/)) {
                sviRawConfig.push(lines[j]);
            }
            data.svis!.push({ svi: sviName, vlanId, ipAddress, subnetMask, ipHelperAddress, status: sviStatus, additionalInfo: additionalInfo.join(', '), rawConfig: sviRawConfig });
            if (ipAddress !== 'No IP address' && subnetMask) {
                const subnetInfo = calculateSubnetInfo(ipAddress, subnetMask);
                data.ipRanges!.push({ vlanId, svi: sviName, ...subnetInfo, status: sviStatus });
            }
            i = j;
        }

        if (line.match(/^router\s+ospf\s+(\d+)/)) {
            inOSPFSection = true; 
            data.ospf!.status = 'Configured'; 
            data.ospf!.processId = line.match(/^router\s+ospf\s+(\d+)/)![1];
            data.ospf!.rawConfig = [line];
            data.ospf!.networks = [];
            data.ospf!.passiveInterfaces = [];
            data.ospf!.details = [];

            while (i + 1 < lines.length && !lines[i + 1].match(/^!/)) {
                i++; 
                const subLine = lines[i]; 
                data.ospf!.rawConfig.push(subLine);
                const networkMatch = subLine.match(/^\s*network\s+([\d.]+)\s+([\d.]+)\s+area\s+(\S+)/);
                const passiveMatch = subLine.match(/^\s*passive-interface\s+(\S+)/);
                const routerIdMatch = subLine.match(/^\s*router-id\s+([\d.]+)/);

                if (routerIdMatch) data.ospf!.routerId = routerIdMatch[1];
                else if (networkMatch) data.ospf!.networks.push({ network: networkMatch[1], wildcard: networkMatch[2], area: networkMatch[3] });
                else if (passiveMatch) data.ospf!.passiveInterfaces.push(passiveMatch[1]);
                else data.ospf!.details.push(subLine);
            } 
            i++;
        }
        if (line.match(/^snmp-server\s+(.+)/)) { data.snmp!.status = 'Configured'; data.snmp!.details.push(line.replace(/^snmp-server\s+/, '')); }
        if (line.match(/^ip\s+access-list\s+standard\s+(\S+)/) && line.includes('snmp')) {
            inSnmpAcl = true; const aclName = line.match(/^ip\s+access-list\s+standard\s+(\S+)/)![1]; data.snmp!.status = 'Configured'; data.snmp!.acls = data.snmp!.acls || []; currentAcl = { name: aclName, rules: [line] }; data.snmp!.acls.push(currentAcl);
        } else if (inSnmpAcl && currentAcl && (line.match(/^\s*permit\s+(.+)/) || line.match(/^\s*deny\s+(.+)/))) currentAcl.rules.push(line);
        else if (inSnmpAcl && line.match(/^!/)) { inSnmpAcl = false; currentAcl = null; }

        if (line.match(/^ip\s+dhcp\s+pool\s+(\S+)/)) {
            inDhcpPool = true; currentDhcpPool = { name: line.match(/^ip\s+dhcp\s+pool\s+(\S+)/)![1], config: [line] }; data.dhcpPools!.push(currentDhcpPool);
        } else if (inDhcpPool && currentDhcpPool && (line.match(/^\s*network\s+([\d.]+)\s+([\d.]+)/) || line.match(/^\s*default-router\s+(\S+)/) || line.match(/^\s*dns-server\s+(.+)/))) currentDhcpPool.config.push(line);
        else if (inDhcpPool && line.match(/^!/)) { inDhcpPool = false; currentDhcpPool = null; }

        if (line.includes('aaa new-model')) { data.aaa!.status = 'Configured'; inAaaSection = true; data.aaa!.details.push('AAA Enabled'); data.security!.present.push('AAA Authentication');
        } else if (inAaaSection && line.match(/^aaa\s+authentication\s+(.+)/)) data.aaa!.details.push(`Authentication: ${line.match(/^aaa\s+authentication\s+(.+)/)![1]}`);
        else if (inAaaSection && line.match(/^aaa\s+authorization\s+(.+)/)) data.aaa!.details.push(`Authorization: ${line.match(/^aaa\s+authorization\s+(.+)/)![1]}`);
        else if (inAaaSection && line.match(/^aaa\s+accounting\s+(.+)/)) data.aaa!.details.push(`Accounting: ${line.match(/^aaa\s+accounting\s+(.+)/)![1]}`);
        else if (inAaaSection && line.match(/^!/)) inAaaSection = false;

        if (line.match(/^username\s+(\S+)/)) data.usernames!.push({ name: line.match(/^username\s+(\S+)/)![1], config: line });
        
        if (line.match(/^line\s+(con|vty)\s+(\d+\s+\d+|\d+)/)) {
            inLineSection = true; 
            const [, type, range] = line.match(/^line\s+(con|vty)\s+(\d+\s+\d+|\d+)/)!; 
            currentLine = { type, range, config: [line], usernames: [] }; 
            data.connections!.push(currentLine);
        } else if (inLineSection && currentLine) {
            if (line.match(/^!/)) {
                inLineSection = false;
                currentLine = null;
            } else {
                currentLine.config.push(line);
                if (line.match(/^\s*description\s+(.+)/)) {
                    currentLine.description = line.match(/^\s*description\s+(.+)/)![1];
                } else if (line.includes('login local') && data.usernames!.length > 0) {
                    currentLine.usernames = data.usernames!.map(u => u.name);
                }
            }
        }
    }
    if (lines.some(l => l.includes('service password-encryption'))) data.security!.present.push('Password Encryption');
    if (lines.some(l => l.match(/^vtp\s+mode\s+(\S+)/))) data.security!.present.push(`VTP Mode: ${lines.find(l => l.match(/^vtp\s+mode\s+(\S+)/))!.match(/^vtp\s+mode\s+(\S+)/)![1]}`);
    if (lines.some(l => l.includes('ip ssh'))) data.security!.present.push('SSH Enabled');
    if (lines.some(l => l.includes('no ip http server') && l.includes('no ip http secure-server'))) data.security!.present.push('HTTP/HTTPS Server Disabled');
    if (data.ports!.some(p => p.config.some(c => c.includes('switchport port-security')))) data.security!.present.push('Port Security on Access Ports');
    if (data.ports!.some(p => p.config.some(c => c.includes('spanning-tree bpduguard enable')))) data.security!.present.push('BPDU Guard');
    if (lines.some(l => l.includes('ip dhcp snooping'))) data.security!.present.push('DHCP Snooping');
    if (lines.some(l => l.includes('ip arp inspection'))) data.security!.present.push('Dynamic ARP Inspection');
    data.security!.missing = ['Password Encryption', 'VTP Mode: off', 'SSH Enabled', 'HTTP/HTTPS Server Disabled', 'Port Security on Access Ports', 'BPDU Guard', 'DHCP Snooping', 'Dynamic ARP Inspection']
        .filter(f => !data.security!.present.some(p => p.includes(f.split(':')[0])));
    data.ports = consolidatePortRange(data.ports!);
    return data;
}
