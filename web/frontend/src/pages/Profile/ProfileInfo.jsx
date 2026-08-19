import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { User, Edit3, LogOut } from 'lucide-react';

const ProfileInfo = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState({
        name: 'John Dela Cruz',
        email: 'john@email.com',
        role: 'Registrar Administrator',
        profilePic: ''
    });

    // Sync with localStorage so the display reflects edits made in the other page
    useEffect(() => {
        const storedUser = JSON.parse(localStorage.getItem('adminUser'));
        if (storedUser) {
            setUser(prev => ({
                ...prev,
                name: storedUser.name || prev.name,
                email: storedUser.email || prev.email,
                role: storedUser.role || prev.role,
                profilePic: storedUser.profilePic || prev.profilePic
            }));
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('adminUser');
        navigate('/login');
    };

    return (
        <Layout>
            <div className="max-w-[900px] mx-auto p-4 sm:p-6 lg:p-8 font-sans">
                {/* Title Section */}
                <div className="flex items-center gap-4 mb-6">
                    <h2 className="text-[22px] font-bold text-[#374151] m-0 whitespace-nowrap">My Profile</h2>
                    <div className="flex-1 h-px bg-gray-300"></div>
                </div>

                {/* Top Avatar Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-6 flex items-center gap-6">
                    <div className="w-24 h-24 rounded-full bg-black flex items-center justify-center overflow-hidden flex-shrink-0">
                        {user.profilePic ? (
                            <img src={user.profilePic.startsWith('http') ? user.profilePic : `http://localhost:5000${user.profilePic}`} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <User size={48} color="white" />
                        )}
                    </div>
                    <div>
                        <h3 className="text-[28px] font-bold text-[#1f2937] m-0 leading-tight">{user.name || 'Registrar Name'}</h3>
                        <p className="text-[14px] text-gray-500 m-0 mt-1 capitalize">{user.role || 'Super Admin'}</p>
                    </div>
                </div>

                {/* Personal Information Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                    <div className="p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-[20px] font-bold text-[#374151] m-0">Personal Information</h3>
                            <button 
                                onClick={() => navigate('/profile')} 
                                className="bg-[#2c3543] text-white px-8 py-2 rounded-lg font-bold text-sm hover:bg-[#1f2631] transition-colors shadow-md cursor-pointer border-none"
                            >
                                Edit
                            </button>
                        </div>
                        <div className="h-px bg-gray-200 w-full mb-6"></div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-8 gap-x-4">
                            <div>
                                <p className="text-[12px] font-bold text-gray-500 m-0 mb-1">Firstname</p>
                                <p className="text-[16px] font-bold text-[#1f2937] m-0">{user.name ? user.name.split(' ')[0] : 'Registrar'}</p>
                            </div>
                            <div>
                                <p className="text-[12px] font-bold text-gray-500 m-0 mb-1">Lastname</p>
                                <p className="text-[16px] font-bold text-[#1f2937] m-0">{user.name ? user.name.split(' ').slice(1).join(' ') || 'Name' : 'Lastname'}</p>
                            </div>
                            <div>
                                <p className="text-[12px] font-bold text-gray-500 m-0 mb-1">Employee ID</p>
                                <p className="text-[16px] font-bold text-[#1f2937] m-0">ID-123456</p>
                            </div>
                            <div className="lg:col-span-2">
                                <p className="text-[12px] font-bold text-gray-500 m-0 mb-1">Email Address</p>
                                <p className="text-[16px] font-bold text-[#1f2937] m-0">{user.email || 'registrarname@sample.com'}</p>
                            </div>
                            <div>
                                <p className="text-[12px] font-bold text-gray-500 m-0 mb-1">User Role</p>
                                <p className="text-[16px] font-bold text-[#1f2937] m-0 capitalize">{user.role || 'Super Admin'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default ProfileInfo;