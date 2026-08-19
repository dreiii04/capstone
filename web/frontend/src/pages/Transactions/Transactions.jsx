import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import ConfirmModal from '../../components/ConfirmModal';
import FilterDrawer from '../../components/FilterDrawer';
import ActiveFilterChips from '../../components/ActiveFilterChips';
import api from '../../api';
import { X, ZoomIn, CheckCircle, Image as ImageIcon, Send, AlertCircle, RefreshCw, Receipt, Eye, XCircle, Undo2, SlidersHorizontal, ArrowDownAZ, ArrowUpZA } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : '') || 'http://127.0.0.1:5000';

const Transactions = () => {
  const [searchParams] = useSearchParams();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'payments'); // 'payments' | 'refunds'

  // Refund states
  const [refunds, setRefunds] = useState([]);
  const [refundsLoading, setRefundsLoading] = useState(false);
  const [selectedRefund, setSelectedRefund] = useState(null);
  const [refundRemarks, setRefundRemarks] = useState('');
  const [refundActionLoading, setRefundActionLoading] = useState(false);
  const [refundConfirmModal, setRefundConfirmModal] = useState({ isOpen: false, refundId: null, status: null });

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPaymentMode, setFilterPaymentMode] = useState('All Modes');
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || 'All Status');
  const [filterUserRole, setFilterUserRole] = useState('All');
  const [filterProgram, setFilterProgram] = useState('All');
  const [filterUserStatus, setFilterUserStatus] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

  // Modal & Toast States
  const [selectedTx, setSelectedTx] = useState(null);
  const [adminNote, setAdminNote] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const [zoomedImage, setZoomedImage] = useState(false);

  const navigate = useNavigate();

  const fetchTransactions = async () => {
    try {
      const res = await api.get('/transactions');
      setTransactions(res.data || []);
      if (res.data && res.data.length > 0) {
        setStartDate(prev => {
          if (!prev) {
            const oldest = new Date(Math.min(...res.data.map(t => new Date(t.date))));
            return oldest.toLocaleDateString('en-CA');
          }
          return prev;
        });
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRefunds = async () => {
    setRefundsLoading(true);
    try {
      const res = await api.get('/transactions/refunds');
      setRefunds(res.data || []);
    } catch (error) {
      console.error("Error fetching refunds:", error);
    } finally {
      setRefundsLoading(false);
    }
  };

  const [userMap, setUserMap] = useState({});

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const [stuRes, alumRes] = await Promise.all([
          api.get('/v1/students').catch(() => ({ data: { data: [] } })),
          api.get('/v1/alumni').catch(() => ({ data: { data: [] } }))
        ]);
        const users = [...(stuRes.data?.data || []), ...(alumRes.data?.data || [])];
        const map = {};
        users.forEach(u => { if (u.email) map[u.email] = u; });
        setUserMap(map);
      } catch (err) { console.error('Error fetching users:', err); }
    };
    fetchUsers();
    fetchTransactions();
    fetchRefunds();
  }, []);

  // Update active tab and filter status if URL changes
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
    
    const status = searchParams.get('status');
    if (status) setFilterStatus(status);
  }, [searchParams]);

  const triggerToast = (message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 4000);
  };

  const handleVerifyAction = async (type) => {
    if (!adminNote.trim() && type === 'Needs Update') {
      setError('Please enter remarks to send to the student/alumni.');
      return;
    }

    try {
      const statusMap = {
        'Approve': 'Completed',
        'Needs Update': 'Needs Update',
        'Reject': 'Rejected'
      };

      await api.put(`/transactions/${selectedTx.transactionId}/verify`, {
        status: statusMap[type],
        adminRemarks: adminNote
      });

      const messages = {
        'Approve': `Payment approved for ${selectedTx.name}.`,
        'Needs Update': `Update requested for ${selectedTx.name}.`,
        'Reject': `Payment rejected for ${selectedTx.name}.`
      };

      triggerToast(messages[type], 'success');
      setSelectedTx(null);
      setAdminNote('');
      setError('');
      fetchTransactions();
    } catch (err) {
      console.error('Verification error:', err);
      triggerToast('Failed to update payment. Please try again.', 'error');
    }
  };

  // Refund processing
  const handleProcessRefund = (refundId, status) => {
    setRefundConfirmModal({ isOpen: true, refundId, status });
  };

  const executeProcessRefund = async () => {
    const { refundId, status } = refundConfirmModal;
    if (!refundId || refundActionLoading) return;
    setRefundActionLoading(true);
    try {
      await api.put(`/transactions/refunds/${refundId}/process`, {
        status,
        adminRemarks: refundRemarks
      });
      triggerToast(`Refund ${status.toLowerCase()} successfully.`, 'success');
      setSelectedRefund(null);
      setRefundRemarks('');
      fetchRefunds();
      fetchTransactions(); // Refresh in case transaction status changed
    } catch (err) {
      console.error('Refund processing error:', err);
      triggerToast('Failed to process refund. Please try again.', 'error');
    } finally {
      setRefundActionLoading(false);
      setRefundConfirmModal({ isOpen: false, refundId: null, status: null });
    }
  };

  // Filter Logic — Bug 8 fix: end date set to end-of-day
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const matchesSearch =
        tx.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.transactionId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.requestId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.payerName?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = filterStatus === 'All Status' || tx.status === filterStatus;
      const matchesMode = filterPaymentMode === 'All Modes' || tx.paymentMode === filterPaymentMode;

      const user = userMap[tx.payerEmail] || {};
      const userRole = user.role || 'student';
      const programLevel = user.programLevel || 'Bachelors';
      const userStatus = user.status || 'Active';

      const matchesRole = filterUserRole === 'All' || userRole.toLowerCase() === filterUserRole.toLowerCase();
      const matchesProgram = filterProgram === 'All' || programLevel === filterProgram;
      const matchesUserStatus = filterUserStatus === 'All' || userStatus === filterUserStatus;

      const txDate = new Date(tx.date);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      if (end) end.setHours(23, 59, 59, 999); // Bug 8: include entire end day
      const matchesDate = (!start || txDate >= start) && (!end || txDate <= end);

      return matchesSearch && matchesStatus && matchesMode && matchesDate && matchesRole && matchesProgram && matchesUserStatus;
    }).sort((a, b) => {
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];
      
      // Special handling for nested or specific types
      if (sortConfig.key === 'date') {
          valA = new Date(valA).getTime();
          valB = new Date(valB).getTime();
      } else if (sortConfig.key === 'name' || sortConfig.key === 'payerName') {
          valA = valA ? valA.toLowerCase() : '';
          valB = valB ? valB.toLowerCase() : '';
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [transactions, searchTerm, filterStatus, filterPaymentMode, filterUserRole, filterProgram, filterUserStatus, startDate, endDate, userMap, sortConfig]);

  const totalPages = Math.ceil(filteredTransactions.length / entriesPerPage);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * entriesPerPage,
    currentPage * entriesPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterPaymentMode, filterUserRole, filterProgram, filterUserStatus, startDate, endDate, entriesPerPage]);

  const paymentModes = ['All Modes', 'GCash', 'Maya', 'GoThyme', 'Other Online Payment'];
  const statuses = ['All Status', 'Pending Verification', 'Completed', 'Needs Update', 'Rejected', 'Refunded'];

  const pendingRefundCount = refunds.filter(r => r.status?.toLowerCase() === 'pending').length;

  return (
    <Layout>
      <div className="p-6 bg-[#F8F9FA] min-h-screen font-sans relative">

        {/* Toast Notification */}
        {toast.show && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[10001] flex items-center gap-3 px-6 py-3 rounded-lg shadow-2xl bg-[#1D2D44] text-white animate-fade-in">
            <CheckCircle size={18} />
            <p className="font-bold text-sm">{toast.message}</p>
          </div>
        )}

        {/* Tab Bar */}
        <div className="flex items-center gap-1 mb-6">
          <button
            onClick={() => setActiveTab('payments')}
            className={`px-6 py-3 rounded-t-lg text-sm font-bold transition-all ${
              activeTab === 'payments'
                ? 'bg-white text-[#1D2D44] border border-b-0 border-gray-200 shadow-sm'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            All Payments
          </button>
          <button
            onClick={() => setActiveTab('refunds')}
            className={`px-6 py-3 rounded-t-lg text-sm font-bold transition-all relative ${
              activeTab === 'refunds'
                ? 'bg-white text-[#1D2D44] border border-b-0 border-gray-200 shadow-sm'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            Refund Requests
          </button>
        </div>
        {/* ====== PAYMENTS TAB ====== */}
        {activeTab === 'payments' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
            {/* Top Controls Section */}
            <div className="p-6 border-b border-gray-100">
              <div className="flex flex-wrap items-center justify-between gap-6 pb-4 mb-4">
                <div className="flex items-center gap-3 flex-1 max-md">
                  <div className="flex items-center gap-2 text-[14px] text-[#7E84A3]">
                    <span>Show</span>
                    <select
                      className="appearance-none bg-white border border-[#DDE2EF] rounded-[6px] px-3 py-1 pr-8 outline-none text-[#4D5E80] cursor-pointer transition-all hover:border-gray-400"
                      value={entriesPerPage}
                      onChange={(e) => setEntriesPerPage(Number(e.target.value))}
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                    <span>entries</span>
                  </div>
                  <input
                    type="text"
                    className="w-full max-w-md border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:border-[#1D2D44]"
                    placeholder="Search by ID, Name, or Payer..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <button 
                    type="button"
                    onClick={() => setIsFilterDrawerOpen(true)}
                    className="bg-gray-100 text-gray-700 px-4 py-2 rounded font-bold text-sm hover:bg-gray-200 transition-colors flex items-center gap-2 border border-gray-200"
                  >
                    <SlidersHorizontal size={16} /> Filters & Sort
                  </button>
                </div>
              </div>

              <ActiveFilterChips 
                  filters={[
                      { label: 'Role', value: filterUserRole, key: 'filterUserRole' },
                      { label: 'Program', value: filterProgram, key: 'filterProgram' },
                      { label: 'User Status', value: filterUserStatus, key: 'filterUserStatus' },
                      { label: 'Payment Mode', value: filterPaymentMode, key: 'filterPaymentMode' },
                      { label: 'Status', value: filterStatus, key: 'filterStatus' },
                      { label: 'From', value: startDate, key: 'startDate' },
                      { label: 'To', value: endDate, key: 'endDate' },
                  ]}
                  onRemove={(key) => {
                      if (key === 'filterUserRole') setFilterUserRole('All');
                      if (key === 'filterProgram') setFilterProgram('All');
                      if (key === 'filterUserStatus') setFilterUserStatus('All');
                      if (key === 'filterPaymentMode') setFilterPaymentMode('All Modes');
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
                    setFilterPaymentMode('All Modes');
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
                                <option value="name">Requestor Name</option>
                                <option value="payerName">Payer Name</option>
                                <option value="status">Status</option>
                                <option value="paymentMode">Payment Mode</option>
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
                      <label className="text-sm font-bold text-[#1D2D44]">Payment Mode:</label>
                      <select
                        value={filterPaymentMode}
                        onChange={(e) => setFilterPaymentMode(e.target.value)}
                        className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white outline-none focus:border-[#1D2D44]"
                      >
                        {paymentModes.map(mode => <option key={mode} value={mode}>{mode}</option>)}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-bold text-[#1D2D44]">Status:</label>
                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white outline-none focus:border-[#1D2D44]"
                      >
                        {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-bold text-[#1D2D44]">User Role:</label>
                      <select
                        value={filterUserRole}
                        onChange={(e) => setFilterUserRole(e.target.value)}
                        className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white outline-none focus:border-[#1D2D44]"
                      >
                        <option value="All">All Users</option>
                        <option value="Student">Student</option>
                        <option value="Alumni">Alumni</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-bold text-[#1D2D44]">Program Level:</label>
                      <select
                        value={filterProgram}
                        onChange={(e) => setFilterProgram(e.target.value)}
                        className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white outline-none focus:border-[#1D2D44]"
                      >
                        <option value="All">All Programs</option>
                        <option value="Bachelors">Bachelors</option>
                        <option value="Masters">Masters</option>
                        <option value="Doctorate">Doctorate</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-bold text-[#1D2D44]">User Status:</label>
                      <select
                        value={filterUserStatus}
                        onChange={(e) => setFilterUserStatus(e.target.value)}
                        className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white outline-none focus:border-[#1D2D44]"
                      >
                        <option value="All">All Statuses</option>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
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
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[13px] text-gray-800 border-b border-gray-200 uppercase font-bold">
                    <th className="px-6 py-4">Payment ID</th>
                    <th className="px-6 py-4">Request ID</th>
                    <th className="px-6 py-4">Payer Name</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Amount</th>
                    <th className="px-6 py-4">Mode</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="text-[13px]">
                  {loading ? (
                    <tr><td colSpan="9" className="px-6 py-20 text-center text-gray-400 italic">Loading payments...</td></tr>
                  ) : paginatedTransactions.length > 0 ? (
                    paginatedTransactions.map((tx, idx) => {
                      const txDate = new Date(tx.date);
                      const formattedDate = txDate.toLocaleDateString('en-US', {
                        year: 'numeric', month: '2-digit', day: '2-digit'
                      });
                      return (
                        <tr key={tx._id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#F9FAFF]'}>
                          <td className="px-6 py-4 text-gray-600 font-mono">{tx.transactionId}</td>
                          <td className="px-6 py-4 text-gray-600">{tx.requestId}</td>
                          <td className="px-6 py-4 font-bold text-gray-800">{tx.payerName || tx.name}</td>
                          <td className="px-6 py-4 text-gray-600">{tx.documentType}</td>
                          <td className="px-6 py-4 text-gray-700 font-semibold">₱{tx.amount || '0.00'}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${getPaymentModeStyle(tx.paymentMode)}`}>
                              {tx.paymentMode}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-600">{formattedDate}</td>
                          <td className="px-6 py-4">
                            <div className="flex justify-center">
                              <span className={`min-w-[120px] text-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusStyle(tx.status)}`}>
                                {tx.status}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex justify-center gap-2">
                              {tx.status === 'Pending Verification' ? (
                                <button
                                  onClick={() => { setSelectedTx(tx); setAdminNote(''); setError(''); }}
                                  className="min-w-[120px] py-2 rounded-full text-[11px] font-bold bg-[#1D2D44] text-white shadow-md hover:bg-[#152030] transition-all flex items-center justify-center gap-1.5"
                                >
                                  <Receipt size={13} /> Verify Receipt
                                </button>
                              ) : (
                                <button
                                  onClick={() => navigate(`/transactions/${tx.transactionId}`)}
                                  className="min-w-[120px] py-2 rounded-full text-[11px] font-bold bg-[#E5E7EB] text-gray-700 hover:bg-gray-300 transition-all flex items-center justify-center gap-1.5"
                                >
                                  <Eye size={13} /> View Details
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="9" className="px-6 py-20 text-center text-[#99AAB5] italic text-[16px]">
                        No payments found matching your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="bg-white p-6 border-t border-gray-100 flex justify-center gap-2">
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
                      className={`w-8 h-8 rounded text-xs transition-colors ${currentPage === pageNumber
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
        )}

        {/* ====== REFUND REQUESTS TAB ====== */}
        {activeTab === 'refunds' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[13px] text-gray-800 border-b border-gray-200 uppercase font-bold">
                    <th className="px-6 py-4">Refund ID</th>
                    <th className="px-6 py-4">Transaction ID</th>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Amount</th>
                    <th className="px-6 py-4">Reason</th>
                    <th className="px-6 py-4">Date Submitted</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="text-[13px]">
                  {refundsLoading ? (
                    <tr><td colSpan="8" className="px-6 py-20 text-center text-gray-400 italic">Loading refund requests...</td></tr>
                  ) : refunds.length > 0 ? (
                    refunds.map((refund, idx) => {
                      const refundDate = new Date(refund.createdAt);
                      const formattedDate = refundDate.toLocaleDateString('en-US', {
                        year: 'numeric', month: '2-digit', day: '2-digit'
                      });
                      
                      const relatedTx = transactions.find(t => t.transactionId === refund.transactionId || t._id === refund.transactionId);
                      const displayName = refund.accountName || refund.studentName || relatedTx?.payerName || relatedTx?.name || 'Unknown';

                      return (
                        <tr key={refund._id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#F9FAFF]'}>
                          <td className="px-6 py-4 text-gray-600 font-mono">{refund.refundId || refund._id}</td>
                          <td className="px-6 py-4 text-gray-600 font-mono">{refund.transactionId}</td>
                          <td className="px-6 py-4 font-bold text-gray-800">{displayName}</td>
                          <td className="px-6 py-4 text-gray-700 font-semibold">₱{refund.amount || '0.00'}</td>
                          <td className="px-6 py-4 text-gray-600">{refund.reason === 'Other' ? refund.otherReason : refund.reason}</td>
                          <td className="px-6 py-4 text-gray-600">{formattedDate}</td>
                          <td className="px-6 py-4">
                            <div className="flex justify-center">
                              <span className={`min-w-[100px] text-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getRefundStatusStyle(refund.status)}`}>
                                {refund.status}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {refund.status?.toLowerCase() === 'pending' ? (
                              <button
                                onClick={() => { setSelectedRefund(refund); setRefundRemarks(''); }}
                                className="min-w-[100px] py-2 rounded-full text-[11px] font-bold bg-[#1D2D44] text-white shadow-md hover:bg-[#152030] transition-all flex items-center justify-center gap-1.5 mx-auto"
                              >
                                <Eye size={13} /> Review
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400 italic">
                                {refund.status === 'Approved' ? 'Approved' : 'Rejected'}
                                {refund.processedBy && ` by ${refund.processedBy.split('@')[0]}`}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="8" className="px-6 py-20 text-center text-[#99AAB5] italic text-[16px]">
                        No refund requests found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ====== RECEIPT VERIFICATION MODAL ====== */}
        {selectedTx && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden">

              {/* Modal Header */}
              <div className="bg-[#1D2D44] p-6 text-white flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">Verify Payment Receipt</h3>
                  <p className="text-xs opacity-70 mt-1 uppercase tracking-widest font-semibold">
                    {selectedTx.transactionId} • {selectedTx.payerName || selectedTx.name} • via {selectedTx.paymentMode}
                  </p>
                </div>
                <button onClick={() => setSelectedTx(null)} className="hover:bg-white/10 p-2 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* Left: Receipt Image */}
                <div className="lg:col-span-7">
                  <h4 className="text-[12px] font-bold text-gray-500 uppercase mb-3 flex justify-between">
                    Uploaded Receipt
                    {selectedTx.receiptImage && (
                      <span
                        className="text-[#1D2D44] cursor-pointer flex items-center gap-1 hover:underline"
                        onClick={() => setZoomedImage(!zoomedImage)}
                      >
                        <ZoomIn size={14} /> {zoomedImage ? 'Fit' : 'Zoom'}
                      </span>
                    )}
                  </h4>
                  <div className="relative group overflow-hidden rounded-lg bg-gray-50 flex items-center justify-center border border-gray-100 min-h-[320px]">
                    {(selectedTx.imageUrl || selectedTx.receiptImage) ? (
                      <img
                        src={(selectedTx.imageUrl || selectedTx.receiptImage).startsWith('http') ? (selectedTx.imageUrl || selectedTx.receiptImage) : `${API_BASE}${selectedTx.receiptImage}`}
                        alt="Receipt"
                        className={`rounded-lg shadow-sm transition-all duration-300 ${zoomedImage ? 'max-w-none w-auto' : 'max-h-[300px] object-contain'}`}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div className={`flex-col items-center text-gray-400 ${(selectedTx.imageUrl || selectedTx.receiptImage) ? 'hidden' : 'flex'}`}>
                      <ImageIcon size={48} className="mb-2 opacity-50" />
                      <span className="text-xs font-bold text-center">No receipt image uploaded</span>
                    </div>
                  </div>
                </div>

                {/* Right: Details & Actions */}
                <div className="lg:col-span-5 flex flex-col gap-6">

                  {/* Payment Info */}
                  <div className="bg-[#F9FAFF] p-5 rounded-xl border border-[#DDE2EF]">
                    <h4 className="text-[11px] font-bold text-[#1D2D44] uppercase mb-4 tracking-wider">Payment Details</h4>
                    <div className="space-y-3 text-sm text-gray-600 font-medium">
                      <div className="flex justify-between">
                        <span>Payer</span>
                        <span className="font-bold text-gray-800">{selectedTx.payerName || selectedTx.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Type</span>
                        <span className="font-semibold text-gray-700">{selectedTx.payerType || 'Student'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Amount</span>
                        <span className="font-bold text-[#1D2D44]">₱{selectedTx.amount || '0.00'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Payment Mode</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getPaymentModeStyle(selectedTx.paymentMode)}`}>
                          {selectedTx.paymentMode}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Document</span>
                        <span className="text-gray-700">{selectedTx.documentType}</span>
                      </div>
                    </div>
                  </div>

                  {/* Admin Remarks */}
                  <div className="flex-1">
                    <label className="block text-[11px] font-bold text-gray-500 uppercase mb-2 tracking-wider">
                      Admin Remarks
                    </label>
                    <textarea
                      className={`w-full h-32 p-4 border rounded-xl text-sm outline-none transition-all resize-none ${error ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-[#1D2D44]'
                        }`}
                      placeholder="Enter remarks (required for requesting updates or rejections)..."
                      value={adminNote}
                      onChange={(e) => { setAdminNote(e.target.value); setError(''); }}
                    />
                    {error && (
                      <p className="text-red-500 text-[10px] font-bold mt-2 flex items-center gap-1">
                        <AlertCircle size={12} /> {error}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 bg-gray-50 border-t flex justify-between items-center">
                <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
                  Pending Verification
                </span>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleVerifyAction('Reject')}
                    className="px-5 py-2.5 rounded-full border-2 border-red-500 text-red-500 font-bold text-xs uppercase hover:bg-red-50 transition-all tracking-widest flex items-center gap-2"
                  >
                    <XCircle size={14} /> Reject
                  </button>
                  <button
                    onClick={() => handleVerifyAction('Needs Update')}
                    className="px-5 py-2.5 rounded-full border-2 border-amber-500 text-amber-600 font-bold text-xs uppercase hover:bg-amber-50 transition-all tracking-widest flex items-center gap-2"
                  >
                    <RefreshCw size={14} /> Request Update
                  </button>
                  <button
                    onClick={() => handleVerifyAction('Approve')}
                    className="px-8 py-2.5 rounded-full bg-[#1D2D44] text-white font-bold text-xs uppercase hover:bg-[#152030] shadow-md flex items-center gap-2 tracking-widest"
                  >
                    <Send size={14} /> Approve
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ====== REFUND REVIEW MODAL ====== */}
        {selectedRefund && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">

              <div className="bg-[#1D2D44] p-6 text-white flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">Review Refund Request</h3>
                  <p className="text-xs opacity-70 mt-1 uppercase tracking-widest font-semibold">
                    {selectedRefund.refundId}
                  </p>
                </div>
                <button onClick={() => setSelectedRefund(null)} className="hover:bg-white/10 p-2 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="p-6">
                <div className="bg-[#F9FAFF] p-5 rounded-xl border border-[#DDE2EF] mb-6">
                  <h4 className="text-[11px] font-bold text-[#1D2D44] uppercase mb-4 tracking-wider">Refund Details</h4>
                  <div className="space-y-3 text-sm text-gray-600 font-medium">
                    <div className="flex justify-between">
                      <span>Name</span>
                      <span className="font-bold text-gray-800">
                        {selectedRefund.accountName || 
                         selectedRefund.studentName || 
                         transactions.find(t => t.transactionId === selectedRefund.transactionId || t._id === selectedRefund.transactionId)?.payerName || 
                         transactions.find(t => t.transactionId === selectedRefund.transactionId || t._id === selectedRefund.transactionId)?.name || 
                         'Unknown'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Email</span>
                      <span className="text-gray-700">{selectedRefund.email || selectedRefund.studentEmail || 'N/A'}</span>
                    </div>
                    {userMap[selectedRefund.email || selectedRefund.studentEmail] && (
                      <>
                        <div className="flex justify-between">
                          <span>User Type</span>
                          <span className="text-gray-700 capitalize">{userMap[selectedRefund.email || selectedRefund.studentEmail].role || 'Student'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Program</span>
                          <span className="text-gray-700">{userMap[selectedRefund.email || selectedRefund.studentEmail].programLevel || 'N/A'}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between border-t border-gray-100 pt-3 mt-3">
                      <span>Transaction ID</span>
                      <span className="font-mono text-gray-700">{selectedRefund.transactionId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Document Type</span>
                      <span className="font-semibold text-[#1D2D44]">
                        {selectedRefund.docName || 
                         transactions.find(t => t.transactionId === selectedRefund.transactionId || t._id === selectedRefund.transactionId)?.documentType || 
                         'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Amount</span>
                      <span className="font-bold text-[#1D2D44]">₱{selectedRefund.amount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Reason</span>
                      <span className="text-gray-700">{selectedRefund.reason === 'Other' ? selectedRefund.otherReason : selectedRefund.reason}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Submitted</span>
                      <span className="text-gray-700">{new Date(selectedRefund.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>
                  </div>
                </div>

                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-2 tracking-wider">
                  Admin Remarks
                </label>
                <textarea
                  className="w-full h-24 p-4 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#1D2D44] resize-none mb-4"
                  placeholder="Add remarks (optional for approval, recommended for rejection)..."
                  value={refundRemarks}
                  onChange={(e) => setRefundRemarks(e.target.value)}
                />

                <div className="flex gap-3">
                  {selectedRefund.status === 'Pending' ? (
                    <>
                      <button
                        onClick={() => handleProcessRefund(selectedRefund.refundId || selectedRefund._id, 'Rejected')}
                        disabled={refundActionLoading}
                        className="flex-1 py-3 rounded-xl border-2 border-red-500 text-red-500 font-bold text-sm uppercase hover:bg-red-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <XCircle size={16} /> Reject Refund
                      </button>
                      <button
                        onClick={() => handleProcessRefund(selectedRefund.refundId || selectedRefund._id, 'Approved')}
                        disabled={refundActionLoading}
                        className="flex-1 py-3 rounded-xl bg-green-600 text-white font-bold text-sm uppercase hover:bg-green-700 shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <CheckCircle size={16} /> Approve Refund
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleProcessRefund(selectedRefund.refundId || selectedRefund._id, 'Pending')}
                      disabled={refundActionLoading}
                      className="flex-1 py-3 rounded-xl border-2 border-orange-500 text-orange-600 font-bold text-sm uppercase hover:bg-orange-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Undo2 size={16} /> Revert to Pending
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ====== ZOOMED IMAGE OVERLAY ====== */}
        {zoomedImage && (selectedTx?.imageUrl || selectedTx?.receiptImage) && (
          <div className="fixed inset-0 bg-black/90 z-[10000] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in" onClick={() => setZoomedImage(false)}>
            <button className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors">
              <X size={32} />
            </button>
            <img 
              src={(selectedTx.imageUrl || selectedTx.receiptImage).startsWith('http') ? (selectedTx.imageUrl || selectedTx.receiptImage) : `${API_BASE}${selectedTx.receiptImage}`} 
              alt="Receipt Zoomed" 
              className="max-w-[90vw] max-h-[90vh] object-contain rounded animate-scale-up shadow-2xl"
            />
          </div>
        )}

        <ConfirmModal
          isOpen={refundConfirmModal.isOpen}
          onClose={() => !refundActionLoading && setRefundConfirmModal({ isOpen: false, refundId: null, status: null })}
          onConfirm={executeProcessRefund}
          title={`Confirm ${refundConfirmModal.status}`}
          message={`Are you sure you want to ${refundConfirmModal.status === 'Pending' ? 'revert this refund to pending' : refundConfirmModal.status === 'Approved' ? 'approve this refund' : 'reject this refund'}?`}
          confirmText={refundConfirmModal.status === 'Pending' ? 'Revert to Pending' : `Yes, ${refundConfirmModal.status}`}
          cancelText="Cancel"
          type={refundConfirmModal.status === 'Rejected' ? 'danger' : refundConfirmModal.status === 'Approved' ? 'success' : 'warning'}
          isLoading={refundActionLoading}
        />

      </div>
    </Layout>
  );
};

// Helper: Status Badge Styles (updated with Refunded)
function getStatusStyle(status) {
  switch (status) {
    case 'Pending Verification': return 'bg-[#FCF7B0] text-[#857A00]';
    case 'Completed': return 'bg-[#C6E7FF] text-[#2D6A8E]';
    case 'Needs Update': return 'bg-[#FFC1C1] text-[#A32A2A]';
    case 'Rejected': return 'bg-[#FFD1D1] text-[#F04438]';
    case 'Refunded': return 'bg-[#E8D5F5] text-[#7C3AED]';
    default: return 'bg-gray-100 text-gray-600';
  }
}

// Helper: Refund Status Styles
function getRefundStatusStyle(status) {
  switch (status?.toLowerCase()) {
    case 'pending': return 'bg-[#FCF7B0] text-[#857A00]';
    case 'approved': return 'bg-[#C6FFD5] text-[#1B7A2E]';
    case 'rejected': return 'bg-[#FFD1D1] text-[#F04438]';
    default: return 'bg-gray-100 text-gray-600';
  }
}

// Helper: Payment Mode Badge Styles
function getPaymentModeStyle(mode) {
  switch (mode) {
    case 'GCash': return 'bg-[#E0F0FF] text-[#0070E0]';
    case 'Maya': return 'bg-[#E8F5E8] text-[#2E7D32]';
    case 'GoThyme': return 'bg-[#FFF3E0] text-[#E65100]';
    default: return 'bg-gray-100 text-gray-600';
  }
}

export default Transactions;
