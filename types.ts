export enum VendorName {
  CISCO = "Cisco",
  HUAWEI = "Huawei",
  JUNIPER = "Juniper",
  H3C = "H3C",
  ALL = "All"
}

export enum LlmProvider {
  GEMINI = "gemini",
  OPENAI = "openai",
  OLLAMA = "ollama",
}

export interface LlmSettings {
  provider: LlmProvider;
  openAi: {
    apiKey: string;
    model: string;
  };
  ollama: {
    baseUrl: string;
    model: string;
  };
  useLlmForAnalysis: boolean;
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

export interface ChatMessage {
  role: 'user' | 'agent';
  content: string;
  sources?: {
    title: string;
    uri: string;
  }[];
}

// --- DATA STRUCTURES FROM CISCO PARSER ---

export interface PortConfig {
    port: string;
    type: string;
    config: string[];
    description: string;
    status: string;
    members: string[];
}
export interface VlanMapInfo {
    id: string;
    name: string;
    rawConfig?: string[];
}
export interface IpRangeInfo {
    vlanId: string;
    svi: string;
    status: string;
    ipAddress: string;
    network: string;
    usableRange: string;
    broadcast: string;
    subnetMask: string;
    totalAddresses: number;
    usableAddresses: number;
    gateway: string;
}
export interface OspfNetwork {
    network: string;
    wildcard: string;
    area: string;
}
export interface OspfInfo {
    status: string;
    processId?: string;
    routerId?: string;
    details: string[];
    rawConfig: string[];
    networks: OspfNetwork[];
    passiveInterfaces: string[];
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
    config: string[];
    usernames: string[];
    description?: string;
}
export interface RoutingInfo {
    defaultGateway: string;
    defaultRoute: string;
}
export interface SecurityCompliance {
    present: string[];
    missing: string[];
}
export interface UsernameInfo {
    name: string;
    config: string;
}
export interface ParsedConfigData {
    // Top-level metadata
    fileName?: string;
    vendor?: VendorName;
    rawConfig?: string;
    
    // Legacy Gemini Parser Fields
    deviceInfo?: any;
    interfaces?: any[];
    vlansSvis?: any[];
    routingProtocols?: any[];
    securityFeatures?: any;

    // Detailed Local Parser Fields
    hostname?: string;
    iosVersion?: string;
    modelNumber?: string;
    vlans?: VlanMapInfo[];
    ipRanges?: IpRangeInfo[];
    ospf?: OspfInfo;
    snmp?: SnmpInfo;
    svis?: SviInfo[];
    dhcpPools?: DhcpPoolInfo[];
    aaa?: AaaInfo;
    other?: { dnsServers: string, domain: string };
    connections?: ConnectionInfo[];
    usernames?: UsernameInfo[];
    ports?: PortConfig[];
    uplinks?: string[];
    portChannels?: string[];
    routing?: RoutingInfo;
    security?: SecurityCompliance;
}


// --- ANALYSIS & CLI ---

export interface RemediationCommand {
  command: string;
  context: string;
}

export interface AnalysisFinding {
  id: string;
  type: 'Security Risk' | 'Best Practice' | 'Conflict' | 'Suggestion';
  severity: 'Critical' | 'High' | 'Medium' | 'Low' | 'Info';
  description: string;
  devicesInvolved: string[];
  details: any;
  recommendation: string;
  remediationCommands: RemediationCommand[];
}

export interface PieChartData {
    name: string;
    value: number;
}

export interface CliCommandResponse {
    command: string;
    explanation: string;
}
export interface CliScriptResponse {
    script: string;
}
