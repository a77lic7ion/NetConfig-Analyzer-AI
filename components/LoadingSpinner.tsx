

import React from 'react';

interface LoadingSpinnerProps {
  text?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ text = "Loading..." }) => {
  return (
    <div className="flex flex-col items-center justify-center p-4 my-6">
      <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-brand-primary mb-3"></div>
      <p className="text-medium-text">{text}</p>
    </div>
  );
};

export default LoadingSpinner;