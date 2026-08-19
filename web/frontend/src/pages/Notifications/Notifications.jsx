import { useState, useEffect, useMemo } from 'react';
import Layout from '../../components/Layout';
import api from '../../api';
import { AlertCircle, Info, X, Search, SlidersHorizontal, ArrowDownAZ, ArrowUpZA } from 'lucide-react';
import FilterDrawer from '../../components/FilterDrawer';
import ActiveFilterChips from '../../components/ActiveFilterChips';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' });

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All Status');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data || []);
    } catch (error) {
      triggerToast("Failed to load notifications from server.", "error");
    } finally {
      setLoading(false);
    }
  };

  const triggerToast = (message, type = 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'error' }), 4000);
  };

  const handleMarkAllRead = async () => {
    try {
      await api.put('/notifications/mark-all-read'); 
      setNotifications(notifications.map(n => ({ ...n, isRead: true })));
      triggerToast("All notifications caught up!", "info");
    } catch (error) {
      triggerToast("Could not update notifications on server.", "error");
    }
  };

  const filteredNotifications = useMemo(() => {
    const sanitizedSearch = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return notifications.filter((n) => {
      const matchesSearch = n.message?.toLowerCase().includes(sanitizedSearch.toLowerCase());
      const matchesStatus = filterStatus === 'All Status' ? true : (filterStatus === 'Unread' ? !n.isRead : n.isRead);
      
      const notifDate = new Date(n.date);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      const matchesDate = (!start || notifDate >= start) && (!end || notifDate <= end);

      return matchesSearch && matchesStatus && matchesDate;
    }).sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];
        
        if (sortConfig.key === 'date') {
            valA = new Date(valA).getTime();
            valB = new Date(valB).getTime();
        } else if (sortConfig.key === 'status') {
            valA = a.isRead ? 1 : 0;
            valB = b.isRead ? 1 : 0;
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });
  }, [notifications, searchTerm, filterStatus, startDate, endDate, sortConfig]);

  const totalPages = Math.ceil(filteredNotifications.length / entriesPerPage);
  const paginatedNotifications = filteredNotifications.slice(
    (currentPage - 1) * entriesPerPage,
    currentPage * entriesPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, startDate, endDate, entriesPerPage]);

  return (
    <Layout>
      <div className="p-8 bg-[#F8FAFC] min-h-screen font-sans">
        
        {/* Toast Notification */}
        {toast.show && (
            <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-6 py-3 rounded-lg shadow-2xl transition-all ${
                toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-[#1D2D44] text-white'
            }`}>
                {toast.type === 'error' ? <AlertCircle size={18} /> : <Info size={18} />}
                <p className="font-bold text-sm">{toast.message}</p>
                <button onClick={() => setToast({ ...toast, show: false })} className="ml-4 hover:bg-white/20 rounded-full p-0.5">
                    <X size={14} />
                </button>
            </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          
          {/* Unified Filter Row */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
              
              {/* Show Entries & Search & Filters */}
              <div className="flex items-center gap-4 flex-1 w-full md:w-auto">
                <div className="flex items-center gap-2 text-[14px] text-[#7E84A3] whitespace-nowrap">
                  <span>Show</span>
                  <select 
                    className="appearance-none bg-white border border-[#DDE2EF] rounded-[6px] px-3 py-2 pr-8 outline-none text-[#4D5E80] cursor-pointer bg-no-repeat bg-[right_10px_center] hover:border-gray-300"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%237E84A3'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundSize: '12px' }}
                    value={entriesPerPage}
                    onChange={(e) => setEntriesPerPage(Number(e.target.value))}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                  </select>
                  <span>entries</span>
                </div>

                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input 
                        type="text" 
                        placeholder="Search notifications..." 
                        className="w-full border border-gray-300 rounded-md px-3 py-2 pl-9 text-xs outline-none focus:border-[#1D2D44]"
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

              {/* Actions */}
              <div className="flex gap-2 w-full md:w-auto justify-end">
                  <button onClick={fetchNotifications} className="bg-[#E5E7EB] text-gray-700 px-5 py-2 rounded-md font-bold text-[12px] hover:bg-gray-200 transition-colors">
                      Retry
                  </button>
                  <button onClick={handleMarkAllRead} className="bg-[#1D2D44] text-white px-5 py-2 rounded-md font-bold text-[12px] hover:bg-[#152030] transition-all whitespace-nowrap">
                      Mark all read
                  </button>
              </div>
            </div>

            <ActiveFilterChips 
                filters={[
                    { label: 'Status', value: filterStatus, key: 'filterStatus' },
                    { label: 'From', value: startDate, key: 'startDate' },
                    { label: 'To', value: endDate, key: 'endDate' },
                ]}
                onRemove={(key) => {
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
                  setFilterStatus('All Status');
                  setStartDate('');
                  setEndDate('');
                  setSortConfig({ key: 'date', direction: 'desc' });
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
                              <option value="date">Date</option>
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
                  
                  <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-bold text-[#1D2D44]">Status:</label>
                      <select 
                          value={filterStatus} 
                          onChange={(e) => setFilterStatus(e.target.value)} 
                          className="border border-gray-300 rounded-md px-3 py-2 text-sm outline-none bg-white"
                      >
                        <option>All Status</option><option>Unread</option><option>Read</option>
                      </select>
                  </div>

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

          {/* Table */}
          <div className="overflow-x-auto min-h-[450px]">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200 text-gray-800 font-bold text-[13px]">
                  <th className="py-5 px-8">Status</th>
                  <th className="py-5 px-2 text-center">Notification</th>
                  <th className="py-5 px-8 text-right">Date & Time</th>
                </tr>
              </thead>
              <tbody className="text-[13px]">
                {loading ? (
                  <tr><td colSpan="3" className="py-24 text-center text-gray-400 italic">Connecting to server...</td></tr>
                ) : paginatedNotifications.length > 0 ? (
                    paginatedNotifications.map((n, idx) => (
                        <tr key={n._id || idx} className={`transition-colors ${idx % 2 !== 0 ? 'bg-[#F9FAFF]' : 'bg-white hover:bg-gray-50'}`}>
                            <td className="py-5 px-8">
                                <div className="flex items-center gap-3">
                                    <span className={`w-2 h-2 rounded-full ${n.isRead ? 'bg-gray-300' : 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]'}`}></span>
                                    <span className={`font-bold ${n.isRead ? 'text-gray-400 font-normal' : 'text-[#1D2D44]'}`}>{n.isRead ? 'Read' : 'Unread'}</span>
                                </div>
                            </td>
                            <td className={`py-5 px-2 text-center ${n.isRead ? 'text-gray-400' : 'text-gray-800 font-medium'}`}>{n.message}</td>
                            <td className="py-5 px-8 text-right text-gray-400 font-mono text-xs">{n.date}</td>
                        </tr>
                    ))
                ) : (
                  <tr><td colSpan="3" className="py-24 text-center text-gray-400 italic">No notifications found.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex justify-center items-center py-6 border-t border-gray-100 gap-2">
            <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={`text-xs px-2 ${currentPage === 1 ? 'text-gray-300' : 'text-gray-400 hover:text-black cursor-pointer'}`}
            >
                Previous
            </button>
            <button className="w-8 h-8 bg-[#1D2D44] text-white rounded font-bold text-xs">{currentPage}</button>
            <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className={`text-xs px-2 ${currentPage === totalPages || totalPages === 0 ? 'text-gray-300' : 'text-gray-400 hover:text-black cursor-pointer'}`}
            >
                Next
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Notifications;
