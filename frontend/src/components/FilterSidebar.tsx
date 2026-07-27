import { SlidersHorizontal, Star, Briefcase, Banknote, Globe, X, ChevronLeft, ChevronRight } from 'lucide-react';

export interface Filters {
    contractTypes: string[];
    starredOnly: boolean;
    salaryMin: string;
    salaryMax: string;
    platforms: string[];
}

export const EMPTY_FILTERS: Filters = {
    contractTypes: [],
    starredOnly: false,
    salaryMin: '',
    salaryMax: '',
    platforms: [],
};

export const CONTRACT_TYPES = ['Full-time', 'Part-time', 'Contract', 'CDI', 'CDD', 'Intern', 'Freelance'];

// Parse a free-form salary string ("€45,000", "50k", "60000 / yr") into a number.
export function parseSalary(raw?: string): number | null {
    if (!raw) return null;
    const s = raw.replace(/[, ]/g, '').toLowerCase();
    const m = s.match(/(\d+(?:\.\d+)?)(k)?/);
    if (!m) return null;
    let n = parseFloat(m[1]);
    if (m[2] === 'k') n *= 1000;
    return isNaN(n) ? null : n;
}

export function countActiveFilters(f: Filters): number {
    return (
        f.contractTypes.length +
        f.platforms.length +
        (f.starredOnly ? 1 : 0) +
        (f.salaryMin ? 1 : 0) +
        (f.salaryMax ? 1 : 0)
    );
}

interface FilterSidebarProps {
    filters: Filters;
    onChange: (f: Filters) => void;
    platforms: string[];
    collapsed: boolean;
    onToggleCollapsed: () => void;
}

const BRAND = '#0e5a6e';

