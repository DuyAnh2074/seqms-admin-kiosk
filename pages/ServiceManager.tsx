import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Input, Select, Tabs, Modal } from '../components/UIComponents';
import { Plus, Edit2, Check, X, Image as ImageIcon, CheckCircle, XCircle, Search, Ban, RefreshCw } from 'lucide-react';
import api from '../services/api';

const ACTION_ICON_VARIANTS: Record<string, string> = {
  neutral: 'border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700',
  edit: 'border border-blue-200 text-blue-600 hover:bg-blue-50',
  delete: 'border border-red-200 text-red-600 hover:bg-red-50',
  deactivate: 'border border-orange-200 text-orange-600 hover:bg-orange-50',
  reactivate: 'border border-green-200 text-green-600 hover:bg-green-50',
  confirm: 'border border-green-200 text-green-600 hover:bg-green-50',
};

const ActionIconButton = ({
  icon,
  title,
  onClick,
  variant = 'neutral',
}: {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  variant?: 'neutral' | 'edit' | 'delete' | 'deactivate' | 'reactivate' | 'confirm';
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`inline-flex h-9 w-9 items-center justify-center rounded-md text-sm transition-colors ${ACTION_ICON_VARIANTS[variant] || ACTION_ICON_VARIANTS.neutral}`}
  >
    {icon}
  </button>
);

const ServiceManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState('Mẫu Vé');
  const [viewMode, setViewMode] = useState<'list' | 'add' | 'edit'>('list');

  // Ticket Format State
  const [ticketFormats, setTicketFormats] = useState<any[]>([]);
  const [loadingFormats, setLoadingFormats] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: 'format' | 'service' | 'group';
    action: 'deactivate' | 'reactivate';
    id: number | null;
    itemData?: any;
  }>({
    isOpen: false,
    type: 'format',
    action: 'deactivate',
    id: null,
  });

  // Services State
  const [services, setServices] = useState<any[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);

  // Service Groups State
  const [serviceGroups, setServiceGroups] = useState<any[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([]);
  const [serviceSearchKeyword, setServiceSearchKeyword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Toast notifications
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'error' }>>([]);

  // Form State (shared for both Ticket Format and Services)
  const [formData, setFormData] = useState<any>({
    code: '',
    template_format: '',
    min_number: 1,
    max_number: 999,
    name: '',
    ticket_format_id: '',
    icon_url: '',
  });
  const [editingId, setEditingId] = useState<number | null>(null);

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

  // Fetch data based on active tab
  useEffect(() => {
    if (activeTab === 'Mẫu Vé') {
      fetchTicketFormats();
    } else if (activeTab === 'Dịch vụ') {
      fetchServices();
    } else if (activeTab === 'Nhóm Dịch vụ') {
      // Fetch both service groups and services (needed for checkboxes in form)
      fetchServiceGroups();
      fetchServices();
    }
  }, [activeTab]);

  // --- Ticket Format Functions ---
  const fetchTicketFormats = async () => {
    setLoadingFormats(true);
    try {
      const response = await api.get('/ticket-formats');
      const sortedData = (response.data.data || []).sort((a: any, b: any) => a.id - b.id);
      setTicketFormats(sortedData);
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 403) return;
      showToast(error.response?.data?.message || error.message || 'Lỗi khi tải mẫu vé', 'error');
      console.error('Error fetching ticket formats:', error);
    } finally {
      setLoadingFormats(false);
    }
  };

  const handleAddTicketFormat = async () => {
    if (!formData.code || !formData.template_format) {
      showToast('Mã và Định dạng Mẫu là bắt buộc', 'error');
      return;
    }

    if (formData.min_number >= formData.max_number) {
      showToast('Số bắt đầu phải nhỏ hơn số tối đa', 'error');
      return;
    }

    try {
      const payload = editingId
        ? {
          template_format: formData.template_format,
          min_number: formData.min_number,
          max_number: formData.max_number,
        }
        : {
          code: formData.code,
          template_format: formData.template_format,
          min_number: formData.min_number,
          max_number: formData.max_number,
        };

      if (editingId) {
        await api.put(`/ticket-formats/${editingId}`, payload);
      } else {
        await api.post('/ticket-formats', payload);
      }

      showToast(editingId ? 'Cập nhật thành công' : 'Thêm mới thành công', 'success');
      resetForm();
      setViewMode('list');
      fetchTicketFormats();
    } catch (error: any) {
      showToast(error.response?.data?.message || error.message || 'Lỗi khi lưu mẫu vé', 'error');
    }
  };

  const handleDeleteTicketFormat = (id: number) => {
    const format = ticketFormats.find(f => f.id === id);
    setDeleteModal({ isOpen: true, type: 'format', action: 'deactivate', id, itemData: format });
  };

  const handleReactivateTicketFormat = (id: number) => {
    const format = ticketFormats.find(f => f.id === id);
    setDeleteModal({ isOpen: true, type: 'format', action: 'reactivate', id, itemData: format });
  };

  const confirmDeleteTicketFormat = async () => {
    if (!deleteModal.id) return;
    setIsLoading(true);
    try {
      if (deleteModal.action === 'deactivate') {
        await api.delete(`/ticket-formats/${deleteModal.id}`);
        showToast('Vô hiệu hóa thành công', 'success');
      } else {
        await api.put(`/ticket-formats/${deleteModal.id}/reactivate`);
        showToast('Khôi phục thành công', 'success');
      }
      setDeleteModal({ isOpen: false, type: 'format', action: 'deactivate', id: null });
      fetchTicketFormats();
    } catch (error: any) {
      showToast(error.response?.data?.message || error.message || 'Lỗi khi xử lý mẫu vé', 'error');
      setDeleteModal({ isOpen: false, type: 'format', action: 'deactivate', id: null });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditTicketFormat = (format: any) => {
    setFormData({
      code: format.code,
      template_format: format.template_format,
      min_number: format.min_number,
      max_number: format.max_number,
      name: '',
      ticket_format_id: '',
      icon_url: '',
    });
    setEditingId(format.id);
    setViewMode('edit');
  };

  // --- Service Functions ---
  const fetchServices = async () => {
    setLoadingServices(true);
    try {
      const response = await api.get('/services');
      const sortedServices = (response.data.data || []).sort((a: any, b: any) => a.id - b.id);
      setServices(sortedServices);
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 403) return;
      showToast(error.response?.data?.message || error.message || 'Lỗi khi tải dịch vụ', 'error');
      console.error('Error fetching services:', error);
    } finally {
      setLoadingServices(false);
    }
  };

  const handleAddService = async () => {
    if (!formData.code || !formData.name) {
      showToast('Mã và Tên Dịch vụ là bắt buộc', 'error');
      return;
    }

    try {
      const payload = editingId
        ? {
          name: formData.name,
          ticket_format_id: formData.ticket_format_id || null,
          icon_url: formData.icon_url || null,
        }
        : {
          code: formData.code,
          name: formData.name,
          ticket_format_id: formData.ticket_format_id || null,
          icon_url: formData.icon_url || null,
        };

      if (editingId) {
        await api.put(`/services/${editingId}`, payload);
      } else {
        await api.post('/services', payload);
      }

      showToast(editingId ? 'Cập nhật thành công' : 'Thêm mới thành công', 'success');
      resetForm();
      setViewMode('list');
      fetchServices();
    } catch (error: any) {
      showToast(error.response?.data?.message || error.message || 'Lỗi khi lưu dịch vụ', 'error');
    }
  };

  const handleDeleteService = (id: number) => {
    const service = services.find(s => s.id === id);
    setDeleteModal({ isOpen: true, type: 'service', action: 'deactivate', id, itemData: service });
  };

  const handleReactivateService = (id: number) => {
    const service = services.find(s => s.id === id);
    setDeleteModal({ isOpen: true, type: 'service', action: 'reactivate', id, itemData: service });
  };

  const confirmDeleteService = async () => {
    if (!deleteModal.id) return;
    setIsLoading(true);
    try {
      if (deleteModal.action === 'deactivate') {
        await api.delete(`/services/${deleteModal.id}`);
        showToast('Vô hiệu hóa thành công', 'success');
      } else {
        await api.post(`/services/${deleteModal.id}/reactivate`);
        showToast('Khôi phục thành công', 'success');
      }
      setDeleteModal({ isOpen: false, type: 'service', action: 'deactivate', id: null });
      fetchServices();
    } catch (error: any) {
      let errorMessage = error.response?.data?.message || error.message || 'Lỗi khi xử lý dịch vụ';
      showToast(errorMessage, 'error');
      setDeleteModal({ isOpen: false, type: 'service', action: 'deactivate', id: null });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditService = (service: any) => {
    setFormData({
      code: service.code,
      name: service.name,
      ticket_format_id: service.ticket_format_id || '',
      icon_url: service.icon_url || '',
      template_format: '',
      min_number: 1,
      max_number: 999,
    });
    setEditingId(service.id);
    setViewMode('edit');
  };

  // --- Service Groups Functions ---
  const fetchServiceGroups = async () => {
    setLoadingGroups(true);
    try {
      const response = await api.get('/service-groups');
      const sortedData = (response.data.data || []).sort((a: any, b: any) => a.id - b.id);
      setServiceGroups(sortedData);
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 403) return;
      showToast(error.response?.data?.message || error.message || 'Lỗi khi tải nhóm dịch vụ', 'error');
      console.error('Error fetching service groups:', error);
    } finally {
      setLoadingGroups(false);
    }
  };

  const handleAddServiceGroup = async () => {
    // Validation: Check for required fields
    if (!formData.code) {
      showToast('Mã nhóm là bắt buộc', 'error');
      return;
    }

    if (!formData.name) {
      showToast('Tên nhóm là bắt buộc', 'error');
      return;
    }

    if (selectedServiceIds.length === 0) {
      showToast('Vui lòng chọn ít nhất 1 dịch vụ', 'error');
      return;
    }

    try {
      const payload = {
        code: formData.code,
        name: formData.name,
        icon_url: formData.icon_url || null,
        service_ids: selectedServiceIds,
      };

      if (editingId) {
        await api.put(`/service-groups/${editingId}`, payload);
      } else {
        await api.post('/service-groups', payload);
      }

      showToast(editingId ? 'Cập nhật thành công' : 'Thêm mới thành công', 'success');
      resetForm();
      setViewMode('list');
      fetchServiceGroups();
    } catch (error: any) {
      showToast(error.response?.data?.message || error.message || 'Lỗi khi lưu nhóm dịch vụ', 'error');
    }
  };

  const handleDeleteServiceGroup = (id: number) => {
    const group = serviceGroups.find(g => g.id === id);
    setDeleteModal({ isOpen: true, type: 'group', action: 'deactivate', id, itemData: group });
  };

  const handleReactivateServiceGroup = (id: number) => {
    const group = serviceGroups.find(g => g.id === id);
    setDeleteModal({ isOpen: true, type: 'group', action: 'reactivate', id, itemData: group });
  };

  const confirmDeleteServiceGroup = async () => {
    if (!deleteModal.id) return;
    setIsLoading(true);
    try {
      if (deleteModal.action === 'deactivate') {
        await api.delete(`/service-groups/${deleteModal.id}`);
        showToast('Vô hiệu hóa thành công', 'success');
      } else {
        await api.post(`/service-groups/${deleteModal.id}/reactivate`);
        showToast('Khôi phục thành công', 'success');
      }
      setDeleteModal({ isOpen: false, type: 'group', action: 'deactivate', id: null });
      fetchServiceGroups();
    } catch (error: any) {
      showToast(error.response?.data?.message || error.message || 'Lỗi khi xử lý nhóm dịch vụ', 'error');
      setDeleteModal({ isOpen: false, type: 'group', action: 'deactivate', id: null });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditServiceGroup = (group: any) => {
    setFormData({
      code: group.code,
      name: group.name,
      icon_url: group.icon_url || '',
      template_format: '',
      min_number: 1,
      max_number: 999,
    });
    setSelectedServiceIds(group.service_ids || []);
    setEditingId(group.id);
    setViewMode('edit');
  };

  // --- Helper Functions ---
  const handleSelectAllServices = () => {
    const visibleServices = services.filter((service) => {
      const inSearch =
        service.name.toLowerCase().includes(serviceSearchKeyword.toLowerCase()) ||
        service.code.toLowerCase().includes(serviceSearchKeyword.toLowerCase());
      const shouldDisplay = service.is_active || selectedServiceIds.includes(service.id);
      return inSearch && shouldDisplay;
    });

    const selectableServiceIds = visibleServices
      .filter(service => service.is_active)
      .map(service => service.id);

    if (selectableServiceIds.length === 0) return;

    const allSelectableSelected = selectableServiceIds.every(id => selectedServiceIds.includes(id));

    if (allSelectableSelected) {
      setSelectedServiceIds(prev => prev.filter(id => !selectableServiceIds.includes(id)));
    } else {
      setSelectedServiceIds(prev => Array.from(new Set([...prev, ...selectableServiceIds])));
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      template_format: '',
      min_number: 1,
      max_number: 999,
      name: '',
      ticket_format_id: '',
      icon_url: '',
    });
    setEditingId(null);
    setSelectedServiceIds([]);
    setServiceSearchKeyword('');
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN');
  };

  const formatCode = (code: string) => {
    if (!code) return '';
    return code.toLowerCase();
  };

  const getTicketFormatCode = (id: any) => {
    const format = ticketFormats.find(f => f.id === id);
    return format ? formatCode(format.code) : 'N/A';
  };


  // --- Ticket Format View ---
  const TicketFormatView = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Danh sách Mẫu Vé</h3>
        <Button
          size="sm"
          icon={<Plus size={16} />}
          onClick={() => {
            setFormData({ code: '', template_format: '', min_number: 1, max_number: 999 });
            setEditingId(null);
            setViewMode('add');
          }}
        >
          Thêm mới
        </Button>
      </div>
      {loadingFormats ? (
        <div className="text-center py-8 text-gray-500">Đang tải...</div>
      ) : (
        <Table
          data={ticketFormats.map(format => ({
            id: format.id,
            code: format.code,
            template_format: format.template_format,
            min_number: format.min_number,
            max_number: format.max_number,
            is_active: format.is_active,
            created_at: formatDate(format.created_at),
          }))}
          columns={[
            { header: 'Mã Mẫu', accessor: (item: any) => formatCode(item.code) },
            { header: 'Định dạng Mẫu', accessor: (item: any) => item.template_format },
            { header: 'Số Bắt đầu', accessor: (item: any) => item.min_number },
            { header: 'Số Tối đa', accessor: (item: any) => item.max_number },
            {
              header: 'Trạng thái',
              accessor: (item: any) =>
                item.is_active !== false ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Đang hoạt động
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    Đã vô hiệu hóa
                  </span>
                )
            },
            { header: 'Ngày Tạo', accessor: (item: any) => item.created_at },
          ]}
          actions={(item: any) => (
            <div className="flex justify-end gap-2">
              <ActionIconButton
                icon={<Edit2 size={16} />}
                title="Sửa"
                onClick={() => handleEditTicketFormat(item)}
                variant="edit"
              />
              {item.is_active !== false ? (
                <ActionIconButton
                  icon={<Ban size={16} />}
                  title="Vô hiệu hóa"
                  onClick={() => handleDeleteTicketFormat(item.id)}
                  variant="deactivate"
                />
              ) : (
                <ActionIconButton
                  icon={<RefreshCw size={16} />}
                  title="Khôi phục"
                  onClick={() => handleReactivateTicketFormat(item.id)}
                  variant="reactivate"
                />
              )}
            </div>
          )}
        />
      )}
    </div>
  );

  // --- Service View ---
  const ServiceView = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Danh sách Dịch vụ</h3>
        <Button
          size="sm"
          icon={<Plus size={16} />}
          onClick={() => {
            setFormData({
              code: '',
              name: '',
              ticket_format_id: '',
              icon_url: '',
              template_format: '',
              min_number: 1,
              max_number: 999,
            });
            setEditingId(null);
            setViewMode('add');
          }}
        >
          Thêm mới
        </Button>
      </div>
      {loadingServices ? (
        <div className="text-center py-8 text-gray-500">Đang tải...</div>
      ) : (
        <Table
          data={services.map(service => ({
            id: service.id,
            code: service.code,
            name: service.name,
            ticket_format_id: service.ticket_format_id,
            icon_url: service.icon_url,
            is_active: service.is_active,
            created_at: formatDate(service.created_at),
          }))}
          columns={[
            {
              header: 'Mã Dịch vụ',
              accessor: (item: any) => formatCode(item.code),
              className: 'w-40 min-w-[10rem]'
            },
            {
              header: 'Tên Dịch vụ',
              accessor: (item: any) => item.name,
              className: 'min-w-[16rem]'
            },
            {
              header: 'Mã Mẫu Vé',
              accessor: (item: any) => getTicketFormatCode(item.ticket_format_id),
              className: 'w-32'
            },
            {
              header: 'Trạng thái',
              accessor: (item: any) =>
                item.is_active !== false ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Đang hoạt động
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    Đã vô hiệu hóa
                  </span>
                ),
              className: 'w-44 min-w-[11rem]'
            },
            // {
            //   header: 'Ngày Tạo',
            //   accessor: (item: any) => item.created_at,
            //   className: 'w-32 min-w-[8rem]'
            // },
          ]}
          actions={(item: any) => (
            <div className="flex justify-end gap-2">
              <ActionIconButton
                icon={<Edit2 size={16} />}
                title="Sửa"
                onClick={() => handleEditService(item)}
                variant="edit"
              />
              {item.is_active !== false ? (
                <ActionIconButton
                  icon={<Ban size={16} />}
                  title="Vô hiệu hóa"
                  onClick={() => handleDeleteService(item.id)}
                  variant="deactivate"
                />
              ) : (
                <ActionIconButton
                  icon={<RefreshCw size={16} />}
                  title="Khôi phục"
                  onClick={() => handleReactivateService(item.id)}
                  variant="reactivate"
                />
              )}
            </div>
          )}
        />
      )}
    </div>
  );

  // --- Service Group View ---
  const ServiceGroupView = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Danh sách Nhóm Dịch vụ</h3>
        <Button
          size="sm"
          icon={<Plus size={16} />}
          onClick={() => {
            resetForm();
            setViewMode('add');
          }}
        >
          Thêm mới
        </Button>
      </div>
      {loadingGroups ? (
        <div className="text-center py-8 text-gray-500">Đang tải...</div>
      ) : (
        <Table
          data={serviceGroups.map(group => ({
            id: group.id,
            code: group.code,
            name: group.name,
            icon_url: group.icon_url,
            service_ids: group.service_ids || [],
            services: group.services || [],
            is_active: group.is_active,
            created_at: formatDate(group.created_at),
          }))}
          columns={[
            { header: 'Mã Nhóm', accessor: (item: any) => formatCode(item.code) },
            { header: 'Tên Nhóm', accessor: (item: any) => item.name },
            {
              header: 'Số Dịch vụ', accessor: (item: any) => {
                // Only count active services
                const activeServiceCount = (item.services || []).filter((s: any) => s.is_active !== false).length;
                return activeServiceCount;
              }
            },
            {
              header: 'Trạng thái',
              accessor: (item: any) =>
                item.is_active !== false ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Đang hoạt động
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    Đã vô hiệu hóa
                  </span>
                )
            },
            { header: 'Ngày Tạo', accessor: (item: any) => item.created_at },
          ]}
          actions={(item: any) => (
            <div className="flex justify-end gap-2">
              <ActionIconButton
                icon={<Edit2 size={16} />}
                title="Sửa"
                onClick={() => handleEditServiceGroup(item)}
                variant="edit"
              />
              {item.is_active !== false ? (
                <ActionIconButton
                  icon={<Ban size={16} />}
                  title="Vô hiệu hóa"
                  onClick={() => handleDeleteServiceGroup(item.id)}
                  variant="deactivate"
                />
              ) : (
                <ActionIconButton
                  icon={<RefreshCw size={16} />}
                  title="Khôi phục"
                  onClick={() => handleReactivateServiceGroup(item.id)}
                  variant="reactivate"
                />
              )}
            </div>
          )}
        />
      )}
    </div>
  );

  // --- Render Add/Edit Form ---
  const RenderAddForm = () => {
    const formKey = `form-${activeTab}-${editingId || 'new'}`;

    return (
      <div className="space-y-6 max-w-6xl" key={formKey}>
        <h3 className="text-lg font-bold">
          {activeTab === 'Mẫu Vé'
            ? (editingId ? 'Chỉnh sửa' : 'Thêm mới') + ' Mẫu Vé'
            : (editingId ? 'Chỉnh sửa' : 'Thêm mới') + ' ' + activeTab}
        </h3>

        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-1/2 flex flex-col gap-6">
            {activeTab === 'Mẫu Vé' && (
              <>
                <Input
                  key="code-input"
                  label="Mã Mẫu *"
                  value={formData.code}
                  disabled={editingId !== null}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="ví dụ: mau_a, mau_b"
                  className="py-2.5"
                />
                <Input
                  key="template-input"
                  label="Định dạng Mẫu *"
                  value={formData.template_format}
                  onChange={(e) => setFormData({ ...formData, template_format: e.target.value })}
                  placeholder="ví dụ: A%03d"
                  className="py-2.5"
                />
              </>
            )}

            {activeTab === 'Dịch vụ' && (
              <>
                <Input
                  key="svc-code-input"
                  label="Mã Dịch vụ *"
                  value={formData.code}
                  disabled={editingId !== null}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="ví dụ: dang-ky-tai-khoan"
                  className="py-2.5"
                />
                <Select
                  key="ticket-format-select"
                  label="Mẫu Vé *"
                  value={formData.ticket_format_id}
                  onChange={(e) => {
                    // Log ra để kiểm tra nếu vẫn lỗi
                    // console.log("Selected value:", e.target.value); 
                    setFormData({
                      ...formData,
                      ticket_format_id: e.target.value ? parseInt(e.target.value) : ''
                    });
                  }}
                  options={[
                    { label: '-- Chọn Mẫu Vé --', value: '' },
                    ...ticketFormats
                      .filter(f => f.is_active !== false)
                      .map(f => ({
                        label: formatCode(f.code),
                        value: f.id,
                      }))
                  ]}
                  className="py-2.5"
                />
              </>
            )}

            {activeTab === 'Nhóm Dịch vụ' && (
              <div className="p-0 h-full">
                <div className="space-y-4">
                  <Input
                    key="sg-code-input"
                    label="Mã Nhóm *"
                    value={formData.code}
                    disabled={editingId !== null}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="ví dụ: tai_khoan, giao_dich"
                    className="py-2.5"
                  />
                  <Input
                    key="sg-name-input"
                    label="Tên Nhóm *"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="ví dụ: Dịch vụ Tài khoản"
                    className="py-2.5"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="w-full md:w-1/2 flex flex-col gap-6">
            {activeTab === 'Mẫu Vé' && (
              <>
                <Input
                  key="min-input"
                  label="Số Bắt đầu *"
                  type="number"
                  value={formData.min_number}
                  onChange={(e) => setFormData({ ...formData, min_number: parseInt(e.target.value) })}
                  className="py-2.5"
                />
                <Input
                  key="max-input"
                  label="Số Tối đa *"
                  type="number"
                  value={formData.max_number}
                  onChange={(e) => setFormData({ ...formData, max_number: parseInt(e.target.value) })}
                  className="py-2.5"
                />
              </>
            )}

            {activeTab === 'Dịch vụ' && (
              <>
                <Input
                  key="svc-name-input"
                  label="Tên Dịch vụ *"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ví dụ: Đăng ký tài khoản"
                  className="py-2.5"
                />
                {/* <Input
                key="icon-input"
                label="URL Biểu tượng"
                value={formData.icon_url}
                onChange={(e) => setFormData({ ...formData, icon_url: e.target.value })}
                placeholder="https://example.com/icon.png"
              /> */}
              </>
            )}
            {activeTab === 'Nhóm Dịch vụ' && (
              <div className="overflow-hidden h-full min-h-[360px]">
                {(() => {
                  const visibleServices = services
                    .filter(service => {
                      const inSearch =
                        service.name.toLowerCase().includes(serviceSearchKeyword.toLowerCase()) ||
                        service.code.toLowerCase().includes(serviceSearchKeyword.toLowerCase());
                      const shouldDisplay = service.is_active || selectedServiceIds.includes(service.id);
                      return inSearch && shouldDisplay;
                    })
                    .sort((a, b) => {
                      const aSelected = selectedServiceIds.includes(a.id);
                      const bSelected = selectedServiceIds.includes(b.id);
                      if (aSelected && !bSelected) return -1;
                      if (!aSelected && bSelected) return 1;
                      return 0;
                    });

                  const selectableServiceIds = visibleServices
                    .filter(service => service.is_active)
                    .map(service => service.id);

                  return (
                    <>
                      {/* Header */}
                      <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-white">
                        <h3 className="font-bold text-base text-gray-800">Danh sách Dịch vụ</h3>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Tìm dịch vụ..."
                            value={serviceSearchKeyword}
                            onChange={(e) => setServiceSearchKeyword(e.target.value)}
                            className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                        </div>
                      </div>

                      {services.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">Không có dịch vụ nào. Vui lòng tạo dịch vụ trước.</div>
                      ) : (
                        <>
                          {/* Select All Bar */}
                          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center gap-3">
                            <input
                              type="checkbox"
                              ref={input => {
                                if (input) {
                                  const allSelected = selectableServiceIds.length > 0 &&
                                    selectableServiceIds.every(id => selectedServiceIds.includes(id));
                                  const someSelected = selectableServiceIds.some(id => selectedServiceIds.includes(id));

                                  input.checked = allSelected;
                                  input.indeterminate = someSelected && !allSelected;
                                }
                              }}
                              onChange={handleSelectAllServices}
                              className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500 cursor-pointer"
                            />
                            <span className="font-medium text-gray-700">
                              Chọn tất cả ({selectedServiceIds.filter(id => selectableServiceIds.includes(id)).length}/{selectableServiceIds.length})
                            </span>
                          </div>

                          {/* List Body */}
                          <div className="max-h-[430px] overflow-y-auto bg-white">
                            {visibleServices
                              .map((service, index, filteredArray) => (
                                <div
                                  key={`service-${service.id}`}
                                  onClick={() => {
                                    if (!service.is_active) return;
                                    if (selectedServiceIds.includes(service.id)) {
                                      setSelectedServiceIds(selectedServiceIds.filter(id => id !== service.id));
                                    } else {
                                      setSelectedServiceIds([...selectedServiceIds, service.id]);
                                    }
                                  }}
                                  className={`flex items-start gap-4 p-4 transition-colors ${service.is_active ? 'cursor-pointer hover:bg-gray-50' : 'opacity-60 bg-gray-50 cursor-not-allowed grayscale'
                                    } ${index < filteredArray.length - 1 ? 'border-b border-gray-100' : ''
                                    }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedServiceIds.includes(service.id)}
                                    disabled={!service.is_active}
                                    onChange={() => { }}
                                    className="w-4 h-4 mt-1 text-purple-600 rounded focus:ring-2 focus:ring-purple-500 cursor-pointer flex-shrink-0"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm">
                                      {service.name}
                                      {!service.is_active && (
                                        <span className="ml-2 text-xs text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                                          Đã vô hiệu hóa
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-gray-500">{service.code}</div>
                                  </div>
                                </div>
                              ))}
                            {visibleServices.length === 0 && (
                              <div className="text-center py-8 text-gray-500">
                                Không tìm thấy dịch vụ phù hợp
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-start gap-4 mt-8">
          <Button onClick={() => {
            if (activeTab === 'Mẫu Vé') {
              handleAddTicketFormat();
            } else if (activeTab === 'Dịch vụ') {
              handleAddService();
            } else if (activeTab === 'Nhóm Dịch vụ') {
              handleAddServiceGroup();
            }
          }}>
            {editingId ? 'Cập nhật' : 'Thêm mới'}
          </Button>
          <Button variant="secondary" onClick={() => {
            setViewMode('list');
            resetForm();
          }}>
            Hủy
          </Button>
        </div>
      </div>
    );
  };

  return (
    <>
      <Card>
        {viewMode === 'list' && (
          <Tabs
            tabs={['Mẫu Vé', 'Dịch vụ', 'Nhóm Dịch vụ']}
            activeTab={activeTab}
            onChange={(tab) => setActiveTab(tab)}
          />
        )}

        {viewMode === 'list' ? (
          <>
            {activeTab === 'Mẫu Vé' && <TicketFormatView />}
            {activeTab === 'Dịch vụ' && <ServiceView />}
            {activeTab === 'Nhóm Dịch vụ' && <ServiceGroupView />}
          </>
        ) : viewMode === 'add' || viewMode === 'edit' ? (
          RenderAddForm()
        ) : null}
      </Card>

      {/* Delete Modals */}
      <Modal
        isOpen={deleteModal.isOpen && deleteModal.type === 'format'}
        title={deleteModal.action === 'deactivate' ? 'Vô hiệu hóa mẫu vé' : 'Khôi phục mẫu vé'}
        message={
          deleteModal.action === 'deactivate'
            ? 'Bạn có chắc chắn muốn vô hiệu hóa Mẫu vé này? Nó sẽ không thể được gán cho các dịch vụ mới.'
            : 'Bạn có chắc chắn muốn khôi phục Mẫu vé này? Nó sẽ có thể được gán cho các dịch vụ mới.'
        }
        type="warning"
        isLoading={isLoading}
        onConfirm={confirmDeleteTicketFormat}
        onCancel={() => setDeleteModal({ isOpen: false, type: 'format', action: 'deactivate', id: null })}
        confirmText={deleteModal.action === 'deactivate' ? 'Vô hiệu hóa' : 'Khôi phục'}
        cancelText="Hủy"
      />

      <Modal
        isOpen={deleteModal.isOpen && deleteModal.type === 'service'}
        title={deleteModal.action === 'deactivate' ? 'Vô hiệu hóa dịch vụ' : 'Khôi phục dịch vụ'}
        message={
          deleteModal.action === 'deactivate'
            ? 'Bạn có chắc chắn muốn vô hiệu hóa dịch vụ này? Dịch vụ sẽ không hiển thị cho PGD.'
            : 'Bạn có chắc chắn muốn khôi phục dịch vụ này? Dịch vụ sẽ hoạt động trở lại.'
        }
        type="warning"
        isLoading={isLoading}
        onConfirm={confirmDeleteService}
        onCancel={() => setDeleteModal({ isOpen: false, type: 'service', action: 'deactivate', id: null })}
        confirmText={deleteModal.action === 'deactivate' ? 'Vô hiệu hóa' : 'Khôi phục'}
        cancelText="Hủy"
      />

      <Modal
        isOpen={deleteModal.isOpen && deleteModal.type === 'group'}
        title={deleteModal.action === 'deactivate' ? 'Vô hiệu hóa nhóm dịch vụ' : 'Khôi phục nhóm dịch vụ'}
        message={
          deleteModal.action === 'deactivate'
            ? 'Bạn có chắc chắn muốn vô hiệu hóa nhóm dịch vụ này? Nhóm dịch vụ sẽ không hiển thị cho PGD.'
            : 'Bạn có chắc chắn muốn khôi phục nhóm dịch vụ này? Nhóm dịch vụ sẽ hoạt động trở lại.'
        }
        type="warning"
        isLoading={isLoading}
        onConfirm={confirmDeleteServiceGroup}
        onCancel={() => setDeleteModal({ isOpen: false, type: 'group', action: 'deactivate', id: null })}
        confirmText={deleteModal.action === 'deactivate' ? 'Vô hiệu hóa' : 'Khôi phục'}
        cancelText="Hủy"
      />

      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed top-6 right-6 z-[9999] space-y-3">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`flex items-center gap-3 px-5 py-4 rounded-lg shadow-xl border-2 min-w-[320px] max-w-[500px] ${toast.type === 'success'
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

export default ServiceManager;
