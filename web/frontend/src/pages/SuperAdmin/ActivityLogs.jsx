import { useState, useMemo, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../api';

export default function ActivityLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUser, setFilterUser] = useState('All Users');
  const [filterAction, setFilterAction] = useState('All Actions');
  const [filterType, setFilterType] = useState('All Document');
  const [filterStatus, setFilterStatus] = useState('All Status');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch activity logs from API
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await api.get('/activity-logs');
        setLogs(res.data || []);
      } catch (error) {
        console.error('Error fetching activity logs:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const getStatusStyle = (status) => {
    switch (status) {
      case 'Successful': return 'bg-[#C6E7FF] text-[#2D6A8E]';
      case 'Process': return 'bg-[#FCF7B0] text-[#857A00]';
      case 'Failed': return 'bg-[#FFC1C1] text-[#A32A2A]';
      case 'Canceled': return 'bg-[#E5E7EB] text-gray-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesSearch = log.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            log.action?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesUser = filterUser === 'All Users' || log.userName === filterUser;
      const matchesAction = filterAction === 'All Actions' || log.action === filterAction;
      const matchesType = filterType === 'All Document' || log.type === filterType;
      const matchesStatus = filterStatus === 'All Status' || log.status === filterStatus;

      const logDate = new Date(log.timestamp);
      
      let matchesDate = true;
      if (startDate) {
        const [year, month, day] = startDate.split('-');
        const start = new Date(year, month - 1, day, 0, 0, 0, 0);
        matchesDate = matchesDate && (logDate >= start);
      }
      if (endDate) {
        const [year, month, day] = endDate.split('-');
        const end = new Date(year, month - 1, day, 23, 59, 59, 999);
        matchesDate = matchesDate && (logDate <= end);
      }

      return matchesSearch && matchesUser && matchesAction && matchesType && matchesStatus && matchesDate;
    });
  }, [logs, searchTerm, filterUser, filterAction, filterType, filterStatus, startDate, endDate]);

  const totalPages = Math.ceil(filteredLogs.length / entriesPerPage);
  const paginatedLogs = filteredLogs.slice(
      (currentPage - 1) * entriesPerPage,
      currentPage * entriesPerPage
  );

  useEffect(() => {
      setCurrentPage(1);
  }, [searchTerm, filterUser, filterAction, filterType, filterStatus, startDate, endDate, entriesPerPage]);

  const users = ['All Users', ...new Set(logs.map(l => l.userName))];
  const actions = ['All Actions', ...new Set(logs.map(l => l.action))];
  const types = ['All Document', ...new Set(logs.map(l => l.type))];
  const statuses = ['All Status', 'Successful', 'Process', 'Failed', 'Canceled'];

  return (
    <Layout>
      <div className="p-8 bg-[#f8fafc] min-h-screen">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">System Logs</h1>
          <p className="text-sm text-gray-500">Audit trail and record of all system activities.</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          
          {/* Top Header Filter */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-6">
                {/* Updated Show Entries to match image style */}
                <div className="flex items-center gap-2 text-[14px] text-[#7E84A3]">
                  <span>Show</span>
                  <select 
                    className="appearance-none bg-white border border-[#DDE2EF] rounded-[6px] px-3 py-1 pr-8 outline-none text-[#4D5E80] cursor-pointer bg-no-repeat bg-[right_10px_center] transition-all hover:border-gray-400"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%237E84A3'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                      backgroundSize: '12px'
                    }}
                    value={entriesPerPage}
                    onChange={(e) => setEntriesPerPage(Number(e.target.value))}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                  <span>entries</span>
                </div>

                <div className="relative">
                   <input 
                    type="text" 
                    placeholder="Search logs..." 
                    className="border border-gray-300 rounded-md px-3 py-2 text-xs w-64 outline-none focus:border-[#1D2D44]"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Filter Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <FilterSelect label="User:" value={filterUser} onChange={setFilterUser} options={users} />
              <FilterSelect label="Action:" value={filterAction} onChange={setFilterAction} options={actions} />
              <FilterSelect label="Document Type:" value={filterType} onChange={setFilterType} options={types} />
              <FilterSelect label="Status:" value={filterStatus} onChange={setFilterStatus} options={statuses} />
              
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-gray-600 uppercase tracking-tight">Start Date:</label>
                <input 
                  type="date" 
                  className="border border-gray-300 rounded px-2 py-1.5 text-[12px] text-gray-500 bg-white outline-none focus:border-[#1D2D44]" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-gray-600 uppercase tracking-tight">End Date:</label>
                <input 
                  type="date" 
                  className="border border-gray-300 rounded px-2 py-1.5 text-[12px] text-gray-500 bg-white outline-none focus:border-[#1D2D44]" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto min-h-[450px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-gray-800 font-bold text-[13px]">
                  <th className="py-5 px-6">Timestamp</th>
                  <th className="py-5 px-2">Date</th>
                  <th className="py-5 px-2">User Name</th>
                  <th className="py-5 px-2">Action</th>
                  <th className="py-5 px-2">Document Type</th>
                  <th className="py-5 px-6 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="text-[13px]">
                {loading ? (
                  <tr><td colSpan="6" className="py-20 text-center text-gray-400">Loading activity logs...</td></tr>
                ) : paginatedLogs.length > 0 ? (
                  paginatedLogs.map((log, index) => {
                    const logDate = new Date(log.timestamp);
                    const timeStr = logDate.toLocaleTimeString('en-US', { hour12: false });
                    const day = String(logDate.getDate()).padStart(2, '0');
                    const month = String(logDate.getMonth() + 1).padStart(2, '0');
                    const year = logDate.getFullYear();
                    const dateStr = `${day}/${month}/${year}`;
                    return (
                      <tr key={log._id || index} className={`transition-colors ${index % 2 !== 0 ? 'bg-[#F9FAFF]' : 'bg-white hover:bg-gray-50'}`}>
                        <td className="py-4 px-6 font-mono text-gray-500">{timeStr}</td>
                        <td className="py-4 px-2 text-gray-600">{dateStr}</td>
                        <td className="py-4 px-2 font-semibold text-gray-800">{log.userName}</td>
                        <td className="py-4 px-2 font-medium text-gray-600">{log.action}</td>
                        <td className="py-4 px-2 text-gray-500">{log.type}</td>
                        <td className="py-4 px-6">
                          <div className="flex justify-center">
                            <span className={`min-w-[100px] text-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusStyle(log.status)}`}>
                              {log.status}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr><td colSpan="6" className="py-20 text-center text-gray-400 italic">No activity logs found.</td></tr>
                )}
              </tbody>
            </table>
            {paginatedLogs.length === 0 && (
                <div className="text-center py-24 text-gray-400 italic text-sm">No activity logs match your current filters.</div>
            )}
          </div>

          {/* Pagination */}
          <div className="flex justify-center items-center py-6 border-t border-gray-100 gap-2">
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
    </Layout>
  );
}


function FilterSelect({ label, value, onChange, options }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-bold text-gray-600 uppercase tracking-tight">{label}</label>
      <select 
        className="border border-gray-300 rounded px-2 py-1.5 text-[12px] text-gray-500 bg-white outline-none cursor-pointer hover:border-gray-400 focus:border-[#1D2D44]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  );
}