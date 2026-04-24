import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Loader, ArrowLeft, Printer, CheckCircle, XCircle } from 'lucide-react';
import { Button, Card } from './UIComponents';

interface FormViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
    serviceKey?: string;
    customerData?: {
        full_name?: string;
        phone_number?: string;
        date_of_birth?: string;
        nation_no?: string;
        place_of_issue?: string;
        date_of_issue?: string;
        address?: string;
        place_of_origin?: string;
        avatar?: string;
        [key: string]: any;
    };
    initialFormData?: any;
}

// Mapping template names
const templateMapping: { [key: string]: string } = {
    'dang-ky-ho-kinh-doanh': 'dang-ky-ho-kinh-doanh',
    'dang-ky-khai-sinh': '_1-TK-dang-ky-khai-sinh',
    'dang-ky-ket-hon': '_2-TK-dang-ky-ket-hon',
    'dang-ky-khai-tu': '_3-TK-dang-ky-khai-tu',
    'dang-ky-giam-ho': '_4-TK-dang-ky-giam-ho',
    'dang-ky-cham-dut-giam-ho': '_5-TK-dang-ky-cham-dut-giam-ho',
    'dang-ky-nhan-CMC': '_6-TK-dang-ky-nhan-CMC',
    'ghi-chu-ket-hon': '_8-TK-ghi-chu-ket-hon',
    'ghi-chu-ly-hon': '_9-TK-ghi-chu-ly-hon',
    'ghi-vao-so-ho-tich-viec-khai-tu': '_10-TK-ghi-vao-so-ho-tich-viec-khai-tu',
    'ghi-vao-so-ho-tich-viec-giam-ho-nhan-CMC': '_12-TK-ghi-vao-so-ho-tich-viec-giam-ho-nhan-CMC',
    'ghi-vao-so-ho-tich-cac-viec-ho-tich-khac': '_13-TK-ghi-vao-so-cac-viec-ho-tich-khac',
    'dang-ky-lai-khai-sinh': '_14-TK-dang-ky-lai-khai-sinh',
    'dang-ky-lai-ket-hon': '_15-TK-dang-ky-lai-ket-hon',
    'dang-ky-lai-khai-tu': '_16-TK-dang-ky-lai-khai-tu',
    'thay-doi-cai-chinh': '_17-TK-thay-doi-cai-chinh',
    'yeu-cau-ban-sao-trich-luc-ho-tich': '_18-TK-yeu-cau-ban-sao-trich-luc-ho-tich',
    'cap-giay-XNTTHN': '_19-TK-cap-giay-XNTTHN',
    'ban-cam-doan': '_20-ban-cam-doan',
    'personal-information': 'personal_information',
    'test': 'ngan-hang-so',
};

const getCurrentDateForTemplate = () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear());

    return {
        day,
        month,
        year,
    };
};

const formatDateToDDMMYYYY = (dateStr: string | undefined): string => {
    if (!dateStr) return "";

    // Handle ISO format (YYYY-MM-DD)
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    }

    // Handle already formatted DD/MM/YYYY
    if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        return dateStr;
    }

    // Return as-is if format is unknown
    return dateStr;
};

