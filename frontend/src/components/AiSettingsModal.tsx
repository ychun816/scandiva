import { useState, useEffect } from 'react';
import { X, Sparkles, Check } from 'lucide-react';
import axios from 'axios';

interface AiSettingsModalProps {
    onClose: () => void;
    onSaved?: () => void;
}

export function AiSettingsModal({ onClose, onSaved }: AiSettingsModalProps) {
    const [apiBase, setApiBase] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [model, setModel] = useState('');
    const [maxRetries, setMaxRetries] = useState(2);
    const [hasKey, setHasKey] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [savedOk, setSavedOk] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const res = await axios.get('/api/ai/config');
                setApiBase(res.data.apiBase || '');
                setModel(res.data.model || '');
                setMaxRetries(typeof res.data.maxRetries === 'number' ? res.data.maxRetries : 2);
                setHasKey(!!res.data.hasKey);
            } catch (e) {
                // ignore — fresh config
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const handleSave = async () => {
        setError('');
        if (!apiBase.trim()) {
            setError('API base URL is required (e.g. https://api.openai.com/v1).');
            return;
        }
        if (!hasKey && !apiKey.trim()) {
            setError('An API key is required.');
            return;
        }
        setSaving(true);
        try {
            await axios.put('/api/ai/config', {
                apiBase: apiBase.trim(),
                apiKey: apiKey.trim(), // empty = keep existing
                model: model.trim(),
                maxRetries,
            });
            setSavedOk(true);
            setHasKey(hasKey || !!apiKey.trim());
            setApiKey('');
            onSaved?.();
            setTimeout(() => setSavedOk(false), 1500);
        } catch (e: any) {
            setError(e?.response?.data?.error || 'Failed to save.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-stone-900/30 flex items-center justify-center z-[60] backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-pop border border-stone-200 w-full max-w-md overflow-hidden animate-fade-in">
                <div className="px-6 py-4 border-b border-stone-100 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-stone-700" />
                        <h2 className="text-[15px] font-semibold text-stone-900">AI settings</h2>
                    </div>
                    <button onClick={onClose} className="text-stone-400 hover:text-stone-600 transition-colors">
                        <X className="w-[18px] h-[18px]" />
                    </button>
                </div>

                {loading ? (
                    <div className="p-10 flex justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-stone-200 border-t-stone-800" />
                    </div>
                ) : (
                    <div className="p-6 space-y-4">
                        <p className="text-[12px] text-stone-500 leading-relaxed">
                            Connect any OpenAI-compatible endpoint. Your key is stored on your account and used only to parse the text you paste — no scraping.
                        </p>

                        {error && (
                            <div className="bg-rose-50 text-rose-600 p-2.5 rounded-lg text-[12px] font-medium border border-rose-100">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-[13px] font-medium text-stone-600 mb-1.5">API base URL</label>
                            <input
                                type="text"
                                value={apiBase}
                                onChange={(e) => setApiBase(e.target.value)}
                                placeholder="https://api.openai.com/v1"
                                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#0e5a6e]/15 focus:border-[#9fcdd6] transition-all text-[14px] placeholder:text-stone-400"
                            />
                        </div>

                        <div>
                            <label className="block text-[13px] font-medium text-stone-600 mb-1.5">
                                API key {hasKey && <span className="text-stone-400 font-normal">· saved, leave blank to keep</span>}
                            </label>
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder={hasKey ? '••••••••••••' : 'sk-...'}
                                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#0e5a6e]/15 focus:border-[#9fcdd6] transition-all text-[14px] placeholder:text-stone-400"
                            />
                        </div>

                        <div>
                            <label className="block text-[13px] font-medium text-stone-600 mb-1.5">Model</label>
                            <input
                                type="text"
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                                placeholder="gpt-4o-mini"
                                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#0e5a6e]/15 focus:border-[#9fcdd6] transition-all text-[14px] placeholder:text-stone-400"
                            />
                        </div>

                        <div>
                            <label className="block text-[13px] font-medium text-stone-600 mb-1.5">
                                Format retries <span className="text-stone-400 font-normal">· 0–5</span>
                            </label>
                            <input
                                type="number"
                                min={0}
                                max={5}
                                value={maxRetries}
                                onChange={(e) => {
                                    const n = Math.round(Number(e.target.value));
                                    setMaxRetries(Number.isFinite(n) ? Math.max(0, Math.min(5, n)) : 0);
                                }}
                                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#0e5a6e]/15 focus:border-[#9fcdd6] transition-all text-[14px] placeholder:text-stone-400"
                            />
                            <p className="mt-1 text-[11px] text-stone-400 leading-relaxed">
                                If the AI returns malformed JSON, the error is sent back to the model to retry this many extra times.
                            </p>
                        </div>

                        <div className="pt-1 flex justify-end gap-2">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-[13px] text-stone-600 hover:bg-stone-100 rounded-lg font-medium transition-colors"
                            >
                                Close
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-4 py-2 text-[13px] bg-[#0e5a6e] hover:bg-[#0c4c5d] text-white rounded-lg font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
                            >
                                {savedOk ? <><Check className="w-4 h-4" /> Saved</> : saving ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
