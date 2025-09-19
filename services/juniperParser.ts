declare var ipaddr: any;
import { ParsedConfigData, PortConfig, VlanMapInfo, IpRangeInfo, SviInfo, OspfInfo } from '../types';

// Helper functions (copied from ciscoParser for modularity)
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

function calculateSubnetInfo(ipAddress: string, prefix: number): Omit<IpRangeInfo, 'vlanId'|'svi'|'status'> {
    try {
        const addr = ipaddr.IPv4.parse(ipAddress);
        const cidrAddr = addr.toCIDRString().split('/')[0] + '/' + prefix;
        const range = ipaddr.IPv4.parseCIDR(cidrAddr);
        const networkAddr = range[0].toString();
        const broadcastAddr = range[1] ? ipaddr.IPv4.broadcastAddressFromCIDR(cidrAddr).toString() : networkAddr;
        const subnetMask = ipaddr.IPv4.subnetMaskFromPrefixLength(prefix).toString();
        
        const totalAddresses = Math.pow(2, 32 - prefix);
        let usableAddresses = 0;
        let usableRange = "N/A";
        
        if (prefix < 31) {
             usableAddresses = totalAddresses > 2 ? totalAddresses - 2 : 0;
             if (usableAddresses > 0) {
                const firstUsable = ipaddr.IPv4.parse(networkAddr).toLong() + 1;
                const lastUsable = ipaddr.IPv4.parse(broadcastAddr).toLong() - 1;
                usableRange = `${ipaddr.IPv4.fromLong(firstUsable)} - ${ipaddr.IPv4.fromLong(lastUsable)}`;
             }
        } else if (prefix === 31) {
            usableAddresses = 2;
            usableRange = `${networkAddr} - ${broadcastAddr}`;
        } else { // prefix === 32
            usableAddresses = 1;
            usableRange = ipAddress;
        }

        return {
            ipAddress,
            network: networkAddr,
            usableRange,
            broadcast: broadcastAddr,
            subnetMask: `${subnetMask} (/${prefix})`,
            totalAddresses,
            usableAddresses,
            gateway: ipAddress,
        };
    } catch (e) {
        return { ipAddress, network: "Error", usableRange: "Error", broadcast: "Error", subnetMask: `/${prefix}`, totalAddresses: 0, usableAddresses: 0, gateway: ipAddress };
    }
}


