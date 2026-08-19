import React from 'react';
import { useNavigate } from 'react-router-dom';
import verifitorLogo from '../assets/verifitor_logo.png'; // Make sure to have the logo in this path

const ValidationNavbar = () => {
  const navigate = useNavigate();

  return (
    <nav className="bg-[#3d5a73] shadow-md w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          {/* Logo Section */}
          <div className="bg-white p-1 rounded-md flex items-center justify-center">
                {/* 2. Replaced span with img tag */}
                <img 
                src={verifitorLogo} 
                alt="VerifiTOR Logo" 
                className="h-10 w-auto object-contain px-1" 
                />
            </div>
          

          {/* Right Side (Optional: Back button or Help link) */}
          <div className="hidden md:block">
            <span className="text-white text-sm font-medium tracking-wide uppercase">
              Official Document Verification Portal
            </span>
          </div>

        </div>
      </div>
    </nav>
  );
};

export default ValidationNavbar;