

import React from 'react';

interface SectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  titleClassName?: string;
  id?: string;
}

const Section: React.FC<SectionProps> = ({ title, children, className = '', titleClassName = '', id }) => {
  return (
    <section id={id} className={`py-8 px-4 md:px-6 lg:px-8 bg-medium-background/60 shadow-xl rounded-xl mb-8 backdrop-blur-sm ${className}`}>
      <h2 className={`text-2xl md:text-3xl font-bold text-brand-primary mb-6 pb-2 border-b-2 border-orange-800/70 ${titleClassName}`}>
        {title}
      </h2>
      <div className="text-medium-text">
        {children}
      </div>
    </section>
  );
};

export default Section;