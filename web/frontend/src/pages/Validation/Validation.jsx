import React, { useState, useEffect } from 'react';
import { CheckCircle, ExternalLink, ShieldCheck, AlertTriangle, Mail, Phone, Globe, Loader2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ValidationNavbar from '../../components/ValidationPageNavBar';
import Footer from '../../components/Footer';
import api from '../../api';

const Validation = () => {
  const navigate = useNavigate();
  // STATE MANAGEMENT
  const [isLoading, setIsLoading] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [verificationData, setVerificationData] = useState(null);
  const [error, setError] = useState(null);

  const hashFromUrl = new URLSearchParams(window.location.search).get('hash');

  useEffect(() => {
    const fetchVerification = async () => {
      if (!hashFromUrl) {
        setIsLoading(false);
        setError('No hash provided');
        return;
      }

      try {
        const response = await api.get(`/verify/${hashFromUrl}`);
        const result = response.data;

        if (result.success) {
          setVerificationData(result.data);
          setIsValid(true);
        } else {
          setIsValid(false);
          setError(result.message);
        }
      } catch (err) {
        setIsValid(false);
        setError(err.response?.data?.message || 'Failed to reach verification server');
      } finally {
        setIsLoading(false);
      }
    };

    fetchVerification();
  }, [hashFromUrl]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-gray-800 flex flex-col">
      <ValidationNavbar />

      <main className="max-w-6xl mx-auto p-6 lg:p-12 flex-grow w-full">
        
        {/* LOADING STATE */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-6 animate-in fade-in duration-500">
            <Loader2 className="w-16 h-16 text-[#3d5a73] animate-spin" />
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-700">Verifying Document</h2>
              <p className="text-gray-500 mt-2 animate-pulse tracking-wide uppercase text-xs font-bold">
                Querying VerifiTOR Blockchain Ledger...
              </p>
            </div>
          </div>
        ) : (
          <>
            {isValid ? (
              /* VALID / AUTHENTIC VIEW */
              (() => {
                const isBlockchainEligible = verificationData && (
                  verificationData.documentType?.toLowerCase().includes('diploma') || 
                  verificationData.documentType?.toLowerCase().includes('transcript') || 
                  hashFromUrl?.toLowerCase().startsWith('tor') || 
                  (verificationData.blockchainRecord && verificationData.blockchainRecord.status !== 'Secured on Local Database Index Only' && verificationData.blockchainRecord.status !== 'Secured Locally')
                );
                return (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="bg-[#2ecc71] text-white rounded-2xl p-10 mb-10 text-center shadow-lg shadow-green-100">
                      <h1 className="text-3xl lg:text-4xl font-bold mb-3">Status: Verified and Authentic</h1>
                      <p className="text-lg opacity-90 font-light mb-6">
                        This {verificationData?.documentType || 'Document'} is authentic and has been successfully verified {isBlockchainEligible ? 'on the blockchain' : 'on our secure database registry'}
                      </p>

                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* Student Card */}
                      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-center mb-8">
                          <h2 className="text-xl font-bold text-gray-700">{verificationData?.ownerType === 'Alumni' ? 'Alumni Information' : 'Student Information'}</h2>
                          <span className="flex items-center bg-green-50 text-green-600 px-4 py-1.5 rounded-full text-sm font-semibold border border-green-100">
                            <CheckCircle className="w-4 h-4 mr-2" /> Verified
                          </span>
                        </div>
                        <div className="space-y-5">
                          {[
                            ["Request ID", verificationData?.requestId],
                            [verificationData?.ownerType === 'Alumni' ? "Alumni Name" : "Student Name", verificationData?.ownerName],
                            [verificationData?.ownerType === 'Alumni' ? "Alumni ID" : "Student ID", verificationData?.blockchainRecord?.idNumber || 'N/A'],
                            ...(verificationData?.ownerType === 'Alumni' 
                              ? [["Year Graduated", verificationData?.blockchainRecord?.yearGraduated || 'N/A']]
                              : [
                                  ["Course", verificationData?.blockchainRecord?.course || 'N/A'],
                                  ["Year Level", verificationData?.blockchainRecord?.yearLevel || 'N/A']
                                ]),
                            ["Status", verificationData?.status],
                            ["Verification Date", new Date(verificationData?.issuedDate).toLocaleDateString()]
                          ].map(([label, value]) => (
                            <div key={label} className="flex border-b border-gray-50 pb-3">
                              <span className="w-1/3 text-gray-500 font-medium">{label}:</span>
                              <span className="w-2/3 text-gray-900 font-semibold">{value}</span>
                            </div>
                          ))}
                        </div>
                      </section>

                      {/* Blockchain Card */}
                      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 hover:shadow-md transition-shadow">
                        <h2 className="text-xl font-bold text-gray-700 mb-8 flex items-center">
                          <ShieldCheck className="w-5 h-5 mr-2 text-[#34495e] animate-pulse" />
                          {isBlockchainEligible ? 'Document & Blockchain Integrity' : 'Document & Database Integrity'}
                        </h2>
                        <div className="space-y-5">
                          <div className="flex border-b border-gray-50 pb-3">
                            <span className="w-1/3 text-gray-500 font-medium">Document Type:</span>
                            <span className="w-2/3 text-gray-900 font-semibold">{verificationData?.documentType || 'Transcript of Records'}</span>
                          </div>
                          <div className="flex border-b border-gray-50 pb-3">
                            <span className="w-1/3 text-gray-500 font-medium">Issuing Institution:</span>
                            <span className="w-2/3 text-gray-900 font-semibold">VerifiTOR University</span>
                          </div>
                          <div className="flex border-b border-gray-50 pb-3">
                            <span className="w-1/3 text-gray-500 font-medium">Date Issued:</span>
                            <span className="w-2/3 text-gray-900 font-semibold">{verificationData?.issuedDate ? new Date(verificationData.issuedDate).toLocaleDateString() : 'N/A'}</span>
                          </div>
                          
                          <div className="pt-6 mt-6 border-t-2 border-dashed border-gray-100 space-y-4 bg-slate-50 p-4 rounded-xl">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold text-gray-400 uppercase tracking-tight">Doc Fingerprint:</span>
                              <span className="text-gray-800 font-mono font-bold bg-white px-2 py-1 rounded border border-gray-200 overflow-hidden text-ellipsis max-w-[200px] select-all" title={hashFromUrl}>{hashFromUrl}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold text-gray-400 uppercase tracking-tight">Security Status:</span>
                              <span className={isBlockchainEligible ? "text-green-600 font-bold flex items-center uppercase text-xs bg-green-50 px-2 py-0.5 rounded border border-green-200" : "text-blue-600 font-bold flex items-center uppercase text-xs bg-blue-50 px-2 py-0.5 rounded border border-blue-200"}>
                                <span className={isBlockchainEligible ? "w-2.5 h-2.5 bg-green-600 rounded-full mr-1.5 animate-pulse" : "w-2.5 h-2.5 bg-blue-600 rounded-full mr-1.5 animate-pulse"}></span>
                                {isBlockchainEligible ? (verificationData?.blockchainRecord?.status || 'RECORDED') : 'Secured locally on Database Index'}
                              </span>
                            </div>
                            {isBlockchainEligible ? (
                              <>
                                <div className="flex justify-between items-start gap-4 mb-3">
                                  <span className="text-xs font-bold text-gray-400 uppercase tracking-tight mt-1">Reference Number:</span>
                                  <div className="flex flex-col items-end">
                                    <span className="font-mono text-[10px] break-all select-all text-gray-800 bg-white p-1 rounded border border-gray-200 max-w-[220px] text-right">{verificationData?.blockchainRecord?.txID || 'N/A'}</span>
                                  </div>
                                </div>
                                <div className="flex justify-between items-start gap-4">
                                  <span className="text-xs font-bold text-gray-400 uppercase tracking-tight mt-1">Tx Hash:</span>
                                  <div className="flex flex-col items-end">
                                    <span className="font-mono text-[10px] break-all select-all text-gray-800 bg-white p-1 rounded border border-gray-200 max-w-[220px] text-right">{verificationData?.blockchainRecord?.txHash || 'N/A'}</span>
                                  </div>
                                </div>
                                {verificationData?.blockchainRecord?.blockNumber && verificationData.blockchainRecord.blockNumber !== 'N/A' && (
                                  <>
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs font-bold text-gray-400 uppercase tracking-tight">Block Mined:</span>
                                      <span className="font-semibold text-gray-800 font-mono text-xs">#{verificationData.blockchainRecord.blockNumber}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs font-bold text-gray-400 uppercase tracking-tight">EVM Smart Contract:</span>
                                      <span className="font-mono text-[9px] text-gray-500 overflow-hidden text-ellipsis max-w-[180px]" title={verificationData.blockchainRecord.contractAddress}>{verificationData.blockchainRecord.contractAddress || '0x5FbDB2315678afecb367f032d93F642f64180aa3'}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs font-bold text-gray-400 uppercase tracking-tight">Validator Node:</span>
                                      <span className="text-[10px] text-gray-600 font-medium">{verificationData.blockchainRecord.miner || 'POW Node-01'}</span>
                                    </div>
                                  </>
                                )}
                                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                                  <span className="text-[10px] font-bold text-gray-400 uppercase">Mined Timestamp:</span>
                                  <span className="text-[10px] text-gray-500 font-semibold uppercase">{verificationData?.blockchainRecord?.date ? new Date(verificationData.blockchainRecord.date).toLocaleString() : 'N/A'}</span>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                                  <span className="text-[10px] font-bold text-gray-400 uppercase">Secured Timestamp:</span>
                                  <span className="text-[10px] text-gray-500 font-semibold uppercase">{verificationData?.issuedDate ? new Date(verificationData.issuedDate).toLocaleString() : 'N/A'}</span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </section>
                    </div>
                  </div>
                );
              })()
            ) : (
              /* INVALID / TAMPERED VIEW */
              <div className="animate-in zoom-in-95 duration-500 max-w-4xl mx-auto">
                {/* Status Banner (Red) */}
                <div className="bg-[#c0392b] text-white rounded-2xl p-10 mb-10 text-center shadow-lg shadow-red-100">
                  <h1 className="text-3xl lg:text-4xl font-bold mb-3 uppercase tracking-tight">Status: Invalid / Not Found / Tampered</h1>
                  <p className="text-lg opacity-90 font-light mb-6">This transcript of record is invalid, has been altered, or does not exist in our records</p>

                </div>

                {/* Warning Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 mb-8 flex items-start space-x-8">
                  <div className="bg-red-50 p-5 rounded-full flex-shrink-0">
                    <AlertTriangle className="w-12 h-12 text-red-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-3">Verification Failed</h2>
                    <p className="text-gray-600 leading-relaxed text-lg font-light">
                      The document's digital signature does not match the blockchain records secured by VerifiTOR. 
                      Please contact the university registrar immediately for further assistance.
                    </p>
                  </div>
                </div>

                {/* Contact Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10">
                  <h2 className="text-xl font-bold text-gray-800 mb-8 border-b border-gray-100 pb-4">Contact Registrar Office</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="flex flex-col items-center md:items-start text-center md:text-left">
                      <div className="flex items-center text-gray-400 mb-2 uppercase text-[10px] font-black tracking-widest">
                        <Mail className="w-4 h-4 mr-2" /> Email Address
                      </div>
                      <a href="mailto:registrar@university.edu.ph" className="text-blue-600 font-semibold hover:underline">registrar@university.edu.ph</a>
                    </div>
                    <div className="flex flex-col items-center md:items-start text-center md:text-left">
                      <div className="flex items-center text-gray-400 mb-2 uppercase text-[10px] font-black tracking-widest">
                        <Phone className="w-4 h-4 mr-2" /> Phone Number
                      </div>
                      <span className="text-gray-800 font-semibold">(02) 1234-5678</span>
                    </div>
                    <div className="flex flex-col items-center md:items-start text-center md:text-left">
                      <div className="flex items-center text-gray-400 mb-2 uppercase text-[10px] font-black tracking-widest">
                        <Globe className="w-4 h-4 mr-2" /> Official Website
                      </div>
                      <a href="https://university.com" target="_blank" rel="noreferrer" className="text-blue-600 font-semibold hover:underline">University.com</a>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default Validation;