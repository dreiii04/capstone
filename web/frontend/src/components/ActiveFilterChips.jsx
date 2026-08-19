import React from 'react';
import { X } from 'lucide-react';

const ActiveFilterChips = ({ filters, onRemove }) => {
  // filters = [{ label: 'Status', value: 'Active', key: 'status' }]
  const activeFilters = filters.filter(f => f.value && f.value !== 'All' && f.value !== 'All Status' && f.value !== 'All Modes');

  if (activeFilters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 mt-4 mb-2">
      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">Active Filters:</span>
      {activeFilters.map((filter, index) => (
        <div 
          key={index} 
          className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold rounded-full shadow-sm"
        >
          <span><span className="text-blue-500 opacity-70">{filter.label}:</span> {filter.value}</span>
          <button 
            onClick={() => onRemove(filter.key)}
            className="p-0.5 hover:bg-blue-200 rounded-full transition-colors text-blue-500 hover:text-blue-800"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default ActiveFilterChips;
