import { useState, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import api from '../../api';

// Import local assets
import loginImage from '../../assets/verifitor-login.png';
import smallLogo from '../../assets/verifitor_logo.png';

const OTP = () => {
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [showModal, setShowModal] = useState(false);
    const inputRefs = useRef([]);
    const navigate = useNavigate();
    const location = useLocation();
    const email = location.state?.email || '';
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleChange = (index, e) => {
        const value = e.target.value;
        if (/^[0-9]$/.test(value) || value === '') {
            const newOtp = [...otp];
            newOtp[index] = value;
            setOtp(newOtp);

            // Move to next input if typing a number
            if (value !== '' && index < 5) {
                inputRefs.current[index + 1].focus();
            }
        }
    };

    const handleKeyDown = (index, e) => {
        // Move to previous input on backspace
        if (e.key === 'Backspace' && otp[index] === '' && index > 0) {
            inputRefs.current[index - 1].focus();
        }
    };

    const handleVerify = async (e) => {
        e.preventDefault();
        setMessage('');
        setError('');
        const otpCode = otp.join('');
        if (otpCode.length < 6) {
            setShowModal(true);
            return;
        }

        try {
            const response = await api.post('/auth/verify-otp', { email, otp: otpCode });
            if (response.data.success) {
                navigate('/change-password', { state: { resetToken: response.data.resetToken } });
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Invalid or expired OTP.');
        }
    };

    const handleResendOTP = async (e) => {
        e.preventDefault();
        setMessage('');
        setError('');
        try {
            const response = await api.post('/auth/forgot-password', { email });
            if (response.data.success) {
                setMessage('OTP has been resent to your email.');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to resend OTP.');
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

                    <h2 className="text-[32px] font-black text-center text-[#000000] mb-2">VERIFY OTP</h2>
                    <p className="text-center text-[13px] text-[#333333] font-normal mb-8">Enter your One-Time Password (OTP)</p>
                    
                    {error && <p className="text-red-500 text-[12px] mb-4 text-center bg-red-50 py-2 rounded-md">{error}</p>}
                    {message && <p className="text-green-500 text-[12px] mb-4 text-center bg-green-50 py-2 rounded-md">{message}</p>}

                    <form onSubmit={handleVerify} id="otp-form" className="flex flex-col items-center w-full">
                        <div className="flex justify-center gap-2 sm:gap-3 mb-8 w-full">
                            {otp.map((digit, idx) => (
                                <input
                                    key={idx}
                                    ref={(el) => (inputRefs.current[idx] = el)}
                                    type="text"
                                    maxLength="1"
                                    className="w-[45px] h-[55px] sm:w-[50px] sm:h-[60px] border border-gray-300 rounded-lg text-center text-2xl font-semibold text-[#333] outline-none bg-white shadow-sm transition-colors duration-300 focus:border-[#213448] focus:ring-1 focus:ring-[#213448]"
                                    inputMode="numeric"
                                    value={digit}
                                    onChange={(e) => handleChange(idx, e)}
                                    onKeyDown={(e) => handleKeyDown(idx, e)}
                                />
                            ))}
                        </div>

                        <div className="w-full flex justify-center mb-4">
                            <button type="submit" className="w-[80%] py-3 bg-[#243547] text-white rounded-md font-bold text-[16px] tracking-wide shadow-md flex justify-center items-center gap-2 hover:bg-[#1a2634] transition-colors">
                                Verify OTP
                            </button>
                        </div>
                    </form>

                    <div className="text-center space-y-2 mt-2">
                        <button onClick={handleResendOTP} className="block w-full text-[13px] text-[#73A9D4] font-medium hover:underline focus:outline-none">
                            Resend OTP
                        </button>
                        <Link to="/login" className="block text-[13px] text-[#73A9D4] font-medium hover:underline mt-2">
                            Back to Login
                        </Link>
                    </div>
                </div>
            </div>

            {/* Error Modal */}
            {showModal && (
                <div id="error-modal" className="fixed top-0 left-0 w-full h-full bg-black/50 z-[1000] flex justify-center items-center">
                    <div className="bg-white w-[320px] p-[30px] rounded-xl text-center shadow-[0_10px_25px_rgba(0,0,0,0.2)]">
                        <div className="text-[40px] text-[#e74c3c] mb-[15px]">
                            <i className="fa-solid fa-circle-exclamation"></i>
                        </div>
                        <h3 className="m-0 mb-2.5 text-[#333] text-[18px]">Incomplete Code</h3>
                        <p className="text-[#666] text-[14px] mb-[25px] leading-relaxed">Please enter the complete 6-digit code to proceed.</p>
                        <button className="bg-[#213448] text-white border-none py-2.5 px-[30px] rounded-lg font-semibold cursor-pointer w-full transition-colors duration-200 hover:bg-[#1a252f]" onClick={() => setShowModal(false)}>OK</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OTP;
