declare var ipaddr: any;
import { ParsedConfigData, PortConfig, OspfInfo, VlanMapInfo, IpRangeInfo, SviInfo, ConnectionInfo } from '../types';

// Helper functions (copied from ciscoParser for modularity)
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
    // This function is generic and can be reused
    if (!ipaddr.IPv4.isValid(ipAddress) || !ipaddr.IPv4.isValid(subnetMask)) {
        return { ipAddress, network: "Invalid", usableRange: "Invalid", broadcast: "Invalid", subnetMask, totalAddresses: 0, usableAddresses: 0, gateway: ipAddress };
    }
    try {
        const ipAsLong = ipToLong(ipAddress);
        const maskAsLong = ipToLong(subnetMask);
        const networkAsLong = ipAsLong & maskAsLong;
        const broadcastAsLong = networkAsLong | (~maskAsLong >>> 0);
        const networkAddr = longToIp(networkAsLong);
        const broadcastAddr = longToIp(broadcastAsLong);
        const prefix = ipaddr.IPv4.parse(subnetMask).prefixLengthFromSubnetMask();
        if (prefix === null) throw new Error("Invalid subnet mask");
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
        return { ipAddress, network: "Error", usableRange: "Error", broadcast: "Error", subnetMask, totalAddresses: 0, usableAddresses: 0, gateway: ipAddress };
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

export function parseHuaweiConfigLocal(configText: string): ParsedConfigData {
    const data = getInitialParsedData();
    const lines = configText.split('\n').map(line => line.trim());
    
    let currentContext = '';
    let currentInterface: PortConfig | null = null;
    let currentVty: ConnectionInfo | null = null;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        if (line.startsWith('#') || line.length === 0) {
            if (currentContext) currentContext = '';
            if (currentInterface) { data.ports!.push(currentInterface); currentInterface = null; }
            if (currentVty) { data.connections!.push(currentVty); currentVty = null; }
            continue;
        }

        if (line === 'return') continue;

        // Global commands
        const sysnameMatch = line.match(/^sysname\s+(\S+)/);
        if (sysnameMatch) { data.hostname = sysnameMatch[1]; continue; }
        
        const versionMatch = line.match(/^VRP(?: \(R\))? software, Version\s+(.+)/);
        if (versionMatch) { data.iosVersion = versionMatch[1]; continue; }

        // VLANs
        const vlanBatchMatch = line.match(/^vlan\s+batch\s+(.*)/);
        if (vlanBatchMatch) {
            vlanBatchMatch[1].split(' ').forEach(part => {
                if (part === 'to') return;
                const prev = data.vlans![data.vlans!.length - 1];
                if (prev && lines[i-1]?.includes(prev.id) && lines[i-1]?.includes('to')) {
                     const start = parseInt(prev.id);
                     const end = parseInt(part);
                     for(let j = start + 1; j <= end; j++) {
                         data.vlans!.push({ id: j.toString(), name: `VLAN${j}` });
                     }
                } else if (!isNaN(parseInt(part))) {
                    data.vlans!.push({ id: part, name: `VLAN${part}` });
                }
            });
            continue;
        }
        
        const singleVlanMatch = line.match(/^vlan\s+(\d+)/);
        if(singleVlanMatch) {
            const vlanId = singleVlanMatch[1];
            const vlan: VlanMapInfo = { id: vlanId, name: `VLAN${vlanId}`, rawConfig: [line] };
            let j = i + 1;
            while(j < lines.length && !lines[j].startsWith('#') && !lines[j].startsWith('vlan ')) {
                const subLine = lines[j].trim();
                if (subLine.startsWith('description ')) {
                    vlan.name = subLine.replace('description ', '').trim();
                }
                vlan.rawConfig!.push(subLine);
                j++;
            }
            data.vlans!.push(vlan);
            i = j - 1;
            continue;
        }


        const ipRouteMatch = line.match(/^ip route-static 0\.0\.0\.0 0\.0\.0\.0\s+(\S+)/);
        if (ipRouteMatch) { data.routing!.defaultRoute = ipRouteMatch[1]; continue; }

        const dnsMatch = line.match(/^dns server\s+(.+)/);
        if (dnsMatch) { data.other!.dnsServers = dnsMatch[1]; continue; }

        // --- Security and AAA ---
        if (line === 'aaa') { data.aaa!.status = 'Configured'; data.aaa!.details.push("AAA Enabled"); continue; }
        const localUserMatch = line.match(/^local-user\s+(\S+)\s+password\s+.+/);
        if (localUserMatch) { data.usernames!.push({ name: localUserMatch[1], config: line }); continue; }
        if (line.includes('stelnet server enable')) data.security!.present.push('SSH Enabled');
        if (line.includes('undo http server enable')) data.security!.present.push('HTTP Server Disabled');
        if (line.includes('password-policy enable')) data.security!.present.push('Password Policy Enabled');
        
        // --- SNMP ---
        const snmpMatch = line.match(/^snmp-agent\s+(.+)/);
        if(snmpMatch) {
            data.snmp!.status = 'Configured';
            data.snmp!.details.push(snmpMatch[1].trim());
            continue;
        }

        // --- OSPF section ---
        const ospfStartMatch = line.match(/^ospf\s+(\d*)/);
        if (ospfStartMatch) {
            data.ospf!.status = 'Configured';
            data.ospf!.processId = ospfStartMatch[1] || '1';
            data.ospf!.rawConfig!.push(line);
            let areaId = '';
            let j = i + 1;
            while(j < lines.length && !lines[j].startsWith('ospf ') && lines[j] !== '#') {
                const subLine = lines[j].trim();
                if (subLine.startsWith('area ')) areaId = subLine.split(' ')[1];
                const routerIdMatch = subLine.match(/^\s*router-id\s+(\S+)/);
                if(routerIdMatch) data.ospf!.routerId = routerIdMatch[1];
                const networkMatch = subLine.match(/^\s*network\s+([\d\.]+)\s+([\d\.]+)/);
                if (networkMatch && areaId) {
                    data.ospf!.networks!.push({ network: networkMatch[1], wildcard: networkMatch[2], area: areaId });
                }
                data.ospf!.rawConfig!.push(subLine);
                j++;
            }
            i = j - 1;
            continue;
        }
        
        // --- VTY Lines ---
        const vtyMatch = line.match(/^user-interface\s+(con|vty)\s+(.+)/);
        if (vtyMatch) {
            currentVty = { type: vtyMatch[1], range: vtyMatch[2].replace(/\s/g, ''), config: [line], usernames: []};
            continue;
        }
        if (currentVty) {
            currentVty.config.push(line);
            if(line.includes('authentication-mode aaa')) currentVty.usernames.push('AAA');
        }

        // --- Interface sections ---
        const interfaceMatch = line.match(/^interface\s+(\S+)/);
        if (interfaceMatch) {
            currentContext = 'interface';
            const ifaceName = interfaceMatch[1];
            
            if (ifaceName.toLowerCase().startsWith('vlanif')) {
                const vlanId = ifaceName.replace(/vlanif/i, '');
                const svi: SviInfo = { svi: ifaceName, vlanId, ipAddress: 'unassigned', subnetMask: '', ipHelperAddress: 'N/A', status: 'up', additionalInfo: '', rawConfig: [line] };
                let j = i + 1;
                 while(j < lines.length && !lines[j].trim().startsWith('interface ') && lines[j].trim() !== '#') {
                    const subLine = lines[j].trim();
                    svi.rawConfig!.push(subLine);
                    const ipAddrMatch = subLine.match(/^\s*ip address\s+([\d\.]+)\s+([\d\.]+)/);
                    if (ipAddrMatch) {
                        svi.ipAddress = ipAddrMatch[1];
                        svi.subnetMask = ipAddrMatch[2];
                        const subnetInfo = calculateSubnetInfo(svi.ipAddress, svi.subnetMask);
                        data.ipRanges!.push({ vlanId, svi: ifaceName, ...subnetInfo, status: 'up' });
                    }
                    if (subLine.includes('shutdown')) svi.status = 'down';
                    const descMatch = subLine.match(/^\s*description\s+(.+)/);
                    if (descMatch) svi.additionalInfo += `Description: ${descMatch[1]}`;
                    j++;
                }
                data.svis!.push(svi);
                i = j - 1;
            } else { 
                currentInterface = { port: ifaceName, type: 'Physical', config: [line], description: '', status: 'up', members: [] };
                if (ifaceName.toLowerCase().startsWith('eth-trunk')) {
                    data.portChannels!.push(ifaceName);
                }
            }
            continue;
        }

        if (currentInterface) {
            currentInterface.config.push(line);
            const descMatch = line.match(/^\s*description\s+(.+)/);
            if (descMatch) {
                currentInterface.description = descMatch[1];
                if (currentInterface.description.toLowerCase().includes('uplink')) data.uplinks!.push(currentInterface.port);
            }
            if (line.includes('shutdown')) currentInterface.status = 'down';
            
            const portTypeMatch = line.match(/^\s*port link-type\s+(\S+)/);
            if (portTypeMatch) currentInterface.type = portTypeMatch[1];

            const ethTrunkMatch = line.match(/^\s*eth-trunk\s+(\d+)/);
            if (ethTrunkMatch) {
                const pc = `Eth-Trunk${ethTrunkMatch[1]}`;
                currentInterface.members.push(pc);
                if (!data.portChannels!.includes(pc)) data.portChannels!.push(pc);
            }
        }
    }
    
    data.security!.missing = ['SSH Enabled', 'HTTP Server Disabled', 'Password Policy Enabled']
        .filter(f => !data.security!.present.some(p => p.includes(f)));

    data.ports = consolidatePortRange(data.ports!);
    return data;
}
