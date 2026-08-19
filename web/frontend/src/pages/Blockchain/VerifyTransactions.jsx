import { useState } from "react";
import Layout from "../../components/Layout";
import API from "../../components/config/axiosConfig";
import { CheckCircle, AlertCircle, Copy } from 'lucide-react';
import { useNavigate } from "react-router-dom";

function VerifyTransaction() {
    const [studentIDNumber, setStudentIDNumber] = useState("");
    const [result, setResult] = useState(null);
    const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const triggerToast = (message, type = 'info') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 4000);
    };

    const handleVerify = async (event) => {
        event.preventDefault();
        setLoading(true);

        try {
            const response = await API.get(
                `/blockchain/transactions/verify-by-id/${studentIDNumber}`
            );

            setResult(response.data);
            triggerToast(
                response.data.message || (response.data.verified ? 'Verification completed successfully.' : 'Verification failed.'),
                response.data.verified ? 'success' : 'error'
            );
        } catch (error) {
            setResult(null);
            triggerToast(error.response?.data?.message || "Verification failed", 'error');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        triggerToast('Copied to clipboard', 'success');
    };

    return (
        <Layout>
            <div className="p-6 bg-[#F8F9FA] min-h-screen font-sans">
                <button
                    onClick={() => navigate('/blockchain')}
                    className="flex items-center gap-2 text-slate-700 hover:text-blue-600 hover:bg-white font-bold bg-slate-100 px-4 py-2 rounded-xl border border-slate-200 shadow-sm transition-all text-sm w-fit mb-4"
                >
                    <i className="fa-solid fa-arrow-left text-xs"></i>
                    Back to Blockchain
                </button>

                {/* Toast Notification */}
                {toast.show && (
                    <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[10001] flex items-center gap-3 px-6 py-3 rounded-lg shadow-2xl ${toast.type === 'success'
                        ? 'bg-[#28A745] text-white'
                        : 'bg-[#DC3545] text-white'
                        } animate-fade-in`}>
                        {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                        <p className="font-bold text-sm">{toast.message}</p>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Search Card */}
                    <div className="lg:col-span-1 bg-white rounded-lg shadow-sm border border-gray-100 p-6 h-fit">
                        <h3 className="text-[18px] font-bold text-[#1D2D44] mb-6">Verify Transaction</h3>

                        <form onSubmit={handleVerify} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Student ID Number *</label>
                                <input
                                    type="text"
                                    placeholder="e.g., ID-2023-0001"
                                    value={studentIDNumber}
                                    onChange={(e) => setStudentIDNumber(e.target.value)}
                                    required
                                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:border-[#1D2D44] focus:ring-1 focus:ring-[#1D2D44]"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-[#1D2D44] text-white font-semibold py-2 rounded-lg hover:bg-[#2d3d54] transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Verifying...' : 'Verify Transaction'}
                            </button>
                        </form>
                    </div>

                    {/* Result Card */}
                    {result && (
                        <div className="lg:col-span-2">
                            <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">

                                {/* Header */}
                                <div className={`p-6 border-b border-gray-200 ${result.verified
                                    ? 'bg-[#E1FFEB] border-[#28A745]'
                                    : 'bg-[#FFE1E1] border-[#DC3545]'
                                    }`}>
                                    <div className="flex items-center gap-3">
                                        {result.verified ? (
                                            <>
                                                <CheckCircle size={24} className="text-[#28A745]" />
                                                <div>
                                                    <h3 className="text-[16px] font-bold text-[#28A745]">Verified ✓</h3>
                                                    <p className="text-sm text-gray-700">Transaction found on blockchain</p>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <AlertCircle size={24} className="text-[#DC3545]" />
                                                <div>
                                                    <h3 className="text-[16px] font-bold text-[#DC3545]">Not Verified</h3>
                                                    <p className="text-sm text-gray-700">Transaction not found on blockchain</p>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="p-6">
                                    <h4 className="text-[14px] font-bold text-gray-800 mb-4 uppercase tracking-wide">Blockchain Record</h4>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Reference Number</p>
                                            <p className="text-sm font-mono bg-gray-50 p-3 rounded break-all">
                                                {result.blockchainRecord?.referenceNumber}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Student Name</p>
                                            <p className="text-sm font-semibold">
                                                {result.blockchainRecord?.nameOfStudent}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-xs font-semibold text-gray-600 uppercase mb-1">ID Number</p>
                                            <p className="text-sm font-mono bg-gray-50 p-3 rounded">
                                                {result.blockchainRecord?.studentIDNumber}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Document Type</p>
                                            <p className="text-sm">
                                                {result.blockchainRecord?.typeOfDocument}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-xs font-semibold text-gray-600 uppercase mb-1">School/Institution</p>
                                            <p className="text-sm">
                                                {result.blockchainRecord?.nameOfSchool}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Year Graduated</p>
                                            <p className="text-sm">
                                                {result.blockchainRecord?.yearGraduated}
                                            </p>
                                        </div>
                                    </div>

                                    <hr className="my-6" />

                                    <h4 className="text-[14px] font-bold text-gray-800 mb-4 uppercase tracking-wide">Blockchain Details</h4>

                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Recorded By</p>
                                            <p className="text-sm font-mono bg-gray-50 p-3 rounded break-all">
                                                {result.blockchainRecord?.recordedBy}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Blockchain Timestamp</p>
                                            <p className="text-sm">
                                                {new Date(result.blockchainRecord?.timestamp * 1000).toLocaleString()}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Transaction Hash</p>
                                            <div className="flex items-center gap-2">
                                                <p className="text-xs font-mono bg-gray-50 p-3 rounded break-all flex-1">
                                                    {result.databaseRecord?.blockchainTxHash}
                                                </p>
                                                {result.databaseRecord?.blockchainTxHash && (
                                                    <button
                                                        onClick={() => copyToClipboard(result.databaseRecord.blockchainTxHash)}
                                                        className="p-2 text-blue-600 hover:text-blue-800 transition"
                                                        title="Copy to clipboard"
                                                    >
                                                        <Copy size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Empty State */}
                    {!result && (
                        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-100 p-12 flex flex-col items-center justify-center">
                            <AlertCircle size={48} className="text-gray-400 mb-4" />
                            <p className="text-gray-500 text-center">
                                Enter a student ID number to verify their transaction on the blockchain
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
}

export default VerifyTransaction;