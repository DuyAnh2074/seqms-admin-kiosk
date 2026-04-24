import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, AlertCircle, Mail, Lock } from 'lucide-react';
import { Button } from '../components/UIComponents';
import { API_BASE_URL } from '../services/api';

interface LoginProps {
    onLoginSuccess: (username: string, role: string, token: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState<{ username?: string; password?: string }>({});
    const [isLoading, setIsLoading] = useState(false);
    const [apiError, setApiError] = useState('');
    const [cardVisible, setCardVisible] = useState(false);

    const clearStaffCounterCache = () => {
        localStorage.removeItem('counterSessionToken');
        localStorage.removeItem('currentSession');
        localStorage.removeItem('activeCounter');
        localStorage.removeItem('activeCounterNumber');
        localStorage.removeItem('staffCounterNotice');
        localStorage.removeItem('userOfficeId');
        localStorage.removeItem('currentTicketStatus');
    };

    // Animation effect on mount
    useEffect(() => {
        setCardVisible(true);
    }, []);

    const validateForm = () => {
        const newErrors: { username?: string; password?: string } = {};

        if (!username.trim()) {
            newErrors.username = 'Username is required';
        } else if (username.length < 3) {
            newErrors.username = 'Username must be at least 3 characters';
        }

        if (!password.trim()) {
            newErrors.password = 'Password is required';
        } else if (password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleLogin = async (username: string, password: string) => {
        setIsLoading(true);
        setApiError('');

        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Login failed');
            }

            // Always clear stale counter data from previous login before storing new auth data.
            clearStaffCounterCache();

            // Store authentication data
            localStorage.setItem('isAuthenticated', 'true');
            localStorage.setItem('currentUser', data.data.user.username);
            localStorage.setItem('authToken', data.data.token);
            localStorage.setItem('userRole', data.data.user.role);

            // Staff should start from an empty counter config, so close any leftover active session.
            if (data.data.user.role === 'staff') {
                try {
                    await fetch(`${API_BASE_URL}/staff/session/end`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${data.data.token}`,
                        },
                    });
                } catch (sessionErr) {
                    // Ignore cleanup failures; user can still continue to config page.
                    console.warn('Could not clear previous counter session on login:', sessionErr);
                }
            }

            // Call callback to notify parent component
            onLoginSuccess(data.data.user.username, data.data.user.role, data.data.token);

            // Navigate to appropriate page based on role
            const userRole = data.data.user.role;
            if (userRole === 'staff') {
                navigate('/counter/config', { replace: true });
            } else {
                navigate('/', { replace: true });
            }

            setIsLoading(false);
        } catch (error) {
            setIsLoading(false);
            setApiError(error instanceof Error ? error.message : 'An error occurred during login');
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setApiError('');
        handleLogin(username, password);
    };

    const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setUsername(e.target.value);
        if (errors.username) {
            setErrors({ ...errors, username: undefined });
        }
    };

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPassword(e.target.value);
        if (errors.password) {
            setErrors({ ...errors, password: undefined });
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Decorative Blob Shapes */}
            <div className="absolute top-0 left-0 w-96 h-96 bg-blue-200 rounded-full blur-3xl opacity-10 -translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-0 right-0 w-80 h-80 bg-indigo-200 rounded-full blur-3xl opacity-10 translate-x-1/2 translate-y-1/2"></div>
            <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-purple-200 rounded-full blur-3xl opacity-5 -translate-x-1/2 -translate-y-1/2"></div>

            <div className="w-full max-w-md relative z-10">
                {/* Login Card with Animation */}
                <div
                    className={`bg-white rounded-3xl shadow-2xl overflow-hidden transition-all duration-1000 ease-out transform ${cardVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                        }`}
                >
                    {/* Card Content */}
                    <div className="px-8 py-12">
                        {/* Logo & Title Section */}
                        <div className="text-center mb-8">
                            {/* Logo */}
                            <div className="inline-flex items-center justify-center mb-4">
                                <img
                                    src="/assets/vndc-logo.png"
                                    alt="VNDC Logo"
                                    className="h-28 w-auto"
                                    onError={(e) => {
                                        // Fallback logo with initials
                                        const img = e.target as HTMLImageElement;
                                        img.style.display = 'none';
                                    }}
                                />
                            </div>

                            {/* Brand Name */}
                            <p className="text-lg text-slate-700 font-medium tracking-wide">Hệ thống Quản lý VNDC</p>
                        </div>

                        {/* Error Message */}
                        {apiError && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 animate-pulse">
                                <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-red-700 font-medium">{apiError}</p>
                            </div>
                        )}

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Username Input */}
                            <div>
                                <label htmlFor="username" className="block text-sm font-semibold text-slate-700 mb-2.5">
                                    Tài khoản
                                </label>
                                <div className="relative group">
                                    <Mail
                                        size={18}
                                        className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors"
                                    />
                                    <input
                                        id="username"
                                        type="text"
                                        value={username}
                                        onChange={handleUsernameChange}
                                        placeholder="Nhập tài khoản"
                                        className={`w-full pl-11 pr-4 py-3 border-2 rounded-xl text-sm placeholder-slate-400 transition-all duration-200 focus:outline-none ${errors.username
                                            ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                                            : 'border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                                            } disabled:bg-slate-50 disabled:cursor-not-allowed`}
                                        disabled={isLoading}
                                    />
                                </div>
                                {errors.username && (
                                    <p className="text-red-600 text-xs font-semibold mt-1.5">{errors.username}</p>
                                )}
                            </div>

                            {/* Password Input */}
                            <div>
                                <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-2.5">
                                    Mật khẩu
                                </label>
                                <div className="relative group">
                                    <Lock
                                        size={18}
                                        className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors pointer-events-none"
                                    />
                                    <input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={handlePasswordChange}
                                        placeholder="Nhập mật khẩu"
                                        className={`w-full pl-11 pr-12 py-3 border-2 rounded-xl text-sm placeholder-slate-400 transition-all duration-200 focus:outline-none ${errors.password
                                            ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                                            : 'border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                                            } disabled:bg-slate-50 disabled:cursor-not-allowed`}
                                        disabled={isLoading}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none disabled:cursor-not-allowed"
                                        disabled={isLoading}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                {errors.password && (
                                    <p className="text-red-600 text-xs font-semibold mt-1.5">{errors.password}</p>
                                )}
                            </div>

                            {/* Login Button */}
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full mt-8 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-3.5 rounded-xl hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 flex items-center justify-center gap-2.5 disabled:opacity-60 disabled:cursor-not-allowed hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                            >
                                <LogIn size={20} />
                                <span>{isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}</span>
                            </button>
                        </form>

                        {/* Footer Note */}
                        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                            <p className="text-xs text-slate-500">© 2026 VNDC.</p>
                        </div>
                    </div>
                </div>

                {/* Loading Indicator */}
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Login;
