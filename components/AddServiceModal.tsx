import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from './UIComponents';
import api from '../services/api';

interface Service {
    id: number;
    name: string;
    code: string;
    is_active?: boolean;
}

interface AddServiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (serviceId: number) => Promise<void>;
    currentServiceId: number;
    sessionToken: string;
    allowedServiceIds?: number[];
}

const AddServiceModal: React.FC<AddServiceModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    currentServiceId,
    sessionToken,
    allowedServiceIds = [],
}) => {
    const [services, setServices] = useState<Service[]>([]);
    const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [officeId, setOfficeId] = useState<number | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchSessionInfo();
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            fetchServices();
        }
    }, [isOpen, officeId, currentServiceId, sessionToken, allowedServiceIds]);

    const fetchSessionInfo = async () => {
        try {
            const response = await api.get('/counter-live/session-info', {
                headers: {
                    'x-session-token': sessionToken,
                },
            });

            if (response.data.success) {
                setOfficeId(response.data.data?.transaction_office_id || null);
            }
        } catch (err) {
            console.error('Failed to fetch session info:', err);
        }
    };

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
                const activeServices = allServices.filter((s: Service) => s.is_active !== false);
                const scopedServices = allowedServiceIds.length > 0
                    ? activeServices.filter((s: Service) => allowedServiceIds.includes(Number(s.id)))
                    : activeServices;
                // Filter out current service
                const filteredServices = scopedServices.filter((s: Service) => s.id !== currentServiceId);
                setServices(filteredServices);

                if (selectedServiceId && !filteredServices.some((service: Service) => service.id === selectedServiceId)) {
                    setSelectedServiceId(null);
                }
            } else {
                console.error('Failed to fetch services:', response.data.message);
            }
        } catch (err) {
            console.error('Failed to fetch services:', err);
        }
    };

    const handleConfirm = async () => {
        if (!selectedServiceId) {
            alert('Vui lòng chọn dịch vụ');
            return;
        }

        setLoading(true);
        try {
            await onConfirm(selectedServiceId);
            onClose();
        } catch (err) {
            console.error('Add service error:', err);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-semibold text-gray-800">Thêm dịch vụ</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                        disabled={loading}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Chọn dịch vụ cần thêm
                        </label>
                        <select
                            value={selectedServiceId || ''}
                            onChange={(e) => setSelectedServiceId(Number(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={loading}
                        >
                            <option value="">-- Chọn dịch vụ --</option>
                            {services.map((service) => (
                                <option key={service.id} value={service.id}>
                                    {service.code} - {service.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
                        <p className="font-medium mb-1">Lưu ý:</p>
                        <ul className="list-disc list-inside space-y-1 text-xs">
                            <li>Dịch vụ hiện tại sẽ được thay đổi sang dịch vụ mới</li>
                            <li>Thời gian phục vụ sẽ được đặt lại từ đầu</li>
                            <li>Dịch vụ cũ và mới đều được ghi nhận trong hệ thống</li>
                        </ul>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex gap-3 p-4 border-t">
                    <Button
                        variant="secondary"
                        className="flex-1"
                        onClick={onClose}
                        disabled={loading}
                    >
                        Hủy
                    </Button>
                    <Button
                        variant="primary"
                        className="flex-1"
                        onClick={handleConfirm}
                        disabled={loading || !selectedServiceId}
                    >
                        {loading ? 'Đang xử lý...' : 'Xác nhận'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default AddServiceModal;
