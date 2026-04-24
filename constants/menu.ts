import {
    Home,
    BarChart2,
    Briefcase,
    MapPin,
    Monitor,
    Users,
    Settings,
    Info,
    LucideIcon,
} from 'lucide-react';

export interface MenuItem {
    label: string;
    path: string;
    icon: LucideIcon;
    roles: ('admin' | 'manager' | 'staff')[];
    requiresCounter?: boolean; // For staff pages that need counter selection
    hasSubmenu?: boolean;
}

// Centralized menu configuration
export const MENU_ITEMS: MenuItem[] = [
    // ========== ADMIN & MANAGER MENU ==========
    {
        label: 'Trang Chủ',
        path: '/',
        icon: Home,
        roles: ['admin', 'manager'],
    },
    {
        label: 'Báo Cáo & Thống Kê',
        path: '/reports',
        icon: BarChart2,
        roles: ['admin', 'manager'],
    },
    {
        label: 'Quản Lý Dịch Vụ',
        path: '/services',
        icon: Briefcase,
        roles: ['admin', 'manager'],
        hasSubmenu: true,
    },
    {
        label: 'Quản Lý PGD',
        path: '/pgd',
        icon: MapPin,
        roles: ['admin', 'manager'],
        hasSubmenu: true,
    },
    {
        label: 'Quản Lý Thiết Bị',
        path: '/devices',
        icon: Monitor,
        roles: ['admin', 'manager'],
        hasSubmenu: true,
    },
    {
        label: 'Quản Lý Người Dùng',
        path: '/users',
        icon: Users,
        roles: ['admin', 'manager'],
    },
    // {
    //     label: 'Về Ứng Dụng',
    //     path: '/about',
    //     icon: Info,
    //     roles: ['admin', 'manager'],
    // },

    // ========== STAFF MENU ==========
    {
        label: 'Phục Vụ Tại Quầy',
        path: '/counter/live',
        icon: Home,
        roles: ['staff'],
        requiresCounter: true,
    },
    {
        label: 'Giám Sát Trực Tuyến',
        path: '/counter/monitor',
        icon: Monitor,
        roles: ['staff'],
        requiresCounter: true,
    },
    {
        label: 'Cấu Hình Quầy',
        path: '/counter/config',
        icon: Settings,
        roles: ['staff'],
    },
];

/**
 * Filter menu items based on user role
 * @param userRole The current user's role
 * @returns Filtered menu items that should be displayed
 */
export const getMenuItemsByRole = (userRole: string): MenuItem[] => {
    return MENU_ITEMS.filter((item) =>
        item.roles.includes(userRole as 'admin' | 'manager' | 'staff')
    );
};

/**
 * Check if a menu item should be disabled
 * (e.g., staff items that require counter selection when no counter is selected)
 * @param item The menu item to check
 * @returns true if the item should be disabled
 */
export const isMenuItemDisabled = (item: MenuItem): boolean => {
    if (item.requiresCounter) {
        const sessionToken = localStorage.getItem('counterSessionToken');
        return !sessionToken;
    }
    return false;
};
