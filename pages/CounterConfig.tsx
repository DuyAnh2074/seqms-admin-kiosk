import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle } from 'lucide-react';
import api from '../services/api';

interface Counter {
    counter_id: number;
    counter_number: string;
    counter_name: string;
    status: string;
    is_occupied: boolean;
}

interface Office {
    office_id: number;
    office_code: string;
    office_name: string;
}

interface CurrentSession {
    counter_id: number;
    Counter: {
        id: number;
        code: string;
        name: string;
    };
}

const CounterConfig: React.FC = () => {
    const navigate = useNavigate();
    const [office, setOffice] = useState<Office | null>(null);
    const [counters, setCounters] = useState<Counter[]>([]);
    const [selectedCounterId, setSelectedCounterId] = useState<string>('');
    const [currentSession, setCurrentSession] = useState<CurrentSession | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadingCounters, setLoadingCounters] = useState(true);
    const [loadingOffice, setLoadingOffice] = useState(true);
    const [error, setError] = useState('');
    const [showToast, setShowToast] = useState(false);
    const [noticeToast, setNoticeToast] = useState('');

    // Get user info from localStorage
    const username = localStorage.getItem('currentUser') || '';
    const userRole = localStorage.getItem('userRole') || '';

    useEffect(() => {
        const notice = localStorage.getItem('staffCounterNotice');
        if (notice) {
            setNoticeToast(notice);
            localStorage.removeItem('staffCounterNotice');

            const timeout = setTimeout(() => {
                setNoticeToast('');
            }, 4500);

            return () => clearTimeout(timeout);
        }
    }, []);

    useEffect(() => {
        if (userRole === 'staff') {
            fetchUserOffice();
            fetchCurrentSession();

            // ================================================================
            // LISTEN WebSocket Event: counter-assigned
            // ================================================================
            // Khi có user khác chọn 1 quầy, server sẽ emit event này
            // Client sẽ tự động refresh danh sách quầy
            // (Để tích hợp Socket.IO thực sự, cần setup socket connection ở App.tsx)
            // 
            // TODO: Implement WebSocket listener
            // const socket = io('http://localhost:3001');
            // socket.on('counter-assigned', (data) => {
            //   console.log('📡 Received: counter-assigned event', data);
            //   // Auto refresh counters list
            //   if (office?.office_id) {
            //     fetchCountersByOffice(office.office_id.toString());
            //   }
            // });
        }
    }, [userRole]);

    useEffect(() => {
        // Fetch counters when office is loaded
        if (office && office.office_id) {
            fetchCountersByOffice(office.office_id.toString());
        }
    }, [office]);

    const fetchUserOffice = async () => {
        try {
            setLoadingOffice(true);
            const response = await api.get('/staff/office');
            setOffice(response.data.data);
        } catch (err: any) {
            console.error('Error fetching user office:', err);
            setError(err.response?.data?.message || err.message || 'Lỗi khi tải thông tin chi nhánh');
            // Check for auth errors
            if (err.response?.status === 401 || err.response?.status === 403) {
                return; // Interceptor will handle logout
            }
        } finally {
            setLoadingOffice(false);
        }
    };

    const fetchCountersByOffice = async (officeId: string) => {
        try {
            setLoadingCounters(true);
            setCounters([]);
            setSelectedCounterId('');
            const response = await api.get('/staff/counters', {
                params: { office_id: officeId }
            });
            setCounters(response.data.data || []);
        } catch (err: any) {
            console.error('Error fetching counters:', err);
            setError(err.response?.data?.message || err.message || 'Lỗi khi tải danh sách quầy');
            // Check for auth errors
            if (err.response?.status === 401 || err.response?.status === 403) {
                return; // Interceptor will handle logout
            }
        } finally {
            setLoadingCounters(false);
        }
    };

    const fetchCurrentSession = async () => {
        try {
            const response = await api.get('/staff/session');
            setCurrentSession(response.data.data);
        } catch (err: any) {
            if (err.response?.status === 401 || err.response?.status === 403) {
                console.error('Auth error fetching session:', err);
            }
            setCurrentSession(null);
        }
    };

    const handleSave = async () => {
        if (!selectedCounterId) {
            setError('Vui lòng chọn quầy');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // ================================================================
            // BƯỚC 1: Gọi API /api/staff/assign-counter (NEW - Với xử lý race condition)
            // ================================================================
            // API này sẽ:
            // - Dùng SERIALIZABLE transaction ở backend
            // - Lock row để prevent race condition
            // - Kiểm tra active session trong transaction
            // - Nếu có conflict, return 409
            const response = await api.post('/staff/assign-counter', {
                counter_id: parseInt(selectedCounterId)
            });

            console.log('✅ Counter assigned successfully:', response.data.data);

            // ================================================================
            // BƯỚC 2: Save session info to localStorage
            // ================================================================
            localStorage.setItem('currentSession', JSON.stringify(response.data.data.session));
            localStorage.setItem('activeCounter', response.data.data.counter.id.toString());
            localStorage.setItem('activeCounterNumber', response.data.data.counter.code);
            localStorage.setItem('counterSessionToken', response.data.data.session.session_token);

            // ================================================================
            // BƯỚC 3: Update UI state
            // ================================================================
            setCurrentSession({
                counter_id: response.data.data.counter.id,
                Counter: {
                    id: response.data.data.counter.id,
                    code: response.data.data.counter.code,
                    name: response.data.data.counter.name,
                },
            });

            setShowToast(true);
            setTimeout(() => {
                setShowToast(false);
                // Navigate to counter live page
                navigate('/counter/live');
            }, 1500);

        } catch (err: any) {
            console.error('Error assigning counter:', err);

            // ================================================================
            // XỬ LÝ RACE CONDITION ERROR (409 Conflict)
            // ================================================================
            if (err.response?.status === 409) {
                // Quầy này vừa được ai đó chọn
                const conflictData = err.response?.data?.data;
                const occupiedBy = conflictData?.occupied_by?.username || 'nhân viên khác';
                const occupiedSince = new Date(conflictData?.occupied_since).toLocaleTimeString('vi-VN');

                setError(
                    `❌ Quầy "${counters.find(c => c.counter_id.toString() === selectedCounterId)?.counter_name || 'N/A'}" ` +
                    `vừa được ${occupiedBy} chọn (từ ${occupiedSince}). ` +
                    `Vui lòng chọn quầy khác.`
                );

                // ================================================================
                // Refresh danh sách quầy để user thấy cập nhật
                // ================================================================
                console.log('🔄 Refreshing counter list due to conflict...');
                if (office?.office_id) {
                    setTimeout(() => {
                        fetchCountersByOffice(office.office_id.toString());
                    }, 500);
                }

                // Clear selection
                setSelectedCounterId('');
            }
            // Other errors
            else {
                setError(err.response?.data?.message || err.message || 'Lỗi khi gán quầy');
            }

            // Check for auth errors
            if (err.response?.status === 401 || err.response?.status === 403) {
                return; // Interceptor will handle logout
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Main Content */}
            <div className="flex-1 flex flex-col">
                {/* Form Content */}
                <main className="flex-1 p-8 overflow-y-auto">
                    <div className="max-w-2xl">
                        <h2 className="text-2xl font-bold text-gray-800 mb-6">Cấu hình hệ thống quầy</h2>

                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 space-y-6">
                            {showToast && (
                                <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
                                    <CheckCircle size={20} className="flex-shrink-0" />
                                    Cấu hình thành công! Đang chuyển hướng...
                                </div>
                            )}

                            {noticeToast && (
                                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg text-orange-700 text-sm flex items-center gap-2">
                                    <AlertCircle size={20} className="flex-shrink-0" />
                                    {noticeToast}
                                </div>
                            )}

                            {error && (
                                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-3">
                                    <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                                    <span>{error}</span>
                                </div>
                            )}

                            {loadingCounters || loadingOffice ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="animate-spin"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full"></div></div>
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Mã chi nhánh </label>
                                        <input
                                            type="text"
                                            value={office ? `${office.office_code} - ${office.office_name}` : ''}
                                            disabled
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-md text-gray-700 text-sm cursor-not-allowed"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Tên đăng nhập</label>
                                            <input type="text" value={username} disabled className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-md text-gray-700 text-sm cursor-not-allowed" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Mã quầy</label>
                                            <input type="text" value={currentSession?.Counter?.code || ''} disabled placeholder="Chưa chọn" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-md text-gray-700 text-sm cursor-not-allowed" />
                                        </div>
                                    </div>

                                    {currentSession && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Tên quầy hiện tại</label>
                                            <input type="text" value={currentSession.Counter?.name || ''} disabled className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-md text-gray-700 text-sm cursor-not-allowed" />
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Chọn quầy <span className="text-red-500">*</span></label>
                                        <select value={selectedCounterId} onChange={(e) => setSelectedCounterId(e.target.value)} disabled={loadingCounters} className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-md text-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed">
                                            <option value="">-- Chọn quầy --</option>
                                            {counters.map((counter) => (
                                                <option key={counter.counter_id} value={counter.counter_id} disabled={counter.is_occupied}>
                                                    {counter.counter_name} ({counter.counter_number}){counter.is_occupied ? ' - [Đang sử dụng]' : ''}
                                                </option>
                                            ))}
                                        </select>
                                        {counters.length === 0 && !loadingCounters && <p className="mt-2 text-sm text-gray-500">Không có quầy khả dụng</p>}
                                    </div>

                                    <div className="flex justify-start pt-6 border-t">
                                        <button onClick={handleSave} disabled={!selectedCounterId || loading || loadingCounters} className="px-12 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition">
                                            {loading ? 'Đang lưu...' : 'LƯU'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default CounterConfig;
