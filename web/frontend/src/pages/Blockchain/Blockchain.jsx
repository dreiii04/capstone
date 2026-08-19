import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { Plus, Eye, CheckCircle } from 'lucide-react';

function Blockchain() {
    const navigate = useNavigate();

    const features = [
        {
            title: 'My Transactions',
            description: 'View all your recorded blockchain transactions',
            icon: Eye,
            color: 'bg-purple-50 border-purple-200',
            buttonColor: 'bg-purple-600 hover:bg-purple-700',
            path: '/blockchain/my-transactions'
        },
        {
            title: 'Verify Transaction',
            description: 'Verify a transaction on the blockchain',
            icon: CheckCircle,
            color: 'bg-green-50 border-green-200',
            buttonColor: 'bg-green-600 hover:bg-green-700',
            path: '/blockchain/verify'
        }
    ];

    return (
        <Layout>
            <div className="p-6 bg-[#F8F9FA] min-h-screen font-sans">
                <div className="max-w-6xl mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-[32px] font-bold text-[#1D2D44] mb-2">Blockchain Management</h1>
                        <p className="text-gray-600">Manage and verify your educational documents on the blockchain</p>
                    </div>

                    {/* Feature Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {features.map((feature, index) => {
                            const Icon = feature.icon;
                            return (
                                <div
                                    key={index}
                                    className={`border rounded-lg p-6 ${feature.color} transition-all hover:shadow-lg`}
                                >
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="p-3 bg-white rounded-lg">
                                            <Icon size={32} className="text-[#1D2D44]" />
                                        </div>
                                        <h2 className="text-[18px] font-bold text-[#1D2D44]">{feature.title}</h2>
                                    </div>

                                    <p className="text-gray-700 text-sm mb-6">{feature.description}</p>

                                    <button
                                        onClick={() => navigate(feature.path)}
                                        className={`w-full ${feature.buttonColor} text-white font-semibold py-2 rounded-lg transition`}
                                    >
                                        Access
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {/* Info Section */}
                    <div className="mt-12 bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                        <h3 className="text-[18px] font-bold text-[#1D2D44] mb-4">About Blockchain Verification</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-700">
                            <div>
                                <h4 className="font-semibold text-[#1D2D44] mb-2">Why Use Blockchain?</h4>
                                <p>Blockchain technology ensures immutable and transparent verification of educational documents, providing tamper-proof records of student achievements and credentials.</p>
                            </div>
                            <div>
                                <h4 className="font-semibold text-[#1D2D44] mb-2">How It Works</h4>
                                <p>Every transaction is recorded on a distributed ledger, creating a permanent record that can be verified by any authorized party without intermediaries.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
}

export default Blockchain;
