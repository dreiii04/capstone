import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, FileSearch, ShieldCheck, ArrowRight, Upload, Info } from 'lucide-react';
import ValidationNavbar from '../../components/ValidationPageNavBar';
import Footer from '../../components/Footer';

const VerificationPortal = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('upload');
    const [isHovered, setIsHovered] = useState(null);

    const [hash, setHash] = useState('');

    const handleVerify = (e) => {
        e.preventDefault();
        if (!hash) return;
        navigate(`/verify/results?hash=${hash}`);
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <ValidationNavbar />

            {/* Hero Section */}
            <header className="bg-[#2c3e50] text-white py-16 lg:py-24 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                    <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[60%] rounded-full bg-blue-400 blur-[120px]"></div>
                    <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[60%] rounded-full bg-cyan-400 blur-[120px]"></div>
                </div>

                <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/20 mb-6 animate-in fade-in slide-in-from-top-4 duration-700">
                        <ShieldCheck size={14} className="text-cyan-400" />
                        <span className="text-[10px] font-bold uppercase tracking-[2px]">Blockchain Secured Verification</span>
                    </div>
                    <h1 className="text-4xl lg:text-6xl font-bold mb-6 tracking-tight animate-in fade-in slide-in-from-top-8 duration-700 delay-100">
                        Employer & Verifier <span className="text-cyan-400">Portal</span>
                    </h1>
                    <p className="text-lg lg:text-xl text-slate-300 max-w-2xl mx-auto font-light leading-relaxed animate-in fade-in slide-in-from-top-12 duration-700 delay-200">
                        Instantly verify the authenticity of academic documents using our secure blockchain-powered ledger.
                    </p>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-grow max-w-5xl mx-auto w-full px-6 -mt-16 relative z-20 pb-20">
                <div className="bg-white rounded-3xl shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-700 delay-300">
                    {/* Tabs */}
                    <div className="flex border-b border-slate-100">
                        <button 
                            onClick={() => setActiveTab('upload')}
                            className={`flex-1 py-6 flex items-center justify-center gap-3 transition-all ${activeTab === 'upload' ? 'bg-white text-[#2c3e50] border-b-2 border-[#2c3e50]' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                        >
                            <FileSearch size={20} />
                            <span className="font-bold text-sm uppercase tracking-wider">Document Verification</span>
                        </button>
                        <button 
                            onClick={() => setActiveTab('qr')}
                            className={`flex-1 py-6 flex items-center justify-center gap-3 transition-all ${activeTab === 'qr' ? 'bg-white text-[#2c3e50] border-b-2 border-[#2c3e50]' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                        >
                            <QrCode size={20} />
                            <span className="font-bold text-sm uppercase tracking-wider">Scan QR Code</span>
                        </button>
                    </div>

                    <div className="p-8 lg:p-12">
                        {activeTab === 'upload' ? (
                            <div className="animate-in fade-in duration-500">
                                <div className="max-w-xl mx-auto text-center mb-10">
                                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Verify by File or Code</h2>
                                    <p className="text-slate-500 text-sm">Upload the digital Transcript of Records (PDF) or enter the unique verification hash found on the document.</p>
                                </div>

                                <form onSubmit={handleVerify} className="space-y-8">
                                    {/* Upload Area */}
                                    <div 
                                        className={`border-2 border-dashed rounded-2xl p-10 transition-all cursor-pointer flex flex-col items-center justify-center gap-4 ${isHovered === 'dropzone' ? 'border-[#2c3e50] bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`}
                                        onMouseEnter={() => setIsHovered('dropzone')}
                                        onMouseLeave={() => setIsHovered(null)}
                                        onClick={() => document.getElementById('verify-upload').click()}
                                    >
                                        <input type="file" id="verify-upload" className="hidden" />
                                        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:scale-110 transition-transform">
                                            <Upload size={28} />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-slate-700 font-bold">Click to upload document</p>
                                            <p className="text-slate-400 text-xs mt-1">Supports PDF format up to 10MB</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 py-4">
                                        <div className="h-px bg-slate-100 flex-grow"></div>
                                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">OR ENTER MANUALLY</span>
                                        <div className="h-px bg-slate-100 flex-grow"></div>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Verification Hash / Request ID</label>
                                        <div className="relative group">
                                            <input 
                                                type="text" 
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 px-5 outline-none focus:border-[#2c3e50] focus:ring-4 focus:ring-slate-100 transition-all font-mono text-slate-700"
                                                placeholder="e.g. a665a45920422f9d..."
                                                value={hash}
                                                onChange={(e) => setHash(e.target.value)}
                                            />
                                            <button 
                                                type="submit"
                                                className="absolute right-2 top-2 bottom-2 bg-[#2c3e50] text-white px-6 rounded-lg font-bold text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-[#1a252f] transition-all"
                                            >
                                                Verify <ArrowRight size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        ) : (
                            <div className="animate-in fade-in duration-500 flex flex-col items-center py-10">
                                <div className="w-64 h-64 bg-slate-50 border border-slate-200 rounded-3xl flex flex-col items-center justify-center gap-6 relative group overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-tr from-cyan-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <QrCode size={80} className="text-slate-300 group-hover:text-[#2c3e50] transition-colors relative z-10" />
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest relative z-10">Waiting for Camera...</p>
                                    
                                    <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-slate-300 rounded-tl-xl m-4 group-hover:border-[#2c3e50] transition-colors"></div>
                                    <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-slate-300 rounded-tr-xl m-4 group-hover:border-[#2c3e50] transition-colors"></div>
                                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-slate-300 rounded-bl-xl m-4 group-hover:border-[#2c3e50] transition-colors"></div>
                                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-slate-300 rounded-br-xl m-4 group-hover:border-[#2c3e50] transition-colors"></div>
                                </div>
                                <div className="mt-12 text-center max-w-sm">
                                    <h3 className="text-xl font-bold text-slate-800 mb-3">Scan Document QR</h3>
                                    <p className="text-slate-500 text-sm mb-8">Point your device camera at the QR code printed on the official Transcript of Records to verify instantly.</p>
                                    <button 
                                        className="inline-flex items-center gap-3 px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-all"
                                        disabled
                                    >
                                        Enable Camera <Info size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Info Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
                    <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 mb-6">
                            <ShieldCheck size={20} />
                        </div>
                        <h4 className="font-bold text-slate-800 mb-2">Immutable Records</h4>
                        <p className="text-slate-500 text-sm leading-relaxed">Once a document is hashed and stored, it cannot be altered by anyone, including the university.</p>
                    </div>
                    <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-10 h-10 rounded-lg bg-cyan-50 flex items-center justify-center text-cyan-600 mb-6">
                            <QrCode size={20} />
                        </div>
                        <h4 className="font-bold text-slate-800 mb-2">Instant Verification</h4>
                        <p className="text-slate-500 text-sm leading-relaxed">Simply scan the QR code to pull live authentication results directly from the blockchain node.</p>
                    </div>
                    <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 mb-6">
                            <FileSearch size={20} />
                        </div>
                        <h4 className="font-bold text-slate-800 mb-2">Privacy First</h4>
                        <p className="text-slate-500 text-sm leading-relaxed">We only store document hashes. Your private academic data remains confidential between you and the employer.</p>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
};

export default VerificationPortal;
