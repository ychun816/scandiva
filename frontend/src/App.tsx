import { useState, useEffect, useRef } from 'react';
import { DndContext, DragOverlay, closestCorners, pointerWithin, CollisionDetection, KeyboardSensor, PointerSensor, useSensor, useSensors, DragStartEvent, DragOverEvent, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Plus, Search, LayoutDashboard, Calendar, BarChart3, FileText, Archive, Sparkles, Lightbulb, PenLine } from 'lucide-react';
import axios from 'axios';
import { Column } from './components/Column';
import { ApplicationCard } from './components/ApplicationCard';
import { AddApplicationModal } from './components/AddApplicationModal';
import { ApplicationDetailsModal } from './components/ApplicationDetailsModal';
import { CalendarView } from './components/CalendarView';
import { AnalyticsView } from './components/AnalyticsView';
import { CVManagementView } from './components/CVManagementView';
import { ArchivedView } from './components/ArchivedView';
import { CollapsedArchive } from './components/CollapsedArchive';
import { LettersView } from './components/LettersView';
import { AiAddModal } from './components/AiAddModal';
import { AiSettingsModal } from './components/AiSettingsModal';
import { AiSummaryModal } from './components/AiSummaryModal';
import { FilterSidebar, Filters, EMPTY_FILTERS, parseSalary } from './components/FilterSidebar';
import { Application } from './types';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { AccountMenu } from './components/AccountMenu';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { TermsOfService } from './pages/TermsOfService';
import { AdminDashboard } from './pages/AdminDashboard';
import { Footer } from './components/Footer';
import { CookieBanner } from './components/CookieBanner';

// Archive is no longer a status — it's an independent flag, so it isn't a column here.
const COLUMNS = [
    { id: 'To Apply', title: 'To Apply', color: '', icon: '', count: 0 },
    { id: 'Applied', title: 'Applied', color: '', icon: '', count: 0 },
    { id: 'Interviewing', title: 'Interviewing', color: '', icon: '', count: 0 },
    { id: 'Offer', title: 'Offer', color: '', icon: '', count: 0 },
    { id: 'Rejected', title: 'Rejected', color: '', icon: '', count: 0 },
];

// Prefer the droppable the pointer is actually inside. closestCorners alone compares
// rect corners, so the small Archive strip next to the last column can win while the
// pointer is still over the Rejected column.
const boardCollisionDetection: CollisionDetection = (args) => {
    const within = pointerWithin(args);
    return within.length > 0 ? within : closestCorners(args);
};

