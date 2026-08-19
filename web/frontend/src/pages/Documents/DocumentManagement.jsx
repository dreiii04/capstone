import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Upload, FileText, Search, Filter, Trash2, Eye, FolderOpen, AlertCircle, CheckCircle2, X, FileUp, Plus, Download } from 'lucide-react';
import Layout from '../../components/Layout';
import ConfirmModal from '../../components/ConfirmModal';
import FeedbackModal from '../../components/FeedbackModal';
import api from '../../api';
import { CreateDocumentModal, TORUploadModal, DiplomaUploadModal } from './DocumentModals';

const CATEGORIES = ['All', 'Certification', 'Certified True Copy', 'Transcript of Records', 'Diploma'];

const CERT_TYPES = [
  'Certificate of Enrollment', 'Certificate of Good Moral', 'Grade Certification',
  'Certificate of Candidacy for Graduation', 'Certificate of Units Earned',
  'Certificate of Assessment', 'Certificate of Registration'
];
const CTC_TYPES = ['CTC of Certificate of Matriculation', 'CTC of Diploma', 'CTC of Curriculum'];

const DocumentManagement = () => {
    const navigate = useNavigate();
    const [documents, setDocuments] = useState([]);
    const [tors, setTors] = useState([]);
    const [diplomas, setDiplomas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showDiplomaUploadModal, setShowDiplomaUploadModal] = useState(false);
    const [prefillData, setPrefillData] = useState(null);
    const [confirmConfig, setConfirmConfig] = useState(null);
    const [feedbackConfig, setFeedbackConfig] = useState(null);
    const showFeedback = ({ title, message, type = 'error' }) => {
        setFeedbackConfig({ title, message, type });
    };
    const userRole = localStorage.getItem('userRole');
    const [searchParams, setSearchParams] = useSearchParams();

    // Auto-open create modal when coming from a request
    useEffect(() => {
        const fromRequest = searchParams.get('fromRequest');
        if (fromRequest) {
            setPrefillData({
                linkedRequestId: fromRequest,
                studentName: searchParams.get('studentName') || '',
                studentId: searchParams.get('studentId') || '',
                course: searchParams.get('course') || '',
                yearLevel: searchParams.get('yearLevel') || '',
                documentType: searchParams.get('documentType') || '',
                purpose: searchParams.get('purpose') || ''
            });
            setShowCreateModal(true);
            // Clear the params so refreshing doesn't re-open
            setSearchParams({}, { replace: true });
        }
    }, [searchParams, setSearchParams]);

    // Fetch documents and TORs
    const fetchAll = useCallback(async () => {
        try {
            setLoading(true);
            const [docRes, torRes, diplomaRes] = await Promise.allSettled([
                api.get('/documents'),
                api.get('/tor'),
                api.get('/diploma')
            ]);
            
            setDocuments(docRes.status === 'fulfilled' ? docRes.value.data : []);
            setTors(torRes.status === 'fulfilled' ? torRes.value.data : []);
            setDiplomas(diplomaRes.status === 'fulfilled' ? diplomaRes.value.data : []);
        } catch (error) {
            console.error('Error fetching:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // Combine documents + TORs into unified list
    const allItems = [
        ...documents.map(d => ({
            id: d.documentId, type: 'document', category: d.category,
            documentType: d.documentType, studentName: d.studentName,
            studentId: d.studentId, status: d.status, date: d.createdAt,
            course: d.course, pdfPath: d.pdfPath, raw: d
        })),
        ...tors.map(t => ({
            id: t.torId, type: 'tor', category: 'Transcript of Records',
            documentType: 'Transcript of Records', studentName: t.studentName,
            studentId: t.studentId, status: t.status, date: t.createdAt,
            course: t.course, pdfPath: t.pdfPath, raw: t
        })),
        ...diplomas.map(d => ({
            id: d.diplomaId, type: 'diploma', category: 'Diploma',
            documentType: 'Diploma', studentName: d.studentName,
            studentId: d.studentId, status: d.status, date: d.createdAt,
            course: d.course, pdfPath: d.pdfPath, raw: d
        }))
    ];

    // Filter
    const filtered = allItems.filter(item => {
        const matchTab = activeTab === 'All' || item.category === activeTab;
        const matchSearch = item.studentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.studentId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.id?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = statusFilter === 'All' || item.status === statusFilter;
        return matchTab && matchSearch && matchStatus;
    });

    // Stats
    const tabCounts = {
        'All': allItems.length,
        'Certification': allItems.filter(i => i.category === 'Certification').length,
        'Certified True Copy': allItems.filter(i => i.category === 'Certified True Copy').length,
        'Transcript of Records': allItems.filter(i => i.category === 'Transcript of Records').length,
        'Diploma': allItems.filter(i => i.category === 'Diploma').length,
    };

    const handleDelete = (item) => {
        setConfirmConfig({
            title: 'Delete Document',
            message: `Are you sure you want to permanently delete "${item.documentType}" for ${item.studentName}? This action cannot be undone.`,
            type: 'danger',
            confirmText: 'Delete',
            onConfirm: async () => {
                setConfirmConfig(prev => ({ ...prev, isLoading: true }));
                try {
                    if (item.type === 'tor') {
                        await api.delete(`/tor/${item.id}`);
                    } else if (item.type === 'diploma') {
                        await api.delete(`/diploma/${item.id}`);
                    } else {
                        await api.delete(`/documents/${item.id}`);
                    }
                    fetchAll();
                } catch (error) {
                    showFeedback({
                        title: 'Delete Failed',
                        message: 'We couldn\'t delete this document right now. Please try again.',
                        type: 'error'
                    });
                } finally {
                    setConfirmConfig(null);
                }
            }
        });
    };

    const handleDownload = async (item) => {
        try {
            const endpoint = item.type === 'tor' ? `/tor/${item.id}/download`
                : item.type === 'diploma' ? `/diploma/${item.id}/download`
                : `/documents/${item.id}/download`;
            const res = await api.get(endpoint, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${item.documentType}-${item.studentName}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            showFeedback({
                title: 'Download Failed',
                message: 'There was an issue downloading your PDF. Please try again.',
                type: 'error'
            });
        }
    };

    const getStatusBadge = (status) => {
        const styles = {
            Draft: 'bg-yellow-50 text-yellow-700 border-yellow-200',
            Finalized: 'bg-blue-50 text-blue-700 border-blue-200',
            Released: 'bg-green-50 text-green-700 border-green-200'
        };
        return (
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${styles[status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                {status}
            </span>
        );
    };

    const getCategoryIcon = (cat) => {
        if (cat === 'Certification') return '📜';
        if (cat === 'Certified True Copy') return '📋';
        return '🎓';
    };

    return (
        <Layout>
            <div className="p-6 lg:p-8">
                {/* Page Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#2f3947] rounded-lg flex items-center justify-center">
                            <FolderOpen className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-800">Document Management</h1>
                            <p className="text-sm text-gray-500">Manage all document types — Certifications, CTCs, and Transcripts</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {activeTab === 'Transcript of Records' && (
                            <button
                                onClick={() => { setShowUploadModal(true); }}
                                className="flex items-center gap-2 bg-[#2f3947] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#3a4858] transition-colors shadow-sm"
                            >
                                <Upload className="w-4 h-4" /> Import CSV
                            </button>
                        )}
                        {activeTab === 'Diploma' && (
                            <button
                                onClick={() => { setShowDiplomaUploadModal(true); }}
                                className="flex items-center gap-2 bg-[#2f3947] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#3a4858] transition-colors shadow-sm"
                            >
                                <Upload className="w-4 h-4" /> Import CSV
                            </button>
                        )}
                        {activeTab !== 'Transcript of Records' && activeTab !== 'Diploma' && (
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="flex items-center gap-2 bg-[#2f3947] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#3a4858] transition-colors shadow-sm"
                            >
                                <Upload className="w-4 h-4" /> Import PDF
                            </button>
                        )}
                    </div>
                </div>

                {/* Category Tabs */}
                <div className="flex gap-2 mb-6 border-b border-gray-200 pb-0">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveTab(cat)}
                            className={`px-5 py-3 text-sm font-medium rounded-t-lg transition-all relative ${
                                activeTab === cat
                                    ? 'bg-white text-[#2f3947] border border-gray-200 border-b-white -mb-px font-bold'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            {cat === 'All' ? 'All Documents' : cat}
                            <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                                activeTab === cat ? 'bg-[#2f3947] text-white' : 'bg-gray-100 text-gray-500'
                            }`}>
                                {tabCounts[cat]}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Search & Filter */}
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text" placeholder="Search by name, student ID, or document ID..."
                            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#6f8faa] bg-white"
                        />
                    </div>
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                            className="pl-10 pr-8 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#6f8faa] bg-white appearance-none cursor-pointer">
                            <option value="All">All Status</option>
                            <option value="Draft">Draft</option>
                            <option value="Finalized">Finalized</option>
                            <option value="Released">Released</option>
                        </select>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
                    {[
                        { label: 'Total Documents', count: filtered.length, color: 'bg-[#2f3947]' },
                        { label: 'Drafts', count: filtered.filter(i => i.status === 'Draft').length, color: 'bg-yellow-500' },
                        { label: 'Finalized', count: filtered.filter(i => i.status === 'Finalized').length, color: 'bg-blue-500' },
                        { label: 'Released', count: filtered.filter(i => i.status === 'Released').length, color: 'bg-green-500' }
                    ].map(stat => (
                        <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                            <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center`}>
                                <FileText className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-800">{stat.count}</p>
                                <p className="text-xs text-gray-500">{stat.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Documents Table */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-8 h-8 border-2 border-[#2f3947] border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                            <FolderOpen className="w-12 h-12 mb-3 opacity-40" />
                            <p className="font-medium">No documents found</p>
                            <p className="text-sm mt-1">Create a document or import a CSV to get started</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">ID</th>
                                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Document Type</th>
                                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Student</th>
                                        <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                        <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                                        <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filtered.map(item => (
                                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-5 py-3.5 text-sm font-mono text-gray-600">{item.id}</td>
                                            <td className="px-5 py-3.5 text-sm">
                                                <span className="flex items-center gap-2">
                                                    {getCategoryIcon(item.category)}
                                                    <span className="text-gray-700">{item.category}</span>
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-sm text-gray-800 font-medium">{item.documentType}</td>
                                            <td className="px-5 py-3.5">
                                                <p className="text-sm font-medium text-gray-800">{item.studentName}</p>
                                                <p className="text-xs text-gray-400">{item.studentId}</p>
                                            </td>
                                            <td className="px-5 py-3.5 text-center">{getStatusBadge(item.status)}</td>
                                            <td className="px-5 py-3.5 text-sm text-gray-500 text-center">
                                                {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </td>
                                            <td className="px-5 py-3.5 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => navigate(item.type === 'tor' ? `/tor/${item.id}` : item.type === 'diploma' ? `/diploma/${item.id}` : `/documents/${item.id}`)}
                                                        className="p-1.5 rounded-md hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                                                        title="View Details"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    {item.pdfPath && (
                                                        <button
                                                            onClick={() => handleDownload(item)}
                                                            className="p-1.5 rounded-md hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors"
                                                            title="Download PDF"
                                                        >
                                                            <Download className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {userRole === 'super admin' && (
                                                        <button
                                                            onClick={() => handleDelete(item)}
                                                            className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Create Document Modal */}
                {showCreateModal && (
                    <CreateDocumentModal
                        activeTab={activeTab}
                        prefillData={prefillData}
                        onClose={() => { setShowCreateModal(false); setPrefillData(null); }}
                        onSuccess={() => { setShowCreateModal(false); setPrefillData(null); fetchAll(); }}
                    />
                )}

                {/* TOR CSV Upload Modal */}
                {showUploadModal && (
                    <TORUploadModal
                        onClose={() => setShowUploadModal(false)}
                        onSuccess={() => { setShowUploadModal(false); fetchAll(); }}
                    />
                )}

                {/* Diploma CSV Upload Modal */}
                {showDiplomaUploadModal && (
                    <DiplomaUploadModal
                        onClose={() => setShowDiplomaUploadModal(false)}
                        onSuccess={() => { setShowDiplomaUploadModal(false); fetchAll(); }}
                    />
                )}

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

export default DocumentManagement;