// Map ID data to customer data format
const mapIdDataToCustomerData = (idData, serviceKey = null) => {
    if (!idData) return {};
    let placeOfIssue = idData.place_of_issue || "";
    if (!placeOfIssue) {
        if (idData.place_of_residence_qr) {
            placeOfIssue = "Bộ công an";
        } else if (idData.place_of_residence || idData.date_of_issue) {
            placeOfIssue = "Cục trưởng cục cảnh sát quản lý hành chính về trật tự xã hội";
        }
    }

    let fullName = (idData.full_name || "").toUpperCase();

    const currentDate = getCurrentDateForTemplate();

    const parsedAddr = idData.parsed_data?.place_of_residence || idData.parsed_data?.place_of_residence_qr || {};

    // Extract address components from parsed data
    let province = parsedAddr.province || "";
    let district = parsedAddr.district || "";
    let ward = parsedAddr.ward || "";
    let street = parsedAddr.street || "";

    // Fallback: Nếu backend không trả về parsed_data, tự tách từ chuỗi string (dùng logic cũ)
    // ✅ FIX: Kiểm tra cả place_of_residence và place_of_residence_qr
    if (!province && (idData.place_of_residence || idData.place_of_residence_qr)) {
        const addressStr = idData.place_of_residence || idData.place_of_residence_qr;
        const parts = addressStr.split(',').map(p => p.trim());
        const len = parts.length;
        if (len > 0) province = parts[len - 1];
        if (len > 1) district = parts[len - 2];
        if (len > 2) ward = parts[len - 3];
        if (len > 3) street = parts.slice(0, len - 3).join(', ');
    }

    // ✅ XÁC ĐỊNH LOẠI GIẤY TỜ PHÁP LỸ
    // Nếu place_of_residence_qr có dữ liệu → Thẻ Căn cước mới → "CanCuoc"
    // Nếu không → Thẻ CCCD cũ → "CCCD"
    const loai_giay_to = idData.place_of_residence_qr ? "CanCuoc" : "CCCD";

    return {
        full_name: fullName,
        date_of_birth: formatDateToDDMMYYYY(idData.date_of_birth) || "",
        sex: idData.sex || "",
        nation_no: idData.eid_number || "",
        place_of_issue: placeOfIssue,
        date_of_issue: formatDateToDDMMYYYY(idData.date_of_issue || idData.date_of_issue_qr) || "",
        address: idData.place_of_residence || idData.place_of_residence_qr || "",
        expired_date: formatDateToDDMMYYYY(idData.date_of_expiry) || "",
        nation: idData.nationality || "Việt Nam",
        personal_identification: idData.personal_identification || "",
        religion: idData.religion || "",
        ethnicity: idData.ethnicity || "",
        father_name: idData.father_name || "",
        mother_name: idData.mother_name || "",
        spouse_name: idData.spouse_name || "",
        place_of_origin: idData.place_of_origin || "",
        avatar: idData.dg02 || "",
        loai_giay_to: loai_giay_to,
        // Current date fields for templates
        current_day: currentDate.day,
        current_month: currentDate.month,
        current_year: currentDate.year,
        street: street,
        province: province,
        district: district,
        ward: ward,
    };
};
const FormViewerModal: React.FC<FormViewerModalProps> = ({
    isOpen,
    onClose,
    serviceKey = 'dang-ky-ho-kinh-doanh',
    customerData = {},
    initialFormData = null,
}) => {
    const [loading, setLoading] = useState(false);
    const [pdfMode, setPdfMode] = useState(false);
    const [pdfUrl, setPdfUrl] = useState('');
    const [savedFormData, setSavedFormData] = useState(initialFormData);
    const [error, setError] = useState<string | null>(null);
    const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'error' }>>([]);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Toast helper functions
    const showToast = (message: string, type: 'success' | 'error') => {
        const id = Date.now().toString();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    };

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setPdfMode(false);
            setPdfUrl('');
            setError(null);
            if (!initialFormData) {
                setSavedFormData(null);
            }
        }
    }, [isOpen, initialFormData]);

    // Get iframe URL - memoized để tránh infinite loop
    const iframeUrl = useMemo(() => {
        const templateName = templateMapping[serviceKey] || templateMapping['dang-ky-ho-kinh-doanh'];
        const queryParams = new URLSearchParams();

        // ✅ Transform customer data using mapIdDataToCustomerData
        const transformedData = mapIdDataToCustomerData(customerData, serviceKey);

        // Add transformed customer data to query params (avoid avatar as it's too large)
        // ✅ Note: transformedData already includes current_day, current_month, current_year
        if (transformedData) {
            Object.keys(transformedData).forEach((key) => {
                // ✅ FIX: Cho phép empty strings để truyền cả các field rỗng
                if (key !== 'avatar' && transformedData[key] !== undefined && transformedData[key] !== null) {
                    queryParams.append(key, transformedData[key]);
                }
            });
        }

        const baseUrl = 'http://localhost:5000/api/public/html-forms';
        const url = `${baseUrl}/${templateName}?${queryParams.toString()}`;
        console.log('🌐 HTML Form URL:', url);
        return url;
    }, [customerData, serviceKey]);

    // Handle iframe messages
    useEffect(() => {
        const handleIframeMessage = (event: MessageEvent) => {
            // 1. Iframe ready - send data
            if (event.data?.type === 'FORM_READY') {
                console.log(' Form ready - sending customer data');

                // Send avatar separately if exists
                if (customerData && 'avatar' in customerData && customerData.avatar) {
                    iframeRef.current?.contentWindow?.postMessage(
                        {
                            type: 'INJECT_LARGE_DATA',
                            data: { avatar: customerData.avatar },
                        },
                        '*'
                    );
                }

                // Restore previous form data if exists
                if (savedFormData && !pdfMode) {
                    iframeRef.current?.contentWindow?.postMessage(
                        {
                            type: 'RESTORE_FORM_DATA',
                            data: savedFormData,
                        },
                        '*'
                    );
                }
            }

            // 2. Receive form data to generate PDF
            if (event.data?.type === 'FORM_DATA_RESPONSE') {
                const data = event.data.data;
                setSavedFormData(data);
                handleGeneratePDF(data);
            }
        };

        window.addEventListener('message', handleIframeMessage);
        return () => window.removeEventListener('message', handleIframeMessage);
    }, [pdfMode, savedFormData, customerData]);

    // Generate PDF
    const handleGeneratePDF = async (formData: any) => {
        setLoading(true);
        try {
            const response = await fetch('http://localhost:5000/api/pdf/generate-pdf-from-html', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    htmlContent: formData.formHTML,
                    templateName: serviceKey || 'default',
                }),
            });

            const result = await response.json();
            if (result.success) {
                setPdfUrl(result.pdfUrl);
                setPdfMode(true);
                showToast('Tạo PDF thành công!', 'success');
            } else {
                showToast(` Lỗi tạo PDF: ${result.error}`, 'error');
            }
        } catch (err) {
            console.error('PDF generation error:', err);
            showToast(' Lỗi kết nối server khi tạo PDF', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Print PDF
    const handlePrint = async () => {
        setLoading(true);
        try {
            const fileName = pdfUrl.split('/').pop();

            if (!fileName) {
                showToast(' Không tìm thấy tên file PDF', 'error');
                setLoading(false);
                return;
            }

            console.log('📄 Printing PDF file:', fileName);

            const response = await fetch('http://localhost:5000/api/pdf/convert-html-to-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileName: fileName,
                    printOptions: {
                        printer: 'RICOH IM 5000'
                    }
                }),
            });

            const result = await response.json();
            if (result.success) {
                // Show success message
                showToast(' Đã gửi lệnh in biểu mẫu thành công!', 'success');
                setTimeout(() => onClose(), 1500); // Close after showing toast
            } else {
                showToast(` Lỗi in: ${result.error || 'Không xác định'}`, 'error');
            }
        } catch (err) {
            console.error('Print error:', err);
            showToast(' Lỗi kết nối server khi in', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Request form data from iframe
    const handleRequestFormData = () => {
        if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage({ type: 'REQUEST_FORM_DATA' }, '*');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center p-2">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-[95vw] h-[96vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 h-10">
                    <h2 className="text-xl font-bold text-white">
                        {pdfMode ? '🖨️ Xem trước biểu mẫu' : '📝 Điền thông tin biểu mẫu'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 mx-4 mt-4">
                        <p className="text-red-700 text-sm">{error}</p>
                        <button
                            onClick={() => setError(null)}
                            className="text-red-600 hover:text-red-800 text-xs mt-2 underline"
                        >
                            Đóng
                        </button>
                    </div>
                )}

                {/* Content Area */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                                <Loader size={48} className="animate-spin text-blue-600 mx-auto mb-4" />
                                <p className="text-gray-600 font-medium">Đang tạo biểu mẫu...</p>
                            </div>
                        </div>
                    ) : pdfMode ? (
                        <iframe src={pdfUrl} width="100%" height="100%" style={{ border: 'none' }} title="PDF Viewer" />
                    ) : (
                        <iframe
                            ref={iframeRef}
                            src={iframeUrl}
                            width="100%"
                            height="100%"
                            style={{ border: 'none' }}
                            title="Form Editor"
                            sandbox="allow-same-origin allow-scripts allow-forms"
                        />
                    )}
                </div>

                {/* Footer - Action Buttons */}
                <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between h-10">
                    {!pdfMode ? (
                        <>
                            <Button variant="secondary" onClick={onClose}>
                                Đóng
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleRequestFormData}
                                disabled={loading}
                                className="flex items-center gap-2"
                            >
                                {loading && <Loader size={16} className="animate-spin" />}
                                Xem trước PDF
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="secondary" onClick={() => setPdfMode(false)} className="flex items-center gap-2">
                                <ArrowLeft size={16} />
                                Quay lại
                            </Button>
                            <div className="flex gap-3">
                                <Button variant="secondary" onClick={onClose}>
                                    Đóng
                                </Button>
                                <Button
                                    variant="primary"
                                    onClick={handlePrint}
                                    disabled={loading}
                                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                                >
                                    {loading ? <Loader size={16} className="animate-spin" /> : <Printer size={16} />}
                                    In
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Toast Notifications */}
            {toasts.length > 0 && (
                <div className="fixed top-6 right-6 z-[99999] space-y-3">
                    {toasts.map((toast) => (
                        <div
                            key={toast.id}
                            className={`flex items-center gap-3 px-5 py-4 rounded-lg shadow-xl border-2 min-w-[320px] max-w-[500px] animate-slide-in ${toast.type === 'success'
                                ? 'bg-green-50 border-green-200'
                                : 'bg-red-50 border-red-200'
                                }`}
                            style={{ animation: 'slideIn 0.3s ease-out' }}
                        >
                            {toast.type === 'success' ? (
                                <CheckCircle size={24} className="text-green-600 flex-shrink-0" />
                            ) : (
                                <XCircle size={24} className="text-red-600 flex-shrink-0" />
                            )}
                            <p
                                className={`flex-1 font-medium ${toast.type === 'success' ? 'text-green-800' : 'text-red-800'
                                    }`}
                            >
                                {toast.message}
                            </p>
                            <button
                                onClick={() => removeToast(toast.id)}
                                className="text-gray-500 hover:text-gray-700 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default FormViewerModal;
