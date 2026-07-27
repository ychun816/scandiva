import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { Application, ApplicationStage } from '../types';
import { DayDetailsModal } from './DayDetailsModal';

interface CalendarViewProps {
    applications: Application[];
}

interface CalendarEvent {
    id: string;
    date: Date;
    type: 'Application' | 'Stage';
    title: string;
    subtitle?: string;
    status?: string;
    data: Application | ApplicationStage;
    applicationId?: number; // For linking back to main app if needed
}

export function CalendarView({ applications }: CalendarViewProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay(); // 0 = Sunday

    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const events = useMemo(() => {
        const allEvents: CalendarEvent[] = [];

        applications.forEach(app => {
            // Add application creation/applied date
            allEvents.push({
                id: `app-${app.id}`,
                date: new Date(app.appliedDate),
                type: 'Application',
                title: app.company,
                subtitle: app.position,
                status: app.status,
                data: app,
                applicationId: app.id
            });

            // Add stages
            if (app.stages) {
                app.stages.forEach(stage => {
                    allEvents.push({
                        id: `stage-${stage.id}`,
                        date: new Date(stage.date),
                        type: 'Stage',
                        title: `${app.company} - ${stage.stageName}`,
                        subtitle: stage.status,
                        status: stage.status,
                        data: stage,
                        applicationId: app.id
                    });
                });
            }
        });

        return allEvents;
    }, [applications]);

    const getEventsForDay = (day: number) => {
        const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        return events.filter(event => {
            return event.date.getDate() === day &&
                event.date.getMonth() === targetDate.getMonth() &&
                event.date.getFullYear() === targetDate.getFullYear();
        });
    };

    const renderCalendarDays = () => {
        const days = [];
        const today = new Date();

        // Empty cells for previous month
        for (let i = 0; i < firstDayOfMonth; i++) {
            days.push(<div key={`empty-${i}`} className="h-32 bg-slate-50/50 border border-slate-100 rounded-xl m-1"></div>);
        }

        // Days of current month
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            const dayEvents = getEventsForDay(day);
            const isToday = date.getDate() === today.getDate() &&
                date.getMonth() === today.getMonth() &&
                date.getFullYear() === today.getFullYear();
            const isPast = date < new Date(today.setHours(0, 0, 0, 0));

            days.push(
                <div
                    key={day}
                    onClick={() => setSelectedDate(date)}
                    className={`h-32 border rounded-xl m-1 p-2 flex flex-col gap-1 cursor-pointer transition-all hover:shadow-md overflow-hidden
                        ${isToday ? 'bg-white border-[#0e5a6e] shadow-[#bfe0e6] ring-1 ring-[#0e5a6e]' : 'bg-white border-slate-200 hover:border-[#9fcdd6]'}
                        ${isPast ? 'bg-slate-50/80' : ''}
                    `}
                >
                    <div className="flex justify-between items-start">
                        <span className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full
                            ${isToday ? 'bg-[#0e5a6e] text-white' : 'text-slate-700'}
                        `}>
                            {day}
                        </span>
                        {dayEvents.length > 0 && (
                            <span className="text-xs font-bold text-[#0e5a6e] bg-[#e8f6f9] px-1.5 py-0.5 rounded-md">
                                {dayEvents.length}
                            </span>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto mt-1 space-y-1 custom-scrollbar">
                        {dayEvents.slice(0, 3).map((event) => (
                            <div
                                key={event.id}
                                className={`text-[10px] px-1.5 py-1 rounded border truncate
                                    ${isPast ? 'bg-slate-100 text-slate-500 border-slate-200' :
                                        event.type === 'Stage' ? 'bg-white text-[#0e5a6e] border-[#9fcdd6]' : 'bg-[#e8f6f9] text-[#0e5a6e] border-[#bfe0e6]'}
                                `}
                                title={event.title}
                            >
                                {event.title}
                            </div>
                        ))}
                        {dayEvents.length > 3 && (
                            <div className="text-[10px] text-slate-400 pl-1">
                                +{dayEvents.length - 3} more
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return days;
    };

    return (
        <div className="p-6 h-full flex flex-col board-surface">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-[#0e4a58] flex items-center gap-3">
                    <div className="p-2 bg-[#e8f6f9] rounded-lg text-[#0e5a6e]">
                        <CalendarIcon className="w-5 h-5" />
                    </div>
                    {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h2>
                <div className="flex gap-2">
                    <button onClick={prevMonth} className="p-2 hover:bg-white/70 rounded-lg transition-colors text-slate-600">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 text-sm font-medium text-[#0e5a6e] hover:bg-[#e8f6f9] rounded-lg transition-colors">
                        Today
                    </button>
                    <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600">
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center text-sm font-medium text-slate-500 py-2">
                        {day}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 auto-rows-fr flex-1 overflow-y-auto">
                {renderCalendarDays()}
            </div>

            {selectedDate && (
                <DayDetailsModal
                    date={selectedDate}
                    events={getEventsForDay(selectedDate.getDate())}
                    onClose={() => setSelectedDate(null)}
                />
            )}
        </div>
    );
}
