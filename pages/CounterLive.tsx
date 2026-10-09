import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import {
    Phone,
    Play,
    CheckCircle,
    XCircle,
    SkipForward,
    RefreshCcw,
    ArrowRightLeft,
    Clock,
    Users,
    Calendar,
    Pause,
    PlayCircle,
    Trash2,
    ArchiveRestore,
    Plus,
} from 'lucide-react';
import { Button, Card } from '../components/UIComponents';
import TransferTicketModal from '../components/TransferTicketModal';
import CancelTicketModal from '../components/CancelTicketModal';
import AddServiceModal from '../components/AddServiceModal';
import FormViewerModal from '../components/FormViewerModal';
import useTextToSpeech from '../hooks/useTextToSpeech';
import api, { SOCKET_URL } from '../services/api';


// Types
interface Service {
    id: number;
    name: string;
    code: string;
}

interface Customer {
    id: number;
    name: string;
    phone?: string;
    // ✅ Add ID card related fields
    eid_number?: string;           // Số CCCD/Căn cước (có thể được gọi là `nation_no` hoặc `eid_number`)
    date_of_birth?: string;
    sex?: string;
    place_of_residence?: string;
    date_of_issue?: string;
    date_of_expiry?: string;
    nationality?: string;
    personal_identification?: string;
    religion?: string;
    ethnicity?: string;
    father_name?: string;
    mother_name?: string;
    spouse_name?: string;
    place_of_origin?: string;
    dg02?: string;                 // Avatar từ thẻ CCCD
    avatar_url?: string | null;    // Avatar từ camera
    [key: string]: any;            // Allow additional fields
}

interface Ticket {
    id: number;
    ticket_number: string;
    ticket_type: string;
    status: string;
    service: Service;
    customer: Customer | null;
    printed_at: string;
    called_at: string | null;
    started_at: string | null;
    finished_at: string | null;
    waiting_minutes: number;
    recall_count: number;
    note: string | null;
    face_capture_url?: string | null;
}

interface QueueData {
    waiting: Ticket[];
    missed: Ticket[];
    booking?: Ticket[];
    currentTicket: Ticket | null;
    allowed_service_ids?: number[];
}

// Format a duration (in seconds) to HH:MM:SS without using Date (avoids timezone offsets)
const formatDuration = (totalSeconds: number) => {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const pad = (num: number) => num.toString().padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
};

// Per-ticket live timer that counts up from printed_at
const WaitTimer: React.FC<{ startTime?: string | Date | null }> = ({ startTime }) => {
    const computeElapsed = () => {
        if (!startTime) return 0;
        const parsed = new Date(startTime);
        const startMs = parsed.getTime();
        if (Number.isNaN(startMs)) return 0;
        const diffMs = Date.now() - startMs;
        return Math.max(0, diffMs / 1000);
    };

    const [elapsed, setElapsed] = useState<number>(computeElapsed);

    useEffect(() => {
        if (!startTime) return;
        const interval = setInterval(() => {
            setElapsed(computeElapsed());
        }, 1000);
        return () => clearInterval(interval);
    }, [startTime]);

    if (!startTime) return <span>-</span>;

    const minutes = elapsed / 60;
    const color = minutes > 30 ? 'text-red-600' : minutes > 15 ? 'text-orange-600' : 'text-gray-700';

    return <span className={`font-semibold ${color}`}>{formatDuration(elapsed)}</span>;
};

// Custom Hook: Timer
const useTimer = (isRunning: boolean, startTime: Date | null) => {
    const [seconds, setSeconds] = useState(0);

    useEffect(() => {
        if (!isRunning || !startTime) {
            setSeconds(0);
            return;
        }

        const interval = setInterval(() => {
            const now = new Date();
            const elapsed = Math.floor((now.getTime() - new Date(startTime).getTime()) / 1000);
            setSeconds(elapsed);
        }, 1000);

        return () => clearInterval(interval);
    }, [isRunning, startTime]);

    const formatTime = () => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return formatTime();
};

