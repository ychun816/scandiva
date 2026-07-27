import { useDroppable } from '@dnd-kit/core';
import { ChevronLeft } from 'lucide-react';

interface CollapsedArchiveProps {
    count: number;
    onToggle: () => void;
}

export function CollapsedArchive({ count, onToggle }: CollapsedArchiveProps) {
    const { setNodeRef, isOver } = useDroppable({
        id: 'Archived',
        data: {
            type: 'Column',
            column: { id: 'Archived', title: 'Archived' },
        },
    });

    return (
        <div ref={setNodeRef}>
            <button
                onClick={onToggle}
                className={`sticky top-0 rounded-xl border p-2.5 transition-colors flex flex-col items-center gap-2.5 ${
                    isOver
                        ? 'border-amber-300 bg-amber-50 text-amber-700'
                        : 'border-stone-200 bg-white text-stone-500 hover:border-stone-300 hover:text-stone-700 shadow-card'
                }`}
                title="Show Archive"
            >
                <ChevronLeft className="w-4 h-4" />
                <div className="text-[12px] font-semibold uppercase tracking-wide [writing-mode:vertical-rl] rotate-180">
                    Archive
                </div>
                <span className="text-[11px] font-medium text-stone-400 tabular-nums">{count}</span>
            </button>
        </div>
    );
}
