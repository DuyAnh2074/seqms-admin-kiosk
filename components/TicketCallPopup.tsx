import React, { useEffect, useState } from 'react';

interface TicketCallPopupProps {
    isVisible: boolean;
    ticketNumber: string;
    counterName: string;
}

/**
 * Premium Blue & Gold Ticket Calling Popup
 * Elegant and Harmonious Design
 */
const TicketCallPopup: React.FC<TicketCallPopupProps> = ({
    isVisible,
    ticketNumber,
    counterName,
}) => {
    const [show, setShow] = useState(isVisible);

    useEffect(() => {
        if (isVisible) {
            setShow(true);
        } else {
            const timer = setTimeout(() => setShow(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isVisible]);

    if (!show && !isVisible) return null;

    // Extract counter number
    const counterDisplay = counterName ? counterName.replace(/\D/g, '') : '';

    return (
        <div
            className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-all duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'
                }`}
        >
            {/* Main Card Container - Premium Blue & Gold */}
            <div
                className={`
                    relative w-[700px] rounded-3xl p-2
                    bg-gradient-to-b from-slate-800 to-slate-900
                    border-2 border-amber-400
                    shadow-[0_0_50px_-10px_rgba(251,191,36,0.4)]
                    transform transition-all duration-500 cubic-bezier(0.175, 0.885, 0.32, 1.275)
                    ${isVisible ? 'scale-100 translate-y-0' : 'scale-50 translate-y-10'}
                    animate-border-pulse
                `}
            >
                {/* Inner Content Area */}
                <div className="rounded-3xl p-16 flex flex-col items-center gap-8 bg-gradient-to-b from-slate-700/40 to-slate-800/60 backdrop-blur-md relative overflow-hidden">

                    {/* Subtle Background Pattern */}
                    <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-400 via-transparent to-transparent"></div>

                    {/* Header Text */}
                    <div className="text-center space-y-3 relative z-10">
                        <h3 className="text-slate-300 text-3xl font-bold uppercase tracking-[0.2em]">
                            Xin mời khách số
                        </h3>
                    </div>

                    {/* Ticket Number - Hero Element with Gradient */}
                    <div className="relative z-10 my-4">
                        <div className="text-[160px] leading-[0.9] font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-300 to-amber-500 drop-shadow-[0_10px_20px_rgba(0,0,0,0.6)] tracking-tighter">
                            {ticketNumber}
                        </div>
                    </div>

                    {/* Elegant Divider */}
                    <div className="w-40 h-1 bg-gradient-to-r from-transparent via-amber-400/70 to-transparent rounded-full my-2"></div>

                    {/* Counter Info */}
                    <div className="flex flex-col items-center gap-3 relative z-10">
                        <span className="text-slate-300 text-3xl uppercase tracking-widest font-bold">
                            Đến quầy
                        </span>

                        <div className="relative mt-4">
                            {/* Glow effect behind counter */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-amber-400/15 rounded-full blur-2xl"></div>

                            {/* Counter Number - White with subtle styling */}
                            <div className="relative">
                                <span className="text-9xl font-black text-white drop-shadow-[0_6px_12px_rgba(0,0,0,0.7)] tracking-tighter">
                                    {counterDisplay || counterName}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Corner Accents - Gold Color */}
                <svg className="absolute top-0 left-0 w-20 h-20 text-amber-400 opacity-30 transform -translate-x-2 -translate-y-2" viewBox="0 0 100 100">
                    <path fill="currentColor" d="M20,0 L0,0 L0,20 L5,20 L5,5 L20,5 Z" />
                </svg>
                <svg className="absolute bottom-0 right-0 w-20 h-20 text-amber-400 opacity-30 transform rotate-180 -translate-x-2 -translate-y-2" viewBox="0 0 100 100">
                    <path fill="currentColor" d="M20,0 L0,0 L0,20 L5,20 L5,5 L20,5 Z" />
                </svg>
            </div>

            <style>{`
                @keyframes border-pulse {
                    0%, 100% { 
                        box-shadow: 0 0 50px -10px rgba(251, 191, 36, 0.4),
                                    inset 0 0 20px -10px rgba(251, 191, 36, 0.1);
                    }
                    50% { 
                        box-shadow: 0 0 70px 0px rgba(251, 191, 36, 0.6),
                                    inset 0 0 30px -5px rgba(251, 191, 36, 0.15);
                    }
                }
                .animate-border-pulse {
                    animation: border-pulse 2s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
};

export default TicketCallPopup;
