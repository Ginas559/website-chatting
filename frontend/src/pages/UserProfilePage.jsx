import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logoutUser } from '../redux/slices/authSlice';

const UserProfilePage = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { user } = useSelector((state) => state.auth);

    const handleLogout = async () => {
        await dispatch(logoutUser());
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-[#f0f4f8] flex items-center justify-center font-[Inter,sans-serif]">
            <div className="bg-white rounded-3xl p-10 shadow-lg border border-slate-100 max-w-md w-full mx-4 text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 inline-flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                </div>
                <h1 className="text-2xl font-bold text-slate-800 mb-2">User Profile</h1>
                <p className="text-slate-500 mb-1">Role: <span className="font-semibold text-indigo-500">User (R2)</span></p>
                {user && (
                    <p className="text-slate-500 mb-6">{user.email}</p>
                )}
                <p className="text-slate-400 text-sm mb-6">Trang này sẽ được phát triển bởi thành viên khác.</p>
                <button
                    onClick={handleLogout}
                    className="px-6 py-2.5 rounded-xl bg-red-50 text-red-500 font-semibold text-sm border border-red-200 hover:bg-red-100 transition-colors cursor-pointer"
                >
                    Đăng xuất
                </button>
            </div>
        </div>
    );
};

export default UserProfilePage;
