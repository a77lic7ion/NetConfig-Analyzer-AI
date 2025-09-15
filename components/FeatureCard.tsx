import React from 'react';

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description }) => {
  return (
    <div className="bg-light-background/50 p-6 rounded-lg text-center transition-all duration-300 hover:bg-light-background hover:scale-105 shadow-lg border border-transparent hover:border-brand-primary">
      <div className="flex items-center justify-center h-16 w-16 rounded-full bg-brand-primary/20 text-brand-primary mx-auto mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-dark-text mb-2">{title}</h3>
      <p className="text-sm text-medium-text">{description}</p>
    </div>
  );
};

export default FeatureCard;
