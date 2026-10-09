import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Input, Select, Tabs, Modal } from '../components/UIComponents';
import { Plus, Edit2, Ban, Check, X, AlertCircle, Loader, Upload, Image as ImageIcon, Video, Tv, CheckCircle, XCircle, Search, RefreshCw } from 'lucide-react';
import type { Province, District, TransactionOffice, Service, ServiceGroup, Kiosk } from '../types';
import api from '../services/api';

interface FormData {
  transaction_office_id: number | '';
  service_group_ids: number[];
  name: string;
  code: string;
}

interface CounterFormData {
  transaction_office_id: number | '';
  name: string;
  code: string;
  led_number: number;
}

interface ServiceConfig {
  service_id: number;
  service_name: string;
  is_serving: boolean;
  priority_level: number;
}

interface Counter {
  id: number;
  code: string;
  name: string;
  led_number: number;
  status?: string;
  is_active?: boolean;
  transaction_office_id: number;
  transaction_office?: any;
  services: Array<{
    service_id: number;
    service_name: string;
    priority_level: number;
  }>;
  service_count: number;
  priority_count: number;
  created_at?: string;
}

interface EBoard {
  id: number;
  transaction_office_id: number;
  code: string;
  name: string;
  display_video: boolean;
  voice_call_number: string | null;
  status?: string;
  is_active?: boolean;
  created_at?: string;
  TransactionOffice?: {
    id: number;
    name: string;
  };
  counters?: Array<{
    id: number;
    code: string;
    name: string;
  }>;
  EBoardMedia?: Array<{
    id: number;
    file_type: 'image' | 'video';
    file_url: string;
    description: string | null;
    sort_order: number;
  }>;
}

interface MediaFile {
  id?: number; // Only present for existing media from database
  file_type: 'image' | 'video';
  file_url: string;
  description: string;
  sort_order: number;
}

interface EBoardFormData {
  transaction_office_id: string;
  code: string;
  name: string;
  display_video: boolean;
  voice_call_number: string;
  counter_ids: number[];
  media: MediaFile[];
}

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

const DeviceManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState('Kiosk');
  const [viewMode, setViewMode] = useState<'list' | 'add' | 'edit'>('list');
  const [isLoading, setIsLoading] = useState(false);

  // Toast notifications
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'error' }>>([]);

  // Data states
  const [kiosks, setKiosks] = useState<Kiosk[]>([]);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [eboards, setEBoards] = useState<EBoard[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [offices, setOffices] = useState<TransactionOffice[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [serviceGroups, setServiceGroups] = useState<ServiceGroup[]>([]);
  const [eboardCounters, setEBoardCounters] = useState<Counter[]>([]);

  // Filter states
  const [selectedProvince, setSelectedProvince] = useState<number | ''>('');
  const [selectedDistrict, setSelectedDistrict] = useState<number | ''>('');
  const [selectedOffice, setSelectedOffice] = useState<number | ''>('');
  const [searchKeyword, setSearchKeyword] = useState('');

  // Form states
  const [formData, setFormData] = useState<FormData>({
    transaction_office_id: '',
    service_group_ids: [],
    name: '',
    code: '',
  });
  const [counterFormData, setCounterFormData] = useState<CounterFormData>({
    transaction_office_id: '',
    name: '',
    code: '',
    led_number: 0,
  });
  const [servicesConfig, setServicesConfig] = useState<ServiceConfig[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([]);
  const [serviceSearchKeyword, setServiceSearchKeyword] = useState('');
  const [kioskServiceGroupSearchKeyword, setKioskServiceGroupSearchKeyword] = useState('');
  const [kioskServiceSearchKeyword, setKioskServiceSearchKeyword] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [eboardFormData, setEBoardFormData] = useState<EBoardFormData>({
    transaction_office_id: '',
    code: '',
    name: '',
    display_video: false,
    voice_call_number: 'north',
    counter_ids: [],
    media: [],
  });
  const [eboardFormTab, setEBoardFormTab] = useState('general');
  const [uploadedTempFiles, setUploadedTempFiles] = useState<string[]>([]); // Track newly uploaded files
  const [shouldCleanupOnUnmount, setShouldCleanupOnUnmount] = useState(false); // Flag to control cleanup behavior
  const [mediaToDeleteOnSubmit, setMediaToDeleteOnSubmit] = useState<Array<{ id?: number; file_url: string }>>([]);
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    id: string | number | null;
    type: 'kiosk' | 'counter' | 'eboard';
    action: 'deactivate' | 'reactivate';
  }>({
    isOpen: false,
    id: null,
    type: 'kiosk',
    action: 'deactivate',
  });

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

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const toValidNumber = (value: unknown): number | '' => {
    if (value === '' || value === null || value === undefined) {
      return '';
    }

    const num = Number(value);
    return Number.isFinite(num) ? num : '';
  };

  const isValidNumber = (value: unknown): value is number => (
    typeof value === 'number' && Number.isFinite(value)
  );

  // Cleanup uploaded temp files when component unmounts or when cancel form
  const cleanupUploadedFiles = async () => {
    if (uploadedTempFiles.length === 0) {
      console.log('No temp files to cleanup');
      return;
    }

    console.log('Starting cleanup for files:', uploadedTempFiles);

    try {
      for (const filePath of uploadedTempFiles) {
        try {
          console.log(`Attempting to cleanup: ${filePath}`);
          const response = await api.delete('/devices/media/cleanup', {
            data: { file_path: filePath },
          });

          console.log(`Cleanup response for ${filePath}:`, response.data);
        } catch (err) {
          console.error(`Failed to cleanup file ${filePath}:`, err);
        }
      }
      setUploadedTempFiles([]);
      console.log('Cleanup completed, uploadedTempFiles cleared');
    } catch (err) {
      console.error('Error cleaning up uploaded files:', err);
    }
  };

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      // Only cleanup if flag is set (user cancelled form) and we have temp files
      if (shouldCleanupOnUnmount && uploadedTempFiles.length > 0) {
        cleanupUploadedFiles();
      }
    };
  }, [uploadedTempFiles, shouldCleanupOnUnmount]);

  useEffect(() => {
    loadProvinces();
  }, []);
  // Load provinces on mount
  useEffect(() => {
    if (viewMode === 'list') {
      if (activeTab === 'Kiosk') {
        loadKiosksList();
      } else if (activeTab === 'Counter') {
        loadCounters();
      } else if (activeTab === 'E Center Board') {
        loadEBoards();
      }
    }
  }, [viewMode, activeTab]);

  // Load districts when province changes
  useEffect(() => {
    if (isValidNumber(selectedProvince)) {
      loadDistricts(selectedProvince);
    } else {
      setDistricts([]);
      setSelectedDistrict('');
      setOffices([]);
      setSelectedOffice('');
    }
  }, [selectedProvince]);

  // Load offices when district changes
  useEffect(() => {
    if (isValidNumber(selectedDistrict)) {
      loadOffices(selectedDistrict);
    } else {
      setOffices([]);
      setSelectedOffice('');
    }
  }, [selectedDistrict]);

  // Load services and service groups when office selected
  useEffect(() => {
    if (activeTab !== 'Kiosk' && activeTab !== 'Counter') {
      return;
    }

    if (isValidNumber(selectedOffice)) {
      loadServicesAndServiceGroups();
    } else {
      setServices([]);
      setServiceGroups([]);
      setFormData(prev => ({ ...prev, service_group_ids: [] }));
      setSelectedServiceIds([]);
    }
  }, [selectedOffice, activeTab]);

  const loadProvinces = async () => {
    try {
      const response = await api.get('/provinces');
      setProvinces(response.data.data || []);
    } catch (err) {
      console.error('Error loading provinces:', err);
    }
  };

  const loadDistricts = async (provinceId: number) => {
    if (!Number.isFinite(provinceId)) {
      return;
    }

    try {
      const response = await api.get('/districts', {
        params: { province_id: provinceId }
      });
      setDistricts(response.data.data || []);
    } catch (err) {
      console.error('Error loading districts:', err);
    }
  };

  const loadOffices = async (districtId: number, activeOnly: boolean = true) => {
    if (!Number.isFinite(districtId)) {
      return;
    }

    try {
      const response = await api.get('/transaction-offices', {
        params: {
          district_id: districtId,
          active_only: activeOnly,
        }
      });
      setOffices(response.data.data || []);
    } catch (err) {
      console.error('Error loading offices:', err);
    }
  };

  const loadServicesAndServiceGroups = async () => {
    if (!isValidNumber(selectedOffice)) {
      return;
    }

    try {
      const officeId = selectedOffice;
      const [servicesRes, groupsRes] = await Promise.all([
        api.get('/services', { params: { transaction_office_id: officeId } }),
        api.get('/service-groups', { params: { transaction_office_id: officeId } }),
      ]);

      // Sort services: selected ones first, then others
      const allServices = servicesRes.data.data || [];
      const sortedServices = allServices.sort((a: Service, b: Service) => {
        const aSelected = selectedServiceIds.includes(Number(a.id)) ? 0 : 1;
        const bSelected = selectedServiceIds.includes(Number(b.id)) ? 0 : 1;
        return aSelected - bSelected;
      });

      setServices(sortedServices);
      setServiceGroups(groupsRes.data.data || []);
    } catch (err) {
      console.error('Error loading services/groups:', err);
    }
  };

  const loadKiosksList = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/kiosks');
      setKiosks(response.data.data || []);
    } catch (err: any) {
      // Nếu là lỗi authentication (401/403), không cần xử lý gì - interceptor đã redirect
      if (err.response?.status === 401 || err.response?.status === 403) {
        return; // Dừng ngay, không set state
      }
      showToast('Lỗi khi tải danh sách kiosks', 'error');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCounters = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/counters');
      setCounters(response.data.data || []);
    } catch (err: any) {
      // Nếu là lỗi authentication (401/403), không cần xử lý gì - interceptor đã redirect
      if (err.response?.status === 401 || err.response?.status === 403) {
        return; // Dừng ngay, không set state
      }
      showToast('Lỗi khi tải danh sách counters', 'error');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddClick = () => {
    setEditingId(null);
    setSelectedProvince('');
    setSelectedDistrict('');
    setSelectedOffice('');
    setSelectedServiceIds([]);
    setKioskServiceGroupSearchKeyword('');
    setKioskServiceSearchKeyword('');
    setFormData({
      transaction_office_id: '',
      service_group_ids: [],
      name: '',
      code: '',
    });
    setViewMode('add');
  };

  const handleEditClick = async (kiosk: Kiosk) => {
    setEditingId(Number(kiosk.id));
    try {
      setFormData({
        transaction_office_id: kiosk.locationId || '',
        service_group_ids: kiosk.serviceGroupIds || [],
        name: kiosk.name,
        code: kiosk.code,
      });
      setSelectedServiceIds(kiosk.serviceIds || []);

      // Load province/district/office hierarchy for the form dropdowns
      if (kiosk.locationId) {
        await loadHierarchyForOffice(kiosk.locationId);
      }
    } catch (err) {
      console.error('Error loading kiosk details:', err);
      showToast('Lỗi khi tải chi tiết kiosk', 'error');
    }

    setViewMode('edit');
  };

  // Load province -> district -> office hierarchy when editing
  const loadHierarchyForOffice = async (officeId: number) => {
    try {
      const officeRes = await api.get(`/transaction-offices/${officeId}`);
      const office = officeRes.data?.data;
      const provinceId = toValidNumber(office?.province_id);
      const districtId = toValidNumber(office?.district_id);

      if (provinceId !== '' && districtId !== '') {
        // Set hierarchy states; existing useEffects will fetch districts/offices/services.
        setSelectedProvince(provinceId);
        setSelectedDistrict(districtId);
        setSelectedOffice(officeId);
      }
    } catch (err) {
      console.error('Error loading hierarchy:', err);
    }
  };

  const handleSearch = () => {
    // Filter kiosks based on search keyword and selected filters
    if (!searchKeyword.trim()) {
      // If search is empty, reload all kiosks with current filters
      loadKiosksList();
      return;
    }

    const filtered = kiosks.filter(kiosk => {
      const matchesKeyword = (kiosk.name?.toLowerCase() || '').includes(searchKeyword.toLowerCase()) ||
        (kiosk.code?.toLowerCase() || '').includes(searchKeyword.toLowerCase()) ||
        (kiosk.location?.toLowerCase() || '').includes(searchKeyword.toLowerCase());

      const matchesOffice = !selectedOffice || kiosk.locationId === selectedOffice;

      return matchesKeyword && matchesOffice;
    });

    setKiosks(filtered);
  };

  const handleClearSearch = () => {
    setSearchKeyword('');
    loadKiosksList();
  };

  const handleDeleteKiosk = async (id: string | number) => {
    setDeleteModal({ isOpen: true, id, type: 'kiosk', action: 'deactivate' });
  };

  const handleReactivateKiosk = async (id: string | number) => {
    setDeleteModal({ isOpen: true, id, type: 'kiosk', action: 'reactivate' });
  };

  const confirmDeleteKiosk = async () => {
    if (!deleteModal.id) return;

    try {
      setIsLoading(true);
      await api.delete(`/kiosks/${deleteModal.id}`);
      showToast('Kiosk đã được vô hiệu hóa thành công', 'success');
      loadKiosksList();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Lỗi khi vô hiệu hóa kiosk', 'error');
      console.error(err);
    } finally {
      setIsLoading(false);
      setDeleteModal({ isOpen: false, id: null, type: 'kiosk', action: 'deactivate' });
    }
  };

  // ========== COUNTER HANDLERS ==========
  const handleAddCounter = () => {
    setEditingId(null);
    setSelectedProvince('');
    setSelectedDistrict('');
    setSelectedOffice('');
    setCounterFormData({
      transaction_office_id: '',
      name: '',
      code: '',
      led_number: 0,
    });
    setServicesConfig([]);
    setServiceSearchKeyword('');
    setViewMode('add');
  };

  const handleEditCounter = async (counter: Counter) => {
    setEditingId(Number(counter.id));
    setCounterFormData({
      transaction_office_id: Number(counter.transaction_office_id),
      name: counter.name,
      code: counter.code,
      led_number: counter.led_number || 0,
    });

    // Load hierarchy for office
    if (counter.transaction_office_id) {
      await loadHierarchyForOffice(counter.transaction_office_id);
    }

    // Initialize services config from counter.services
    if (counter.services && counter.services.length > 0) {
      setServicesConfig(
        counter.services.map(s => ({
          service_id: s.service_id,
          service_name: s.service_name,
          is_serving: true,
          priority_level: s.priority_level || 1,
        }))
      );
    }

    setViewMode('edit');
  };

  const handleDeleteCounter = async (id: string | number) => {
    setDeleteModal({ isOpen: true, id, type: 'counter', action: 'deactivate' });
  };

  const handleReactivateCounter = async (id: string | number) => {
    setDeleteModal({ isOpen: true, id, type: 'counter', action: 'reactivate' });
  };

  const confirmDeleteCounter = async () => {
    if (!deleteModal.id) return;

    try {
      setIsLoading(true);
      await api.delete(`/counters/${deleteModal.id}`);
      showToast('Counter đã được vô hiệu hóa thành công', 'success');
      loadCounters();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Lỗi khi vô hiệu hóa counter', 'error');
      console.error(err);
    } finally {
      setIsLoading(false);
      setDeleteModal({ isOpen: false, id: null, type: 'kiosk', action: 'deactivate' });
    }
  };

  const handleCounterFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCounterFormData(prev => ({
      ...prev,
      [name]: name === 'led_number' ? Number(value) : value,
    }));
  };

  // ========== E-BOARD FUNCTIONS ==========

  const loadEBoards = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/eboards');
      setEBoards(response.data.data || []);
    } catch (err: any) {
      // Nếu là lỗi authentication (401/403), không cần xử lý gì - interceptor đã redirect
      if (err.response?.status === 401 || err.response?.status === 403) {
        return; // Dừng ngay, không set state
      }
      showToast('Lỗi khi tải danh sách E-Board', 'error');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadEBoardCounters = async (officeId: number) => {
    if (!Number.isFinite(officeId)) {
      setEBoardCounters([]);
      return [];
    }

    try {
      const response = await api.get('/counters', {
        params: {
          office_id: officeId,
          active_only: true,
        }
      });
      const activeCounters = response.data.data || [];
      setEBoardCounters(activeCounters);
      return activeCounters;
    } catch (err) {
      console.error('Error loading eboard counters:', err);
      setEBoardCounters([]);
      return [];
    }
  };

  const handleAddEBoard = () => {
    setEditingId(null);
    setSelectedProvince('');
    setSelectedDistrict('');
    setSelectedOffice('');
    setEBoardFormData({
      transaction_office_id: '',
      code: '',
      name: '',
      display_video: false,
      voice_call_number: 'north',
      counter_ids: [],
      media: [],
    });
    setEBoardCounters([]);
    setEBoardFormTab('general');
    setViewMode('add');
  };

  const handleEditEBoard = async (eboard: EBoard) => {
    try {
      setIsLoading(true);
      const response = await api.get(`/eboards/${eboard.id}`);
      const latestEBoard = response.data.data;
      const selectedCounterIds = latestEBoard.counters?.map((c: any) => c.id) || [];

      setEditingId(latestEBoard.id);
      setEBoardFormData({
        transaction_office_id: latestEBoard.transaction_office_id.toString(),
        code: latestEBoard.code,
        name: latestEBoard.name,
        display_video: latestEBoard.display_video,
        voice_call_number: latestEBoard.voice_call_number || 'north',
        counter_ids: selectedCounterIds,
        media: latestEBoard.EBoardMedia?.map((m: any) => ({
          id: m.id,
          file_type: m.file_type,
          file_url: m.file_url,
          description: m.description || '',
          sort_order: m.sort_order,
        })) || [],
      });

      // Show edit form first, then hydrate dependent dropdown data.
      setEBoardFormTab('general');
      setViewMode('edit');

      if (latestEBoard.transaction_office_id) {
        const [activeCounters] = await Promise.all([
          loadEBoardCounters(latestEBoard.transaction_office_id),
          loadHierarchyForOffice(latestEBoard.transaction_office_id),
        ]);
        const activeCounterIds = new Set(activeCounters.map((c: any) => Number(c.id)));

        setEBoardFormData(prev => ({
          ...prev,
          counter_ids: prev.counter_ids.filter(counterId => activeCounterIds.has(Number(counterId))),
        }));
      }
    } catch (err) {
      showToast('Lỗi khi tải E-Board', 'error');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteEBoard = (id: number) => {
    setDeleteModal({ isOpen: true, id, type: 'eboard', action: 'deactivate' });
  };

  const handleReactivateEBoard = async (id: number) => {
    setDeleteModal({ isOpen: true, id, type: 'eboard', action: 'reactivate' });
  };

  const confirmReactivateKiosk = async () => {
    if (!deleteModal.id) return;

    try {
      setIsLoading(true);
      await api.put(`/kiosks/${deleteModal.id}/reactivate`);
      showToast('Kiosk đã được khôi phục thành công', 'success');
      loadKiosksList();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Lỗi khi khôi phục kiosk', 'error');
      console.error(err);
    } finally {
      setIsLoading(false);
      setDeleteModal({ isOpen: false, id: null, type: 'kiosk', action: 'deactivate' });
    }
  };

  const confirmReactivateCounter = async () => {
    if (!deleteModal.id) return;

    try {
      setIsLoading(true);
      await api.put(`/counters/${deleteModal.id}/reactivate`);
      showToast('Counter đã được khôi phục thành công', 'success');
      loadCounters();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Lỗi khi khôi phục counter', 'error');
      console.error(err);
    } finally {
      setIsLoading(false);
      setDeleteModal({ isOpen: false, id: null, type: 'kiosk', action: 'deactivate' });
    }
  };

  const confirmReactivateEBoard = async () => {
    if (!deleteModal.id) return;

    try {
      setIsLoading(true);
      await api.put(`/eboards/${deleteModal.id}/reactivate`);
      showToast('E-Board đã được khôi phục thành công', 'success');
      loadEBoards();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Lỗi khi khôi phục E-Board', 'error');
      console.error(err);
    } finally {
      setIsLoading(false);
      setDeleteModal({ isOpen: false, id: null, type: 'kiosk', action: 'deactivate' });
    }
  };

  const confirmDeleteEBoard = async () => {
    if (!deleteModal.id) return;

    try {
      setIsLoading(true);
      await api.delete(`/eboards/${deleteModal.id}`);
      showToast('E-Board đã được vô hiệu hóa thành công', 'success');
      loadEBoards();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Lỗi khi vô hiệu hóa E-Board', 'error');
      console.error(err);
    } finally {
      setIsLoading(false);
      setDeleteModal({ isOpen: false, id: null, type: 'kiosk', action: 'deactivate' });
    }
  };

  const handleEBoardFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const parsedOfficeId = name === 'transaction_office_id' ? toValidNumber(value) : value;
    setEBoardFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : parsedOfficeId,
    }));

    // Load counters when office changes
    if (name === 'transaction_office_id' && parsedOfficeId !== '') {
      loadEBoardCounters(parsedOfficeId as number);
      setEBoardFormData(prev => ({ ...prev, counter_ids: [] }));
    } else if (name === 'transaction_office_id') {
      setEBoardCounters([]);
    }
  };

  const handleEBoardCounterToggle = (counterId: number) => {
    setEBoardFormData(prev => ({
      ...prev,
      counter_ids: prev.counter_ids.includes(counterId)
        ? prev.counter_ids.filter(id => id !== counterId)
        : [...prev.counter_ids, counterId],
    }));
  };

  const handleAddMedia = () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*,video/*';
    fileInput.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (file) {
        try {
          // Create blob URL locally without uploading to server yet
          const blobUrl = URL.createObjectURL(file);

          // Determine file type
          const fileType = file.type.startsWith('image/') ? 'image' : 'video';

          setEBoardFormData(prev => ({
            ...prev,
            media: [...prev.media, {
              file: file, // Store the actual file object for later upload
              file_type: fileType,
              file_url: blobUrl, // Use blob URL locally
              description: file.name,
              sort_order: prev.media.length,
            }],
          }));
          showToast('File tải lên thành công (chưa lưu)', 'success');
        } catch (err) {
          showToast('Lỗi khi tải file', 'error');
          console.error(err);
        }
      }
    };
    fileInput.click();
  };

  const handleRemoveMedia = (index: number) => {
    const mediaToRemove = eboardFormData.media[index];

    // Mark media for deletion on submit
    if (mediaToRemove && mediaToRemove.file_url) {
      setMediaToDeleteOnSubmit(prev => [...prev, {
        id: (mediaToRemove as any).id,
        file_url: mediaToRemove.file_url,
      }]);
    }

    // Hide from UI immediately (but don't remove permanently until submit)
    setEBoardFormData(prev => ({
      ...prev,
      media: prev.media.filter((_, i) => i !== index),
    }));

    showToast('Ảnh sẽ được xóa khi bạn cập nhật', 'success');
  };

  const handleMediaReorder = (index: number, direction: 'up' | 'down') => {
    const newMedia = [...eboardFormData.media];
    const newIndex = direction === 'up' ? index - 1 : index + 1;

    if (newIndex >= 0 && newIndex < newMedia.length) {
      [newMedia[index], newMedia[newIndex]] = [newMedia[newIndex], newMedia[index]];
      newMedia.forEach((item, i) => item.sort_order = i);

      setEBoardFormData(prev => ({ ...prev, media: newMedia }));
    }
  };

  const handleEBoardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!eboardFormData.transaction_office_id || !eboardFormData.name || !eboardFormData.code) {
      showToast('Vui lòng điền tất cả các trường bắt buộc', 'error');
      return;
    }

    try {
      setIsLoading(true);

      // Step 1: Delete marked media files from server/database
      if (mediaToDeleteOnSubmit.length > 0) {
        for (const media of mediaToDeleteOnSubmit) {
          try {
            if (media.id) {
              // Delete saved media from database
              await api.delete(`/eboards/media/${media.id}`);
            } else if (media.file_url && !media.file_url.startsWith('blob:')) {
              // Delete temporary uploaded file from server
              await api.delete('/devices/media/cleanup', {
                data: { file_path: media.file_url },
              });
            }
            // Skip cleanup for blob URLs (they don't exist on server)
          } catch (deleteErr) {
            console.error('Failed to delete media:', deleteErr);
            // Continue with other deletions even if one fails
          }
        }
        setMediaToDeleteOnSubmit([]);
      }

      // Step 2: Upload new media files (those with blob URLs) to server
      const mediaToProcess = await Promise.all(
        eboardFormData.media.map(async (m) => {
          if (m.file_url && m.file_url.startsWith('blob:')) {
            // This is a new file that needs to be uploaded
            if ((m as any).file) {
              const formData = new FormData();
              formData.append('file', (m as any).file);

              try {
                const response = await api.post('/devices/media/upload', formData, {
                  headers: { 'Content-Type': 'multipart/form-data' },
                });

                // Return media with uploaded URL
                return {
                  file_type: response.data.data.file_type,
                  file_url: response.data.data.file_url,
                  description: m.description,
                  sort_order: m.sort_order,
                  ...(m.id && { id: m.id }),
                };
              } catch (uploadErr) {
                console.error('Failed to upload media:', uploadErr);
                throw uploadErr;
              }
            }
          }
          // Existing media (from database)
          return {
            id: m.id,
            file_type: m.file_type,
            file_url: m.file_url,
            description: m.description,
            sort_order: m.sort_order,
          };
        })
      );

      const payload = {
        transaction_office_id: Number(eboardFormData.transaction_office_id),
        code: eboardFormData.code,
        name: eboardFormData.name,
        display_video: eboardFormData.display_video,
        voice_call_number: eboardFormData.voice_call_number,
        counter_ids: eboardFormData.counter_ids.filter(counterId =>
          eboardCounters.some(counter => Number(counter.id) === Number(counterId))
        ),
        media: mediaToProcess,
      };

      if (editingId) {
        await api.put(`/eboards/${editingId}`, payload);
      } else {
        await api.post('/eboards', payload);
      }

      showToast(editingId ? 'E-Board đã được cập nhật' : 'E-Board đã được thêm', 'success');
      setViewMode('list');
      setUploadedTempFiles([]);
      await loadEBoards();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Lỗi khi lưu E-Board', 'error');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleServiceServeToggle = (serviceId: number, serviceName: string) => {
    const targetService = services.find(s => Number(s.id) === serviceId);
    if (targetService && targetService.is_active === false) {
      return;
    }

    setServicesConfig(prev => {
      const exists = prev.find(s => s.service_id === serviceId);
      if (exists) {
        // Remove from list
        return prev.filter(s => s.service_id !== serviceId);
      } else {
        // Add to list with default priority 1
        return [...prev, { service_id: serviceId, service_name: serviceName, is_serving: true, priority_level: 1 }];
      }
    });
  };

  const handleServicePriorityChange = (serviceId: number, priority: number) => {
    setServicesConfig(prev =>
      prev.map(s => (s.service_id === serviceId ? { ...s, priority_level: priority } : s))
    );
  };

  const handleSelectAllServices = () => {
    // Filter services based on search
    const activeServiceIds = new Set(
      services
        .filter(s => s.is_active !== false)
        .map(s => Number(s.id))
    );

    const filteredServices = services.filter(s => {
      if (!activeServiceIds.has(Number(s.id))) {
        return false;
      }
      return (
        (s.name?.toLowerCase() || '').includes(serviceSearchKeyword.toLowerCase()) ||
        (s.code?.toLowerCase() || '').includes(serviceSearchKeyword.toLowerCase())
      );
    });

    const selectedActiveCount = servicesConfig.filter(config =>
      filteredServices.find(s => Number(s.id) === config.service_id)
    ).length;

    if (selectedActiveCount === filteredServices.length) {
      // If all visible services are selected, deselect all
      setServicesConfig(prevConfig =>
        prevConfig.filter(config =>
          !filteredServices.find(s => s.id === config.service_id)
        )
      );
    } else {
      // Select all visible services
      const newConfigs = filteredServices.map(service => {
        const serviceId = Number(service.id);
        const existing = servicesConfig.find(s => s.service_id === serviceId);
        return existing || {
          service_id: serviceId,
          service_name: service.name || '',
          is_serving: true,
          priority_level: 1,
        };
      });
      setServicesConfig(newConfigs);
    }
  };

  // Handle select all service groups for Kiosk
  const handleSelectAllServiceGroups = () => {
    const filteredGroups = serviceGroups.filter(sg => {
      if (sg.is_active === false) {
        return false;
      }
      return (
        (sg.name?.toLowerCase() || '').includes(kioskServiceGroupSearchKeyword.toLowerCase()) ||
        (sg.code?.toLowerCase() || '').includes(kioskServiceGroupSearchKeyword.toLowerCase())
      );
    });

    const selectedActiveCount = filteredGroups.filter(sg =>
      formData.service_group_ids.includes(Number(sg.id))
    ).length;

    if (selectedActiveCount === filteredGroups.length) {
      // If all visible groups are selected, deselect all
      setFormData(prev => ({
        ...prev,
        service_group_ids: prev.service_group_ids.filter(id =>
          !filteredGroups.find(sg => sg.id === id)
        ),
      }));
    } else {
      // Select all visible groups
      const newGroupIds = filteredGroups.map(sg => Number(sg.id));
      setFormData(prev => ({
        ...prev,
        service_group_ids: Array.from(new Set([...prev.service_group_ids, ...newGroupIds])),
      }));
    }
  };

  // Handle select all services for Kiosk
  const handleSelectAllKioskServices = () => {
    const filteredServices = services.filter(s => {
      if (s.is_active === false) {
        return false;
      }
      return (
        (s.name?.toLowerCase() || '').includes(kioskServiceSearchKeyword.toLowerCase()) ||
        (s.code?.toLowerCase() || '').includes(kioskServiceSearchKeyword.toLowerCase())
      );
    });

    const selectedActiveCount = filteredServices.filter(s =>
      selectedServiceIds.includes(Number(s.id))
    ).length;

    if (selectedActiveCount === filteredServices.length) {
      // If all visible services are selected, deselect all
      setSelectedServiceIds(prev =>
        prev.filter(id => !filteredServices.find(s => s.id === id))
      );
    } else {
      // Select all visible services
      const newServiceIds = filteredServices.map(s => Number(s.id));
      setSelectedServiceIds(prev => Array.from(new Set([...prev, ...newServiceIds])));
    }
  };

  const handleCounterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedCode = counterFormData.code.trim();
    const normalizedName = counterFormData.name.trim();

    const activeServiceIds = new Set(
      services
        .filter(service => service.is_active !== false)
        .map(service => Number(service.id))
    );
    const activeServingConfigs = servicesConfig.filter(
      config => config.is_serving && activeServiceIds.has(Number(config.service_id))
    );

    // Validation
    if (!counterFormData.transaction_office_id || !normalizedName || !normalizedCode) {
      showToast('Vui lòng điền tất cả các trường bắt buộc', 'error');
      return;
    }

    const duplicateCounter = counters.find(counter =>
      Number(counter.transaction_office_id) === Number(counterFormData.transaction_office_id) &&
      (counter.code || '').trim().toLowerCase() === normalizedCode.toLowerCase() &&
      Number(counter.id) !== Number(editingId)
    );

    if (duplicateCounter) {
      showToast('Mã counter đã tồn tại trong phòng giao dịch đã chọn', 'error');
      return;
    }

    if (activeServingConfigs.length === 0) {
      showToast('Vui lòng chọn ít nhất một dịch vụ', 'error');
      return;
    }

    try {
      setIsLoading(true);
      const payload = {
        transaction_office_id: Number(counterFormData.transaction_office_id),
        name: normalizedName,
        code: normalizedCode,
        led_number: counterFormData.led_number,
        services: activeServingConfigs
          .map(s => ({
            service_id: s.service_id,
            priority_level: s.priority_level,
          })),
      };

      if (editingId) {
        await api.put(`/counters/${editingId}`, payload);
      } else {
        await api.post('/counters', payload);
      }

      showToast(editingId ? 'Counter đã được cập nhật' : 'Counter đã được thêm', 'success');
      setViewMode('list');
      loadCounters();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Lỗi khi lưu counter', 'error');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'transaction_office_id' || name === 'service_group_id' ? (value ? Number(value) : '') : value,
    }));
  };

  const handleServiceGroupToggle = (groupId: number) => {
    const targetGroup = serviceGroups.find(group => Number(group.id) === groupId);
    if (targetGroup && targetGroup.is_active === false) {
      return;
    }

    setFormData(prev => {
      const ids = prev.service_group_ids.includes(groupId)
        ? prev.service_group_ids.filter(id => id !== groupId)
        : [...prev.service_group_ids, groupId];
      return { ...prev, service_group_ids: ids };
    });
  };

  const handleServiceToggle = (serviceId: number) => {
    const targetService = services.find(service => Number(service.id) === serviceId);
    if (targetService && targetService.is_active === false) {
      return;
    }

    setSelectedServiceIds(prev =>
      prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.transaction_office_id || !formData.name || !formData.code) {
      showToast('Vui lòng điền tất cả các trường bắt buộc', 'error');
      return;
    }

    // NEW: Validate at least one service group or service is selected
    if (formData.service_group_ids.length === 0 && selectedServiceIds.length === 0) {
      showToast('Vui lòng chọn ít nhất một Nhóm dịch vụ hoặc Dịch vụ', 'error');
      return;
    }

    try {
      setIsLoading(true);
      const payload = {
        ...formData,
        service_group_ids: formData.service_group_ids.filter(groupId => {
          const group = serviceGroups.find(item => Number(item.id) === groupId);
          return group?.is_active !== false;
        }),
        service_ids: selectedServiceIds.filter(serviceId => {
          const service = services.find(item => Number(item.id) === serviceId);
          return service?.is_active !== false;
        }),
      };

      if (editingId) {
        await api.put(`/kiosks/${editingId}`, payload);
      } else {
        await api.post('/kiosks', payload);
      }

      showToast(editingId ? 'Kiosk đã được cập nhật thành công' : 'Kiosk đã được thêm thành công', 'success');
      loadKiosksList();
      setViewMode('list');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Lỗi khi lưu kiosk', 'error');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const renderFormView = () => (
    <form onSubmit={handleSubmitForm} className="mt-6">
      {/* Main Container: 2 parallel columns */}
      <div className="flex flex-col md:flex-row gap-8">
        {/* LEFT COLUMN */}
        <div className="w-full md:w-1/2 flex flex-col gap-6">
          {/* Tỉnh/Thành phố */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tỉnh/Thành phố *</label>
            <select
              value={selectedProvince}
              onChange={(e) => setSelectedProvince(toValidNumber(e.target.value))}
              className="w-full border border-gray-300 rounded-md py-2.5 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">-- Chọn Tỉnh/Thành phố --</option>
              {provinces.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Xã/Phường */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Xã/Phường *</label>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(toValidNumber(e.target.value))}
              disabled={!selectedProvince}
              className="w-full border border-gray-300 rounded-md py-2.5 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">-- Chọn Xã/Phường --</option>
              {districts.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Phòng giao dịch */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phòng giao dịch *</label>
            <select
              value={selectedOffice}
              onChange={(e) => {
                const officeId = toValidNumber(e.target.value);
                setSelectedOffice(officeId);
                setFormData(prev => ({
                  ...prev,
                  transaction_office_id: officeId,
                  service_group_ids: [], // ✅ Clear selected groups when office changes
                }));
              }}
              disabled={!selectedDistrict}
              className="w-full border border-gray-300 rounded-md py-2.5 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">-- Chọn Phòng giao dịch --</option>
              {offices.map(o => (
                <option key={o.id} value={o.id}>({o.code}) - {o.name}</option>
              ))}
            </select>
          </div>

          {/* Service Groups - Visible only when Office selected */}
          {selectedOffice && (
            <div className="pt-4 border-t-2 border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <label className=" text-md font-medium ">Chọn nhóm dịch vụ</label>
                {serviceGroups.length > 0 && (
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                    <input
                      type="text"
                      placeholder="Tìm nhóm..."
                      value={kioskServiceGroupSearchKeyword}
                      onChange={(e) => setKioskServiceGroupSearchKeyword(e.target.value)}
                      className="text-sm border border-gray-300 rounded-lg pl-7 pr-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                )}
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Toolbar */}
                {serviceGroups.length > 0 && (
                  <div className="flex items-center justify-between bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        ref={input => {
                          if (input) {
                            const filteredGroups = serviceGroups.filter(sg =>
                              sg.is_active !== false &&
                              (
                                (sg.name?.toLowerCase() || '').includes(kioskServiceGroupSearchKeyword.toLowerCase()) ||
                                (sg.code?.toLowerCase() || '').includes(kioskServiceGroupSearchKeyword.toLowerCase())
                              )
                            );
                            const allSelected = filteredGroups.length > 0 &&
                              filteredGroups.every(sg => formData.service_group_ids.includes(Number(sg.id)));
                            const someSelected = filteredGroups.some(sg => formData.service_group_ids.includes(Number(sg.id)));

                            input.checked = allSelected;
                            input.indeterminate = someSelected && !allSelected;
                          }
                        }}
                        onChange={handleSelectAllServiceGroups}
                        className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="font-medium text-gray-700">
                        {(() => {
                          const filteredGroups = serviceGroups.filter(sg =>
                            sg.is_active !== false &&
                            (
                              (sg.name?.toLowerCase() || '').includes(kioskServiceGroupSearchKeyword.toLowerCase()) ||
                              (sg.code?.toLowerCase() || '').includes(kioskServiceGroupSearchKeyword.toLowerCase())
                            )
                          );
                          const selectedActiveCount = filteredGroups.filter(sg =>
                            formData.service_group_ids.includes(Number(sg.id))
                          ).length;
                          return `Chọn tất cả (${selectedActiveCount}/${filteredGroups.length})`;
                        })()}
                      </span>
                    </label>
                  </div>
                )}
                <div className="space-y-2 max-h-48 overflow-y-auto p-3 ">
                  {serviceGroups.length > 0 ? (
                    serviceGroups
                      .filter(sg => {
                        const isSelected = formData.service_group_ids.includes(Number(sg.id));
                        const isVisible = sg.is_active !== false || isSelected;
                        if (!isVisible) {
                          return false;
                        }
                        return (
                          (sg.name?.toLowerCase() || '').includes(kioskServiceGroupSearchKeyword.toLowerCase()) ||
                          (sg.code?.toLowerCase() || '').includes(kioskServiceGroupSearchKeyword.toLowerCase())
                        );
                      })
                      .map(sg => {
                        const isInactive = sg.is_active === false;
                        return (
                          <label
                            key={sg.id}
                            className={`flex items-center p-2 rounded transition ${isInactive ? 'bg-gray-100 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'}`}
                          >
                            <input
                              type="checkbox"
                              checked={formData.service_group_ids.includes(Number(sg.id))}
                              onChange={() => handleServiceGroupToggle(Number(sg.id))}
                              disabled={isInactive}
                              className="w-4 h-4 text-blue-600 rounded cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                            />
                            <span className="ml-3 text-sm text-gray-700">
                              <strong>({sg.code})</strong> - {sg.name}
                              {isInactive && (
                                <span className="ml-2 inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
                                  Đã vô hiệu hóa
                                </span>
                              )}
                            </span>
                          </label>
                        )
                      })
                  ) : (
                    <p className="text-sm text-gray-500 p-2">Vui lòng chọn phòng giao dịch trước</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="w-full md:w-1/2 flex flex-col gap-6">
          {/* Mã kiosk */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mã Kiosk *</label>
            <input
              type="text"
              name="code"
              value={formData.code}
              onChange={handleFormChange}
              disabled={!!editingId}
              placeholder="VD: K01"
              className="w-full border border-gray-300 rounded-md py-2.5 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>

          {/* Tên kiosk */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tên Kiosk *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleFormChange}
              placeholder="VD: Kiosk Sảnh Chính"
              className="w-full border border-gray-300 rounded-md py-2.5 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Services - Visible only when Office selected */}
          {selectedOffice && (
            <div className="pt-4 border-t-2 border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <label className=" text-md font-medium ">Chọn dịch vụ</label>
                {services.length > 0 && (
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                    <input
                      type="text"
                      placeholder="Tìm dịch vụ..."
                      value={kioskServiceSearchKeyword}
                      onChange={(e) => setKioskServiceSearchKeyword(e.target.value)}
                      className="text-sm border border-gray-300 rounded-lg pl-7 pr-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                )}
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Toolbar */}
                {services.length > 0 && (
                  <div className="flex items-center justify-between bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        ref={input => {
                          if (input) {
                            const filteredServices = services.filter(s =>
                              s.is_active !== false &&
                              (
                                (s.name?.toLowerCase() || '').includes(kioskServiceSearchKeyword.toLowerCase()) ||
                                (s.code?.toLowerCase() || '').includes(kioskServiceSearchKeyword.toLowerCase())
                              )
                            );
                            const allSelected = filteredServices.length > 0 &&
                              filteredServices.every(s => selectedServiceIds.includes(Number(s.id)));
                            const someSelected = filteredServices.some(s => selectedServiceIds.includes(Number(s.id)));

                            input.checked = allSelected;
                            input.indeterminate = someSelected && !allSelected;
                          }
                        }}
                        onChange={handleSelectAllKioskServices}
                        className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className=" font-medium text-gray-700">
                        {(() => {
                          const filteredServices = services.filter(s => s.is_active !== false);
                          const selectedActiveCount = filteredServices.filter(service =>
                            selectedServiceIds.includes(Number(service.id))
                          ).length;
                          return `Chọn tất cả (${selectedActiveCount}/${filteredServices.length})`;
                        })()}
                      </span>
                    </label>
                  </div>
                )}
                <div className="space-y-2 max-h-96 overflow-y-auto p-3 ">
                  {services.length > 0 ? (
                    services
                      .filter(service => {
                        const isSelected = selectedServiceIds.includes(Number(service.id));
                        const isVisible = service.is_active !== false || isSelected;
                        if (!isVisible) {
                          return false;
                        }
                        return (
                          (service.name?.toLowerCase() || '').includes(kioskServiceSearchKeyword.toLowerCase()) ||
                          (service.code?.toLowerCase() || '').includes(kioskServiceSearchKeyword.toLowerCase())
                        );
                      })
                      .map(service => {
                        const isInactive = service.is_active === false;
                        return (
                          <label
                            key={service.id}
                            className={`flex items-center p-2 rounded transition ${isInactive ? 'bg-gray-100 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'}`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedServiceIds.includes(Number(service.id))}
                              onChange={() => handleServiceToggle(Number(service.id))}
                              disabled={isInactive}
                              className="w-4 h-4 text-blue-600 rounded cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                            />
                            <span className="ml-3 text-sm text-gray-700">
                              <strong>({service.code})</strong> - {service.name}
                              {isInactive && (
                                <span className="ml-2 inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
                                  Đã vô hiệu hóa
                                </span>
                              )}
                            </span>
                          </label>
                        )
                      })
                  ) : (
                    <p className="text-sm text-gray-500 p-2">Vui lòng chọn phòng giao dịch trước</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Buttons */}
      <div className="flex items-center justify-start gap-4 mt-8">
        <Button
          type="submit"
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          {isLoading ? <Loader size={16} className="animate-spin" /> : null}
          {editingId ? 'Cập nhật' : 'Thêm mới'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setViewMode('list');
            setKioskServiceGroupSearchKeyword('');
            setKioskServiceSearchKeyword('');
          }}
          disabled={isLoading}
        >
          Hủy
        </Button>
      </div>
    </form>
  );

  const renderCounterForm = () => (
    <form onSubmit={handleCounterSubmit} className="mt-6">
      {/* Main Container: 2 parallel columns */}
      <div className="flex flex-col md:flex-row gap-8">
        {/* LEFT COLUMN */}
        <div className="w-full md:w-1/2 flex flex-col gap-6">
          {/* Tỉnh/Thành phố */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tỉnh/Thành phố *</label>
            <select
              value={selectedProvince}
              onChange={(e) => setSelectedProvince(toValidNumber(e.target.value))}
              className="w-full border border-gray-300 rounded-md py-2.5 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">-- Chọn Tỉnh/Thành phố --</option>
              {provinces.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Xã/Phường */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Xã/Phường *</label>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(toValidNumber(e.target.value))}
              disabled={!selectedProvince}
              className="w-full border border-gray-300 rounded-md py-2.5 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">-- Chọn Xã/Phường --</option>
              {districts.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Phòng giao dịch */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phòng giao dịch *</label>
            <select
              value={selectedOffice}
              onChange={(e) => {
                const officeId = toValidNumber(e.target.value);
                setSelectedOffice(officeId);
                setCounterFormData(prev => ({
                  ...prev,
                  transaction_office_id: officeId,
                }));
              }}
              disabled={!selectedDistrict}
              className="w-full border border-gray-300 rounded-md py-2.5 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">-- Chọn Phòng giao dịch --</option>
              {offices.map(o => (
                <option key={o.id} value={o.id}>({o.code}) - {o.name}</option>
              ))}
            </select>
          </div>

          {/* Mã Counter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mã Counter *</label>
            <input
              type="text"
              name="code"
              value={counterFormData.code}
              onChange={handleCounterFormChange}
              disabled={!!editingId}
              className="w-full border border-gray-300 rounded-md py-2.5 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="Nhập mã counter"
            />
          </div>

          {/* Tên Counter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tên Counter *</label>
            <input
              type="text"
              name="name"
              value={counterFormData.name}
              onChange={handleCounterFormChange}
              className="w-full border border-gray-300 rounded-md py-2.5 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Nhập tên counter"
            />
          </div>

          {/* LED Number */}
          {/* <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Số LED Board</label>
            <input
              type="number"
              name="led_number"
              value={counterFormData.led_number}
              onChange={handleCounterFormChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0"
              min="0"
            />
          </div> */}
        </div>

        {/* RIGHT COLUMN - Service Configuration */}
        <div className="w-full md:w-1/2 flex flex-col gap-6">
          <div className="flex items-center justify-between gap-3">
            <label className=" text-md font-medium ">Cấu hình dịch vụ *</label>
            {selectedOffice && services.length > 0 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
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
          {selectedOffice ? (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Toolbar Header */}
              <div className="flex items-center justify-between bg-gray-50 px-4 py-3 border-b border-gray-200">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    ref={input => {
                      if (input) {
                        const filteredServices = services.filter(s =>
                          (s.is_active !== false || servicesConfig.some(sc => sc.service_id === Number(s.id))) &&
                          (
                            (s.name?.toLowerCase() || '').includes(serviceSearchKeyword.toLowerCase()) ||
                            (s.code?.toLowerCase() || '').includes(serviceSearchKeyword.toLowerCase())
                          )
                        );
                        const selectableServices = filteredServices.filter(s => s.is_active !== false);
                        const allSelected = selectableServices.length > 0 &&
                          selectableServices.every(s => servicesConfig.find(sc => sc.service_id === s.id));
                        const someSelected = selectableServices.some(s => servicesConfig.find(sc => sc.service_id === s.id));

                        input.checked = allSelected;
                        input.indeterminate = someSelected && !allSelected;
                      }
                    }}
                    onChange={handleSelectAllServices}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="font-medium text-gray-700">
                    {(() => {
                      const activeServices = services.filter(s => s.is_active !== false);
                      const selectedActiveCount = activeServices.filter(service =>
                        servicesConfig.some(config => config.service_id === Number(service.id))
                      ).length;
                      return `Chọn tất cả (${selectedActiveCount}/${activeServices.length})`;
                    })()}
                  </span>
                </label>
              </div>

              {/* Service Table */}
              <table className="w-full text-sm max-h-96 overflow-y-auto block">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Dịch vụ</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-700 w-24">Phục vụ</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-700">Độ ưu tiên</th>
                  </tr>
                </thead>
                <tbody>
                  {services.length > 0 ? (
                    services
                      .filter(s => {
                        const isSelected = servicesConfig.some(config => config.service_id === Number(s.id));
                        const isVisible = s.is_active !== false || isSelected;
                        if (!isVisible) {
                          return false;
                        }
                        return (
                          (s.name?.toLowerCase() || '').includes(serviceSearchKeyword.toLowerCase()) ||
                          (s.code?.toLowerCase() || '').includes(serviceSearchKeyword.toLowerCase())
                        );
                      })
                      .map(service => {
                        const config = servicesConfig.find(s => s.service_id === service.id);
                        const isServing = !!config;
                        const isInactive = service.is_active === false;
                        return (
                          <tr key={service.id} className="border-t border-gray-200 hover:bg-gray-50">
                            <td className="px-3 py-2">
                              <strong>({service.code})</strong> - {service.name}
                              {isInactive && (
                                <span className="ml-2 inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
                                  Đã vô hiệu hóa
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={isServing}
                                onChange={() => handleServiceServeToggle(Number(service.id), service.name || '')}
                                disabled={isInactive}
                                className="w-4 h-4 text-blue-600 rounded cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                              />
                            </td>
                            <td className="px-3 py-2 text-center">
                              <select
                                value={config?.priority_level || 1}
                                onChange={(e) => handleServicePriorityChange(Number(service.id), Number(e.target.value))}
                                disabled={!isServing || isInactive}
                                className="border border-gray-300 rounded px-2 py-1 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                              >
                                <option value="1">1 (Cao nhất)</option>
                                <option value="2">2</option>
                                <option value="3">3</option>
                                <option value="4">4</option>
                                <option value="5">5</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-3 py-4 text-center text-gray-500">
                        Vui lòng chọn phòng giao dịch để xem danh sách dịch vụ
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg p-6 text-center text-gray-500">
              Vui lòng chọn Tỉnh/TP → Xã/Phường → Phòng giao dịch để cấu hình dịch vụ
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-start gap-4 mt-8">
        <Button
          type="submit"
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          {isLoading ? <Loader size={16} className="animate-spin" /> : null}
          {editingId ? 'Cập nhật' : 'Thêm mới'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setViewMode('list');
            setServiceSearchKeyword('');
          }}
          disabled={isLoading}
        >
          Hủy
        </Button>
      </div>
    </form>
  );

  const renderEBoardForm = () => (
    <form onSubmit={handleEBoardSubmit} className="space-y-6">
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            type="button"
            onClick={() => setEBoardFormTab('general')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${eboardFormTab === 'general'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Thông tin chung
          </button>
          <button
            type="button"
            onClick={() => setEBoardFormTab('media')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${eboardFormTab === 'media'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Video/Hình ảnh
          </button>
        </nav>
      </div>

      {eboardFormTab === 'general' && (
        <div className="space-y-6 mt-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Mã E-Board *</label>
              <input
                type="text"
                name="code"
                value={eboardFormData.code}
                onChange={handleEBoardFormChange}
                disabled={!!editingId}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="VD: TV01"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tên E-Board *</label>
              <input
                type="text"
                name="name"
                value={eboardFormData.name}
                onChange={handleEBoardFormChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="VD: Màn hình sảnh chờ 1"
              />
            </div>
          </div>

          {/* Hierarchy Selection */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tỉnh/Thành phố *</label>
              <select
                value={selectedProvince}
                onChange={(e) => setSelectedProvince(toValidNumber(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">-- Chọn Tỉnh/TP --</option>
                {provinces.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Xã/Phường *</label>
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(toValidNumber(e.target.value))}
                disabled={!selectedProvince}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
              >
                <option value="">-- Chọn Xã/Phường --</option>
                {districts.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phòng giao dịch *</label>
              <select
                name="transaction_office_id"
                value={eboardFormData.transaction_office_id}
                onChange={handleEBoardFormChange}
                disabled={!selectedDistrict}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
              >
                <option value="">-- Chọn PGD --</option>
                {offices.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Counter Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Chọn các quầy hiển thị trên bảng này
            </label>
            <div className="border rounded-lg p-4 max-h-60 overflow-y-auto bg-gray-50">
              {eboardCounters.length === 0 ? (
                <p className="text-gray-500 text-sm">Vui lòng chọn PGD trước</p>
              ) : (
                <div className="space-y-2">
                  {eboardCounters.map((counter) => (
                    <label key={counter.id} className="flex items-center gap-2 cursor-pointer hover:bg-white p-2 rounded">
                      <input
                        type="checkbox"
                        checked={eboardFormData.counter_ids.includes(counter.id)}
                        onChange={() => handleEBoardCounterToggle(counter.id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm">{counter.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Giọng đọc</label>
              <select
                name="voice_call_number"
                value={eboardFormData.voice_call_number}
                onChange={handleEBoardFormChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="north">Giọng Bắc</option>
                <option value="south">Giọng Nam</option>
              </select>
            </div>
          </div> */}
        </div>
      )}

      {eboardFormTab === 'media' && (
        <div className="space-y-6 mt-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Quản lý Media Files</h3>
            <Button
              type="button"
              size="sm"
              onClick={handleAddMedia}
              icon={<Upload size={16} />}
            >
              Upload File
            </Button>
          </div>

          <div className="space-y-3">
            {eboardFormData.media.length === 0 ? (
              <p className="text-gray-500 text-center py-8 bg-gray-50 rounded-lg">
                Chưa có file nào. Nhấn "Upload File" để thêm.
              </p>
            ) : (
              eboardFormData.media.map((item, index) => (
                <div key={index} className="flex items-center gap-4 p-4 border rounded-lg bg-gray-50">
                  <div className="flex-shrink-0">
                    {item.file_type === 'video' ? (
                      <Video className="w-8 h-8 text-blue-600" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-green-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.description || 'Không có mô tả'}</p>
                    <p className="text-xs text-gray-500">{item.file_type === 'video' ? 'Video' : 'Hình ảnh'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleMediaReorder(index, 'up')}
                      disabled={index === 0}
                      className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMediaReorder(index, 'down')}
                      disabled={index === eboardFormData.media.length - 1}
                      className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveMedia(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Footer Buttons */}
      <div className="flex gap-3 pt-6 border-t border-gray-200">
        <Button
          type="submit"
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          {isLoading ? <Loader size={16} className="animate-spin" /> : null}
          {editingId ? 'Cập nhật' : 'Thêm mới'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={async () => {
            // Clear marked media for deletion on cancel
            setMediaToDeleteOnSubmit([]);
            // Set flag to indicate we should cleanup
            setShouldCleanupOnUnmount(true);
            await cleanupUploadedFiles();
            setViewMode('list');
          }}
          disabled={isLoading}
        >
          Hủy
        </Button>
      </div>
    </form>
  );

  return (
    <>
      <Card>
        {viewMode === 'list' && (
          <Tabs
            tabs={['Kiosk', 'Counter', 'E Center Board']}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        )}

        {viewMode !== 'list' ? (
          <div className="max-w-6xl">
            <h3 className="text-lg font-bold mb-6">
              {activeTab === 'Kiosk' && (editingId ? 'Chỉnh sửa Kiosk' : 'Thêm Kiosk mới')}
              {activeTab === 'Counter' && (editingId ? 'Chỉnh sửa Counter' : 'Thêm Counter mới')}
              {activeTab === 'E Center Board' && (editingId ? 'Chỉnh sửa E-Board' : 'Thêm E-Board mới')}
            </h3>
            {activeTab === 'Kiosk' && renderFormView()}
            {activeTab === 'Counter' && renderCounterForm()}
            {activeTab === 'E Center Board' && renderEBoardForm()}
          </div>
        ) : (
          <>
            {/* Search Bar and Filters */}
            <div className="flex justify-between items-center mb-4 gap-4">
              <h3 className="text-lg font-medium">
                Danh sách {activeTab === 'Kiosk' ? 'Kiosk' : activeTab === 'Counter' ? 'Counter' : activeTab === 'E Center Board' ? 'E-Board' : activeTab}
              </h3>

              <Button
                size="sm"
                icon={<Plus size={16} />}
                onClick={activeTab === 'Kiosk' ? handleAddClick : activeTab === 'Counter' ? handleAddCounter : activeTab === 'E Center Board' ? handleAddEBoard : undefined}
              >
                Thêm mới
              </Button>
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="flex justify-center py-10">
                <Loader size={24} className="animate-spin text-blue-600" />
              </div>
            )}

            {/* Kiosk Table */}
            {activeTab === 'Kiosk' && !isLoading && (
              <Table
                data={kiosks}
                columns={[
                  { header: 'Phòng giao dịch', accessor: 'location' },
                  { header: 'Tên Kiosk', accessor: 'name' },
                  { header: 'Mã Kiosk', accessor: 'code' },
                  {
                    header: 'Trạng thái',
                    accessor: (kiosk: Kiosk) => (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${kiosk.is_active !== false ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {kiosk.is_active !== false ? 'Đang hoạt động' : 'Đã vô hiệu hóa'}
                      </span>
                    ),
                  },

                  //{ header: 'Nhóm dịch vụ & Dịch vụ', accessor: 'serviceDisplay' },
                  // { header: 'IP Address', accessor: 'ip_address' },
                  // {
                  //   header: 'Trạng thái',
                  //   accessor: (kiosk: Kiosk) => (
                  //     <span className={`px-2 py-1 rounded text-xs font-medium ${kiosk.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  //       }`}>
                  //       {kiosk.status === 'active' ? 'Hoạt động' : 'Không hoạt động'}
                  //     </span>
                  //   ),
                  // },
                  { header: 'Ngày tạo', accessor: 'createdDate' },
                ]}
                actions={(row: Kiosk) => (
                  <div className="flex justify-end gap-2">
                    <ActionIconButton
                      title="Chỉnh sửa"
                      variant="edit"
                      icon={<Edit2 size={16} />}
                      onClick={() => handleEditClick(row)}
                    />
                    {row.is_active !== false ? (
                      <ActionIconButton
                        title="Vô hiệu hóa"
                        variant="deactivate"
                        icon={<Ban size={16} />}
                        onClick={() => handleDeleteKiosk(row.id)}
                      />
                    ) : (
                      <ActionIconButton
                        title="Khôi phục"
                        variant="reactivate"
                        icon={<RefreshCw size={16} />}
                        onClick={() => handleReactivateKiosk(row.id)}
                      />
                    )}
                  </div>
                )}
              />
            )}

            {/* Counter Table */}
            {activeTab === 'Counter' && !isLoading && (
              <Table
                data={counters}
                columns={[
                  {
                    header: 'Phòng giao dịch',
                    accessor: (counter: Counter) => counter.transaction_office?.name || 'N/A',
                  },
                  { header: 'Tên Counter', accessor: 'name' },
                  { header: 'Mã Counter', accessor: 'code' },
                  {
                    header: 'Trạng thái',
                    accessor: (counter: Counter) => (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${counter.is_active !== false ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {counter.is_active !== false ? 'Đang hoạt động' : 'Đã vô hiệu hóa'}
                      </span>
                    ),
                  },
                  {
                    header: 'Tổng số dịch vụ',
                    accessor: (counter: Counter) => counter.service_count || 0,
                  },
                  {
                    header: 'Ngày tạo',
                    accessor: (counter: Counter) => formatDate(counter.created_at),
                  },
                ]}
                actions={(row: Counter) => (
                  <div className="flex justify-end gap-2">
                    <ActionIconButton
                      title="Chỉnh sửa"
                      variant="edit"
                      icon={<Edit2 size={16} />}
                      onClick={() => handleEditCounter(row)}
                    />
                    {row.is_active !== false ? (
                      <ActionIconButton
                        title="Vô hiệu hóa"
                        variant="deactivate"
                        icon={<Ban size={16} />}
                        onClick={() => handleDeleteCounter(row.id)}
                      />
                    ) : (
                      <ActionIconButton
                        title="Khôi phục"
                        variant="reactivate"
                        icon={<RefreshCw size={16} />}
                        onClick={() => handleReactivateCounter(row.id)}
                      />
                    )}
                  </div>
                )}
              />
            )}

            {/* E-Board Table */}
            {activeTab === 'E Center Board' && !isLoading && (
              <Table
                data={eboards}
                columns={[
                  {
                    header: 'Phòng giao dịch',
                    accessor: (eboard: EBoard) => eboard.TransactionOffice?.name || 'N/A',
                  },
                  { header: 'Mã E-Board', accessor: 'code' },
                  { header: 'Tên E-Board', accessor: 'name' },
                  {
                    header: 'Trạng thái',
                    accessor: (eboard: EBoard) => (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${eboard.is_active !== false ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {eboard.is_active !== false ? 'Đang hoạt động' : 'Đã vô hiệu hóa'}
                      </span>
                    ),
                  },
                  {
                    header: 'Số quầy',
                    accessor: (eboard: EBoard) => eboard.counters?.length || 0,
                  },
                  {
                    header: 'Ngày tạo',
                    accessor: (eboard: EBoard) => formatDate(eboard.created_at),
                  },
                ]}
                actions={(row: EBoard) => (
                  <div className="flex justify-end gap-2">
                    <ActionIconButton
                      title="Chỉnh sửa"
                      variant="edit"
                      icon={<Edit2 size={16} />}
                      onClick={() => handleEditEBoard(row)}
                    />
                    {row.is_active !== false ? (
                      <ActionIconButton
                        title="Vô hiệu hóa"
                        variant="deactivate"
                        icon={<Ban size={16} />}
                        onClick={() => handleDeleteEBoard(row.id)}
                      />
                    ) : (
                      <ActionIconButton
                        title="Khôi phục"
                        variant="reactivate"
                        icon={<RefreshCw size={16} />}
                        onClick={() => handleReactivateEBoard(row.id)}
                      />
                    )}
                  </div>
                )}
              />
            )}

            {activeTab !== 'Kiosk' && activeTab !== 'Counter' && activeTab !== 'E Center Board' && (
              <div className="text-center py-10 text-gray-400">
                Dữ liệu cho {activeTab} sẽ được bổ sung sau
              </div>
            )}
          </>
        )}
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModal.isOpen}
        title={
          deleteModal.action === 'deactivate'
            ? (deleteModal.type === 'kiosk' ? 'Vô hiệu hóa Kiosk' :
              deleteModal.type === 'counter' ? 'Vô hiệu hóa Counter' :
                'Vô hiệu hóa E-Board')
            : (deleteModal.type === 'kiosk' ? 'Khôi phục Kiosk' :
              deleteModal.type === 'counter' ? 'Khôi phục Counter' :
                'Khôi phục E-Board')
        }
        message={
          deleteModal.action === 'deactivate'
            ? (deleteModal.type === 'kiosk'
              ? 'Bạn có chắc chắn muốn vô hiệu hóa thiết bị này? Thiết bị sẽ bị ngắt kết nối ngay lập tức.'
              : deleteModal.type === 'counter'
                ? 'Bạn có chắc chắn muốn vô hiệu hóa thiết bị này? Thiết bị sẽ bị ngắt kết nối ngay lập tức.'
                : 'Bạn có chắc chắn muốn vô hiệu hóa thiết bị này? Thiết bị sẽ bị ngắt kết nối ngay lập tức.')
            : (deleteModal.type === 'kiosk'
              ? 'Bạn có chắc chắn muốn khôi phục thiết bị này? Thiết bị sẽ hoạt động trở lại ngay lập tức.'
              : deleteModal.type === 'counter'
                ? 'Bạn có chắc chắn muốn khôi phục thiết bị này? Thiết bị sẽ hoạt động trở lại ngay lập tức.'
                : 'Bạn có chắc chắn muốn khôi phục thiết bị này? Thiết bị sẽ hoạt động trở lại ngay lập tức.')
        }
        type="warning"
        onConfirm={
          deleteModal.action === 'deactivate'
            ? (deleteModal.type === 'kiosk' ? confirmDeleteKiosk :
              deleteModal.type === 'counter' ? confirmDeleteCounter :
                confirmDeleteEBoard)
            : (deleteModal.type === 'kiosk' ? confirmReactivateKiosk :
              deleteModal.type === 'counter' ? confirmReactivateCounter :
                confirmReactivateEBoard)
        }
        onCancel={() => setDeleteModal({ isOpen: false, id: null, type: 'kiosk', action: 'deactivate' })}
        confirmText={deleteModal.action === 'deactivate' ? 'Vô hiệu hóa' : 'Khôi phục'}
        cancelText="Hủy"
        isLoading={isLoading}
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

export default DeviceManager;
