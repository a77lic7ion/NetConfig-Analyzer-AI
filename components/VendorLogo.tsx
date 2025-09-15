import React from 'react';
import { VendorName } from '../types';
import { SUPPORTED_VENDORS_DATA } from '../constants';

interface VendorLogoProps {
  vendor: VendorName;
  className?: string;
}

const VendorLogo: React.FC<VendorLogoProps> = ({ vendor, className = '' }) => {
  const vendorData = SUPPORTED_VENDORS_DATA.find(v => v.name === vendor);
  const logoSrc = vendorData ? vendorData.logo : '/logos/default.svg';

  return (
    <img
      src={logoSrc}
      alt={`${vendor} logo`}
      className={`object-contain ${className}`}
      aria-label={`${vendor} logo`}
    />
  );
};

export default VendorLogo;
