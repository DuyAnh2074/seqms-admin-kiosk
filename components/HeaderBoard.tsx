import React, { useState, useEffect } from 'react';

interface HeaderBoardProps {
    officeName?: string;
    logoUrl?: string;
}

const HeaderBoard: React.FC<HeaderBoardProps> = ({
    officeName = 'TRUNG TÂM HỘI TỤ VÀ TIẾP ĐÓN',
    logoUrl = '/assets/vndc-logo.png'
}) => {
    const [currentTime, setCurrentTime] = useState<string>('');
    const [currentDate, setCurrentDate] = useState<string>('');

    useEffect(() => {
        const updateTime = () => {
            const now = new Date();

            // Format giờ:phút
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            setCurrentTime(`${hours}:${minutes}`);

            // Format ngày/tháng/năm
            const day = String(now.getDate()).padStart(2, '0');
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const year = now.getFullYear();
            const dayOfWeek = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][now.getDay()];
            setCurrentDate(`${dayOfWeek}, ${day}/${month}/${year}`);
        };

        updateTime();
        // Cập nhật mỗi giây để bắt kịp thay đổi phút chính xác, react sẽ chặn render nếu state không đổi
        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="h-full w-full bg-white/80 shadow-xl border-b border-gray-100 flex items-center justify-between px-8 z-50 relative overflow-hidden">
            {/* Left Section - Logo & Office Name */}
            <div className="flex items-center gap-8 h-full py-2 flex-1 min-w-0">
                {/* Logo Area */}
                <div className="h-60 w-60 aspect-square flex items-center justify-center p-1 flex-shrink-0">
                    {logoUrl ? (
                        <img
                            src={logoUrl}
                            alt="Logo"
                            className="h-full w-auto object-contain drop-shadow-lg"
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                        />
                    ) : null}
                </div>

                <div className="h-16 w-px bg-gray-200 mx-2"></div>

                {/* Office Name */}
                <div className="flex flex-col justify-center flex-1 min-w-0">
                    <h1 className="text-4xl font-black text-slate-800 uppercase tracking-wide truncate">
                        VNDC - {officeName}
                    </h1>
                    <span className="text-lg text-slate-800 font-medium tracking-wider truncate">HỆ THỐNG ĐIỀU PHỐI KHÁCH HÀNG THÔNG MINH</span>
                </div>
            </div>

            {/* Right Section - Clock */}
            <div className="flex flex-col items-end justify-center h-full flex-shrink-0 pl-6">
                <div className="text-5xl font-black text-blue-800 leading-none tabular-nums tracking-tighter shadow-blue-200 drop-shadow-sm">
                    {currentTime}
                </div>
                <div className="text-xl font-bold text-blue-800 uppercase tracking-widest mt-1">
                    {currentDate}
                </div>
            </div>
        </div>
    );
};

export default HeaderBoard;
