import { useState, useEffect } from 'react';
import { ArrowLeft, User, Mail, Calendar, Save, Lock, BarChart3, CheckCircle, XCircle, Clock, Award } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

interface ProfilePageProps {
    onBack: () => void;
}

interface UserStats {
    total: number;
    toApply: number;
    applied: number;
    interviewing: number;
    offer: number;
    rejected: number;
    archived: number;
}

export function ProfilePage({ onBack }: ProfilePageProps) {
    const { user } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [name, setName] = useState(user?.name || '');
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [stats, setStats] = useState<UserStats | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const res = await axios.get('/api/auth/stats');
            setStats(res.data);
        } catch (error) {
            console.error('Failed to fetch stats', error);
        }
    };

    const handleUpdateProfile = async () => {
        setIsSaving(true);
        setMessage(null);
        try {
            await axios.put('/api/auth/profile', { name });
            setMessage({ type: 'success', text: 'Profile updated successfully!' });
            setIsEditing(false);
            // Update user context would go here
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to update profile' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleChangePassword = async () => {
        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'Passwords do not match' });
            return;
        }
        if (newPassword.length < 6) {
            setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
            return;
        }

        setIsSaving(true);
        setMessage(null);
        try {
            await axios.put('/api/auth/password', { oldPassword, newPassword });
            setMessage({ type: 'success', text: 'Password changed successfully!' });
            setIsChangingPassword(false);
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to change password' });
        } finally {
            setIsSaving(false);
        }
    };

    if (!user) return null;

    return (
        <div className="h-full overflow-y-auto board-surface">
            <div className="max-w-5xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-6 flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 rounded-lg bg-white/80 hover:bg-white border border-slate-200/70 hover:border-[#9fcdd6] transition-all"
                    >
                        <ArrowLeft className="w-4 h-4 text-slate-600" />
                    </button>
                    <div>
                        <h1 className="text-xl font-semibold text-[#0e4a58]">Profile</h1>
                        <p className="text-slate-500 text-[12.5px]">Manage your account information</p>
                    </div>
                </div>

                {/* Message */}
                {message && (
                    <div className={`mb-5 p-3 rounded-xl border text-[13px] ${message.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border-rose-200 text-rose-800'
                        } animate-fade-in`}>
                        {message.text}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {/* Left Column - Profile Info */}
                    <div className="lg:col-span-2 space-y-5">
                        {/* Profile Card */}
                        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/70 p-5 shadow-card">
                            <div className="flex items-center justify-between mb-5">
                                <h2 className="text-[15px] font-semibold text-slate-800 flex items-center gap-2">
                                    <User className="w-[17px] h-[17px] text-[#0e5a6e]" />
                                    Personal Information
                                </h2>
                                {!isEditing && (
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="px-4 py-2 bg-[#e8f6f9] hover:bg-[#d5eef2] text-[#0e5a6e] rounded-lg font-medium transition-colors text-sm"
                                    >
                                        Edit Profile
                                    </button>
                                )}
                            </div>

                            <div className="space-y-4">
                                {/* Avatar */}
                                <div className="flex items-center gap-4">
                                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#0e5a6e] to-[#0c4c5d] flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-[#0e5a6e]/20">
                                        {user.name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-slate-800">{user.name || 'User'}</h3>
                                        <p className="text-sm text-slate-500">{user.email}</p>
                                    </div>
                                </div>

                                {/* Name Field */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0e5a6e]/15 focus:border-[#9fcdd6] outline-none"
                                            placeholder="Enter your name"
                                        />
                                    ) : (
                                        <div className="px-4 py-2.5 bg-slate-50 rounded-lg text-slate-700">
                                            {user.name || 'Not set'}
                                        </div>
                                    )}
                                </div>

                                {/* Email Field (Read-only) */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                                        <Mail className="w-4 h-4" />
                                        Email Address
                                    </label>
                                    <div className="px-4 py-2.5 bg-slate-50 rounded-lg text-slate-700 border border-slate-200">
                                        {user.email}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
                                </div>

                                {/* Member Since */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                                        <Calendar className="w-4 h-4" />
                                        Member Since
                                    </label>
                                    <div className="px-4 py-2.5 bg-slate-50 rounded-lg text-slate-700 border border-slate-200">
                                        {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                {isEditing && (
                                    <div className="flex gap-3 pt-2">
                                        <button
                                            onClick={handleUpdateProfile}
                                            disabled={isSaving}
                                            className="flex-1 px-4 py-2.5 bg-[#0e5a6e] hover:bg-[#0c4c5d] text-white rounded-lg font-medium transition-all shadow-lg shadow-[#0e5a6e]/20 hover:shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            <Save className="w-4 h-4" />
                                            {isSaving ? 'Saving...' : 'Save Changes'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setIsEditing(false);
                                                setName(user.name || '');
                                            }}
                                            disabled={isSaving}
                                            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Change Password Card */}
                        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/70 p-5 shadow-card">
                            <div className="flex items-center justify-between mb-5">
                                <h2 className="text-[15px] font-semibold text-slate-800 flex items-center gap-2">
                                    <Lock className="w-[17px] h-[17px] text-[#0e5a6e]" />
                                    Security
                                </h2>
                                {!isChangingPassword && (
                                    <button
                                        onClick={() => setIsChangingPassword(true)}
                                        className="px-4 py-2 bg-[#e8f6f9] hover:bg-[#d5eef2] text-[#0e5a6e] rounded-lg font-medium transition-colors text-sm"
                                    >
                                        Change Password
                                    </button>
                                )}
                            </div>

                            {isChangingPassword ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Current Password</label>
                                        <input
                                            type="password"
                                            value={oldPassword}
                                            onChange={(e) => setOldPassword(e.target.value)}
                                            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0e5a6e]/15 focus:border-[#9fcdd6] outline-none"
                                            placeholder="Enter current password"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">New Password</label>
                                        <input
                                            type="password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0e5a6e]/15 focus:border-[#9fcdd6] outline-none"
                                            placeholder="Enter new password (min 6 characters)"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Confirm New Password</label>
                                        <input
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0e5a6e]/15 focus:border-[#9fcdd6] outline-none"
                                            placeholder="Confirm new password"
                                        />
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <button
                                            onClick={handleChangePassword}
                                            disabled={isSaving}
                                            className="flex-1 px-4 py-2.5 bg-[#0e5a6e] hover:bg-[#0c4c5d] text-white rounded-lg font-medium transition-all shadow-lg shadow-[#0e5a6e]/20 hover:shadow-xl disabled:opacity-50"
                                        >
                                            {isSaving ? 'Changing...' : 'Change Password'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setIsChangingPassword(false);
                                                setOldPassword('');
                                                setNewPassword('');
                                                setConfirmPassword('');
                                            }}
                                            disabled={isSaving}
                                            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-slate-600">Keep your account secure by using a strong password.</p>
                            )}
                        </div>
                    </div>

                    {/* Right Column - Statistics */}
                    <div className="space-y-5">
                        {/* Stats Overview */}
                        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/70 p-5 shadow-card">
                            <h2 className="text-[15px] font-semibold text-slate-800 flex items-center gap-2 mb-5">
                                <BarChart3 className="w-[17px] h-[17px] text-[#0e5a6e]" />
                                Statistics
                            </h2>

                            {stats ? (
                                <div className="space-y-4">
                                    {/* Total Applications */}
                                    <div className="p-4 bg-gradient-to-br from-[#e8f6f9] to-[#eef4f5] rounded-xl border border-[#bfe0e6]">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-slate-600">Total Applications</span>
                                            <Award className="w-5 h-5 text-[#0e5a6e]" />
                                        </div>
                                        <p className="text-3xl font-bold text-[#0e5a6e] mt-2">{stats.total}</p>
                                    </div>

                                    {/* Status Breakdown */}
                                    <div className="space-y-3">
                                        <StatItem icon={<Clock className="w-4 h-4" />} label="To Apply" value={stats.toApply} color="slate" />
                                        <StatItem icon={<CheckCircle className="w-4 h-4" />} label="Applied" value={stats.applied} color="blue" />
                                        <StatItem icon={<CheckCircle className="w-4 h-4" />} label="Interviewing" value={stats.interviewing} color="purple" />
                                        <StatItem icon={<Award className="w-4 h-4" />} label="Offers" value={stats.offer} color="green" />
                                        <StatItem icon={<XCircle className="w-4 h-4" />} label="Rejected" value={stats.rejected} color="red" />
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-slate-500">Loading statistics...</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

interface StatItemProps {
    icon: React.ReactNode;
    label: string;
    value: number;
    color: 'slate' | 'blue' | 'purple' | 'green' | 'red';
}

function StatItem({ icon, label, value, color }: StatItemProps) {
    const colorClasses = {
        slate: 'bg-slate-50 border-slate-200 text-slate-600',
        blue: 'bg-blue-50 border-blue-200 text-blue-600',
        purple: 'bg-purple-50 border-purple-200 text-purple-600',
        green: 'bg-green-50 border-green-200 text-green-600',
        red: 'bg-red-50 border-red-200 text-red-600',
    };

    return (
        <div className={`p-3 rounded-lg border ${colorClasses[color]} flex items-center justify-between`}>
            <div className="flex items-center gap-2">
                {icon}
                <span className="text-sm font-medium">{label}</span>
            </div>
            <span className="text-lg font-bold">{value}</span>
        </div>
    );
}
