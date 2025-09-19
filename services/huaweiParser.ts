import { ParsedConfigData, PortConfig, VlanMapInfo } from '../types';

export function parseHuaweiConfigLocal(configText: string): ParsedConfigData {
    const data: ParsedConfigData = {
        hostname: 'huawei-device',
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

    const lines = configText.split('\n');
    let inInterfaceSection = false;
    let currentInterface: PortConfig | null = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.startsWith('sysname')) {
            data.hostname = line.split(' ')[1];
        } else if (line.startsWith('interface')) {
            inInterfaceSection = true;
            if (currentInterface) {
                data.ports!.push(currentInterface);
            }
            const interfaceName = line.split(' ')[1];
            currentInterface = {
                port: interfaceName,
                type: '',
                description: '',
                status: 'Enabled',
                config: [line],
                members: []
            };
        } else if (inInterfaceSection && line.startsWith('#')) {
            inInterfaceSection = false;
            if (currentInterface) {
                data.ports!.push(currentInterface);
                currentInterface = null;
            }
        } else if (inInterfaceSection && currentInterface) {
            currentInterface.config.push(line);
            if (line.startsWith('description')) {
                currentInterface.description = line.split('description ')[1];
            }
            if (line.startsWith('shutdown')) {
                currentInterface.status = 'Disabled';
            }
        } else if (line.startsWith('vlan batch')) {
            const vlanIds = line.split('vlan batch ')[1].split(' ');
            for (const vlanId of vlanIds) {
                if (vlanId.includes('to')) {
                    const [start, end] = vlanId.split('to').map(Number);
                    for (let i = start; i <= end; i++) {
                        data.vlans!.push({ id: String(i), name: `VLAN${i}`, rawConfig: [line] });
                    }
                } else {
                    data.vlans!.push({ id: vlanId, name: `VLAN${vlanId}`, rawConfig: [line] });
                }
            }
        }
    }

    if (currentInterface) {
        data.ports!.push(currentInterface);
    }

    return data;
}
