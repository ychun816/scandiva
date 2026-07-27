import { useDroppable } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { Application } from '../types';
import { ApplicationCard } from './ApplicationCard';
import { getStatusMeta } from '../lib/statusStyles';

interface ColumnProps {
    column: { id: string; title: string; color: string };
    applications: Application[];
    onCardClick: (app: Application) => void;
    onToggleStar?: (app: Application) => void;
}

export function Column({ column, applications, onCardClick, onToggleStar }: ColumnProps) {
    const { setNodeRef, isOver } = useDroppable({
        id: column.id,
        data: {
            type: 'Column',
            column,
        },
    });

    const meta = getStatusMeta(column.id);

    return (
        <div className="flex flex-col flex-1 min-w-[256px] max-w-[360px] h-full">
            <div
                style={{ backgroundColor: 'var(--panel)' }}
                className={`relative flex flex-col h-full rounded-2xl border overflow-hidden transition-all duration-200 ${
                    isOver ? 'border-blue-300 ring-2 ring-blue-500/10 shadow-card-hover' : 'border-slate-200/80 shadow-card'
                }`}
            >
                {/* top accent bar in the status colour */}
                <div className={`h-[3px] w-full ${meta.bar}`} />

                {/* Column header */}
                <div className="px-3.5 pt-3 pb-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                        <h2 className="text-[12.5px] font-semibold text-stone-700 tracking-tight">
                            {column.title}
                        </h2>
                    </div>
                    <span className="min-w-[22px] text-center px-1.5 py-0.5 rounded-md text-[11px] font-semibold text-stone-600 bg-white border border-stone-200/70 shadow-card tabular-nums">
                        {applications.length}
                    </span>
                </div>

                <div
                    ref={setNodeRef}
                    className="flex-1 min-h-0 px-2.5 pb-3 overflow-y-auto flex flex-col gap-2.5"
                >
                    <SortableContext items={applications.map(app => app.id)}>
                        {applications.map((app) => (
                            <ApplicationCard
                                key={app.id}
                                application={app}
                                onClick={onCardClick}
                                onToggleStar={onToggleStar}
                            />
                        ))}
                    </SortableContext>
                    {applications.length === 0 && (
                        <div className="mt-1 rounded-xl border border-dashed border-stone-200 py-10 text-center text-[12px] text-stone-400">
                            Drop here
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
