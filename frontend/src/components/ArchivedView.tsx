import { Archive, ExternalLink, RotateCcw } from 'lucide-react';
import { Application } from '../types';
import { getStatusMeta } from '../lib/statusStyles';

interface ArchivedViewProps {
    applications: Application[];
    onCardClick: (app: Application) => void;
    onRestore: (app: Application) => void;
}

export function ArchivedView({ applications, onCardClick, onRestore }: ArchivedViewProps) {
    return (
        <div className="board-surface h-full overflow-y-auto">
            <div className="max-w-6xl mx-auto px-6 py-8">
                <div className="flex items-center gap-2.5 mb-6">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                        <Archive className="w-[18px] h-[18px] text-amber-600" />
                    </div>
                    <div>
                        <h2 className="text-[17px] font-semibold text-stone-900 tracking-tight">Archived</h2>
                        <p className="text-[12px] text-stone-500">{applications.length} archived {applications.length === 1 ? 'application' : 'applications'}</p>
                    </div>
                </div>

                {applications.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-stone-200 py-20 text-center">
                        <Archive className="w-8 h-8 text-stone-300 mx-auto mb-3" />
                        <p className="text-[13px] text-stone-500">Nothing archived yet.</p>
                        <p className="text-[12px] text-stone-400 mt-1">Drag applications onto the Archive tab on the board to store them here.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                        {applications.map((app) => {
                            const statusMeta = getStatusMeta(app.status);
                            const initial = (app.company || app.position || '?').trim().charAt(0).toUpperCase();
                            return (
                                <div
                                    key={app.id}
                                    onClick={() => onCardClick(app)}
                                    className="group relative bg-white rounded-2xl border border-stone-200/90 border-l-[3px] border-l-amber-400 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 cursor-pointer p-4"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-[15px] font-semibold ${statusMeta.mono}`}>
                                            {initial}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h3 className="font-semibold text-[14.5px] leading-snug text-stone-900 tracking-tight truncate">{app.position}</h3>
                                            <div className="text-[12.5px] text-stone-500 mt-0.5 truncate">{app.company}</div>
                                        </div>
                                        {app.link && (
                                            <a
                                                href={app.link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                className="text-stone-300 hover:text-stone-600 shrink-0 transition-colors"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </a>
                                        )}
                                    </div>

                                    {/* Preserved status — untouched by archiving */}
                                    <div className="mt-3 flex items-center gap-1.5">
                                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium ${statusMeta.soft}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
                                            {app.status}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-stone-100">
                                        <span className="text-[10.5px] text-stone-400 tabular-nums whitespace-nowrap">
                                            {new Date(app.appliedDate).toLocaleDateString()}
                                        </span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onRestore(app); }}
                                            className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium text-stone-600 border border-stone-200 hover:border-stone-300 hover:bg-stone-50 transition-colors shrink-0"
                                            title={`Restore to ${app.status}`}
                                        >
                                            <RotateCcw className="w-3 h-3" />
                                            Restore
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
