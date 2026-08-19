import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../../api';

// Import local assets
import loginImage from '../../assets/verifitor-login.png';
import smallLogo from '../../assets/verifitor_logo.png';

const ChangePassword = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [modal, setModal] = useState({ show: false, title: '', message: '', type: 'error' });
    const navigate = useNavigate();
    const location = useLocation();
    const resetToken = location.state?.resetToken;

    const validatePassword = (pwd) => {
        return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])\S{8,72}$/.test(pwd);
    };

    const handleSave = async (e) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            setModal({
                show: true,
                title: 'Password Mismatch',
                message: 'The entered passwords do not match. Please try again.',
                type: 'error'
            });
            return;
        }

        if (!validatePassword(password)) {
            setModal({
                show: true,
                title: 'Weak Password',
                message: 'Use 8-72 characters with uppercase, lowercase, number, symbol, and no spaces.',
                type: 'error'
            });
            return;
        }
        
        if (!resetToken) {
            setModal({
                show: true,
                title: 'Error',
                message: 'Missing reset token. Please restart the password reset process.',
                type: 'error'
            });
            return;
        }

        try {
            const response = await api.post('/auth/reset-password', {
                resetToken,
                newPassword: password
            });

            if (response.data.success) {
                setModal({
                    show: true,
                    title: 'Success',
                    message: 'Your password has been changed successfully.',
                    type: 'success'
                });
            }
        } catch (err) {
            setModal({
                show: true,
                title: 'Error',
                message: err.response?.data?.message || 'Failed to reset password. Please try again.',
                type: 'error'
            });
        }
    };

    return (
        <div className="min-h-screen flex font-sans bg-[#F5F6F8]">
            {/* Left Column */}
            <div className="hidden lg:flex lg:w-1/2 relative p-4">
                <img 
                    src={loginImage} 
                    alt="Verifitor Login Design" 
                    className="w-full h-full object-cover rounded-2xl shadow-xl"
                />
            </div>

            {/* Right Column */}
            <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-8 sm:p-12 bg-[#F2F2F2] relative">
                
                {/* Back Arrow */}
                <button 
                    onClick={() => navigate('/login')}
                    className="absolute top-8 left-8 w-10 h-10 border border-gray-400 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors"
                >
                    <i className="fa-solid fa-arrow-left"></i>
                </button>

                <div className="w-full max-w-[400px]">
                    {/* Logo Header */}
                    <div className="mb-8 flex justify-center">
                        <img src={smallLogo} alt="Verifitor Logo" className="w-[95%] max-w-[400px] object-contain drop-shadow-md" />
                    </div>

                    <h2 className="text-[32px] font-black text-center text-[#000000] mb-2">RESET PASSWORD</h2>
                    <p className="text-center text-[13px] text-[#333333] font-normal mb-8">Enter your new password below</p>
                    
                    <form onSubmit={handleSave} id="reset-form" className="flex flex-col items-center w-full">
                        <div className="w-full space-y-6 mb-6">
                            <div className="relative">
                                <input 
                                    type={showPassword ? "text" : "password"} 
                                    id="new-password" 
                                    placeholder="New Password"
                                    className="w-full px-4 py-3.5 bg-white border border-gray-300 rounded-md text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#213448] shadow-sm pr-12" 
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required 
                                />
                                <button
                                    type="button"
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors focus:outline-none"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    <i className={`fa-solid ${showPassword ? 'fa-eye' : 'fa-eye-slash'} text-lg`}></i>
                                </button>
                            </div>

                            <div className="relative">
                                <input 
                                    type={showConfirmPassword ? "text" : "password"} 
                                    id="confirm-password" 
                                    placeholder="Confirm Password"
                                    className="w-full px-4 py-3.5 bg-white border border-gray-300 rounded-md text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#213448] shadow-sm pr-12" 
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required 
                                />
                                <button
                                    type="button"
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors focus:outline-none"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                >
                                    <i className={`fa-solid ${showConfirmPassword ? 'fa-eye' : 'fa-eye-slash'} text-lg`}></i>
                                </button>
                            </div>
                        </div>

                        <div className="w-full flex justify-center mb-4">
                            <button type="submit" className="w-[80%] py-3 bg-[#243547] text-white rounded-md font-bold text-[16px] tracking-wide shadow-md flex justify-center items-center hover:bg-[#1a2634] transition-colors">
                                Reset Password
                            </button>
                        </div>
                    </form>

                    <div className="text-center mt-2">
                        <Link to="/login" className="block text-[13px] text-[#73A9D4] font-medium hover:underline">
                            Back to Login
                        </Link>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {modal.show && (
                <div id="error-modal" className="fixed top-0 left-0 w-full h-full bg-black/50 z-[1000] flex justify-center items-center">
                    <div className="bg-white w-[320px] p-[30px] rounded-xl text-center shadow-[0_10px_25px_rgba(0,0,0,0.2)]">
                        <div className={`text-[40px] mb-[15px] ${modal.type === 'success' ? 'text-green-500' : 'text-[#e74c3c]'}`}>
                            <i className={`fa-solid ${modal.type === 'success' ? 'fa-check-circle' : 'fa-triangle-exclamation'}`}></i>
                        </div>
                        <h3 className="m-0 mb-2.5 text-[#333] text-[18px]">{modal.title}</h3>
                        <p id="modal-message" className="text-[#666] text-[14px] mb-[25px] leading-relaxed">{modal.message}</p>
                        <button 
                            className="bg-[#213448] text-white border-none py-[10px] px-[30px] rounded-lg font-semibold cursor-pointer w-full transition-colors duration-200 hover:bg-[#1a252f]" 
                            onClick={() => {
                                setModal({ show: false, title: '', message: '', type: 'error' });
                                if (modal.type === 'success') {
                                    navigate('/login');
                                }
                            }}
                        >
                            {modal.type === 'success' ? 'Go to Login' : 'Try Again'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChangePassword;
