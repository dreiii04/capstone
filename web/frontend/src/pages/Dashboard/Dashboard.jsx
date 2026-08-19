import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../api';
import { AlertCircle, RefreshCw } from 'lucide-react';

const Dashboard = () => {
    const [stats, setStats] = useState({
        totalRequests: 0,
        pendingRequests: 0,
        inProcessRequests: 0,
        approvedRequests: 0,
        releasedRequests: 0,
        blockchainTransactions: 0
    });
    
    const [recentData, setRecentData] = useState({
        transactions: [],
        notifications: [],
        pendingRequests: []
    });

    // --- NEW: Status States for Validation & Error Handling ---
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const navigate = useNavigate();

    const fetchDashboardData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [statsRes, recentRes] = await Promise.all([
                api.get('/dashboard/stats'),
                api.get('/dashboard/recent')
            ]);
            
            // Validation: Ensure data integrity even if API returns null/undefined
            setStats(statsRes.data || {});
            setRecentData(recentRes.data || { transactions: [], notifications: [], pendingRequests: [] });
        } catch (err) {
            console.error("Error fetching dashboard data", err);
            // Output Error Message Requirement
            setError("Failed to sync dashboard data. Please check your connection.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    return (
        <Layout>
            <div className="p-6">
                {/* --- NEW: Error Output Message --- */}
                {error && (
                    <div className="mb-6 flex items-center justify-between bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                        <div className="flex items-center gap-2 text-sm font-medium">
                            <AlertCircle size={18} />
                            {error}
                        </div>
                        <button onClick={fetchDashboardData} className="flex items-center gap-1 text-xs font-bold uppercase hover:underline">
                            <RefreshCw size={14} /> Retry
                        </button>
                    </div>
                )}

                {/* Stats Grid */}
                <div className={`grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 transition-opacity ${loading ? 'opacity-50' : 'opacity-100'}`}>
                    
                    {/* Card 1 */}
                    <div 
                        onClick={() => navigate('/requests')}
                        className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between min-h-[110px] relative cursor-pointer hover:shadow-md transition-shadow"
                    >
                        <div className="flex justify-between items-start w-full">
                            <span className="text-[13px] font-bold text-[#1f2937]">Total Requests</span>
                            <i className="fa-solid fa-arrow-up-right-from-square text-gray-400 text-xs p-1 border border-gray-200 rounded-full"></i>
                        </div>
                        <span className="text-[32px] font-normal text-black mt-2 leading-none">{stats.totalRequests ?? 0}</span>
                    </div>

                    {/* Card 2 */}
                    <div 
                        onClick={() => navigate('/requests?status=Pending')}
                        className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between min-h-[110px] relative cursor-pointer hover:shadow-md transition-shadow"
                    >
                        {(stats.pendingRequests > 0) && (
                            <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-sm">
                                {stats.pendingRequests}
                            </span>
                        )}
                        <div className="flex justify-between items-start w-full">
                            <span className="text-[13px] font-bold text-[#1f2937]">Pending Requests</span>
                            <i className="fa-solid fa-arrow-up-right-from-square text-gray-400 text-xs p-1 border border-gray-200 rounded-full"></i>
                        </div>
                        <span className="text-[32px] font-normal text-black mt-2 leading-none">{stats.pendingRequests ?? 0}</span>
                    </div>

                    {/* Card 3 */}
                    <div 
                        onClick={() => navigate('/requests?status=In Process')}
                        className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between min-h-[110px] relative cursor-pointer hover:shadow-md transition-shadow"
                    >
                        <div className="flex justify-between items-start w-full">
                            <span className="text-[13px] font-bold text-[#1f2937]">In Process Requests</span>
                            <i className="fa-solid fa-arrow-up-right-from-square text-gray-400 text-xs p-1 border border-gray-200 rounded-full"></i>
                        </div>
                        <span className="text-[32px] font-normal text-black mt-2 leading-none">{stats.inProcessRequests ?? 0}</span>
                    </div>

                    {/* Card 4 */}
                    <div 
                        onClick={() => navigate('/transactions?tab=refunds&status=Pending')}
                        className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between min-h-[110px] relative cursor-pointer hover:shadow-md transition-shadow"
                    >
                        <div className="flex justify-between items-start w-full">
                            <span className="text-[13px] font-bold text-[#1f2937]">Pending Refund</span>
                            <i className="fa-solid fa-arrow-up-right-from-square text-gray-400 text-xs p-1 border border-gray-200 rounded-full"></i>
                        </div>
                        <span className="text-[32px] font-normal text-black mt-2 leading-none">{stats.pendingRefunds ?? 0}</span>
                    </div>

                    {/* Card 5 */}
                    <div 
                        onClick={() => navigate('/requests?status=Released')}
                        className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between min-h-[110px] relative cursor-pointer hover:shadow-md transition-shadow"
                    >
                        <div className="flex justify-between items-start w-full">
                            <span className="text-[13px] font-bold text-[#1f2937]">Released Document</span>
                            <i className="fa-solid fa-arrow-up-right-from-square text-gray-400 text-xs p-1 border border-gray-200 rounded-full"></i>
                        </div>
                        <span className="text-[32px] font-normal text-black mt-2 leading-none">{stats.releasedRequests ?? 0}</span>
                    </div>

                    {/* Card 6 */}
                    <div 
                        onClick={() => navigate('/blockchain/my-transactions')}
                        className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between min-h-[110px] relative cursor-pointer hover:shadow-md transition-shadow"
                    >
                        <div className="flex justify-between items-start w-full">
                            <span className="text-[13px] font-bold text-[#1f2937]">Blockchain Submission</span>
                            <i className="fa-solid fa-arrow-up-right-from-square text-gray-400 text-xs p-1 border border-gray-200 rounded-full"></i>
                        </div>
                        <span className="text-[32px] font-normal text-black mt-2 leading-none">{stats.blockchainTransactions ?? 0}</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-6">
                    {/* Left: Blockchain Activities */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[350px]">
                        <h3 className="text-[#1f2937] m-0 py-4 px-6 text-[18px] font-bold border-b border-gray-100">Blockchain Activities</h3>
                        <div className="flex-1 overflow-y-auto">
                            {recentData.transactions?.length > 0 ? (
                                <ul className="list-none m-0 p-0">
                                    {recentData.transactions.map((tx, idx) => (
                                        <li key={idx} className={`py-4 px-6 flex items-center justify-between text-[14px] ${idx % 2 === 0 ? 'bg-[#fcfcfc]' : 'bg-white'}`}>
                                            <span className="text-gray-600 font-medium">TXN-{tx.referenceNumber || tx.requestId || '1786296589063-932'}</span>
                                            <span className="text-gray-500 font-mono truncate w-1/2 text-right">{tx.blockchainTxHash || tx.transactionHash || '0x305babaefe2c95bae9fd86f6ba72...'}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <ul className="list-none m-0 p-0">
                                    {[1,2,3,4,5].map((item) => (
                                        <li key={item} className={`py-4 px-6 flex items-center justify-between text-[14px] ${item % 2 !== 0 ? 'bg-[#fafafa]' : 'bg-white'}`}>
                                            <span className="text-gray-600 font-medium">TXN-1786296589063-932</span>
                                            <span className="text-gray-500 font-mono text-sm truncate max-w-[200px]">0x305babaefe2c95bae9fd86f6ba72...</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    {/* Right: Notifications */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[350px]">
                        <h3 className="text-[#1f2937] m-0 py-4 px-6 text-[18px] font-bold border-b border-gray-100">Notifications</h3>
                        <div className="flex-1 overflow-y-auto">
                            {recentData.notifications?.length > 0 ? (
                                <ul className="list-none m-0 p-0">
                                    {recentData.notifications.map((notif, idx) => (
                                        <li key={idx} className={`py-4 px-6 flex items-start gap-4 text-[14px] ${idx % 2 === 0 ? 'bg-[#fcfcfc]' : 'bg-white'}`}>
                                            <span className="w-2.5 h-2.5 rounded-full bg-[#547794] mt-1.5 flex-shrink-0"></span>
                                            <span className="text-gray-700">{notif.message}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <ul className="list-none m-0 p-0">
                                    {[1,2,3,4,5].map((item) => (
                                        <li key={item} className={`py-4 px-6 flex items-start gap-4 text-[13px] ${item % 2 !== 0 ? 'bg-[#fcfcfc]' : 'bg-white'}`}>
                                            <span className="w-2 h-2 rounded-full bg-[#547794] mt-1.5 flex-shrink-0"></span>
                                            <span className="text-[#1f2937]">Your request #req_1785820622982_3fb0334d97ba for Diploma (2nd Copy) is ready for pickup!</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl overflow-hidden w-full shadow-sm border border-gray-100 mt-6">
                    <table className="w-full border-collapse table-auto">
                        <thead>
                            <tr>
                                <th className="bg-white text-black m-0 py-5 px-6 text-[15px] font-bold text-left border-b border-gray-100">Request ID</th>
                                <th className="bg-white text-black m-0 py-5 px-6 text-[15px] font-bold text-left border-b border-gray-100">Name</th>
                                <th className="bg-white text-black m-0 py-5 px-6 text-[15px] font-bold text-left border-b border-gray-100">Document Type</th>
                                <th className="bg-white text-black m-0 py-5 px-6 text-[15px] font-bold text-left border-b border-gray-100">Date</th>
                                <th className="bg-white text-black m-0 py-5 px-6 text-[15px] font-bold text-left border-b border-gray-100">Status</th>
                                <th className="bg-white border-b border-gray-100"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentData.pendingRequests?.length > 0 ? (
                                recentData.pendingRequests.map((req, idx) => (
                                    <tr key={idx} className={`last:border-none ${idx % 2 !== 0 ? 'bg-[#fafafa]' : 'bg-white'}`}>
                                        <td className="py-4 px-6 text-[14px] text-[#1f2937] font-medium align-middle">{req.requestId}</td>
                                        <td className="py-4 px-6 text-[14px] text-[#1f2937] align-middle">{req.name}</td>
                                        <td className="py-4 px-6 text-[14px] text-[#1f2937] align-middle">{req.documentType || 'Certificate of Enrollment'}</td>
                                        <td className="py-4 px-6 text-[14px] text-[#1f2937] align-middle">{req.dateRequested || '26/03/27'}</td>
                                        <td className="py-4 px-6 text-[14px] text-black align-middle">
                                            <span className="bg-[#e9f0ad] text-[#86a623] py-1 px-4 rounded-full font-bold text-[10px] inline-block text-center uppercase tracking-wider">{req.status}</span>
                                        </td>
                                        <td className="py-4 px-6 text-[14px] text-black align-middle text-right">
                                            <button onClick={() => navigate(`/requests/${req.requestId}`)} className="bg-[#2c3543] text-white border-none py-2 px-5 rounded-full text-[13px] font-medium hover:bg-[#1f2631] cursor-pointer shadow-md">View Request</button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                [1,2,3].map((item) => (
                                    <tr key={item} className={`last:border-none ${item % 2 === 0 ? 'bg-[#fafafa]' : 'bg-white'}`}>
                                        <td className="py-4 px-6 text-[14px] text-[#1f2937] font-medium align-middle">REQ1234-2026</td>
                                        <td className="py-4 px-6 text-[14px] text-[#1f2937] align-middle">Brad Mason</td>
                                        <td className="py-4 px-6 text-[14px] text-[#1f2937] align-middle">{item === 2 ? 'Certificate of Good Moral' : 'Certificate of Enrollment'}</td>
                                        <td className="py-4 px-6 text-[14px] text-[#1f2937] align-middle">26/03/27</td>
                                        <td className="py-4 px-6 text-[14px] text-black align-middle">
                                            <span className="bg-[#e9f0ad] text-[#86a623] py-1 px-4 rounded-full font-bold text-[10px] inline-block text-center uppercase tracking-wider">PENDING</span>
                                        </td>
                                        <td className="py-4 px-6 text-[14px] text-black align-middle text-right">
                                            <button className="bg-[#2c3543] text-white border-none py-2 px-5 rounded-full text-[13px] font-medium hover:bg-[#1f2631] cursor-pointer shadow-md">View Request</button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </Layout>
    );
};

export default Dashboard;
