import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../api';
import { ArrowLeft, CheckCircle, XCircle, Clock, Image as ImageIcon, Eye, CreditCard, AlertCircle, User, FileText, RefreshCw } from 'lucide-react';
import { receiptRejectionReasons } from '../../receiptRejectionReasons';
import ConfirmModal from '../../components/ConfirmModal';
import FeedbackModal from '../../components/FeedbackModal';

const API_BASE = (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : '') || 'http://127.0.0.1:5000';

const TransactionDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [txData, setTxData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [zoomedImage, setZoomedImage] = useState(false);
    
    const userRole = localStorage.getItem('userRole') || 'registrar';
    const canReviewReceipt = userRole === 'super admin' || userRole === 'registrar';
    const [receiptReasonOption, setReceiptReasonOption] = useState('');
    const [customReceiptReason, setCustomReceiptReason] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    // Confirm Modal
    const [confirmConfig, setConfirmConfig] = useState(null);
    let isExecuting = false;
    const showConfirm = ({ title, message, onConfirm, type = 'info', confirmText = 'Confirm', cancelText = 'Cancel' }) => {
        setConfirmConfig({
            title,
            message,
            onConfirm: async () => {
                if (isExecuting) return;
                isExecuting = true;
                setConfirmConfig(prev => ({ ...prev, isLoading: true }));
                try {
                    await onConfirm();
                } catch (err) {
                    console.error(err);
                } finally {
                    isExecuting = false;
                    setConfirmConfig(null);
                }
            },
            type,
            confirmText,
            cancelText,
            isLoading: false
        });
    };

    // Feedback Modal
    const [feedbackConfig, setFeedbackConfig] = useState(null);
    const showFeedback = ({ title, message, type = 'error' }) => {
        setFeedbackConfig({ title, message, type });
    };

    const handleReceiptDecision = (status) => {
        const reason = receiptReasonOption === 'Other' ? customReceiptReason.trim() : receiptReasonOption;
        if (status === 'Needs Update' && !reason) {
            showFeedback({ title: 'Reason Required', message: 'Select or enter a reason the receipt needs updating.' });
            return;
        }
        showConfirm({
            title: status === 'Completed' ? 'Approve Receipt' : 'Receipt Needs Update',
            message: status === 'Completed' ? 'Approve this receipt and continue processing?' : `Mark this receipt as Needs Update? The user can resubmit it. Reason: ${reason}`,
            type: status === 'Completed' ? 'info' : 'warning',
            confirmText: status === 'Completed' ? 'Approve' : 'Needs Update',
            onConfirm: async () => {
                setActionLoading(true);
                try {
                    await api.put(`/transactions/${txData.transactionId}/verify`, {
                        status, adminRemarks: status === 'Needs Update' ? reason : ''
                    });
                    const res = await api.get(`/transactions/${id}`);
                    setTxData(res.data);
                    setReceiptReasonOption('');
                    setCustomReceiptReason('');
                } catch (error) {
                    showFeedback({
                        title: 'Update Failed',
                        message: error.response?.data?.message || 'Could not review this receipt. Please try again.',
                        type: 'error'
                    });
                } finally {
                    setActionLoading(false);
                }
            }
        });
    };

    useEffect(() => {
        const fetchTransaction = async () => {
            try {
                const res = await api.get(`/transactions/${id}`);
                setTxData(res.data);
            } catch (error) {
                console.error("Error fetching transaction:", error);
                // Fallback: try to find in list
                try {
                    const listRes = await api.get('/transactions');
                    const found = listRes.data.find(tx => tx.transactionId === id);
                    if (found) setTxData(found);
                } catch (e) {
                    console.error("Fallback also failed:", e);
                }
            } finally {
                setLoading(false);
            }
        };
        fetchTransaction();
    }, [id]);

    if (loading) {
        return (
            <Layout>
                <div className="p-8 flex items-center justify-center min-h-[400px] text-gray-400">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-3 border-gray-300 border-t-[#1D2D44] rounded-full animate-spin"></div>
                        <span className="text-sm font-medium">Loading Transaction...</span>
                    </div>
                </div>
            </Layout>
        );
    }

    if (!txData) {
        return (
            <Layout>
                <div className="flex flex-col items-center justify-center min-h-[500px] text-gray-500">
                    <AlertCircle size={48} className="mb-4 text-red-400" />
                    <h2 className="text-xl font-bold">Transaction Not Found</h2>
                    <p className="text-sm text-gray-400 mt-1">Transaction ID: {id}</p>
                    <button
                        onClick={() => navigate('/transactions')}
                        className="flex items-center gap-2 text-slate-700 hover:text-blue-600 hover:bg-white font-bold bg-slate-100 px-4 py-2 mt-6 rounded-xl border border-slate-200 shadow-sm transition-all text-sm w-fit"
                    >
                        <ArrowLeft size={16} /> Back to Transactions
                    </button>
                </div>
            </Layout>
        );
    }

    const getStatusBadge = (status) => {
        switch (status) {
            case 'Completed': return { style: 'text-[#2D6A8E] bg-[#C6E7FF]', icon: <CheckCircle size={14} /> };
            case 'Pending Verification': return { style: 'text-[#857A00] bg-[#FCF7B0]', icon: <Clock size={14} /> };
            case 'Needs Update': return { style: 'text-amber-700 bg-amber-100', icon: <RefreshCw size={14} /> };
            case 'Rejected': return { style: 'text-[#F04438] bg-[#FFD1D1]', icon: <XCircle size={14} /> };
            case 'Refunded': return { style: 'text-[#7C3AED] bg-[#E8D5F5]', icon: <RefreshCw size={14} /> };
            default: return { style: 'text-gray-600 bg-gray-100', icon: <Clock size={14} /> };
        }
    };

    const getPaymentModeStyle = (mode) => {
        switch (mode) {
            case 'GCash': return 'bg-[#E0F0FF] text-[#0070E0]';
            case 'Maya': return 'bg-[#E8F5E8] text-[#2E7D32]';
            case 'GoThyme': return 'bg-[#FFF3E0] text-[#E65100]';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    const statusBadge = getStatusBadge(txData.status);
    const formattedDate = new Date(txData.date).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
    const formattedTime = new Date(txData.date).toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit'
    });

    return (
        <Layout>
            {confirmConfig && (
                <ConfirmModal 
                    {...confirmConfig} 
                    isOpen={!!confirmConfig} 
                    onClose={() => !confirmConfig.isLoading && setConfirmConfig(null)} 
                />
            )}
            <div className="p-8 bg-[#F8F9FA] min-h-[calc(100vh-64px)] font-sans relative">

                {/* Header */}
                <div className="max-w-[1100px] mx-auto mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-[22px] font-bold text-[#1D2D44] flex items-center gap-3">
                            Transaction: {txData.transactionId}
                            <span className={`inline-flex items-center gap-1.5 px-4 py-1 rounded-full text-xs uppercase tracking-widest font-bold ${statusBadge.style}`}>
                                {statusBadge.icon} {txData.status}
                            </span>
                        </h2>
                        <p className="text-sm text-gray-400 mt-1">
                            Submitted on {formattedDate} at {formattedTime}
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/transactions')}
                        className="flex items-center gap-2 text-slate-700 hover:text-blue-600 hover:bg-white font-bold bg-slate-100 px-4 py-2 rounded-xl border border-slate-200 shadow-sm transition-all text-sm w-fit"
                    >
                        <ArrowLeft size={16} /> Back to Transactions
                    </button>
                </div>

                <div className="max-w-[1100px] mx-auto space-y-6">

                    {/* Row 1: Payer Info + Payment Summary */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                        {/* Payer Information */}
                        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                            <h4 className="text-[14px] font-bold text-[#1D2D44] mb-5 border-b border-gray-50 pb-3 uppercase tracking-wider flex items-center gap-2">
                                <User size={16} /> Payer Information
                            </h4>
                            <div className="grid grid-cols-[140px_1fr] gap-y-4 text-[13px]">
                                <span className="text-gray-400 font-bold">Payer Name:</span>
                                <span className="text-[#1D2D44] font-bold">{txData.payerName || txData.name}</span>

                                <span className="text-gray-400 font-bold">Email:</span>
                                <span className="text-gray-700">{txData.payerEmail || 'Not provided'}</span>

                                <span className="text-gray-400 font-bold">Type:</span>
                                <span className="text-gray-700 font-medium">{txData.payerType || 'Student'}</span>

                                <span className="text-gray-400 font-bold">Request ID:</span>
                                <span className="text-gray-700 font-mono">{txData.requestId}</span>
                            </div>
                        </div>

                        {/* Payment Summary */}
                        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                            <h4 className="text-[14px] font-bold text-[#1D2D44] mb-5 border-b border-gray-50 pb-3 uppercase tracking-wider flex items-center gap-2">
                                <CreditCard size={16} /> Payment Summary
                            </h4>
                            <div className="grid grid-cols-[140px_1fr] gap-y-4 text-[13px]">
                                <span className="text-gray-400 font-bold">Document:</span>
                                <span className="text-gray-800 font-medium">{txData.documentType}</span>

                                <span className="text-gray-400 font-bold">Amount:</span>
                                <span className="text-[#1D2D44] font-bold text-[16px]">₱{txData.amount || '0.00'}</span>

                                <span className="text-gray-400 font-bold">Payment Mode:</span>
                                <span className={`inline-flex items-center w-fit px-3 py-1 rounded text-[10px] font-bold uppercase ${getPaymentModeStyle(txData.paymentMode)}`}>
                                    {txData.paymentMode}
                                </span>

                                <span className="text-gray-400 font-bold">Status:</span>
                                <span className={`inline-flex items-center gap-1.5 w-fit px-3 py-1 rounded-full text-[10px] font-bold uppercase ${statusBadge.style}`}>
                                    {statusBadge.icon} {txData.status}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Row 2: Receipt Image + Verification Status */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                        {/* Receipt Image */}
                        <div className="lg:col-span-7 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                            <h4 className="text-[14px] font-bold text-[#1D2D44] mb-5 border-b border-gray-50 pb-3 uppercase tracking-wider flex items-center gap-2">
                                <FileText size={16} /> Uploaded Payment Receipt
                            </h4>
                            {txData.receiptHistory?.length > 0 && (
                                <p className="mb-4 text-sm font-bold text-blue-700">Resubmitted receipt #{txData.receiptHistory.length + 1} — latest receipt shown below</p>
                            )}
                            <div className="bg-[#F9FAFF] border border-dashed border-gray-200 rounded-xl p-6">
                                {(txData.imageUrl || txData.receiptImage) && !(txData.imageUrl || txData.receiptImage).includes('undefined') ? (
                                    <div className="flex flex-col items-center gap-4">
                                        <img
                                            src={(txData.imageUrl || txData.receiptImage).startsWith('http') ? (txData.imageUrl || txData.receiptImage) : `${API_BASE}${txData.receiptImage}`}
                                            alt="Payment Receipt"
                                            className="max-h-[400px] object-contain rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                                            onClick={() => setZoomedImage(true)}
                                        />
                                        <button
                                            onClick={() => setZoomedImage(true)}
                                            className="bg-[#1D2D44] text-white px-8 py-2.5 rounded-full font-bold text-xs flex items-center gap-2 hover:bg-[#152030] transition-all"
                                        >
                                            <Eye size={16} /> View Full Size
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center text-center gap-4 py-10">
                                        <div className="bg-gray-200 p-4 rounded-full text-gray-400">
                                            <ImageIcon size={32} />
                                        </div>
                                        <p className="text-[14px] font-bold text-gray-400">No valid receipt image uploaded</p>
                                    </div>
                                )}
                            </div>
                            {txData.receiptHistory?.length > 0 && (
                                <details className="mt-4 text-sm text-gray-600">
                                    <summary className="cursor-pointer font-bold">Previous receipt submissions ({txData.receiptHistory.length})</summary>
                                    <ul className="mt-2 space-y-2">
                                        {txData.receiptHistory.map((previous, index) => (
                                            <li key={index} className="rounded-lg border border-gray-200 p-3">
                                                <span className="font-bold">Submission {index + 1}:</span> {previous.remarks || previous.status || 'Replaced'}
                                                {previous.receiptImage && <a className="ml-2 text-blue-700 underline" target="_blank" rel="noreferrer"
                                                    href={previous.receiptImage.startsWith('http') ? previous.receiptImage : `${API_BASE}${previous.receiptImage}`}>
                                                    View receipt
                                                </a>}
                                            </li>
                                        ))}
                                    </ul>
                                </details>
                            )}
                        </div>

                        {/* Verification Status */}
                        <div className="lg:col-span-5 bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col">
                            <h4 className="text-[14px] font-bold text-[#1D2D44] mb-5 border-b border-gray-50 pb-3 uppercase tracking-wider">
                                Verification Status
                            </h4>

                            <div className="flex-1 space-y-5">
                                {/* Status Indicator */}
                                <div className={`flex items-center gap-3 p-4 rounded-lg border ${
                                    txData.status === 'Completed' ? 'bg-[#E1FFEB] border-[#C3E6CB]' :
                                    txData.status === 'Needs Update' ? 'bg-[#FFF3CD] border-[#FFEAA7]' :
                                    txData.status === 'Rejected' ? 'bg-[#FFE8E8] border-[#FFD1D1]' :
                                    'bg-[#FCF7B0] border-[#F0E68C]'
                                }`}>
                                    {txData.status === 'Completed' ? (
                                        <CheckCircle size={20} className="text-green-600" />
                                    ) : txData.status === 'Rejected' ? (
                                        <XCircle size={20} className="text-red-500" />
                                    ) : txData.status === 'Needs Update' ? (
                                        <RefreshCw size={20} className="text-amber-600" />
                                    ) : (
                                        <Clock size={20} className="text-amber-600" />
                                    )}
                                    <div>
                                        <p className="text-[12px] font-bold uppercase text-gray-500">Current Status</p>
                                        <p className="text-[14px] font-bold text-gray-800">{txData.status}</p>
                                    </div>
                                </div>

                                {txData.status === 'Pending Verification' && canReviewReceipt && (
                                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 space-y-3">
                                        <p className="text-xs font-bold text-blue-800 uppercase">Review current receipt</p>
                                        <select className="w-full p-2 border border-blue-200 rounded-md text-sm"
                                            value={receiptReasonOption} onChange={(e) => setReceiptReasonOption(e.target.value)}>
                                            <option value="">Select update reason</option>
                                            {receiptRejectionReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
                                            <option value="Other">Other reason</option>
                                        </select>
                                        {receiptReasonOption === 'Other' && <textarea className="w-full p-2 border border-blue-200 rounded-md text-sm"
                                            maxLength={500} value={customReceiptReason} onChange={(e) => setCustomReceiptReason(e.target.value)}
                                            placeholder="Explain why this receipt cannot be verified" />}
                                        <div className="flex gap-2">
                                            <button className="flex-1 py-2 text-xs font-bold bg-amber-600 text-white rounded-md disabled:opacity-50"
                                                disabled={actionLoading || !receiptReasonOption || (receiptReasonOption === 'Other' && !customReceiptReason.trim())}
                                                onClick={() => handleReceiptDecision('Needs Update')}>Needs Update</button>
                                            <button className="flex-1 py-2 text-xs font-bold bg-blue-600 text-white rounded-md disabled:opacity-50"
                                                disabled={actionLoading} onClick={() => handleReceiptDecision('Completed')}>Approve Receipt</button>
                                        </div>
                                    </div>
                                )}

                                {/* Verified By */}
                                {txData.verifiedBy && (
                                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Verified By</p>
                                        <p className="text-[13px] font-bold text-[#1D2D44]">{txData.verifiedBy}</p>
                                        {txData.verifiedAt && (
                                            <p className="text-[11px] text-gray-400 mt-1">
                                                {new Date(txData.verifiedAt).toLocaleString('en-US', {
                                                    year: 'numeric', month: 'long', day: 'numeric',
                                                    hour: '2-digit', minute: '2-digit'
                                                })}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Admin Remarks */}
                                {txData.adminRemarks && (
                                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">{txData.status === 'Needs Update' ? 'Update Reason' : 'Admin Remarks'}</p>
                                        <p className="text-[13px] text-gray-700 leading-relaxed">{txData.adminRemarks}</p>
                                    </div>
                                )}

                                {/* Timestamps */}
                                <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Timeline</p>
                                    <div className="space-y-2 text-[12px]">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Submitted</span>
                                            <span className="text-gray-700 font-medium">{formattedDate}, {formattedTime}</span>
                                        </div>
                                        {txData.verifiedAt && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Verified</span>
                                                <span className="text-gray-700 font-medium">
                                                    {new Date(txData.verifiedAt).toLocaleDateString('en-US', {
                                                        year: 'numeric', month: 'long', day: 'numeric'
                                                    })}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Bug 7: Re-upload receipt when Needs Update */}
                                {txData.status === 'Needs Update' && (
                                    <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                                        <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-2">Re-upload Receipt</p>
                                        <p className="text-[12px] text-amber-600 mb-3">This payment needs an updated receipt. Upload a corrected image below.</p>
                                        <input
                                            type="file"
                                            id="receiptReupload"
                                            className="hidden"
                                            accept="image/png,image/jpg,image/jpeg"
                                            onChange={async (e) => {
                                                if (!e.target.files || !e.target.files[0]) return;
                                                const formData = new FormData();
                                                formData.append('receiptImage', e.target.files[0]);
                                                setActionLoading(true);
                                                try {
                                                    const res = await api.put(`/transactions/${txData.transactionId}/reupload`, formData, {
                                                        headers: { 'Content-Type': 'multipart/form-data' }
                                                    });
                                                    setTxData(res.data);
                                                    showFeedback({
                                                        title: 'Receipt Re-uploaded',
                                                        message: 'The receipt has been successfully re-uploaded. The status is now set to Pending Verification.',
                                                        type: 'success'
                                                    });
                                                } catch {
                                                    showFeedback({
                                                        title: 'Upload Failed',
                                                        message: 'We couldn\'t upload the new receipt. Please try again.',
                                                        type: 'error'
                                                    });
                                                } finally {
                                                    setActionLoading(false);
                                                }
                                            }}
                                        />
                                        <button
                                            onClick={() => document.getElementById('receiptReupload').click()}
                                            disabled={actionLoading}
                                            className="w-full py-2 bg-amber-600 text-white rounded-md font-bold text-xs uppercase hover:bg-amber-700 transition-colors disabled:opacity-50"
                                        >
                                            {actionLoading ? 'Uploading...' : 'Choose & Upload New Receipt'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Image Zoom Overlay */}
                {zoomedImage && (txData.imageUrl || txData.receiptImage) && (
                    <div
                        className="fixed inset-0 z-[1001] bg-black/80 flex items-center justify-center cursor-zoom-out"
                        onClick={() => setZoomedImage(false)}
                    >
                        <img
                            src={(txData.imageUrl || txData.receiptImage).startsWith('http') ? (txData.imageUrl || txData.receiptImage) : `${API_BASE}${txData.receiptImage}`}
                            alt="Receipt Zoomed"
                            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
                        />
                    </div>
                )}

                {/* Feedback Modal */}
                {feedbackConfig && (
                    <FeedbackModal 
                        {...feedbackConfig} 
                        isOpen={!!feedbackConfig} 
                        onClose={() => setFeedbackConfig(null)} 
                    />
                )}
            </div>
        </Layout>
    );
};

export default TransactionDetails;
