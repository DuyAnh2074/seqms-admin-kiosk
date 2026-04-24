import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../services/api';

interface AnalyticsData {
  pie_transaction_status: { name: string; value: number }[];
  bar_ticket_trends: Array<{ name: string;[key: string]: any }>;
  bar_counter_monthly: { name: string; value: number }[];
  bar_counter_quarterly: { name: string; value: number }[];
  ticket_status_summary: { waiting: number; completed: number; cancelled: number };
  total_transactions_all_time?: number;
}

interface LoadingState {
  pie_transaction_status: boolean;
  bar_ticket_trends: boolean;
  bar_counter_monthly: boolean;
  bar_counter_quarterly: boolean;
}

// Modern Professional Color Palette
const COLOR_PALETTE = {
  primary: '#3B82F6',      // Blue
  success: '#10B981',      // Emerald
  warning: '#F59E0B',      // Amber
  danger: '#EF4444',       // Red
  purple: '#8B5CF6',       // Purple
  cyan: '#06B7DB',         // Cyan
  accent: '#EC4899',       // Pink
};

const COLORS_PIE = [COLOR_PALETTE.danger, COLOR_PALETTE.success];
const COLORS_BAR = [COLOR_PALETTE.primary, COLOR_PALETTE.cyan, COLOR_PALETTE.warning, COLOR_PALETTE.success, COLOR_PALETTE.purple];
const COLORS_BAR_LIGHT = COLOR_PALETTE.primary;
const COLORS_BAR_EMERALD = COLOR_PALETTE.success;

// Status-based color mapping for pie chart
const STATUS_COLORS: { [key: string]: string } = {
  'Hoàn thành': COLOR_PALETTE.success,  // Green for completed
  'Hủy': COLOR_PALETTE.danger,          // Red for cancelled
};

// ==================== CUSTOM COMPONENTS ====================

/**
 * Custom Tooltip for Charts - Modern styling with shadow and rounded corners
 */
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white px-4 py-3 rounded-lg shadow-lg border border-gray-300">
        <p className="font-semibold text-md">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color }} className="text-md">
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

/**
 * Reusable DashboardCard Component - Modern clean design
 */
interface DashboardCardProps {
  title: string;
  description?: string;
  isLoading: boolean;
  hasError: boolean;
  isEmpty: boolean;
  children: React.ReactNode;
}

const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  description,
  isLoading,
  hasError,
  isEmpty,
  children,
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300 p-6 border border-gray-100">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
      </div>

      <div className="h-80 w-full">
        {isLoading ? (
          <SkeletonLoader />
        ) : hasError ? (
          <EmptyState message="Lỗi khi tải dữ liệu" />
        ) : isEmpty ? (
          <EmptyState message="Không có dữ liệu" />
        ) : (
          children
        )}
      </div>
    </div>
  );
};

/**
 * Summary Card Component - KPI metrics display
 */
