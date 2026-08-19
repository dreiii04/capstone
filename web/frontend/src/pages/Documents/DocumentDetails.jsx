import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, GraduationCap, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import Layout from '../../components/Layout';
import ConfirmModal from '../../components/ConfirmModal';
import api from '../../api';

const DocumentDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [doc, setDoc] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actioning, setActioning] = useState(false);
    const [message, setMessage] = useState(null);
    const [confirmConfig, setConfirmConfig] = useState(null);

    const fetchDocument = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get(`/documents/${id}`);
            setDoc(res.data);
        } catch (error) {
            console.error('Error fetching document:', error);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchDocument();
    }, [fetchDocument]);

    const showConfirm = ({ title, message, onConfirm, type = 'info', confirmText = 'Confirm', cancelText = 'Cancel' }) => {
        setConfirmConfig({
            title,
            message,
            onConfirm: async () => {
                setConfirmConfig(prev => ({ ...prev, isLoading: true }));
                try {
                    await onConfirm();
                } catch (err) {
                    console.error(err);
                } finally {
                    setConfirmConfig(null);
                }
            },
            type,
            confirmText,
            cancelText,
            isLoading: false
        });
    };

    const handleFinalize = () => {
        showConfirm({
            title: 'Finalize Document',
            message: 'Are you sure you want to finalize this document? This will mark it as complete.',
            type: 'info',
            confirmText: 'Finalize',
            onConfirm: async () => {
                setActioning(true);
                setMessage(null);
                try {
                    const res = await api.post(`/documents/${id}/finalize`);
                    setDoc(res.data);
                    setMessage({ type: 'success', text: 'Document finalized successfully!' });
                } catch (error) {
                    setMessage({ type: 'error', text: error.response?.data?.message || 'Error finalizing document' });
                } finally {
                    setActioning(false);
                }
            }
        });
    };

    const handleDownload = async () => {
        setActioning(true);
        try {
            const res = await api.get(`/documents/${id}/download`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${doc.documentType}-${doc.studentName}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            setMessage({ type: 'error', text: 'Error downloading PDF' });
        } finally {
            setActioning(false);
        }
    };

    if (loading) {
        return (
            <Layout>
                <div className="flex items-center justify-center h-[60vh]">
                    <div className="w-8 h-8 border-2 border-[#2f3947] border-t-transparent rounded-full animate-spin" />
                </div>
            </Layout>
        );
    }

    if (!doc) {
        return (
            <Layout>
                <div className="flex flex-col items-center justify-center h-[60vh] text-gray-400">
                    <AlertCircle className="w-12 h-12 mb-3" />
                    <p className="font-medium">Document not found</p>
                    <button onClick={() => navigate('/documents')} className="flex items-center gap-2 text-slate-700 hover:text-blue-600 hover:bg-white font-bold bg-slate-100 px-4 py-2 mt-6 rounded-xl border border-slate-200 shadow-sm transition-all text-sm w-fit">
                        <ArrowLeft size={16} /> Back to Document Management
                    </button>
                </div>
            </Layout>
        );
    }

    const steps = [
        { id: 'Draft', label: 'Draft', desc: 'Metadata created, awaiting review.' },
        { id: 'Finalized', label: 'Finalized', desc: 'Document finalized and complete.' }
    ];

    const currentStepIndex = steps.findIndex(s => s.id.toLowerCase() === doc.status.toLowerCase());

    const statusColors = {
        Draft: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-400' },
        Finalized: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', dot: 'bg-green-400' }
    };
    const sc = statusColors[doc.status] || statusColors.Draft;

    return (
        <Layout>
            <div className="p-6 lg:p-8">
                {/* Header Back & Actions */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <button
                        onClick={() => navigate('/documents')}
                        className="flex items-center gap-2 text-slate-700 hover:text-blue-600 hover:bg-white font-bold bg-slate-100 px-4 py-2 rounded-xl border border-slate-200 shadow-sm transition-all text-sm w-fit"
                    >
                        <ArrowLeft size={16} /> Back to Document Management
                    </button>
                    <div className="flex items-center gap-3">
                        {doc.status === 'Draft' && (
                            <button
                                onClick={handleFinalize}
                                disabled={actioning}
                                className="flex items-center gap-2 bg-[#2f3947] hover:bg-[#3a4858] text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
                            >
                                {actioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                Finalize
                            </button>
                        )}
                        {doc.pdfPath && (
                            <button
                                onClick={handleDownload}
                                disabled={actioning}
                                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
                            >
                                {actioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                Download PDF
                            </button>
                        )}
                    </div>
                </div>

                {/* Message Alert */}
                {message && (
                    <div className={`flex items-center gap-2 p-3 rounded-lg text-sm mb-6 ${
                        message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                        {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        {message.text}
                    </div>
                )}

                {/* Linked Request Banner */}
                {doc.linkedRequestId && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div>
                            <p className="text-sm font-semibold text-blue-800">Linked to Request #{doc.linkedRequestId}</p>
                            <p className="text-xs text-blue-600">This document was prepared in response to an active request.</p>
                        </div>
                        <button
                            onClick={() => navigate(`/requests/${doc.linkedRequestId}`)}
                            className="text-xs font-bold text-blue-700 bg-white hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg transition-colors"
                        >
                            View Request Details
                        </button>
                    </div>
                )}

                {/* Status Stepper */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-800 mb-6">Document Status</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                        {steps.map((step, idx) => {
                            const isDone = idx < currentStepIndex;
                            const isCurrent = idx === currentStepIndex;
                            const isUpcoming = idx > currentStepIndex;
                            return (
                                <div key={step.id} className="flex gap-4 items-start relative z-10">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                        isDone ? 'bg-green-100 text-green-700' :
                                        isCurrent ? 'bg-[#2f3947] text-white' :
                                        'bg-gray-100 text-gray-400'
                                    }`}>
                                        {isDone ? '✓' : idx + 1}
                                    </div>
                                    <div>
                                        <p className={`font-semibold text-sm ${isUpcoming ? 'text-gray-400' : 'text-gray-800'}`}>
                                            {step.label}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-0.5">{step.desc}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Student Info Card */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex justify-between items-start gap-4 mb-5">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 bg-[#2f3947] rounded-xl flex items-center justify-center">
                                <GraduationCap className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-800">{doc.studentName}</h2>
                                <p className="text-xs text-gray-400">{doc.documentType}</p>
                            </div>
                        </div>
                        <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold border ${sc.bg} ${sc.text} ${sc.border}`}>
                            <span className={`w-2 h-2 rounded-full ${sc.dot}`} />
                            {doc.status}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                            { label: 'Student ID', value: doc.studentId },
                            { label: 'Course / Program', value: doc.course || 'N/A' },
                            { label: 'Year Level', value: doc.yearLevel || 'N/A' },
                            { label: 'Category', value: doc.category },
                            { label: 'Purpose', value: doc.purpose || 'N/A' }
                        ].map(item => (
                            <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{item.label}</p>
                                <p className="text-sm font-semibold text-gray-800">{item.value}</p>
                            </div>
                        ))}
                    </div>

                    {doc.notes && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Registrar Notes</p>
                            <p className="text-sm text-gray-600 font-medium whitespace-pre-wrap">{doc.notes}</p>
                        </div>
                    )}

                    <div className="mt-6 pt-4 border-t border-gray-100 text-xs text-gray-400">
                        <p><strong>Generated By:</strong> {doc.generatedBy || 'N/A'}</p>
                        <p className="mt-1"><strong>Prepared:</strong> {new Date(doc.createdAt).toLocaleDateString()}</p>
                    </div>
                </div>
            </div>

            <ConfirmModal
                isOpen={confirmConfig !== null}
                onClose={() => setConfirmConfig(null)}
                onConfirm={confirmConfig?.onConfirm}
                title={confirmConfig?.title}
                message={confirmConfig?.message}
                type={confirmConfig?.type}
                confirmText={confirmConfig?.confirmText}
                cancelText={confirmConfig?.cancelText}
                isLoading={confirmConfig?.isLoading}
            />
        </Layout>
    );
};

export default DocumentDetails;
