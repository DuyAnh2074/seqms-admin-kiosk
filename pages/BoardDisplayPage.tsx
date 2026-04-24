import React, { useState, useEffect, useRef } from 'react';
import TicketRowItem from '../components/TicketRowItem';
import TicketCallPopup from '../components/TicketCallPopup';
import HeaderBoard from '../components/HeaderBoard';
import MediaContainer from '../components/MediaContainer';
import { io, Socket } from 'socket.io-client';
import api from '../services/api';
import { Bell, MoveRight, PlayCircle } from 'lucide-react';

interface EBoardConfig {
    id: number;
    code: string;
    name: string;
    display_video: boolean;
    voice_call_number: string;
    transaction_office_id: number;
    office_name: string;
    counter_ids: number[];
    TransactionOffice: {
        id: number;
        name: string;
    };
    counters: Array<{
        id: number;
        code: string;
        name: string;
    }>;
    media: Array<{
        id: number;
        file_type: 'image' | 'video';
        file_url: string;
        description: string | null;
        sort_order: number;
    }>;
}

interface CalledTicket {
    id: number;
    ticket_number: string;
    counter_id: number;
    counter_code: string;
    counter_name: string;
    service_name: string;
    status: string;
    called_at: string;
}

interface DisplaySlot {
    counter_id: number;
    counter_name: string; // VD: "quay-01", "quay-02"
    serving_ticket: string | null; // Số vé hoặc null
}

