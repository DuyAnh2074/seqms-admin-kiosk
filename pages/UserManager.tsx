import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Input, Select, Tabs, Modal } from '../components/UIComponents';
import { Plus, Edit2, Ban, RefreshCw, AlertCircle, Loader, Check, CheckCircle, XCircle } from 'lucide-react';
import type { Province, District, TransactionOffice } from '../types';
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
    className={`inline-flex h-9 w-9 items-center justify-center rounded-md text-sm transition-colors ${ACTION_ICON_VARIANTS[variant] || ACTION_ICON_VARIANTS.neutral} disabled:cursor-not-allowed disabled:opacity-50`}
  >
    {icon}
  </button>
);

interface User {
  id: number;
  username: string;
  full_name: string;
  email: string;
  phone: string;
  role: string;
  job_title: string;
  is_active: boolean;
  transaction_office_id: number | null;
  TransactionOffice?: {
    id: number;
    code: string;
    name: string;
    is_active?: boolean;
  };
  created_at: string;
}

interface FormData {
  username: string;
  full_name: string;
  email: string;
  phone: string;
  password_hash: string;
  role: 'admin' | 'manager' | 'staff';
  job_title: string;
  transaction_office_id: number | '';
  province_id: number | '';
  district_id: number | '';
}

const UserManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState('Users');
  const [viewMode, setViewMode] = useState<'list' | 'add' | 'edit'>('list');
  const [isLoading, setIsLoading] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'error' }>>([]);

  // Data states
  const [users, setUsers] = useState<User[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [offices, setOffices] = useState<TransactionOffice[]>([]);

  // Form states
  const [formData, setFormData] = useState<FormData>({
    username: '',
    full_name: '',
    email: '',
    phone: '',
    password_hash: '',
    role: 'staff',
    job_title: '',
    transaction_office_id: '',
    province_id: '',
    district_id: '',
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; userId: number | null; action: 'deactivate' | 'reactivate' }>({
    isOpen: false,
    userId: null,
    action: 'deactivate',
  });

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

  // Load users only for list view
  useEffect(() => {
    if (viewMode === 'list') {
      loadUsersList();
    }
  }, [viewMode]);

  // Load location data only when opening add/edit form
  useEffect(() => {
    if (viewMode !== 'list' && provinces.length === 0) {
      loadProvinces();
    }
  }, [viewMode, provinces.length]);

  // Load districts when province changes
  useEffect(() => {
    if (formData.province_id) {
      loadDistricts(formData.province_id as number);
    } else {
      setDistricts([]);
      setFormData(prev => ({
        ...prev,
        district_id: '',
        transaction_office_id: '',
      }));
      setOffices([]);
    }
  }, [formData.province_id]);

  // Load offices when district changes
  useEffect(() => {
    if (formData.district_id) {
      loadOffices(formData.district_id as number);
    } else {
      setFormData(prev => ({
        ...prev,
        transaction_office_id: '',
      }));
      setOffices([]);
    }
  }, [formData.district_id]);

  const loadProvinces = async () => {
    try {
      const response = await api.get('/provinces');
      setProvinces(response.data.data || []);
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) return;
      console.error('Error loading provinces:', err);
    }
  };

  const loadDistricts = async (provinceId: number) => {
    try {
      const response = await api.get(`/districts?province_id=${provinceId}`);
      setDistricts(response.data.data || []);
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) return;
      console.error('Error loading districts:', err);
    }
  };

  const loadOffices = async (districtId: number) => {
    try {
      const response = await api.get(`/transaction-offices?district_id=${districtId}`);
      setOffices(response.data.data || []);
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) return;
      console.error('Error loading offices:', err);
    }
  };

  const loadUsersList = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/users');
      setUsers(response.data.data || []);
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) return;
      showToast('Lỗi khi tải danh sách người dùng', 'error');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddClick = () => {
    setEditingId(null);
    setFormData({
      username: '',
      full_name: '',
      email: '',
      phone: '',
      password_hash: '',
      role: 'staff',
      job_title: '',
      transaction_office_id: '',
      province_id: '',
      district_id: '',
    });
    setViewMode('add');
  };

  const handleEditClick = async (user: User) => {
    setEditingId(user.id);

    // Load province/district hierarchy for the office
    if (user.transaction_office_id) {
      try {
        const officeRes = await api.get('/transaction-offices');
        const office = officeRes.data.data.find((o: TransactionOffice) => o.id === user.transaction_office_id);

        if (office && office.district_id) {
          const districtRes = await api.get('/districts');
          const district = districtRes.data.data.find((d: District) => d.id === office.district_id);

          if (district && district.province_id) {
            setFormData(prev => ({
              ...prev,
              username: user.username,
              full_name: user.full_name,
              email: user.email,
              phone: user.phone,
              job_title: user.job_title || '',
              role: user.role as 'admin' | 'manager' | 'staff',
              password_hash: '',
              transaction_office_id: user.transaction_office_id || '',
              province_id: district.province_id,
              district_id: office.district_id,
            }));

            // Load districts for province
            await loadDistricts(district.province_id);
            // Load offices for district
            await loadOffices(office.district_id);
          }
        }
      } catch (err) {
        console.error('Error loading hierarchy:', err);
      }
    } else {
      // For admin users without office
      setFormData(prev => ({
        ...prev,
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        job_title: user.job_title || '',
        role: user.role as 'admin' | 'manager' | 'staff',
        password_hash: '',
        transaction_office_id: '',
        province_id: '',
        district_id: '',
      }));
    }

    setViewMode('edit');
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'province_id' || name === 'district_id' || name === 'transaction_office_id'
        ? (value ? Number(value) : '')
        : value,
    }));
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.username || !formData.full_name) {
      showToast('Tên đăng nhập và họ tên là bắt buộc', 'error');
      return;
    }

    if (!editingId && !formData.password_hash) {
      showToast('Mật khẩu là bắt buộc khi tạo người dùng mới', 'error');
      return;
    }

    if (formData.role !== 'admin' && !formData.transaction_office_id) {
      showToast('Nhân viên và quản lý phải được gán vào phòng giao dịch', 'error');
      return;
    }

    try {
      setIsLoading(true);
      const payload = {
        username: formData.username,
        full_name: formData.full_name,
        email: formData.email?.trim() ? formData.email.trim() : null,
        phone: formData.phone,
        role: formData.role,
        job_title: formData.job_title,
        transaction_office_id: formData.transaction_office_id || null,
      };

      // Only include password if provided
      if (formData.password_hash) {
        (payload as any).password_hash = formData.password_hash;
      }

      if (editingId) {
        await api.put(`/users/${editingId}`, payload);
      } else {
        await api.post('/users', payload);
      }

      showToast(editingId ? 'Người dùng đã được cập nhật thành công' : 'Người dùng đã được tạo thành công', 'success');
      loadUsersList();
      setViewMode('list');
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Lỗi khi lưu người dùng';
      showToast(errorMessage, 'error');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = (id: number) => {
    setDeleteModal({ isOpen: true, userId: id, action: 'deactivate' });
  };

  const confirmUserAction = async () => {
    if (!deleteModal.userId) return;
    try {
      setIsLoading(true);
      if (deleteModal.action === 'deactivate') {
        await api.delete(`/users/${deleteModal.userId}`);
        showToast('Vô hiệu hóa tài khoản thành công', 'success');
      } else {
        await api.put(`/users/${deleteModal.userId}/reactivate`);
        showToast('Khôi phục tài khoản thành công', 'success');
      }

      setDeleteModal({ isOpen: false, userId: null, action: 'deactivate' });
      loadUsersList();
    } catch (err: any) {
      showToast(
        err.response?.data?.message || (deleteModal.action === 'deactivate'
          ? 'Lỗi khi vô hiệu hóa người dùng'
          : 'Lỗi khi khôi phục người dùng'),
        'error'
      );
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReactivateUser = (id: number) => {
    setDeleteModal({ isOpen: true, userId: id, action: 'reactivate' });
  };

  const renderFormView = () => (
    <form onSubmit={handleSubmitForm} className="space-y-6">
      <div className="grid grid-cols-2 gap-8">
        {/* LEFT COLUMN */}
        <div className="space-y-4">
          {/* Province */}
          {formData.role !== 'admin' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tỉnh/Thành phố *</label>
                <select
                  value={formData.province_id}
                  onChange={handleFormChange}
                  name="province_id"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">-- Chọn Tỉnh/Thành phố --</option>
                  {provinces.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* District */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Xã/Phường *</label>
                <select
                  value={formData.district_id}
                  onChange={handleFormChange}
                  name="district_id"
                  disabled={!formData.province_id}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                >
                  <option value="">-- Chọn Xã/Phường --</option>
                  {districts.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              {/* Transaction Office */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Chi nhánh *</label>
                <select
                  value={formData.transaction_office_id}
                  onChange={handleFormChange}
                  name="transaction_office_id"
                  disabled={!formData.district_id}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                >
                  <option value="">-- Chọn Chi nhánh --</option>
                  {offices.map(o => (
                    <option key={o.id} value={o.id}>({o.code}) - {o.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tên đăng nhập *</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleFormChange}
              disabled={!!editingId}
              placeholder="Enter username"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mật khẩu {!editingId && '*'}
            </label>
            <input
              type="password"
              name="password_hash"
              value={formData.password_hash}
              onChange={handleFormChange}
              placeholder={editingId ? 'Để trống nếu không đổi mật khẩu' : 'Nhập mật khẩu'}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Họ và tên *</label>
            <input
              type="text"
              name="full_name"
              value={formData.full_name}
              onChange={handleFormChange}
              placeholder="Enter full name"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Job Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Chức danh</label>
            <input
              type="text"
              name="job_title"
              value={formData.job_title}
              onChange={handleFormChange}
              placeholder="e.g., Giao dịch viên, Quản lý"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phân quyền *</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleFormChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="staff">Staff (Giao dịch viên)</option>
              <option value="manager">Manager (Quản lý)</option>
              <option value="admin">Admin (Super Admin)</option>
            </select>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Số điện thoại</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleFormChange}
              placeholder="Enter phone number"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleFormChange}
              placeholder="Enter email"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

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
          onClick={() => setViewMode('list')}
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


        {viewMode !== 'list' ? (
          <div className="max-w-6xl">
            <h3 className="text-lg font-bold mb-6">
              {editingId ? 'Chỉnh sửa người dùng' : 'Tạo người dùng mới'}
            </h3>
            {renderFormView()}
          </div>
        ) : (
          <div>
            {/* Add Button */}
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Danh sách người dùng</h3>
              <Button
                size="sm"
                icon={<Plus size={16} />}
                onClick={handleAddClick}
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

            {/* Users Table */}
            {!isLoading && (
              <Table
                data={users}
                columns={[
                  { header: 'Tên đăng nhập', accessor: (user: User) => user.username },
                  { header: 'Họ và tên', accessor: (user: User) => user.full_name },
                  { header: 'Chi nhánh', accessor: (user: User) => user.TransactionOffice?.name || 'Admin' },
                  { header: 'Phân quyền', accessor: (user: User) => user.role },
                  { header: 'Chức danh', accessor: (user: User) => user.job_title || '-' },
                  {
                    header: 'Trạng thái', accessor: (user: User) => (
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${user.is_active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-200 text-gray-700'
                        }`}>
                        {user.is_active ? 'Đang hoạt động' : 'Đã vô hiệu hóa'}
                      </span>
                    )
                  },

                ]}
                actions={(user: User) => (
                  <div className="flex justify-end gap-2">
                    <ActionIconButton
                      title="Chỉnh sửa"
                      variant="edit"
                      icon={<Edit2 size={16} />}
                      onClick={() => handleEditClick(user)}
                    />
                    {user.is_active ? (
                      user.role !== 'admin' ? (
                        <ActionIconButton
                          title="Vô hiệu hóa"
                          variant="deactivate"
                          icon={<Ban size={16} />}
                          onClick={() => handleDeleteUser(user.id)}
                        />
                      ) : null
                    ) : (
                      <ActionIconButton
                        title={user.transaction_office_id && user.TransactionOffice?.is_active === false
                          ? 'PGD đang bị vô hiệu hóa'
                          : 'Khôi phục'}
                        variant="reactivate"
                        icon={<RefreshCw size={16} />}
                        onClick={() => handleReactivateUser(user.id)}
                        disabled={Boolean(user.transaction_office_id && user.TransactionOffice?.is_active === false)}
                      />
                    )}
                  </div>
                )}
              />
            )}
          </div>
        )}
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModal.isOpen}
        title={deleteModal.action === 'deactivate' ? 'Vô hiệu hóa người dùng' : 'Khôi phục người dùng'}
        message={
          deleteModal.action === 'deactivate'
            ? 'Bạn có chắc chắn muốn vô hiệu hóa tài khoản này? Người dùng sẽ bị buộc đăng xuất ngay lập tức.'
            : 'Bạn có chắc chắn muốn khôi phục tài khoản này? Người dùng sẽ có thể đăng nhập và sử dụng hệ thống trở lại.'
        }
        type="warning"
        onConfirm={confirmUserAction}
        onCancel={() => setDeleteModal({ isOpen: false, userId: null, action: 'deactivate' })}
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

export default UserManager;