interface SummaryCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  bgColor: string;
  textColor: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  title,
  value,
  icon,
  bgColor,
  textColor,
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 p-6 border border-gray-100">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-2">{title}</p>
          <p className={`text-3xl font-bold ${textColor}`}>{value}</p>
        </div>
        <div className={`${bgColor} p-4 rounded-lg flex items-center justify-center`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

// ==================== UTILITY FUNCTIONS ====================

// Skeleton Loading Component
const SkeletonLoader = () => (
  <div className="h-full w-full bg-gradient-to-r from-gray-100 to-gray-50 animate-pulse rounded-lg" />
);

// Empty State Component
const EmptyState = ({ message = 'Không có dữ liệu' }: { message?: string }) => (
  <div className="h-full w-full flex flex-col items-center justify-center text-gray-400">
    <AlertCircle size={40} className="mb-3 opacity-50" />
    <span className="text-sm">{message}</span>
  </div>
);

// Get grouped data keys for bar chart
const getGroupKeys = (data: Array<{ name: string;[key: string]: any }>) => {
  if (data.length === 0) return [];
  const allKeys = new Set<string>();
  data.forEach(item => {
    Object.keys(item).forEach(key => {
      if (key !== 'name') {
        allKeys.add(key);
      }
    });
  });
  return Array.from(allKeys);
};

// Calculate total from pie chart data
const calculateTotal = (data: { name: string; value: number }[]) => {
  return data.reduce((sum, item) => sum + item.value, 0);
};

// ==================== MAIN DASHBOARD COMPONENT ====================

const Dashboard: React.FC = () => {
  const [data, setData] = useState<AnalyticsData>({
    pie_transaction_status: [],
    bar_ticket_trends: [],
    bar_counter_monthly: [],
    bar_counter_quarterly: [],
    ticket_status_summary: { waiting: 0, completed: 0, cancelled: 0 },
  });

  const [loading, setLoading] = useState<LoadingState>({
    pie_transaction_status: true,
    bar_ticket_trends: true,
    bar_counter_monthly: true,
    bar_counter_quarterly: true,
  });

  const [error, setError] = useState<LoadingState>({
    pie_transaction_status: false,
    bar_ticket_trends: false,
    bar_counter_monthly: false,
    bar_counter_quarterly: false,
  });

  // Month filter state in YYYY-MM format
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  });

  // Extract month and year from selectedDate
  const selectedMonth = parseInt(selectedDate.split('-')[1]);
  const selectedYear = parseInt(selectedDate.split('-')[0]);

  useEffect(() => {
    fetchAnalytics();
  }, [selectedDate]);

  const fetchAnalytics = async () => {
    try {
      setLoading({
        pie_transaction_status: true,
        bar_ticket_trends: true,
        bar_counter_monthly: true,
        bar_counter_quarterly: true,
      });
      setError({
        pie_transaction_status: false,
        bar_ticket_trends: false,
        bar_counter_monthly: false,
        bar_counter_quarterly: false,
      });

      const response = await api.get('/dashboard/analytics', {
        params: {
          month: selectedMonth,
          year: selectedYear,
        },
      });

      if (response.data.success) {
        setData(response.data.data);
      }
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) return;
      console.error('Failed to fetch analytics:', err);
      setError({
        pie_transaction_status: true,
        bar_ticket_trends: true,
        bar_counter_monthly: true,
        bar_counter_quarterly: true,
      });
    } finally {
      setLoading({
        pie_transaction_status: false,
        bar_ticket_trends: false,
        bar_counter_monthly: false,
        bar_counter_quarterly: false,
      });
    }
  };

  // Calculate summary data from charts
  const pieTotal = calculateTotal(data.pie_transaction_status);
  const completedCount = data.ticket_status_summary?.completed || 0;
  const waitingCount = data.ticket_status_summary?.waiting || 0;
  const cancelledCount = data.ticket_status_summary?.cancelled || 0;
  const barTicketsTotal = data.total_transactions_all_time || 0; // Use total_transactions_all_time
  const counterMonthlyTotal = data.bar_counter_monthly.reduce((sum, item) => sum + (item.value || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-50 p-6 lg:p-8">
      {/* Header Section with Month Filter */}
      <div className="mb-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Bảng Điều Khiển</h1>
          <p className="text-gray-600">Tổng quan hệ thống xếp hàng và quản lý dịch vụ</p>
        </div>

        {/* Month Filter */}
        <div className="flex items-center gap-2">
          <label htmlFor="month-filter" className="text-sm font-medium text-gray-700">
            Chọn tháng:
          </label>
          <input
            id="month-filter"
            type="month"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Summary Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <SummaryCard
          title="Tổng Giao Dịch"
          value={barTicketsTotal}
          icon={<TrendingUp size={24} className="text-blue-600" />}
          bgColor="bg-blue-100"
          textColor="text-blue-600"
        />
        <SummaryCard
          title="Đã Hoàn Tất"
          value={completedCount}
          icon={<CheckCircle size={24} className="text-green-600" />}
          bgColor="bg-green-100"
          textColor="text-green-600"
        />
        <SummaryCard
          title="Vé Đang Đợi"
          value={waitingCount}
          icon={<Clock size={24} className="text-amber-600" />}
          bgColor="bg-amber-100"
          textColor="text-amber-600"
        />
        <SummaryCard
          title="Vé Đã Hủy"
          value={cancelledCount}
          icon={<AlertCircle size={24} className="text-red-600" />}
          bgColor="bg-red-100"
          textColor="text-red-600"
        />
      </div>

      {/* Charts Grid - 2x2 Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Chart 1: Transaction Status (Donut Chart) */}
        <DashboardCard
          title="Thống Kê Giao Dịch"
          description={`Tháng ${selectedMonth} năm ${selectedYear}`}
          isLoading={loading.pie_transaction_status}
          hasError={error.pie_transaction_status}
          isEmpty={data.pie_transaction_status.length === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.pie_transaction_status}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                fill="#8884d8"
                paddingAngle={3}
                dataKey="value"
                label={(entry) => entry.value > 0 ? `${entry.name}: ${entry.value}` : ''}
              >
                {data.pie_transaction_status.map((entry) => (
                  <Cell key={`cell-${entry.name}`} fill={STATUS_COLORS[entry.name] || COLOR_PALETTE.warning} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                wrapperStyle={{ paddingTop: '20px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </DashboardCard>

        {/* Chart 2: Ticket Trends (Grouped Bar) */}
        <DashboardCard
          title="Thống Kê Vé Theo Nhóm Dịch Vụ"
          description={`Tháng ${selectedMonth} năm ${selectedYear}`}
          isLoading={loading.bar_ticket_trends}
          hasError={error.bar_ticket_trends}
          isEmpty={data.bar_ticket_trends.length === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.bar_ticket_trends}
              margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e5e7eb"
              />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                fontSize={12}
                stroke="#9ca3af"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                stroke="#9ca3af"
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f3f4f6' }} />
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                wrapperStyle={{ paddingBottom: '10px' }}
              />
              {getGroupKeys(data.bar_ticket_trends).map((key, index) => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={COLORS_BAR[index % COLORS_BAR.length]}
                  barSize={40}
                  radius={[6, 6, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </DashboardCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 3: Counter Monthly (Simple Bar) */}
        <DashboardCard
          title="Hiệu Suất Quầy (Tháng)"
          description={`Tháng ${selectedMonth} năm ${selectedYear}`}
          isLoading={loading.bar_counter_monthly}
          hasError={error.bar_counter_monthly}
          isEmpty={data.bar_counter_monthly.length === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.bar_counter_monthly}
              margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e5e7eb"
              />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                fontSize={12}
                stroke="#9ca3af"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                stroke="#9ca3af"
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f3f4f6' }} />
              <Bar
                name="Số vé"
                dataKey="value"
                fill={COLORS_BAR_LIGHT}
                barSize={45}
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </DashboardCard>

        {/* Chart 4: Counter Quarterly (Simple Bar) */}
        <DashboardCard
          title="Hiệu Suất Quầy (Quý)"
          description={`Quý ${Math.ceil(selectedMonth / 3)} năm ${selectedYear}`}
          isLoading={loading.bar_counter_quarterly}
          hasError={error.bar_counter_quarterly}
          isEmpty={data.bar_counter_quarterly.length === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.bar_counter_quarterly}
              margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e5e7eb"
              />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                fontSize={12}
                stroke="#9ca3af"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                stroke="#9ca3af"
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f3f4f6' }} />
              <Bar
                name="Số vé"
                dataKey="value"
                fill={COLORS_BAR_EMERALD}
                barSize={45}
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </DashboardCard>
      </div>
    </div>
  );
};

export default Dashboard;
