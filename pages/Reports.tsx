import React, { useState, useEffect } from 'react';
import { Card, Button, Input } from '../components/UIComponents';
import { Download, Search, Filter, FileSpreadsheet, Loader } from 'lucide-react';
import DatePicker from 'react-datepicker';
import { vi } from 'date-fns/locale';
import 'react-datepicker/dist/react-datepicker.css';
import api from '../services/api';

interface TransactionReport {
  no: number;
  office_name: string;
  counter_name: string;
  employee_name: string;
  job_title: string;
  service_name: string;
  ticket_number: string;
  ticket_type: string;
  print_date: string;
  print_time: string;
  called_at: string;
  waiting_time: string;
  waiting_status: string;
  finished_at: string;
  serving_time: string;
  status: string;
}

interface Office {
  id: number;
  code: string;
  name: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseLocalDate = (dateString: string): Date | null => {
  if (!dateString) return null;
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const Reports: React.FC = () => {
  const [reports, setReports] = useState<TransactionReport[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Filter states
  const [ticketNumber, setTicketNumber] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [officeId, setOfficeId] = useState('');

  // Pagination
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  });

  // Set default date range (current month)
  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    setFromDate(formatLocalDate(firstDay));
    setToDate(formatLocalDate(today));
  }, []);

  // Fetch offices
  useEffect(() => {
    fetchOffices();
  }, []);

  // Fetch reports when filters or pagination change
  useEffect(() => {
    if (fromDate && toDate) {
      fetchReports();
    }
  }, [fromDate, toDate, pagination.page, pagination.limit]);

  const fetchOffices = async () => {
    try {
      const response = await api.get('/transaction-offices');
      if (response.data.success) {
        setOffices(response.data.data || []);
      }
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 403) return;
      console.error('Error fetching offices:', error);
    }
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (fromDate) params.append('from_date', fromDate);
      if (toDate) params.append('to_date', toDate);
      if (officeId) params.append('office_id', officeId);
      if (ticketNumber) params.append('ticket_number', ticketNumber);

      const response = await api.get(`/reports/transactions?${params}`);

      if (response.data.success) {
        setReports(response.data.data);
        setPagination(response.data.pagination);
      }
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 403) return;
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchReports();
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.append('from_date', fromDate);
      if (toDate) params.append('to_date', toDate);
      if (officeId) params.append('office_id', officeId);
      if (ticketNumber) params.append('ticket_number', ticketNumber);

      const response = await api.get(`/reports/export?${params}`, {
        responseType: 'blob',
      });

      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BaoCaoGiaoDich_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 403) return;
      console.error('Error exporting reports:', error);
    } finally {
      setExporting(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'Hoàn thành': 'bg-green-100 text-green-800',
      'Đã hủy': 'bg-red-100 text-red-800',
      'Bỏ qua': 'bg-gray-100 text-gray-800',
      'Đang chờ': 'bg-blue-100 text-blue-800',
      'Đang phục vụ': 'bg-yellow-100 text-yellow-800',
    };
    return statusMap[status] || 'bg-gray-100 text-gray-800';
  };

  const getWaitingStatusClass = (status: string) => {
    if (status === 'Quá hạn') {
      return 'text-red-600 font-semibold bg-red-50 px-2 py-1 rounded';
    } else if (status === 'Cảnh báo') {
      return 'text-orange-600 font-semibold bg-orange-50 px-2 py-1 rounded';
    }
    return 'text-green-600 px-2 py-1 rounded';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Báo cáo & Thống kê</h1>
      </div>

      {/* Filter Section */}
      <Card>
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-gray-700 font-medium">
            <Filter size={20} />
            <h3>Bộ lọc</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Số vé
              </label>
              <Input
                placeholder="Tìm số vé..."
                value={ticketNumber}
                onChange={(e) => setTicketNumber(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Từ ngày
              </label>
              <DatePicker
                selected={parseLocalDate(fromDate)}
                onChange={(date: Date | null) => setFromDate(date ? formatLocalDate(date) : '')}
                dateFormat="dd/MM/yyyy"
                locale={vi}
                className="w-full border border-gray-300 rounded-md p-2"
                placeholderText="dd/mm/yyyy"
                maxDate={parseLocalDate(toDate) || undefined}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Đến ngày
              </label>
              <DatePicker
                selected={parseLocalDate(toDate)}
                onChange={(date: Date | null) => setToDate(date ? formatLocalDate(date) : '')}
                dateFormat="dd/MM/yyyy"
                locale={vi}
                className="w-full border border-gray-300 rounded-md p-2"
                placeholderText="dd/mm/yyyy"
                minDate={parseLocalDate(fromDate) || undefined}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phòng giao dịch
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={officeId}
                onChange={(e) => setOfficeId(e.target.value)}
              >
                <option value="">Tất cả</option>
                {offices.map((office) => (
                  <option key={office.id} value={office.id}>
                    {office.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="justify-end lg:col-span-2 flex items-end gap-2">
              <Button
                onClick={handleSearch}
                disabled={loading}
                className=" flex  items-center gap-2"
              >
                <Search size={16} />
                {loading ? 'Đang tìm...' : 'Tìm kiếm'}
              </Button>
              <Button
                variant="secondary"
                onClick={handleExport}
                disabled={exporting || reports.length === 0}
                title="Xuất Excel"
              >
                {exporting ? (
                  <Loader className="animate-spin" size={16} />
                ) : (
                  <FileSpreadsheet size={16} />
                )}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Data Table */}
      <Card>
        <div className="mb-4 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Hiển thị {reports.length > 0 ? ((pagination.page - 1) * pagination.limit + 1) : 0} - {Math.min(pagination.page * pagination.limit, pagination.total)} của {pagination.total} bản ghi
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Số dòng:</span>
            <select
              className="px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={pagination.limit}
              onChange={(e) => setPagination(prev => ({ ...prev, limit: parseInt(e.target.value), page: 1 }))}
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-blue-600 text-white sticky top-0 ">
                <th className="px-3 py-3 text-center text-xs font-semibold uppercase border border-blue-600 whitespace-nowrap min-w-[50px]">STT</th>
                <th className="px-3 py-3 text-center text-xs font-semibold uppercase border border-blue-600 whitespace-nowrap min-w-[120px]">Phòng giao dịch</th>
                <th className="px-3 py-3 text-center text-xs font-semibold uppercase border border-blue-600 whitespace-nowrap min-w-[80px]">Quầy</th>
                <th className="px-3 py-3 text-center text-xs font-semibold uppercase border border-blue-600 whitespace-nowrap min-w-[150px]">Nhân viên</th>
                <th className="px-3 py-3 text-center text-xs font-semibold uppercase border border-blue-600 whitespace-nowrap min-w-[100px]">Chức danh</th>
                <th className="px-3 py-3 text-center text-xs font-semibold uppercase border border-blue-600 whitespace-nowrap min-w-[200px]">Dịch vụ</th>
                <th className="px-3 py-3 text-center text-xs font-semibold uppercase border border-blue-600 whitespace-nowrap min-w-[60px]">Số vé</th>
                <th className="px-3 py-3 text-center text-xs font-semibold uppercase border border-blue-600 whitespace-nowrap min-w-[70px]">Loại vé</th>
                <th className="px-3 py-3 text-center text-xs font-semibold uppercase border border-blue-600 whitespace-nowrap min-w-[80px]">Ngày in</th>
                <th className="px-3 py-3 text-center text-xs font-semibold uppercase border border-blue-600 whitespace-nowrap min-w-[80px]">Giờ in</th>
                <th className="px-3 py-3 text-center text-xs font-semibold uppercase border border-blue-600 whitespace-nowrap min-w-[80px]">Giờ gọi</th>
                <th className="px-3 py-3 text-center text-xs font-semibold uppercase border border-blue-600 whitespace-nowrap min-w-[100px]">Thời gian chờ</th>
                <th className="px-3 py-3 text-center text-xs font-semibold uppercase border border-blue-600 whitespace-nowrap min-w-[110px]">Trạng thái chờ</th>
                <th className="px-3 py-3 text-center text-xs font-semibold uppercase border border-blue-600 whitespace-nowrap min-w-[100px]">Giờ kết thúc</th>
                <th className="px-3 py-3 text-center text-xs font-semibold uppercase border border-blue-600 whitespace-nowrap min-w-[100px]">Thời gian phục vụ</th>
                <th className="px-3 py-3 text-center text-xs font-semibold uppercase border border-blue-600 whitespace-nowrap min-w-[100px]">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={15} className="px-4 py-8 text-center text-gray-500">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={15} className="px-4 py-8 text-center text-gray-500">
                    Không có dữ liệu
                  </td>
                </tr>
              ) : (
                reports.map((report, index) => (
                  <tr
                    key={index}
                    className={`border-b hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                  >
                    <td className="px-3 py-2 text-sm border whitespace-nowrap">{report.no}</td>
                    <td className="px-3 py-2 text-sm border whitespace-nowrap">{report.office_name}</td>
                    <td className="px-3 py-2 text-sm border whitespace-nowrap">{report.counter_name}</td>
                    <td className="px-3 py-2 text-sm border whitespace-nowrap">{report.employee_name}</td>
                    <td className="px-3 py-2 text-sm border whitespace-nowrap">{report.job_title}</td>
                    <td className="px-3 py-2 text-sm border whitespace-nowrap">{report.service_name}</td>
                    <td className="px-3 py-2 text-sm font-semibold text-blue-600 border whitespace-nowrap">{report.ticket_number}</td>
                    <td className="px-3 py-2 text-sm border whitespace-nowrap">{report.ticket_type}</td>
                    <td className="px-3 py-2 text-sm border whitespace-nowrap">{report.print_date}</td>
                    <td className="px-3 py-2 text-sm border whitespace-nowrap">{report.print_time}</td>
                    <td className="px-3 py-2 text-sm border whitespace-nowrap">{report.called_at}</td>
                    <td className="px-3 py-2 text-sm border whitespace-nowrap">{report.waiting_time}</td>
                    <td className={`px-3 py-2 text-sm border whitespace-nowrap ${getWaitingStatusClass(report.waiting_status)}`}>
                      {report.waiting_status}
                    </td>
                    <td className="px-3 py-2 text-sm border whitespace-nowrap">{report.finished_at}</td>
                    <td className="px-3 py-2 text-sm border whitespace-nowrap">{report.serving_time}</td>
                    <td className="px-3 py-2 text-sm border whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(report.status)}`}>
                        {report.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="mt-4 flex justify-between items-center">
            <Button
              variant="secondary"
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              disabled={pagination.page === 1 || loading}
            >
              Trang trước
            </Button>
            <span className="text-sm text-gray-600">
              Trang {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              variant="secondary"
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              disabled={pagination.page === pagination.totalPages || loading}
            >
              Trang sau
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Reports;