export function FilterSidebar({ filters, onChange, platforms, collapsed, onToggleCollapsed }: FilterSidebarProps) {
    const active = countActiveFilters(filters);

    const toggleContract = (t: string) => {
        onChange({
            ...filters,
            contractTypes: filters.contractTypes.includes(t)
                ? filters.contractTypes.filter((x) => x !== t)
                : [...filters.contractTypes, t],
        });
    };

    const togglePlatform = (p: string) => {
        onChange({
            ...filters,
            platforms: filters.platforms.includes(p)
                ? filters.platforms.filter((x) => x !== p)
                : [...filters.platforms, p],
        });
    };

    // ---- Collapsed rail: just small icons, with a dot when that group is active ----
    if (collapsed) {
        const railBtn = (Icon: typeof Star, isOn: boolean, title: string) => (
            <button
                onClick={onToggleCollapsed}
                title={title}
                className="relative w-9 h-9 rounded-lg flex items-center justify-center text-[#155e72] hover:text-[#0e5a6e] hover:bg-[#e8f6f9] transition-colors"
            >
                <Icon className="w-[15px] h-[15px]" />
                {isOn && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: BRAND }} />}
            </button>
        );
        return (
            <aside className="shrink-0 w-12 self-stretch min-h-0 bg-[#a5d4de] border-r border-[#8ac2cf] flex flex-col items-center py-3 gap-1">
                <button
                    onClick={onToggleCollapsed}
                    title="Expand filters"
                    className="relative w-9 h-9 rounded-lg flex items-center justify-center text-white transition-colors mb-1"
                    style={{ backgroundColor: BRAND }}
                >
                    <SlidersHorizontal className="w-[15px] h-[15px]" />
                    {active > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center">
                            {active}
                        </span>
                    )}
                </button>
                {railBtn(Star, filters.starredOnly, 'Starred')}
                {railBtn(Briefcase, filters.contractTypes.length > 0, 'Contract type')}
                {railBtn(Banknote, !!(filters.salaryMin || filters.salaryMax), 'Salary range')}
                {railBtn(Globe, filters.platforms.length > 0, 'Platform')}
                <div className="mt-auto">
                    <button
                        onClick={onToggleCollapsed}
                        title="Expand"
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-[#155e72] hover:text-[#0e5a6e] hover:bg-[#e8f6f9] transition-colors"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </aside>
        );
    }

    // ---- Expanded panel ----
    return (
        <aside className="shrink-0 w-[228px] self-stretch min-h-0 bg-[#a5d4de] border-r border-[#8ac2cf] flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between px-3.5 py-3 border-b border-[#8ac2cf]/60 sticky top-0 bg-[#a5d4de]/95 backdrop-blur-sm z-10">
                <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4" style={{ color: BRAND }} />
                    <span className="text-[13px] font-semibold text-[#083b49]">Filters</span>
                    {active > 0 && (
                        <span className="min-w-[16px] h-4 px-1 rounded-full text-white text-[10px] font-bold flex items-center justify-center" style={{ backgroundColor: BRAND }}>
                            {active}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-0.5">
                    {active > 0 && (
                        <button
                            onClick={() => onChange(EMPTY_FILTERS)}
                            title="Clear all"
                            className="w-6 h-6 rounded-md flex items-center justify-center text-[#155e72] hover:text-rose-500 hover:bg-rose-50 transition-colors"
                        >
                            <X className="w-[14px] h-[14px]" />
                        </button>
                    )}
                    <button
                        onClick={onToggleCollapsed}
                        title="Collapse"
                        className="w-6 h-6 rounded-md flex items-center justify-center text-[#155e72] hover:text-[#0e5a6e] hover:bg-[#e8f6f9] transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="p-3.5 space-y-5">
                {/* Starred */}
                <label className="flex items-center justify-between cursor-pointer">
                    <span className="flex items-center gap-2 text-[12.5px] font-medium text-[#0b4a5c]">
                        <Star className={`w-[14px] h-[14px] ${filters.starredOnly ? 'fill-amber-400 text-amber-500' : 'text-[#3d7f92]'}`} />
                        Starred only
                    </span>
                    <button
                        type="button"
                        onClick={() => onChange({ ...filters, starredOnly: !filters.starredOnly })}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${filters.starredOnly ? '' : 'bg-slate-300'}`}
                        style={filters.starredOnly ? { backgroundColor: BRAND } : undefined}
                    >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${filters.starredOnly ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                    </button>
                </label>

                {/* Contract type */}
                <div>
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-[#0e5a6e] uppercase tracking-wide mb-2">
                        <Briefcase className="w-[13px] h-[13px]" />
                        Contract type
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {CONTRACT_TYPES.map((t) => {
                            const on = filters.contractTypes.includes(t);
                            return (
                                <button
                                    key={t}
                                    onClick={() => toggleContract(t)}
                                    className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${on ? 'text-white border-transparent' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-[#9fcdd6]'}`}
                                    style={on ? { backgroundColor: BRAND } : undefined}
                                >
                                    {t}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Salary range */}
                <div>
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-[#0e5a6e] uppercase tracking-wide mb-2">
                        <Banknote className="w-[13px] h-[13px]" />
                        Salary range
                    </div>
                    <div className="flex items-center gap-1.5">
                        <input
                            type="text"
                            inputMode="numeric"
                            value={filters.salaryMin}
                            onChange={(e) => onChange({ ...filters, salaryMin: e.target.value })}
                            placeholder="Min"
                            className="w-full px-2 py-1.5 rounded-md border border-slate-200 bg-white text-[12px] focus:outline-none focus:ring-2 focus:ring-[#0e5a6e]/15 focus:border-[#9fcdd6] placeholder:text-slate-400"
                        />
                        <span className="text-[#0e5a6e]/60 text-[12px]">–</span>
                        <input
                            type="text"
                            inputMode="numeric"
                            value={filters.salaryMax}
                            onChange={(e) => onChange({ ...filters, salaryMax: e.target.value })}
                            placeholder="Max"
                            className="w-full px-2 py-1.5 rounded-md border border-slate-200 bg-white text-[12px] focus:outline-none focus:ring-2 focus:ring-[#0e5a6e]/15 focus:border-[#9fcdd6] placeholder:text-slate-400"
                        />
                    </div>
                    <p className="text-[10px] text-[#155e72] mt-1">Accepts values like 40000 or 40k · entries without a salary are hidden while filtering.</p>
                </div>

                {/* Platform */}
                {platforms.length > 0 && (
                    <div>
                        <div className="flex items-center gap-2 text-[11px] font-semibold text-[#0e5a6e] uppercase tracking-wide mb-2">
                            <Globe className="w-[13px] h-[13px]" />
                            Platform
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {platforms.map((p) => {
                                const on = filters.platforms.includes(p);
                                return (
                                    <button
                                        key={p}
                                        onClick={() => togglePlatform(p)}
                                        className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${on ? 'text-white border-transparent' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-[#9fcdd6]'}`}
                                        style={on ? { backgroundColor: BRAND } : undefined}
                                    >
                                        {p}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
}
