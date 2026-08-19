import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api';

// Import local assets
import loginImage from '../../assets/verifitor-login.png';
import smallLogo from '../../assets/verifitor_logo.png';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSendOTP = async (e) => {
        e.preventDefault();
        setMessage('');
        setError('');
        try {
            // Simulated API call for sending OTP
            const response = await api.post('/auth/forgot-password', { email });
            if (response.data.success) {
                // For demonstration, navigate straight to OTP page.
                // Normally you'd pass the email in state so the OTP page knows who to verify.
                navigate('/otp', { state: { email } });
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to send OTP. Please try again.');
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

                    <h2 className="text-[32px] font-black text-center text-[#000000] mb-2">FORGOT PASSWORD</h2>
                    <p className="text-center text-[13px] text-[#333333] font-normal mb-8">
                        Enter your registered email address to receive a One-Time Password (OTP).
                    </p>

                    <form onSubmit={handleSendOTP} className="flex flex-col items-center w-full">
                        <div className="w-full mb-6">
                            {error && <p className="text-red-500 text-[12px] mb-[10px] text-center bg-red-50 py-2 rounded-md">{error}</p>}
                            <input 
                                type="email" 
                                id="email" 
                                placeholder="Enter your email" 
                                className="w-full px-4 py-3.5 bg-white border border-gray-300 rounded-md text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#213448] shadow-sm"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required 
                            />
                        </div>

                        <div className="w-full flex justify-center mb-4">
                            <button 
                                type="submit" 
                                className="w-[80%] py-3 bg-[#243547] text-white rounded-md font-bold text-[16px] tracking-wide shadow-md flex justify-center items-center hover:bg-[#1a2634] transition-colors"
                            >
                                Send OTP
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
        </div>
    );
};

export default ForgotPassword;
