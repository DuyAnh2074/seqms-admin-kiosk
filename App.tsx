import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { Menu, LogOut, Monitor, X } from 'lucide-react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import ServiceManager from './pages/ServiceManager';
import PGDManager from './pages/PGDManager';
import DeviceManager from './pages/DeviceManager';
import UserManager from './pages/UserManager';
import CounterConfig from './pages/CounterConfig';
import CounterLive from './pages/CounterLive';
import MonitorLive from './pages/MonitorLive';
import BoardDisplayPage from './pages/BoardDisplayPage';
import PrivateRoute from './components/PrivateRoute';
import Sidebar from './components/Sidebar';
import { Modal } from './components/UIComponents';
import api from './services/api';

const Header = ({ onMenuClick, username, userRole, onLogoutClick, hasActiveServing, onOpenTvPicker }: { onMenuClick: () => void, username: string, userRole: string, onLogoutClick: () => void, hasActiveServing?: boolean, onOpenTvPicker: () => void }) => (
  <header className="h-16 bg-white shadow-sm flex items-center justify-between px-6 sticky top-0 z-10">
    <div className="flex items-center gap-4">
      <button
        className="p-2 text-gray-600 hover:bg-gray-100 rounded focus:outline-none lg:hidden"
        onClick={onMenuClick}
        title="Menu"
      >
        <Menu size={24} />
      </button>
      <h2 className="text-xl font-bold text-blue-900 flex items-center gap-2">
        {userRole === 'staff' ? 'Hệ thống Quầy giao dịch VNDC' : 'Hệ thống Quản lý VNDC'}
      </h2>
    </div>

    <div className="flex items-center gap-6">
      {/* Board Display Button - Available for all authenticated roles */}
      {(userRole === 'admin' || userRole === 'manager' || userRole === 'staff') && (
        <button
          onClick={onOpenTvPicker}
          className="p-2 text-gray-600 hover:text-blue-600 hover:bg-gray-100 rounded-full transition-all"
          title="Mở màn hình hiển thị TV"
        >
          <Monitor size={20} />
        </button>
      )}

      <div className="flex items-center gap-3 pl-4 border-l">
        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
          {username.charAt(0).toUpperCase()}
        </div>
        <div className="hidden md:block">
          <p className="text-sm font-medium text-gray-800">{username}</p>
          <p className="text-xs text-gray-500 capitalize">{userRole}</p>
        </div>
      </div>

      <button
        onClick={onLogoutClick}
        className={`transition ${hasActiveServing ? 'text-gray-400 cursor-not-allowed' : 'text-gray-500 hover:text-red-600'}`}
        title={hasActiveServing ? "Không thể đăng xuất khi đang phục vụ khách hàng" : "Logout"}
        disabled={hasActiveServing}
      >
        <LogOut size={20} />
      </button>
    </div>
  </header>
);

