import { useState, useEffect, useMemo } from 'react';
import Layout from '../../components/Layout';
import { Search, Plus, SlidersHorizontal, ArrowDownAZ, ArrowUpZA, Eye, EyeOff } from 'lucide-react';
import FilterDrawer from '../../components/FilterDrawer';
import ActiveFilterChips from '../../components/ActiveFilterChips';
import axiosInstance from '../../components/config/axiosConfig';
import ConfirmModal from '../../components/ConfirmModal';
import FeedbackModal from '../../components/FeedbackModal';

const StudentManagement = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('student'); // 'student' or 'alumni'
    const [filterProgram, setFilterProgram] = useState('All');
    const [filterStatus, setFilterStatus] = useState('All');
    
    // Pagination
    const [entriesPerPage, setEntriesPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        studentId: '',
        programLevel: 'Bachelors'
    });
    const [adding, setAdding] = useState(false);
    const [addError, setAddError] = useState(null);

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

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const [studentsRes, alumniRes] = await Promise.all([
                axiosInstance.get('/v1/students'),
                axiosInstance.get('/v1/alumni').catch(() => ({ data: { data: [] } }))
            ]);
            setUsers([...studentsRes.data.data, ...alumniRes.data.data]);
            setError(null);
        } catch (err) {
            console.error('Error fetching users:', err);
            setError('Failed to load users. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleDelete = (userId, userRole, userName) => {
        showConfirm({
            title: 'Delete User',
            message: `Are you sure you want to permanently delete the account for ${userName}? This action cannot be undone.`,
            type: 'danger',
            confirmText: 'Delete',
            onConfirm: async () => {
                try {
                    const endpoint = userRole === 'alumni' ? `/v1/alumni/${userId}` : `/v1/students/${userId}`;
                    await axiosInstance.delete(endpoint);
                    setUsers(prev => prev.filter(user => user._id !== userId));
                } catch (err) {
                    console.error('Error deleting user:', err);
                    showFeedback({
                        title: 'Error Deleting User',
                        message: 'Oops! We couldn\'t delete this user right now. Please try again later.',
                        type: 'error'
                    });
                }
            }
        });
    };

    const handleStatusChange = (userId, userRole, newStatus) => {
        showConfirm({
            title: 'Change Status',
            message: `Are you sure you want to change this account's status to ${newStatus}?`,
            type: 'warning',
            confirmText: 'Change',
            onConfirm: async () => {
                try {
                    const endpoint = userRole === 'alumni' ? `/v1/alumni/${userId}/status` : `/v1/students/${userId}/status`;
                    const response = await axiosInstance.put(endpoint, { status: newStatus });
                    if (response.data && response.data.data) {
                        setUsers(prev => prev.map(user => 
                            user._id === userId ? { ...user, status: response.data.data.status } : user
                        ));
                    }
                } catch (err) {
                    console.error('Error updating status:', err);
                    showFeedback({
                        title: 'Update Failed',
                        message: 'We couldn\'t update the account status. Please try again later.',
                        type: 'error'
                    });
                }
            }
        });
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleAddStudent = async (e) => {
        e.preventDefault();
        setAddError(null);
        setAdding(true);
        try {
            const endpoint = activeTab === 'alumni' ? '/v1/alumni' : '/v1/students';
            const payload = { ...formData, role: activeTab };
            const response = await axiosInstance.post(endpoint, payload);
            
            const newUser = response.data.data;
            // Add new user to the top of the list
            setUsers([newUser, ...users]);
            setShowModal(false);
            setFormData({ firstName: '', lastName: '', email: '', password: '', studentId: '', programLevel: 'Bachelors' });
        } catch (err) {
            console.error('Error adding user:', err);
            setAddError(err.response?.data?.message || 'Failed to add user. Please check the details and try again.');
        } finally {
            setAdding(false);
        }
    };

    const filteredUsers = useMemo(() => {
        return users.filter((user) => {
            const roleMatch = (user.role || 'student') === activeTab;
            if (!roleMatch) return false;

            const search = searchTerm.toLowerCase();
            const matchesSearch = (
                (user.firstName && user.firstName.toLowerCase().includes(search)) ||
                (user.lastName && user.lastName.toLowerCase().includes(search)) ||
                (user.email && user.email.toLowerCase().includes(search)) ||
                (user.studentId && user.studentId.toLowerCase().includes(search))
            );

            const userStatus = user.status || 'Active';
            const matchesStatus = filterStatus === 'All' || userStatus === filterStatus;
            
            const userProgram = user.programLevel || 'Bachelors';
            const matchesProgram = activeTab === 'alumni' || filterProgram === 'All' || userProgram === filterProgram;

            return matchesSearch && matchesStatus && matchesProgram;
        }).sort((a, b) => {
            let valA = a[sortConfig.key];
            let valB = b[sortConfig.key];
            
            // Special handling for nested or specific types
            if (sortConfig.key === 'createdAt') {
                valA = new Date(valA || Date.now()).getTime();
                valB = new Date(valB || Date.now()).getTime();
            } else if (sortConfig.key === 'firstName') {
                valA = valA ? valA.toLowerCase() : '';
                valB = valB ? valB.toLowerCase() : '';
            } else if (sortConfig.key === 'email') {
                valA = valA ? valA.toLowerCase() : '';
                valB = valB ? valB.toLowerCase() : '';
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [users, activeTab, searchTerm, filterStatus, filterProgram, sortConfig]);

    const totalPages = Math.ceil(filteredUsers.length / entriesPerPage);
    const paginatedUsers = filteredUsers.slice(
        (currentPage - 1) * entriesPerPage,
        currentPage * entriesPerPage
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, activeTab, entriesPerPage, filterStatus, filterProgram]);

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
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">User Management</h1>
                    <p className="text-sm text-gray-500">View and manage registered mobile app users.</p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md mb-6">
                        {error}
                    </div>
                )}

                {/* Tabs */}
                <div className="flex space-x-6 mb-6">
                    <button
                        onClick={() => setActiveTab('student')}
                        className={`pb-2 font-bold text-sm transition-colors border-b-[3px] ${
                            activeTab === 'student'
                                ? 'border-[#1D2D44] text-[#1D2D44]'
                                : 'border-transparent text-gray-500 hover:text-gray-800'
                        }`}
                    >
                        Students
                    </button>
                    <button
                        onClick={() => setActiveTab('alumni')}
                        className={`pb-2 font-bold text-sm transition-colors border-b-[3px] ${
                            activeTab === 'alumni'
                                ? 'border-[#1D2D44] text-[#1D2D44]'
                                : 'border-transparent text-gray-500 hover:text-gray-800'
                        }`}
                    >
                        Alumni
                    </button>
                </div>

                <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
                    
                    {/* Header Section */}
                    <div className="flex flex-col gap-4 p-6 border-b border-gray-100">
                        <div className="flex items-center justify-between gap-6">
                            <div className="flex items-center gap-3">
                                {/* Search Bar */}
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                    <input
                                        type="text"
                                        placeholder="Search users..."
                                        className="w-64 rounded-md border border-gray-300 py-2 pl-9 pr-4 text-xs outline-none focus:border-[#1D2D44]"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <button 
                                    onClick={() => setIsFilterDrawerOpen(true)}
                                    className="bg-gray-100 text-gray-700 px-4 py-2 rounded font-bold text-xs hover:bg-gray-200 transition-colors flex items-center gap-2 border border-gray-200"
                                >
                                    <SlidersHorizontal size={14} /> Filters & Sort
                                </button>
                            </div>
                            {/* Add Button */}
                            <button 
                                onClick={() => setShowModal(true)}
                                className="flex items-center justify-center gap-2 rounded-md bg-[#6c4df6] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#5a3ed9] transition-all shadow-sm"
                            >
                                <Plus size={16} />
                                Add New {activeTab === 'student' ? 'Student' : 'Alumni'}
                            </button>
                        </div>

                        <ActiveFilterChips 
                            filters={[
                                { label: 'Program', value: activeTab === 'student' ? filterProgram : null, key: 'filterProgram' },
                                { label: 'Status', value: filterStatus, key: 'filterStatus' },
                            ]}
                            onRemove={(key) => {
                                if (key === 'filterProgram') setFilterProgram('All');
                                if (key === 'filterStatus') setFilterStatus('All');
                            }}
                        />
                    </div>

                    {/* Filter Drawer */}
                    <FilterDrawer 
                        isOpen={isFilterDrawerOpen} 
                        onClose={() => setIsFilterDrawerOpen(false)}
                        onClearAll={() => {
                            setFilterProgram('All');
                            setFilterStatus('All');
                            setSortConfig({ key: 'createdAt', direction: 'desc' });
                        }}
                    >
                        <div className="flex flex-col gap-4">
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Sorting</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-bold text-[#1D2D44]">Sort By:</label>
                                    <select 
                                        className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#1D2D44] bg-white"
                                        value={sortConfig.key}
                                        onChange={(e) => setSortConfig({ ...sortConfig, key: e.target.value })}
                                    >
                                        <option value="createdAt">Joined Date</option>
                                        <option value="firstName">Name</option>
                                        <option value="email">Email</option>
                                        <option value="status">Status</option>
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-bold text-[#1D2D44]">Order:</label>
                                    <button 
                                        onClick={() => setSortConfig({ ...sortConfig, direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}
                                        className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white flex items-center justify-between hover:bg-gray-50 transition-colors"
                                    >
                                        {sortConfig.direction === 'asc' ? 'Ascending' : 'Descending'}
                                        {sortConfig.direction === 'asc' ? <ArrowUpZA size={16} className="text-gray-500"/> : <ArrowDownAZ size={16} className="text-gray-500"/>}
                                    </button>
                                </div>
                            </div>

                            <div className="border-t border-gray-100 my-2"></div>

                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Filtering</h3>
                            
                            {activeTab === 'student' && (
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-bold text-[#1D2D44]">Program Level:</label>
                                    <select 
                                        value={filterProgram}
                                        onChange={e => setFilterProgram(e.target.value)}
                                        className="rounded-md border border-gray-300 py-2 px-3 text-sm outline-none focus:border-[#1D2D44] bg-white cursor-pointer shadow-sm text-gray-700"
                                    >
                                        <option value="All">All Programs</option>
                                        <option value="Bachelors">Bachelors</option>
                                        <option value="Masters">Masters</option>
                                        <option value="Doctorate">Doctorate</option>
                                    </select>
                                </div>
                            )}

                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-bold text-[#1D2D44]">Status:</label>
                                <select 
                                    value={filterStatus}
                                    onChange={e => setFilterStatus(e.target.value)}
                                    className="rounded-md border border-gray-300 py-2 px-3 text-sm outline-none focus:border-[#1D2D44] bg-white cursor-pointer shadow-sm text-gray-700"
                                >
                                    <option value="All">All Statuses</option>
                                    <option value="Active">Active</option>
                                    <option value="Inactive">Inactive</option>
                                    <option value="Stopped">Stopped</option>
                                </select>
                            </div>
                        </div>
                    </FilterDrawer>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white text-[11px] font-bold uppercase tracking-wider text-gray-800 border-b border-gray-200">
                                    <th className="px-8 py-5">Name</th>
                                    <th className="px-8 py-5">{activeTab === 'student' ? 'School Email' : 'Email'}</th>
                                    <th className="px-8 py-5">Student ID</th>
                                    {activeTab === 'student' && <th className="px-8 py-5">Program</th>}
                                    <th className="px-8 py-5">Joined Date</th>
                                    <th className="px-8 py-5 text-center">Status</th>
                                    <th className="px-8 py-5 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-[13px]">
                                {loading ? (
                                    <tr><td colSpan="5" className="py-20 text-center text-gray-400">Loading users...</td></tr>
                                ) : paginatedUsers.length > 0 ? (
                                    paginatedUsers.map((user, idx) => (
                                        <tr
                                            key={user._id}
                                            className={`transition-colors ${idx % 2 !== 0 ? 'bg-[#F9FAFF]' : 'bg-white hover:bg-gray-50'}`}
                                        >
                                            <td className="px-8 py-4 font-semibold text-gray-800">
                                                {user.firstName} {user.lastName}
                                            </td>
                                            <td className="px-8 py-4 text-gray-600">{user.email}</td>
                                            <td className="px-8 py-4 font-mono text-gray-500">
                                                {user.studentId ? user.studentId : 'N/A'}
                                            </td>
                                            {activeTab === 'student' && (
                                                <td className="px-8 py-4 text-gray-600 font-medium">
                                                    {user.programLevel || 'Bachelors'}
                                                </td>
                                            )}
                                            <td className="px-8 py-4 text-gray-600">
                                                {new Date(user.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-8 py-4 text-center">
                                                <div className="relative inline-block min-w-[100px]">
                                                    <select
                                                        value={user.status || 'Active'}
                                                        onChange={(e) => handleStatusChange(user._id, user.role || 'student', e.target.value)}
                                                        className={`w-full appearance-none rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide outline-none cursor-pointer text-center transition-all shadow-sm focus:ring-2 focus:ring-offset-1 focus:ring-gray-300 ${
                                                            (user.status || 'Active') === 'Active'
                                                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                        }`}
                                                        style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
                                                    >
                                                        <option value="Active" className="text-gray-700 font-bold bg-white">ACTIVE</option>
                                                        <option value="Inactive" className="text-gray-700 font-bold bg-white">INACTIVE</option>
                                                    </select>
                                                    <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                                                        <i className={`fa-solid fa-chevron-down text-[8px] ${
                                                            (user.status || 'Active') === 'Active' ? 'text-green-700' : 'text-gray-700'
                                                        }`}></i>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleDelete(user._id, user.role || 'student', `${user.firstName} ${user.lastName}`)}
                                                        className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-600 hover:bg-red-600 hover:text-white transition-all shadow-sm border border-red-100 group"
                                                        title="Delete User"
                                                    >
                                                        <i className="fa-regular fa-trash-can group-hover:scale-110 transition-transform"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan="5" className="py-20 text-center text-gray-400 italic">No {activeTab === 'student' ? 'students' : 'alumni'} found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Table Footer / Pagination Placeholder */}
                    <div className="p-6 border-t border-gray-100 flex justify-center">
                        <div className="flex items-center gap-2">
                            <button 
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                className={`text-xs px-2 ${currentPage === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:text-black hover:underline cursor-pointer'}`}
                            >
                                Previous
                            </button>
                            
                            {Array.from({ length: totalPages }).map((_, idx) => {
                                const pageNumber = idx + 1;
                                if (pageNumber === 1 || pageNumber === totalPages || (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)) {
                                    return (
                                        <button
                                            key={pageNumber}
                                            onClick={() => setCurrentPage(pageNumber)}
                                            className={`w-8 h-8 rounded text-xs transition-colors font-bold ${
                                                currentPage === pageNumber 
                                                    ? 'bg-[#1D2D44] text-white' 
                                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                            }`}
                                        >
                                            {pageNumber}
                                        </button>
                                    );
                                } else if (pageNumber === currentPage - 2 || pageNumber === currentPage + 2) {
                                    return <span key={pageNumber} className="text-gray-400 mt-2 text-xs">...</span>;
                                }
                                return null;
                            })}

                            <button 
                                disabled={currentPage === totalPages || totalPages === 0}
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                className={`text-xs px-2 ${currentPage === totalPages || totalPages === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:text-black hover:underline cursor-pointer'}`}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>

                {/* Add Student Modal */}
                {showModal && (
                    <div className="fixed inset-0 bg-[#1D2D44]/80 flex items-center justify-center z-[1100] backdrop-blur-sm">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100">
                            <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-[#F9FAFF]">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800">Add New {activeTab === 'student' ? 'Student' : 'Alumni'}</h3>
                                    <p className="text-xs text-gray-500 mt-1">Register a new mobile user</p>
                                </div>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition"
                                >
                                    <i className="fa-solid fa-xmark"></i>
                                </button>
                            </div>
                            
                            <form onSubmit={handleAddStudent} className="p-8">
                                {addError && (
                                    <div className="bg-red-50 text-red-600 p-3 rounded-md text-xs font-medium mb-5 border border-red-200">
                                        <i className="fa-solid fa-circle-exclamation mr-1"></i> {addError}
                                    </div>
                                )}

                                <div className="space-y-5">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">First Name</label>
                                            <input
                                                type="text"
                                                name="firstName"
                                                value={formData.firstName}
                                                onChange={handleInputChange}
                                                required
                                                className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6c4df6] focus:border-transparent bg-gray-50 focus:bg-white transition-all"
                                                placeholder="First Name"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Last Name</label>
                                            <input
                                                type="text"
                                                name="lastName"
                                                value={formData.lastName}
                                                onChange={handleInputChange}
                                                required
                                                className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6c4df6] focus:border-transparent bg-gray-50 focus:bg-white transition-all"
                                                placeholder="Last Name"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">{activeTab === 'student' ? 'School Email' : 'Email'}</label>
                                            <input
                                                type="email"
                                                name="email"
                                                value={formData.email}
                                                onChange={handleInputChange}
                                                required
                                                className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6c4df6] focus:border-transparent bg-gray-50 focus:bg-white transition-all"
                                                placeholder={activeTab === 'student' ? "student@school.edu" : "alumni@email.com"}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Student ID</label>
                                            <input
                                                type="text"
                                                name="studentId"
                                                value={activeTab === 'alumni' ? 'Auto-generated' : formData.studentId}
                                                onChange={handleInputChange}
                                                required={activeTab === 'student'}
                                                disabled={activeTab === 'alumni'}
                                                className={`w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6c4df6] focus:border-transparent transition-all ${activeTab === 'alumni' ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-gray-50 focus:bg-white'}`}
                                                placeholder={activeTab === 'student' ? "e.g. 2021-00001" : "Auto-generated"}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Password</label>
                                        <div className="relative">
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                name="password"
                                                value={formData.password}
                                                onChange={handleInputChange}
                                                required
                                                className="w-full px-4 py-2.5 pr-10 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6c4df6] focus:border-transparent bg-gray-50 focus:bg-white transition-all"
                                                placeholder="Assign a secure password"
                                            />
                                            <button
                                                type="button"
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                                                onClick={() => setShowPassword(!showPassword)}
                                            >
                                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                    {activeTab === 'student' && (
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Program Level</label>
                                            <select
                                                name="programLevel"
                                                value={formData.programLevel}
                                                onChange={handleInputChange}
                                                className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6c4df6] focus:border-transparent bg-gray-50 focus:bg-white transition-all cursor-pointer"
                                            >
                                                <option value="Bachelors">Bachelors</option>
                                                <option value="Masters">Masters</option>
                                                <option value="Doctorate">Doctorate</option>
                                            </select>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-gray-100">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="px-5 py-2.5 text-xs font-bold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={adding}
                                        className="px-6 py-2.5 text-xs font-bold text-white bg-[#6c4df6] rounded-lg hover:bg-[#5a3ed9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center shadow-md shadow-[#6c4df6]/20"
                                    >
                                        {adding ? (
                                            <><i className="fa-solid fa-spinner fa-spin mr-2"></i> Registering...</>
                                        ) : (
                                            'Register ' + (activeTab === 'student' ? 'Student' : 'Alumni')
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
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

export default StudentManagement;
