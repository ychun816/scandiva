import { Application } from '../types';
import { TrendingUp, Users, Briefcase, CheckCircle, Clock } from 'lucide-react';

interface AnalyticsViewProps {
    applications: Application[];
}

export function AnalyticsView({ applications }: AnalyticsViewProps) {
    // 1. Calculate Stats
    const total = applications.length;
    const active = applications.filter(app => ['Applied', 'Interviewing'].includes(app.status)).length;
    const interviews = applications.filter(app => app.status === 'Interviewing').length;
    const offers = applications.filter(app => app.status === 'Offer').length;

    const interviewRate = total > 0 ? Math.round((interviews / total) * 100) : 0;
    const offerRate = interviews > 0 ? Math.round((offers / interviews) * 100) : 0;

    // 2. Calculate Funnel Data — teal shades to stay on the board palette
    const funnelData = [
        { label: 'Applied', count: applications.filter(app => app.status !== 'To Apply').length, color: 'bg-[#9fcdd6]' },
        { label: 'Interviewing', count: interviews, color: 'bg-[#4a9fb0]' },
        { label: 'Offer', count: offers, color: 'bg-[#0e5a6e]' },
    ];
    const maxFunnel = Math.max(...funnelData.map(d => d.count), 1);

    // 3. Calculate Activity (Last 14 Days)
    const last14Days = Array.from({ length: 14 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
    }).reverse();

    const activityData = last14Days.map(date => {
        const count = applications.filter(app => app.appliedDate.startsWith(date)).length;
        return { date, count };
    });
    const maxActivity = Math.max(...activityData.map(d => d.count), 1);


    return (
        <div className="p-6 h-full overflow-y-auto board-surface">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Header */}
                <div>
                    <h2 className="text-xl font-semibold text-[#0e4a58]">Analytics Dashboard</h2>
                    <p className="text-slate-500 text-[12.5px]">Track your job search performance</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard title="Total Applications" value={total} icon={<Briefcase className="w-[18px] h-[18px]" />} />
                    <StatCard title="Active Processes" value={active} icon={<Clock className="w-[18px] h-[18px]" />} />
                    <StatCard title="Interview Rate" value={`${interviewRate}%`} icon={<Users className="w-[18px] h-[18px]" />} subtext="of applications" />
                    <StatCard title="Offer Rate" value={`${offerRate}%`} icon={<CheckCircle className="w-[18px] h-[18px]" />} subtext="of interviews" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* Funnel Chart */}
                    <div className="bg-white/80 backdrop-blur-sm p-5 rounded-2xl shadow-card border border-slate-200/70">
                        <h3 className="text-[15px] font-semibold text-slate-800 mb-5 flex items-center gap-2">
                            <TrendingUp className="w-[17px] h-[17px] text-[#0e5a6e]" />
                            Conversion Funnel
                        </h3>
                        <div className="space-y-4">
                            {funnelData.map((item) => (
                                <div key={item.label} className="space-y-2">
                                    <div className="flex justify-between text-[12.5px] font-medium">
                                        <span className="text-slate-600">{item.label}</span>
                                        <span className="text-slate-900">{item.count}</span>
                                    </div>
                                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full ${item.color} rounded-full transition-all duration-500`}
                                            style={{ width: `${(item.count / maxFunnel) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Activity Chart */}
                    <div className="bg-white/80 backdrop-blur-sm p-5 rounded-2xl shadow-card border border-slate-200/70">
                        <h3 className="text-[15px] font-semibold text-slate-800 mb-5 flex items-center gap-2">
                            <Clock className="w-[17px] h-[17px] text-[#0e5a6e]" />
                            Activity (Last 14 Days)
                        </h3>
                        <div className="flex items-end justify-between h-48 gap-2">
                            {activityData.map((item) => (
                                <div key={item.date} className="flex-1 h-full flex flex-col items-center gap-2 group">
                                    {/* flex-1 wrapper gives the bar a resolvable height for its percentage */}
                                    <div className="w-full flex-1 flex items-end">
                                    <div
                                        className="w-full bg-[#bfe0e6] hover:bg-[#9fcdd6] rounded-t-md transition-all relative group-hover:shadow-md"
                                        style={{ height: `${(item.count / maxActivity) * 100}%`, minHeight: '4px' }}
                                    >
                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#0e4a58] text-white text-[11px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                            {item.count} apps
                                        </div>
                                    </div>
                                    </div>
                                    <div className="text-[10px] text-slate-400 rotate-0 truncate w-full text-center">
                                        {item.date.slice(5)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon, subtext }: any) {
    return (
        <div className="p-5 rounded-2xl border border-slate-200/70 bg-white/80 backdrop-blur-sm shadow-card flex flex-col justify-between h-32 transition-all hover:border-[#9fcdd6]">
            <div className="flex justify-between items-start">
                <span className="text-slate-600 font-medium text-[13px]">{title}</span>
                <div className="p-2 bg-[#e8f6f9] rounded-lg text-[#0e5a6e]">
                    {icon}
                </div>
            </div>
            <div>
                <div className="text-3xl font-bold text-[#0e4a58]">{value}</div>
                {subtext && <div className="text-[11px] text-slate-500 mt-1">{subtext}</div>}
            </div>
        </div>
    );
}
