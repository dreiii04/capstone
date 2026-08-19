import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import ConfirmModal from '../../components/ConfirmModal';
import api from '../../api';
import { User, ShieldCheck, Save, X, Camera, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';

const Profile = () => {
    const navigate = useNavigate();

    // User Information State
    const [user, setUser] = useState({
        name: '',
        firstname: '',
        lastname: '',
        email: '',
        role: ''
    });

    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Password State
    const [passwords, setPasswords] = useState({
        current: '',
        newGroup: '',
        confirm: ''
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    // Confirm Modal State
    const [confirmConfig, setConfirmConfig] = useState(null);
    let isExecuting = false;
    const showConfirm = ({ title, message, onConfirm, type = 'info', confirmText = 'Confirm' }) => {
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
            cancelText: 'Cancel',
            isLoading: false
        });
    };

    const triggerToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        // Auto-hide toast after 3s
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };

    const handleProfileChange = (e) => {
        setUser({ ...user, [e.target.name]: e.target.value });
    };

    const handlePasswordChange = (e) => {
        setPasswords({ ...passwords, [e.target.name]: e.target.value });
    };

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await api.get('/auth/profile');
                const fullName = res.data.name || '';
                const parts = fullName.split(' ');
                setUser({
                    name: fullName,
                    firstname: parts[0] || '',
                    lastname: parts.slice(1).join(' ') || '',
                    email: res.data.email || '',
                    role: res.data.role || ''
                });
            } catch (err) {
                console.error("Error fetching profile:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, []);

    const handleUpdateProfile = () => {
        const fullName = `${user.firstname} ${user.lastname}`.trim();
        if (!fullName) {
            triggerToast("Firstname and Lastname are required", "error");
            return;
        }

        showConfirm({
            title: 'Update Profile Details',
            message: 'Are you sure you want to update your profile information?',
            type: 'info',
            confirmText: 'Update Profile',
            onConfirm: async () => {
                setSaving(true);
                try {
                    const res = await api.put('/auth/profile', { name: fullName });
                    const updatedUser = res.data;
                    
                    // We must merge it into the existing adminUser to not lose token and other frontend-only fields
                    const currentAdmin = JSON.parse(localStorage.getItem('adminUser') || '{}');
                    localStorage.setItem('adminUser', JSON.stringify({ ...currentAdmin, ...updatedUser }));
                    
                    window.dispatchEvent(new Event('profileUpdated'));
                    triggerToast("Profile details updated successfully!", "success");
                } catch (err) {
                    triggerToast(err.response?.data?.message || 'Failed to update profile.', "error");
                } finally {
                    setSaving(false);
                }
            }
        });
    };

    const handleUpdatePassword = () => {
        if (!passwords.current) {
            triggerToast("Current password is required to change password", "error");
            return;
        }
        if (!passwords.newGroup) {
            triggerToast("New password is required", "error");
            return;
        }
        if (passwords.newGroup !== passwords.confirm) {
            triggerToast("New passwords do not match!", "error");
            return;
        }

        showConfirm({
            title: 'Change Password',
            message: 'Are you sure you want to change your password? You will use this new password next time you log in.',
            type: 'warning',
            confirmText: 'Change Password',
            onConfirm: async () => {
                setSaving(true);
                try {
                    await api.put('/auth/change-password', {
                        currentPassword: passwords.current,
                        newPassword: passwords.newGroup
                    });
                    triggerToast("Password changed successfully!", "success");
                    setPasswords({ current: '', newGroup: '', confirm: '' });
                } catch (err) {
                    triggerToast(err.response?.data?.message || 'Failed to change password.', "error");
                } finally {
                    setSaving(false);
                }
            }
        });
    };

    if (loading) return <Layout><div className="p-8 flex items-center justify-center">Loading Profile Data...</div></Layout>;

    return (
        <Layout>
            <div className="p-8 bg-[#F8FAFC] min-h-screen font-sans relative">
                
                {/* --- DYNAMIC TOAST COMPONENT --- */}
                {toast.show && (
                    <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-6 py-3 rounded-lg shadow-2xl transition-all duration-300 transform translate-y-0 ${
                        toast.type === 'success' ? 'bg-[#1D2D44] text-white' : 'bg-red-600 text-white'
                    }`}>
                        {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                        <p className="font-bold text-sm tracking-wide">{toast.message}</p>
                        <button onClick={() => setToast({ ...toast, show: false })} className="ml-4 p-1 hover:bg-white/20 rounded-full transition-colors">
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* Confirm Modal */}
                {confirmConfig && (
                    <ConfirmModal 
                        {...confirmConfig} 
                        isOpen={!!confirmConfig} 
                        onClose={() => !confirmConfig.isLoading && setConfirmConfig(null)} 
                    />
                )}

                <div className="max-w-[900px] mx-auto p-4 sm:p-6 lg:p-8 font-sans pb-24">
                    {/* Basic Information Section */}
                    <div className="flex items-center gap-4 mb-6">
                        <h2 className="text-[20px] font-bold text-[#374151] m-0 whitespace-nowrap">Basic Information</h2>
                        <div className="flex-1 h-px bg-gray-300"></div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-10">
                        <div className="p-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="flex flex-col gap-2">
                                    <label className="text-[13px] font-bold text-gray-700">Firstname</label>
                                    <input 
                                        type="text" 
                                        name="firstname" 
                                        value={user.firstname}
                                        onChange={handleProfileChange}
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-[14px] outline-none focus:border-[#2c3543] focus:ring-1 focus:ring-[#2c3543] transition-all bg-white" 
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-[13px] font-bold text-gray-700">Lastname</label>
                                    <input 
                                        type="text" 
                                        name="lastname" 
                                        value={user.lastname}
                                        onChange={handleProfileChange}
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-[14px] outline-none focus:border-[#2c3543] focus:ring-1 focus:ring-[#2c3543] transition-all bg-white" 
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-[13px] font-bold text-gray-700">Email Address</label>
                                    <input 
                                        type="email" 
                                        name="email" 
                                        value={user.email || 'registrarname@sample.com'} 
                                        disabled 
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-[14px] outline-none bg-white text-gray-500 cursor-not-allowed" 
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-[13px] font-bold text-gray-700">User Role</label>
                                    <input 
                                        type="text" 
                                        value={user.role || 'Super Admin'} 
                                        disabled 
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-[14px] outline-none bg-white text-gray-500 cursor-not-allowed capitalize" 
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-[13px] font-bold text-gray-700">Employee ID</label>
                                    <input 
                                        type="text" 
                                        value="ID-123456" 
                                        disabled 
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-[14px] outline-none bg-white text-gray-500 cursor-not-allowed" 
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Security & Password Section */}
                    <div className="flex items-center gap-4 mb-6">
                        <h2 className="text-[20px] font-bold text-[#374151] m-0 whitespace-nowrap">Security & Password</h2>
                        <div className="flex-1 h-px bg-gray-300"></div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
                        <div className="p-8">
                            <div className="flex flex-col gap-6 max-w-2xl">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                                    <label className="text-[13px] font-bold text-gray-700 w-[180px]">Current Password</label>
                                    <div className="relative flex-1">
                                        <input 
                                            type={showCurrentPassword ? 'text' : 'password'}
                                            name="current" 
                                            value={passwords.current} 
                                            onChange={handlePasswordChange} 
                                            className="w-full border border-gray-300 rounded-full px-4 py-2 pr-10 text-[14px] outline-none focus:border-[#2c3543] focus:ring-1 focus:ring-[#2c3543] transition-all bg-white" 
                                        />
                                        <button 
                                            type="button"
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                        >
                                            {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                                    <label className="text-[13px] font-bold text-gray-700 w-[180px]">New Password</label>
                                    <div className="relative flex-1">
                                        <input 
                                            type={showNewPassword ? 'text' : 'password'}
                                            name="newGroup" 
                                            value={passwords.newGroup} 
                                            onChange={handlePasswordChange} 
                                            className="w-full border border-gray-300 rounded-full px-4 py-2 pr-10 text-[14px] outline-none focus:border-[#2c3543] focus:ring-1 focus:ring-[#2c3543] transition-all bg-white" 
                                        />
                                        <button 
                                            type="button"
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                        >
                                            {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                                    <label className="text-[13px] font-bold text-gray-700 w-[180px]">Confirm Password</label>
                                    <div className="relative flex-1">
                                        <input 
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            name="confirm" 
                                            value={passwords.confirm} 
                                            onChange={handlePasswordChange} 
                                            className="w-full border border-gray-300 rounded-full px-4 py-2 pr-10 text-[14px] outline-none focus:border-[#2c3543] focus:ring-1 focus:ring-[#2c3543] transition-all bg-white" 
                                        />
                                        <button 
                                            type="button"
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        >
                                            {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-4 mt-6">
                        <button 
                            className="bg-gray-400 text-white py-2.5 px-8 rounded-full font-bold text-sm hover:bg-gray-500 transition-colors shadow-sm cursor-pointer border-none"
                            onClick={() => navigate('/profile/info')}
                        >
                            Cancel
                        </button>
                        <button 
                            className="bg-[#2c3543] text-white py-2.5 px-8 rounded-full font-bold text-sm hover:bg-[#1f2631] transition-colors shadow-sm cursor-pointer border-none"
                            onClick={() => {
                                if (passwords.current || passwords.newGroup) {
                                    handleUpdatePassword();
                                }
                                handleUpdateProfile();
                            }}
                            disabled={saving}
                        >
                            {saving ? 'Saving...' : 'Confirm Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default Profile;
