import React, { useEffect, useRef } from 'react';
import { X, RotateCcw } from 'lucide-react';

const FilterDrawer = ({ isOpen, onClose, onClearAll, children, title = "Filters & Sort" }) => {
  const drawerRef = useRef(null);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleEscape);
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // Handle clicking on the backdrop to close
  const handleBackdropClick = (e) => {
    if (drawerRef.current && !drawerRef.current.contains(e.target)) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-sm flex justify-end animate-fade-in"
      onClick={handleBackdropClick}
    >
      <div 
        ref={drawerRef}
        className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col animate-slide-left"
        onClick={(e) => e.stopPropagation()} 
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-[#1D2D44]">{title}</h2>
          <div className="flex items-center gap-2">
            {onClearAll && (
              <button 
                onClick={onClearAll}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors uppercase tracking-wider"
              >
                <RotateCcw size={14} /> Clear All
              </button>
            )}
            <button 
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex flex-col gap-6">
            {children}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50">
          <button 
            onClick={onClose}
            className="w-full py-3 bg-[#1D2D44] text-white font-bold rounded-xl hover:bg-[#2A3F5C] transition-colors shadow-md"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterDrawer;