// Main Component
const CounterLive: React.FC = () => {
    const navigate = useNavigate();
    const sessionInvalidHandledRef = useRef(false);
    const [queueData, setQueueData] = useState<QueueData>({
        waiting: [],
        missed: [],
        booking: [],
        currentTicket: null,
    });
    const [activeTab, setActiveTab] = useState<'waiting' | 'missed'>('waiting');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [transferTicketId, setTransferTicketId] = useState<number | null>(null);
    const [transferTicketNumber, setTransferTicketNumber] = useState<string>('');
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelTicketId, setCancelTicketId] = useState<number | null>(null);
    const [cancelTicketNumber, setCancelTicketNumber] = useState<string>('');
    const [showAddServiceModal, setShowAddServiceModal] = useState(false);
    const [addServiceTicketId, setAddServiceTicketId] = useState<number | null>(null);
    const [socketConnected, setSocketConnected] = useState(false);
    const [counterName, setCounterName] = useState<string>('Quầy '); // Default counter name
    const [isPaused, setIsPaused] = useState(false); // Pause state for counter session
    const [showFormViewer, setShowFormViewer] = useState(false);
    const [formViewerService, setFormViewerService] = useState<string>('');
    const [formViewerCustomerData, setFormViewerCustomerData] = useState<any>(null);
    const [allowedServiceIds, setAllowedServiceIds] = useState<number[]>([]);

    // Toast notifications
    const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'error' }>>([]);

    // Confirm dialog
    const [confirmDialog, setConfirmDialog] = useState<{
        show: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({ show: false, title: '', message: '', onConfirm: () => { } });

    // Get session token from localStorage
    const sessionToken = localStorage.getItem('counterSessionToken');

    // Socket reference
    const socketRef = useRef<Socket | null>(null);
    const queueFetchInFlightRef = useRef(false);
    const queueRefreshTimerRef = useRef<number | null>(null);

    // Initialize text-to-speech hook
    const { speak } = useTextToSpeech();



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

    const handleCounterDeactivated = useCallback((message?: string) => {
        if (sessionInvalidHandledRef.current) return;
        sessionInvalidHandledRef.current = true;

        const notice = message || 'Quầy đã bị vô hiệu hóa. Vui lòng chọn quầy khác.';
        showToast(notice, 'error');
        localStorage.setItem('staffCounterNotice', notice);

        localStorage.removeItem('counterSessionToken');
        localStorage.removeItem('currentSession');
        localStorage.removeItem('activeCounter');
        localStorage.removeItem('activeCounterNumber');
        localStorage.removeItem('currentTicketStatus');

        setTimeout(() => {
            navigate('/counter/config', { replace: true });
        }, 1200);
    }, [navigate]);

    const isSessionInvalidMessage = (message?: string) => {
        if (!message) return false;
        const text = message.toLowerCase();
        return (
            text.includes('session not found') ||
            text.includes('session not found or inactive') ||
            text.includes('session not found or expired') ||
            text.includes('counter is inactive')
        );
    };

    // Confirm dialog helper
    const showConfirm = (title: string, message: string, onConfirm: () => void) => {
        setConfirmDialog({ show: true, title, message, onConfirm });
    };

    const hideConfirm = () => {
        setConfirmDialog({ show: false, title: '', message: '', onConfirm: () => { } });
    };

    // Timer for current serving ticket
    const timerDisplay = useTimer(
        queueData.currentTicket?.status === 'serving',
        queueData.currentTicket?.started_at ? new Date(queueData.currentTicket.started_at) : null
    );

    // Fetch queue data (socket updates and action sync)
    const fetchQueueData = useCallback(async () => {
        if (!sessionToken) {
            setError('No session token found');
            return;
        }

        if (queueFetchInFlightRef.current) {
            return;
        }

        queueFetchInFlightRef.current = true;

        try {
            // Fetch queue data
            const response = await api.get('/counter-live/queue', {
                headers: {
                    'x-session-token': sessionToken,
                },
            });

            if (response.data.success) {
                const nextAllowedServiceIds = Array.isArray(response.data.data?.allowed_service_ids)
                    ? response.data.data.allowed_service_ids
                        .map((id: unknown) => Number(id))
                        .filter((id: number) => Number.isInteger(id))
                    : [];

                setQueueData({
                    waiting: response.data.data?.waiting || [],
                    missed: response.data.data?.missed || [],
                    booking: response.data.data?.booking || [],
                    currentTicket: response.data.data?.currentTicket || null,
                    allowed_service_ids: nextAllowedServiceIds,
                });
                setAllowedServiceIds(nextAllowedServiceIds);
                setError(null);
            } else {
                setError(response.data.message || 'Failed to fetch queue data');
            }
        } catch (err: any) {
            console.error('Fetch queue error:', err);
            const message = err.response?.data?.message || err.message || 'Network error';
            if (isSessionInvalidMessage(message)) {
                handleCounterDeactivated('Quầy của bạn đã bị vô hiệu hóa hoặc phiên làm việc đã hết hiệu lực.');
                return;
            }
            setError(message);
            // Check for auth errors
            if (err.response?.status === 401 || err.response?.status === 403) {
                return; // Interceptor will handle logout
            }
        } finally {
            queueFetchInFlightRef.current = false;
        }
    }, [sessionToken, handleCounterDeactivated]);

    const fetchSessionInfo = useCallback(async () => {
        if (!sessionToken) return;

        try {
            const sessionResponse = await api.get('/counter-live/session-info', {
                headers: {
                    'x-session-token': sessionToken,
                },
            });

            if (sessionResponse.data.success && sessionResponse.data.data?.counter) {
                setCounterName(sessionResponse.data.data.counter.name || 'Quầy ');
            }
        } catch (err: any) {
            const message = err.response?.data?.message || err.message;
            if (isSessionInvalidMessage(message)) {
                handleCounterDeactivated('Quầy của bạn đã bị vô hiệu hóa hoặc phiên làm việc đã hết hiệu lực.');
            }
        }
    }, [sessionToken, handleCounterDeactivated]);

    const scheduleQueueRefresh = useCallback((delayMs = 120) => {
        if (queueRefreshTimerRef.current !== null) {
            window.clearTimeout(queueRefreshTimerRef.current);
        }

        queueRefreshTimerRef.current = window.setTimeout(() => {
            queueRefreshTimerRef.current = null;
            fetchQueueData();
        }, delayMs);
    }, [fetchQueueData]);

    // Notify App component when serving status changes (for logout prevention)
    useEffect(() => {
        const isServing = queueData.currentTicket?.status === 'serving';

        // Store in localStorage for App.tsx to read
        localStorage.setItem('currentTicketStatus', isServing ? 'serving' : 'idle');

        // Emit event to notify App component
        const event = new CustomEvent('serving:statusChanged', {
            detail: { isServing }
        });
        window.dispatchEvent(event);
    }, [queueData.currentTicket?.status]);

    // Initialize Socket.IO connection
    useEffect(() => {
        if (!sessionToken) {
            console.error('No session token found');
            return;
        }

        // Connect to Socket.IO server
        const socket = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5,
        });

        socketRef.current = socket;

        // Connection events
        socket.on('connect', () => {
            console.log('✅ Socket.IO connected:', socket.id);
            setSocketConnected(true);

            // Join counter session room
            socket.emit('join-counter-session', { sessionToken });
        });

        socket.on('joined-successfully', (data) => {
            console.log('✅ Joined counter session:', data);
            // Fetch initial queue and counter profile
            fetchQueueData();
            fetchSessionInfo();
        });

        socket.on('disconnect', () => {
            console.log('❌ Socket.IO disconnected');
            setSocketConnected(false);
        });

        socket.on('error', (err) => {
            console.error('Socket.IO error:', err);
            const message = err?.message || 'Socket connection error';
            if (isSessionInvalidMessage(message)) {
                handleCounterDeactivated('Quầy của bạn đã bị vô hiệu hóa. Vui lòng chọn lại quầy.');
                return;
            }
            setError(message);
        });

        socket.on('counter-force-logout', (payload: any) => {
            const message = payload?.message || 'Quầy đã bị vô hiệu hóa. Phiên làm việc đã kết thúc.';
            handleCounterDeactivated(message);
        });

        // Listen for queue updates
        // Debounce queue refresh to avoid duplicate heavy refetches when many events arrive together.
        socket.on('queue-updated', () => {
            console.log('📥 Queue updated: refetching queue data');
            scheduleQueueRefresh(150);
        });

        socket.on('CONFIG_UPDATED', () => {
            console.log('🔄 Counter config updated: refetching queue data');
            scheduleQueueRefresh(120);
        });

        // Cleanup on unmount
        return () => {
            console.log('🔌 Disconnecting socket...');
            socket.off('counter-force-logout');
            socket.off('queue-updated');
            socket.off('CONFIG_UPDATED');
            socket.disconnect();
            if (queueRefreshTimerRef.current !== null) {
                window.clearTimeout(queueRefreshTimerRef.current);
                queueRefreshTimerRef.current = null;
            }
        };
    }, [sessionToken, fetchQueueData, fetchSessionInfo, handleCounterDeactivated, scheduleQueueRefresh]);

    // Call Next Ticket
    const handleCallNext = async () => {
        setLoading(true);
        try {
            const response = await api.post('/counter-live/call',
                { action: 'NEXT' },
                {
                    headers: {
                        'x-session-token': sessionToken!,
                    },
                }
            );

            if (response.data.success) {
                // Announce the called ticket
                if (response.data.data?.ticket_number) {
                    speak(response.data.data.ticket_number, counterName);
                }

                // Optimistic update for instant UI feedback; then background sync.
                if (response.data.data) {
                    const calledTicket = response.data.data as Ticket;
                    setQueueData(prev => ({
                        ...prev,
                        currentTicket: calledTicket,
                        waiting: prev.waiting.filter(t => t.id !== calledTicket.id),
                        missed: prev.missed.filter(t => t.id !== calledTicket.id),
                    }));
                }

                scheduleQueueRefresh(80);
            } else {
                showToast(response.data.message || 'Không thể gọi vé', 'error');
            }
        } catch (err: any) {
            console.error('Call next error:', err);
            showToast(err.response?.data?.message || 'Lỗi kết nối mạng', 'error');
            if (err.response?.status === 401 || err.response?.status === 403) {
                return;
            }
        } finally {
            setLoading(false);
        }
    };

    // Call Specific Ticket
    const handleCallSpecific = async (transactionId: number) => {
        setLoading(true);
        try {
            const response = await api.post('/counter-live/call',
                { action: 'CALL_SPECIFIC', transaction_id: transactionId },
                {
                    headers: {
                        'x-session-token': sessionToken!,
                    },
                }
            );

            if (response.data.success) {
                // Announce the called ticket
                if (response.data.data?.ticket_number) {
                    speak(response.data.data.ticket_number, counterName);
                }

                if (response.data.data) {
                    const calledTicket = response.data.data as Ticket;
                    setQueueData(prev => ({
                        ...prev,
                        currentTicket: calledTicket,
                        waiting: prev.waiting.filter(t => t.id !== calledTicket.id),
                        missed: prev.missed.filter(t => t.id !== calledTicket.id),
                    }));
                }

                scheduleQueueRefresh(80);
            } else {
                showToast(response.data.message || 'Không thể gọi vé', 'error');
            }
        } catch (err: any) {
            console.error('Call specific error:', err);
            showToast(err.response?.data?.message || 'Lỗi kết nối mạng', 'error');
            if (err.response?.status === 401 || err.response?.status === 403) {
                return;
            }
        } finally {
            setLoading(false);
        }
    };

    // Ticket Actions
    const handleTicketAction = async (transactionId: number, action: string, note?: string) => {
        setLoading(true);
        try {
            const response = await api.post('/counter-live/ticket-action',
                { transaction_id: transactionId, action, note },
                {
                    headers: {
                        'x-session-token': sessionToken!,
                    },
                }
            );

            if (response.data.success) {
                await fetchQueueData();
            } else {
                showToast(response.data.message || 'Không thể thực hiện thao tác', 'error');
            }
        } catch (err: any) {
            console.error('Ticket action error:', err);
            showToast(err.response?.data?.message || 'Lỗi kết nối mạng', 'error');
            if (err.response?.status === 401 || err.response?.status === 403) {
                return;
            }
        } finally {
            setLoading(false);
        }
    };

    // Restore Ticket
    const handleRestoreTicket = async (transactionId: number) => {
        setLoading(true);
        try {
            const response = await api.post('/counter-live/ticket-action',
                { transaction_id: transactionId, action: 'RESTORE' },
                {
                    headers: {
                        'x-session-token': sessionToken!,
                    },
                }
            );

            if (response.data.success) {
                await fetchQueueData();
                showToast('Khôi phục vé thành công!', 'success');
            } else {
                showToast(response.data.message || 'Không thể khôi phục vé', 'error');
            }
        } catch (err: any) {
            console.error('Restore ticket error:', err);
            showToast(err.response?.data?.message || 'Lỗi kết nối mạng', 'error');
            if (err.response?.status === 401 || err.response?.status === 403) {
                return;
            }
        } finally {
            setLoading(false);
        }
    };

    // Open Transfer Modal
    const handleOpenTransferModal = (ticket: Ticket) => {
        setTransferTicketId(ticket.id);
        setTransferTicketNumber(ticket.ticket_number);
        setShowTransferModal(true);
    };

    // Handle Transfer Ticket
    const handleTransferTicket = async (targetServiceId: number | null, targetCounterId: number | null) => {
        if (!transferTicketId) return;

        try {
            const response = await api.post('/counter-live/transfer',
                {
                    transaction_id: transferTicketId,
                    target_service_id: targetServiceId,
                    target_counter_id: targetCounterId,
                    note: 'Chuyển vé từ nhân viên',
                },
                {
                    headers: {
                        'x-session-token': sessionToken!,
                    },
                }
            );

            if (response.data.success) {
                await fetchQueueData();
                showToast('Chuyển vé thành công!', 'success');
            } else {
                showToast(response.data.message || 'Không thể chuyển vé', 'error');
            }
        } catch (err: any) {
            console.error('Transfer ticket error:', err);
            showToast(err.response?.data?.message || 'Lỗi kết nối mạng', 'error');
            if (err.response?.status === 401 || err.response?.status === 403) {
                return;
            }
            throw err;
        }
    };

    // Open Cancel Modal
    const handleOpenCancelModal = (ticket: Ticket) => {
        setCancelTicketId(ticket.id);
        setCancelTicketNumber(ticket.ticket_number);
        setShowCancelModal(true);
    };

    // Handle Cancel Ticket
    const handleCancelTicket = async (note?: string) => {
        if (!cancelTicketId) return;

        try {
            const response = await api.post('/counter-live/cancel',
                {
                    transaction_id: cancelTicketId,
                    note: note || 'Hủy bởi nhân viên',
                },
                {
                    headers: {
                        'x-session-token': sessionToken!,
                    },
                }
            );

            if (response.data.success) {
                await fetchQueueData();
                showToast('Hủy vé thành công!', 'success');
            } else {
                showToast(response.data.message || 'Không thể hủy vé', 'error');
            }
        } catch (err: any) {
            console.error('Cancel ticket error:', err);
            showToast(err.response?.data?.message || 'Lỗi kết nối mạng', 'error');
            if (err.response?.status === 401 || err.response?.status === 403) {
                return;
            }
            throw err;
        }
    };

    // Open Add Service Modal
    const handleOpenAddServiceModal = (ticketId: number) => {
        setAddServiceTicketId(ticketId);
        setShowAddServiceModal(true);
    };

    // Open Form Viewer Modal
    const handleOpenFormViewer = (serviceKey: string, customer: Customer | null) => {
        setFormViewerService(serviceKey);
        setFormViewerCustomerData(
            customer ? {
                full_name: customer.name,
                phone_number: customer.phone,
                // ✅ Map ID card fields correctly
                eid_number: customer.eid_number,      // Số CCCD/Căn cước
                date_of_birth: customer.date_of_birth,
                sex: customer.sex,
                place_of_residence: customer.place_of_residence,
                date_of_issue: customer.date_of_issue,
                date_of_expiry: customer.date_of_expiry,  // ✅ Fixed: was `expired_date`
                nationality: customer.nationality,
                personal_identification: customer.personal_identification,
                religion: customer.religion,
                ethnicity: customer.ethnicity,
                father_name: customer.father_name,
                mother_name: customer.mother_name,
                spouse_name: customer.spouse_name,
                place_of_origin: customer.place_of_origin,
                avatar: customer.avatar_url || customer.dg02,  // Prefer avatar_url (camera), fallback to dg02 (card)
            } : {}
        );
        setShowFormViewer(true);
    };

    // Handle Add Service - Updated for new Split Transaction logic
    const handleAddService = async (newServiceId: number) => {
        if (!addServiceTicketId) return;

        try {
            const response = await api.post('/counter-live/add-service',
                {
                    transaction_id: addServiceTicketId,
                    new_service_id: newServiceId,
                },
                {
                    headers: {
                        'x-session-token': sessionToken!,
                    },
                }
            );

            if (response.data.success) {
                // Backend now returns a NEW transaction with NEW ID
                // data.data contains: { ticket, old_transaction_id, new_transaction_id }
                const newTicket = response.data.data.ticket;
                const oldTransactionId = response.data.data.old_transaction_id;
                const newTransactionId = response.data.data.new_transaction_id;

                console.log('Service added - Old transaction completed:', oldTransactionId);
                console.log('New transaction created:', newTransactionId);

                // Update currentTicket with NEW transaction
                // Timer will automatically reset because started_at is NOW in the new ticket
                setQueueData(prev => ({
                    ...prev,
                    currentTicket: newTicket, // This has new ID and fresh started_at
                }));

                showToast(`Thêm dịch vụ thành công!`, 'success');
            } else {
                showToast(response.data.message || 'Không thể thêm dịch vụ', 'error');
            }
        } catch (err: any) {
            console.error('Add service error:', err);
            showToast(err.response?.data?.message || 'Lỗi kết nối mạng', 'error');
            if (err.response?.status === 401 || err.response?.status === 403) {
                return;
            }
            throw err;
        }
    };

    // Recall Ticket
    const handleRecallTicket = async (transactionId: number) => {
        setLoading(true);
        try {
            const response = await api.post('/counter-live/recall',
                { transaction_id: transactionId },
                {
                    headers: {
                        'x-session-token': sessionToken!,
                    },
                }
            );

            if (response.data.success) {
                showToast('Đã gọi lại vé thành công!', 'success');
                // Announce the recalled ticket
                const ticket = queueData.currentTicket;
                if (ticket) {
                    speak(ticket.ticket_number, counterName);
                }
            } else {
                showToast(response.data.message || 'Không thể gọi lại vé', 'error');
            }
        } catch (err: any) {
            console.error('Recall ticket error:', err);
            showToast(err.response?.data?.message || 'Lỗi kết nối mạng', 'error');
            if (err.response?.status === 401 || err.response?.status === 403) {
                return;
            }
        } finally {
            setLoading(false);
        }
    };

    // Pause/Resume Session
    const handleTogglePause = async () => {
        setLoading(true);
        try {
            const newStatus = isPaused ? 'active' : 'paused';

            const response = await api.post('/counter-live/session/status',
                { status: newStatus },
                {
                    headers: {
                        'x-session-token': sessionToken!,
                    },
                }
            );

            if (response.data.success) {
                setIsPaused(!isPaused);
                showToast(isPaused ? 'Đã tiếp tục làm việc!' : 'Đã tạm nghỉ!', 'success');
            } else {
                showToast(response.data.message || 'Không thể cập nhật trạng thái', 'error');
            }
        } catch (err: any) {
            console.error('Toggle pause error:', err);
            showToast(err.response?.data?.message || 'Lỗi kết nối mạng', 'error');
            if (err.response?.status === 401 || err.response?.status === 403) {
                return;
            }
        } finally {
            setLoading(false);
        }
    };

    // Render ticket row
    const renderTicketRow = (ticket: Ticket, showActions = true, index: number) => (
        <tr key={ticket.id} className="border-b hover:bg-gray-50">
            <td className="px-4 py-3 text-sm text-center">{index + 1}</td>
            <td className="px-4 py-3 text-sm text-center">{ticket.ticket_type === 'offline' ? 'Offline' : 'Kiosk'}</td>
            <td className="px-4 py-3 text-sm font-bold text-blue-600 text-center">{ticket.ticket_number}</td>
            <td className="px-4 py-3 text-sm">{ticket.service.name}</td>
            <td className="px-4 py-3 text-sm text-center">
                <WaitTimer startTime={ticket.printed_at} />
            </td>
            {showActions && (
                <td className="px-4 py-3 text-sm">
                    <div className="flex gap-2 justify-center">
                        {ticket.status === 'waiting' && (
                            <>
                                <Button
                                    size="sm"
                                    variant="primary"
                                    onClick={() => handleCallSpecific(ticket.id)}
                                    disabled={loading || queueData.currentTicket !== null}
                                    className="flex items-center gap-1"
                                    title="Gọi vé"
                                >
                                    <Play size={14} />
                                </Button>
                                <Button
                                    size="sm"
                                    variant="primary"
                                    onClick={() => handleOpenTransferModal(ticket)}
                                    disabled={loading}
                                    title="Chuyển vé"
                                >
                                    <ArrowRightLeft size={14} />
                                </Button>
                                <Button
                                    size="sm"
                                    variant="danger"
                                    onClick={() => handleOpenCancelModal(ticket)}
                                    disabled={loading}
                                    title="Hủy vé"
                                >
                                    <Trash2 size={14} />
                                </Button>
                            </>
                        )}
                        {(ticket.status === 'skipped' || ticket.status === 'cancelled') && (
                            <>
                                <Button
                                    size="sm"
                                    variant="primary"
                                    onClick={() => {
                                        showConfirm(
                                            'Xác nhận khôi phục',
                                            `Bạn có chắc chắn muốn khôi phục vé ${ticket.ticket_number} không?`,
                                            () => handleRestoreTicket(ticket.id)
                                        );
                                    }}
                                    disabled={loading}
                                    title="Khôi phục vé"
                                    className="bg-blue-600 hover:bg-blue-700"
                                >
                                    <ArchiveRestore size={14} />
                                </Button>
                            </>
                        )}
                    </div>
                </td>
            )}
        </tr>
    );

    // Render Control Panel
    const renderControlPanel = () => {
        const current = queueData.currentTicket;

        if (!current) {
            // Counter is idle
            return (
                <div className="text-center space-y-6">
                    <div className="text-gray-400">
                        <Users size={64} className="mx-auto mb-4" />
                        <p className="text-lg font-medium">Quầy đang rảnh</p>
                        <p className="text-sm">Nhấn nút bên dưới để gọi số tiếp theo</p>
                    </div>
                    <Button
                        variant="primary"
                        size="lg"
                        className="w-full text-lg py-4 cursor-pointer"
                        onClick={handleCallNext}
                        disabled={loading}
                    >
                        <Phone size={24} />
                        GỌI SỐ TIẾP THEO
                    </Button>
                </div>
            );
        }

        // There's a current ticket
        return (
            <div className="space-y-4">
                {/* Customer Images */}
                {(current.customer?.avatar_url || current.face_capture_url) && (
                    <div className="flex justify-center gap-4">
                        {/* CCCD Image */}
                        {current.customer?.avatar_url ? (
                            <div className="flex flex-col items-center">
                                <img
                                    src={current.customer.avatar_url}
                                    alt="CCCD"
                                    className="w-24 h-32 object-cover rounded-lg border-2 border-blue-300"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                    }}
                                />
                                <div className="hidden w-24 h-32 bg-gray-200 rounded-lg border-2 border-gray-300 flex items-center justify-center">
                                    <Users size={32} className="text-gray-400" />
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center">
                                <div className="w-24 h-32 bg-gray-200 rounded-lg border-2 border-gray-300 flex items-center justify-center">
                                    <Users size={32} className="text-gray-400" />
                                </div>
                            </div>
                        )}

                        {/* Face Capture Image */}
                        {current.face_capture_url && (
                            <div className="flex flex-col items-center">
                                <img
                                    src={current.face_capture_url}
                                    alt="Chụp tại Kiosk"
                                    className="w-24 h-32 object-cover rounded-lg border-2 border-blue-300"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                    }}
                                />
                                <div className="hidden w-24 h-32 bg-gray-100 rounded-lg border-2 border-gray-300 flex items-center justify-center">
                                    <span className="text-xs text-gray-400">Lỗi ảnh</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Add Service Button */}
                <div className="flex justify-center">
                    <button
                        onClick={() => handleOpenAddServiceModal(current.id)}
                        disabled={loading}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Thêm dịch vụ"
                    >
                        <Plus size={14} />
                    </button>
                </div>

                {/* View/Print Form Button */}
                <div className="flex justify-center">
                    <button
                        onClick={() => handleOpenFormViewer(current.service.code || '', current.customer)}
                        disabled={loading}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                        title="Xem và in biểu mẫu"
                    >
                        📋 Biểu mẫu
                    </button>
                </div>

                {/* Ticket Number Display */}
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Số vé:</p>
                    <p className="text-4xl font-bold text-blue-600 mb-1">{current.ticket_number}</p>
                    {current.customer ? (
                        <p className="text-sm font-medium text-gray-800">Khách hàng: {current.customer.name}</p>
                    ) : (
                        <p className="text-sm text-gray-600">Khách hàng: Không có</p>
                    )}
                    <p className="text-sm text-gray-700 mt-1">Dịch vụ: {current.service.name}</p>
                </div>

                {/* Timer */}
                {current.status === 'serving' && (
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                        <Clock size={20} className="mx-auto mb-1 text-green-600" />
                        <p className="text-2xl font-mono font-bold text-green-600">{timerDisplay}</p>
                        <p className="text-xs text-gray-600">Thời gian phục vụ</p>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-3">
                    {current.status === 'serving' && (
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                <Button
                                    //variant="primary"
                                    className="bg-green-600 hover:bg-green-700"
                                    onClick={() => handleTicketAction(current.id, 'END')}
                                    disabled={loading}
                                >
                                    <CheckCircle size={20} />
                                    HOÀN THÀNH
                                </Button>
                                <Button
                                    //variant="primary"
                                    className="bg-orange-600 hover:bg-orange-700"
                                    onClick={() => handleRecallTicket(current.id)}
                                    disabled={loading}
                                >
                                    <RefreshCcw size={20} />
                                    GỌI LẠI
                                </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Button
                                    variant="primary"
                                    onClick={() => handleOpenTransferModal(current)}
                                    disabled={loading}
                                >
                                    <ArrowRightLeft size={16} />
                                    Chuyển vé
                                </Button>
                                <Button
                                    variant="danger"
                                    onClick={() => handleOpenCancelModal(current)}
                                    disabled={loading}
                                >
                                    <Trash2 size={16} />
                                    Hủy vé
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    };

    return (
        <React.Fragment>
            <div className="min-h-screen bg-gray-50 flex flex-col">
                {/* Main Content */}
                <div className="flex-1">
                    <div className="p-6 bg-gray-50">
                        <div className="max-w-7xl mx-auto">
                            {/* Header */}
                            <div className="mb-6 flex justify-between items-center">
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900">Phục vụ tại {counterName}</h1>
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm text-gray-600">Giao diện nhân viên quầy</p>
                                        {socketConnected ? (
                                            <span className="flex items-center gap-1 text-xs text-green-600">
                                                <span className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></span>
                                                Real-time
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-xs text-red-600">
                                                <span className="w-2 h-2 bg-red-600 rounded-full"></span>
                                                Connecting...
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <Button
                                    variant="secondary"
                                    icon={isPaused ? <PlayCircle size={16} /> : <Pause size={16} />}
                                    onClick={handleTogglePause}
                                    disabled={loading}
                                >
                                    {isPaused ? 'Tiếp tục' : 'Tạm nghỉ'}
                                </Button>
                            </div>

                            {error && (
                                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                                    {error}
                                </div>
                            )}

                            {/* Main Layout: 70% - 30% */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Left Column: Queue Lists (70%) */}
                                <div className="lg:col-span-2">
                                    <Card>
                                        {/* Tabs */}
                                        <div className="mb-4">
                                            <nav className="flex border-b border-gray-200">
                                                <button
                                                    onClick={() => setActiveTab('waiting')}
                                                    className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'waiting'
                                                        ? 'border-blue-500 text-blue-600 bg-blue-50'
                                                        : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    VÉ ĐANG ĐỢI ({queueData?.waiting?.length || 0})
                                                </button>
                                                <button
                                                    onClick={() => setActiveTab('missed')}
                                                    className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'missed'
                                                        ? 'border-blue-500 text-blue-600 bg-blue-50'
                                                        : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    VÉ TẠM HỦY/ CHỜ KHÔI PHỤC ({queueData?.missed?.length || 0})
                                                </button>
                                            </nav>
                                        </div>

                                        {/* Table */}
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead className="bg-blue-600 text-white">
                                                    <tr>
                                                        <th className="px-4 py-3 text-center text-xs font-medium uppercase">
                                                            STT
                                                        </th>
                                                        <th className="px-4 py-3 text-center text-xs font-medium uppercase">
                                                            Loại vé
                                                        </th>
                                                        <th className="px-4 py-3 text-center text-xs font-medium uppercase">
                                                            Số vé
                                                        </th>
                                                        <th className="px-4 py-3 text-left text-xs font-medium uppercase">
                                                            Dịch vụ
                                                        </th>
                                                        <th className="px-4 py-3 text-center text-xs font-medium uppercase">
                                                            Thời gian đợi
                                                        </th>
                                                        <th className="px-4 py-3 text-center text-xs font-medium uppercase">
                                                            Thao tác
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {activeTab === 'waiting' &&
                                                        queueData?.waiting?.map((ticket, index) => renderTicketRow(ticket, true, index))}
                                                    {activeTab === 'missed' &&
                                                        queueData?.missed?.map((ticket, index) => renderTicketRow(ticket, true, index))}
                                                    {((activeTab === 'waiting' && (queueData?.waiting?.length || 0) === 0) ||
                                                        (activeTab === 'missed' && (queueData?.missed?.length || 0) === 0)) && (
                                                            <tr>
                                                                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                                                                    Không có dữ liệu
                                                                </td>
                                                            </tr>
                                                        )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </Card>
                                </div>

                                {/* Right Column: Control Panel (30%) */}
                                <div className="lg:col-span-1">
                                    <Card className="sticky top-6">{renderControlPanel()}</Card>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Transfer Modal (Simple implementation) */}
            {showTransferModal && (
                <TransferTicketModal
                    isOpen={showTransferModal}
                    ticketNumber={transferTicketNumber}
                    ticketId={transferTicketId!}
                    onClose={() => {
                        setShowTransferModal(false);
                        setTransferTicketId(null);
                        setTransferTicketNumber('');
                    }}
                    onConfirm={handleTransferTicket}
                    sessionToken={sessionToken!}
                    allowedServiceIds={allowedServiceIds}
                />
            )}

            {/* Cancel Modal */}
            {showCancelModal && (
                <CancelTicketModal
                    isOpen={showCancelModal}
                    ticketNumber={cancelTicketNumber}
                    ticketId={cancelTicketId!}
                    onClose={() => {
                        setShowCancelModal(false);
                        setCancelTicketId(null);
                        setCancelTicketNumber('');
                    }}
                    onConfirm={handleCancelTicket}
                />
            )}

            {/* Toast Notifications */}
            {toasts.length > 0 && (
                <div className="fixed top-6 right-6 z-[9999] space-y-3">
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
                                <XCircle size={18} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Confirm Dialog */}
            {confirmDialog.show && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-scale-in">
                        {/* Header */}
                        <div className="bg-blue-600 px-6 py-4">
                            <h3 className="text-xl font-bold text-white">{confirmDialog.title}</h3>
                        </div>

                        {/* Body */}
                        <div className="p-6">
                            <p className="text-gray-700 text-base leading-relaxed">{confirmDialog.message}</p>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
                            <Button
                                variant="secondary"
                                onClick={hideConfirm}
                            >
                                Hủy
                            </Button>
                            <Button
                                variant="primary"
                                onClick={() => {
                                    confirmDialog.onConfirm();
                                    hideConfirm();
                                }}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                Xác nhận
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Service Modal */}
            <AddServiceModal
                isOpen={showAddServiceModal}
                onClose={() => setShowAddServiceModal(false)}
                onConfirm={handleAddService}
                currentServiceId={queueData.currentTicket?.service.id || 0}
                sessionToken={sessionToken || ''}
                allowedServiceIds={allowedServiceIds}
            />

            {/* Form Viewer Modal */}
            <FormViewerModal
                isOpen={showFormViewer}
                onClose={() => setShowFormViewer(false)}
                serviceKey={formViewerService}
                customerData={formViewerCustomerData}
            />

            {/* Pause Overlay */}
            {isPaused && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-12 text-center shadow-2xl max-w-lg mx-4">
                        <div className="mb-6">
                            <div className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Pause size={48} className="text-orange-600" />
                            </div>
                            <h2 className="text-3xl font-bold text-gray-900 mb-2">QUẦY ĐANG TẠM NGHỈ</h2>
                            <p className="text-gray-600">Nhân viên đang nghỉ giải lao. Vui lòng bấm "Tiếp tục" để mở khóa giao diện.</p>
                        </div>
                        <Button
                            variant="primary"
                            size="lg"
                            className="w-full bg-green-600 hover:bg-green-700 text-xl py-4"
                            onClick={handleTogglePause}
                            disabled={loading}
                        >
                            <PlayCircle size={24} />
                            TIẾP TỤC LÀM VIỆC
                        </Button>
                    </div>
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
                @keyframes scaleIn {
                    from {
                        transform: scale(0.9);
                        opacity: 0;
                    }
                    to {
                        transform: scale(1);
                        opacity: 1;
                    }
                }
                .animate-scale-in {
                    animation: scaleIn 0.2s ease-out;
                }
            `}</style>
        </React.Fragment>
    );
};

export default CounterLive;
