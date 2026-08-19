import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api';

// Import local assets
import loginImage from '../../assets/verifitor-login.png';
import smallLogo from '../../assets/verifitor_logo.png';

const AdminLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const navigate = useNavigate();

    useEffect(() => {
        let timer;
        if (cooldown > 0) {
            timer = setInterval(() => {
                setCooldown((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [cooldown]);

    const validateForm = () => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setError('Please enter a valid email address.');
            return false;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters long.');
            return false;
        }
        return true;
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');

        if (!validateForm()) return;

        setIsLoading(true);
        try {
            const response = await api.post('/auth/login', { email, password });
            if (response.data.success || response.data.token) {
                localStorage.setItem('token', response.data.token);
                localStorage.setItem('adminUser', JSON.stringify(response.data.user));

                if (response.data.user && response.data.user.role) {
                    localStorage.setItem('userRole', response.data.user.role);
                }
                navigate('/dashboard');
            }
        } catch (err) {
            if (err.response?.status === 429) {
                const msg = err.response.data.message;
                const match = msg.match(/in (\d+) seconds/);
                if (match) {
                    setCooldown(parseInt(match[1], 10));
                }
            }
            const message = err.response?.data?.message || 'Invalid credentials. Please try again.';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="h-screen overflow-hidden flex font-sans bg-[#F5F6F8]">
            {/* Left Column - Branding (Entirely from the provided image) */}
            <div className="hidden lg:flex lg:w-1/2 relative p-4">
                <img 
                    src={loginImage} 
                    alt="Verifitor Login Design" 
                    className="w-full h-full object-cover rounded-2xl shadow-xl"
                />
            </div>

            {/* Right Column - Login Form */}
            <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-6 sm:p-8 bg-[#F2F2F2] overflow-y-auto">
                <div className="w-full max-w-[400px]">
                    
                    {/* Logo Header - Made much bigger to match mockup */}
                    <div className="mb-6 flex justify-center">
                        <img src={smallLogo} alt="Verifitor Logo" className="w-[85%] max-w-[320px] max-h-[140px] object-contain drop-shadow-md" />
                    </div>

                    {/* Welcome Text */}
                    <div className="text-center mb-6">
                        <h2 className="text-[36px] font-black text-[#000000] mb-2 tracking-wide">WELCOME!</h2>
                        <p className="text-[#333333] text-[13px] font-normal">Enter your email and password to access your account</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-5">
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm flex items-center gap-2" role="alert">
                                <i className="fa-solid fa-circle-exclamation shrink-0"></i>
                                {error}
                            </div>
                        )}

                        <div className="space-y-6">
                            <div className="relative">
                                <input
                                    id="login-email"
                                    type="email"
                                    placeholder="Enter your email"
                                    className="w-full px-4 py-3.5 bg-white border border-gray-300 rounded-md text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#213448] shadow-sm"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={isLoading}
                                    autoComplete="email"
                                />
                            </div>

                            <div>
                                <div className="relative">
                                    <input
                                        id="login-password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Enter your password"
                                        className="w-full px-4 py-3.5 bg-white border border-gray-300 rounded-md text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#213448] shadow-sm pr-12"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        disabled={isLoading}
                                        autoComplete="current-password"
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors focus:outline-none"
                                        onClick={() => setShowPassword(!showPassword)}
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        <i className={`fa-solid ${showPassword ? 'fa-eye' : 'fa-eye-slash'} text-lg`}></i>
                                    </button>
                                </div>
                                <div className="mt-2 text-right">
                                    <Link to="/forgot-password" className="text-[12px] text-[#73A9D4] hover:text-[#528ebf] font-normal transition-colors">
                                        Forgot Password?
                                    </Link>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-center mt-6">
                            <button
                                type="submit"
                                disabled={isLoading || cooldown > 0}
                                className={`w-3/5 py-3 bg-[#243547] text-white rounded-md font-bold text-[16px] tracking-wide shadow-md flex justify-center items-center gap-2 ${(isLoading || cooldown > 0) ? 'opacity-70 cursor-not-allowed' : 'hover:bg-[#1a2634] transition-colors'}`}
                            >
                                {cooldown > 0 ? (
                                    <>
                                        <i className="fa-solid fa-lock"></i>
                                        Try again in {cooldown}s
                                    </>
                                ) : isLoading ? (
                                    <>
                                        <i className="fa-solid fa-spinner animate-spin"></i>
                                        Logging in...
                                    </>
                                ) : 'LOGIN'}
                            </button>
                        </div>
                    </form>

                    {/* Account Hints - Restored */}
                    <div className="mt-8 pt-5 border-t border-gray-300">
                        <p className="text-[10px] text-gray-500 text-center mb-3 uppercase tracking-widest font-bold">Demo Accounts</p>
                        
                        <div className="flex gap-3">
                            <div
                                className="flex-1 bg-white border border-gray-300 rounded-lg p-3 cursor-pointer hover:border-blue-400 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-blue-400"
                                onClick={() => { setEmail('admin@verifitor.com'); setPassword('admin123'); }}
                                role="button"
                                tabIndex={0}
                            >
                                <p className="text-[11px] font-bold text-[#343a40] mb-1 flex items-center gap-1.5">
                                    <i className="fa-solid fa-user-tie text-blue-500"></i> Registrar
                                </p>
                                <p className="text-[10px] text-[#6c757d] m-0 truncate">admin@verifitor.com</p>
                            </div>

                            <div
                                className="flex-1 bg-white border border-gray-300 rounded-lg p-3 cursor-pointer hover:border-amber-400 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-amber-400"
                                onClick={() => { setEmail('sysadmin@verifitor.com'); setPassword('sysadmin123'); }}
                                role="button"
                                tabIndex={0}
                            >
                                <p className="text-[11px] font-bold text-[#343a40] mb-1 flex items-center gap-1.5">
                                    <i className="fa-solid fa-shield-halved text-amber-500"></i> Super Admin
                                </p>
                                <p className="text-[10px] text-[#6c757d] m-0 truncate">sysadmin@verifitor.com</p>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default AdminLogin;

