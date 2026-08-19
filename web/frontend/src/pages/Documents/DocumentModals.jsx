import { useState } from 'react';
import { X, Upload, FileText, FileUp, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../../api';

const CERT_TYPES = [
  'Certificate of Enrollment', 'Certificate of Good Moral', 'Grade Certification',
  'Certificate of Candidacy for Graduation', 'Certificate of Units Earned',
  'Certificate of Assessment', 'Certificate of Registration'
];
const CTC_TYPES = ['CTC of Certificate of Matriculation', 'CTC of Diploma', 'CTC of Curriculum'];

// ─── Create Document Modal ───
export const CreateDocumentModal = ({ activeTab, prefillData, onClose, onSuccess }) => {
    // Determine category from prefill documentType
    const detectCategory = (docType) => {
        if (CERT_TYPES.includes(docType)) return 'Certification';
        if (CTC_TYPES.includes(docType)) return 'Certified True Copy';
        return activeTab === 'Certification' || activeTab === 'Certified True Copy' ? activeTab : 'Certification';
    };

    const [category, setCategory] = useState(
        prefillData?.documentType ? detectCategory(prefillData.documentType) :
        (activeTab === 'Certification' || activeTab === 'Certified True Copy' ? activeTab : 'Certification')
    );
    const [documentType, setDocumentType] = useState(prefillData?.documentType || '');
    const [studentName, setStudentName] = useState(prefillData?.studentName || '');
    const [studentId, setStudentId] = useState(prefillData?.studentId || '');
    const [course, setCourse] = useState(prefillData?.course || '');
    const [yearLevel, setYearLevel] = useState(prefillData?.yearLevel || '');
    const [purpose, setPurpose] = useState(prefillData?.purpose || '');
    const [notes, setNotes] = useState('');
    const [pdfFile, setPdfFile] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [linkedRequestId] = useState(prefillData?.linkedRequestId || '');

    const docTypeOptions = category === 'Certification' ? CERT_TYPES : CTC_TYPES;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!documentType || !studentName || !studentId) {
            setError('Please fill in all required fields');
            return;
        }
        if (!pdfFile) {
            setError('Please upload a PDF file');
            return;
        }
        setSubmitting(true);
        setError('');
        try {
            const formData = new FormData();
            formData.append('category', category);
            formData.append('documentType', documentType);
            formData.append('studentName', studentName);
            formData.append('studentId', studentId);
            formData.append('course', course);
            formData.append('yearLevel', yearLevel);
            formData.append('purpose', purpose);
            formData.append('notes', notes);
            if (linkedRequestId) formData.append('linkedRequestId', linkedRequestId);
            formData.append('pdfFile', pdfFile);

            await api.post('/documents', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            onSuccess();
        } catch (err) {
            setError(err.response?.data?.message || 'Error creating document');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800">Import Document PDF</h2>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {linkedRequestId && (
                        <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm border border-blue-100">
                            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                            <span>Linked to Request <strong>#{linkedRequestId}</strong></span>
                        </div>
                    )}
                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                            <AlertCircle className="w-4 h-4" /> {error}
                        </div>
                    )}

                    {/* Category */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Category *</label>
                        <select value={category} onChange={(e) => { setCategory(e.target.value); setDocumentType(''); }}
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#6f8faa]">
                            <option value="Certification">Certification</option>
                            <option value="Certified True Copy">Certified True Copy</option>
                        </select>
                    </div>

                    {/* Document Type */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Document Type *</label>
                        <select value={documentType} onChange={(e) => setDocumentType(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#6f8faa]">
                            <option value="">Select document type...</option>
                            {docTypeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>

                    {/* Student Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Student Name *</label>
                            <input type="text" value={studentName} onChange={(e) => setStudentName(e.target.value)}
                                placeholder="Full Name" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#6f8faa]" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Student ID *</label>
                            <input type="text" value={studentId} onChange={(e) => setStudentId(e.target.value)}
                                placeholder="e.g. 2024-00001" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#6f8faa]" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Course</label>
                            <input type="text" value={course} onChange={(e) => setCourse(e.target.value)}
                                placeholder="e.g. BSIT" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#6f8faa]" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Year Level</label>
                            <input type="text" value={yearLevel} onChange={(e) => setYearLevel(e.target.value)}
                                placeholder="e.g. 4th Year" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#6f8faa]" />
                        </div>
                    </div>

                    {/* Purpose & Notes */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Purpose</label>
                        <input type="text" value={purpose} onChange={(e) => setPurpose(e.target.value)}
                            placeholder="e.g. Employment, Board Exam" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#6f8faa]" />
                    </div>

                    {/* PDF Upload */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Document PDF *</label>
                        <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center hover:border-[#6f8faa] transition-colors cursor-pointer"
                            onClick={() => document.getElementById('docPdfInput').click()}>
                            <input type="file" id="docPdfInput" accept=".pdf" className="hidden"
                                onChange={(e) => setPdfFile(e.target.files[0])} />
                            {pdfFile ? (
                                <div className="flex items-center justify-center gap-2 text-green-600">
                                    <CheckCircle2 className="w-5 h-5" />
                                    <span className="text-sm font-medium">{pdfFile.name}</span>
                                </div>
                            ) : (
                                <>
                                    <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                    <p className="text-sm text-gray-500">Click to upload PDF</p>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Notes</label>
                        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                            placeholder="Optional notes..." className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#6f8faa] resize-none" />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors">
                            Cancel
                        </button>
                        <button type="submit" disabled={submitting}
                            className="flex-[2] py-2.5 rounded-lg bg-[#2f3947] text-white text-sm font-medium hover:bg-[#3a4858] transition-colors disabled:opacity-50">
                            {submitting ? 'Importing...' : 'Import Document'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ─── TOR CSV Upload Modal (preserved from original TORManagement) ───
export const TORUploadModal = ({ onClose, onSuccess }) => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState(null);
    const [dragOver, setDragOver] = useState(false);
    const [csvPreview, setCsvPreview] = useState(null);

    const handleFile = (file) => {
        if (!file || !file.name.endsWith('.csv')) {
            setUploadResult({ type: 'error', message: 'Please select a valid CSV spreadsheet to upload.' });
            return;
        }
        setSelectedFile(file);
        setUploadResult(null);
        // Preview
        const reader = new FileReader();
        reader.onload = (e) => {
            const lines = e.target.result.split('\n').slice(0, 6);
            setCsvPreview(lines.map(l => l.split(',')));
        };
        reader.readAsText(file);
    };

    const handleUpload = async () => {
        if (!selectedFile) return;
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('csvFile', selectedFile);
            const res = await api.post('/tor/upload-csv', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setUploadResult({ type: 'success', message: res.data.message || 'TOR records imported successfully!' });
            setTimeout(() => onSuccess(), 1500);
        } catch (error) {
            setUploadResult({ type: 'error', message: error.response?.data?.message || 'Upload failed' });
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800">Import TOR Records (CSV)</h2>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>
                <div className="p-6">
                    {uploadResult && (
                        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm mb-4 ${
                            uploadResult.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                        }`}>
                            {uploadResult.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                            {uploadResult.message}
                        </div>
                    )}

                    <div
                        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                            dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
                        onClick={() => document.getElementById('csvInput').click()}
                    >
                        <input type="file" id="csvInput" accept=".csv" className="hidden"
                            onChange={(e) => handleFile(e.target.files[0])} />
                        {selectedFile ? (
                            <div className="flex items-center justify-center gap-2 text-green-600">
                                <FileText className="w-6 h-6" />
                                <span className="font-medium">{selectedFile.name}</span>
                            </div>
                        ) : (
                            <>
                                <FileUp className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                <p className="text-sm text-gray-600 font-medium">Drag & drop CSV file here</p>
                                <p className="text-xs text-gray-400 mt-1">or click to browse</p>
                            </>
                        )}
                    </div>

                    {csvPreview && (
                        <div className="mt-4 overflow-x-auto border border-gray-100 rounded-lg">
                            <table className="w-full text-xs">
                                <tbody>
                                    {csvPreview.map((row, i) => (
                                        <tr key={i} className={i === 0 ? 'bg-gray-50 font-semibold' : ''}>
                                            {row.map((cell, j) => (
                                                <td key={j} className="px-3 py-1.5 border-b border-gray-50 text-gray-600 truncate max-w-[120px]">{cell}</td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="flex gap-3 mt-6">
                        <button onClick={onClose}
                            className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors">
                            Cancel
                        </button>
                        <button onClick={handleUpload} disabled={!selectedFile || uploading}
                            className="flex-[2] py-2.5 rounded-lg bg-[#2f3947] text-white text-sm font-medium hover:bg-[#3a4858] transition-colors disabled:opacity-50">
                            {uploading ? 'Uploading...' : 'Import CSV'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Diploma CSV Upload Modal ───
export const DiplomaUploadModal = ({ onClose, onSuccess }) => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState(null);
    const [dragOver, setDragOver] = useState(false);
    const [csvPreview, setCsvPreview] = useState(null);

    const handleFile = (file) => {
        if (!file || !file.name.endsWith('.csv')) {
            setUploadResult({ type: 'error', message: 'Please select a valid CSV spreadsheet to upload.' });
            return;
        }
        setSelectedFile(file);
        setUploadResult(null);
        // Preview
        const reader = new FileReader();
        reader.onload = (e) => {
            const lines = e.target.result.split('\n').slice(0, 6);
            setCsvPreview(lines.map(l => l.split(',')));
        };
        reader.readAsText(file);
    };

    const handleUpload = async () => {
        if (!selectedFile) return;
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('csvFile', selectedFile);
            const res = await api.post('/diploma/upload-csv', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setUploadResult({ type: 'success', message: res.data.message || 'Diploma records imported successfully!' });
            setTimeout(() => onSuccess(), 1500);
        } catch (error) {
            setUploadResult({ type: 'error', message: error.response?.data?.message || 'Upload failed' });
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800">Import Diploma Records (CSV)</h2>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>
                <div className="p-6">
                    {uploadResult && (
                        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm mb-4 ${
                            uploadResult.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                        }`}>
                            {uploadResult.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                            {uploadResult.message}
                        </div>
                    )}

                    <div
                        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                            dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
                        onClick={() => document.getElementById('csvInputDiploma').click()}
                    >
                        <input type="file" id="csvInputDiploma" accept=".csv" className="hidden"
                            onChange={(e) => handleFile(e.target.files[0])} />
                        {selectedFile ? (
                            <div className="flex items-center justify-center gap-2 text-green-600">
                                <FileText className="w-6 h-6" />
                                <span className="font-medium">{selectedFile.name}</span>
                            </div>
                        ) : (
                            <>
                                <FileUp className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                <p className="text-sm text-gray-600 font-medium">Drag & drop CSV file here</p>
                                <p className="text-xs text-gray-400 mt-1">or click to browse</p>
                                <p className="text-[10px] text-gray-400 mt-2">Required Columns: Student ID, Student Name, Course, Honors, Date of Graduation</p>
                            </>
                        )}
                    </div>

                    {csvPreview && (
                        <div className="mt-4 overflow-x-auto border border-gray-100 rounded-lg">
                            <table className="w-full text-xs">
                                <tbody>
                                    {csvPreview.map((row, i) => (
                                        <tr key={i} className={i === 0 ? 'bg-gray-50 font-semibold' : ''}>
                                            {row.map((cell, j) => (
                                                <td key={j} className="px-3 py-1.5 border-b border-gray-50 text-gray-600 truncate max-w-[120px]">{cell}</td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="flex gap-3 mt-6">
                        <button onClick={onClose}
                            className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors">
                            Cancel
                        </button>
                        <button onClick={handleUpload} disabled={!selectedFile || uploading}
                            className="flex-[2] py-2.5 rounded-lg bg-[#2f3947] text-white text-sm font-medium hover:bg-[#3a4858] transition-colors disabled:opacity-50">
                            {uploading ? 'Uploading...' : 'Import CSV'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
