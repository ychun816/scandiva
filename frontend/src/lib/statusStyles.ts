// Single source of truth for status colors.
// Modern, calm palette: a colored accent bar + a tinted monogram + a soft pill,
// on layered neutral surfaces — tasteful color, no gradient "AI" look.

export interface StatusMeta {
    label: string;
    dot: string;      // small status dot background
    accent: string;   // left border accent on cards
    bar: string;      // top accent bar on columns
    soft: string;     // subtle pill (bg + text)
    mono: string;     // monogram avatar (bg + text) — a touch richer than soft
    ring: string;     // hover border tint
    tint: string;     // very light column surface tint
}

export const STATUS_META: Record<string, StatusMeta> = {
    'To Apply': {
        label: 'To Apply',
        dot: 'bg-stone-400',
        accent: 'border-l-stone-300',
        bar: 'bg-stone-300',
        soft: 'bg-stone-100 text-stone-600',
        mono: 'bg-stone-200/70 text-stone-600',
        ring: 'hover:border-stone-300',
        tint: 'from-stone-100/60',
    },
    'Applied': {
        label: 'Applied',
        dot: 'bg-blue-500',
        accent: 'border-l-blue-400',
        bar: 'bg-blue-400',
        soft: 'bg-blue-50 text-blue-700',
        mono: 'bg-blue-100 text-blue-700',
        ring: 'hover:border-blue-200',
        tint: 'from-blue-50/50',
    },
    'Interviewing': {
        label: 'Interviewing',
        dot: 'bg-violet-500',
        accent: 'border-l-violet-400',
        bar: 'bg-violet-400',
        soft: 'bg-violet-50 text-violet-700',
        mono: 'bg-violet-100 text-violet-700',
        ring: 'hover:border-violet-200',
        tint: 'from-violet-50/50',
    },
    'Offer': {
        label: 'Offer',
        dot: 'bg-emerald-500',
        accent: 'border-l-emerald-400',
        bar: 'bg-emerald-400',
        soft: 'bg-emerald-50 text-emerald-700',
        mono: 'bg-emerald-100 text-emerald-700',
        ring: 'hover:border-emerald-200',
        tint: 'from-emerald-50/50',
    },
    'Rejected': {
        label: 'Rejected',
        dot: 'bg-rose-400',
        accent: 'border-l-rose-300',
        bar: 'bg-rose-300',
        soft: 'bg-rose-50 text-rose-600',
        mono: 'bg-rose-100 text-rose-600',
        ring: 'hover:border-rose-200',
        tint: 'from-rose-50/50',
    },
    'Archived': {
        label: 'Archived',
        dot: 'bg-amber-500',
        accent: 'border-l-amber-400',
        bar: 'bg-amber-400',
        soft: 'bg-amber-50 text-amber-700',
        mono: 'bg-amber-100 text-amber-700',
        ring: 'hover:border-amber-200',
        tint: 'from-amber-50/50',
    },
};

export const getStatusMeta = (status: string): StatusMeta =>
    STATUS_META[status] ?? STATUS_META['To Apply'];
