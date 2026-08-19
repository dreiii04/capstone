import React from 'react';
import { X, AlertTriangle, AlertCircle, CheckCircle2, HelpCircle } from 'lucide-react';

const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'info',
  isLoading = false
}) => {
  if (!isOpen) return null;

  // Configure appearance based on the modal type
  const typeConfig = {
    danger: {
      icon: <AlertTriangle className="w-6 h-6 text-red-600" />,
      iconBg: 'bg-red-50 border border-red-100',
      btnBg: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
      loaderBorder: 'border-white'
    },
    warning: {
      icon: <AlertCircle className="w-6 h-6 text-amber-600" />,
      iconBg: 'bg-amber-50 border border-amber-100',
      btnBg: 'bg-amber-500 hover:bg-amber-600 text-white focus:ring-amber-500',
      loaderBorder: 'border-white'
    },
    success: {
      icon: <CheckCircle2 className="w-6 h-6 text-green-600" />,
      iconBg: 'bg-green-50 border border-green-100',
      btnBg: 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500',
      loaderBorder: 'border-white'
    },
    info: {
      icon: <HelpCircle className="w-6 h-6 text-blue-600" />,
      iconBg: 'bg-blue-50 border border-blue-100',
      btnBg: 'bg-[#2f3947] hover:bg-[#3d495b] text-white focus:ring-slate-500',
      loaderBorder: 'border-white'
    }
  };

  const config = typeConfig[type] || typeConfig.info;

  // Handle overlay click to close
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[3000] flex items-center justify-center p-4 animate-fade-in"
      onClick={handleOverlayClick}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-scale-up border border-slate-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header/Body Section */}
        <div className="p-6 pb-4">
          <div className="flex items-start gap-4">
            {/* Icon Wrapper */}
            <div className={`p-3 rounded-xl flex-shrink-0 flex items-center justify-center ${config.iconBg}`}>
              {config.icon}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 
                  id="modal-title" 
                  className="text-lg font-bold text-slate-800 leading-6"
                >
                  {title}
                </h3>
                {!isLoading && (
                  <button 
                    onClick={onClose} 
                    className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors duration-150"
                    aria-label="Close modal"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="mt-2.5 text-sm text-slate-500 leading-relaxed break-words whitespace-pre-line">
                {message}
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4.5 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 bg-white hover:bg-slate-100 hover:text-slate-700 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {cancelText}
          </button>
          
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-5 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer ${config.btnBg} disabled:opacity-80 disabled:cursor-not-allowed`}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-1 h-4.5 w-4.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Processing...</span>
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
