import React, { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Users, Clock, CheckCircle, XCircle, Activity, Calendar, Building2 } from 'lucide-react';
import { Card } from '../components/UIComponents';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../services/api';

// Types
interface Stats {
    waiting: number;
    serving: number;
    completed: number;
    cancelled: number;
    skipped: number;
    total: number;
    avg_waiting_seconds: number;
}

interface OfficeConfig {
    warning_minutes?: number;
    overdue_minutes?: number;
}

interface Ticket {
    id: number;
    ticket_number: string;
    ticket_type: string;
    status: string;
    service_name: string;
    counter_name: string;
    staff_name: string;
    printed_at: string;
    called_at: string | null;
    started_at: string | null;
    finished_at?: string | null;
    waiting_time?: number;
    serving_time?: number;
}

interface CounterSession {
    id: number;
    user_id: number;
    staff_name: string;
    counter_id: number;
    counter_name: string;
    counter_code: string;
    login_time: string;
    status: string;
    total_served: number;
    avg_waiting_time: number;
}

// Wait Timer Component (reuse from CounterLive)
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

    const minutes = Math.floor(elapsed / 60);
    const seconds = Math.floor(elapsed % 60);
    const color = minutes > 30 ? 'text-red-600' : minutes > 15 ? 'text-orange-600' : 'text-gray-700';

    return <span className={`font-semibold ${color}`}>{minutes}:{seconds.toString().padStart(2, '0')}</span>;
};

// Stat Card Component
const StatCard: React.FC<{
    title: string;
    value: number;
    icon: React.ReactNode;
    color: string;
}> = ({ title, value, icon, color }) => (
    <Card className="p-6">
        <div className="flex items-center justify-between">
            <div>
                <p className="text-sm text-gray-600 mb-1">{title}</p>
                <p className={`text-3xl font-bold ${color}`}>{value}</p>
            </div>
            <div className={`w-12 h-12 rounded-full ${color.replace('text-', 'bg-').replace('-600', '-100')} flex items-center justify-center`}>
                {icon}
            </div>
        </div>
    </Card>
);

// Helper function to format duration in mm:ss
const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Helper function to get color class based on wait time and office config
const getWaitTimeColorClass = (seconds: number): string => {
    const minutes = seconds / 60;
    const warningMins = 10;
    const overdueMins = 30;

    if (minutes < warningMins) return 'text-green-600';
    if (minutes <= overdueMins) return 'text-orange-500';
    return 'text-red-600';
};

