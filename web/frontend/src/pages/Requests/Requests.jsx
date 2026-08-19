import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SlidersHorizontal, ArrowDownAZ, ArrowUpZA } from 'lucide-react';
import Layout from '../../components/Layout';
import FilterDrawer from '../../components/FilterDrawer';
import ActiveFilterChips from '../../components/ActiveFilterChips';
import api from '../../api';

const Requests = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const initialStatus = queryParams.get('status') || 'All Status';

    const [filterStatus, setFilterStatus] = useState(initialStatus);
    const [filterType, setFilterType] = useState('All Document');
    const [filterUserRole, setFilterUserRole] = useState('All');
    const [filterProgram, setFilterProgram] = useState('All');
    const [filterUserStatus, setFilterUserStatus] = useState('All');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [entriesPerPage, setEntriesPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: 'dateRequested', direction: 'desc' });

    const navigate = useNavigate();

    // Update filter if URL changes
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const status = params.get('status');
        if (status) {
            setFilterStatus(status);
        }
    }, [location.search]);

    useEffect(() => {
        const fetchRequests = async () => {
            try {
                const [reqRes, stuRes, alumRes] = await Promise.all([
                    api.get('/requests'),
                    api.get('/v1/students').catch(() => ({ data: { data: [] } })),
                    api.get('/v1/alumni').catch(() => ({ data: { data: [] } }))
                ]);
                
                const users = [...(stuRes.data?.data || []), ...(alumRes.data?.data || [])];
                const userMap = {};
                users.forEach(u => {
                    if (u.email) userMap[u.email] = u;
                });

                const enrichedRequests = (reqRes.data || []).map(req => {
                    const user = userMap[req.email] || {};
                    return {
                        ...req,
                        userRole: user.role || 'student',
                        programLevel: user.programLevel || 'Bachelors',
                        userStatus: user.status || 'Active'
                    };
                });

                setRequests(enrichedRequests);
                if (enrichedRequests.length > 0) {
                    setStartDate(prev => {
                        if (!prev) {
                            const oldest = new Date(Math.min(...enrichedRequests.map(req => new Date(req.dateRequested))));
                            return oldest.toLocaleDateString('en-CA');
                        }
                        return prev;
                    });
                }
            } catch (error) {
                console.error("Error fetching requests:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchRequests();
    }, []);

    // Helper for Status Badge Styling
    const getStatusStyle = (status) => {
        switch (status?.toLowerCase()) {
            case 'released': return 'bg-[#E1FFEB] text-[#28A745]';
            case 'pending': return 'bg-[#FFF9DB] text-[#D4A017]';
            case 'rejected': return 'bg-[#FFE1E1] text-[#DC3545]';
            case 'in process': return 'bg-[#DBEAFE] text-[#2563EB]';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    // Filter Logic
    const filteredRequests = useMemo(() => {
        return requests.filter((req) => {
            const matchesSearch = req.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                req.requestId?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = filterStatus === 'All Status' || req.status === filterStatus;
            const matchesType = filterType === 'All Document' || req.documentType === filterType;

            const matchesRole = filterUserRole === 'All' || (req.userRole || '').toLowerCase() === filterUserRole.toLowerCase();
            const matchesProgram = filterProgram === 'All' || req.programLevel === filterProgram;
            const matchesUserStatus = filterUserStatus === 'All' || req.userStatus === filterUserStatus;

            // Date Logic
            const reqDate = new Date(req.dateRequested);
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;
            if (end) end.setHours(23, 59, 59, 999); // Include the entire end day
            const matchesDate = (!start || reqDate >= start) && (!end || reqDate <= end);

            return matchesSearch && matchesStatus && matchesType && matchesDate && matchesRole && matchesProgram && matchesUserStatus;
        }).sort((a, b) => {
            let valA = a[sortConfig.key];
            let valB = b[sortConfig.key];
            
            // Special handling for nested or specific types
            if (sortConfig.key === 'dateRequested') {
                valA = new Date(valA).getTime();
                valB = new Date(valB).getTime();
            } else if (sortConfig.key === 'name') {
                valA = valA ? valA.toLowerCase() : '';
                valB = valB ? valB.toLowerCase() : '';
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [requests, searchTerm, filterStatus, filterType, filterUserRole, filterProgram, filterUserStatus, startDate, endDate]);

    // Pagination Logic
    const totalPages = Math.ceil(filteredRequests.length / entriesPerPage);
    const paginatedRequests = filteredRequests.slice(
        (currentPage - 1) * entriesPerPage,
        currentPage * entriesPerPage
    );

    // Reset to page 1 if filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterStatus, filterType, filterUserRole, filterProgram, filterUserStatus, startDate, endDate, entriesPerPage, sortConfig]);

    // Dynamic Dropdown Options
    const documentTypes = ['All Document', ...new Set(requests.map(r => r.documentType))];
    const statuses = ['All Status', 'Pending', 'In Process', 'Released', 'Rejected'];

    return (
        <Layout>
            <div className="p-8 bg-[#F8FAFC] min-h-screen font-sans">
                
                {/* --- FILTER SECTION (Matches Image) --- */}
                <div className="bg-white p-6 rounded-t-lg border-x border-t border-gray-200">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            Show 
                            <select 
                                value={entriesPerPage}
                                onChange={(e) => setEntriesPerPage(Number(e.target.value))}
                                className="border border-gray-300 rounded px-1 py-1 focus:outline-none"
                            >
                                <option>10</option>
                                <option>25</option>
                                <option>50</option>
                            </select> 
                            entries
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); document.activeElement?.blur(); }} className="flex gap-2">
                            <input 
                                type="text" 
                                placeholder="Search by name or action..." 
                                className="border border-gray-300 rounded px-4 py-2 w-80 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <button type="submit" className="bg-[#20354D] text-white px-6 py-2 rounded font-bold text-sm hover:bg-slate-800 transition-colors">
                                Search
                            </button>
                            <button 
                                type="button"
                                onClick={() => setIsFilterDrawerOpen(true)}
                                className="bg-gray-100 text-gray-700 px-4 py-2 rounded font-bold text-sm hover:bg-gray-200 transition-colors flex items-center gap-2 border border-gray-200"
                            >
                                <SlidersHorizontal size={16} /> Filters & Sort
                            </button>
                        </form>
                    </div>

                    <ActiveFilterChips 
                        filters={[
                            { label: 'Role', value: filterUserRole, key: 'filterUserRole' },
                            { label: 'Program', value: filterProgram, key: 'filterProgram' },
                            { label: 'User Status', value: filterUserStatus, key: 'filterUserStatus' },
                            { label: 'Doc Type', value: filterType, key: 'filterType' },
                            { label: 'Status', value: filterStatus, key: 'filterStatus' },
                            { label: 'From', value: startDate, key: 'startDate' },
                            { label: 'To', value: endDate, key: 'endDate' },
                        ]}
                        onRemove={(key) => {
                            if (key === 'filterUserRole') setFilterUserRole('All');
                            if (key === 'filterProgram') setFilterProgram('All');
                            if (key === 'filterUserStatus') setFilterUserStatus('All');
                            if (key === 'filterType') setFilterType('All Document');
                            if (key === 'filterStatus') setFilterStatus('All Status');
                            if (key === 'startDate') setStartDate('');
                            if (key === 'endDate') setEndDate('');
                        }}
                    />
                </div>

                {/* Filter Drawer */}
                <FilterDrawer 
                    isOpen={isFilterDrawerOpen} 
                    onClose={() => setIsFilterDrawerOpen(false)}
                    onClearAll={() => {
                        setFilterUserRole('All');
                        setFilterProgram('All');
                        setFilterUserStatus('All');
                        setFilterType('All Document');
                        setFilterStatus('All Status');
                        setStartDate('');
                        setEndDate('');
                        setSortConfig({ key: 'dateRequested', direction: 'desc' });
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
                                    <option value="dateRequested">Date Requested</option>
                                    <option value="name">Name</option>
                                    <option value="status">Status</option>
                                    <option value="documentType">Document Type</option>
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
                        
                        <FilterDropdown label="Document Type:" value={filterType} onChange={setFilterType} options={documentTypes} />
                        <FilterDropdown label="Status:" value={filterStatus} onChange={setFilterStatus} options={statuses} />
                        <FilterDropdown label="User Type:" value={filterUserRole} onChange={setFilterUserRole} options={['All', 'Student', 'Alumni']} />
                        <FilterDropdown label="Program Level:" value={filterProgram} onChange={setFilterProgram} options={['All', 'Bachelors', 'Masters', 'Doctorate']} />
                        <FilterDropdown label="Account Status:" value={filterUserStatus} onChange={setFilterUserStatus} options={['All', 'Active', 'Inactive']} />
                        
                        <div className="grid grid-cols-2 gap-3 mt-2">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-bold text-[#1D2D44]">Start Date:</label>
                                <input 
                                    type="date" 
                                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#1D2D44] bg-white"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-bold text-[#1D2D44]">End Date:</label>
                                <input 
                                    type="date" 
                                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#1D2D44] bg-white"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </FilterDrawer>

                {/* --- TABLE SECTION --- */}
                <div className="bg-white shadow-sm border border-gray-200 overflow-hidden">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-[15px] font-bold text-black border-b border-gray-100">
                                <th className="px-8 py-5">Request ID</th>
                                <th className="px-8 py-5">Name</th>
                                <th className="px-8 py-5">Document Type</th>
                                <th className="px-8 py-5">Date</th>
                                <th className="px-8 py-5">Status</th>
                                <th className="px-8 py-5 text-right"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr><td colSpan="6" className="py-20 text-center text-gray-400">Loading requests...</td></tr>
                            ) : paginatedRequests.length > 0 ? (
                                paginatedRequests.map((req, idx) => {
                                    const reqDate = new Date(req.dateRequested);
                                    const formattedDate = reqDate.toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit'
                                    });
                                    return (
                                        <tr key={req._id || idx} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-8 py-5 text-[13px] text-gray-700">{req.requestId}</td>
                                            <td className="px-8 py-5 text-[13px] text-gray-700">{req.name}</td>
                                            <td className="px-8 py-5 text-[13px] text-gray-700">{req.documentType}</td>
                                            <td className="px-8 py-5 text-[13px] text-gray-700">{formattedDate}</td>
                                            <td className="px-8 py-5">
                                                <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${getStatusStyle(req.status)}`}>
                                                    {req.status}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <button
                                                    onClick={() => navigate(`/requests/${req.requestId}`)}
                                                    className="bg-[#2f3947] text-white px-5 py-2 rounded text-[12px] font-bold hover:bg-black transition-all"
                                                >
                                                    View Request
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr><td colSpan="6" className="py-20 text-center text-gray-400 italic">No requests found matching your filters.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* --- PAGINATION --- */}
                <div className="bg-white p-6 border-x border-b border-gray-200 rounded-b-lg flex justify-center gap-2">
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
                                    className={`w-8 h-8 rounded text-xs transition-colors ${
                                        currentPage === pageNumber 
                                            ? 'bg-[#2f3947] text-white font-bold' 
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
        </Layout>
    );
};

// Reusable Filter Dropdown
function FilterDropdown({ label, value, onChange, options }) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-[#1D2D44]">{label}</label>
            <select 
                value={value} 
                onChange={(e) => onChange(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm text-[#1D2D44] font-medium bg-white cursor-pointer outline-none focus:border-[#1D2D44] focus:ring-1 focus:ring-[#1D2D44] transition-all shadow-sm"
            >
                {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
        </div>
    );
}

export default Requests;
