import { X, Calendar, Clock, Briefcase } from 'lucide-react';
import { Application, ApplicationStage } from '../types';

interface CalendarEvent {
    id: string;
    date: Date;
    type: 'Application' | 'Stage';
    title: string;
    subtitle?: string;
    status?: string;
    data: Application | ApplicationStage;
}

interface DayDetailsModalProps {
    date: Date;
    events: CalendarEvent[];
    onClose: () => void;
}

export function DayDetailsModal({ date, events, onClose }: DayDetailsModalProps) {
    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="fixed inset-0 bg-[#0e4a58]/25 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-pop w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-[#e8f6f9] to-[#d5eef2]">
                    <div>
                        <h3 className="text-[15px] font-semibold text-[#0e4a58]">{formatDate(date)}</h3>
                        <p className="text-sm text-slate-500 font-medium">{events.length} events</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/50 rounded-full transition-colors text-slate-500 hover:text-slate-700"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
                    {events.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">
                            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>No events for this day</p>
                        </div>
                    ) : (
                        events.map((event) => (
                            <div key={event.id} className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                                <div className={`absolute left-0 top-0 bottom-0 w-1 ${event.type === 'Stage' ? 'bg-[#0e5a6e]' : 'bg-[#4a9fb0]'}`} />

                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-semibold text-slate-800">{event.title}</h4>
                                    <span className={`text-xs font-semibold px-2 py-1 rounded-full capitalize
                                        ${event.type === 'Stage'
                                            ? 'bg-[#cfeaef] text-[#0c4c5d]'
                                            : 'bg-[#e8f6f9] text-[#0e5a6e]'}
                                    `}>
                                        {event.type}
                                    </span>
                                </div>

                                {event.subtitle && (
                                    <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                                        <Briefcase className="w-4 h-4 text-slate-400" />
                                        <span>{event.subtitle}</span>
                                    </div>
                                )}

                                <div className="flex items-center gap-4 text-xs text-slate-500 mt-3 pt-3 border-t border-slate-50">
                                    <div className="flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5" />
                                        <span>{formatTime(event.date)}</span>
                                    </div>
                                    {event.status && (
                                        <div className="flex items-center gap-1.5">
                                            <div className={`w-2 h-2 rounded-full
                                                ${event.status === 'passed' ? 'bg-emerald-500' :
                                                    event.status === 'failed' ? 'bg-rose-500' :
                                                        event.status === 'upcoming' ? 'bg-amber-500' : 'bg-slate-300'}
                                            `} />
                                            <span className="capitalize">{event.status}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
