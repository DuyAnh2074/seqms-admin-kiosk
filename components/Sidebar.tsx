import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X, AlertCircle, Menu, ChevronDown } from 'lucide-react';
import { MENU_ITEMS, getMenuItemsByRole, isMenuItemDisabled } from '../constants/menu'; // Đảm bảo đường dẫn đúng

interface SidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
    userRole?: string;
}

const Sidebar: React.FC<SidebarProps> = ({
    isOpen = true,
    onClose,
    userRole = 'admin',
}) => {
    const location = useLocation();
    const navigate = useNavigate();
    const [showWarning, setShowWarning] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Get filtered menu items based on user role
    const visibleMenuItems = getMenuItemsByRole(userRole);

    const isActive = (path: string) => {
        if (path === '/') {
            return location.pathname === '/';
        }
        return location.pathname === path || location.pathname.startsWith(path + '/');
    };

    const handleNavigateWithCheck = (path: string, requiresCounter?: boolean) => {
        if (requiresCounter) {
            const sessionToken = localStorage.getItem('counterSessionToken');
            if (!sessionToken) {
                setShowWarning(true);
                setTimeout(() => setShowWarning(false), 3000);
                return;
            }
        }
        navigate(path);
        onClose?.();
    };

    const getMenuTitle = () => {
        // if (userRole === 'staff') {
        //     return 'Quầy Làm Việc';
        // }
        return 'Main Menu';
    };

    return (
        <aside
            className={`
                fixed top-0 left-0 h-screen bg-white border-r border-gray-200 flex flex-col z-40
                transition-all duration-300 ease-in-out
                ${isOpen ? 'translate-x-0' : '-translate-x-full'}
                
    
                lg:translate-x-0 lg:z-20 lg:sticky lg:top-0
                
                ${isCollapsed ? 'w-20' : 'w-64'}
            `}
        >
            {/* Close Button (Mobile Only) */}
            {onClose && (
                <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100 lg:hidden">
                    <button
                        onClick={onClose}
                        className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                        title="Close menu"
                    >
                        <X size={20} />
                    </button>
                </div>
            )}

            {/* Collapse/Expand Button (Desktop Only) */}
            <div className="hidden lg:flex h-16 items-center justify-between px-4 border-b border-gray-100 shrink-0">
                {!isCollapsed && (
                    <img
                        src="/assets/vndc-logo.png"
                        alt="VNDC Logo"
                        className="h-12 w-auto cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => {
                            navigate('/');
                            onClose?.();
                        }}
                        title="Quay về trang chủ"
                    />
                )}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded transition-colors"
                    title={isCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
                >
                    <Menu size={20} />
                </button>
            </div>

            {/* Warning Message */}
            {showWarning && (
                <div
                    className={`px-6 py-3 bg-yellow-50 border-b border-yellow-200 flex items-start gap-3 shrink-0 ${isCollapsed ? 'hidden' : ''
                        }`}
                >
                    <AlertCircle size={18} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-yellow-700">
                        <p className="font-medium">Chưa chọn quầy</p>
                        <p className="text-xs">Vui lòng chọn quầy trước khi sử dụng tính năng này</p>
                    </div>
                </div>
            )}

            {/* Navigation (Thêm overflow-y-auto để cuộn menu nếu danh sách quá dài) */}
            <nav className="flex-1 py-4 overflow-y-auto custom-scrollbar">
                {/* Menu Section Title */}
                <div
                    className={`px-6 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider ${isCollapsed ? 'hidden' : ''
                        }`}
                >
                    {getMenuTitle()}
                </div>

                {/* Menu Items */}
                {visibleMenuItems.map((item) => {
                    const disabled = isMenuItemDisabled(item);
                    const active = isActive(item.path);
                    const IconComponent = item.icon;

                    return (
                        <button
                            key={item.path}
                            onClick={() => handleNavigateWithCheck(item.path, item.requiresCounter)}
                            disabled={disabled}
                            className={`
                                w-full text-left flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors
                                ${active
                                    ? 'bg-blue-50 text-blue-600 border-r-4 border-blue-600'
                                    : disabled
                                        ? 'text-gray-400 cursor-not-allowed opacity-60'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }
                                ${isCollapsed ? 'px-3 justify-center' : ''}
                            `}
                            title={
                                disabled
                                    ? 'Vui lòng chọn quầy trước'
                                    : item.label
                            }
                        >
                            <span className="flex-shrink-0">
                                <IconComponent size={20} />
                            </span>
                            {!isCollapsed && (
                                <div className="flex items-center justify-between flex-1">
                                    <span>{item.label}</span>
                                    {item.hasSubmenu && (
                                        <ChevronDown size={14} className="text-gray-400" />
                                    )}
                                </div>
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* Footer - User Info (Optional) */}
            <div
                className={`px-6 py-4 border-t border-gray-100 text-center text-xs text-gray-500 shrink-0 ${isCollapsed ? 'hidden' : ''
                    }`}
            >
                <p>
                    © 2026 VNDC.
                </p>
            </div>
        </aside>
    );
};

export default Sidebar;