// Main Component
const MonitorLive: React.FC = () => {
    const [stats, setStats] = useState<Stats>({
        waiting: 0,
        serving: 0,
        completed: 0,
        cancelled: 0,
        skipped: 0,
        total: 0,
        avg_waiting_seconds: 0,
    });
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [counterSessions, setCounterSessions] = useState<CounterSession[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [socketConnected, setSocketConnected] = useState(false);
    const [officeConfig, setOfficeConfig] = useState<OfficeConfig>({
        warning_minutes: 10,
        overdue_minutes: 30,
    });
    const [officeName, setOfficeName] = useState<string>('');
    const socketRef = useRef<Socket | null>(null);

    // Get office ID from localStorage or session
    const sessionToken = localStorage.getItem('counterSessionToken');
    const storedOfficeId = localStorage.getItem('userOfficeId') || localStorage.getItem('officeId');
    const [officeId, setOfficeId] = useState<string>(storedOfficeId || '2'); // Default to 2 based on DB
    const hasInitialFetch = useRef(false);

    // Fetch office ID from session if available
    useEffect(() => {
        const fetchOfficeFromSession = async () => {
            if (sessionToken && !storedOfficeId) {
                try {
                    const response = await api.get('/counter-live/session-info', {
                        headers: { 'x-session-token': sessionToken },
                    });
                    if (response.data.success && response.data.data?.transaction_office_id) {
                        setOfficeId(response.data.data.transaction_office_id.toString());
                        localStorage.setItem('userOfficeId', response.data.data.transaction_office_id.toString());
                    }
                } catch (err: any) {
                    console.error('Failed to fetch office from session:', err);
                    if (err.response?.status === 401 || err.response?.status === 403) {
                        return;
                    }
                }
            }
        };
        fetchOfficeFromSession();
    }, [sessionToken, storedOfficeId]);

    // Fetch statistics
    const fetchStats = useCallback(async () => {
        try {
            const response = await api.get('/monitor/stats', {
                params: { transaction_office_id: officeId }
            });

            if (response.data.success) {
                setStats(response.data.data);
            } else {
                setError(response.data.message || 'Failed to fetch stats');
            }
        } catch (err: any) {
            console.error('Fetch stats error:', err);
            setError(err.response?.data?.message || err.message || 'Network error');
            if (err.response?.status === 401 || err.response?.status === 403) {
                return;
            }
        }
    }, [officeId]);

    // Fetch office configuration
    const fetchOfficeConfig = useCallback(async () => {
        try {
            const response = await api.get(`/officeconfig/${officeId}`);

            if (response.data.success && response.data.data) {
                setOfficeConfig({
                    warning_minutes: response.data.data.warning_minutes || 10,
                    overdue_minutes: response.data.data.overdue_minutes || 30,
                });
            }
        } catch (err: any) {
            console.error('Fetch office config error:', err);
            if (err.response?.status === 401 || err.response?.status === 403) {
                return;
            }
            // Keep default values on error
        }
    }, [officeId]);

    // Fetch office name
    const fetchOfficeName = useCallback(async () => {
        try {
            const response = await api.get(`/transaction-offices/${officeId}`);

            if (response.data.success && response.data.data) {
                setOfficeName(response.data.data.name || `Chi nhánh ${officeId}`);
            }
        } catch (err: any) {
            console.error('Fetch office name error:', err);
            setOfficeName(`Chi nhánh ${officeId}`);
            if (err.response?.status === 401 || err.response?.status === 403) {
                return;
            }
        }
    }, [officeId]);

    // Fetch live list
    const fetchLiveList = useCallback(async () => {
        try {
            const response = await api.get('/monitor/live-list', {
                params: { transaction_office_id: officeId }
            });

            if (response.data.success) {
                setTickets(response.data.data);
            } else {
                setError(response.data.message || 'Failed to fetch live list');
            }
        } catch (err: any) {
            console.error('Fetch live list error:', err);
            setError(err.response?.data?.message || err.message || 'Network error');
            if (err.response?.status === 401 || err.response?.status === 403) {
                return;
            }
        }
    }, [officeId]);

    // Fetch counter sessions with avg_waiting_time
    const fetchCounterSessions = useCallback(async () => {
        try {
            const response = await api.get('/monitor/counter-sessions', {
                params: { transaction_office_id: officeId }
            });

            if (response.data.success) {
                setCounterSessions(response.data.data);
            }
        } catch (err: any) {
            console.error('Fetch counter sessions error:', err);
            if (err.response?.status === 401 || err.response?.status === 403) {
                return;
            }
        }
    }, [officeId]);

    // Fetch all data
    const fetchAllData = useCallback(async () => {
        setLoading(true);
        await Promise.all([fetchStats(), fetchLiveList(), fetchOfficeConfig(), fetchOfficeName(), fetchCounterSessions()]);
        setLoading(false);
    }, [fetchStats, fetchLiveList, fetchOfficeConfig, fetchOfficeName, fetchCounterSessions]);

    // Initial fetch - only once
    useEffect(() => {
        if (!hasInitialFetch.current) {
            hasInitialFetch.current = true;
            fetchAllData();
        }
    }, [fetchAllData]);

    // Setup Socket.IO
    useEffect(() => {
        const socket = io('http://localhost:5000', {
            transports: ['websocket', 'polling'],
            reconnection: true,
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('✅ Socket connected:', socket.id);
            setSocketConnected(true);

            // Join office room - FIXED: use join_office (with underscore) to match backend
            const roomId = `office-${officeId}`;
            socket.emit('join_office', { transaction_office_id: parseInt(officeId) });
        });

        socket.on('disconnect', () => {
            console.log('❌ Socket disconnected');
            setSocketConnected(false);
        });

        socket.on('joined-successfully', (data) => {
            console.log('✅ Successfully joined room:', data);
        });

        socket.on('error', (error) => {
            console.error('🔴 Socket error:', error);
        });

        // Listen for queue updates
        socket.on('queue-updated', (data) => {
            fetchStats();
            fetchLiveList();
            fetchCounterSessions();
        });

        // Listen for ticket called events
        socket.on('ticket-called', (data) => {
            fetchStats();
            fetchLiveList();
            fetchCounterSessions();
        });

        return () => {
            socket.off('connect');
            socket.off('disconnect');
            socket.off('joined-successfully');
            socket.off('error');
            socket.off('queue-updated');
            socket.off('ticket-called');
            socket.disconnect();
        };
    }, [officeId, fetchStats, fetchLiveList, fetchCounterSessions]);

    // Prepare chart data - only include entries with value > 0
    const chartData = [
        { name: 'Đang đợi', value: stats.waiting, color: '#3b82f6' },
        { name: 'Đang phục vụ', value: stats.serving, color: '#10b981' },
        { name: 'Hoàn thành', value: stats.completed, color: '#f59e0b' },
        { name: 'Đã hủy', value: stats.cancelled + stats.skipped, color: '#ef4444' },
    ].filter(item => item.value > 0);

    const barChartData = [
        { status: 'Đang đợi', count: stats.waiting },
        { status: 'Đang phục vụ', count: stats.serving },
        { status: 'Hoàn thành', count: stats.completed },
        { status: 'Đã hủy', count: stats.cancelled + stats.skipped },
    ];

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Main Content */}
            <div className="flex-1 p-6">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="mb-6 flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Giám sát trực tuyến (E-Monitor Live)</h1>
                            <div className="flex items-center gap-2">
                                <p className="text-sm text-gray-600">Dashboard theo thời gian thực</p>
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
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar size={16} />
                            <span>{new Date().toLocaleDateString('vi-VN')}</span>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                            {error}
                        </div>
                    )}

                    {/* Statistics Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                        <StatCard
                            title="Đang đợi"
                            value={stats.waiting}
                            icon={<Clock size={24} className="text-blue-600" />}
                            color="text-blue-600"
                        />
                        <StatCard
                            title="Đang phục vụ"
                            value={stats.serving}
                            icon={<Activity size={24} className="text-green-600" />}
                            color="text-green-600"
                        />
                        <StatCard
                            title="Hoàn thành"
                            value={stats.completed}
                            icon={<CheckCircle size={24} className="text-orange-600" />}
                            color="text-orange-600"
                        />
                        <StatCard
                            title="Đã hủy"
                            value={stats.cancelled + stats.skipped}
                            icon={<XCircle size={24} className="text-red-600" />}
                            color="text-red-600"
                        />
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                        {/* Bar Chart */}
                        <Card className="p-6">
                            <h3 className="text-lg font-semibold mb-4">Biểu đồ trạng thái</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={barChartData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="status" />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="count" fill="#212f46ff">
                                        {barChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </Card>

                        {/* Pie Chart */}
                        <Card className="p-6">
                            <h3 className="text-lg font-semibold mb-4">Tỷ lệ trạng thái</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={chartData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={(entry) => entry.value > 0 ? `${entry.name}: ${entry.value}` : ''}
                                        outerRadius={100}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </Card>
                    </div>

                    {/* Office Info */}
                    <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 flex items-center justify-between shadow-sm mb-6">
                        {/* Left: Branch Info */}
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
                                <Building2 size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800 text-lg">Chi nhánh: {officeName}</h3>
                                <p className="text-sm text-gray-500">{new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            </div>
                        </div>

                        {/* Center: Avg Waiting Time */}
                        <div className="flex flex-col items-center px-8 border-x border-blue-200">
                            <span className="text-sm text-gray-500 font-medium mb-1 flex items-center gap-2">
                                <Clock size={16} /> Thời gian đợi trung bình
                            </span>
                            <span className={`text-3xl font-bold ${getWaitTimeColorClass(stats.avg_waiting_seconds)}`}>
                                {formatDuration(stats.avg_waiting_seconds)}
                            </span>
                        </div>

                        {/* Right: Total Tickets */}
                        <div className="text-right">
                            <span className="text-sm text-gray-500 font-medium mb-1 flex items-center gap-2">Tổng số vé</span>
                            <span className="text-4xl font-bold text-blue-600">{stats.total}</span>
                        </div>
                    </div>

                    {/* Counter Sessions Table */}
                    <Card className="mb-6">
                        <div className="p-4 border-b border-purple-200 bg-purple-50">
                            <h3 className="text-lg font-semibold text-purple-700">Danh sách quầy / Nhân viên ({counterSessions.length})</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-purple-100 border-b border-purple-200 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-purple-700 uppercase">STT</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-purple-700 uppercase">Nhân viên</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-purple-700 uppercase">Quầy</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-purple-700 uppercase">Giờ bắt đầu</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-purple-700 uppercase">Số khách phục vụ</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-purple-700 uppercase">TG đợi trung bình</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {counterSessions.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-4 text-center text-gray-500">
                                                Không có nhân viên nào đang hoạt động
                                            </td>
                                        </tr>
                                    ) : (
                                        counterSessions.map((session, idx) => (
                                            <tr key={session.id} className="border-b hover:bg-purple-50">
                                                <td className="px-4 py-3 text-sm">{idx + 1}</td>
                                                <td className="px-4 py-3 text-sm font-semibold text-purple-600">{session.staff_name}</td>
                                                <td className="px-4 py-3 text-sm">{session.counter_name} <span className="text-gray-500">({session.counter_code})</span></td>
                                                <td className="px-4 py-3 text-sm">{new Date(session.login_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</td>
                                                <td className="px-4 py-3 text-sm font-semibold">{session.total_served}</td>
                                                <td className="px-4 py-3 text-sm">
                                                    <span className={`font-bold text-lg ${getWaitTimeColorClass(session.avg_waiting_time)}`}>
                                                        {formatDuration(session.avg_waiting_time)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    {/* Tickets Tables - Full width, stacked layout */}
                    <div className="space-y-6">

                        {/* 1. Đang đợi */}
                        <Card>
                            <div className="p-4 border-b border-blue-200 bg-blue-50">
                                <h3 className="text-lg font-semibold text-blue-700">Đang đợi ({tickets.filter(t => t.status === 'waiting').length})</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-blue-100 border-b border-blue-200 sticky top-0">
                                        <tr>
                                            <th className="px-2 py-2 text-left text-xs font-semibold text-blue-700 uppercase">STT</th>
                                            <th className="px-2 py-2 text-left text-xs font-semibold text-blue-700 uppercase">Số vé</th>
                                            <th className="px-2 py-2 text-left text-xs font-semibold text-blue-700 uppercase">Dịch vụ</th>
                                            <th className="px-2 py-2 text-left text-xs font-semibold text-blue-700 uppercase">Ngày in</th>
                                            <th className="px-2 py-2 text-left text-xs font-semibold text-blue-700 uppercase">Giờ in</th>
                                            <th className="px-2 py-2 text-left text-xs font-semibold text-blue-700 uppercase">Giờ gọi</th>
                                            <th className="px-2 py-2 text-left text-xs font-semibold text-blue-700 uppercase">Thời gian đợi</th>
                                            <th className="px-2 py-2 text-left text-xs font-semibold text-blue-700 uppercase">Trạng thái đợi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tickets.filter(t => t.status === 'waiting').length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="px-2 py-4 text-center text-gray-500">
                                                    Không có vé đang đợi
                                                </td>
                                            </tr>
                                        ) : (
                                            tickets
                                                .filter(t => t.status === 'waiting')
                                                .sort((a, b) => new Date(a.printed_at).getTime() - new Date(b.printed_at).getTime())
                                                .map((ticket, idx) => {
                                                    // Calculate wait time in minutes (from office config)
                                                    const waitMs = Date.now() - new Date(ticket.printed_at).getTime();
                                                    const waitMins = Math.floor(waitMs / 60000);
                                                    const warningMins = officeConfig.warning_minutes || 10;
                                                    const overdueMins = officeConfig.overdue_minutes || 30;

                                                    let waitStatus = 'Bình thường';
                                                    let statusColor = 'bg-green-200 text-green-800';

                                                    if (waitMins > overdueMins) {
                                                        waitStatus = 'Quá hạn';
                                                        statusColor = 'bg-red-200 text-red-800';
                                                    } else if (waitMins > warningMins) {
                                                        waitStatus = 'Cảnh báo';
                                                        statusColor = 'bg-orange-200 text-orange-800';
                                                    }

                                                    return (
                                                        <tr key={ticket.id} className="border-b hover:bg-blue-50">
                                                            <td className="px-2 py-2 text-xs">{idx + 1}</td>
                                                            <td className="px-2 py-2 text-xs font-bold text-blue-600">{ticket.ticket_number}</td>
                                                            <td className="px-2 py-2 text-xs">{ticket.service_name}</td>
                                                            <td className="px-2 py-2 text-xs">{new Date(ticket.printed_at).toLocaleDateString('vi-VN')}</td>
                                                            <td className="px-2 py-2 text-xs">{new Date(ticket.printed_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                                                            <td className="px-2 py-2 text-xs">{ticket.called_at ? new Date(ticket.called_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}</td>
                                                            <td className="px-2 py-2 text-xs">
                                                                <WaitTimer startTime={ticket.printed_at} />
                                                            </td>
                                                            <td className="px-2 py-2 text-xs">
                                                                <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor}`}>
                                                                    {waitStatus}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>

                        {/* 2. Đang phục vụ  */}
                        <Card>
                            <div className="p-4 border-b border-green-200 bg-green-50">
                                <h3 className="text-lg font-semibold text-green-700">Đang phục vụ ({tickets.filter(t => t.status === 'serving' || t.status === 'called').length})</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-green-100 border-b border-green-200 sticky top-0">
                                        <tr>
                                            <th className="px-2 py-2 text-left text-xs font-semibold text-green-700 uppercase">STT</th>
                                            <th className="px-2 py-2 text-left text-xs font-semibold text-green-700 uppercase">Số vé</th>
                                            <th className="px-2 py-2 text-left text-xs font-semibold text-green-700 uppercase">Dịch vụ</th>
                                            <th className="px-2 py-2 text-left text-xs font-semibold text-green-700 uppercase">Ngày in</th>
                                            <th className="px-2 py-2 text-left text-xs font-semibold text-green-700 uppercase">Giờ in</th>
                                            <th className="px-2 py-2 text-left text-xs font-semibold text-green-700 uppercase">Giờ gọi</th>
                                            <th className="px-2 py-2 text-left text-xs font-semibold text-green-700 uppercase">TG phục vụ</th>
                                            <th className="px-2 py-2 text-left text-xs font-semibold text-green-700 uppercase">Quầy</th>
                                            <th className="px-2 py-2 text-left text-xs font-semibold text-green-700 uppercase">Nhân viên</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tickets.filter(t => t.status === 'serving' || t.status === 'called').length === 0 ? (
                                            <tr>
                                                <td colSpan={9} className="px-2 py-4 text-center text-gray-500">
                                                    Không có vé đang phục vụ
                                                </td>
                                            </tr>
                                        ) : (
                                            tickets
                                                .filter(t => t.status === 'serving' || t.status === 'called')
                                                .map((ticket, idx) => (
                                                    <tr key={ticket.id} className="border-b hover:bg-green-50">
                                                        <td className="px-2 py-2 text-xs">{idx + 1}</td>
                                                        <td className="px-2 py-2 text-xs font-bold text-green-600">{ticket.ticket_number}</td>
                                                        <td className="px-2 py-2 text-xs">{ticket.service_name}</td>
                                                        <td className="px-2 py-2 text-xs">{new Date(ticket.printed_at).toLocaleDateString('vi-VN')}</td>
                                                        <td className="px-2 py-2 text-xs">{new Date(ticket.printed_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                                                        <td className="px-2 py-2 text-xs">{ticket.called_at ? new Date(ticket.called_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}</td>
                                                        <td className="px-2 py-2 text-xs">
                                                            <WaitTimer startTime={ticket.started_at || ticket.called_at} />
                                                        </td>
                                                        <td className="px-2 py-2 text-xs">{ticket.counter_name || '-'}</td>
                                                        <td className="px-2 py-2 text-xs">{ticket.staff_name || '-'}</td>
                                                    </tr>
                                                ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>

                        {/* 3. Đã hoàn thành */}
                        <Card>
                            <div className="p-4 border-b border-orange-200 bg-orange-50">
                                <h3 className="text-lg font-semibold text-orange-700">Hoàn thành ({tickets.filter(t => t.status === 'completed').length})</h3>
                            </div>
                            <div className="overflow-x-auto max-h-96">
                                <table className="w-full text-sm">
                                    <thead className="bg-orange-100 border-b border-orange-200 sticky top-0">
                                        <tr>
                                            <th className="px-2 py-2 text-left text-xs font-semibold text-orange-700 uppercase">STT</th>
                                            <th className="px-2 py-2 text-left text-xs font-semibold text-orange-700 uppercase">Số vé</th>
                                            <th className="px-2 py-2 text-left text-xs font-semibold text-orange-700 uppercase">Dịch vụ</th>
                                            <th className="px-2 py-2 text-left text-xs font-semibold text-orange-700 uppercase">Ngày in</th>
                                            <th className="px-2 py-2 text-left text-xs font-semibold text-orange-700 uppercase">Giờ in</th>
                                            <th className="px-2 py-2 text-left text-xs font-semibold text-orange-700 uppercase">Giờ gọi</th>
                                            <th className="px-2 py-2 text-left text-xs font-semibold text-orange-700 uppercase">Giờ KT</th>
                                            <th className="px-2 py-2 text-left text-xs font-semibold text-orange-700 uppercase">TG phục vụ</th>
                                            <th className="px-2 py-2 text-left text-xs font-semibold text-orange-700 uppercase">Quầy</th>
                                            <th className="px-2 py-2 text-left text-xs font-semibold text-orange-700 uppercase">Nhân viên</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tickets.filter(t => t.status === 'completed').length === 0 ? (
                                            <tr>
                                                <td colSpan={10} className="px-2 py-4 text-center text-gray-500">
                                                    Không có vé đã hoàn thành
                                                </td>
                                            </tr>
                                        ) : (
                                            tickets
                                                .filter(t => t.status === 'completed')
                                                .sort((a, b) => new Date(b.finished_at || 0).getTime() - new Date(a.finished_at || 0).getTime())
                                                .slice(0, 50)
                                                .map((ticket, idx) => {
                                                    const waitSeconds = ticket.called_at && ticket.printed_at
                                                        ? Math.floor((new Date(ticket.called_at).getTime() - new Date(ticket.printed_at).getTime()) / 1000)
                                                        : 0;
                                                    const serveSeconds = ticket.started_at && ticket.finished_at
                                                        ? Math.floor((new Date(ticket.finished_at).getTime() - new Date(ticket.started_at).getTime()) / 1000)
                                                        : 0;
                                                    const serveMins = Math.floor(serveSeconds / 60);
                                                    const serveSecs = serveSeconds % 60;
                                                    return (
                                                        <tr key={ticket.id} className="border-b hover:bg-orange-50">
                                                            <td className="px-2 py-2 text-xs">{idx + 1}</td>
                                                            <td className="px-2 py-2 text-xs font-bold text-orange-600">{ticket.ticket_number}</td>
                                                            <td className="px-2 py-2 text-xs">{ticket.service_name}</td>
                                                            <td className="px-2 py-2 text-xs">{new Date(ticket.printed_at).toLocaleDateString('vi-VN')}</td>
                                                            <td className="px-2 py-2 text-xs">{new Date(ticket.printed_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                                                            <td className="px-2 py-2 text-xs">{ticket.called_at ? new Date(ticket.called_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}</td>
                                                            <td className="px-2 py-2 text-xs">{ticket.finished_at ? new Date(ticket.finished_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}</td>
                                                            <td className="px-2 py-2 text-xs">{serveMins}:{serveSecs.toString().padStart(2, '0')}</td>
                                                            <td className="px-2 py-2 text-xs">{ticket.counter_name || '-'}</td>
                                                            <td className="px-2 py-2 text-xs">{ticket.staff_name || '-'}</td>
                                                        </tr>
                                                    );
                                                })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>

                        {/* 4. Đã hủy - Bottom Right */}
                        <Card>
                            <div className="p-4 border-b border-red-200 bg-red-50">
                                <h3 className="text-lg font-semibold text-red-700">
                                    Đã hủy ({tickets.filter(t => t.status === 'cancelled' || t.status === 'skipped').length})
                                </h3>
                            </div>
                            <div className="overflow-x-auto max-h-96">
                                <table className="w-full text-sm">
                                    <thead className="bg-red-100 border-b border-red-200 sticky top-0">
                                        <tr>
                                            <th className="px-2 py-2 text-left text-xs font-semibold text-red-700 uppercase">STT</th>
                                            <th className="px-2 py-2 text-left text-xs font-semibold text-red-700 uppercase">Số vé</th>
                                            <th className="px-2 py-2 text-left text-xs font-semibold text-red-700 uppercase">Dịch vụ</th>
                                            <th className="px-2 py-2 text-left text-xs font-semibold text-red-700 uppercase">Ngày in</th>
                                            <th className="px-2 py-2 text-left text-xs font-semibold text-red-700 uppercase">Giờ in</th>
                                            <th className="px-2 py-2 text-left text-xs font-semibold text-red-700 uppercase">Giờ gọi</th>
                                            <th className="px-2 py-2 text-left text-xs font-semibold text-red-700 uppercase">Quầy</th>
                                            <th className="px-2 py-2 text-left text-xs font-semibold text-red-700 uppercase">Nhân viên</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tickets.filter(t => t.status === 'cancelled' || t.status === 'skipped').length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="px-2 py-4 text-center text-gray-500">
                                                    Không có vé đã hủy
                                                </td>
                                            </tr>
                                        ) : (
                                            tickets
                                                .filter(t => t.status === 'cancelled' || t.status === 'skipped')
                                                .map((ticket, idx) => (
                                                    <tr key={ticket.id} className="border-b hover:bg-red-50">
                                                        <td className="px-2 py-2 text-xs">{idx + 1}</td>
                                                        <td className="px-2 py-2 text-xs font-bold text-red-600">{ticket.ticket_number}</td>
                                                        <td className="px-2 py-2 text-xs">{ticket.service_name}</td>
                                                        <td className="px-2 py-2 text-xs">{new Date(ticket.printed_at).toLocaleDateString('vi-VN')}</td>
                                                        <td className="px-2 py-2 text-xs">{new Date(ticket.printed_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                                                        <td className="px-2 py-2 text-xs">{ticket.called_at ? new Date(ticket.called_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}</td>
                                                        <td className="px-2 py-2 text-xs">{ticket.counter_name || '-'}</td>
                                                        <td className="px-2 py-2 text-xs">{ticket.staff_name || '-'}</td>
                                                    </tr>
                                                ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MonitorLive;
