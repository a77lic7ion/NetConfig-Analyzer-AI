import React from 'react';
import { VendorName } from '../types';

interface VendorLogoProps {
  vendor: VendorName;
  className?: string;
}

const CiscoLogo: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 230 60" xmlns="http://www.w3.org/2000/svg" className={className} aria-label="Cisco logo">
    <g fill="#00BCEB">
      <title>Cisco Logo</title>
      <rect x="10" y="22" width="7" height="16" />
      <rect x="22" y="18" width="7" height="24" />
      <rect x="34" y="10" width="7" height="40" />
      <rect x="46" y="18" width="7" height="24" />
      <rect x="58" y="22" width="7" height="16" />
      <text x="75" y="45" fontFamily="sans-serif" fontWeight="bold" fontSize="40px">CISCO</text>
    </g>
  </svg>
);

const HuaweiLogo: React.FC<{ className?: string }> = ({ className }) => (
    <svg viewBox="0 0 300 60" xmlns="http://www.w3.org/2000/svg" className={className} aria-label="Huawei logo">
        <title>Huawei Logo</title>
        <g transform="translate(40, 30) scale(0.6)">
            <g fill="#E21C21">
                <path d="M-6.4,36.5C-11,28.4-15.1,19.6-18.4,10.5h36.9c-3.4,9.1-7.4,17.9-12,26C2.1,43.2-2.1,43.2-6.4,36.5z" transform="rotate(22.5)"/>
                <path d="M-6.4,36.5C-11,28.4-15.1,19.6-18.4,10.5h36.9c-3.4,9.1-7.4,17.9-12,26C2.1,43.2-2.1,43.2-6.4,36.5z" transform="rotate(67.5)"/>
                <path d="M-6.4,36.5C-11,28.4-15.1,19.6-18.4,10.5h36.9c-3.4,9.1-7.4,17.9-12,26C2.1,43.2-2.1,43.2-6.4,36.5z" transform="rotate(112.5)"/>
                <path d="M-6.4,36.5C-11,28.4-15.1,19.6-18.4,10.5h36.9c-3.4,9.1-7.4,17.9-12,26C2.1,43.2-2.1,43.2-6.4,36.5z" transform="rotate(157.5)"/>
                <path d="M-6.4,36.5C-11,28.4-15.1,19.6-18.4,10.5h36.9c-3.4,9.1-7.4,17.9-12,26C2.1,43.2-2.1,43.2-6.4,36.5z" transform="rotate(202.5)"/>
                <path d="M-6.4,36.5C-11,28.4-15.1,19.6-18.4,10.5h36.9c-3.4,9.1-7.4,17.9-12,26C2.1,43.2-2.1,43.2-6.4,36.5z" transform="rotate(247.5)"/>
                <path d="M-6.4,36.5C-11,28.4-15.1,19.6-18.4,10.5h36.9c-3.4,9.1-7.4,17.9-12,26C2.1,43.2-2.1,43.2-6.4,36.5z" transform="rotate(292.5)"/>
                <path d="M-6.4,36.5C-11,28.4-15.1,19.6-18.4,10.5h36.9c-3.4,9.1-7.4,17.9-12,26C2.1,43.2-2.1,43.2-6.4,36.5z" transform="rotate(337.5)"/>
            </g>
        </g>
        <text x="90" y="45" fontFamily="sans-serif" fontWeight="bold" fontSize="40px" fill="#231F20">HUAWEI</text>
    </svg>
);

const JuniperLogo: React.FC<{ className?: string }> = ({ className }) => (
    <svg viewBox="0 0 300 60" xmlns="http://www.w3.org/2000/svg" className={className} aria-label="Juniper Networks logo">
        <title>Juniper Networks Logo</title>
        <text x="5" y="40" fontFamily="sans-serif" fontSize="38px" fill="#231F20" style={{fontStretch: 'condensed', letterSpacing: '-1.5px'}}>juniper</text>
        <text x="160" y="38" fontFamily="sans-serif" fontWeight="600" fontSize="22px" fill="#69a84f">NETWORKS</text>
    </svg>
);

const H3CLogo: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 150 60" xmlns="http://www.w3.org/2000/svg" className={className} aria-label="H3C logo">
    <title>H3C Logo</title>
    <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontFamily="sans-serif" fontWeight="bold" fontSize="50px" fill="#D01015">H3C</text>
  </svg>
);

const DefaultLogo: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-label="Default device logo">
      <title>Default Network Device Logo</title>
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
      <line x1="6" y1="6" x2="6.01" y2="6"></line>
      <line x1="10" y1="6" x2="10.01" y2="6"></line>
      <line x1="6" y1="18" x2="6.01" y2="18"></line>
      <line x1="10" y1="18" x2="10.01" y2="18"></line>
    </svg>
);

const VendorLogo: React.FC<VendorLogoProps> = ({ vendor, className = '' }) => {
  switch (vendor) {
    case VendorName.CISCO:
      return <CiscoLogo className={className} />;
    case VendorName.HUAWEI:
      return <HuaweiLogo className={className} />;
    case VendorName.JUNIPER:
      return <JuniperLogo className={className} />;
    case VendorName.H3C:
      return <H3CLogo className={className} />;
    default:
      return <DefaultLogo className={className} />;
  }
};

export default VendorLogo;