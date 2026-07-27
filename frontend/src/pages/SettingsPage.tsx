import { useState, useEffect } from 'react';
import { ArrowLeft, Bell, Database, Trash2, Download, Shield, Sparkles, Check, KeyRound } from 'lucide-react';
import axios from 'axios';

interface SettingsPageProps {
    onBack: () => void;
}

const BRAND = '#0e5a6e';

export function SettingsPage({ onBack }: SettingsPageProps) {
    const [emailNotifications, setEmailNotifications] = useState(true);
    const [applicationReminders, setApplicationReminders] = useState(true);
    const [weeklyDigest, setWeeklyDigest] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [saving, setSaving] = useState(false);

    // ---- AI / LLM config ----
    const [aiBase, setAiBase] = useState('');
    const [aiKey, setAiKey] = useState('');
    const [aiModel, setAiModel] = useState('');
    const [aiRetries, setAiRetries] = useState(2);
    const [aiHasKey, setAiHasKey] = useState(false);
    const [aiSaving, setAiSaving] = useState(false);
    const [aiSavedOk, setAiSavedOk] = useState(false);
    const [aiError, setAiError] = useState('');

    // Load preferences from backend
    useEffect(() => {
        const loadPreferences = async () => {
            try {
                const res = await axios.get('/api/auth/preferences');
                setEmailNotifications(res.data.notifyEmail);
                setApplicationReminders(res.data.notifyReminders);
                setWeeklyDigest(res.data.notifyDigest);
            } catch (error) {
                console.error('Failed to load preferences');
            }
        };
        const loadAi = async () => {
            try {
                const res = await axios.get('/api/ai/config');
                setAiBase(res.data.apiBase || '');
                setAiModel(res.data.model || '');
                setAiRetries(typeof res.data.maxRetries === 'number' ? res.data.maxRetries : 2);
                setAiHasKey(!!res.data.hasKey);
            } catch (error) {
                // fresh config — ignore
            }
        };
        loadPreferences();
        loadAi();
    }, []);

    // Save preferences to backend
    const savePreferences = async (updates: { notifyEmail?: boolean; notifyReminders?: boolean; notifyDigest?: boolean }) => {
        setSaving(true);
        try {
            await axios.put('/api/auth/preferences', {
                notifyEmail: updates.notifyEmail ?? emailNotifications,
                notifyReminders: updates.notifyReminders ?? applicationReminders,
                notifyDigest: updates.notifyDigest ?? weeklyDigest,
            });
            setMessage({ type: 'success', text: 'Preferences saved!' });
            setTimeout(() => setMessage(null), 2000);
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to save preferences' });
        } finally {
            setSaving(false);
        }
    };

    const handleSaveAi = async () => {
        setAiError('');
        if (!aiBase.trim()) {
            setAiError('API base URL is required (e.g. https://api.openai.com/v1).');
            return;
        }
        if (!aiHasKey && !aiKey.trim()) {
            setAiError('An API key is required.');
            return;
        }
        setAiSaving(true);
        try {
            await axios.put('/api/ai/config', {
                apiBase: aiBase.trim(),
                apiKey: aiKey.trim(), // empty = keep existing
                model: aiModel.trim(),
                maxRetries: aiRetries,
            });
            setAiHasKey(aiHasKey || !!aiKey.trim());
            setAiKey('');
            setAiSavedOk(true);
            setTimeout(() => setAiSavedOk(false), 1500);
        } catch (e: any) {
            setAiError(e?.response?.data?.error || 'Failed to save AI settings.');
        } finally {
            setAiSaving(false);
        }
    };

    const handleDeleteAi = async () => {
        if (!window.confirm('Remove your stored AI API key and configuration? AI features will stop working until you add a key again.')) return;
        setAiError('');
        setAiSaving(true);
        try {
            await axios.delete('/api/ai/config');
            setAiBase('');
            setAiModel('');
            setAiKey('');
            setAiRetries(2);
            setAiHasKey(false);
            setMessage({ type: 'success', text: 'AI configuration removed.' });
            setTimeout(() => setMessage(null), 2000);
        } catch (e: any) {
            setAiError(e?.response?.data?.error || 'Failed to delete AI settings.');
        } finally {
            setAiSaving(false);
        }
    };

    const handleExportData = async () => {
        try {
            const res = await axios.get('/api/applications');
            const dataStr = JSON.stringify(res.data, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `candivana-data-${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            URL.revokeObjectURL(url);
            setMessage({ type: 'success', text: 'Data exported successfully!' });
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to export data' });
        }
    };

    const handleDeleteAccount = async () => {
        const confirmed = window.confirm(
            'Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently deleted.'
        );
        if (confirmed) {
            const doubleConfirm = window.confirm(
                'This is your last chance. Are you absolutely sure you want to delete your account and all associated data?'
            );
            if (doubleConfirm) {
                try {
                    await axios.delete('/api/auth/account');
                    window.location.href = '/';
                } catch (error) {
                    setMessage({ type: 'error', text: 'Failed to delete account. Please try again.' });
                }
            }
        }
    };

    const aiInputCls = 'w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#0e5a6e]/15 focus:border-[#9fcdd6] transition-all text-[13px] placeholder:text-slate-400';

    return (
        <div className="h-full overflow-y-auto board-surface">
            <div className="max-w-3xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-6 flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="p-2 rounded-lg bg-white/80 hover:bg-white border border-slate-200/70 hover:border-[#9fcdd6] transition-all"
                    >
                        <ArrowLeft className="w-4 h-4 text-slate-600" />
                    </button>
                    <div>
                        <h1 className="text-xl font-semibold text-[#0e4a58]">Settings</h1>
                        <p className="text-slate-500 text-[12.5px]">Manage your preferences and account settings</p>
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

                <div className="space-y-5">
                    {/* AI / LLM */}
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/70 p-5 shadow-card">
                        <h2 className="text-[15px] font-semibold text-slate-800 flex items-center gap-2 mb-1">
                            <Sparkles className="w-[17px] h-[17px]" style={{ color: BRAND }} />
                            AI Assistant
                        </h2>
                        <p className="text-[12px] text-slate-500 mb-4">
                            Connect any OpenAI-compatible endpoint to add jobs from natural language and generate board insights. Your key is stored on your account and used only to process the text you provide — no scraping.
                        </p>

                        {aiError && (
                            <div className="mb-3 bg-rose-50 text-rose-600 p-2.5 rounded-lg text-[12px] font-medium border border-rose-100">
                                {aiError}
                            </div>
                        )}

                        <div className="space-y-3.5">
                            <div>
                                <label className="block text-[12.5px] font-medium text-slate-600 mb-1.5">API base URL</label>
                                <input className={aiInputCls} value={aiBase} onChange={(e) => setAiBase(e.target.value)} placeholder="https://api.openai.com/v1" />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div>
                                    <label className="block text-[12.5px] font-medium text-slate-600 mb-1.5">
                                        API key {aiHasKey && <span className="text-emerald-600 font-normal">· saved</span>}
                                    </label>
                                    <input type="password" className={aiInputCls} value={aiKey} onChange={(e) => setAiKey(e.target.value)} placeholder={aiHasKey ? '•••••••• (leave blank to keep)' : 'sk-...'} />
                                </div>
                                <div>
                                    <label className="block text-[12.5px] font-medium text-slate-600 mb-1.5">Model</label>
                                    <input className={aiInputCls} value={aiModel} onChange={(e) => setAiModel(e.target.value)} placeholder="gpt-4o-mini" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[12.5px] font-medium text-slate-600 mb-1.5">
                                    Format retries <span className="text-slate-400 font-normal">· 0–5</span>
                                </label>
                                <input
                                    type="number"
                                    min={0}
                                    max={5}
                                    className={aiInputCls + ' max-w-[120px]'}
                                    value={aiRetries}
                                    onChange={(e) => {
                                        const n = Math.round(Number(e.target.value));
                                        setAiRetries(Number.isFinite(n) ? Math.max(0, Math.min(5, n)) : 0);
                                    }}
                                />
                                <p className="mt-1 text-[11px] text-slate-400">If the AI returns malformed data, the error is fed back to the model to retry this many extra times.</p>
                            </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between">
                            <button
                                onClick={handleDeleteAi}
                                disabled={aiSaving || (!aiHasKey && !aiBase && !aiModel)}
                                className="px-3 py-2 text-[12.5px] text-rose-600 hover:bg-rose-50 rounded-lg font-medium transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:hover:bg-transparent"
                            >
                                <Trash2 className="w-4 h-4" />
                                Remove key
                            </button>
                            <button
                                onClick={handleSaveAi}
                                disabled={aiSaving}
                                className="px-4 py-2 text-[12.5px] bg-[#0e5a6e] hover:bg-[#0c4c5d] text-white rounded-lg font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
                            >
                                {aiSavedOk ? <><Check className="w-4 h-4" /> Saved</> : aiSaving ? 'Saving…' : <><KeyRound className="w-4 h-4" /> Save</>}
                            </button>
                        </div>
                    </div>

                    {/* Notifications Settings */}
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/70 p-5 shadow-card">
                        <h2 className="text-[15px] font-semibold text-slate-800 flex items-center gap-2 mb-4">
                            <Bell className="w-[17px] h-[17px]" style={{ color: BRAND }} />
                            Notifications
                            {saving && <span className="text-[11px] text-slate-400 ml-1">Saving...</span>}
                        </h2>

                        <div className="space-y-2.5">
                            <SettingToggle
                                label="Email Notifications"
                                description="Receive email updates about your applications"
                                checked={emailNotifications}
                                onChange={(val) => {
                                    setEmailNotifications(val);
                                    savePreferences({ notifyEmail: val });
                                }}
                            />
                            <SettingToggle
                                label="Application Reminders"
                                description="Get reminders for applications you haven't followed up on"
                                checked={applicationReminders}
                                onChange={(val) => {
                                    setApplicationReminders(val);
                                    savePreferences({ notifyReminders: val });
                                }}
                            />
                            <SettingToggle
                                label="Weekly Digest"
                                description="Receive a weekly summary of your job search progress"
                                checked={weeklyDigest}
                                onChange={(val) => {
                                    setWeeklyDigest(val);
                                    savePreferences({ notifyDigest: val });
                                }}
                            />
                        </div>
                        <p className="text-[11px] text-slate-400 mt-3 px-1">
                            Note: Email sending requires SMTP configuration in production
                        </p>
                    </div>

                    {/* Privacy & Consent */}
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/70 p-5 shadow-card">
                        <h2 className="text-[15px] font-semibold text-slate-800 flex items-center gap-2 mb-4">
                            <Shield className="w-[17px] h-[17px]" style={{ color: BRAND }} />
                            Privacy & Consent
                        </h2>

                        <div className="space-y-3">
                            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="font-medium text-slate-800 text-[13px] mb-1">Cookie Consent</div>
                                        <p className="text-[12.5px] text-slate-600">
                                            {localStorage.getItem('cookieConsent') === 'accepted'
                                                ? 'You have accepted cookies. '
                                                : localStorage.getItem('cookieConsent') === 'declined'
                                                    ? 'You have declined optional cookies. '
                                                    : 'No cookie preference set. '}
                                            {localStorage.getItem('cookieConsentDate') && (
                                                <span className="text-[11px] text-slate-500">
                                                    (Set on {new Date(localStorage.getItem('cookieConsentDate')!).toLocaleDateString()})
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            localStorage.removeItem('cookieConsent');
                                            localStorage.removeItem('cookieConsentDate');
                                            window.location.reload();
                                        }}
                                        className="shrink-0 px-3.5 py-1.5 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors text-[12.5px]"
                                    >
                                        Reset
                                    </button>
                                </div>
                            </div>

                            <div className="p-3.5 bg-[#e8f6f9] rounded-xl border border-[#bfe0e6]">
                                <div className="text-[12.5px] text-[#0e4a58]">
                                    <strong>Your Rights:</strong> You have the right to access, rectify, and delete your personal data.
                                    You can export your data or delete your account at any time using the options below.
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Data Management */}
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/70 p-5 shadow-card">
                        <h2 className="text-[15px] font-semibold text-slate-800 flex items-center gap-2 mb-4">
                            <Database className="w-[17px] h-[17px]" style={{ color: BRAND }} />
                            Data Management
                        </h2>

                        <div className="space-y-3">
                            {/* Export Data */}
                            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="font-medium text-slate-800 text-[13px] flex items-center gap-2 mb-1">
                                            <Download className="w-4 h-4" style={{ color: BRAND }} />
                                            Export Your Data
                                        </div>
                                        <p className="text-[12.5px] text-slate-600">
                                            Download all your application data in JSON format
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleExportData}
                                        className="shrink-0 px-4 py-1.5 bg-[#0e5a6e] hover:bg-[#0c4c5d] text-white rounded-lg font-medium transition-colors text-[12.5px]"
                                    >
                                        Export
                                    </button>
                                </div>
                            </div>

                            {/* Delete Account */}
                            <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="font-medium text-rose-800 text-[13px] flex items-center gap-2 mb-1">
                                            <Trash2 className="w-4 h-4" />
                                            Delete Account
                                        </div>
                                        <p className="text-[12.5px] text-rose-600">
                                            Permanently delete your account and all associated data
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleDeleteAccount}
                                        className="shrink-0 px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium transition-colors text-[12.5px]"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* About */}
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/70 p-5 shadow-card">
                        <h2 className="text-[15px] font-semibold text-slate-800 mb-3">About Candivana</h2>
                        <div className="space-y-1.5 text-[12.5px] text-slate-600">
                            <p><strong>Version:</strong> 1.0.0</p>
                            <p><strong>Description:</strong> A beautiful, self-hosted job application tracker</p>
                            <p className="pt-1.5 text-[11px] text-slate-400">
                                Made with ❤️ for job seekers everywhere
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

interface SettingToggleProps {
    label: string;
    description: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}

function SettingToggle({ label, description, checked, onChange }: SettingToggleProps) {
    return (
        <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200 hover:border-[#9fcdd6] transition-colors">
            <div className="flex-1">
                <div className="font-medium text-slate-800 text-[13px]">{label}</div>
                <div className="text-[12px] text-slate-500">{description}</div>
            </div>
            <button
                onClick={() => onChange(!checked)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-[#0e5a6e]' : 'bg-slate-300'}`}
            >
                <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-0.5'}`}
                />
            </button>
        </div>
    );
}
