import { useState, useEffect } from 'react';
import { Plus, Play, Trash2, Edit2, X, ExternalLink, Bookmark, EyeOff, ArrowRight, Radar, Pause } from 'lucide-react';
import axios from 'axios';
import { Application, JobPosting, JobPostingStatus, JobSearch, JobSource } from '../types';

type SourceRow = { type: JobSource['type']; value: string };
type SearchForm = { name: string; query: string; location: string; frequencyMin: number; sources: SourceRow[] };

const EMPTY_FORM: SearchForm = { name: '', query: '', location: '', frequencyMin: 1440, sources: [{ type: 'greenhouse', value: '' }] };

const FREQUENCIES = [
    { min: 60, label: 'Every hour' },
    { min: 360, label: 'Every 6 hours' },
    { min: 720, label: 'Every 12 hours' },
    { min: 1440, label: 'Daily' },
];

const SOURCE_PLACEHOLDER: Record<JobSource['type'], string> = {
    greenhouse: 'Board name, e.g. gitlab',
    lever: 'Company slug, e.g. netflix',
    rss: 'https://…/feed.xml',
};

const TABS: { id: JobPostingStatus; label: string }[] = [
    { id: 'new', label: 'New' },
    { id: 'saved', label: 'Saved' },
    { id: 'dismissed', label: 'Dismissed' },
    { id: 'converted', label: 'On board' },
];

const toRow = (s: JobSource): SourceRow =>
    ({ type: s.type, value: s.type === 'greenhouse' ? s.board : s.type === 'lever' ? s.company : s.url });

const fromRow = ({ type, value }: SourceRow): JobSource =>
    type === 'greenhouse' ? { type, board: value.trim() } : type === 'lever' ? { type, company: value.trim() } : { type, url: value.trim() };

const errorMessage = (e: unknown, fallback: string) =>
    (axios.isAxiosError(e) && e.response?.data?.error) || fallback;

const formatDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleString() : 'never');

interface JobInboxViewProps {
    onConverted: (app: Application) => void;
}