export function parseJuniperConfigLocal(configText: string): ParsedConfigData {
    const data = getInitialParsedData();
    const lines = configText.split('\n').map(line => line.trim());

    let context: string[] = [];
    let currentPort: PortConfig | null = null;
    let currentVlan: VlanMapInfo | null = null;
    let l3Interfaces: { [key: string]: string } = {}; // vlan.100 -> VLAN_NAME
    
    let currentOspfArea: string | null = null;
    let currentOspfInterface: string | null = null;
    let inServices = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith('##') || line.startsWith('/*')) continue;

        if (line.endsWith('{')) {
            const blockName = line.slice(0, -1).trim();
            context.push(blockName);

            if (context.join(' ') === 'interfaces') { /* Entering interfaces block */ }
            else if (context.length === 2 && context[0] === 'interfaces') {
                if (blockName.startsWith('ae')) data.portChannels.push(blockName);
                currentPort = { port: blockName, type: 'Physical', config: [line], description: '', status: 'up', members: [] };
            }
            else if (context.join(' ') === 'vlans') { /* Entering vlans block */ }
            else if (context.length === 2 && context[0] === 'vlans') {
                currentVlan = { id: '', name: blockName, rawConfig: [line] };
            }
            else if (context.join(' ') === 'protocols ospf') {
                data.ospf.status = 'Configured';
                data.ospf.rawConfig.push(line);
            }
            else if (context.join(' ').startsWith('protocols ospf area')) {
                currentOspfArea = blockName.split(' ')[1];
            }
            else if (currentOspfArea && blockName.startsWith('interface ')) {
                currentOspfInterface = blockName.split(' ')[1];
            }
            else if (context.join(' ') === 'system services') inServices = true;
            else if (context.join(' ') === 'snmp') data.snmp.status = 'Configured';

        } else if (line.endsWith('}')) {
            const blockName = context.pop();
            
            if (data.ospf.status === 'Configured' && blockName === 'ospf') data.ospf.rawConfig.push(line);

            if (blockName && currentPort && blockName === currentPort.port) {
                data.ports.push(currentPort);
                currentPort = null;
            }
            if (blockName && currentVlan && blockName === currentVlan.name) {
                data.vlans.push(currentVlan);
                currentVlan = null;
            }
            if (blockName && blockName.startsWith('area ')) currentOspfArea = null;
            if (blockName && blockName.startsWith('interface ')) currentOspfInterface = null;
            if (blockName === 'services') inServices = false;

        } else if (line.endsWith(';')) {
            const [key, ...valueParts] = line.slice(0, -1).split(' ');
            const value = valueParts.join(' ').replace(/"/g, '');

            // System info
            if (key === 'host-name' && context.join(' ') === 'system') data.hostname = value;
            if (key === 'version' && context.length === 0) data.iosVersion = value;
            if (key === 'model' && context.join(' ') === 'version') data.modelNumber = value;
            if (key === 'name-server' && context.join(' ') === 'system') data.other.dnsServers += `${value} `;
            if (key === 'authentication-order' && context.join(' ') === 'system') {
                data.aaa.status = 'Configured';
                data.aaa.details.push(`Order: ${value}`);
            }
            const userMatch = context.join(' ').match(/^system login user (\S+)/);
            if(userMatch && key === 'class') {
                const username = userMatch[1];
                if(!data.usernames.find(u => u.name === username)) {
                    data.usernames.push({ name: username, config: `class: ${value}`});
                }
            }


            // VLANs
            if (currentVlan) currentVlan.rawConfig.push(line);
            if (key === 'vlan-id' && currentVlan) currentVlan.id = value;
            if (key === 'l3-interface' && currentVlan) l3Interfaces[value] = currentVlan.name;
            
            // Interfaces
            if (currentPort) {
                currentPort.config.push(line);
                if (key === 'description') {
                    currentPort.description = value;
                    if (value.toLowerCase().includes('uplink')) data.uplinks.push(currentPort.port);
                }
                if (key === 'disable') currentPort.status = 'down';
                if (key === 'address' && context.includes('family inet')) {
                    const [ip, prefixStr] = value.split('/');
                    const prefix = parseInt(prefixStr);
                    if (ip && prefix) {
                        const sviName = currentPort.port; 
                        const vlanName = l3Interfaces[sviName];
                        const vlan = data.vlans.find(v => v.name === vlanName);
                        const vlanId = vlan ? vlan.id : sviName.includes('.') ? sviName.split('.')[1] : 'N/A';
                        const svi: SviInfo = { svi: sviName, vlanId, ipAddress: ip, subnetMask: `/${prefix}`, ipHelperAddress: 'N/A', status: currentPort.status, additionalInfo: `VLAN: ${vlanName || 'Routed Port'}`, rawConfig: currentPort.config };
                        data.svis.push(svi);

                        const subnetInfo = calculateSubnetInfo(ip, prefix);
                        data.ipRanges.push({ vlanId, svi: sviName, ...subnetInfo, status: currentPort.status });
                    }
                }
                if (key === 'ether-options' && value.includes('802.3ad')) {
                    const lagName = value.split(' ').pop();
                    if(lagName) {
                        currentPort.members.push(lagName);
                         if (!data.portChannels.includes(lagName)) data.portChannels.push(lagName);
                    }
                }
            }
            
            // Routing & OSPF
            const defaultRouteMatch = line.match(/^route 0\.0\.0\.0\/0 next-hop (\S+);$/);
            if (defaultRouteMatch && context.join(' ') === 'routing-options static') {
                data.routing.defaultRoute = defaultRouteMatch[1];
            }
            if (data.ospf.status === 'Configured') data.ospf.rawConfig.push(line);
            if (currentOspfArea && key === 'interface' && !currentOspfInterface) {
                data.ospf.networks.push({ area: currentOspfArea, network: value, wildcard: 'N/A'});
            }
            if (currentOspfArea && currentOspfInterface && key === 'passive') {
                if(!data.ospf.passiveInterfaces.includes(currentOspfInterface)) {
                    data.ospf.passiveInterfaces.push(currentOspfInterface);
                }
            }

            // Security Services
            if (inServices) {
                if(key === 'ssh') data.security.present.push('SSH Enabled');
                if(key === 'telnet') data.security.missing.push('Telnet Enabled (Insecure)');
                if(key === 'http') data.security.missing.push('HTTP Web Management Enabled (Insecure)');
                if(key === 'https') data.security.present.push('HTTPS Web Management Enabled');
            }
            
            // SNMP
            if(context[0] === 'snmp' && key === 'community') {
                data.snmp.details.push(line);
            }
        }
    }
    
    // Cleanup and final associations
    data.other.dnsServers = data.other.dnsServers.trim();

    return data;
}