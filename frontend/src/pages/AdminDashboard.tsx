import { useState, useEffect } from 'react';
import { ArrowLeft, Users, FileText, HardDrive, Activity, Shield, RefreshCw } from 'lucide-react';
import axios from 'axios';

interface AdminDashboardProps {
    onBack: () => void;
}

interface AdminStats {
    users: { total: number; newThisWeek: number; active: number };
    applications: { total: number; byStatus: Record<string, number> };
    resumes: { total: number; storageMB: number };
}

interface SystemInfo {
    database: { sizeMB: number };
    uploads: { sizeMB: number };
    memory: { usedMB: number; totalMB: number };
    uptime: number;
    nodeVersion: string;
}

interface AdminUser {
    id: number;
    email: string;
    name: string | null;
    isAdmin: boolean;
    createdAt: string;
    _count: { applications: number; resumes: number };
}

interface AdminLog {
    id: number;
    action: string;
    details: string | null;
    ip: string;
    createdAt: string;
    admin: { email: string };
}

export function AdminDashboard({ onBack }: AdminDashboardProps) {
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [logs, setLogs] = useState<AdminLog[]>([]);
    const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'logs'>('overview');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [statsRes, systemRes, usersRes, logsRes] = await Promise.all([
                axios.get('/api/admin/stats'),
                axios.get('/api/admin/system'),
                axios.get('/api/admin/users'),
                axios.get('/api/admin/logs')
            ]);
            setStats(statsRes.data);
            setSystemInfo(systemRes.data);
            setUsers(usersRes.data);
            setLogs(logsRes.data);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load admin data');
        } finally {
            setLoading(false);
        }
    };

    const formatUptime = (seconds: number) => {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${mins}m`;
        return `${mins}m`;
    };

    if (error) {
        return (
            <div className="h-full overflow-y-auto bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 flex items-center justify-center">
                <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 text-center max-w-md">
                    <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-red-400 mb-2">Access Denied</h2>
                    <p className="text-red-300/80 mb-4">{error}</p>
                    <button onClick={onBack} className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600">
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all">
                            <ArrowLeft className="w-5 h-5 text-slate-400" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                                <Shield className="w-8 h-8 text-indigo-400" />
                                Admin Dashboard
                            </h1>
                            <p className="text-slate-400 text-sm">System monitoring and user management</p>
                        </div>
                    </div>
                    <button onClick={fetchData} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                    {(['overview', 'users', 'logs'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-lg font-medium transition-all ${activeTab === tab
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                }`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
                    </div>
                ) : (
                    <>
                        {activeTab === 'overview' && stats && systemInfo && (
                            <div className="space-y-6">
                                {/* Stats Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <StatCard icon={<Users />} label="Total Users" value={stats.users.total} sub={`+${stats.users.newThisWeek} this week`} color="indigo" />
                                    <StatCard icon={<FileText />} label="Applications" value={stats.applications.total} sub={`${stats.users.active} active users`} color="purple" />
                                    <StatCard icon={<HardDrive />} label="Storage Used" value={`${stats.resumes.storageMB} MB`} sub={`${stats.resumes.total} files`} color="emerald" />
                                    <StatCard icon={<Activity />} label="Uptime" value={formatUptime(systemInfo.uptime)} sub={`Node ${systemInfo.nodeVersion}`} color="amber" />
                                </div>

                                {/* System Info */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700 p-6">
                                        <h3 className="text-lg font-semibold text-white mb-4">Application Status Distribution</h3>
                                        <div className="space-y-3">
                                            {Object.entries(stats.applications.byStatus).map(([status, count]) => (
                                                <div key={status} className="flex items-center justify-between">
                                                    <span className="text-slate-300">{status}</span>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-indigo-500 rounded-full"
                                                                style={{ width: `${(count / stats.applications.total) * 100}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-slate-400 w-8 text-right">{count}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700 p-6">
                                        <h3 className="text-lg font-semibold text-white mb-4">System Resources</h3>
                                        <div className="space-y-4">
                                            <ResourceBar label="Memory" used={systemInfo.memory.usedMB} total={systemInfo.memory.totalMB} unit="MB" />
                                            <ResourceBar label="Database" used={systemInfo.database.sizeMB} total={200} unit="MB" />
                                            <ResourceBar label="Uploads" used={systemInfo.uploads.sizeMB} total={200} unit="MB" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'users' && (
                            <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700 overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-slate-900/50">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase">User</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase">Role</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase">Applications</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase">Resumes</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase">Joined</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700">
                                        {users.map(user => (
                                            <tr key={user.id} className="hover:bg-slate-700/30">
                                                <td className="px-6 py-4">
                                                    <div className="text-white font-medium">{user.name || 'No name'}</div>
                                                    <div className="text-slate-400 text-sm">{user.email}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${user.isAdmin ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-600/20 text-slate-300'}`}>
                                                        {user.isAdmin ? 'Admin' : 'User'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-slate-300">{user._count.applications}</td>
                                                <td className="px-6 py-4 text-slate-300">{user._count.resumes}</td>
                                                <td className="px-6 py-4 text-slate-400 text-sm">{new Date(user.createdAt).toLocaleDateString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {activeTab === 'logs' && (
                            <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700 overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-slate-900/50">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase">Time</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase">Admin</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase">Action</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase">IP</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700">
                                        {logs.map(log => (
                                            <tr key={log.id} className="hover:bg-slate-700/30">
                                                <td className="px-6 py-4 text-slate-400 text-sm">
                                                    {new Date(log.createdAt).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 text-slate-300">{log.admin.email}</td>
                                                <td className="px-6 py-4">
                                                    <span className="px-2 py-1 bg-slate-600/30 rounded text-slate-300 text-sm font-mono">
                                                        {log.action}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-slate-400 font-mono text-sm">{log.ip}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

function StatCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string | number; sub: string; color: string }) {
    const colors: Record<string, string> = {
        indigo: 'from-indigo-500/20 to-indigo-600/10 border-indigo-500/30 text-indigo-400',
        purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-400',
        emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-400',
        amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-400',
    };
    return (
        <div className={`bg-gradient-to-br ${colors[color]} backdrop-blur-xl rounded-2xl border p-6`}>
            <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm font-medium">{label}</span>
                <div className={colors[color].split(' ').pop()}>{icon}</div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{value}</div>
            <div className="text-slate-400 text-sm">{sub}</div>
        </div>
    );
}

function ResourceBar({ label, used, total, unit }: { label: string; used: number; total: number; unit: string }) {
    const percent = Math.min((used / total) * 100, 100);
    return (
        <div>
            <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-300">{label}</span>
                <span className="text-slate-400">{used} / {total} {unit}</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${percent > 80 ? 'bg-red-500' : percent > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${percent}%` }} />
            </div>
        </div>
    );
}
