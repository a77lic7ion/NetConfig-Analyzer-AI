import { ParsedConfigData, PortConfig, VlanMapInfo } from '../types';

export function parseJuniperConfigLocal(configText: string): ParsedConfigData {
    const data: ParsedConfigData = {
        hostname: 'juniper-device',
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
    let currentInterface: PortConfig | null = null;

    for (const line of lines) {
        const trimmedLine = line.trim();

        if (trimmedLine.startsWith('set system host-name')) {
            data.hostname = trimmedLine.split(' ')[3];
        } else if (trimmedLine.startsWith('set interfaces')) {
            const parts = trimmedLine.split(' ');
            const interfaceName = parts[2];
            if (!currentInterface || currentInterface.port !== interfaceName) {
                if (currentInterface) {
                    data.ports!.push(currentInterface);
                }
                currentInterface = {
                    port: interfaceName,
                    type: '',
                    description: '',
                    status: 'Enabled',
                    config: [trimmedLine],
                    members: []
                };
            } else {
                currentInterface.config.push(trimmedLine);
            }

            if (trimmedLine.includes('description')) {
                currentInterface.description = trimmedLine.split('description "')[1].slice(0, -1);
            }
            if (trimmedLine.includes('disable')) {
                currentInterface.status = 'Disabled';
            }
            if (trimmedLine.includes('ether-options')) {
                currentInterface.type = 'Physical';
            }
        } else if (trimmedLine.startsWith('set vlans')) {
            const parts = trimmedLine.split(' ');
            const vlanName = parts[2];
            const vlanId = parts[4];
            const existingVlan = data.vlans!.find(v => v.name === vlanName);
            if (!existingVlan) {
                data.vlans!.push({
                    id: vlanId,
                    name: vlanName,
                    rawConfig: [trimmedLine]
                });
            } else {
                existingVlan.rawConfig!.push(trimmedLine);
            }
        }
    }

    if (currentInterface) {
        data.ports!.push(currentInterface);
    }

    return data;
}
