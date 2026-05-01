import React from 'react';

export default function LoadingSpinner({ size = 'md', className = '' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' };
  return (
    <div className={`${sizes[size]} border-2 border-slate-600 border-t-brand-500 rounded-full animate-spin ${className}`} />
  );
}
