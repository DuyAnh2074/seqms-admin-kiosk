import React from 'react';
import { Navigate } from 'react-router-dom';

interface PrivateRouteProps {
    children: React.ReactNode;
    allowedRoles: string[];
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children, allowedRoles }) => {
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
    const userRole = localStorage.getItem('userRole') || '';

    // If not authenticated, redirect to login
    if (!isAuthenticated) {
        return <Navigate to="/" replace />;
    }

    // If user role is not in allowed roles, redirect to appropriate page
    if (!allowedRoles.includes(userRole)) {
        // Staff should see counter config, admin/manager should see dashboard
        if (userRole === 'staff') {
            return <Navigate to="/counter/config" replace />;
        }

        // If trying to access admin pages without permission, show unauthorized
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-red-600 mb-4">403</h1>
                    <p className="text-xl text-gray-700 mb-2">Unauthorized Access</p>
                    <p className="text-gray-500">You don't have permission to access this page.</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};

export default PrivateRoute;
