import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './UIComponents';

interface CancelTicketModalProps {
    isOpen: boolean;
    ticketNumber: string;
    ticketId: number;
    onClose: () => void;
    onConfirm: (note?: string) => Promise<void>;
}

const CancelTicketModal: React.FC<CancelTicketModalProps> = ({
    isOpen,
    ticketNumber,
    ticketId,
    onClose,
    onConfirm,
}) => {
    const [loading, setLoading] = React.useState(false);
    const [note, setNote] = React.useState('');

    const handleConfirm = async () => {
        setLoading(true);
        try {
            await onConfirm(note || 'Hủy bởi nhân viên');
            handleClose();
        } catch (error) {
            console.error('Error cancelling ticket:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setNote('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                {/* Header - Nền đỏ, chữ trắng */}
                <div className="bg-red-600 text-white px-6 py-4 rounded-t-lg flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <AlertTriangle size={24} />
                        <h3 className="text-xl font-bold">XÁC NHẬN HỦY VÉ</h3>
                    </div>
                    <button
                        onClick={handleClose}
                        className="text-white hover:bg-red-700 rounded p-1 transition"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    {/* Cảnh báo */}
                    <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
                        <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-gray-900">
                                Bạn có chắc chắn muốn hủy vé{' '}
                                <span className="font-bold text-red-600">{ticketNumber}</span> không?
                            </p>
                            <p className="text-xs text-gray-600 mt-1">
                                Vé sẽ được đánh dấu là "Đã hủy" và không thể phục vụ.
                            </p>
                        </div>
                    </div>

                    {/* Lý do hủy (tùy chọn) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Lý do hủy (Tùy chọn)
                        </label>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Ví dụ: Khách hàng bỏ về, vé trùng, vé rác..."
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                            rows={3}
                            disabled={loading}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-3">
                    <Button
                        variant="secondary"
                        onClick={handleClose}
                        disabled={loading}
                    >
                        Không
                    </Button>
                    <Button
                        variant="danger"
                        onClick={handleConfirm}
                        disabled={loading}
                        className="bg-red-600 hover:bg-red-700"
                    >
                        {loading ? 'Đang xử lý...' : 'Xác nhận'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default CancelTicketModal;
