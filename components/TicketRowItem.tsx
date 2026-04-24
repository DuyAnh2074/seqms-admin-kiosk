import React from 'react';

interface TicketRowItemProps {
    counterCode: string;
    ticketNumber: string;
    className?: string;
}

const TicketRowItem: React.FC<TicketRowItemProps> = ({ counterCode, ticketNumber, className = '' }) => {
    return (
        <div className={`flex items-center rounded-xl overflow-hidden shadow-lg transform transition-all duration-300  ${className}`}>
            {/* Counter Box - Flat Design, Dark Blue */}
            <div className="bg-blue-600/90 backdrop-blur-sm text-white w-[35%] h-full flex flex-col items-center justify-center border-r border-blue-500/30">
                <span className="text-xs uppercase font-semibold opacity-70 mb-1">Quầy</span>
                <span className="font-bold text-2xl md:text-3xl">{counterCode}</span>
            </div>

            {/* Ticket Number Box - White/Glass */}
            <div className="bg-white flex-1 h-full flex flex-col items-center justify-center relative">
                <span className="font-black text-4xl md:text-6xl text-slate-800 tracking-wider">
                    {ticketNumber || ''}
                </span>
                <div className="absolute bottom-1 right-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                </div>
            </div>
        </div>
    );
};

export default TicketRowItem;
