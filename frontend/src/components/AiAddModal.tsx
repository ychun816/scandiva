import React, { useState } from 'react';
import { X, Sparkles, Settings, ArrowLeft, Wand2 } from 'lucide-react';
import { Application } from '../types';
import axios from 'axios';

interface AiAddModalProps {
    onClose: () => void;
    onAdd: (app: Omit<Application, 'id' | 'createdAt' | 'updatedAt'>) => void;
    onOpenSettings: () => void;
}

type ParsedForm = {
    company: string;
    position: string;
    link: string;
    platform: string;
    salary: string;
    contractType: string;
    status: string;
    notes: string;
};

const EMPTY: ParsedForm = {
    company: '', position: '', link: '', platform: '',
    salary: '', contractType: '', status: 'To Apply', notes: '',
};

export function AiAddModal({ onClose, onAdd, onOpenSettings }: AiAddModalProps) {
    const [step, setStep] = useState<'input' | 'review'>('input');
    const [text, setText] = useState('');
    const [form, setForm] = useState<ParsedForm>(EMPTY);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [needsConfig, setNeedsConfig] = useState(false);

    const handleGenerate = async () => {
        setError('');
        setNeedsConfig(false);
        if (text.trim().length < 3) {
            setError('Paste a job description or a few details first.');
            return;
        }
        setLoading(true);
        try {
            const res = await axios.post('/api/ai/parse-job', { text: text.trim() });
            setForm({ ...EMPTY, ...res.data });
            setStep('review');
        } catch (e: any) {
            const msg = e?.response?.data?.error || 'Failed to parse. Please try again.';
            setError(msg);
            if (/not configured/i.test(msg)) setNeedsConfig(true);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.company.trim() || !form.position.trim()) {
            setError('Company and position are required.');
            return;
        }
        onAdd({
            company: form.company.trim(),
            position: form.position.trim(),
            link: form.link.trim(),
            platform: form.platform.trim(),
            salary: form.salary.trim(),
            contractType: form.contractType,
            status: form.status,
            notes: form.notes.trim(),
            isStarred: false,
            isArchived: false,
            appliedDate: new Date().toISOString(),
        } as Omit<Application, 'id' | 'createdAt' | 'updatedAt'>);
    };

    const inputCls = 'w-full px-3 py-2 rounded-lg border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#0e5a6e]/15 focus:border-[#9fcdd6] transition-all text-[14px] placeholder:text-stone-400';
    const labelCls = 'block text-[13px] font-medium text-stone-600 mb-1.5';

    return (
        <div className="fixed inset-0 bg-stone-900/30 flex items-center justify-center z-50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-pop border border-stone-200 w-full max-w-lg overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-stone-100 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        {step === 'review' && (
                            <button onClick={() => { setStep('input'); setError(''); }} className="text-stone-400 hover:text-stone-700 -ml-1" title="Back">
                                <ArrowLeft className="w-4 h-4" />
                            </button>
                        )}
                        <Sparkles className="w-4 h-4 text-stone-700" />
                        <h2 className="text-[15px] font-semibold text-stone-900">
                            {step === 'input' ? 'Add with AI' : 'Review before adding'}
                        </h2>
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={onOpenSettings} className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors" title="AI settings">
                            <Settings className="w-4 h-4" />
                        </button>
                        <button onClick={onClose} className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors">
                            <X className="w-[18px] h-[18px]" />
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="mx-6 mt-4 bg-rose-50 text-rose-600 p-2.5 rounded-lg text-[12px] font-medium border border-rose-100 flex items-center justify-between gap-3">
                        <span>{error}</span>
                        {needsConfig && (
                            <button onClick={onOpenSettings} className="shrink-0 underline underline-offset-2 font-semibold">Configure</button>
                        )}
                    </div>
                )}

                {step === 'input' ? (
                    <div className="p-6 space-y-4 overflow-y-auto">
                        <p className="text-[12px] text-stone-500 leading-relaxed">
                            Paste the job description, an email, or a few lines about the role. The AI fills the form — you review and confirm before anything is saved. It only uses what you paste (no page fetching).
                        </p>
                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            rows={9}
                            placeholder={"e.g.\nSenior Frontend Engineer — Acme Corp\nRemote · Full-time · $120k–150k\nReact, TypeScript. Apply at https://acme.com/jobs/123 (via LinkedIn)"}
                            className={inputCls + ' resize-none leading-relaxed'}
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={onClose} className="px-4 py-2 text-[13px] text-stone-600 hover:bg-stone-100 rounded-lg font-medium transition-colors">
                                Cancel
                            </button>
                            <button
                                onClick={handleGenerate}
                                disabled={loading}
                                className="px-4 py-2 text-[13px] bg-[#0e5a6e] hover:bg-[#0c4c5d] text-white rounded-lg font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
                            >
                                {loading ? (
                                    <><span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white/40 border-t-white" /> Parsing…</>
                                ) : (
                                    <><Wand2 className="w-4 h-4" /> Generate</>
                                )}
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleConfirm} className="p-6 space-y-4 overflow-y-auto">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelCls}>Company</label>
                                <input className={inputCls} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Company" />
                            </div>
                            <div>
                                <label className={labelCls}>Position</label>
                                <input className={inputCls} value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="Role" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelCls}>Platform</label>
                                <input className={inputCls} value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} placeholder="e.g. LinkedIn" />
                            </div>
                            <div>
                                <label className={labelCls}>Status</label>
                                <select className={inputCls + ' bg-white'} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                                    <option value="To Apply">To Apply</option>
                                    <option value="Applied">Applied</option>
                                    <option value="Interviewing">Interviewing</option>
                                    <option value="Offer">Offer</option>
                                    <option value="Rejected">Rejected</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelCls}>Salary</label>
                                <input className={inputCls} value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} placeholder="e.g. 80k–100k" />
                            </div>
                            <div>
                                <label className={labelCls}>Contract Type</label>
                                <select className={inputCls + ' bg-white'} value={form.contractType} onChange={(e) => setForm({ ...form, contractType: e.target.value })}>
                                    <option value="">Select Type</option>
                                    <option value="Full-time">Full-time</option>
                                    <option value="Part-time">Part-time</option>
                                    <option value="Contract">Contract</option>
                                    <option value="Intern">Intern</option>
                                    <option value="Freelance">Freelance</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className={labelCls}>Job Link</label>
                            <input className={inputCls} value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://…" />
                        </div>
                        <div>
                            <label className={labelCls}>Notes</label>
                            <textarea className={inputCls + ' resize-none h-20'} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Key requirements, contact, etc." />
                        </div>

                        <div className="pt-1 flex justify-end gap-2">
                            <button type="button" onClick={() => { setStep('input'); setError(''); }} className="px-4 py-2 text-[13px] text-stone-600 hover:bg-stone-100 rounded-lg font-medium transition-colors">
                                Back
                            </button>
                            <button type="submit" className="px-4 py-2 text-[13px] bg-[#0e5a6e] hover:bg-[#0c4c5d] text-white rounded-lg font-medium transition-colors">
                                Add application
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
