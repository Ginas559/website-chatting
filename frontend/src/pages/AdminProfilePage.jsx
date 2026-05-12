import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logoutUser } from '../redux/slices/authSlice';

const AdminProfilePage = () => {
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
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 inline-flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                </div>
                <h1 className="text-2xl font-bold text-slate-800 mb-2">Admin Profile</h1>
                <p className="text-slate-500 mb-1">Role: <span className="font-semibold text-amber-500">Admin (R1)</span></p>
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

export default AdminProfilePage;