const BoardDisplayPage: React.FC = () => {
    const [hasStarted, setHasStarted] = useState(false);
    const [config, setConfig] = useState<EBoardConfig | null>(null);
    const [displaySlots, setDisplaySlots] = useState<DisplaySlot[]>([]);
    const [lastCalledTicket, setLastCalledTicket] = useState<CalledTicket | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Popup state
    const [showPopup, setShowPopup] = useState(false);
    const [popupData, setPopupData] = useState<CalledTicket | null>(null);
    const popupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const socketRef = useRef<Socket | null>(null);

    // Get board code from URL query params
    const boardCode = new URLSearchParams(
        window.location.hash.includes('?')
            ? window.location.hash.split('?')[1]
            : window.location.search
    ).get('code');

    useEffect(() => {
        if (!boardCode) {
            setError('Không tìm thấy mã E-Board trong URL. Vui lòng truy cập với ?code=BOARD_CODE');
            setLoading(false);
            return;
        }

        fetchBoardConfig();
        // fetchTodayTickets() - No longer needed, eboard-data returns serving_list
    }, [boardCode]);

    useEffect(() => {
        if (config) {
            setupSocketConnection();
        }

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            // Cleanup popup timeout
            if (popupTimeoutRef.current) {
                clearTimeout(popupTimeoutRef.current);
            }
        };
    }, [config]);

    // Auto-rotate media slideshow
    // Removed - Logic moved to MediaContainer component


    const fetchBoardConfig = async () => {
        try {
            const response = await api.get(`/public/eboard-data?code=${boardCode}`);

            if (!response.data.success) {
                throw new Error(response.data.message || 'API error');
            }

            const data = response.data;

            // Transform API response to config format
            setConfig({
                id: data.board_info.id,
                code: data.board_info.code,
                name: data.board_info.name,
                display_video: true,
                voice_call_number: data.board_info.voice_call_number,
                transaction_office_id: data.board_info.transaction_office_id,
                office_name: data.board_info.office_name,
                counter_ids: data.display_slots.map((s: any) => s.counter_id),
                counters: [],
                media: data.media,
                TransactionOffice: {
                    id: data.board_info.transaction_office_id,
                    name: data.board_info.office_name,
                },
            });

            // Set display slots and last called ticket from API
            setDisplaySlots(data.display_slots);
            setLastCalledTicket(data.last_called_ticket);

            setLoading(false);
        } catch (err: any) {
            console.error('Error fetching board config:', err);
            setError(err.response?.data?.message || err.message || 'Không tìm thấy cấu hình E-Board');
            setLoading(false);
        }
    };

    const setupSocketConnection = () => {
        if (!config) return;

        socketRef.current = io('http://localhost:5000', {
            transports: ['websocket'],
        });

        socketRef.current.on('connect', () => {
            console.log('Socket connected');
            socketRef.current?.emit('join_office', {
                transaction_office_id: config.transaction_office_id,
            });
        });

        socketRef.current.on('ticket-called', (data: any) => {
            console.log('Ticket called event:', data);
            handleTicketCalled(data);
        });

        socketRef.current.on('eboard-state-changed', (data: any) => {
            if (!data) return;

            const isCurrentBoard =
                (config?.id && Number(data.id) === Number(config.id)) ||
                (config?.code && String(data.code).toLowerCase() === String(config.code).toLowerCase());

            if (!isCurrentBoard) return;

            console.log('EBoard state changed:', data);

            if (data.is_active === false) {
                setError(data.message || 'E-Board đang bảo trì hoặc đã bị vô hiệu hóa');
                setDisplaySlots([]);
                setLastCalledTicket(null);
                return;
            }

            // If board is reactivated while page is open, refresh latest config
            if (data.is_active === true) {
                setError('');
                fetchBoardConfig();
            }
        });

        socketRef.current.on('disconnect', () => {
            console.log('Socket disconnected');
        });
    };

    const handleTicketCalled = (data: any) => {
        if (!config) return;

        // Check if this ticket belongs to one of this board's counters
        if (!config.counter_ids.includes(data.counter_id)) {
            return; // Ignore tickets from other counters
        }

        // Update display slots - refresh the serving ticket for this counter
        // Also remove the same ticket number from other counters to avoid duplicates
        setDisplaySlots((prev: DisplaySlot[]) =>
            prev.map((slot: DisplaySlot) =>
                slot.counter_id === data.counter_id
                    ? { ...slot, serving_ticket: data.ticket_number }
                    : // Remove the same ticket from other counters if it exists
                    slot.serving_ticket === data.ticket_number
                        ? { ...slot, serving_ticket: null }
                        : slot
            )
        );

        // Update last called ticket
        const newTicket: CalledTicket = {
            id: data.transaction_id,
            ticket_number: data.ticket_number,
            counter_id: data.counter_id,
            counter_code: data.counter_code,
            counter_name: data.counter_name,
            service_name: data.service_name,
            status: 'called',
            called_at: new Date().toISOString(),
        };

        setLastCalledTicket(newTicket);
        showTicketPopup(newTicket);
    };

    const showTicketPopup = (ticket: CalledTicket) => {
        // Clear existing timeout if any
        if (popupTimeoutRef.current) {
            clearTimeout(popupTimeoutRef.current);
        }

        // Show popup
        setPopupData(ticket);
        setShowPopup(true);

        // Auto-hide after 6 seconds
        popupTimeoutRef.current = setTimeout(() => {
            setShowPopup(false);
        }, 6000);
    };

    const handleStartDisplay = async () => {
        try {
            if (document.documentElement.requestFullscreen) {
                await document.documentElement.requestFullscreen();
            }

            if (window.speechSynthesis && typeof window.speechSynthesis.resume === 'function') {
                window.speechSynthesis.resume();
            }

            setHasStarted(true);
        } catch (err) {
            console.error('Lỗi khi mở Fullscreen:', err);
            setHasStarted(true);
        }
    };

    if (loading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-blue-900">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
                    <p className="text-2xl text-white">Đang tải cấu hình...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-blue-900">
                <p className="text-2xl text-white text-center px-8">{error}</p>
            </div>
        );
    }

    if (!config) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-blue-900">
                <p className="text-2xl text-white">Không tìm thấy cấu hình E-Board</p>
            </div>
        );
    }

    const mediaList = config?.media || [];

    // Build display slots array - always 6 slots
    const filledSlots: DisplaySlot[] = [];
    for (let i = 0; i < 6; i++) {
        if (i < displaySlots.length) {
            filledSlots.push(displaySlots[i]);
        } else {
            filledSlots.push({
                counter_id: -999 - i,
                counter_name: '',
                serving_ticket: null,
            });
        }
    }

    const getCounterDisplay = (counterName: string) => {
        if (!counterName) return '';
        const match = counterName.match(/\d+$/);
        return match ? match[0] : '';
    };

    return (
        <div className={`relative h-screen w-screen overflow-hidden font-sans bg-slate-900`}>
            {/* Background Image Layer */}
            <div
                className="absolute inset-0 z-0"
                style={{
                    backgroundImage: "url('/assets/bg-eboard.jpg')",
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                }}
            />

            {/* Color Overlay Layer */}
            {/* <div className="absolute inset-0 z-0 bg-blue-950/90 backdrop-blur-[2px]"></div> */}

            {/* Main Content Container */}
            <div className={`relative z-10 h-full w-full flex flex-col transition-all duration-300 ${hasStarted ? '' : 'opacity-40 blur-[1px]'} `}>
                {/* HEADER BAR */}
                <div className="h-[12%] flex-shrink-0 z-50">
                    <HeaderBoard
                        officeName={config.office_name || config.TransactionOffice.name}
                        logoUrl="/assets/vndc-logo.png"
                    />
                </div>

                {/* MAIN BODY */}
                <div className="flex-1 flex gap-8 p-8 overflow-hidden h-[88%]">
                    {/* LEFT COLUMN - Serving List (30%) */}
                    <div className="w-[30%] flex flex-col h-full rounded-2xl overflow-hidden shadow-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                        {/* Column Header */}
                        <div className="bg-blue-800 py-5 px-6 shadow-lg z-10 rounded-t-xl">
                            <h2 className="text-2xl font-black text-white text-center uppercase tracking-wider flex items-center justify-center gap-3">
                                DANH SÁCH GỌI SỐ
                            </h2>
                        </div>

                        {/* Slot Container */}
                        <div className="flex-1 flex flex-col p-4 gap-3 overflow-hidden bg-slate-800/80">
                            {filledSlots.map((slot, index) => (
                                <TicketRowItem
                                    key={index}
                                    counterCode={getCounterDisplay(slot.counter_name) || String(index + 1).padStart(2, '0')}
                                    ticketNumber={slot.serving_ticket || ''}
                                    className="flex-1"
                                />
                            ))}
                        </div>
                    </div>

                    {/* RIGHT COLUMN - Media & Footer (70%) */}
                    <div className="w-[70%] flex flex-col gap-6 h-full">
                        {/* Media Section */}
                        <div className="flex-1 relative rounded-3xl overflow-hidden shadow-2xl bg-black border border-gray-800">
                            <MediaContainer mediaFiles={mediaList} />
                        </div>

                        {/* Footer Banner */}
                        <div className={`h-[18%] rounded-3xl flex items-center justify-center px-10 shadow-2xl transition-all duration-500 overflow-hidden relative ${showPopup ? 'bg-gradient-to-t from-blue-600 to-blue-600 animate-pulse' : 'bg-gradient-to-r from-blue-900 to-blue-800'
                            }`}>
                            {/* Background Decor */}
                            <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>

                            {lastCalledTicket ? (
                                <div className="relative z-10 flex items-center justify-around w-full max-w-5xl">
                                    {/* Ticket Info */}
                                    <div className="flex items-center gap-4">
                                        <span className="text-3xl font-bold text-blue-100 uppercase tracking-wide opacity-80">Mời số</span>
                                        <div className="bg-white/10 px-6 py-2 rounded-xl backdrop-blur-md border border-white/20">
                                            <span className="text-6xl font-black text-white tracking-widest leading-none">
                                                {lastCalledTicket.ticket_number}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Arrow/Icon */}
                                    <MoveRight className="w-12 h-12 text-white" />

                                    {/* Counter Info */}
                                    <div className="flex items-center gap-4">
                                        <span className="text-3xl font-bold text-blue-100 uppercase tracking-wide opacity-80">Đến quầy</span>
                                        <div className="bg-white px-6 py-2 rounded-xl shadow-lg">
                                            <span className="text-6xl font-black text-blue-900 tracking-widest leading-none">
                                                {lastCalledTicket.counter_code.replace(/\D/g, '')}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-6 opacity-80">
                                    <Bell className="w-16 h-16 text-white animate-pulse" />
                                    <span className="text-4xl text-white font-bold tracking-widest uppercase">Đang chờ lượt gọi mới...</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Ticket Call Popup Overlay */}
                {popupData && (
                    <TicketCallPopup
                        isVisible={showPopup}
                        ticketNumber={popupData.ticket_number}
                        counterName={popupData.counter_code}
                    />
                )}
            </div>

            {!hasStarted && (
                <div
                    className="absolute inset-0 z-[9999] bg-slate-900/95 flex items-center justify-center px-6"
                    onClick={handleStartDisplay}
                >
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleStartDisplay();
                        }}
                        className="group flex flex-col items-center justify-center gap-5 rounded-3xl border border-white/20 bg-white/5 px-10 py-12 text-white backdrop-blur-md shadow-2xl transition hover:bg-white/10 hover:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/60"
                    >
                        <PlayCircle className="w-24 h-24 text-cyan-300 group-hover:scale-105 transition-transform" />
                        <span className="text-3xl md:text-4xl font-black tracking-wide text-center uppercase">
                            BẤM VÀO ĐÂY ĐỂ BẮT ĐẦU HIỂN THỊ
                        </span>
                        <span className="text-base md:text-lg text-slate-300 text-center">
                            Nhấn để kích hoạt toàn màn hình và bắt đầu chế độ TV
                        </span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default BoardDisplayPage;
