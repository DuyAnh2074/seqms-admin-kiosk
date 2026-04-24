import React, { useState, useEffect } from 'react';
import { ArrowRightLeft, X, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { Button } from './UIComponents';
import api from '../services/api';

interface Service {
    id: number;
    name: string;
    code: string;
    is_active?: boolean;
}

interface Counter {
    id: number;
    name: string;
    code: string;
    service_ids?: number[];
}

interface Toast {
    id: string;
    message: string;
    type: 'success' | 'error' | 'warning';
}

interface TransferTicketModalProps {
    isOpen: boolean;
    ticketNumber: string;
    ticketId: number;
    onClose: () => void;
    onConfirm: (targetServiceId: number | null, targetCounterId: number | null) => Promise<void>;
    sessionToken: string;
    allowedServiceIds?: number[];
}

const API_BASE = 'http://localhost:5000/api';

const TransferTicketModal: React.FC<TransferTicketModalProps> = ({
    isOpen,
    ticketNumber,
    ticketId,
    onClose,
    onConfirm,
    sessionToken,
    allowedServiceIds = [],
}) => {
    const [services, setServices] = useState<Service[]>([]);
    const [counters, setCounters] = useState<Counter[]>([]);
    const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
    const [selectedCounterId, setSelectedCounterId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadingCounters, setLoadingCounters] = useState(false);
    const [officeId, setOfficeId] = useState<number | null>(null);
    const [toasts, setToasts] = useState<Toast[]>([]);

    // Fetch session info to get office_id
    useEffect(() => {
        if (isOpen) {
            fetchSessionInfo();
        }
    }, [isOpen]);

    const fetchSessionInfo = async () => {
        try {
            const response = await api.get('/counter-live/session-info', {
                headers: {
                    'x-session-token': sessionToken,
                },
            });
            if (response.data.success) {
                setOfficeId(response.data.data.transaction_office_id);
            }
        } catch (error) {
            console.error('Error fetching session info:', error);
        }
    };

    // Fetch danh sách dịch vụ
    useEffect(() => {
        if (isOpen) {
            fetchServices();
        }
    }, [isOpen, officeId, sessionToken, allowedServiceIds]);

    // Fetch danh sách quầy khi chọn dịch vụ HOẶC khi có officeId
    useEffect(() => {
        if (isOpen && officeId) {
            if (selectedServiceId) {
                fetchCountersByService(selectedServiceId);
            } else {
                // Nếu không chọn dịch vụ, load tất cả quầy
                fetchAllCounters();
            }
        }
    }, [selectedServiceId, isOpen, officeId]);

    const fetchServices = async () => {
        try {
            const response = await api.get('/services', {
                params: {
                    active_only: true,
                    ...(officeId ? { transaction_office_id: officeId } : {}),
                },
                headers: {
                    'x-session-token': sessionToken,
                },
            });
            if (response.data.success) {
                const allServices = response.data.data || [];
                const activeServices = allServices.filter((service: Service) => service.is_active !== false);
                const scopedServices = allowedServiceIds.length > 0
                    ? activeServices.filter((service: Service) => allowedServiceIds.includes(Number(service.id)))
                    : activeServices;
                setServices(scopedServices);

                if (selectedServiceId && !scopedServices.some((service: Service) => service.id === selectedServiceId)) {
                    setSelectedServiceId(null);
                }
            }
        } catch (error) {
            console.error('Error fetching services:', error);
        }
    };

    const fetchCountersByService = async (serviceId: number) => {
        setLoadingCounters(true);
        try {
            // API để lấy danh sách quầy phục vụ dịch vụ cụ thể (trong cùng office)
            let url = `/counters?service_id=${serviceId}`;
            if (officeId) {
                url += `&office_id=${officeId}`;
            }

            const response = await api.get(url, {
                headers: {
                    'x-session-token': sessionToken,
                },
            });
            if (response.data.success) {
                setCounters(response.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching counters:', error);
            setCounters([]);
        } finally {
            setLoadingCounters(false);
        }
    };

    const fetchAllCounters = async () => {
        setLoadingCounters(true);
        try {
            // Lấy tất cả quầy đã cấu hình trong cùng office
            let url = `/counters`;
            if (officeId) {
                url += `?office_id=${officeId}`;
            }

            const response = await api.get(url, {
                headers: {
                    'x-session-token': sessionToken,
                },
            });
            if (response.data.success) {
                setCounters(response.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching counters:', error);
            setCounters([]);
        } finally {
            setLoadingCounters(false);
        }
    };

    // ===== NEW: Filter counters based on selected service =====
    const getFilteredCounters = () => {
        if (!selectedServiceId) {
            return counters;
        }

        // Filter to only show counters that support the selected service
        return counters.filter((counter) => {
            return counter.service_ids && counter.service_ids.includes(selectedServiceId);
        });
    };

    const handleConfirm = async () => {
        // ✅ Nếu chọn dịch vụ thì PHẢI chọn quầy, không được chỉ chọn dịch vụ
        if (selectedServiceId && !selectedCounterId) {
            showToast('Khi chuyển dịch vụ, vui lòng chọn quầy chuyển đến', 'error');
            return;
        }

        // ✅ Phải chọn ít nhất một: dịch vụ+quầy hoặc chỉ quầy
        if (!selectedServiceId && !selectedCounterId) {
            showToast('Vui lòng chọn ít nhất một: Dịch vụ + Quầy hoặc chỉ Quầy', 'error');
            return;
        }

        // ✅ KIỂM TRA: Quầy được chuyển đến có đang hoạt động (có session active) không?
        try {
            setLoading(true);
            const statusResponse = await api.get(`/counters/status/${selectedCounterId}`, {
                headers: {
                    'x-session-token': sessionToken,
                },
            });

            const statusData = statusResponse.data;

            if (!statusData.data?.hasActiveSession) {
                showToast('Quầy được chuyển đến chưa bắt đầu làm việc (không có phiên hoạt động).', 'warning');
                setLoading(false);
                return;
            }

            // ✅ Nếu quầy có session active, tiến hành chuyển vé
            await onConfirm(selectedServiceId, selectedCounterId);
            handleClose();
        } catch (error: any) {
            console.error('Error checking counter status:', error);

            // Do not show a generic toast when backend already returned
            // a business error message (parent handler already shows it).
            const backendMessage = error?.response?.data?.message;
            if (backendMessage) {
                return;
            }

            showToast('Lỗi kiểm tra trạng thái quầy. Vui lòng thử lại.', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Toast helper functions
    const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'error') => {
        const id = Math.random().toString(36).substr(2, 9);
        setToasts(prev => [...prev, { id, message, type }]);

        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    };

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const handleClose = () => {
        setSelectedServiceId(null);
        setSelectedCounterId(null);
        setServices([]);
        setCounters([]);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                    {/* Header - Nền xanh, chữ trắng */}
                    <div className="bg-blue-600 text-white px-6 py-4 rounded-t-lg flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <ArrowRightLeft size={24} />
                            <h3 className="text-xl font-bold">CHUYỂN ĐỔI VÉ</h3>
                        </div>
                        <button
                            onClick={handleClose}
                            className="text-white hover:bg-blue-700 rounded p-1 transition"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-6 space-y-4">
                        {/* Thông tin vé (Read-only) */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Số vé:</span>
                                <span className="text-lg font-bold text-blue-600">{ticketNumber}</span>
                            </div>
                        </div>

                        {/* Chọn dịch vụ */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Chọn dịch vụ
                            </label>
                            <select
                                value={selectedServiceId || ''}
                                onChange={(e) => setSelectedServiceId(e.target.value ? Number(e.target.value) : null)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={loading}
                            >
                                <option value="">-- Chọn dịch vụ (Không bắt buộc) --</option>
                                {services.map((service) => (
                                    <option key={service.id} value={service.id}>
                                        {service.code} - {service.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Chọn quầy chuyển đến */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Chọn quầy chuyển đến
                            </label>
                            <select
                                value={selectedCounterId || ''}
                                onChange={(e) => setSelectedCounterId(e.target.value ? Number(e.target.value) : null)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={loading || loadingCounters}
                            >
                                <option value="">-- Chọn quầy --</option>
                                {getFilteredCounters().map((counter) => (
                                    <option key={counter.id} value={counter.id}>
                                        {counter.code} - {counter.name}
                                    </option>
                                ))}
                            </select>
                            {loadingCounters && (
                                <p className="text-xs text-gray-500 mt-1">Đang tải danh sách quầy...</p>
                            )}
                            {selectedServiceId && !loadingCounters && getFilteredCounters().length === 0 && (
                                <p className="text-xs text-orange-600 mt-1">
                                    Không có quầy nào phục vụ dịch vụ này
                                </p>
                            )}
                        </div>

                        {/* Lưu ý */}
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                            <p className="text-xs text-gray-600">
                                <strong>Lưu ý:</strong>
                                {selectedServiceId ? (
                                    <>
                                        Khi chuyển dịch vụ, <strong>bắt buộc chọn quầy</strong> để chuyển vé đến. Vé sẽ được chuyển sang trạng thái "Đang chờ" với dịch vụ và quầy mới.
                                    </>
                                ) : (
                                    <>
                                        Chọn <strong>Dịch vụ + Quầy</strong> để chuyển dịch vụ, hoặc chỉ chọn <strong>Quầy</strong> để chuyển về hàng đợi của dịch vụ hiện tại.
                                    </>
                                )}
                            </p>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-3">
                        <Button
                            variant="secondary"
                            onClick={handleClose}
                            disabled={loading}
                        >
                            Hủy
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleConfirm}
                            disabled={loading || (!selectedCounterId && !selectedServiceId) || (selectedServiceId && !selectedCounterId)}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {loading ? 'Đang xử lý...' : 'Xác nhận'}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Toast Notifications */}
            {toasts.length > 0 && (
                <div className="fixed top-6 right-6 z-[9999] space-y-3">
                    {toasts.map((toast) => (
                        <div
                            key={toast.id}
                            className={`flex items-center gap-3 px-5 py-4 rounded-lg shadow-xl border-2 min-w-[320px] max-w-[500px] ${toast.type === 'success'
                                ? 'bg-green-50 border-green-200'
                                : toast.type === 'error'
                                    ? 'bg-red-50 border-red-200'
                                    : 'bg-yellow-50 border-yellow-200'
                                }`}
                            style={{ animation: 'slideIn 0.3s ease-out' }}
                        >
                            {toast.type === 'success' ? (
                                <CheckCircle size={24} className="text-green-600 flex-shrink-0" />
                            ) : toast.type === 'error' ? (
                                <XCircle size={24} className="text-red-600 flex-shrink-0" />
                            ) : (
                                <AlertCircle size={24} className="text-yellow-600 flex-shrink-0" />
                            )}
                            <p
                                className={`flex-1 font-medium ${toast.type === 'success' ? 'text-green-800' : ''
                                    } ${toast.type === 'error' ? 'text-red-800' : ''} ${toast.type === 'warning' ? 'text-yellow-800' : ''
                                    }`}
                            >
                                {toast.message}
                            </p>
                            <button
                                onClick={() => removeToast(toast.id)}
                                className="text-gray-500 hover:text-gray-700 transition-colors"
                            >
                                <XCircle size={18} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <style>{`
                @keyframes slideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
            `}</style>
        </>
    );
};

export default TransferTicketModal;
