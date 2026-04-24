import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Input, Select, Tabs, Modal } from '../components/UIComponents';
import { Plus, Edit2, Trash2, Check, X, ChevronDown, ChevronRight, CheckCircle, XCircle, Search, Ban, RefreshCw } from 'lucide-react';
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
  disabled = false,
}: {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  variant?: 'neutral' | 'edit' | 'delete' | 'deactivate' | 'reactivate' | 'confirm';
  disabled?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    disabled={disabled}
    className={`inline-flex h-9 w-9 items-center justify-center rounded-md text-sm transition-colors ${ACTION_ICON_VARIANTS[variant] || ACTION_ICON_VARIANTS.neutral} ${disabled ? 'cursor-not-allowed opacity-50 hover:bg-transparent' : ''}`}
  >
    {icon}
  </button>
);

const PGDManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState('Tỉnh/Thành phố');
  const [viewMode, setViewMode] = useState<'list' | 'add' | 'edit' | 'configure'>('list');

  // Province State
  const [provinces, setProvinces] = useState<any[]>([]);
  const [loadingProvinces, setLoadingProvinces] = useState(false);

  // District State
  const [districts, setDistricts] = useState<any[]>([]);
  const [loadingDistricts, setLoadingDistricts] = useState(false);

  // Transaction Office State
  const [offices, setOffices] = useState<any[]>([]);
  const [loadingOffices, setLoadingOffices] = useState(false);

  // Cascading dropdown state for Transaction Office
  const [districtsByProvince, setDistrictsByProvince] = useState<any[]>([]);
  const [loadingCascadingDistricts, setLoadingCascadingDistricts] = useState(false);

  // Configuration State
  const [officeConfigs, setOfficeConfigs] = useState<any[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(false);

  const [allServices, setAllServices] = useState<any[]>([]);
  const [loadingAllServices, setLoadingAllServices] = useState(false);

  // Grouped services state (for accordion)
  const [groupedServices, setGroupedServices] = useState<any[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<number | null>>(new Set());
  const [loadingGroupedServices, setLoadingGroupedServices] = useState(false);

  // ✅ Service Groups state
  const [allServiceGroups, setAllServiceGroups] = useState<any[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // Toast notifications
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'error' }>>([]);  // Configuration Form State
  const [configForm, setConfigForm] = useState({
    province_id: '',
    district_id: '',
    office_id: '',
  });

  const [isEditingConfig, setIsEditingConfig] = useState(false);

  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: 'province' | 'district' | 'office' | 'config';
    action: 'delete' | 'deactivate' | 'reactivate';
    id: number | null;
  }>({
    isOpen: false,
    type: 'province',
    action: 'delete',
    id: null,
  });

  const [officeConfigSettings, setOfficeConfigSettings] = useState({
    waiting_warning_minutes: '',
    waiting_overdue_minutes: '',
    serving_warning_minutes: '',
    serving_overdue_minutes: '',
  });

  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([]);
  const [configTabs, setConfigTabs] = useState<'services' | 'settings'>('services');
  const [serviceSearchKeyword, setServiceSearchKeyword] = useState('');
  const [groupSearchKeyword, setGroupSearchKeyword] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [loadingConfigDetails, setLoadingConfigDetails] = useState(false);

  // Show active items, and keep showing selected inactive items
  const visibleServices = allServices.filter(service => {
    const inSearch =
      service.name.toLowerCase().includes(serviceSearchKeyword.toLowerCase()) ||
      service.code.toLowerCase().includes(serviceSearchKeyword.toLowerCase());
    const shouldDisplay = service.is_active || selectedServiceIds.includes(service.id);
    return inSearch && shouldDisplay;
  });

  const visibleGroups = allServiceGroups.filter(group => {
    const inSearch =
      group.name.toLowerCase().includes(groupSearchKeyword.toLowerCase()) ||
      group.code.toLowerCase().includes(groupSearchKeyword.toLowerCase());
    const shouldDisplay = group.is_active || selectedGroupIds.includes(group.id);
    return inSearch && shouldDisplay;
  });

  const selectableServiceIds = visibleServices
    .filter(service => service.is_active)
    .map(service => service.id);

  const selectableGroupIds = visibleGroups
    .filter(group => group.is_active)
    .map(group => group.id);

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

  // Form State for Province/District
  const [formData, setFormData] = useState({
    province_id: '',
    code: '',
    name: '',
  });

  // Form State for Transaction Office
  const [transactionOfficeForm, setTransactionOfficeForm] = useState({
    province_id: '',
    district_id: '',
    code: '',
    name: '',
    address: '',
    latitude: '',
    longitude: '',
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  // Fetch data based on active tab
  useEffect(() => {
    if (activeTab === 'Tỉnh/Thành phố') {
      fetchProvinces();
      // Provinces already loaded on mount, no need to reload
    } else if (activeTab === 'Xã/Phường') {
      fetchDistricts();
    } else if (activeTab === 'Phòng Giao Dịch') {
      fetchTransactionOffices();
    } else if (activeTab === 'Cấu hình') {
      fetchOfficeConfigs(); // Load config list
      fetchServiceGroups(); // ✅ Load service groups for configuration
      //fetchTransactionOffices(); // For office selection
    }
  }, [activeTab]);

  // Auto-load configuration when office_id changes (for both new and edit)
  useEffect(() => {
    if (configForm.office_id && viewMode === 'configure') {
      fetchOfficeConfigDetails(Number(configForm.office_id));
    }
  }, [configForm.office_id, viewMode]);

  // --- Province Functions ---
  const fetchProvinces = async () => {
    setLoadingProvinces(true);
    try {
      const response = await api.get('/provinces');
      const sortedData = (response.data.data || []).sort((a: any, b: any) => a.id - b.id);
      setProvinces(sortedData);
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 403) return;
      showToast(error.response?.data?.message || error.message || 'Lỗi khi tải tỉnh/thành phố', 'error');
      console.error('Error fetching provinces:', error);
    } finally {
      setLoadingProvinces(false);
    }
  };

  const handleAddProvince = async () => {
    if (!formData.code || !formData.name) {
      showToast('Mã và tên là bắt buộc', 'error');
      return;
    }

    try {
      const payload = {
        code: formData.code,
        name: formData.name,
      };

      if (editingId) {
        await api.put(`/provinces/${editingId}`, payload);
      } else {
        await api.post('/provinces', payload);
      }

      showToast(editingId ? 'Cập nhật thành công' : 'Thêm mới thành công', 'success');
      resetForm();
      setViewMode('list');
      fetchProvinces();
    } catch (error: any) {
      showToast(error.response?.data?.message || error.message || 'Lỗi khi lưu tỉnh/thành phố', 'error');
    }
  };

  const handleDeleteProvince = (id: number) => {
    setDeleteModal({ isOpen: true, type: 'province', action: 'delete', id });
  };

  const confirmDeleteProvince = async () => {
    if (!deleteModal.id) return;
    try {
      await api.delete(`/provinces/${deleteModal.id}`);
      showToast('Xóa thành công', 'success');
      setDeleteModal({ isOpen: false, type: 'province', action: 'delete', id: null });
      fetchProvinces();
    } catch (error: any) {
      showToast(error.response?.data?.message || error.message || 'Lỗi khi xóa tỉnh/thành phố', 'error');
      setDeleteModal({ isOpen: false, type: 'province', action: 'delete', id: null });
    }
  };

  const handleEditProvince = (province: any) => {
    setFormData({
      province_id: '',
      code: province.code,
      name: province.name,
    });
    setEditingId(province.id);
    setViewMode('edit');
  };

  // --- District Functions ---
  const fetchDistricts = async () => {
    setLoadingDistricts(true);
    try {
      const response = await api.get('/districts');
      const sortedData = (response.data.data || []).sort((a: any, b: any) => a.id - b.id);
      setDistricts(sortedData);
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 403) return;
      showToast(error.response?.data?.message || error.message || 'Lỗi khi tải xã/phường', 'error');
      console.error('Error fetching districts:', error);
    } finally {
      setLoadingDistricts(false);
    }
  };

  const handleAddDistrict = async () => {
    if (!formData.province_id || !formData.code || !formData.name) {
      showToast('Tỉnh/Thành phố, mã và tên là bắt buộc', 'error');
      return;
    }

    try {
      const payload = {
        province_id: parseInt(formData.province_id as string),
        code: formData.code,
        name: formData.name,
      };

      if (editingId) {
        await api.put(`/districts/${editingId}`, payload);
      } else {
        await api.post('/districts', payload);
      }

      showToast(editingId ? 'Cập nhật thành công' : 'Thêm mới thành công', 'success');
      resetForm();
      setViewMode('list');
      fetchDistricts();
    } catch (error: any) {
      showToast(error.response?.data?.message || error.message || 'Lỗi khi lưu xã/phường', 'error');
    }
  };

  const handleDeleteDistrict = (id: number) => {
    setDeleteModal({ isOpen: true, type: 'district', action: 'delete', id });
  };

  const confirmDeleteDistrict = async () => {
    if (!deleteModal.id) return;
    try {
      await api.delete(`/districts/${deleteModal.id}`);
      showToast('Xóa thành công', 'success');
      setDeleteModal({ isOpen: false, type: 'district', action: 'delete', id: null });
      fetchDistricts();
    } catch (error: any) {
      showToast(error.response?.data?.message || error.message || 'Lỗi khi xóa xã/phường', 'error');
      setDeleteModal({ isOpen: false, type: 'district', action: 'delete', id: null });
    }
  };

  const handleEditDistrict = (district: any) => {
    setFormData({
      province_id: String(district.Province.id),
      code: district.code,
      name: district.name,
    });
    setEditingId(district.id);
    setViewMode('edit');
  };

  // --- Transaction Office Functions ---
  const fetchTransactionOffices = async () => {
    setLoadingOffices(true);
    try {
      const response = await api.get('/transaction-offices');
      const sortedData = (response.data.data || []).sort((a: any, b: any) => a.id - b.id);
      setOffices(sortedData);
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 403) return;
      showToast(error.response?.data?.message || error.message || 'Lỗi khi tải phòng giao dịch', 'error');
      console.error('Error fetching offices:', error);
    } finally {
      setLoadingOffices(false);
    }
  };

  /**
   * Fetch districts by province (Cascading Dropdown)
   */
  const fetchDistrictsByProvince = async (province_id: number) => {
    setLoadingCascadingDistricts(true);
    try {
      const response = await api.get(`/transaction-offices/districts/by-province/${province_id}`);
      const sortedData = (response.data.data || []).sort((a: any, b: any) => a.id - b.id);
      setDistrictsByProvince(sortedData);
    } catch (error: any) {
      console.error('Error fetching districts by province:', error);
      setDistrictsByProvince([]);
    } finally {
      setLoadingCascadingDistricts(false);
    }
  };

  const handleAddTransactionOffice = async () => {
    if (!transactionOfficeForm.province_id || !transactionOfficeForm.district_id ||
      !transactionOfficeForm.code || !transactionOfficeForm.name) {
      showToast('Tỉnh/Thành phố, Xã/Phường, Mã và Tên là bắt buộc', 'error');
      return;
    }

    try {
      const payload = {
        district_id: Number(transactionOfficeForm.district_id),
        code: transactionOfficeForm.code,
        name: transactionOfficeForm.name,
        address: transactionOfficeForm.address || null,
        latitude: transactionOfficeForm.latitude ? Number(transactionOfficeForm.latitude) : null,
        longitude: transactionOfficeForm.longitude ? Number(transactionOfficeForm.longitude) : null,
      };

      if (editingId) {
        await api.put(`/transaction-offices/${editingId}`, payload);
      } else {
        await api.post('/transaction-offices', payload);
      }

      showToast(editingId ? 'Cập nhật thành công' : 'Thêm mới thành công', 'success');
      resetTransactionOfficeForm();
      setViewMode('list');
      fetchTransactionOffices();
    } catch (error: any) {
      showToast(error.response?.data?.message || error.message || 'Lỗi khi lưu phòng giao dịch', 'error');
    }
  };

  const handleDeleteTransactionOffice = (id: number) => {
    const office = offices.find(o => o.id === id);
    setDeleteModal({ isOpen: true, type: 'office', action: 'deactivate', id });
  };

  const handleReactivateTransactionOffice = (id: number) => {
    const office = offices.find(o => o.id === id);
    setDeleteModal({ isOpen: true, type: 'office', action: 'reactivate', id });
  };

  const confirmDeleteTransactionOffice = async () => {
    if (!deleteModal.id) return;
    try {
      if (deleteModal.action === 'deactivate') {
        await api.delete(`/transaction-offices/${deleteModal.id}`);
        showToast('Vô hiệu hóa thành công', 'success');
      } else {
        await api.post(`/transaction-offices/${deleteModal.id}/reactivate`);
        showToast('Khôi phục thành công', 'success');
      }
      setDeleteModal({ isOpen: false, type: 'office', action: 'delete', id: null });
      fetchTransactionOffices();
    } catch (error: any) {
      showToast(error.response?.data?.message || error.message || 'Lỗi khi xử lý phòng giao dịch', 'error');
      setDeleteModal({ isOpen: false, type: 'office', action: 'delete', id: null });
    }
  };

  const handleEditTransactionOffice = async (office: any) => {
    try {
      const response = await api.get(`/transaction-offices/${office.id}`);
      const officeDetail = response.data.data;

      setTransactionOfficeForm({
        province_id: String(officeDetail.province_id),
        district_id: String(officeDetail.district_id),
        code: officeDetail.code,
        name: officeDetail.name,
        address: officeDetail.address || '',
        latitude: officeDetail.latitude ? String(officeDetail.latitude) : '',
        longitude: officeDetail.longitude ? String(officeDetail.longitude) : '',
      });

      // Fetch districts for the province
      if (officeDetail.province_id) {
        await fetchDistrictsByProvince(Number(officeDetail.province_id));
      }

      setEditingId(office.id);
      setViewMode('edit');
    } catch (error: any) {
      showToast(error.response?.data?.message || error.message || 'Lỗi khi tải chi tiết phòng giao dịch', 'error');
    }
  };

  const resetTransactionOfficeForm = () => {
    setTransactionOfficeForm({
      province_id: '',
      district_id: '',
      code: '',
      name: '',
      address: '',
      latitude: '',
      longitude: '',
    });
    setEditingId(null);
    setDistrictsByProvince([]);
  };

  const resetForm = () => {
    setFormData({
      province_id: '',
      code: '',
      name: '',
    });
    setEditingId(null);
  };

  // --- Configuration Functions ---
  const fetchOfficeConfigs = async () => {
    setLoadingConfigs(true);
    try {
      const response = await api.get('/office-configs');
      setOfficeConfigs(response.data.data || []);
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 403) return;
      showToast(error.response?.data?.message || error.message || 'Lỗi khi tải cấu hình', 'error');
      console.error('Error fetching configs:', error);
    } finally {
      setLoadingConfigs(false);
    }
  };

  // ✅ Fetch all service groups
  const fetchServiceGroups = async (officeId?: number) => {
    setLoadingGroups(true);
    try {
      const response = await api.get('/service-groups', {
        params: officeId
          ? {
            transaction_office_id: officeId,
            include_inactive_assigned: true,
          }
          : undefined,
      });
      const sortedData = (response.data.data || []).sort((a: any, b: any) => a.id - b.id);
      setAllServiceGroups(sortedData);
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 403) return;
      console.error('Error fetching service groups:', error);
      // Non-critical error, don't show toast
    } finally {
      setLoadingGroups(false);
    }
  };

  const fetchServices = async (officeId?: number) => {
    setLoadingAllServices(true);
    try {
      const response = await api.get('/services', {
        params: officeId
          ? {
            transaction_office_id: officeId,
            include_inactive_assigned: true,
          }
          : undefined,
      });
      const sortedData = (response.data.data || []).sort((a: any, b: any) => a.id - b.id);
      setAllServices(sortedData);
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 403) return;
      console.error('Error fetching services:', error);
    } finally {
      setLoadingAllServices(false);
    }
  };

  const fetchOfficeConfigDetails = async (officeId: number) => {
    setLoadingConfigDetails(true);
    try {
      const response = await api.get(`/office-configs/${officeId}/details`);
      const configData = response.data.data;

      // Update form with office info (only needed for auto-fill when fetching details)
      // The dropdowns are already set by the edit button

      // Populate time settings
      setOfficeConfigSettings({
        waiting_warning_minutes: configData.config.waiting_warning_minutes || '',
        waiting_overdue_minutes: configData.config.waiting_overdue_minutes || '',
        serving_warning_minutes: configData.config.serving_warning_minutes || '',
        serving_overdue_minutes: configData.config.serving_overdue_minutes || '',
      });

      // Set selected services
      setSelectedServiceIds(configData.assigned_service_ids || []);

      // ✅ Set selected service groups
      setSelectedGroupIds(configData.assigned_service_group_ids || []);

      // Keep grouped services for potential future use
      if (configData.grouped_services) {
        setGroupedServices(configData.grouped_services);
        const allGroupIds = new Set<number>(configData.grouped_services.map((g: any) => g.group_id));
        setExpandedGroups(allGroupIds);
      }

      await Promise.all([
        fetchServices(officeId),
        fetchServiceGroups(officeId),
      ]);

      setConfigTabs('services');
    } catch (error: any) {
      showToast(error.response?.data?.message || error.message || 'Lỗi khi tải chi tiết cấu hình', 'error');
    } finally {
      setLoadingConfigDetails(false);
    }
  };

  const handleServiceCheckboxChange = (serviceId: number, isChecked: boolean) => {
    const targetService = allServices.find(service => service.id === serviceId);
    if (targetService && !targetService.is_active) {
      return;
    }

    if (isChecked) {
      setSelectedServiceIds([...selectedServiceIds, serviceId]);
    } else {
      setSelectedServiceIds(selectedServiceIds.filter(id => id !== serviceId));
    }
  };

  const toggleGroupExpanded = (groupId: number | null) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const selectAllInGroup = (services: any[], isSelect: boolean) => {
    const serviceIds = services.map((s: any) => s.id);
    if (isSelect) {
      // Add all services in group to selected
      const newSelected = new Set(selectedServiceIds);
      serviceIds.forEach(id => newSelected.add(id));
      setSelectedServiceIds(Array.from(newSelected));
    } else {
      // Remove all services in group from selected
      setSelectedServiceIds(selectedServiceIds.filter(id => !serviceIds.includes(id)));
    }
  };

  const isGroupFullySelected = (services: any[]) => {
    return services.length > 0 && services.every((s: any) => selectedServiceIds.includes(s.id));
  };

  const isGroupPartiallySelected = (services: any[]) => {
    return services.some((s: any) => selectedServiceIds.includes(s.id)) && !isGroupFullySelected(services);
  };

  const handleSelectAllServices = () => {
    if (selectableServiceIds.length === 0) return;

    const allSelectableChecked = selectableServiceIds.every(id => selectedServiceIds.includes(id));

    if (allSelectableChecked) {
      setSelectedServiceIds(prev => prev.filter(id => !selectableServiceIds.includes(id)));
    } else {
      setSelectedServiceIds(prev => Array.from(new Set([...prev, ...selectableServiceIds])));
    }
  };

  // ✅ Handle service group checkbox change
  const handleGroupCheckboxChange = (groupId: number, isChecked: boolean) => {
    const targetGroup = allServiceGroups.find(group => group.id === groupId);
    if (targetGroup && !targetGroup.is_active) {
      return;
    }

    if (isChecked) {
      setSelectedGroupIds([...selectedGroupIds, groupId]);
    } else {
      setSelectedGroupIds(selectedGroupIds.filter(id => id !== groupId));
    }
  };

  // ✅ Handle select all groups
  const handleSelectAllGroups = () => {
    if (selectableGroupIds.length === 0) return;

    const allSelectableChecked = selectableGroupIds.every(id => selectedGroupIds.includes(id));

    if (allSelectableChecked) {
      setSelectedGroupIds(prev => prev.filter(id => !selectableGroupIds.includes(id)));
    } else {
      setSelectedGroupIds(prev => Array.from(new Set([...prev, ...selectableGroupIds])));
    }
  };

  /**
   * Xử lý chỉnh sửa cấu hình với quy trình tải dữ liệu tuần tự
   * 1. Ensure offices list loaded
   * 2. Fetch districts by province
   * 3. Set form data
   * 4. Switch to configure view
   */
  const handleEditConfigurationAsync = async (config: any) => {
    if (config?.is_active === false) {
      showToast('PGD đang bị vô hiệu hóa', 'error');
      return;
    }

    try {
      const provinceId = config.province_id;
      const districtId = config.district_id;
      const officeId = config.id;

      // Step 1: Ensure offices list is loaded
      let officesList = offices;
      if (officesList.length === 0) {
        try {
          const response = await api.get('/transaction-offices');
          officesList = response.data.data || [];
          setOffices(officesList);
        } catch (error) {
          console.error('Error fetching offices:', error);
        }
      }

      // Step 2: Fetch districts for the selected province
      if (provinceId) {
        try {
          setLoadingCascadingDistricts(true);
          const response = await api.get(`/transaction-offices/districts/by-province/${provinceId}`);
          const sortedData = (response.data.data || []).sort((a: any, b: any) => a.id - b.id);
          setDistrictsByProvince(sortedData);
        } catch (error) {
          console.error('Error fetching districts:', error);
        } finally {
          setLoadingCascadingDistricts(false);
        }
      }

      // Step 3: Set form data with all required values
      setIsEditingConfig(true);
      setConfigForm({
        province_id: String(provinceId || ''),
        district_id: String(districtId || ''),
        office_id: String(officeId),
      });

      // Step 4: Switch to configure view mode
      setServiceSearchKeyword('');
      setViewMode('configure');
    } catch (error) {
      console.error('Error in edit configuration:', error);
      showToast('Lỗi khi chuẩn bị biểu mẫu chỉnh sửa', 'error');
    }
  };

  const handleSaveConfiguration = async () => {
    if (!configForm.office_id) {
      showToast('Vui lòng chọn Phòng Giao Dịch', 'error');
      return;
    }

    setSavingConfig(true);

    try {
      const payload = {
        configs: {
          waiting_warning_minutes: officeConfigSettings.waiting_warning_minutes
            ? Number(officeConfigSettings.waiting_warning_minutes)
            : null,
          waiting_overdue_minutes: officeConfigSettings.waiting_overdue_minutes
            ? Number(officeConfigSettings.waiting_overdue_minutes)
            : null,
          serving_warning_minutes: officeConfigSettings.serving_warning_minutes
            ? Number(officeConfigSettings.serving_warning_minutes)
            : null,
          serving_overdue_minutes: officeConfigSettings.serving_overdue_minutes
            ? Number(officeConfigSettings.serving_overdue_minutes)
            : null,
        },
        service_ids: selectedServiceIds,
        service_group_ids: selectedGroupIds,
      };

      await api.post(`/office-configs/${configForm.office_id}`, payload);

      showToast('Lưu cấu hình thành công', 'success');

      // Refresh config list and return to list view
      await fetchOfficeConfigs();
      setViewMode('list');
      resetConfigurationForm();
    } catch (error: any) {
      showToast(error.response?.data?.message || error.message || 'Lỗi khi lưu cấu hình', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  const resetConfigurationForm = () => {
    setConfigForm({
      province_id: '',
      district_id: '',
      office_id: '',
    });
    setOfficeConfigSettings({
      waiting_warning_minutes: '',
      waiting_overdue_minutes: '',
      serving_warning_minutes: '',
      serving_overdue_minutes: '',
    });
    setSelectedServiceIds([]);
    setSelectedGroupIds([]);
    setAllServices([]);
    setServiceSearchKeyword('');
    setGroupSearchKeyword('');
    setConfigTabs('services');
    setDistrictsByProvince([]);
    setIsEditingConfig(false);
  };

  const handleDeleteConfiguration = (officeId: number) => {
    setDeleteModal({ isOpen: true, type: 'config', action: 'delete', id: officeId });
  };

  const confirmDeleteConfiguration = async () => {
    if (!deleteModal.id) return;
    try {
      await api.delete(`/office-configs/${deleteModal.id}`);

      showToast('Xóa cấu hình thành công', 'success');

      // Refresh config list
      await fetchOfficeConfigs();
    } catch (error: any) {
      // Show validation error from backend
      const errorMessage = error.response?.data?.message || error.message || 'Lỗi khi xóa cấu hình';
      showToast(errorMessage, 'error');
    } finally {
      // Close modal in both success and failure cases
      setDeleteModal({ isOpen: false, type: 'config', action: 'delete', id: null });
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // --- Xem danh sách Tỉnh/Thành phố ---
  const ProvinceView = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Danh sách Tỉnh/Thành phố</h3>
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
      {loadingProvinces ? (
        <div className="text-center py-8 text-gray-500">Đang tải...</div>
      ) : (
        <Table
          data={provinces.map((province, index) => ({
            id: province.id,
            code: province.code,
            name: province.name,
            created_at: formatDate(province.created_at),
          }))}
          columns={[
            { header: 'Mã Tỉnh/Thành phố', accessor: (item: any) => item.code },
            { header: 'Tên Tỉnh/Thành phố', accessor: (item: any) => item.name },
            { header: 'Ngày Tạo', accessor: (item: any) => item.created_at },
          ]}
          actions={(item: any) => (
            <div className="flex justify-end gap-2">
              <ActionIconButton
                title="Chỉnh sửa"
                variant="edit"
                icon={<Edit2 size={16} />}
                onClick={() => {
                  const fullProvince = provinces.find(p => p.id === item.id);
                  if (fullProvince) handleEditProvince(fullProvince);
                }}
              />
              <ActionIconButton
                title="Xóa"
                variant="delete"
                icon={<Trash2 size={16} />}
                onClick={() => handleDeleteProvince(item.id)}
              />
            </div>
          )}
        />
      )}
    </div>
  );

  // --- District View ---
  const DistrictView = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Danh sách Xã/Phường</h3>
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
      {loadingDistricts ? (
        <div className="text-center py-8 text-gray-500">Đang tải...</div>
      ) : (
        <Table
          data={districts.map((district) => ({
            id: district.id,
            province_name: district.Province?.name || 'N/A',
            code: district.code,
            name: district.name,
            created_at: formatDate(district.created_at),
          }))}
          columns={[
            { header: 'Tỉnh/Thành phố', accessor: (item: any) => item.province_name },
            { header: 'Mã Xã/Phường', accessor: (item: any) => item.code },
            { header: 'Tên Xã/Phường', accessor: (item: any) => item.name },
            { header: 'Ngày Tạo', accessor: (item: any) => item.created_at },
          ]}
          actions={(item: any) => (
            <div className="flex justify-end gap-2">
              <ActionIconButton
                title="Chỉnh sửa"
                variant="edit"
                icon={<Edit2 size={16} />}
                onClick={() => {
                  const fullDistrict = districts.find(d => d.id === item.id);
                  if (fullDistrict) handleEditDistrict(fullDistrict);
                }}
              />
              <ActionIconButton
                title="Xóa"
                variant="delete"
                icon={<Trash2 size={16} />}
                onClick={() => handleDeleteDistrict(item.id)}
              />
            </div>
          )}
        />
      )}
    </div>
  );

  // --- Xem danh sách Phòng Giao Dịch ---
  const TransactionOfficeView = () => {
    return (
      <div className="space-y-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-medium">Danh sách Phòng giao dịch</h3>
          <Button
            size="sm"
            icon={<Plus size={16} />}
            onClick={() => setViewMode('add')}
          >
            Thêm mới
          </Button>
        </div>

        {loadingOffices && (
          <div className="text-center py-4">Đang tải phòng giao dịch...</div>
        )}

        {!loadingOffices && offices.length === 0 && (
          <div className="text-center py-4 text-gray-500">Không tìm thấy phòng giao dịch</div>
        )}

        {!loadingOffices && offices.length > 0 && (
          <Table
            data={offices}
            columns={[
              { header: 'Mã PGD', accessor: 'code' },
              { header: 'Tên PGD', accessor: 'name' },
              { header: 'Xã/Phường', accessor: 'district_name' },
              { header: 'Tỉnh/Thành phố', accessor: 'province_name' },
              // { header: 'Địa chỉ', accessor: 'address' },
              {
                header: 'Trạng thái',
                accessor: (office: any) =>
                  office.is_active !== false ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Đang hoạt động
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      Đã vô hiệu hóa
                    </span>
                  )
              },
              { header: 'Ngày Tạo', accessor: (office: any) => formatDate(office.created_at) },
            ]}
            actions={(office: any) => (
              <div className="flex justify-end gap-2">
                <ActionIconButton
                  title="Chỉnh sửa"
                  variant="edit"
                  icon={<Edit2 size={16} />}
                  onClick={() => handleEditTransactionOffice(office)}
                />
                {office.is_active !== false ? (
                  <ActionIconButton
                    title="Vô hiệu hóa"
                    variant="deactivate"
                    icon={<Ban size={16} />}
                    onClick={() => handleDeleteTransactionOffice(office.id)}
                  />
                ) : (
                  <ActionIconButton
                    title="Khôi phục"
                    variant="reactivate"
                    icon={<RefreshCw size={16} />}
                    onClick={() => handleReactivateTransactionOffice(office.id)}
                  />
                )}
              </div>
            )}
          />
        )}
      </div>
    );
  };

  // --- Configuration View ---
  const ConfigurationView = () => {
    const districtList = configForm.province_id ? districtsByProvince : [];
    const officeList = configForm.district_id
      ? offices.filter(o => o.district_id === Number(configForm.district_id))
      : [];

    return (
      <div className="space-y-6">
        {/* Config Summary Table */}
        {viewMode === 'list' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Danh sách Cấu hình</h3>
              {/* <Button
                size="sm"
                icon={<Plus size={16} />}
                onClick={() => {
                  setIsEditingConfig(false);
                  setViewMode('configure');
                }}
              >
                Thêm mới
              </Button> */}
            </div>
            {loadingConfigs ? (
              <div className="text-center py-8 text-gray-500">Đang tải cấu hình...</div>
            ) : officeConfigs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">Không tìm thấy cấu hình</div>
            ) : (
              <Table
                data={officeConfigs}
                columns={[
                  { header: 'Mã PGD', accessor: 'code' },
                  { header: 'Tên PGD', accessor: 'name' },
                  { header: 'Xã/Phường', accessor: 'district' },
                  { header: 'Tỉnh/Thành phố', accessor: 'province' },
                  { header: 'Dịch vụ', accessor: 'services_count' },
                  { header: 'Nhóm dịch vụ', accessor: 'service_groups_count' },
                  // { header: 'C\u1ea3nh b\u00e1o Ch\u1edd', accessor: 'waiting_warning_minutes' },
                  // { header: 'Qu\u00e1 h\u1ea1n Ch\u1edd', accessor: 'waiting_overdue_minutes' },
                ]}
                actions={(config: any) => (
                  <div className="flex justify-end gap-2">
                    <ActionIconButton
                      title={config.is_active === false ? 'PGD đang bị vô hiệu hóa' : 'Chỉnh sửa Cấu hình'}
                      variant="edit"
                      icon={<Edit2 size={16} />}
                      disabled={config.is_active === false}
                      onClick={() => handleEditConfigurationAsync(config)}
                    />
                    <ActionIconButton
                      title="Xóa Cấu hình"
                      variant="delete"
                      icon={<Trash2 size={16} />}
                      onClick={() => handleDeleteConfiguration(config.id)}
                    />
                  </div>
                )}
              />
            )}

          </div>
        )}

        {/* Biểu mẫu Cấu hình */}
        {viewMode === 'configure' && (
          <div className="bg-gray-50 p-6 rounded-lg space-y-4">
            <h3 className="text-lg font-bold">{isEditingConfig ? 'Chỉnh sửa Cấu hình' : 'Cấu hình Mới'}</h3>

            {/* Dropdown Tỉnh/Thành phố */}
            <Select
              label="Tỉnh/Thành phố *"
              value={configForm.province_id}
              onChange={(e) => {
                const newProvinceId = e.target.value ? Number(e.target.value) : '';
                setConfigForm({
                  ...configForm,
                  province_id: String(newProvinceId),
                  district_id: '',
                  office_id: '',
                });
                if (newProvinceId) {
                  fetchDistrictsByProvince(newProvinceId);
                } else {
                  setDistrictsByProvince([]);
                }
              }}
              options={[
                { label: '-- Chọn Tỉnh/Thành phố --', value: '' },
                ...provinces.map(p => ({
                  label: p.name,
                  value: String(p.id),
                }))
              ]}
              disabled={isEditingConfig}
            />

            {/* Dropdown Xã/Phường (Liên kết) */}
            <Select
              label="Xã/Phường *"
              value={configForm.district_id}
              onChange={(e) => {
                const newDistrictId = e.target.value ? Number(e.target.value) : '';
                setConfigForm({
                  ...configForm,
                  district_id: String(newDistrictId),
                  office_id: '',
                });
              }}
              options={[
                { label: loadingCascadingDistricts ? 'Đang tải...' : '-- Chọn Xã/Phường --', value: '' },
                ...districtList.map(d => ({
                  label: d.name,
                  value: String(d.id),
                }))
              ]}
              disabled={!configForm.province_id || loadingCascadingDistricts || isEditingConfig}
            />

            {/* Dropdown Phòng Giao Dịch */}
            <Select
              label="Phòng Giao Dịch *"
              value={configForm.office_id}
              onChange={(e) => {
                setConfigForm({
                  ...configForm,
                  office_id: e.target.value,
                });
              }}
              options={[
                { label: '-- Chọn Phòng Giao Dịch --', value: '' },
                ...officeList.map(o => ({
                  label: `${o.code} - ${o.name}`,
                  value: String(o.id),
                }))
              ]}
              disabled={!configForm.district_id || isEditingConfig}
            />
          </div>
        )}

        {/* Configuration Form - Show tabs when office is selected */}
        {viewMode === 'configure' && configForm.office_id && (
          <div className="space-y-6">
            <div className="border-b">
              <div className="flex gap-4 px-4 py-2">
                <button
                  className={`px-4 py-2 font-medium border-b-2 transition-colors ${configTabs === 'services'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  onClick={() => setConfigTabs('services')}
                >
                  Dịch vụ
                </button>
                <button
                  className={`px-4 py-2 font-medium border-b-2 transition-colors ${configTabs === 'settings'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  onClick={() => setConfigTabs('settings')}
                >
                  Cài đặt Thời gian
                </button>
              </div>
            </div>

            {/* Tab Dịch vụ */}
            {configTabs === 'services' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* ✅ Nhóm Dịch Vụ Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-bold text-lg">Chọn Nhóm Dịch Vụ</h4>
                    {allServiceGroups.length > 0 && (
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                        <input
                          type="text"
                          placeholder="Tìm nhóm..."
                          value={groupSearchKeyword}
                          onChange={(e) => setGroupSearchKeyword(e.target.value)}
                          className="text-sm border border-gray-300 rounded-lg pl-9 pr-3 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    )}
                  </div>
                  {loadingGroups ? (
                    <div className="text-center py-8 text-gray-500">Đang tải nhóm dịch vụ...</div>
                  ) : allServiceGroups.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">Không có nhóm dịch vụ nào</div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      {/* Toolbar Header */}
                      <div className="flex items-center justify-between bg-gray-50 px-4 py-3 border-b border-gray-200">
                        <label className="flex items-center gap-3 cursor-pointer select-none flex-1">
                          <input
                            type="checkbox"
                            ref={input => {
                              if (input) {
                                const allSelected = selectableGroupIds.length > 0 &&
                                  selectableGroupIds.every(id => selectedGroupIds.includes(id));
                                const someSelected = selectableGroupIds.some(id => selectedGroupIds.includes(id));

                                input.checked = allSelected;
                                input.indeterminate = someSelected && !allSelected;
                              }
                            }}
                            onChange={handleSelectAllGroups}
                            className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                          />
                          <span className="font-medium text-gray-700">
                            Chọn tất cả ({selectedGroupIds.filter(id => selectableGroupIds.includes(id)).length}/{selectableGroupIds.length})
                          </span>
                        </label>
                      </div>

                      {/* Groups list */}
                      <div className="max-h-96 overflow-y-auto">
                        {visibleGroups.length > 0 ? (
                          visibleGroups.map((group: any) => (
                            <label
                              key={group.id}
                              className={`flex items-center gap-3 p-3 border-b border-gray-200 transition-colors last:border-b-0 ${group.is_active
                                ? 'hover:bg-gray-50 cursor-pointer'
                                : 'opacity-60 bg-gray-50 cursor-not-allowed grayscale'
                                }`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedGroupIds.includes(group.id)}
                                disabled={!group.is_active}
                                onChange={(e) => handleGroupCheckboxChange(group.id, e.target.checked)}
                                className="w-4 h-4"
                              />
                              <div className="flex-1">
                                <div className="font-medium text-sm">
                                  {group.name}
                                  {!group.is_active && (
                                    <span className="ml-2 text-xs text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                                      Đã vô hiệu hóa
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500">{group.code}</div>
                              </div>
                            </label>
                          ))
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            Không tìm thấy nhóm phù hợp
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Dịch vụ Lẻ Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-bold text-lg">Chọn Dịch vụ</h4>
                    {allServices.length > 0 && (
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                        <input
                          type="text"
                          placeholder="Tìm dịch vụ..."
                          value={serviceSearchKeyword}
                          onChange={(e) => setServiceSearchKeyword(e.target.value)}
                          className="text-sm border border-gray-300 rounded-lg pl-9 pr-3 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    )}
                  </div>

                  {/* Toolbar Select All Services */}
                  {allServices.length > 0 && (
                    <div className="flex items-center justify-between bg-gray-50 px-4 py-3 border-b border-gray-200">
                      <label className="flex items-center gap-3 cursor-pointer select-none flex-1">
                        <input
                          type="checkbox"
                          ref={input => {
                            if (input) {
                              const allChecked = selectableServiceIds.length > 0 &&
                                selectableServiceIds.every(id => selectedServiceIds.includes(id));
                              const someChecked = selectableServiceIds.some(id => selectedServiceIds.includes(id));
                              input.checked = allChecked;
                              input.indeterminate = someChecked;
                            }
                          }}
                          onChange={handleSelectAllServices}
                          className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="font-medium text-gray-700">Chọn tất cả ({selectedServiceIds.filter(id => selectableServiceIds.includes(id)).length}/{selectableServiceIds.length})</span>
                      </label>
                    </div>
                  )}

                  {/* Services List */}
                  {allServices.length > 0 && (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="max-h-96 overflow-y-auto">
                        {visibleServices.length > 0 ? (
                          visibleServices.map((service) =>
                            service && (
                              <label
                                key={service.id}
                                className={`flex items-center gap-3 p-3 border-b border-gray-200 transition-colors last:border-b-0 ${service.is_active
                                  ? 'hover:bg-gray-50 cursor-pointer'
                                  : 'opacity-60 bg-gray-50 cursor-not-allowed grayscale'
                                  }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedServiceIds.includes(service.id)}
                                  disabled={!service.is_active}
                                  onChange={(e) => handleServiceCheckboxChange(service.id, e.target.checked)}
                                  className="w-4 h-4"
                                />
                                <div className="flex-1">
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
                              </label>
                            )
                          )
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            Không tìm thấy dịch vụ phù hợp
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Cài đặt Thời gian */}
            {configTabs === 'settings' && (
              <div className="space-y-6 max-w-4xl">
                <h4 className="font-bold text-lg">Cấu hình Thời gian (phút)</h4>

                {/* Time Configuration Cards in Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Khối Thời gian Chờ đợi */}
                  <div className="border rounded-lg p-4 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                    <h5 className="font-semibold text-orange-900 mb-4 flex items-center gap-2">
                      <span className="w-3 h-3 bg-orange-500 rounded-full"></span>
                      Thời gian Chờ đợi
                    </h5>
                    <div className="space-y-4">
                      <Input
                        label="Cảnh báo (phút)"
                        type="number"
                        min="0"
                        value={officeConfigSettings.waiting_warning_minutes}
                        onChange={(e) => setOfficeConfigSettings({
                          ...officeConfigSettings,
                          waiting_warning_minutes: e.target.value,
                        })}
                        placeholder="ví dụ: 15"
                      />
                      <Input
                        label="Quá hạn (phút)"
                        type="number"
                        min="0"
                        value={officeConfigSettings.waiting_overdue_minutes}
                        onChange={(e) => setOfficeConfigSettings({
                          ...officeConfigSettings,
                          waiting_overdue_minutes: e.target.value,
                        })}
                        placeholder="ví dụ: 30"
                      />
                    </div>
                  </div>

                  {/* Khối Thời gian Phục vụ */}
                  <div className="border rounded-lg p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                    <h5 className="font-semibold text-green-900 mb-4 flex items-center gap-2">
                      <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                      Thời gian Phục vụ
                    </h5>
                    <div className="space-y-4">
                      <Input
                        label="Cảnh báo (phút)"
                        type="number"
                        min="0"
                        value={officeConfigSettings.serving_warning_minutes}
                        onChange={(e) => setOfficeConfigSettings({
                          ...officeConfigSettings,
                          serving_warning_minutes: e.target.value,
                        })}
                        placeholder="ví dụ: 10"
                      />
                      <Input
                        label="Quá hạn (phút)"
                        type="number"
                        min="0"
                        value={officeConfigSettings.serving_overdue_minutes}
                        onChange={(e) => setOfficeConfigSettings({
                          ...officeConfigSettings,
                          serving_overdue_minutes: e.target.value,
                        })}
                        placeholder="ví dụ: 30"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-6 pt-4 border-t">
              <Button
                onClick={handleSaveConfiguration}
                disabled={savingConfig}
              >
                {savingConfig ? 'Đang lưu...' : 'Lưu Cấu hình'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setViewMode('list');
                  setServiceSearchKeyword('');
                  resetConfigurationForm();
                }}
              >
                Hủy
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };
  const RenderAddForm = () => {
    const formKey = `form-${activeTab}-${editingId || 'new'}`;
    const isProvince = activeTab === 'Tỉnh/Thành phố';
    const isDistrict = activeTab === 'Xã/Phường';
    const isTransactionOffice = activeTab === 'Phòng Giao Dịch';

    if (isTransactionOffice) {
      return (
        <div className="space-y-6 max-w-2xl" key={formKey}>
          <h3 className="text-lg font-bold">
            {editingId ? 'Chỉnh sửa' : 'Thêm mới'} Phòng Giao Dịch
          </h3>
          <div className="grid grid-cols-1 gap-4">
            {/* Dropdown Tỉnh/Thành phố */}
            <Select
              label="Tỉnh/Thành phố *"
              value={transactionOfficeForm.province_id}
              onChange={(e) => {
                const newProvinceId = e.target.value ? Number(e.target.value) : '';
                setTransactionOfficeForm({
                  ...transactionOfficeForm,
                  province_id: String(newProvinceId),
                  district_id: '', // RESET district when province changes
                });
                if (newProvinceId) {
                  fetchDistrictsByProvince(newProvinceId);
                } else {
                  setDistrictsByProvince([]);
                }
              }}
              options={[
                { label: '-- Chọn Tỉnh/Thành phố --', value: '' },
                ...provinces.map(p => ({
                  label: p.name,
                  value: String(p.id),
                }))
              ]}
            />

            {/* Dropdown Xã/Phường (Liên kết) */}
            <Select
              label="Xã/Phường *"
              value={transactionOfficeForm.district_id}
              onChange={(e) => {
                const newDistrictId = e.target.value ? Number(e.target.value) : '';
                setTransactionOfficeForm({
                  ...transactionOfficeForm,
                  district_id: String(newDistrictId),
                });
              }}
              options={[
                { label: loadingCascadingDistricts ? 'Đang tải...' : '-- Chọn Xã/Phường --', value: '' },
                ...districtsByProvince.map(d => ({
                  label: d.name,
                  value: String(d.id),
                }))
              ]}
              disabled={!transactionOfficeForm.province_id || loadingCascadingDistricts}
            />

            {/* Input Mã */}
            <Input
              label="Mã Phòng Giao Dịch *"
              value={transactionOfficeForm.code}
              onChange={(e) => setTransactionOfficeForm({ ...transactionOfficeForm, code: e.target.value })}
              placeholder="ví dụ: PGD_HN_01"
              disabled={editingId !== null}
            />

            {/* Input Tên */}
            <Input
              label="Tên Phòng Giao Dịch *"
              value={transactionOfficeForm.name}
              onChange={(e) => setTransactionOfficeForm({ ...transactionOfficeForm, name: e.target.value })}
              placeholder="ví dụ: Phòng Giao Dịch Hà Nội"
            />

            {/* Input Địa chỉ */}
            <Input
              label="Địa chỉ"
              value={transactionOfficeForm.address}
              onChange={(e) => setTransactionOfficeForm({ ...transactionOfficeForm, address: e.target.value })}
              placeholder="ví dụ: 123 Nguyễn Trãi, Thanh Xuân, Hà Nội"
            />
          </div>

          <div className="flex gap-2 mt-6">
            <Button onClick={handleAddTransactionOffice}>
              {editingId ? 'Cập nhật' : 'Thêm mới'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setViewMode('list');
                resetTransactionOfficeForm();
              }}
            >
              Hủy
            </Button>
          </div>
        </div>
      );
    }

    const handleSubmit = isProvince ? handleAddProvince : handleAddDistrict;

    return (
      <div className="space-y-6 max-w-2xl" key={formKey}>
        <h3 className="text-lg font-bold">
          {editingId ? 'Chỉnh sửa' : 'Thêm mới'} {activeTab === 'Tỉnh/Thành phố' ? 'Tỉnh/Thành phố' : 'Xã/Phường'}
        </h3>
        <div className="grid grid-cols-1 gap-4">
          {isDistrict && (
            <Select
              key="province-select"
              label="Tỉnh/Thành phố *"
              value={formData.province_id}
              onChange={(e) => setFormData({ ...formData, province_id: e.target.value })}
              options={[
                { label: '-- Chọn Tỉnh/Thành phố --', value: '' },
                ...provinces.map(p => ({
                  label: p.name,
                  value: String(p.id),
                }))
              ]}
            />
          )}
          <Input
            key="code-input"
            label={isProvince ? 'Mã Tỉnh/Thành phố *' : 'Mã Xã/Phường *'}
            value={formData.code}
            disabled={editingId !== null}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            placeholder={isProvince ? 'ví dụ: TP_HCM, HA_NOI' : 'ví dụ: Q1, Q2'}

          />
          <Input
            key="name-input"
            label={isProvince ? 'Tên Tỉnh/Thành phố *' : 'Tên Xã/Phường *'}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder={isProvince ? 'ví dụ: Thành phố Hồ Chí Minh' : 'ví dụ: Quận 1'}
          />
        </div>
        <div className="flex gap-2 mt-6">
          <Button
            onClick={handleSubmit}
          >
            {editingId ? 'Cập nhật' : 'Thêm mới'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setViewMode('list');
              resetForm();
            }}
          >
            Hủy
          </Button>
        </div>
      </div>
    );
  };

  return (
    <>
      <Card>
        {(viewMode === 'list' || viewMode === 'configure') && (
          <Tabs
            tabs={['Tỉnh/Thành phố', 'Xã/Phường', 'Phòng Giao Dịch', 'Cấu hình']}
            activeTab={activeTab}
            onChange={(tab) => {
              setActiveTab(tab);
              setViewMode('list');
            }}
          />
        )}

        {(viewMode === 'list' || viewMode === 'configure') && activeTab === 'Cấu hình' ? (
          ConfigurationView()
        ) : viewMode === 'list' ? (
          <>
            {activeTab === 'Tỉnh/Thành phố' && <ProvinceView />}
            {activeTab === 'Xã/Phường' && <DistrictView />}
            {activeTab === 'Phòng Giao Dịch' && <TransactionOfficeView />}
          </>
        ) : (
          RenderAddForm()
        )}
      </Card>

      {/* Delete Confirmation Modals */}
      <Modal
        isOpen={deleteModal.isOpen && deleteModal.type === 'province'}
        title="Xóa tỉnh/thành phố"
        message="Bạn chắc chắn muốn xóa tỉnh/thành phố này?"
        type="warning"
        onConfirm={confirmDeleteProvince}
        onCancel={() => setDeleteModal({ isOpen: false, type: 'province', action: 'delete', id: null })}
        confirmText="Xóa"
        cancelText="Hủy"
      />

      <Modal
        isOpen={deleteModal.isOpen && deleteModal.type === 'district'}
        title="Xóa quận/huyện"
        message="Bạn chắc chắn muốn xóa quận/huyện này?"
        type="warning"
        onConfirm={confirmDeleteDistrict}
        onCancel={() => setDeleteModal({ isOpen: false, type: 'district', action: 'delete', id: null })}
        confirmText="Xóa"
        cancelText="Hủy"
      />

      <Modal
        isOpen={deleteModal.isOpen && deleteModal.type === 'office'}
        title={deleteModal.action === 'deactivate' ? 'Vô hiệu hóa phòng giao dịch' : 'Khôi phục phòng giao dịch'}
        message={
          deleteModal.action === 'deactivate'
            ? 'Bạn có chắc chắn muốn vô hiệu hóa phòng giao dịch này? Tất cả Kiosk, Quầy và Màn hình thuộc phòng này sẽ bị ngừng hoạt động.'
            : 'Bạn có chắc chắn muốn khôi phục phòng giao dịch này? Lưu ý: Thiết bị cần được kích hoạt riêng.'
        }
        type="warning"
        onConfirm={confirmDeleteTransactionOffice}
        onCancel={() => setDeleteModal({ isOpen: false, type: 'office', action: 'delete', id: null })}
        confirmText={deleteModal.action === 'deactivate' ? 'Vô hiệu hóa' : 'Khôi phục'}
        cancelText="Hủy"
      />

      <Modal
        isOpen={deleteModal.isOpen && deleteModal.type === 'config'}
        title="Xóa cấu hình"
        message="Bạn chắc chắn muốn xóa cấu hình này?"
        type="warning"
        onConfirm={confirmDeleteConfiguration}
        onCancel={() => setDeleteModal({ isOpen: false, type: 'config', action: 'delete', id: null })}
        confirmText="Xóa"
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
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
    </>
  );
};

export default PGDManager;
