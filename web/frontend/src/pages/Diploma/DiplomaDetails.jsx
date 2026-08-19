import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, FileText, GraduationCap, Printer, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import Layout from '../../components/Layout';
import ConfirmModal from '../../components/ConfirmModal';
import api from '../../api';

const DiplomaDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [diploma, setDiploma] = useState(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [message, setMessage] = useState(null);
    const [confirmConfig, setConfirmConfig] = useState(null);

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

    const fetchDiploma = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get(`/diploma/${id}`);
            setDiploma(res.data);
        } catch (error) {
            console.error('Error fetching Diploma:', error);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchDiploma();
    }, [fetchDiploma]);

    const handleGenerate = () => {
        showConfirm({
            title: 'Generate Diploma PDF',
            message: 'Are you sure you want to generate the Diploma PDF? The record will be marked as Finalized.',
            type: 'info',
            confirmText: 'Generate & Finalize',
            onConfirm: async () => {
                setGenerating(true);
                setMessage(null);
                try {
                    const res = await api.post(`/diploma/${id}/generate`);
                    setDiploma(res.data.diploma);
                    setMessage({ type: 'success', text: 'Diploma PDF generated successfully!' });
                } catch (error) {
                    setMessage({ type: 'error', text: error.response?.data?.message || 'Error generating Diploma' });
                } finally {
                    setGenerating(false);
                }
            }
        });
    };

    const handleDownload = async () => {
        setDownloading(true);
        try {
            const res = await api.get(`/diploma/${id}/download`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Diploma-${diploma.studentName}-${diploma.studentId}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            setMessage({ type: 'error', text: 'Error downloading PDF' });
        } finally {
            setDownloading(false);
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

    if (!diploma) {
        return (
            <Layout>
                <div className="flex flex-col items-center justify-center h-[60vh] text-gray-400">
                    <AlertCircle className="w-12 h-12 mb-3" />
                    <p className="font-medium">Diploma record not found</p>
                    <button onClick={() => navigate('/documents')} className="flex items-center gap-2 text-slate-700 hover:text-blue-600 hover:bg-white font-bold bg-slate-100 px-4 py-2 mt-6 rounded-xl border border-slate-200 shadow-sm transition-all text-sm w-fit">
                        <ArrowLeft size={16} /> Back to Document Management
                    </button>
                </div>
            </Layout>
        );
    }

    const statusColors = {
        Draft: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-400' },
        Finalized: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-400' },
        Released: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', dot: 'bg-green-400' }
    };
    const sc = statusColors[diploma.status] || statusColors.Draft;

    return (
        <Layout>
            <div className="p-6 lg:p-8">
                {/* Back Button & Actions */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <button
                        onClick={() => navigate('/documents')}
                        className="flex items-center gap-2 text-slate-700 hover:text-blue-600 hover:bg-white font-bold bg-slate-100 px-4 py-2 rounded-xl border border-slate-200 shadow-sm transition-all text-sm w-fit"
                    >
                        <ArrowLeft size={16} /> Back to Document Management
                    </button>
                    <div className="flex items-center gap-3">
                        {diploma.status === 'Draft' && (
                            <button
                                onClick={handleGenerate}
                                disabled={generating}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white shadow-sm transition-colors ${
                                    generating ? 'bg-gray-300 cursor-not-allowed' : 'bg-[#2f3947] hover:bg-[#3a4858]'
                                }`}
                            >
                                {generating ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Printer className="w-4 h-4" />
                                        Generate Diploma
                                    </>
                                )}
                            </button>
                        )}
                        {diploma.pdfPath && (
                            <button
                                onClick={handleDownload}
                                disabled={downloading}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors shadow-sm"
                            >
                                {downloading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Download className="w-4 h-4" />
                                )}
                                Download PDF
                            </button>
                        )}
                    </div>
                </div>

                {/* Message Banner */}
                {message && (
                    <div className={`flex items-center gap-2 p-3 rounded-lg text-sm mb-6 ${
                        message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                        {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        {message.text}
                    </div>
                )}

                {/* Student Info Card */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 bg-[#2f3947] rounded-xl flex items-center justify-center">
                                <GraduationCap className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-800">{diploma.studentName}</h2>
                                <p className="text-sm text-gray-400">{diploma.diplomaId}</p>
                            </div>
                        </div>
                        <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold border ${sc.bg} ${sc.text} ${sc.border}`}>
                            <span className={`w-2 h-2 rounded-full ${sc.dot}`} />
                            {diploma.status}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                            { label: 'Student ID', value: diploma.studentId },
                            { label: 'Course/Degree', value: diploma.course },
                            { label: 'Honors', value: diploma.honors || 'None' },
                            { label: 'Date of Graduation', value: diploma.dateOfGraduation }
                        ].map(item => (
                            <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{item.label}</p>
                                <p className="text-sm font-semibold text-gray-800">{item.value}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer Info */}
                <div className="mt-6 text-center">
                    <p className="text-xs text-gray-400">
                        Generated by: {diploma.generatedBy || 'N/A'}
                        {' | '}
                        Created: {new Date(diploma.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
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

export default DiplomaDetails;
