export enum VendorName {
  CISCO = "Cisco",
  HUAWEI = "Huawei",
  JUNIPER = "Juniper",
  H3C = "H3C",
  ALL = "All"
}

export interface SupportedVendor {
  name: VendorName;
  extensions: string[];
  os: string[];
}

export interface UploadedFile {
  id: string;
  name: string;
  content: string;
  vendor: VendorName;
}

// --- DATA STRUCTURES FROM CISCO PARSER ---

export interface PortConfig {
    port: string;
    type: string;
    description: string;
    status: string;
    config: string[];
    members: string[];
}

export interface SviInfo {
    svi: string;
    vlanId: string;
    ipAddress: string;
    subnetMask: string;
    ipHelperAddress: string;
    status: string;
    additionalInfo: string;
    rawConfig?: string[];
}

export interface VlanMapInfo {
    id: string;
    name: string;
    rawConfig?: string[];
}

export interface IpRangeInfo {
    vlanId: string;
    svi: string;
    ipAddress: string;
    subnetMask: string;
    network: string;
    usableRange: string;
    broadcast: string;
    totalAddresses: number;
    usableAddresses: number;
    gateway: string;
    status: string;
}

export interface OspfNetwork {
    network: string;
    wildcard: string;
    area: string;
}

export interface OspfInfo {
    status: 'Configured' | 'Not configured';
    processId?: string;
    routerId?: string;
    networks?: OspfNetwork[];
    passiveInterfaces?: string[];
    details: string[]; // For other non-structured details
    rawConfig: string[];
}


export interface SnmpAcl {
    name: string;
    rules: string[];
}

export interface SnmpInfo {
    status: string;
    details: string[];
    acls: SnmpAcl[];
}

export interface DhcpPoolInfo {
    name: string;
    config: string[];
}

export interface AaaInfo {
    status: string;
    details: string[];
}

export interface ConnectionInfo {
    type: string;
    range: string;
    port?: string;
    description?: string;
    status?: string;
    config: string[];
    usernames: string[];
}

export interface RoutingInfo {
    defaultGateway: string;
    defaultRoute: string;
}

export interface SecurityCompliance {
    present: string[];
    missing: string[];
}

// Re-defining the core data structure to be richer
export interface ParsedConfigData {
  // --- METADATA ---
  fileName?: string;
  vendor?: VendorName;
  rawConfig?: string;

  // --- PARSED DATA (Primarily from Cisco Parser) ---
  hostname?: string;
  iosVersion?: string;
  modelNumber?: string;
  
  vlans?: VlanMapInfo[];
  svis?: SviInfo[];
  ipRanges?: IpRangeInfo[];
  
  ports?: PortConfig[];
  uplinks?: string[];
  portChannels?: string[];
  
  routing?: RoutingInfo;
  ospf?: OspfInfo;
  
  dhcpPools?: DhcpPoolInfo[];
  other?: {
    dnsServers: string;
    domain: string;
  };
  
  aaa?: AaaInfo;
  snmp?: SnmpInfo;
  
  connections?: ConnectionInfo[];
  usernames?: {name: string, config: string}[];

  security?: SecurityCompliance;

  // --- LEGACY/GEMINI PARSED DATA (for other vendors) ---
  deviceInfo?: any;
  interfaces?: any[];
  vlansSvis?: any[];
  routingProtocols?: any[];
  securityFeatures?: any[];
}


export interface PieChartData {
  name: string;
  value: number;
}

export interface RemediationCommand {
  command: string;
  context: string;
}

export interface AnalysisFinding {
  id: string;
  type: 'Conflict' | 'Suggestion' | 'Security Risk' | 'Best Practice';
  description: string;
  devicesInvolved: string[];
  details: any;
  recommendation: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low' | 'Info';
  remediationCommands?: RemediationCommand[];
}

export interface CliCommandResponse {
    command: string;
    explanation: string;
}

export interface CliScriptResponse {
    script: string;
}
