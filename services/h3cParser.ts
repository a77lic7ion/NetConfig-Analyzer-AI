declare var ipaddr: any;
import { ParsedConfigData, PortConfig, OspfInfo, VlanMapInfo, IpRangeInfo, SviInfo } from '../types';

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
        const usableAddresses = totalAddresses > 2 ? totalAddresses - 2 : 0;
        const firstUsable = usableAddresses > 0 ? longToIp(networkAsLong + 1) : "N/A";
        const lastUsable = usableAddresses > 0 ? longToIp(broadcastAsLong - 1) : "N/A";
        return {
            ipAddress,
            network: networkAddr,
            usableRange: usableAddresses > 0 ? `${firstUsable} - ${lastUsable}` : "N/A",
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


export function parseH3cConfigLocal(configText: string): ParsedConfigData {
    const data = getInitialParsedData();
    const lines = configText.split('\n').map(line => line.trim());
    
    let currentInterface: PortConfig | null = null;
    let inOspfSection = false;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        if (line.startsWith('#')) continue;

        // Global commands
        const sysnameMatch = line.match(/^sysname\s+(\S+)/);
        if (sysnameMatch) data.hostname = sysnameMatch[1];
        
        const versionMatch = line.match(/^Comware Software, Version\s+(.+)/);
        if (versionMatch) data.iosVersion = versionMatch[1];

        const vlanMatch = line.match(/^vlan\s+(\d+)/);
        if (vlanMatch) {
            const vlanId = vlanMatch[1];
            const vlan: VlanMapInfo = { id: vlanId, name: `VLAN${vlanId}`, rawConfig: [line] };
            if (i + 1 < lines.length && lines[i + 1].startsWith(' name ')) {
                vlan.name = lines[i+1].replace('name ', '').trim();
                vlan.rawConfig.push(lines[i+1]);
                i++;
            }
            data.vlans!.push(vlan);
        }

        const ipRouteMatch = line.match(/^ip route-static 0\.0\.0\.0 0\.0\.0\.0\s+(\S+)/);
        if (ipRouteMatch) data.routing!.defaultRoute = ipRouteMatch[1];

        const dnsMatch = line.match(/^dns server\s+(.+)/);
        if (dnsMatch) data.other!.dnsServers = dnsMatch[1];

        // OSPF section
        const ospfStartMatch = line.match(/^ospf\s+(\d*)/);
        if (ospfStartMatch) {
            inOspfSection = true;
            data.ospf!.status = 'Configured';
            data.ospf!.processId = ospfStartMatch[1] || '1';
            data.ospf!.rawConfig!.push(line);
            
            let areaId = '';
            while(i + 1 < lines.length) {
                i++;
                line = lines[i];
                if (line.startsWith('#') || line === ']') break;
                data.ospf!.rawConfig!.push(line);
                const areaMatch = line.match(/^\s*area\s+(\S+)/);
                if (areaMatch) areaId = areaMatch[1];
                
                const routerIdMatch = line.match(/^\s*router-id\s+(\S+)/);
                if(routerIdMatch) data.ospf!.routerId = routerIdMatch[1];

                const networkMatch = line.match(/^\s*network\s+([\d\.]+)\s+([\d\.]+)/);
                if (networkMatch && areaId) {
                    data.ospf!.networks!.push({ network: networkMatch[1], wildcard: networkMatch[2], area: areaId });
                }
            }
            inOspfSection = false;
        }

        // Interface sections (physical and SVI)
        const interfaceMatch = line.match(/^interface\s+(\S+)/);
        if (interfaceMatch) {
            const ifaceName = interfaceMatch[1];
            
            // SVI (Vlan-interface)
            if (ifaceName.toLowerCase().startsWith('vlan-interface')) {
                const vlanId = ifaceName.replace(/vlan-interface/i, '');
                const svi: SviInfo = { svi: ifaceName, vlanId, ipAddress: 'unassigned', subnetMask: '', ipHelperAddress: 'N/A', status: 'up', additionalInfo: '', rawConfig: [line] };
                
                while(i + 1 < lines.length && !lines[i + 1].startsWith('interface ') && !lines[i + 1].startsWith('#')) {
                    i++;
                    line = lines[i];
                    svi.rawConfig!.push(line);
                    const ipAddrMatch = line.match(/^\s*ip address\s+([\d\.]+)\s+([\d\.]+)/);
                    if (ipAddrMatch) {
                        svi.ipAddress = ipAddrMatch[1];
                        svi.subnetMask = ipAddrMatch[2];
                        const subnetInfo = calculateSubnetInfo(svi.ipAddress, svi.subnetMask);
                        data.ipRanges!.push({ vlanId, svi: ifaceName, ...subnetInfo, status: 'up' });
                    }
                    if (line.includes('shutdown')) svi.status = 'down';
                    const descMatch = line.match(/^\s*description\s+(.+)/);
                    if (descMatch) svi.additionalInfo += `Description: ${descMatch[1]}`;
                }
                data.svis!.push(svi);

            } else { // Physical Interface
                currentInterface = { port: ifaceName, type: 'Physical', config: [line], description: '', status: 'up', members: [] };
                 if (ifaceName.toLowerCase().startsWith('bridge-aggregation')) {
                    data.portChannels!.push(ifaceName);
                }
                while(i + 1 < lines.length && !lines[i + 1].startsWith('interface ') && !lines[i + 1].startsWith('#')) {
                    i++;
                    line = lines[i];
                    currentInterface.config.push(line);
                    const descMatch = line.match(/^\s*description\s+(.+)/);
                    if (descMatch) {
                        currentInterface.description = descMatch[1];
                        if (currentInterface.description.toLowerCase().includes('uplink')) data.uplinks!.push(currentInterface.port);
                    }
                    if (line.includes('shutdown')) currentInterface.status = 'down';
                    
                    const portTypeMatch = line.match(/^\s*port link-type\s+(\S+)/);
                    if (portTypeMatch) currentInterface.type = portTypeMatch[1];

                    const linkAggMatch = line.match(/^\s*port link-aggregation group\s+(\d+)/);
                    if (linkAggMatch) {
                        const pc = `Bridge-Aggregation${linkAggMatch[1]}`;
                        currentInterface.members.push(pc);
                        if (!data.portChannels!.includes(pc)) data.portChannels!.push(pc);
                    }
                }
                data.ports!.push(currentInterface);
            }
        }
    }
    
    data.ports = consolidatePortRange(data.ports!);
    return data;
}
