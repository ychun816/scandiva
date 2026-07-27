import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ExternalLink, Star } from 'lucide-react';
import { Application } from '../types';
import { getStatusMeta } from '../lib/statusStyles';
import axios from 'axios';

interface ApplicationCardProps {
    application: Application;
    onClick: (app: Application) => void;
    onToggleStar?: (app: Application) => void;
}

export function ApplicationCard({ application, onClick, onToggleStar }: ApplicationCardProps) {
    const {
        setNodeRef,
        attributes,
        listeners,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: application.id,
        data: {
            type: 'Task',
            application,
        },
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const meta = getStatusMeta(application.status);

    const handleStarToggle = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card click (don't open the details view)
        // Preferred path: let the parent optimistically flip the flag *and* persist it,
        // so the star updates instantly on the card.
        if (onToggleStar) {
            onToggleStar(application);
            return;
        }
        // Fallback when no handler is wired: persist directly.
        try {
            await axios.put(`/api/applications/${application.id}`, {
                isStarred: !application.isStarred
            });
        } catch (error) {
            console.error('Failed to toggle star', error);
        }
    };

    if (isDragging) {
        return (
            <div
                ref={setNodeRef}
                style={style}
                className="rounded-xl border-2 border-dashed border-stone-300 bg-stone-100/50 h-[92px]"
            />
        );
    }

    const stageDot =
        application.latestStage?.status === 'passed' ? 'bg-emerald-500'
            : application.latestStage?.status === 'failed' ? 'bg-rose-400'
                : 'bg-amber-400';

    const initial = (application.company || application.position || '?').trim().charAt(0).toUpperCase();

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={() => onClick(application)}
            className={`relative rounded-xl border border-stone-200/90 border-l-[3px] ${meta.accent} ${meta.ring} shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 cursor-grab active:cursor-grabbing group p-3 bg-white`}
        >
            {/* Star toggle — quiet, inline top-right */}
            <button
                onClick={handleStarToggle}
                className={`absolute top-2 right-2 w-5 h-5 rounded-md flex items-center justify-center transition-all duration-150 z-10 ${application.isStarred
                    ? 'text-amber-500'
                    : 'text-stone-300 opacity-0 group-hover:opacity-100 hover:text-stone-400'
                    }`}
                title={application.isStarred ? "Unstar" : "Star"}
            >
                <Star className={`w-3.5 h-3.5 ${application.isStarred ? 'fill-amber-400' : ''}`} />
            </button>

            <div className="flex items-start gap-2.5">
                <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-[13px] font-semibold ${meta.mono}`}>
                    {initial}
                </div>
                <div className="min-w-0 flex-1 pr-4">
                    <h3 className="font-semibold text-[13.5px] leading-snug text-stone-900 tracking-tight truncate">{application.position}</h3>
                    <div className="text-[12px] text-stone-500 mt-0.5 truncate">{application.company}</div>
                    {application.salary && (
                        <div className={`text-[11px] font-medium mt-0.5 truncate ${application.status === 'Offer' ? 'text-emerald-600' : 'text-stone-500'}`}>
                            {application.salary}
                        </div>
                    )}
                </div>
            </div>

            {/* Latest Stage Indicator */}
            {application.latestStage && (
                <div className="flex items-center gap-1.5 mt-2.5 text-[11px] text-stone-500">
                    <span className={`w-1.5 h-1.5 rounded-full ${stageDot}`} />
                    <span className="truncate">{application.latestStage.stageName}</span>
                </div>
            )}

            <div className="flex items-center justify-between gap-2 mt-2.5 pt-2.5 border-t border-stone-100">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10.5px] text-stone-400 tabular-nums whitespace-nowrap">
                        {new Date(application.appliedDate).toLocaleDateString()}
                    </span>
                    {application.link && (
                        <a
                            href={application.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-stone-300 hover:text-stone-600 opacity-0 group-hover:opacity-100 transition-all duration-150"
                        >
                            <ExternalLink className="w-3 h-3" />
                        </a>
                    )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    {application.contractType && (
                        <span className="px-1.5 py-0.5 rounded-md text-[10.5px] font-medium bg-stone-100 text-stone-600">
                            {application.contractType}
                        </span>
                    )}
                    {application.platform && (
                        <span className="px-1.5 py-0.5 rounded-md text-[10.5px] font-medium bg-stone-100 text-stone-500">
                            {application.platform}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