export function JobInboxView({ onConverted }: JobInboxViewProps) {
    const [searches, setSearches] = useState<JobSearch[]>([]);
    const [postings, setPostings] = useState<JobPosting[]>([]);
    const [selectedSearchId, setSelectedSearchId] = useState<number | null>(null);
    const [tab, setTab] = useState<JobPostingStatus>('new');
    const [editingId, setEditingId] = useState<number | 'new' | null>(null);
    const [form, setForm] = useState<SearchForm>(EMPTY_FORM);
    const [formError, setFormError] = useState('');
    const [runningId, setRunningId] = useState<number | null>(null);
    const [notice, setNotice] = useState('');

    useEffect(() => {
        fetchSearches();
    }, []);

    useEffect(() => {
        fetchPostings();
    }, [tab, selectedSearchId]);

    const fetchSearches = async () => {
        try {
            const res = await axios.get('/api/job-searches');
            setSearches(res.data);
        } catch (error) {
            console.error('Failed to fetch job searches:', error);
        }
    };

    const fetchPostings = async () => {
        try {
            const params: Record<string, string | number> = { status: tab };
            if (selectedSearchId) params.searchId = selectedSearchId;
            const res = await axios.get('/api/job-postings', { params });
            setPostings(res.data);
        } catch (error) {
            console.error('Failed to fetch job postings:', error);
        }
    };

    const openEditor = (search?: JobSearch) => {
        setFormError('');
        if (search) {
            setEditingId(search.id);
            setForm({
                name: search.name,
                query: search.query,
                location: search.location || '',
                frequencyMin: search.frequencyMin,
                sources: search.sources.map(toRow),
            });
        } else {
            setEditingId('new');
            setForm(EMPTY_FORM);
        }
    };

    const saveSearch = async () => {
        const payload = {
            name: form.name,
            query: form.query,
            location: form.location,
            frequencyMin: form.frequencyMin,
            sources: form.sources.filter((s) => s.value.trim()).map(fromRow),
        };
        try {
            if (editingId === 'new') {
                const res = await axios.post('/api/job-searches', payload);
                setSearches((prev) => [res.data, ...prev]);
            } else {
                const res = await axios.put(`/api/job-searches/${editingId}`, payload);
                setSearches((prev) => prev.map((s) => (s.id === res.data.id ? res.data : s)));
            }
            setEditingId(null);
        } catch (error) {
            setFormError(errorMessage(error, 'Failed to save search'));
        }
    };

    const toggleActive = async (search: JobSearch) => {
        try {
            const res = await axios.put(`/api/job-searches/${search.id}`, { isActive: !search.isActive });
            setSearches((prev) => prev.map((s) => (s.id === res.data.id ? res.data : s)));
        } catch (error) {
            console.error('Failed to toggle search:', error);
        }
    };

    const deleteSearch = async (search: JobSearch) => {
        if (!confirm(`Delete "${search.name}"? Postings it found are kept.`)) return;
        try {
            await axios.delete(`/api/job-searches/${search.id}`);
            setSearches((prev) => prev.filter((s) => s.id !== search.id));
            if (selectedSearchId === search.id) setSelectedSearchId(null);
        } catch (error) {
            console.error('Failed to delete search:', error);
        }
    };

    const runSearch = async (search: JobSearch) => {
        setRunningId(search.id);
        setNotice('');
        try {
            const res = await axios.post(`/api/job-searches/${search.id}/run`);
            setNotice(`${search.name}: ${res.data.added} new posting${res.data.added === 1 ? '' : 's'}`);
            await Promise.all([fetchSearches(), fetchPostings()]);
        } catch (error) {
            setNotice(errorMessage(error, 'Failed to run search'));
        } finally {
            setRunningId(null);
        }
    };

    const setPostingStatus = async (posting: JobPosting, status: JobPostingStatus) => {
        setPostings((prev) => prev.filter((p) => p.id !== posting.id));
        try {
            await axios.patch(`/api/job-postings/${posting.id}`, { status });
        } catch (error) {
            console.error('Failed to update posting:', error);
            fetchPostings();
        }
    };

    const convert = async (posting: JobPosting) => {
        try {
            const res = await axios.post(`/api/job-postings/${posting.id}/convert`);
            setPostings((prev) => prev.filter((p) => p.id !== posting.id));
            onConverted(res.data);
            setNotice(`Added "${posting.title}" to the board`);
        } catch (error) {
            setNotice(errorMessage(error, 'Failed to add to board'));
        }
    };

    const updateRow = (i: number, patch: Partial<SourceRow>) =>
        setForm((f) => ({ ...f, sources: f.sources.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));

    const inputClass = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0e5a6e]/20 focus:border-[#9fcdd6] outline-none';

    return (
        <div className="flex h-full overflow-hidden board-surface">
            {/* Saved searches */}
            <div className="w-1/3 h-full flex flex-col bg-white/60 backdrop-blur-sm border-r border-slate-200/70">
                <div className="p-5 space-y-4 overflow-y-auto flex-1">
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 className="text-xl font-semibold text-[#0e4a58]">Job Inbox</h2>
                            <p className="text-slate-500 text-[12.5px]">Saved searches fetch new postings on a schedule</p>
                        </div>
                        <button
                            onClick={() => openEditor()}
                            className="flex items-center gap-1 px-3 py-1.5 bg-[#0e5a6e] text-white text-[12px] rounded-lg font-semibold hover:bg-[#0c4c5d]"
                        >
                            <Plus className="w-3.5 h-3.5" /> Search
                        </button>
                    </div>

                    {editingId !== null && (
                        <div className="bg-white/80 p-4 rounded-xl shadow-card border border-slate-200/70 space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[13px] font-semibold text-slate-700">{editingId === 'new' ? 'New search' : 'Edit search'}</h3>
                                <button onClick={() => setEditingId(null)} className="p-1 text-slate-500 hover:bg-slate-100 rounded">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <input className={inputClass} placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                            <input className={inputClass} placeholder="Keywords in title, e.g. backend engineer" value={form.query} onChange={(e) => setForm({ ...form, query: e.target.value })} />
                            <input className={inputClass} placeholder="Location (optional)" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                            <select className={inputClass} value={form.frequencyMin} onChange={(e) => setForm({ ...form, frequencyMin: Number(e.target.value) })}>
                                {FREQUENCIES.map((f) => <option key={f.min} value={f.min}>{f.label}</option>)}
                            </select>
                            <div className="space-y-2">
                                <p className="text-[12px] font-medium text-slate-600">Sources</p>
                                {form.sources.map((row, i) => (
                                    <div key={i} className="flex gap-2">
                                        <select
                                            className="px-2 py-2 text-sm border border-slate-300 rounded-lg outline-none"
                                            value={row.type}
                                            onChange={(e) => updateRow(i, { type: e.target.value as JobSource['type'] })}
                                        >
                                            <option value="greenhouse">Greenhouse</option>
                                            <option value="lever">Lever</option>
                                            <option value="rss">RSS</option>
                                        </select>
                                        <input className={inputClass} placeholder={SOURCE_PLACEHOLDER[row.type]} value={row.value} onChange={(e) => updateRow(i, { value: e.target.value })} />
                                        <button
                                            onClick={() => setForm((f) => ({ ...f, sources: f.sources.filter((_, j) => j !== i) }))}
                                            className="p-1 text-slate-400 hover:text-red-600"
                                            aria-label="Remove source"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    onClick={() => setForm((f) => ({ ...f, sources: [...f.sources, { type: 'greenhouse', value: '' }] }))}
                                    className="text-[12px] text-[#0e5a6e] font-medium hover:underline"
                                >
                                    + Add source
                                </button>
                            </div>
                            {formError && <p className="text-[12px] text-red-600">{formError}</p>}
                            <button onClick={saveSearch} className="w-full px-4 py-2 bg-[#0e5a6e] text-white text-sm rounded-lg font-semibold hover:bg-[#0c4c5d]">
                                Save
                            </button>
                        </div>
                    )}

                    <div className="space-y-2">
                        <button
                            onClick={() => setSelectedSearchId(null)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium ${selectedSearchId === null ? 'bg-[#e8f6f9] text-[#0e5a6e]' : 'text-slate-600 hover:bg-slate-100'}`}
                        >
                            All searches
                        </button>
                        {searches.length === 0 && <p className="text-slate-500 text-sm text-center py-6">No searches yet</p>}
                        {searches.map((search) => (
                            <div
                                key={search.id}
                                onClick={() => setSelectedSearchId(search.id)}
                                className={`p-3 border-2 rounded-xl cursor-pointer transition-colors ${selectedSearchId === search.id ? 'border-[#0e5a6e] bg-[#e8f6f9]' : 'border-slate-200 bg-white/80 hover:border-[#9fcdd6]'}`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <h4 className={`font-semibold text-[14px] truncate ${search.isActive ? 'text-slate-800' : 'text-slate-400'}`}>
                                            {search.name}{!search.isActive && ' (paused)'}
                                        </h4>
                                        <p className="text-xs text-slate-500 truncate">"{search.query}"{search.location ? ` · ${search.location}` : ''} · {search.sources.length} source{search.sources.length === 1 ? '' : 's'}</p>
                                    </div>
                                    <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                        <button onClick={() => runSearch(search)} disabled={runningId === search.id} className="p-1 text-[#0e5a6e] hover:bg-[#e8f6f9] rounded disabled:opacity-40" title="Run now">
                                            <Play className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => toggleActive(search)} className="p-1 text-slate-500 hover:bg-slate-100 rounded" title={search.isActive ? 'Pause' : 'Resume'}>
                                            {search.isActive ? <Pause className="w-4 h-4" /> : <Radar className="w-4 h-4" />}
                                        </button>
                                        <button onClick={() => openEditor(search)} className="p-1 text-slate-500 hover:bg-slate-100 rounded" title="Edit">
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => deleteSearch(search)} className="p-1 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded" title="Delete">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-[11px] text-slate-400 mt-1">Last run: {runningId === search.id ? 'running…' : formatDate(search.lastRunAt)}</p>
                                {search.lastError && <p className="text-[11px] text-red-600 mt-1 break-words">{search.lastError}</p>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Postings */}
            <div className="flex-1 h-full flex flex-col overflow-hidden">
                <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-3">
                    <nav className="flex items-center gap-0.5 bg-slate-100/80 p-0.5 rounded-lg">
                        {TABS.map(({ id, label }) => (
                            <button
                                key={id}
                                onClick={() => setTab(id)}
                                className={`px-2.5 py-1 rounded-md text-[12px] font-medium ${tab === id ? 'bg-white text-[#0e5a6e] shadow-card' : 'text-slate-500 hover:text-[#0e5a6e]'}`}
                            >
                                {label}
                            </button>
                        ))}
                    </nav>
                    {notice && <p className="text-[12px] text-slate-600 truncate">{notice}</p>}
                </div>
                <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-2">
                    {postings.length === 0 && (
                        <p className="text-slate-500 text-sm text-center py-16">
                            {searches.length === 0 ? 'Create a search to start finding jobs.' : 'Nothing here.'}
                        </p>
                    )}
                    {postings.map((posting) => (
                        <div key={posting.id} className="bg-white/90 p-4 rounded-xl shadow-card border border-slate-200/70 flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <h4 className="font-semibold text-slate-800 text-[14px]">{posting.title}</h4>
                                <p className="text-[12.5px] text-slate-600">
                                    {posting.company}
                                    {posting.location && ` · ${posting.location}`}
                                    {posting.contractType && ` · ${posting.contractType}`}
                                    {posting.salary && ` · ${posting.salary}`}
                                </p>
                                <p className="text-[11px] text-slate-400 mt-1">
                                    {posting.source}{posting.postedAt && ` · posted ${new Date(posting.postedAt).toLocaleDateString()}`}
                                </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <a href={posting.url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-500 hover:bg-slate-100 rounded" title="Open posting">
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                                {posting.status !== 'converted' && (
                                    <>
                                        {posting.status !== 'saved' && (
                                            <button onClick={() => setPostingStatus(posting, 'saved')} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded" title="Save">
                                                <Bookmark className="w-4 h-4" />
                                            </button>
                                        )}
                                        {posting.status !== 'dismissed' ? (
                                            <button onClick={() => setPostingStatus(posting, 'dismissed')} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded" title="Dismiss">
                                                <EyeOff className="w-4 h-4" />
                                            </button>
                                        ) : (
                                            <button onClick={() => setPostingStatus(posting, 'new')} className="px-2 py-1 text-[12px] text-slate-600 hover:bg-slate-100 rounded" title="Restore">
                                                Restore
                                            </button>
                                        )}
                                        <button
                                            onClick={() => convert(posting)}
                                            className="flex items-center gap-1 px-2.5 py-1.5 bg-[#0e5a6e] text-white text-[12px] rounded-lg font-semibold hover:bg-[#0c4c5d]"
                                        >
                                            Add to board <ArrowRight className="w-3.5 h-3.5" />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
