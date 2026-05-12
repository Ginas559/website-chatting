import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { loginUser, clearError } from '../redux/slices/authSlice';

/**
 * LoginPage Component
 * - TailwindCSS cho UI (glassmorphism light theme)
 * - Redux Hooks: useDispatch() để gọi loginUser, useSelector() để đọc state
 * - Axios gọi API /api/login (qua authSlice → api.js → axios.customize.js)
 */
const LoginPage = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { loading, error } = useSelector((state) => state.auth);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        dispatch(clearError());
        setSuccessMsg('');

        const result = await dispatch(loginUser({ email, password }));

        if (loginUser.fulfilled.match(result)) {
            const user = result.payload.user;
            setSuccessMsg('Đăng nhập thành công! Đang chuyển hướng...');
            setTimeout(() => {
                if (user.roleId === 'R1') {
                    navigate('/admin/profile');
                } else {
                    navigate('/user/profile');
                }
            }, 800);
        }
    };

    return (
        <div className="min-h-screen bg-[#f0f4f8] flex items-center justify-center relative overflow-hidden font-[Inter,sans-serif]">
            {/* Background blobs */}
            <div className="fixed w-[600px] h-[600px] rounded-full blur-[80px] opacity-60 pointer-events-none -top-50 -right-38 bg-[radial-gradient(circle,#e0e7ff_0%,transparent_70%)] animate-[float1_15s_ease-in-out_infinite]" />
            <div className="fixed w-[500px] h-[500px] rounded-full blur-[80px] opacity-60 pointer-events-none -bottom-38 -left-25 bg-[radial-gradient(circle,#dbeafe_0%,transparent_70%)] animate-[float2_12s_ease-in-out_infinite]" />

            <div className="relative z-10 w-full max-w-[420px] px-4">
                <div className="bg-white rounded-3xl p-11 shadow-[0_20px_40px_rgba(148,163,184,0.15),0_1px_3px_rgba(0,0,0,0.05)] border border-slate-100 animate-[cardIn_0.5s_ease-out]">
                    {/* Logo */}
                    <div className="text-center mb-9">
                        <div className="w-17 h-17 rounded-[20px] bg-gradient-to-br from-indigo-500 to-blue-500 inline-flex items-center justify-center mb-4 shadow-[0_10px_25px_rgba(99,102,241,0.3)]">
                            <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
                            </svg>
                        </div>
                        <h2 className="text-slate-900 font-bold text-2xl mb-1.5">Chat App</h2>
                        <p className="text-slate-500 text-sm">Đăng nhập để tiếp tục</p>
                    </div>

                    {/* Error Alert */}
                    {error && (
                        <div className="rounded-xl px-4 py-3 text-sm font-medium bg-red-50 text-red-500 border border-red-200 mb-5 animate-[msgIn_0.3s_ease] flex items-center gap-2">
                            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            {error}
                        </div>
                    )}

                    {/* Success Alert */}
                    {successMsg && (
                        <div className="rounded-xl px-4 py-3 text-sm font-medium bg-green-50 text-green-600 border border-green-200 mb-5 animate-[msgIn_0.3s_ease] flex items-center gap-2">
                            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            {successMsg}
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} autoComplete="on">
                        {/* Email */}
                        <div className="mb-5">
                            <label htmlFor="login-email" className="text-slate-600 text-[13px] font-semibold mb-2 block">Email</label>
                            <div className="relative">
                                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 transition-colors" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                                </svg>
                                <input
                                    type="email"
                                    id="login-email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@example.com"
                                    required
                                    autoComplete="email"
                                    className="w-full py-3.5 pl-11 pr-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="mb-5">
                            <label htmlFor="login-password" className="text-slate-600 text-[13px] font-semibold mb-2 block">Mật khẩu</label>
                            <div className="relative">
                                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                </svg>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    id="login-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    autoComplete="current-password"
                                    className="w-full py-3.5 pl-11 pr-11 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-500 transition-colors cursor-pointer"
                                >
                                    {showPassword ? (
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" /><path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" /></svg>
                                    ) : (
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Forgot password */}
                        <div className="text-right mb-5">
                            <Link to="/forgot-password" className="text-slate-500 text-[13px] font-medium hover:text-indigo-500 hover:underline transition-colors">
                                Quên mật khẩu?
                            </Link>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 text-white text-[15px] font-semibold cursor-pointer transition-all shadow-[0_4px_12px_rgba(99,102,241,0.2)] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(99,102,241,0.3)] active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none"
                        >
                            {loading ? (
                                <span className="inline-flex items-center gap-2">
                                    <span className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Đang xử lý...
                                </span>
                            ) : 'Đăng nhập'}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="flex items-center my-7">
                        <div className="flex-1 h-px bg-slate-200" />
                        <span className="text-slate-400 text-[11px] font-semibold px-3 uppercase tracking-wider">hoặc</span>
                        <div className="flex-1 h-px bg-slate-200" />
                    </div>

                    {/* Register */}
                    <Link
                        to="/register"
                        className="block w-full py-3 text-center border border-slate-300 rounded-xl bg-white text-slate-600 text-sm font-semibold transition-all hover:border-indigo-500 hover:text-indigo-500 hover:bg-slate-50"
                    >
                        Tạo tài khoản mới
                    </Link>
                </div>
            </div>

            {/* Keyframes */}
            <style>{`
                @keyframes float1 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-50px,50px)} }
                @keyframes float2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(50px,-50px)} }
                @keyframes cardIn { from{opacity:0;transform:translateY(24px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
                @keyframes msgIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
            `}</style>
        </div>
    );
};

export default LoginPage;
