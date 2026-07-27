import { useEffect, useRef, useState } from 'react';
import { X, Sparkles, Settings, RefreshCw, BarChart3 } from 'lucide-react';
import axios from 'axios';
import { Application } from '../types';

interface AiSummaryModalProps {
    applications: Application[];
    onClose: () => void;
    onOpenSettings: () => void;
}

const BRAND = '#0e5a6e';

// Render inline **bold** and `code` inside a line of text, escaping everything else.
function renderInline(text: string, keyBase: string) {
    const parts: React.ReactNode[] = [];
    const regex = /\*\*(.+?)\*\*|`(.+?)`/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let idx = 0;
    while ((m = regex.exec(text)) !== null) {
        if (m.index > last) parts.push(text.slice(last, m.index));
        if (m[1] != null) {
            parts.push(<strong key={`${keyBase}-b${idx}`} className="font-semibold text-slate-800">{m[1]}</strong>);
        } else if (m[2] != null) {
            parts.push(<code key={`${keyBase}-c${idx}`} className="px-1 py-0.5 rounded bg-slate-100 text-[#0e5a6e] text-[12px]">{m[2]}</code>);
        }
        last = m.index + m[0].length;
        idx++;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts;
}

// A minimal, safe Markdown renderer for the subset the summary uses:
// ## headings, - / * bullets, 1. ordered lists, and paragraphs with **bold**.
function Markdown({ source }: { source: string }) {
    const lines = source.replace(/\r/g, '').split('\n');
    const blocks: React.ReactNode[] = [];
    let list: { ordered: boolean; items: string[] } | null = null;
    let key = 0;

    const flushList = () => {
        if (!list) return;
        const items = list.items;
        if (list.ordered) {
            blocks.push(
                <ol key={key++} className="list-decimal pl-5 space-y-1 my-2 text-[13px] text-slate-600 leading-relaxed marker:text-[#0e5a6e]">
                    {items.map((it, i) => <li key={i}>{renderInline(it, `ol${key}-${i}`)}</li>)}
                </ol>
            );
        } else {
            blocks.push(
                <ul key={key++} className="list-disc pl-5 space-y-1 my-2 text-[13px] text-slate-600 leading-relaxed marker:text-[#9fcdd6]">
                    {items.map((it, i) => <li key={i}>{renderInline(it, `ul${key}-${i}`)}</li>)}
                </ul>
            );
        }
        list = null;
    };

    for (const raw of lines) {
        const line = raw.trimEnd();
        const heading = line.match(/^(#{1,4})\s+(.*)$/);
        const bullet = line.match(/^\s*[-*]\s+(.*)$/);
        const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);

        if (heading) {
            flushList();
            blocks.push(
                <h3 key={key++} className="text-[13px] font-semibold uppercase tracking-wide mt-4 first:mt-0 mb-1.5" style={{ color: BRAND }}>
                    {renderInline(heading[2], `h${key}`)}
                </h3>
            );
        } else if (bullet) {
            if (!list || list.ordered) { flushList(); list = { ordered: false, items: [] }; }
            list.items.push(bullet[1]);
        } else if (ordered) {
            if (!list || !list.ordered) { flushList(); list = { ordered: true, items: [] }; }
            list.items.push(ordered[1]);
        } else if (line.trim() === '') {
            flushList();
        } else {
            flushList();
            blocks.push(
                <p key={key++} className="text-[13px] text-slate-600 leading-relaxed my-1.5">
                    {renderInline(line, `p${key}`)}
                </p>
            );
        }
    }
    flushList();
    return <div>{blocks}</div>;
}

export function AiSummaryModal({ applications, onClose, onOpenSettings }: AiSummaryModalProps) {
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState('');
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [total, setTotal] = useState(0);
    const [error, setError] = useState('');
    const [needsConfig, setNeedsConfig] = useState(false);
    const ranOnce = useRef(false);

    const run = async () => {
        setError('');
        setNeedsConfig(false);
        setLoading(true);
        try {
            // Send a compact snapshot of what's currently in view.
            const payload = applications.map(a => ({
                company: a.company,
                position: a.position,
                status: a.status,
                salary: a.salary,
                contractType: a.contractType,
                platform: a.platform,
                isStarred: a.isStarred,
                notes: a.notes,
            }));
            const res = await axios.post('/api/ai/summary', { applications: payload });
            setSummary(res.data.summary || '');
            setCounts(res.data.counts || {});
            setTotal(res.data.total || payload.length);
        } catch (e: any) {
            const msg = e?.response?.data?.error || 'Failed to generate the summary. Please try again.';
            setError(msg);
            if (/not configured/i.test(msg)) setNeedsConfig(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (ranOnce.current) return;
        ranOnce.current = true;
        run();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="fixed inset-0 bg-[#0e4a58]/25 flex items-center justify-center z-[60] backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-pop border border-slate-200 w-full max-w-lg overflow-hidden animate-fade-in flex flex-col max-h-[88vh]">
                <div className="px-5 py-3.5 border-b border-slate-100 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: BRAND }}>
                            <Sparkles className="w-[13px] h-[13px] text-white" />
                        </div>
                        <h2 className="text-[14px] font-semibold text-[#0e4a58]">Board insights</h2>
                        {total > 0 && (
                            <span className="text-[11px] text-slate-400">· {total} in view</span>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={run}
                            disabled={loading}
                            className="p-1.5 text-slate-400 hover:text-[#0e5a6e] hover:bg-[#e8f6f9] rounded-lg transition-colors disabled:opacity-40"
                            title="Regenerate"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button onClick={onOpenSettings} className="p-1.5 text-slate-400 hover:text-[#0e5a6e] hover:bg-[#e8f6f9] rounded-lg transition-colors" title="AI settings">
                            <Settings className="w-4 h-4" />
                        </button>
                        <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                            <X className="w-[18px] h-[18px]" />
                        </button>
                    </div>
                </div>

                {/* Stage tally strip */}
                {Object.keys(counts).length > 0 && (
                    <div className="px-5 py-2.5 border-b border-slate-100 bg-[#f3fafb] flex flex-wrap gap-1.5">
                        {Object.entries(counts).map(([k, v]) => (
                            <span key={k} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-[#cfe7eb] text-[11px] text-slate-600">
                                <span className="font-semibold text-[#0e5a6e]">{v}</span> {k}
                            </span>
                        ))}
                    </div>
                )}

                <div className="p-5 overflow-y-auto">
                    {loading ? (
                        <div className="py-12 flex flex-col items-center gap-3 text-slate-400">
                            <span className="animate-spin rounded-full h-7 w-7 border-2 border-[#cfe7eb] border-t-[#0e5a6e]" />
                            <p className="text-[12px]">Analyzing your pipeline…</p>
                        </div>
                    ) : error ? (
                        <div className="py-4">
                            <div className="bg-rose-50 text-rose-600 p-3 rounded-lg text-[12.5px] font-medium border border-rose-100 flex items-center justify-between gap-3">
                                <span>{error}</span>
                                {needsConfig && (
                                    <button onClick={onOpenSettings} className="shrink-0 underline underline-offset-2 font-semibold">Configure</button>
                                )}
                            </div>
                        </div>
                    ) : summary ? (
                        <Markdown source={summary} />
                    ) : (
                        <div className="py-10 flex flex-col items-center gap-2 text-slate-400">
                            <BarChart3 className="w-7 h-7" />
                            <p className="text-[12px]">Nothing to summarize yet.</p>
                        </div>
                    )}
                </div>

                <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
                    <p className="text-[10.5px] text-slate-400">Generated from the applications currently in view.</p>
                    <button
                        onClick={onClose}
                        className="px-3.5 py-1.5 text-[12px] text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