function App() {
    const [applications, setApplications] = useState<Application[]>([]);
    const [activeId, setActiveId] = useState<number | null>(null);
    const dragOriginStatus = useRef<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedApp, setSelectedApp] = useState<Application | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [view, setView] = useState<'board' | 'calendar' | 'analytics' | 'cv' | 'letters' | 'archived' | 'profile' | 'settings' | 'privacy' | 'terms' | 'admin'>('board');
    const { user, isLoading } = useAuth();
    const [isRegistering, setIsRegistering] = useState(false);
    const [isAiAddOpen, setIsAiAddOpen] = useState(false);
    const [isAiSettingsOpen, setIsAiSettingsOpen] = useState(false);
    const [isAiSummaryOpen, setIsAiSummaryOpen] = useState(false);
    const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
    const [filtersCollapsed, setFiltersCollapsed] = useState(false);
    // Version to pre-select when jumping to Letters from an application's detail modal.
    const [lettersFocusId, setLettersFocusId] = useState<number | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        if (user) {
            fetchApplications();
        }
    }, [user]);

    const fetchApplications = async () => {
        try {
            const res = await axios.get('/api/applications');
            setApplications(res.data);
        } catch (error) {
            console.error('Failed to fetch applications', error);
        }
    };

    const handleAddApplication = async (newApp: Omit<Application, 'id' | 'createdAt' | 'updatedAt'>) => {
        try {
            const res = await axios.post('/api/applications', newApp);
            setApplications([res.data, ...applications]);
            setIsModalOpen(false);
            setIsAiAddOpen(false);
        } catch (error) {
            console.error('Failed to add application', error);
        }
    };

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        setActiveId(active.id as number);
        // Remember the status at drag start so dropping onto Archive can preserve it,
        // even if the card was dragged across other status columns on the way there.
        const dragged = applications.find(a => a.id === (active.id as number));
        dragOriginStatus.current = dragged ? dragged.status : null;
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id;
        const overId = over.id;

        if (activeId === overId) return;

        const isActiveTask = active.data.current?.type === 'Task';
        const isOverTask = over.data.current?.type === 'Task';

        if (!isActiveTask) return;

        // Dropping a Task over another Task
        if (isActiveTask && isOverTask) {
            setApplications((apps) => {
                const activeIndex = apps.findIndex((t) => t.id === activeId);
                const overIndex = apps.findIndex((t) => t.id === overId);

                if (apps[activeIndex].status !== apps[overIndex].status) {
                    const newStatus = apps[overIndex].status;
                    // Optimistic update
                    const updatedApps = [...apps];
                    updatedApps[activeIndex].status = newStatus;

                    // API call (fire and forget for now, ideally handle error)
                    axios.put(`/api/applications/${activeId}`, { status: newStatus });

                    return arrayMove(updatedApps, activeIndex, overIndex);
                }

                return arrayMove(apps, activeIndex, overIndex);
            });
        }

        const isOverColumn = over.data.current?.type === 'Column';

        // Dropping a Task over a Column
        if (isActiveTask && isOverColumn) {
            setApplications((apps) => {
                const activeIndex = apps.findIndex((t) => t.id === activeId);
                const target = overId as string;

                // The Archive strip only reacts on drop (handleDragEnd); archiving while
                // merely hovering committed the flag even when the drop landed elsewhere.
                if (target === 'Archived') return apps;

                // Dropping onto a status column: set status (and ensure it's not archived)
                if (apps[activeIndex].status !== target || apps[activeIndex].isArchived) {
                    const updatedApps = [...apps];
                    updatedApps[activeIndex] = { ...updatedApps[activeIndex], status: target, isArchived: false };
                    axios.put(`/api/applications/${activeId}`, { status: target, isArchived: false });
                    return arrayMove(updatedApps, activeIndex, activeIndex);
                }
                return apps;
            });
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        // Archive commits on drop only, restoring the status the card had at drag
        // start (it may have changed while crossing other columns on the way).
        if (over?.id === 'Archived') {
            const id = active.id as number;
            setApplications((apps) => {
                const index = apps.findIndex((t) => t.id === id);
                if (index === -1) return apps;
                const status = dragOriginStatus.current ?? apps[index].status;
                const updatedApps = [...apps];
                updatedApps[index] = { ...updatedApps[index], status, isArchived: true };
                axios.put(`/api/applications/${id}`, { status, isArchived: true });
                return updatedApps;
            });
        }
        setActiveId(null);
    };

    const handleUpdateApplication = async (id: number, updatedData: Partial<Application>) => {
        try {
            // Optimistic update
            setApplications(apps => apps.map(app =>
                app.id === id ? { ...app, ...updatedData } : app
            ));
            setSelectedApp(prev => prev ? { ...prev, ...updatedData } : null);

            // Reconcile with the server's authoritative record
            const res = await axios.put(`/api/applications/${id}`, updatedData);
            if (res?.data) {
                setApplications(apps => apps.map(app =>
                    app.id === id ? { ...app, ...res.data } : app
                ));
                setSelectedApp(prev => (prev && prev.id === id ? { ...prev, ...res.data } : prev));
            }
        } catch (error) {
            console.error('Failed to update application', error);
            // Revert on error would go here
        }
    };

    const handleDeleteApplication = async (id: number) => {
        try {
            // Optimistic update
            setApplications(apps => apps.filter(app => app.id !== id));
            await axios.delete(`/api/applications/${id}`);
        } catch (error) {
            console.error('Failed to delete application', error);
            // Revert on error - reload applications
            const res = await axios.get('/api/applications');
            setApplications(res.data);
        }
    };

    const handleRestoreApplication = (app: Application) => {
        // Un-archive — the status was never lost, so it simply reappears in its column.
        handleUpdateApplication(app.id, { isArchived: false });
    };

    // Unique, non-empty platforms present in the data — powers the Platform filter chips.
    const availablePlatforms = Array.from(
        new Set(applications.map(a => (a.platform || '').trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));

    const salaryMin = filters.salaryMin ? parseSalary(filters.salaryMin) : null;
    const salaryMax = filters.salaryMax ? parseSalary(filters.salaryMax) : null;

    const filteredApplications = applications.filter(app => {
        const q = searchTerm.toLowerCase();
        if (q && !(app.company.toLowerCase().includes(q) || app.position.toLowerCase().includes(q))) return false;

        if (filters.starredOnly && !app.isStarred) return false;
        if (filters.contractTypes.length && !filters.contractTypes.includes(app.contractType || '')) return false;
        if (filters.platforms.length && !filters.platforms.includes((app.platform || '').trim())) return false;

        if (salaryMin != null || salaryMax != null) {
            const val = parseSalary(app.salary);
            if (val == null) return false;
            if (salaryMin != null && val < salaryMin) return false;
            if (salaryMax != null && val > salaryMax) return false;
        }
        return true;
    });

    // The filter rail applies to the list-based views only.
    const showFilterSidebar = view === 'board' || view === 'calendar' || view === 'archived';

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-stone-200 border-t-stone-800"></div>
            </div>
        );
    }

    if (!user) {
        return isRegistering ? (
            <RegisterPage onSwitchToLogin={() => setIsRegistering(false)} />
        ) : (
            <LoginPage onSwitchToRegister={() => setIsRegistering(true)} />
        );
    }

    return (
        <div className="h-screen flex flex-col font-sans text-stone-900" style={{ background: 'var(--bg)' }}>
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 shadow-header px-5 py-2 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-5">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: '#0e5a6e' }}>
                            <LayoutDashboard className="w-[14px] h-[14px] text-white" />
                        </div>
                        <h1 className="text-[14px] font-semibold tracking-tight" style={{ color: '#0e4a58' }}>Candivana</h1>
                    </div>

                    {/* View Navigation */}
                    <nav className="flex items-center gap-0.5 bg-slate-100/80 p-0.5 rounded-lg">
                        {([
                            { id: 'board', label: 'Board', Icon: LayoutDashboard },
                            { id: 'calendar', label: 'Calendar', Icon: Calendar },
                            { id: 'analytics', label: 'Analytics', Icon: BarChart3 },
                            { id: 'cv', label: 'CV', Icon: FileText },
                            { id: 'letters', label: 'Letters', Icon: PenLine },
                            { id: 'archived', label: 'Archive', Icon: Archive },
                        ] as const).map(({ id, label, Icon }) => (
                            <button
                                key={id}
                                onClick={() => { if (id === 'letters') setLettersFocusId(null); setView(id); }}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors
                                    ${view === id
                                        ? 'bg-white text-[#0e5a6e] shadow-card'
                                        : 'text-slate-500 hover:text-[#0e5a6e]'}
                                `}
                            >
                                <Icon className="w-[13px] h-[13px]" />
                                {label}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative group">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search"
                            className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#0e5a6e]/15 focus:border-[#9fcdd6] w-44 focus:w-56 transition-all text-[12px] placeholder:text-slate-400"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {showFilterSidebar && (
                        <button
                            onClick={() => setIsAiSummaryOpen(true)}
                            className="border border-[#bfe0e6] bg-white hover:bg-[#e8f6f9] text-[#0e5a6e] pl-2 pr-2.5 py-1.5 rounded-lg flex items-center gap-1 font-medium transition-colors text-[12px]"
                            title="AI insights for the current board"
                        >
                            <Lightbulb className="w-3.5 h-3.5" />
                            Insights
                        </button>
                    )}
                    <button
                        onClick={() => setIsAiAddOpen(true)}
                        className="border border-[#bfe0e6] bg-white hover:bg-[#e8f6f9] text-[#0e5a6e] pl-2 pr-2.5 py-1.5 rounded-lg flex items-center gap-1 font-medium transition-colors text-[12px]"
                        title="Add with AI"
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        AI
                    </button>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-[#0e5a6e] hover:bg-[#0c4c5d] text-white pl-2.5 pr-3 py-1.5 rounded-lg flex items-center gap-1 font-medium transition-colors text-[12px] active:scale-[0.98]"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        New
                    </button>
                    <AccountMenu onNavigate={(page) => setView(page as any)} />
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 min-h-0 overflow-hidden flex">
                {showFilterSidebar && (
                    <FilterSidebar
                        filters={filters}
                        onChange={setFilters}
                        platforms={availablePlatforms}
                        collapsed={filtersCollapsed}
                        onToggleCollapsed={() => setFiltersCollapsed((c) => !c)}
                    />
                )}
                <div className="flex-1 overflow-hidden">
                {view === 'board' ? (
                    <div className="board-surface h-full overflow-x-auto">
                        <div className="h-full min-h-0 p-5 flex gap-4">
                            <DndContext
                                sensors={sensors}
                                collisionDetection={boardCollisionDetection}
                                onDragStart={handleDragStart}
                                onDragOver={handleDragOver}
                                onDragEnd={handleDragEnd}
                            >
                                {/* Status columns (archive is a flag, not a column) */}
                                {COLUMNS.map((col) => (
                                    <Column
                                        key={col.id}
                                        column={col}
                                        applications={filteredApplications.filter(app => app.status === col.id && !app.isArchived)}
                                        onCardClick={setSelectedApp}
                                        onToggleStar={(app) => handleUpdateApplication(app.id, { isStarred: !app.isStarred })}
                                    />
                                ))}

                                {/* Collapsed Archive — drop target on the board; opens the full Archive view */}
                                <div className="flex items-start h-full shrink-0">
                                    <CollapsedArchive
                                        count={applications.filter(app => app.isArchived).length}
                                        onToggle={() => setView('archived')}
                                    />
                                </div>

                                <DragOverlay>
                                    {activeId ? (
                                        <ApplicationCard
                                            application={applications.find(app => app.id === activeId)!}
                                            onClick={() => { }}
                                        />
                                    ) : null}
                                </DragOverlay>
                            </DndContext>
                        </div>
                    </div>
                ) : view === 'calendar' ? (
                    <CalendarView applications={filteredApplications} />
                ) : view === 'analytics' ? (
                    <AnalyticsView applications={applications} />
                ) : view === 'cv' ? (
                    <div className="fixed inset-0 top-[41px]">
                        <CVManagementView />
                    </div>
                ) : view === 'letters' ? (
                    <LettersView focusVersionId={lettersFocusId} />
                ) : view === 'archived' ? (
                    <ArchivedView
                        applications={filteredApplications.filter(app => app.isArchived)}
                        onCardClick={setSelectedApp}
                        onRestore={handleRestoreApplication}
                    />
                ) : view === 'profile' ? (
                    <ProfilePage onBack={() => setView('board')} />
                ) : view === 'settings' ? (
                    <SettingsPage onBack={() => setView('board')} />
                ) : view === 'privacy' ? (
                    <PrivacyPolicy onBack={() => setView('board')} />
                ) : view === 'terms' ? (
                    <TermsOfService onBack={() => setView('board')} />
                ) : view === 'admin' ? (
                    <AdminDashboard onBack={() => setView('board')} />
                ) : null
                }
                </div>
            </main>

            {/* Footer */}
            <Footer
                onNavigateToPrivacy={() => setView('privacy')}
                onNavigateToTerms={() => setView('terms')}
            />

            {/* Cookie Banner */}
            <CookieBanner onNavigateToPrivacy={() => setView('privacy')} />

            {isModalOpen && (
                <AddApplicationModal
                    onClose={() => setIsModalOpen(false)}
                    onAdd={handleAddApplication}
                />
            )}

            {
                selectedApp && (
                    <ApplicationDetailsModal
                        application={selectedApp}
                        onClose={() => setSelectedApp(null)}
                        onUpdate={handleUpdateApplication}
                        onDelete={handleDeleteApplication}
                        onOpenLetters={(versionId) => {
                            setSelectedApp(null);
                            setLettersFocusId(versionId);
                            setView('letters');
                        }}
                    />
                )
            }

            {isAiAddOpen && (
                <AiAddModal
                    onClose={() => setIsAiAddOpen(false)}
                    onAdd={handleAddApplication}
                    onOpenSettings={() => setIsAiSettingsOpen(true)}
                />
            )}

            {isAiSettingsOpen && (
                <AiSettingsModal onClose={() => setIsAiSettingsOpen(false)} />
            )}

            {isAiSummaryOpen && (
                <AiSummaryModal
                    applications={filteredApplications.filter(a => !a.isArchived)}
                    onClose={() => setIsAiSummaryOpen(false)}
                    onOpenSettings={() => { setIsAiSummaryOpen(false); setIsAiSettingsOpen(true); }}
                />
            )}
        </div >
    );
}

export default App;
