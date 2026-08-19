import { useEffect, useState, useMemo } from "react";
import Layout from "../../components/Layout";
import { useNavigate } from "react-router-dom";
import API from "../../components/config/axiosConfig";
import { Copy, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";

function MyTransactions() {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [toast, setToast] = useState({ show: false, message: "", type: "info" });
    const navigate = useNavigate();

    // Filter States
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("All Status");
    const [filterMonth, setFilterMonth] = useState(""); // "YYYY-MM" format
    const [entriesPerPage, setEntriesPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    const triggerToast = (message, type = "info") => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: "", type: "info" }), 4000);
    };

    const fetchTransactions = async (isRefresh = false) => {
        try {
            if (isRefresh) setRefreshing(true);
            else setLoading(true);

            const response = await API.get("blockchain/transactions/my-transactions");
            setTransactions(response.data || []);

            if (isRefresh) triggerToast("Transactions refreshed successfully", "success");
        } catch (error) {
            triggerToast(
                error.response?.data?.message || "Failed to load transactions",
                "error"
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchTransactions();
    }, []);

    const getStatusStyle = (status) => {
        switch (status?.toLowerCase()) {
            case "recorded": return "bg-[#E1FFEB] text-[#28A745]";
            case "pending": return "bg-[#FFFDE1] text-[#D2C300]";
            case "failed": return "bg-[#FFE1E1] text-[#DC3545]";
            default: return "bg-gray-100 text-gray-600";
        }
    };

    const filteredTransactions = useMemo(() => {
        return transactions.filter((tx) => {
            const matchesSearch =
                tx.referenceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                tx.nameOfStudent?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                tx.studentIDNumber?.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStatus =
                filterStatus === "All Status" || tx.blockchainStatus === filterStatus;

            // Single month filter: "YYYY-MM"
            let matchesMonth = true;
            if (filterMonth) {
                const txDate = new Date(tx.createdAt);
                const txYearMonth = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, "0")}`;
                matchesMonth = txYearMonth === filterMonth;
            }

            return matchesSearch && matchesStatus && matchesMonth;
        });
    }, [transactions, searchTerm, filterStatus, filterMonth]);

    const totalPages = Math.ceil(filteredTransactions.length / entriesPerPage);
    const paginatedTransactions = filteredTransactions.slice(
        (currentPage - 1) * entriesPerPage,
        currentPage * entriesPerPage
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterStatus, filterMonth, entriesPerPage]);

    const statuses = ["All Status", "Pending", "Recorded", "Failed"];

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        triggerToast("Copied to clipboard", "success");
    };

    if (loading) {
        return (
            <Layout>
                <div className="p-6 flex items-center justify-center min-h-screen">
                    <div className="flex flex-col items-center gap-3 text-gray-500">
                        <RefreshCw size={28} className="animate-spin text-[#1D2D44]" />
                        <p className="text-sm font-medium">Loading transactions...</p>
                    </div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="p-6 bg-[#F8F9FA] min-h-screen font-sans">
                <button
                    onClick={() => navigate('/blockchain')}
                    className="flex items-center gap-2 text-slate-700 hover:text-blue-600 hover:bg-white font-bold bg-slate-100 px-4 py-2 rounded-xl border border-slate-200 shadow-sm transition-all text-sm w-fit mb-4"
                >
                    <i className="fa-solid fa-arrow-left text-xs"></i>
                    Back to Blockchain
                </button>

                {/* Toast Notification */}
                {toast.show && (
                    <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[10001] flex items-center gap-3 px-6 py-3 rounded-lg shadow-2xl ${toast.type === "success" ? "bg-[#28A745] text-white" : "bg-[#DC3545] text-white"
                        }`}>
                        {toast.type === "success" ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                        <p className="font-bold text-sm">{toast.message}</p>
                    </div>
                )}

                <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">

                    {/* Top Controls */}
                    <div className="p-6 border-b border-gray-100">
                        <div className="flex flex-wrap items-center justify-between gap-4">

                            {/* Left: entries + search */}
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="flex items-center gap-2 text-[14px] text-[#7E84A3] shrink-0">
                                    <span>Show</span>
                                    <select
                                        className="appearance-none bg-white border border-[#DDE2EF] rounded-[6px] px-3 py-1 outline-none text-[#4D5E80] cursor-pointer hover:border-gray-400"
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
                                    className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:border-[#1D2D44] min-w-0"
                                    placeholder="Search by Reference Number, Student Name, or ID Number"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            {/* Right: status + month + refresh */}
                            <div className="flex items-center gap-3 flex-wrap shrink-0">
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="border border-gray-300 rounded px-2 py-2 text-sm bg-white min-w-[130px] outline-none"
                                >
                                    {statuses.map((s) => <option key={s}>{s}</option>)}
                                </select>

                                {/* Single month picker */}
                                <div className="flex items-center gap-2">
                                    <input
                                        type="month"
                                        className="border border-gray-300 rounded px-2 py-2 text-sm text-gray-600 outline-none focus:border-[#1D2D44]"
                                        value={filterMonth}
                                        onChange={(e) => setFilterMonth(e.target.value)}
                                    />
                                    {filterMonth && (
                                        <button
                                            onClick={() => setFilterMonth("")}
                                            className="text-xs text-gray-400 hover:text-gray-600 underline"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>

                                {/* Refresh Button */}
                                <button
                                    onClick={() => fetchTransactions(true)}
                                    disabled={refreshing}
                                    title="Refresh transactions"
                                    className="flex items-center gap-2 px-4 py-2 bg-[#1D2D44] text-white text-sm font-semibold rounded-lg hover:bg-[#2d3d54] transition disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
                                    {refreshing ? "Refreshing..." : "Refresh"}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-[13px] text-gray-800 border-b border-gray-200 uppercase font-bold bg-gray-50">
                                    <th className="px-6 py-4">Reference Number</th>
                                    <th className="px-6 py-4">Owner Name</th>
                                    <th className="px-6 py-4">ID Number</th>
                                    <th className="px-6 py-4">Document Type</th>
                                    <th className="px-6 py-4">Year / Course</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">TX Hash</th>
                                    <th className="px-6 py-4">Created</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedTransactions.length > 0 ? (
                                    paginatedTransactions.map((tx) => (
                                        <tr key={tx._id} className="border-b border-gray-200 hover:bg-gray-50 transition">
                                            <td className="px-6 py-4 text-sm font-mono text-[#1D2D44]">{tx.referenceNumber}</td>
                                            <td className="px-6 py-4 text-sm">
                                                <div className="flex flex-col">
                                                    <span>{tx.nameOfStudent}</span>
                                                    <span className="text-[10px] text-gray-400 uppercase tracking-wider">{tx.ownerType || 'Student'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm">{tx.studentIDNumber}</td>
                                            <td className="px-6 py-4 text-sm">{tx.typeOfDocument}</td>
                                            <td className="px-6 py-4 text-sm text-center">
                                                {(tx.ownerType === 'Alumni') 
                                                    ? tx.yearGraduated 
                                                    : (tx.course || tx.yearLevel) 
                                                        ? `${tx.course || ''} ${tx.yearLevel || ''}`.trim()
                                                        : tx.yearGraduated}
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusStyle(tx.blockchainStatus)}`}>
                                                    {tx.blockchainStatus}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                {tx.blockchainTxHash ? (
                                                    <button
                                                        onClick={() => copyToClipboard(tx.blockchainTxHash)}
                                                        className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-mono text-xs"
                                                        title="Click to copy"
                                                    >
                                                        {tx.blockchainTxHash.substring(0, 8)}...
                                                        <Copy size={14} />
                                                    </button>
                                                ) : (
                                                    <span className="text-gray-400 text-xs">—</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {new Date(tx.createdAt).toLocaleDateString()}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="8" className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center gap-2 text-gray-400">
                                                <span className="text-3xl">📭</span>
                                                <p className="text-sm font-medium">No transactions found</p>
                                                <p className="text-xs">Try adjusting your filters or create a new transaction</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="p-6 border-t border-gray-100 flex items-center justify-between">
                            <p className="text-sm text-gray-600">
                                Showing {paginatedTransactions.length > 0 ? (currentPage - 1) * entriesPerPage + 1 : 0} to{" "}
                                {Math.min(currentPage * entriesPerPage, filteredTransactions.length)} of{" "}
                                {filteredTransactions.length}
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                                >
                                    Previous
                                </button>
                                <div className="flex items-center gap-1">
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                        <button
                                            key={page}
                                            onClick={() => setCurrentPage(page)}
                                            className={`px-3 py-1 rounded text-sm ${currentPage === page
                                                ? "bg-[#1D2D44] text-white"
                                                : "border border-gray-300 hover:bg-gray-50"
                                                }`}
                                        >
                                            {page}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
}

export default MyTransactions;