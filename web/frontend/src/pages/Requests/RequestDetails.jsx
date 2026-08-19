import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronRight, FileText, Upload, CheckCircle2, AlertCircle, ShieldCheck, Printer, FileSearch, Trash2, Shield, Search } from 'lucide-react';
import Layout from '../../components/Layout';
import ConfirmModal from '../../components/ConfirmModal';
import FeedbackModal from '../../components/FeedbackModal';
import api from '../../api';

const API_BASE = (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : '') || 'http://127.0.0.1:5000';

const RequestDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const userRole = localStorage.getItem('userRole') || 'registrar';
    const isSuperAdmin = userRole === 'super admin';
    const hasProcessingAccess = userRole === 'super admin' || userRole === 'registrar';

    // Core Data State
    const [requestData, setRequestData] = useState(null);
    const [paymentTx, setPaymentTx] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    // Wizard State
    const [currentStep, setCurrentStep] = useState(1);
    const [uploadedFile, setUploadedFile] = useState(null);
    const [documentData, setDocumentData] = useState(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [manualRejectionReason, setManualRejectionReason] = useState('');
    const [showRejectForm, setShowRejectForm] = useState(false);
    const [paymentAction, setPaymentAction] = useState('Completed');
    const [confirmConfig, setConfirmConfig] = useState(null);

    // Blockchain Data State
    const [blockchainData, setBlockchainData] = useState({
        ownerType: "Student",
        course: "",
        yearLevel: "",
        studentIDNumber: "",
        nameOfSchool: "VeriFitor University",
        yearGraduated: new Date().getFullYear(),
    });
    const [blockchainResult, setBlockchainResult] = useState(null);

    // Bug 4: Double-click guard using a ref-like flag
    let isExecuting = false;
    const showConfirm = ({ title, message, onConfirm, type = 'info', confirmText = 'Confirm', cancelText = 'Cancel' }) => {
        setConfirmConfig({
            title,
            message,
            onConfirm: async () => {
                if (isExecuting) return; // Bug 4: prevent double-click
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

    const fetchData = async () => {
        try {
            const res = await api.get('/requests');
            const found = res.data.find(r => r.requestId === id);
            if (found) setRequestData(found);

            const txRes = await api.get('/transactions');
            const foundTx = txRes.data.find(t => t.requestId === id);
            if (foundTx) setPaymentTx(foundTx);

            // Determine Step
            const docType = (found?.documentType || found?.document_type || '').toLowerCase();
            const isBlockchain = docType.includes('tor') || docType.includes('diploma');

            if (found && found.status === 'Released') {
                setCurrentStep(isBlockchain ? 4 : 3);
            } else if (found && found.status === 'In Process') {
                if (found.documentFile) {
                    setCurrentStep(3); // Has uploaded, moving to secure/finalize
                } else {
                    setCurrentStep(2); // Has verified payment/bypassed, moving to upload
                }
            } else if (foundTx && foundTx.status === 'Completed') {
                if (found && found.documentFile) {
                    setCurrentStep(3);
                } else {
                    setCurrentStep(2);
                }
            } else {
                setCurrentStep(1); // Pending payment verification
            }

        } catch (error) {
            console.error("Error fetching request:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [id]);

    const handleStatusUpdate = async (newStatus) => {
        setActionLoading(true);
        try {
            const updatePayload = { status: newStatus };
            if (newStatus === 'Rejected') {
                updatePayload.rejectionReason = rejectionReason === 'others' ? manualRejectionReason : rejectionReason;
            }
            await api.put(`/requests/${id}`, updatePayload);
            await fetchData();
            if (newStatus === 'Rejected') setShowRejectForm(false);
        } catch (err) {
            showFeedback({
                title: 'Update Failed',
                message: 'Oops! We couldn\'t update the status of this request right now. Please try again.',
                type: 'error'
            });
        } finally {
            setActionLoading(false);
        }
    };

    const handleVerifyPayment = async (status) => {
        setActionLoading(true);
        try {
            await api.put(`/transactions/${paymentTx.transactionId}/verify`, { status });
            // Note: The backend now automatically syncs the Request status to "In Process" when status === "Completed".
            // However, we still call the explicit /requests update here as well to ensure UI state syncs properly,
            // or we could just rely on the backend. Since the backend handles it, the following is slightly redundant but safe.
            if (status === 'Completed') {
                await api.put(`/requests/${id}`, { status: 'In Process' });
            }
            await fetchData();
            if (status === 'Completed') setCurrentStep(2);
        } catch (err) {
            console.error(err);
            showFeedback({
                title: 'Payment Verification Failed',
                message: 'We were unable to verify this payment. Please check your connection and try again.',
                type: 'error'
            });
        } finally {
            setActionLoading(false);
        }
    };

    const handleFileUpload = async (e) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        if (file.type !== 'application/pdf') {
            showFeedback({
                title: 'Invalid File Type',
                message: 'Please select a PDF document. Other file types are not supported.',
                type: 'info'
            });
            return;
        }
        setUploadedFile(file);
    };

    const processUpload = async () => {
        if (!uploadedFile) return;
        setActionLoading(true);
        const formData = new FormData();
        formData.append('document', uploadedFile);

        try {
            const res = await api.post(`/requests/${id}/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setDocumentData(res.data);

            // Bug 5: Both blockchain and non-blockchain docs now go to step 3 for confirmation
            // Non-blockchain docs show a "Finalize" confirmation, blockchain shows "Secure on Blockchain"
            setCurrentStep(3);
            await fetchData();
        } catch (err) {
            console.error(err);
            showFeedback({
                title: 'Upload Failed',
                message: 'We couldn\'t upload your document. Please ensure it is a valid PDF and try again.',
                type: 'error'
            });
        } finally {
            setActionLoading(false);
        }
    };

    const handleSecureDocument = async () => {
        setActionLoading(true);
        const isBlockchainEligible = documentData?.isBlockchainEligible || (requestData.documentType || requestData.document_type || '').toLowerCase().includes('tor') || (requestData.documentType || requestData.document_type || '').toLowerCase().includes('diploma');

        try {
            if (isBlockchainEligible) {
                const blockchainRes = await api.post('/blockchain/transactions', {
                    nameOfStudent: requestData.name || "Unknown",
                    ownerType: blockchainData.ownerType,
                    course: blockchainData.ownerType === 'Student' ? blockchainData.course : "",
                    yearLevel: blockchainData.ownerType === 'Student' ? blockchainData.yearLevel : "",
                    studentIDNumber: blockchainData.studentIDNumber,
                    typeOfDocument: requestData.documentType || requestData.document_type || "Document",
                    nameOfSchool: blockchainData.nameOfSchool,
                    yearGraduated: blockchainData.ownerType === 'Alumni' ? Number(blockchainData.yearGraduated) : 0
                });

                setBlockchainResult({
                    referenceNumber: blockchainRes.data.referenceNumber || `TXN-${Date.now()}`,
                    transactionHash: blockchainRes.data.blockchainTxHash || blockchainRes.data.transactionHash,
                    blockchainTimestamp: blockchainRes.data.timestamp || new Date().toLocaleString(),
                    studentIDNumber: blockchainData.studentIDNumber,
                });
            }

            await api.put(`/requests/${id}`, { status: "Released" });
            setCurrentStep(4);
            await fetchData();
        } catch (err) {
            showFeedback({
                title: 'Failed to Finalize',
                message: 'Oops! We ran into an issue while securing this document. Please try again later.',
                type: 'error'
            });
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return (
        <Layout>
            <div className="flex justify-center items-center h-full min-h-screen">
                <div className="animate-spin text-blue-500"><Search size={32} /></div>
            </div>
        </Layout>
    );

    if (!requestData) return <Layout><div className="p-8 text-center text-red-500 font-bold">Request not found.</div></Layout>;

    const status = requestData.status || 'Pending';
    const isPaymentCleared = paymentTx?.status === 'Completed';
    const isBlockchainEligible = documentData?.isBlockchainEligible || (requestData.documentType || requestData.document_type || '').toLowerCase().includes('tor') || (requestData.documentType || requestData.document_type || '').toLowerCase().includes('diploma');

    return (
        <Layout>
            <div className="flex flex-col min-h-screen bg-[#f8fafc] font-sans">
                <div className="max-w-6xl mx-auto w-full p-8 flex-grow">
                    {/* Top Navigation */}
                    <div className="mb-6">
                        <button 
                            onClick={() => navigate('/requests')}
                            className="flex items-center gap-2 text-slate-700 hover:text-blue-600 hover:bg-white font-bold bg-slate-100 px-4 py-2 rounded-xl border border-slate-200 shadow-sm transition-all text-sm"
                        >
                            <ChevronRight size={16} className="rotate-180" /> Back to Document Requests
                        </button>
                    </div>

                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-800">Process Document Request</h1>
                            <p className="text-slate-500 mt-1">Request ID: <span className="font-mono">{requestData.requestId}</span></p>
                        </div>
                        <span className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest shadow-sm border ${status === 'Pending' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                status === 'In Process' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                                    status === 'Released' ? 'bg-green-50 text-green-600 border-green-200' :
                                        'bg-red-50 text-red-600 border-red-200'
                            }`}>
                            {status}
                        </span>
                    </div>

                    {status === 'Rejected' && (
                        <div className="bg-red-50 p-6 rounded-2xl border border-red-200 mb-8 flex flex-col md:flex-row md:items-start justify-between gap-4">
                            <div>
                                <h3 className="text-red-700 font-bold text-lg mb-2">Request Rejected</h3>
                                <p className="text-red-600 mb-2">This document request has been rejected and requires no further action.</p>
                                {requestData.rejectionReason && (
                                    <p className="text-red-800 bg-red-100/50 p-3 rounded-lg border border-red-100 text-sm">
                                        <span className="font-bold">Reason:</span> {
                                            requestData.rejectionReason === 'incomplete' ? 'Incomplete Requirements' :
                                            requestData.rejectionReason === 'invalid' ? 'Invalid Information' :
                                            requestData.rejectionReason === 'unpaid' ? 'Payment Issue' :
                                            requestData.rejectionReason
                                        }
                                    </p>
                                )}
                            </div>
                            <div className="flex flex-col gap-2 shrink-0">
                                {isSuperAdmin && (
                                    <button
                                        className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-xl font-bold transition-all shadow-sm whitespace-nowrap"
                                        onClick={() => showConfirm({
                                            title: 'Re-open Request',
                                            message: 'Are you sure you want to re-open this rejected request? The status will be changed back to "In Process".',
                                            type: 'warning',
                                            onConfirm: async () => {
                                                await api.put(`/requests/${id}`, { status: 'In Process', forceOverride: true });
                                                await fetchData();
                                            }
                                        })}
                                    >
                                        Super Admin: Re-open
                                    </button>
                                )}
                                <button
                                    className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-2 rounded-xl font-bold transition-all shadow-sm whitespace-nowrap"
                                    onClick={() => navigate('/requests')}
                                >
                                    Return to Requests
                                </button>
                            </div>
                        </div>
                    )}

                    {!hasProcessingAccess && status !== 'Rejected' && status !== 'Released' && (
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 mb-8 flex items-center gap-3 text-blue-700">
                            <Shield className="shrink-0" size={20} />
                            <div>
                                <h4 className="font-bold text-sm">Read-Only View</h4>
                                <p className="text-xs">Only authorized personnel have the permission to process document requests, upload files, and secure them on the blockchain.</p>
                            </div>
                        </div>
                    )}

                    {status !== 'Rejected' && (
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

                            {/* Stepper Sidebar */}
                            <div className="lg:col-span-1">
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 sticky top-8">
                                    <h3 className="font-bold text-slate-800 mb-6 uppercase tracking-wider text-xs">Processing Steps</h3>
                                    <div className="space-y-6">
                                        {(isBlockchainEligible ? [
                                            { step: 1, title: 'Verify & Payment', desc: 'Review request details and verify payment receipt' },
                                            { step: 2, title: 'Upload Document', desc: 'Upload the PDF document' },
                                            { step: 3, title: 'Secure on Blockchain', desc: 'Blockchain embedding and finalization' },
                                            { step: 4, title: 'Release', desc: 'Document ready for pickup/delivery' }
                                        ] : [
                                            { step: 1, title: 'Verify & Payment', desc: 'Review request details and verify payment receipt' },
                                            { step: 2, title: 'Upload & Finalize', desc: 'Upload the PDF document and finalize request' },
                                            { step: 3, title: 'Release', desc: 'Document ready for pickup/delivery' }
                                        ]).map(s => (
                                            <div key={s.step} className={`flex gap-4 ${currentStep === s.step ? 'opacity-100' : 'opacity-40'}`}>
                                                <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center font-bold text-sm ${currentStep >= s.step ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                    {currentStep > s.step ? <CheckCircle2 size={16} /> : s.step}
                                                </div>
                                                <div>
                                                    <p className={`text-sm font-bold ${currentStep >= s.step ? 'text-slate-800' : 'text-slate-500'}`}>{s.title}</p>
                                                    <p className="text-xs text-slate-400">{s.desc}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Main Content Area */}
                            <div className="lg:col-span-3">

                                {/* Step 1 Content */}
                                {currentStep === 1 && (
                                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 animate-in fade-in slide-in-from-right-4 duration-300">
                                        <h2 className="text-2xl font-bold text-slate-800 mb-6">Verify Request & Payment</h2>

                                        <div className="grid grid-cols-2 gap-6 mb-8">
                                            <div className="bg-slate-50 p-4 rounded-xl">
                                                <p className="text-xs font-bold text-slate-400 uppercase">Student Name</p>
                                                <p className="font-bold text-slate-700">{requestData.name}</p>
                                            </div>
                                            <div className="bg-slate-50 p-4 rounded-xl">
                                                <p className="text-xs font-bold text-slate-400 uppercase">Requested Document</p>
                                                <p className="font-bold text-slate-700">{requestData.documentType || requestData.document_type}</p>
                                            </div>
                                            <div className="bg-slate-50 p-4 rounded-xl">
                                                <p className="text-xs font-bold text-slate-400 uppercase">Course / Year</p>
                                                <p className="font-bold text-slate-700">{requestData.course || 'N/A'} - {requestData.yearLevel || 'N/A'}</p>
                                            </div>
                                        </div>

                                        {paymentTx && (
                                            <div className="border border-slate-200 rounded-xl overflow-hidden mb-8">
                                                <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                                                    <h3 className="font-bold text-slate-700">Payment Verification</h3>
                                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${paymentTx.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                        {paymentTx.status}
                                                    </span>
                                                </div>
                                                <div className="p-4 grid grid-cols-2 gap-4">
                                                    <div>
                                                        <p className="text-xs text-slate-500 mb-1">Method & Amount</p>
                                                        <p className="font-bold text-slate-800">{paymentTx.paymentMode} - ₱{paymentTx.amount}</p>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <p className="text-xs text-slate-500 mb-2">Receipt Uploaded</p>
                                                        <div className="bg-slate-100 rounded-lg p-2 h-64 flex items-center justify-center border border-slate-200">
                                                            {(paymentTx.imageUrl || paymentTx.receiptImage) ? (
                                                                <img src={(paymentTx.imageUrl || paymentTx.receiptImage).startsWith('http') ? (paymentTx.imageUrl || paymentTx.receiptImage) : `${API_BASE}${paymentTx.receiptImage}`} alt="Receipt" className="max-h-full object-contain" />
                                                            ) : (
                                                                <span className="text-slate-400 font-bold text-sm">No image uploaded</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {paymentTx.status === 'Pending Verification' && (
                                                    <div className="p-4 bg-slate-50 flex flex-col sm:flex-row gap-4 border-t border-slate-200">
                                                        <select
                                                            className="flex-1 py-3 px-4 border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-sm font-bold text-slate-700 bg-white"
                                                            value={paymentAction}
                                                            onChange={(e) => setPaymentAction(e.target.value)}
                                                            disabled={!hasProcessingAccess}
                                                        >
                                                            <option value="Completed">Approve Payment</option>
                                                            <option value="Needs Update">Needs Update (Wrong/Blurry Receipt)</option>
                                                            <option value="Rejected">Reject Completely (Fraud/Invalid)</option>
                                                        </select>
                                                        <button
                                                            className={`flex-[1] text-white py-3 px-6 rounded-xl font-bold text-sm transition-all shadow-md ${!hasProcessingAccess ? 'bg-slate-300 shadow-none' : paymentAction === 'Completed' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-100' : 'bg-red-600 hover:bg-red-700 shadow-red-100'}`}
                                                            onClick={() => showConfirm({
                                                                title: 'Confirm Payment Action',
                                                                message: `Are you sure you want to ${paymentAction === 'Completed' ? 'approve' : paymentAction === 'Needs Update' ? 'request an update for' : 'reject'} this payment?`,
                                                                type: paymentAction === 'Completed' ? 'info' : 'warning',
                                                                onConfirm: () => handleVerifyPayment(paymentAction)
                                                            })}
                                                            disabled={actionLoading || !hasProcessingAccess}
                                                        >
                                                            {actionLoading ? 'Processing...' : 'Confirm Action'}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {!paymentTx && (
                                            <div className="bg-amber-50 p-4 rounded-xl text-amber-700 font-bold mb-8">
                                                <AlertCircle className="inline mr-2" size={18} /> No payment transaction found for this request.
                                            </div>
                                        )}

                                        <div className="pt-6 border-t border-slate-100 flex flex-col gap-4">
                                            {(!paymentTx || paymentTx.status !== 'Completed') && !showRejectForm && isSuperAdmin && (
                                                <div className="flex justify-end">
                                                    <button
                                                        className="bg-slate-100 text-slate-700 hover:bg-slate-200 px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
                                                        onClick={() => showConfirm({
                                                            title: 'Bypass Verification',
                                                            message: 'Are you sure you want to bypass the payment verification step and forcefully start processing this request?',
                                                            type: 'warning',
                                                            onConfirm: async () => {
                                                                await api.put(`/requests/${id}`, { status: 'In Process', forceOverride: true });
                                                                setCurrentStep(2);
                                                            }
                                                        })}
                                                    >
                                                        Super Admin Override: Force Proceed <ChevronRight size={16} />
                                                    </button>
                                                </div>
                                            )}

                                            {showRejectForm ? (
                                                <div className="bg-red-50 p-4 rounded-xl border border-red-100 animate-in fade-in">
                                                    <p className="font-bold text-red-700 text-sm mb-2">Provide reason for rejection:</p>
                                                    <select
                                                        className="w-full py-3 px-4 bg-white border border-red-200 rounded-lg outline-none focus:border-red-500 mb-4"
                                                        value={rejectionReason}
                                                        onChange={(e) => setRejectionReason(e.target.value)}
                                                    >
                                                        <option value="" disabled>Select Reason</option>
                                                        <option value="incomplete">Incomplete Requirements</option>
                                                        <option value="invalid">Invalid Information</option>
                                                        <option value="unpaid">Payment Issue</option>
                                                        <option value="others">Others (Please specify)</option>
                                                    </select>
                                                    {rejectionReason === 'others' && (
                                                        <textarea
                                                            className="w-full py-3 px-4 bg-white border border-red-200 rounded-lg outline-none focus:border-red-500 mb-4 text-sm"
                                                            placeholder="Please type the specific reason for rejection..."
                                                            rows="3"
                                                            value={manualRejectionReason}
                                                            onChange={(e) => setManualRejectionReason(e.target.value)}
                                                        ></textarea>
                                                    )}
                                                    <div className="flex gap-2">
                                                        <button className="flex-1 py-2 text-slate-500 font-bold hover:bg-red-100 rounded-lg" onClick={() => { setShowRejectForm(false); setRejectionReason(''); setManualRejectionReason(''); }}>Cancel</button>
                                                        <button
                                                            className="flex-1 bg-red-600 text-white py-2 rounded-lg font-bold hover:bg-red-700 disabled:opacity-50"
                                                            disabled={!rejectionReason || (rejectionReason === 'others' && !manualRejectionReason.trim()) || actionLoading}
                                                            onClick={() => handleStatusUpdate('Rejected')}
                                                        >Confirm Reject</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex justify-start">
                                                    <button
                                                        className="text-slate-400 hover:text-red-500 font-bold text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        onClick={() => setShowRejectForm(true)}
                                                        disabled={!hasProcessingAccess || status === 'In Process'}
                                                        title={status === 'In Process' ? 'Cannot reject a request that is already In Process. Use the stepper to continue processing.' : ''}
                                                    >
                                                        <Trash2 size={16} /> Reject Request
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Step 2 Content */}
                                {currentStep === 2 && (
                                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 animate-in fade-in slide-in-from-right-4 duration-300">
                                        <h2 className="text-2xl font-bold text-slate-800 mb-2">Upload External PDF</h2>
                                        <p className="text-slate-500 mb-8">Upload the requested document as a PDF. If it is a TOR or Diploma, a QR code will be automatically embedded.</p>

                                        <input type="file" id="pdfUpload" className="hidden" accept=".pdf" onChange={handleFileUpload} disabled={!hasProcessingAccess} />
                                        <div
                                            className={`border-2 border-dashed border-slate-200 bg-slate-50 rounded-2xl py-16 px-8 text-center mb-8 transition-all group ${hasProcessingAccess ? 'cursor-pointer hover:border-blue-500 hover:bg-blue-50' : 'opacity-70 cursor-not-allowed'}`}
                                            onClick={() => { if (hasProcessingAccess) document.getElementById('pdfUpload').click() }}
                                        >
                                            <Upload size={40} className={`mx-auto mb-4 transition-colors ${hasProcessingAccess ? 'text-slate-400 group-hover:text-blue-600' : 'text-slate-300'}`} />
                                            {uploadedFile ? (
                                                <p className="text-blue-600 font-bold">{uploadedFile.name}</p>
                                            ) : (
                                                <p className="text-slate-600 font-bold">Click to browse for PDF file</p>
                                            )}
                                        </div>

                                        <div className="flex gap-4 pt-6 border-t border-slate-100">
                                            <button
                                                className="flex-[1] bg-slate-100 text-slate-600 py-4 rounded-xl font-bold hover:bg-slate-200 transition-all"
                                                onClick={() => setCurrentStep(1)}
                                            >Back</button>
                                            <button
                                                className={`flex-[2] text-white py-4 rounded-xl font-bold transition-all shadow-md disabled:opacity-50 ${!hasProcessingAccess ? 'bg-slate-300 shadow-none' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-100'}`}
                                                disabled={!uploadedFile || actionLoading || !hasProcessingAccess}
                                                onClick={processUpload}
                                            >
                                                {actionLoading ? 'Uploading & Processing...' : 'Process Document'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Step 3 Content — now handles BOTH blockchain and non-blockchain */}
                                {currentStep === 3 && status !== 'Released' && (
                                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 animate-in fade-in slide-in-from-right-4 duration-300">
                                        <h2 className="text-2xl font-bold text-slate-800 mb-2">{isBlockchainEligible ? 'Secure & Finalize' : 'Finalize & Release'}</h2>

                                        {isBlockchainEligible && (
                                            <div>
                                                <div className="bg-blue-50 text-blue-800 p-4 rounded-xl border border-blue-100 mb-8 flex items-start gap-3">
                                                    <ShieldCheck className="mt-1 shrink-0" />
                                                    <div>
                                                        <h4 className="font-bold">Blockchain Eligible Document</h4>
                                                        <p className="text-sm">The uploaded PDF has been embedded with a unique QR code. Complete the details below to record this document immutably on the blockchain.</p>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-6 mb-8">
                                                    <div className="col-span-2">
                                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Owner Type *</label>
                                                        <select
                                                            value={blockchainData.ownerType}
                                                            onChange={(e) => setBlockchainData({ ...blockchainData, ownerType: e.target.value })}
                                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:border-blue-500 outline-none"
                                                        >
                                                            <option value="Student">Student</option>
                                                            <option value="Alumni">Alumni</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">ID Number *</label>
                                                        <input
                                                            type="text"
                                                            required
                                                            placeholder="e.g. ID-2023-001"
                                                            value={blockchainData.studentIDNumber}
                                                            onChange={(e) => setBlockchainData({ ...blockchainData, studentIDNumber: e.target.value })}
                                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:border-blue-500 outline-none"
                                                        />
                                                    </div>

                                                    {blockchainData.ownerType === 'Alumni' ? (
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Year Graduated *</label>
                                                            <input
                                                                type="number"
                                                                required
                                                                value={blockchainData.yearGraduated}
                                                                onChange={(e) => setBlockchainData({ ...blockchainData, yearGraduated: e.target.value })}
                                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:border-blue-500 outline-none"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div>
                                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Course *</label>
                                                                <input
                                                                    type="text"
                                                                    required
                                                                    placeholder="e.g. BSCS"
                                                                    value={blockchainData.course}
                                                                    onChange={(e) => setBlockchainData({ ...blockchainData, course: e.target.value })}
                                                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:border-blue-500 outline-none"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Year Level *</label>
                                                                <input
                                                                    type="text"
                                                                    required
                                                                    placeholder="e.g. 3rd Year"
                                                                    value={blockchainData.yearLevel}
                                                                    onChange={(e) => setBlockchainData({ ...blockchainData, yearLevel: e.target.value })}
                                                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:border-blue-500 outline-none"
                                                                />
                                                            </div>
                                                        </>
                                                    )}

                                                    <div className="col-span-2">
                                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">School Name</label>
                                                        <input
                                                            type="text"
                                                            required
                                                            value={blockchainData.nameOfSchool}
                                                            onChange={(e) => setBlockchainData({ ...blockchainData, nameOfSchool: e.target.value })}
                                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:border-blue-500 outline-none"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex gap-4 pt-6 border-t border-slate-100">
                                            <button
                                                className="flex-[1] bg-slate-100 text-slate-600 py-4 rounded-xl font-bold hover:bg-slate-200 transition-all"
                                                onClick={() => setCurrentStep(2)}
                                            >Back</button>
                                            <button
                                                className={`flex-[2] text-white py-4 rounded-xl font-bold transition-all shadow-md disabled:opacity-50 ${(!hasProcessingAccess) ? 'bg-slate-300 shadow-none' : (isBlockchainEligible ? 'bg-[#2c3e50] hover:bg-[#1a252f]' : 'bg-green-600 hover:bg-green-700')}`}
                                                disabled={actionLoading || !hasProcessingAccess || (isBlockchainEligible && !blockchainData.studentIDNumber)}
                                                onClick={() => showConfirm({
                                                    title: isBlockchainEligible ? 'Secure to Blockchain' : 'Finalize Document',
                                                    message: 'Are you sure you want to finalize this request?',
                                                    onConfirm: handleSecureDocument
                                                })}
                                            >
                                                {actionLoading ? 'Processing...' : (isBlockchainEligible ? 'Secure on Blockchain' : 'Finalize Request')}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Final Step Content */}
                                {((isBlockchainEligible && currentStep === 4) || (!isBlockchainEligible && currentStep === 3)) && (
                                    <div className="bg-white p-10 rounded-2xl shadow-sm border border-slate-100 animate-in fade-in slide-in-from-right-4 duration-300 text-center">
                                        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                            <CheckCircle2 size={48} className="text-green-600" />
                                        </div>
                                        <h2 className="text-3xl font-bold text-slate-800 mb-4">Request Completed</h2>
                                        <p className="text-slate-500 mb-8 max-w-md mx-auto">
                                            The document request has been successfully finalized. It is now marked as Released and is ready for the student.
                                        </p>

                                        {blockchainResult && (
                                            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-left mb-8 max-w-lg mx-auto">
                                                <h4 className="font-bold text-xs text-slate-400 uppercase tracking-widest mb-4">Blockchain Record</h4>
                                                <div className="space-y-3">
                                                    <div>
                                                        <p className="text-xs text-slate-500">Transaction Hash</p>
                                                        <p className="font-mono text-xs text-slate-700 truncate">{blockchainResult.transactionHash}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-slate-500">Reference / ID Number</p>
                                                        <p className="font-bold text-slate-700">{blockchainResult.referenceNumber} / {blockchainResult.studentIDNumber}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex gap-4 justify-center">
                                            {requestData.documentFile && (
                                                <a
                                                    href={requestData.documentFile.startsWith('data:') ? requestData.documentFile : `${API_BASE}${requestData.documentFile}`}
                                                    download={requestData.documentFile.startsWith('data:') ? `document-${requestData.requestId}.pdf` : undefined}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="bg-blue-600 text-white px-8 py-4 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg flex items-center gap-2"
                                                >
                                                    <FileText size={20} /> View / Download Document
                                                </a>
                                            )}
                                            <button
                                                className="bg-slate-800 text-white px-8 py-4 rounded-xl font-bold hover:bg-slate-900 transition-colors shadow-lg"
                                                onClick={() => navigate('/requests')}
                                            >
                                                Return to Requests
                                            </button>
                                        </div>
                                        {isSuperAdmin && (
                                            <div className="mt-8 pt-6 border-t border-slate-100">
                                                <button
                                                    className="text-slate-500 hover:text-amber-600 font-bold text-sm flex items-center justify-center gap-2 w-full transition-colors"
                                                    onClick={() => showConfirm({
                                                        title: 'Revert Status',
                                                        message: 'Are you sure you want to revert this completed request back to "In Process"? You can re-upload documents if needed.',
                                                        type: 'warning',
                                                        onConfirm: async () => {
                                                            await api.put(`/requests/${id}`, { status: 'In Process', forceOverride: true });
                                                            await fetchData();
                                                        }
                                                    })}
                                                >
                                                    <AlertCircle size={16} /> Super Admin: Revert to "In Process"
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {confirmConfig && (
                <ConfirmModal
                    isOpen={!!confirmConfig}
                    title={confirmConfig.title}
                    message={confirmConfig.message}
                    onConfirm={confirmConfig.onConfirm}
                    onClose={() => setConfirmConfig(null)}
                    type={confirmConfig.type}
                    confirmText={confirmConfig.confirmText}
                    cancelText={confirmConfig.cancelText}
                    isLoading={confirmConfig.isLoading}
                />
            )}
            {/* Feedback Modal */}
            {feedbackConfig && (
                <FeedbackModal 
                    {...feedbackConfig} 
                    isOpen={!!feedbackConfig} 
                    onClose={() => setFeedbackConfig(null)} 
                />
            )}
        </Layout>
    );
};

export default RequestDetails;