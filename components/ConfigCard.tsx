import React from 'react';
import { ParsedConfigData } from '../types';

interface ConfigCardProps {
  config: ParsedConfigData;
}

const DetailItem: React.FC<{ label: string; value?: string | number | React.ReactNode }> = ({ label, value }) => {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) return null;
  return (
    <div className="mb-1 text-sm">
      <span className="font-semibold text-gray-300">{label}: </span>
      <span className="text-gray-400">{typeof value === 'object' ? JSON.stringify(value, null, 2) : value}</span>
    </div>
  );
};

const ConfigCard: React.FC<ConfigCardProps> = ({ config }) => {
  return (
    <div className="bg-slate-700/70 p-4 rounded-lg shadow-lg mb-4 border border-slate-600">
      <h3 className="text-lg font-semibold text-sky-400 mb-3">
        {config.fileName || 'Parsed Configuration'} ({config.vendor})
      </h3>
      {config.deviceInfo && (
        <div className="mb-3 p-3 bg-slate-800/50 rounded-md">
          <h4 className="font-medium text-gray-200 mb-1">Device Info</h4>
          <DetailItem label="Hostname" value={config.deviceInfo.hostname} />
          <DetailItem label="OS Version" value={config.deviceInfo.os_version} />
          <DetailItem label="Model" value={config.deviceInfo.model} />
          <DetailItem label="Serial Number" value={config.deviceInfo.serial_number} />
          <DetailItem label="Uptime" value={config.deviceInfo.uptime} />
        </div>
      )}
      {config.interfaces && config.interfaces.length > 0 && (
        <div className="mb-3 p-3 bg-slate-800/50 rounded-md">
          <h4 className="font-medium text-gray-200 mb-1">Interfaces ({config.interfaces.length})</h4>
          {config.interfaces.slice(0, 5).map((iface, index) => ( // Show first 5 interfaces
            <div key={index} className="mb-2 pl-2 border-l-2 border-slate-600">
              <DetailItem label="Name" value={iface.name} />
              <DetailItem label="IP Address" value={iface.ip_address} />
              <DetailItem label="Description" value={iface.description} />
              <DetailItem label="Status" value={iface.status} />
            </div>
          ))}
          {config.interfaces.length > 5 && <p className="text-xs text-gray-500 mt-1">...and {config.interfaces.length - 5} more interfaces.</p>}
        </div>
      )}
      {config.vlansSvis && config.vlansSvis.length > 0 && (
         <div className="mb-3 p-3 bg-slate-800/50 rounded-md">
          <h4 className="font-medium text-gray-200 mb-1">VLANs/SVIs ({config.vlansSvis.length})</h4>
          {config.vlansSvis.slice(0,3).map((vlan, index) => ( // Show first 3 VLANs
            <div key={index} className="mb-2 pl-2 border-l-2 border-slate-600">
              <DetailItem label="VLAN ID" value={vlan.vlan_id} />
              <DetailItem label="Name" value={vlan.name} />
              <DetailItem label="SVI IP" value={vlan.svi_ip_address} />
            </div>
          ))}
          {config.vlansSvis.length > 3 && <p className="text-xs text-gray-500 mt-1">...and {config.vlansSvis.length - 3} more VLANs/SVIs.</p>}
        </div>
      )}
       {config.routingProtocols && config.routingProtocols.length > 0 && (
        <div className="mb-3 p-3 bg-slate-800/50 rounded-md">
          <h4 className="font-medium text-gray-200 mb-1">Routing Protocols ({config.routingProtocols.length})</h4>
          {config.routingProtocols.slice(0,3).map((proto, index) => (
            <div key={index} className="mb-2 pl-2 border-l-2 border-slate-600">
              <DetailItem label="Protocol" value={proto.protocol} />
              <DetailItem label="Details" value={(() => {
                if (!proto.details) return undefined;
                const str = typeof proto.details === 'string' ? proto.details : JSON.stringify(proto.details);
                if (!str) return undefined;
                return str.substring(0, 100) + '...';
              })()} />
            </div>
          ))}
           {config.routingProtocols.length > 3 && <p className="text-xs text-gray-500 mt-1">...and {config.routingProtocols.length - 3} more routing entries.</p>}
        </div>
      )}
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-gray-400 hover:text-sky-400">Show Raw Config (Excerpt)</summary>
        <pre className="mt-1 p-2 bg-slate-800 rounded text-xs overflow-auto max-h-40 text-gray-300">
          {config.rawConfig ? config.rawConfig.substring(0, 500) + (config.rawConfig.length > 500 ? '...' : '') : 'N/A'}
        </pre>
      </details>
    </div>
  );
};

export default ConfigCard;