const App: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    // Check if user is already logged in (from localStorage)
    return localStorage.getItem('isAuthenticated') === 'true';
  });
  const [currentUser, setCurrentUser] = useState<string>(() => {
    return localStorage.getItem('currentUser') || '';
  });
  const [userRole, setUserRole] = useState<string>(() => {
    return localStorage.getItem('userRole') || '';
  });
  const [hasActiveServing, setHasActiveServing] = useState<boolean>(false);

  // Listen for active serving ticket status changes
  useEffect(() => {
    const handleActiveServingChange = (event: CustomEvent) => {
      setHasActiveServing(event.detail?.isServing || false);
    };

    window.addEventListener('serving:statusChanged', handleActiveServingChange as EventListener);
    return () => window.removeEventListener('serving:statusChanged', handleActiveServingChange as EventListener);
  }, []);

  // Handle login success callback from Login component
  const handleLoginSuccess = (username: string, role: string, token: string) => {
    // Update localStorage
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('currentUser', username);
    localStorage.setItem('userRole', role);
    localStorage.setItem('authToken', token);

    // Update state
    setIsAuthenticated(true);
    setCurrentUser(username);
    setUserRole(role);
  };

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [sessionExpiredModalOpen, setSessionExpiredModalOpen] = useState(false);

  const [isTvPickerOpen, setIsTvPickerOpen] = useState(false);
  const [loadingEboards, setLoadingEboards] = useState(false);
  const [tvPickerError, setTvPickerError] = useState('');
  const [tvPopupGuide, setTvPopupGuide] = useState('');
  const [openingTvClient, setOpeningTvClient] = useState(false);
  const [selectedEboardCode, setSelectedEboardCode] = useState('');
  const [eboards, setEboards] = useState<Array<{
    id: number;
    code: string;
    name: string;
    is_active: boolean;
    transaction_office_id?: number;
  }>>([]);

  const fetchActiveEboards = async () => {
    setLoadingEboards(true);
    setTvPickerError('');

    try {
      const response = await api.get('/eboards');
      const rows = Array.isArray(response.data?.data) ? response.data.data : [];

      const activeBoards = rows
        .filter((item: any) => item?.is_active !== false && item?.code)
        .map((item: any) => ({
          id: Number(item.id),
          code: String(item.code),
          name: item.name ? String(item.name) : '',
          is_active: item.is_active !== false,
          transaction_office_id: item.transaction_office_id,
        }))
        .sort((a: any, b: any) => a.code.localeCompare(b.code));

      setEboards(activeBoards);
      setSelectedEboardCode(activeBoards[0]?.code || '');
    } catch (error: any) {
      setTvPickerError(error.response?.data?.message || error.message || 'Không thể tải danh sách E-Board.');
      setEboards([]);
      setSelectedEboardCode('');
    } finally {
      setLoadingEboards(false);
    }
  };

  const handleOpenTvPicker = () => {
    setIsTvPickerOpen(true);
    setTvPopupGuide('');
    fetchActiveEboards();
  };

  const closeTvPicker = () => {
    if (openingTvClient) return;
    setIsTvPickerOpen(false);
    setTvPopupGuide('');
  };

  const openOnSecondaryScreenIfPossible = async (url: string) => {
    const openDefault = () => window.open(url, '_blank');

    try {
      const windowAny = window as any;
      if (typeof windowAny.getScreenDetails !== 'function') {
        const fallbackWin = openDefault();
        return { win: fallbackWin, usedSecondary: false };
      }

      // Ask browser permission for multi-screen placement when supported.
      if ((navigator as any).permissions?.query) {
        try {
          await (navigator as any).permissions.query({ name: 'window-management' });
        } catch (_err) {
          // Ignore permission query failures; opening logic still has fallback.
        }
      }

      const details = await windowAny.getScreenDetails();
      const screens = Array.isArray(details?.screens) ? details.screens : [];

      const secondaryScreens = screens.filter((screen: any) => !screen.isPrimary);
      const preferredSecondary = secondaryScreens.sort((a: any, b: any) => {
        const areaA = Number(a.width || 0) * Number(a.height || 0);
        const areaB = Number(b.width || 0) * Number(b.height || 0);
        return areaB - areaA;
      })[0];

      if (!preferredSecondary) {
        const fallbackWin = openDefault();
        return { win: fallbackWin, usedSecondary: false };
      }

      const left = Math.round(Number(preferredSecondary.left || 0));
      const top = Math.round(Number(preferredSecondary.top || 0));
      const width = Math.round(Number(preferredSecondary.width || 1280));
      const height = Math.round(Number(preferredSecondary.height || 720));

      const features = [
        `left=${left}`,
        `top=${top}`,
        `width=${width}`,
        `height=${height}`,
      ].join(',');

      const secondaryWin = window.open(url, '_blank', features);
      if (secondaryWin) {
        try {
          secondaryWin.focus();
        } catch (_err) {
          // No-op; focus may fail due to browser policy.
        }
        return { win: secondaryWin, usedSecondary: true };
      }

      const fallbackWin = openDefault();
      return { win: fallbackWin, usedSecondary: false };
    } catch (_error) {
      const fallbackWin = openDefault();
      return { win: fallbackWin, usedSecondary: false };
    }
  };

  const handleOpenTvClient = async () => {
    if (!selectedEboardCode) return;

    const board = eboards.find((item) => item.code === selectedEboardCode);
    if (!board || board.is_active === false) {
      setTvPickerError('E-Board đã chọn không hợp lệ hoặc đã bị vô hiệu hóa.');
      return;
    }

    setOpeningTvClient(true);
    setTvPickerError('');
    setTvPopupGuide('');

    try {
      const boardUrl = `/#/board/live?code=${encodeURIComponent(board.code)}`;
      const { win, usedSecondary } = await openOnSecondaryScreenIfPossible(boardUrl);

      if (!win) {
        setTvPopupGuide('Trình duyệt đã chặn pop-up. Vui lòng cho phép pop-up cho website này rồi thử lại.');
        return;
      }

      if (!usedSecondary) {
        setTvPopupGuide('Không thể truy cập màn hình phụ, đã mở TV Client theo chế độ cửa sổ/tab bình thường.');
      }

      setIsTvPickerOpen(false);
    } catch (error: any) {
      setTvPickerError(error?.message || 'Không thể mở TV Client. Vui lòng thử lại.');
    } finally {
      setOpeningTvClient(false);
    }
  };

  // Listen for auth:logout event from axios interceptor
  useEffect(() => {
    const handleAuthLogout = () => {
      console.log('🔔 Session expired event received');
      // KHÔNG clear auth state ngay - đợi user confirm modal
      // Chỉ hiển thị modal
      setSessionExpiredModalOpen(true);
    };

    window.addEventListener('auth:logout', handleAuthLogout);
    return () => window.removeEventListener('auth:logout', handleAuthLogout);
  }, []);

  // Sync auth state across tabs when localStorage changes
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      // Only handle auth-related changes
      if (event.key === 'isAuthenticated') {
        setIsAuthenticated(event.newValue === 'true');
      } else if (event.key === 'currentUser') {
        setCurrentUser(event.newValue || '');
      } else if (event.key === 'userRole') {
        setUserRole(event.newValue || '');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Handle logout - end session first, then clear auth
  const handleLogout = async () => {
    // Check if there's an active serving ticket
    const hasActiveServing = localStorage.getItem('currentTicketStatus') === 'serving';
    if (hasActiveServing) {
      alert('⚠️ Không thể đăng xuất khi đang phục vụ khách hàng. Vui lòng hoàn thành hoặc chuyển vé trước.');
      return;
    }

    setIsLoggingOut(true);
    const authToken = localStorage.getItem('authToken');
    const userRole = localStorage.getItem('userRole');

    // If user is staff, end their counter session
    if (userRole === 'staff' && authToken) {
      try {
        await fetch('http://localhost:5000/api/staff/session/end', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        });
        console.log('✅ Counter session ended');
      } catch (error) {
        console.error('❌ Error ending session:', error);
      }
    }

    // Clear auth data
    setIsAuthenticated(false);
    setCurrentUser('');
    setUserRole('');
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('authToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem('counterSessionToken');
    localStorage.removeItem('currentSession');
    localStorage.removeItem('activeCounter');
    localStorage.removeItem('activeCounterNumber');
    localStorage.removeItem('userOfficeId');
    localStorage.removeItem('currentTicketStatus');

    setLogoutConfirmOpen(false);
    setIsLoggingOut(false);
  };

  // Check if current route is board display (full-screen, no sidebar/header)
  const isBoardDisplayRoute = window.location.hash.includes('#/board/live');

  // Render Session Expired Modal globally (outside authentication check)
  const renderSessionExpiredModal = () => (
    <Modal
      isOpen={sessionExpiredModalOpen}
      title="Phiên đăng nhập hết hạn"
      message="Phiên đăng nhập của bạn đã hết hạn. Vui lòng đăng nhập lại."
      type="warning"
      onCancel={() => setSessionExpiredModalOpen(false)}
      onConfirm={async () => {
        setSessionExpiredModalOpen(false);

        // End counter session if exists before clearing
        const counterSessionToken = localStorage.getItem('counterSessionToken');
        if (counterSessionToken) {
          try {
            await fetch('http://localhost:5000/api/staff/session/end-by-token', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-counter-session-token': counterSessionToken
              },
              body: JSON.stringify({ sessionToken: counterSessionToken })
            });
            console.log('✅ Counter session ended via token (session expired)');
          } catch (error) {
            console.error('❌ Failed to end session via token:', error);
          }
        }

        // Clear ALL auth data
        localStorage.removeItem('authToken');
        localStorage.removeItem('userInfo');
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('userRole');
        localStorage.removeItem('counterSessionToken');
        localStorage.removeItem('currentSession');
        localStorage.removeItem('activeCounter');
        localStorage.removeItem('activeCounterNumber');
        localStorage.removeItem('userOfficeId');
        // Update state để về login page (KHÔNG cần reload)
        setIsAuthenticated(false);
        setCurrentUser('');
        setUserRole('');
      }}
      confirmText="Đăng nhập lại"
    />
  );

  // If not authenticated, show Login page (wrapped in Router for useNavigate)
  if (!isAuthenticated) {
    return (
      <>
        <HashRouter>
          <Login onLoginSuccess={handleLoginSuccess} />
        </HashRouter>
        {renderSessionExpiredModal()}
      </>
    );
  }

  if (isBoardDisplayRoute) {
    return (
      <>
        <HashRouter>
          <Routes>
            <Route path="/board/live" element={<BoardDisplayPage />} />
          </Routes>
        </HashRouter>
        {renderSessionExpiredModal()}
      </>
    );
  }

  // If authenticated, show main app
  return (
    <HashRouter>
      {/* Role-aware redirects: use a child component to access navigation hook inside router */}
      <RoleRedirector userRole={userRole} />

      <div className="min-h-screen bg-gray-50 flex font-sans relative">

        {/* Mobile Overlay */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Unified Sidebar Component */}
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          userRole={userRole}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <Header
            onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
            username={currentUser}
            userRole={userRole}
            onLogoutClick={() => setLogoutConfirmOpen(true)}
            hasActiveServing={hasActiveServing}
            onOpenTvPicker={handleOpenTvPicker}
          />
          <main className="flex-1 p-6 overflow-x-hidden">
            <div key={userRole}>
              <Routes>
                {/* Admin & Manager Routes */}
                <Route
                  path="/"
                  element={
                    <PrivateRoute allowedRoles={['admin', 'manager']}>
                      <Dashboard />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/reports"
                  element={
                    <PrivateRoute allowedRoles={['admin', 'manager']}>
                      <Reports />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/services"
                  element={
                    <PrivateRoute allowedRoles={['admin', 'manager']}>
                      <ServiceManager />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/pgd"
                  element={
                    <PrivateRoute allowedRoles={['admin', 'manager']}>
                      <PGDManager />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/devices"
                  element={
                    <PrivateRoute allowedRoles={['admin', 'manager']}>
                      <DeviceManager />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/users"
                  element={
                    <PrivateRoute allowedRoles={['admin', 'manager']}>
                      <UserManager />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/about"
                  element={
                    <PrivateRoute allowedRoles={['admin', 'manager']}>
                      <div className="text-center py-20 text-gray-500">About Page - Coming Soon</div>
                    </PrivateRoute>
                  }
                />

                {/* Staff Routes */}
                <Route
                  path="/counter/config"
                  element={
                    <PrivateRoute allowedRoles={['staff']}>
                      <CounterConfig />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/counter/live"
                  element={
                    <PrivateRoute allowedRoles={['staff']}>
                      <CounterLive />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/counter/monitor"
                  element={
                    <PrivateRoute allowedRoles={['staff']}>
                      <MonitorLive />
                    </PrivateRoute>
                  }
                />

                {/* Public Route - No Auth */}
                <Route path="/board/live" element={<BoardDisplayPage />} />
              </Routes>
            </div>
          </main>
        </div>

        {/* Logout Confirmation Modal */}
        <Modal
          isOpen={logoutConfirmOpen}
          title="Xác nhận đăng xuất"
          message="Bạn có chắc chắn muốn đăng xuất? Phiên làm việc hiện tại của bạn sẽ kết thúc."
          type="warning"
          onConfirm={handleLogout}
          onCancel={() => setLogoutConfirmOpen(false)}
          confirmText="Đăng xuất"
          cancelText="Hủy"
          isLoading={isLoggingOut}
        />

        {/* TV Picker Modal */}
        {isTvPickerOpen && (
          <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/45 p-4">
            <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                <h3 className="text-lg font-semibold text-gray-900">Mở màn hình TV Client</h3>
                <button
                  type="button"
                  onClick={closeTvPicker}
                  disabled={openingTvClient}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
                  title="Đóng"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="px-6 py-4 space-y-4">
                {loadingEboards ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600 text-center">
                    Đang tải danh sách E-Board...
                  </div>
                ) : tvPickerError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {tvPickerError}
                  </div>
                ) : eboards.length === 0 ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600 text-center">
                    Không có E-Board đang hoạt động.
                  </div>
                ) : (
                  <div className="max-h-[320px] overflow-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
                    {eboards
                      .map((item) => (
                        <label
                          key={item.id}
                          className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 hover:bg-gray-50"
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="radio"
                              name="eboard-code"
                              checked={selectedEboardCode === item.code}
                              onChange={() => setSelectedEboardCode(item.code)}
                              className="mt-1 h-4 w-4"
                            />
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{item.code}</p>
                              <p className="text-sm text-gray-600">{item.name || 'Không có tên'}</p>
                            </div>
                          </div>
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                            Đang hoạt động
                          </span>
                        </label>
                      ))}
                  </div>
                )}

                {tvPopupGuide && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    {tvPopupGuide}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4 bg-gray-50">
                <button
                  type="button"
                  onClick={closeTvPicker}
                  disabled={openingTvClient}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleOpenTvClient}
                  disabled={!selectedEboardCode || loadingEboards || openingTvClient}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {openingTvClient ? 'Đang mở...' : 'Mở TV Client'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {renderSessionExpiredModal()}
    </HashRouter>
  );
};

const RoleRedirector: React.FC<{ userRole: string }> = ({ userRole }) => {
  const navigate = useNavigate();

  // Auto-restore session for staff users on app load
  useEffect(() => {
    const restoreStaffSession = async () => {
      if (userRole !== 'staff') return;

      const sessionToken = localStorage.getItem('counterSessionToken');
      const authToken = localStorage.getItem('authToken');

      if (!sessionToken || !authToken) {
        // No session token, redirect to config
        if (window.location.hash !== '#/counter/config') {
          navigate('/counter/config', { replace: true });
        }
        return;
      }

      try {
        // Try to restore session
        const response = await fetch('http://localhost:5000/api/staff/session/restore', {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'x-counter-session-token': sessionToken,
          },
        });

        if (response.ok) {
          const data = await response.json();
          // Session is valid, update localStorage with fresh data
          localStorage.setItem('currentSession', JSON.stringify(data.data.session));
          localStorage.setItem('activeCounter', data.data.counter.counter_id.toString());
          localStorage.setItem('activeCounterNumber', data.data.counter.counter_number);

          // Redirect to counter live page (or whatever the working page is)
          if (window.location.hash === '#/' || window.location.hash === '#/counter/config') {
            // TODO: Change to actual counter live page when available
            navigate('/counter/config', { replace: true });
          }
        } else {
          // Session expired or invalid, clear token and redirect to config
          localStorage.removeItem('counterSessionToken');
          localStorage.removeItem('currentSession');
          localStorage.removeItem('activeCounter');
          localStorage.removeItem('activeCounterNumber');
          navigate('/counter/config', { replace: true });
        }
      } catch (error) {
        // Network error, clear tokens
        localStorage.removeItem('counterSessionToken');
        navigate('/counter/config', { replace: true });
      }
    };

    restoreStaffSession();
  }, [userRole, navigate]);

  // If the current user is a staff and the app is at the root, redirect them to counter config
  useEffect(() => {
    if (userRole === 'staff' && window.location.hash === '#/') {
      navigate('/counter/config', { replace: true });
    }
  }, [userRole, navigate]);

  // Also ensure admin/manager users at the staff page get redirected to dashboard
  useEffect(() => {
    if ((userRole === 'admin' || userRole === 'manager') && window.location.hash === '#/counter/config') {
      navigate('/', { replace: true });
    }
  }, [userRole, navigate]);

  return null;
};

export default App;