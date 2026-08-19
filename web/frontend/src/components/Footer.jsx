import React from 'react';

const Footer = () => {
  return (
    // Reduced vertical padding from py-16 to py-10 for a more compact height
    <footer className="bg-[#3d5a73] text-gray-300 py-10 px-6 md:px-12 mt-auto">
      
      <div className="max-w-6xl mx-auto">
        
        {/* Adjusted gap from 12 to 8 to pull the columns closer vertically on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-24 text-[13px] leading-relaxed">
          
          {/* Column 1: System Info */}
          <div className="space-y-4">
            <h3 className="text-white font-bold uppercase tracking-widest text-sm">
              System & Contact
            </h3>
            <p className="text-gray-300 font-light leading-5">
              VerifiTOR: A Blockchain Integrated Mobile and Web System for Authenticating and Processing Transcript of Records Requests
            </p>
          </div>

          {/* Column 2: Disclaimer */}
          <div className="space-y-4">
            <h3 className="text-white font-bold uppercase tracking-widest text-sm">
              Disclaimer & Privacy
            </h3>
            <p className="text-gray-300 font-light leading-5">
              This verification result is generated automatically from the VerifiTOR system using blockchain-based authentication. The issuing institution certifies the authenticity of the document at the time of verification.
            </p>
            <div className="bg-black/10 p-3 rounded-md border border-white/5">
              <p className="text-[10px] italic text-gray-400 leading-4">
                This page displays limited academic information in compliance with the Data Privacy Act of 2012 (RA 10173).
              </p>
            </div>
          </div>

          {/* Column 3: Links & Session */}
          <div className="md:text-right space-y-4">
            <h3 className="text-white font-bold uppercase tracking-widest text-sm border-b border-white/10 pb-1 md:inline-block">
              Sessions Info & Links
            </h3>
            <div className="space-y-0.5">
              <p className="text-gray-400 text-xs">Verified on:</p>
              <p className="text-white font-semibold">{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} - {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            
            <div className="flex flex-col md:items-end space-y-2 pt-1">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Use</a>
              <a href="#" className="hover:text-white transition-colors font-semibold">About VerifiTOR</a>
            </div>
          </div>

        </div>
      </div>
    </footer>
  );
};

export default Footer;