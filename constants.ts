import { VendorName, SupportedVendor, PieChartData } from './types';

export const APP_TITLE = "NetConfig Analyzer";
export const APP_SUBTITLE = "Automated analysis and conflict detection for diverse network device configurations";

export const GEMINI_TEXT_MODEL = "gemini-2.5-flash";

export const SUPPORTED_VENDORS_DATA: SupportedVendor[] = [
  { name: VendorName.CISCO, extensions: [".txt", ".cfg", ".log"], os: ["IOS", "NX-OS"] },
  { name: VendorName.HUAWEI, extensions: [".txt", ".cfg", ".dat"], os: ["VRP"] },
  { name: VendorName.JUNIPER, extensions: [".txt", ".cfg", ".conf"], os: ["Junos"] },
  { name: VendorName.H3C, extensions: [".cfg", ".txt"], os: ["Comware"] },
];

export const PIE_CHART_DATA: PieChartData[] = [
  { name: "Interfaces", value: 30 },
  { name: "Routing Protocols", value: 25 },
  { name: "VLANs/SVIs", value: 20 },
  { name: "Security Policies", value: 15 },
  { name: "System Info", value: 10 },
];

export const KEY_CONFIG_ELEMENTS_TO_PARSE: string[] = [
  "Device Information: Hostname, OS version, model, serial number, uptime.",
  "Interfaces: IP addresses, subnet masks, descriptions, status, speed/duplex, port-channels.",
  "VLANs & SVIs: VLAN IDs, names, SVI IP addresses, helper addresses, network ranges, free IPs.",
  "Routing Protocols: OSPF, EIGRP, BGP configurations, static routes, default gateways.",
  "Security Features: AAA, SSH, SNMP, password encryption, ACLs, firewall rules.",
  "Other Services: NTP, DNS, VTP, CDP/LLDP.",
];

export const CORE_FEATURES_DATA = [
    {
      id: "ingestion",
      title: "Single File Ingestion",
      description: "Upload and parse a configuration file from Cisco, Juniper, Huawei, or H3C."
    },
    {
      id: "parsing",
      title: "Multi-Vendor Parsing",
      description: "Extracts structured data from raw configurations (interfaces, VLANs, routing, etc.)."
    },
    {
      id: "analysis",
      title: "AI-Powered Audit",
      description: "Audits configurations for security risks and best practices, providing CLI remediation commands."
    },
    {
      id: "reporting",
      title: "Interactive Reporting",
      description: "Visualizes parsed data and highlights findings in a clean, easy-to-read report."
    },
    {
      id: "export",
      title: "PDF Export",
      description: "Generates a detailed PDF of the full configuration and analysis report for documentation."
    },
    {
      id: "cli-helper",
      title: "CLI Command Helper",
      description: "Instantly get CLI commands for various vendors by describing tasks in natural language."
    }
  ];

export const DATABASE_SCHEMA_DEVICES = `
CREATE TABLE devices (
  device_id UUID PRIMARY KEY,
  hostname VARCHAR(255) NOT NULL,
  vendor VARCHAR(50) NOT NULL,
  os_version VARCHAR(100),
  model VARCHAR(100),
  last_parsed TIMESTAMP,
  raw_config TEXT
);`;

export const DATABASE_SCHEMA_INTERFACES = `
CREATE TABLE interfaces (
  interface_id UUID PRIMARY KEY,
  device_id UUID REFERENCES devices(device_id),
  name VARCHAR(100) NOT NULL,
  ip_address INET,
  subnet_mask INET,
  description TEXT,
  status VARCHAR(50),
  is_uplink BOOLEAN,
  port_channel_member_of UUID -- REFERENCES port_channels(port_channel_id)
  -- Assuming port_channels table exists
);`;

export const DATABASE_SCHEMA_VLANS = `
CREATE TABLE vlans (
  vlan_id UUID PRIMARY KEY,
  device_id UUID REFERENCES devices(device_id),
  vlan_number INTEGER NOT NULL,
  name VARCHAR(255),
  svi_ip INET,
  svi_subnet_mask INET,
  network_address INET,
  broadcast_address INET,
  usable_ip_range TEXT,
  free_ip_count INTEGER
);`;

export const DATABASE_SCHEMA_CONFLICTS = `
CREATE TABLE conflicts (
  conflict_id UUID PRIMARY KEY,
  device_id_1 UUID REFERENCES devices(device_id),
  device_id_2 UUID REFERENCES devices(device_id),
  conflict_type VARCHAR(100) NOT NULL,
  description TEXT,
  severity VARCHAR(50),
  details JSONB
);`;

export const WORKFLOW_SEQUENCE_DIAGRAM_TEXT = `
User->>Platform: Upload Config Files (Cisco, Huawei, Juniper)
Platform->>Parsing Engine (Gemini): Process each file by vendor
Parsing Engine (Gemini)->>Data Normalization: Convert to common schema
Data Normalization->>Internal State: Store structured data
Internal State->>Conflict Detection (Gemini): Retrieve multiple device configs
Conflict Detection (Gemini)->>User Dashboard: Display identified conflicts
User Dashboard->>Reporting Module (Simulated): Generate PDF/Excel reports
`;

export const ROADMAP_DATA = [
    { timeline: "Quarter 1", focus: "Core multi-vendor parsing, basic conflict detection (IPs, VLANs)" },
    { timeline: "Quarter 2", focus: "Advanced conflict detection (routing, security policies), improved reporting" },
    { timeline: "Quarter 3", focus: "Support for additional vendors (Fortinet, Palo Alto, Juniper, Huawei)" },
    { timeline: "Quarter 4", focus: "Auditing against best practices" },
];

export const KEY_DIFFERENTIATORS_DATA = [
    "**Multi-Vendor Support**: Unified platform for diverse network environments.",
    "**Automated Conflict Detection**: Proactive identification of configuration issues powered by AI.",
    "**Structured Data & Reporting**: Easy analysis and documentation.",
    "**Extensible Architecture**: Designed for future vendor and feature additions."
];

export const CONFLICT_DETECTION_EXAMPLES = [
    "Identify active interfaces or SVIs that are missing a description",
    "Detect insecure configurations like disabled password encryption or enabled HTTP servers",
    "Flag access ports that are missing port-security configurations"
];