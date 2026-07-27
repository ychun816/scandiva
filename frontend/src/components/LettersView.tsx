import { Fragment, useEffect, useMemo, useState, type DragEvent as ReactDragEvent } from 'react';
import axios from 'axios';
import {
    Plus, Trash2, Pencil, Check, X, Copy, ChevronUp, ChevronDown,
    ChevronLeft, ChevronRight, Unplug, Zap, FileText, BatteryCharging, PenLine,
    Search, Highlighter, FileDown, GripVertical, Sparkles, Folder, FolderPlus
} from 'lucide-react';
import { DndContext, DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { LetterBlock, LetterFolder, LetterVersion, LetterVersionGroup } from '../types';
import { PDF, makePdfDoc, downloadLetterPdf } from '../lib/letterPdf';

// ————————————————————————————————————————————————————————————————
// Motivation letters: versions (left) · block circuit (middle) · full text (right)
// Blocks are reusable "battery cells"; a version wires them into a chain.
// ————————————————————————————————————————————————————————————————

interface BlockEditorState {
    id: number | null; // null = creating
    title: string;
    content: string;
    folderId?: number | null; // target folder when creating
}

// Soft pastel identities, assigned automatically and stably by block id.
const CELL_COLORS = [
    { bg: '#fef9c3', accent: '#eab308' }, // yellow
    { bg: '#dbeafe', accent: '#3b82f6' }, // blue
    { bg: '#dcfce7', accent: '#22c55e' }, // green
    { bg: '#fce7f3', accent: '#ec4899' }, // pink
    { bg: '#ede9fe', accent: '#8b5cf6' }, // violet
    { bg: '#ffedd5', accent: '#f97316' }, // orange
    { bg: '#cffafe', accent: '#06b6d4' }, // cyan
    { bg: '#e2e8f0', accent: '#64748b' }, // slate
];
const colorFor = (blockId: number) => CELL_COLORS[blockId % CELL_COLORS.length];

// One draggable cell in the circuit chain
function SortableCell({ block, index, total, onMove, onUnplug }: {
    block: LetterBlock;
    index: number;
    total: number;
    onMove: (i: number, dir: -1 | 1) => void;
    onUnplug: (id: number) => void;
}) {
    const color = colorFor(block.id);
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
    return (
        <div
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={`relative flex gap-3 touch-none cursor-grab active:cursor-grabbing ${isDragging ? 'z-10 opacity-90' : ''}`}
        >
            {/* terminal node on the wire */}
            <div
                className="relative z-[1] mt-3 shrink-0 w-7 h-7 rounded-full border-2 border-white shadow-card flex items-center justify-center text-[11px] font-bold text-white tabular-nums"
                style={{ backgroundColor: color.accent }}
            >
                {index + 1}
            </div>
            <div
                className="flex-1 min-w-0 rounded-xl border border-stone-200/60 border-l-[3px] shadow-card p-3"
                style={{ backgroundColor: color.bg, borderLeftColor: color.accent }}
            >
                <div className="flex items-center gap-1.5">
                    <span className="shrink-0 -ml-1 text-stone-400" title="Drag anywhere on the card to reorder">
                        <GripVertical className="w-3.5 h-3.5" />
                    </span>
                    <h4 className="flex-1 min-w-0 truncate text-[12.5px] font-semibold text-stone-800">{block.title}</h4>
                    <button
                        onClick={() => onMove(index, -1)}
                        disabled={index === 0}
                        className="text-stone-400 hover:text-stone-700 disabled:opacity-25 transition-colors"
                        title="Move up"
                    >
                        <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => onMove(index, 1)}
                        disabled={index === total - 1}
                        className="text-stone-400 hover:text-stone-700 disabled:opacity-25 transition-colors"
                        title="Move down"
                    >
                        <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => onUnplug(block.id)}
                        className="text-stone-400 hover:text-red-500 transition-colors"
                        title="Unplug from this version"
                    >
                        <Unplug className="w-3.5 h-3.5" />
                    </button>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-stone-600 line-clamp-3 whitespace-pre-wrap">{block.content || '—'}</p>
            </div>
        </div>
    );
}

// `focusVersionId` pre-selects a version on mount (used when jumping here from an application).
export function LettersView({ focusVersionId }: { focusVersionId?: number | null } = {}) {
    const [blocks, setBlocks] = useState<LetterBlock[]>([]);
    const [folders, setFolders] = useState<LetterFolder[]>([]);
    const [versions, setVersions] = useState<LetterVersion[]>([]);
    const [versionGroups, setVersionGroups] = useState<LetterVersionGroup[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [renamingId, setRenamingId] = useState<number | null>(null);
    const [renameDraft, setRenameDraft] = useState('');
    const [editor, setEditor] = useState<BlockEditorState | null>(null);
    const [copied, setCopied] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [versionsCollapsed, setVersionsCollapsed] = useState(false);
    const [collapsedVersionGroups, setCollapsedVersionGroups] = useState<Set<number>>(new Set());
    const [renamingVersionGroupId, setRenamingVersionGroupId] = useState<number | null>(null);
    const [versionGroupRenameDraft, setVersionGroupRenameDraft] = useState('');
    const [draggingVersionId, setDraggingVersionId] = useState<number | null>(null);
    const [dragOverVersionGroup, setDragOverVersionGroup] = useState<number | 'root' | null>(null);
    const [cellQuery, setCellQuery] = useState('');
    const [colorized, setColorized] = useState(false);
    // Cells collapse to a single row by default to save vertical space; the set
    // holds the ids that are currently expanded.
    const [expandedCells, setExpandedCells] = useState<Set<number>>(new Set());
    const toggleCell = (id: number) => setExpandedCells(s => {
        const n = new Set(s);
        n.has(id) ? n.delete(id) : n.add(id);
        return n;
    });
    const [aiGen, setAiGen] = useState<{ description: string; minWords: string; maxWords: string } | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState('');
    // Folder UI state
    const [collapsedFolders, setCollapsedFolders] = useState<Set<number>>(new Set());
    const [renamingFolderId, setRenamingFolderId] = useState<number | null>(null);
    const [folderRenameDraft, setFolderRenameDraft] = useState('');
    const [draggingCellId, setDraggingCellId] = useState<number | null>(null);
    const [draggingFolderId, setDraggingFolderId] = useState<number | null>(null);
    const [dragOverFolder, setDragOverFolder] = useState<number | 'root' | null>(null);

    const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    useEffect(() => {
        (async () => {
            try {
                const [b, f, v, vg] = await Promise.all([
                    axios.get('/api/letter-blocks'),
                    axios.get('/api/letter-folders'),
                    axios.get('/api/letter-versions'),
                    axios.get('/api/letter-version-groups'),
                ]);
                setBlocks(b.data);
                setFolders(f.data);
                setVersions(v.data);
                setVersionGroups(vg.data);
                const focus = focusVersionId != null && v.data.some((x: LetterVersion) => x.id === focusVersionId)
                    ? focusVersionId
                    : v.data[0]?.id;
                if (focus != null) setSelectedId(focus);
            } catch (e) {
                console.error('Failed to load letters data', e);
            } finally {
                setLoaded(true);
            }
        })();
    }, []);

    const selected = versions.find(v => v.id === selectedId) || null;
    const blockById = useMemo(() => new Map(blocks.map(b => [b.id, b])), [blocks]);
    const chain = (selected?.blockIds || []).map(id => blockById.get(id)).filter(Boolean) as LetterBlock[];
    const fullText = chain.map(b => b.content.trim()).filter(Boolean).join('\n\n');
    const wordCount = fullText ? fullText.split(/\s+/).length : 0;

    const q = cellQuery.trim().toLowerCase();
    const filteredBlocks = q
        ? blocks.filter(b => (b.title + ' ' + b.content).toLowerCase().includes(q))
        : blocks;

    // Group the (filtered) cells by folder; `null` bucket is the root.
    const cellsInFolder = (folderId: number | null) =>
        filteredBlocks.filter(b => (b.folderId ?? null) === folderId);
    const rootCells = cellsInFolder(null);

    // Where each A4 page of the exported PDF ends, plus the total page count.
    // A break inside a paragraph is attached to that paragraph and flagged `mid`,
    // so the marker can say the page ends inside it rather than after it.
    const pdfPagination = useMemo(() => {
        const breaks = new Map<number, { page: number; mid: boolean }>(); // paragraph index -> break info
        if (!fullText) return { breaks, pages: 1 };
        // One paragraph per block (matches the preview and the PDF export).
        const paras = chain.map(b => b.content.trim()).filter(Boolean);
        const doc = makePdfDoc();
        const pageH = doc.internal.pageSize.getHeight();
        const maxW = doc.internal.pageSize.getWidth() - PDF.margin * 2;
        let y = PDF.margin;
        let page = 1;
        paras.forEach((p, idx) => {
            const lines: string[] = doc.splitTextToSize(p, maxW);
            lines.forEach((_, li) => {
                if (y + PDF.lineHeight > pageH - PDF.margin) {
                    const mid = li > 0;
                    breaks.set(mid || idx === 0 ? idx : idx - 1, { page, mid });
                    page++;
                    y = PDF.margin;
                }
                y += PDF.lineHeight;
            });
            if (idx < paras.length - 1) y += PDF.paraGap;
        });
        return { breaks, pages: page };
    }, [fullText]);

    // ——— versions ———
    const createVersion = async (groupId: number | null = null) => {
        const name = `Version ${versions.length + 1}`;
        const res = await axios.post('/api/letter-versions', { name, blockIds: [], groupId });
        setVersions(vs => [...vs, res.data]);
        setSelectedId(res.data.id);
        setRenamingId(res.data.id);
        setRenameDraft(res.data.name);
    };

    // Duplicate a version (same block chain) so a template can be reused per company.
    const duplicateVersion = async (v: LetterVersion) => {
        const res = await axios.post('/api/letter-versions', {
            name: `${v.name} (copy)`,
            blockIds: v.blockIds,
            groupId: v.groupId ?? null,
        });
        setVersions(vs => [...vs, res.data]);
        setSelectedId(res.data.id);
        setRenamingId(res.data.id);
        setRenameDraft(res.data.name);
    };

    const commitRename = async (id: number) => {
        const name = renameDraft.trim();
        setRenamingId(null);
        if (!name) return;
        setVersions(vs => vs.map(v => v.id === id ? { ...v, name } : v));
        await axios.put(`/api/letter-versions/${id}`, { name });
    };

    const deleteVersion = async (id: number) => {
        setVersions(vs => {
            const next = vs.filter(v => v.id !== id);
            if (selectedId === id) setSelectedId(next.length ? next[0].id : null);
            return next;
        });
        await axios.delete(`/api/letter-versions/${id}`);
    };

    const createVersionGroup = async () => {
        const name = `Group ${versionGroups.length + 1}`;
        const res = await axios.post('/api/letter-version-groups', { name });
        setVersionGroups(groups => [...groups, res.data]);
        setRenamingVersionGroupId(res.data.id);
        setVersionGroupRenameDraft(res.data.name);
    };

    const commitVersionGroupRename = async (id: number) => {
        const name = versionGroupRenameDraft.trim();
        setRenamingVersionGroupId(null);
        if (!name) return;
        setVersionGroups(groups => groups.map(group => group.id === id ? { ...group, name } : group));
        await axios.put(`/api/letter-version-groups/${id}`, { name });
    };

    const deleteVersionGroup = async (id: number) => {
        setVersions(items => items.map(version =>
            version.groupId === id ? { ...version, groupId: null } : version
        ));
        setVersionGroups(groups => groups.filter(group => group.id !== id));
        await axios.delete(`/api/letter-version-groups/${id}`);
    };

    const toggleVersionGroup = (id: number) => setCollapsedVersionGroups(current => {
        const next = new Set(current);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });

    const moveVersionToGroup = async (versionId: number, groupId: number | null) => {
        const current = versions.find(version => version.id === versionId);
        if (!current || (current.groupId ?? null) === groupId) return;
        setVersions(items => items.map(version =>
            version.id === versionId ? { ...version, groupId } : version
        ));
        try {
            await axios.put(`/api/letter-versions/${versionId}`, { groupId });
        } catch (error) {
            console.error('Failed to move version', error);
            setVersions(items => items.map(version =>
                version.id === versionId ? { ...version, groupId: current.groupId ?? null } : version
            ));
        }
    };

    // ——— chain wiring ———
    const setChain = async (blockIds: number[]) => {
        if (!selected) return;
        setVersions(vs => vs.map(v => v.id === selected.id ? { ...v, blockIds } : v));
        await axios.put(`/api/letter-versions/${selected.id}`, { blockIds });
    };

    const plugIn = (blockId: number) => {
        if (!selected || selected.blockIds.includes(blockId)) return;
        setChain([...selected.blockIds, blockId]);
    };

    const unplug = (blockId: number) => {
        if (!selected) return;
        setChain(selected.blockIds.filter(id => id !== blockId));
    };

    const move = (index: number, dir: -1 | 1) => {
        if (!selected) return;
        const ids = [...selected.blockIds];
        const j = index + dir;
        if (j < 0 || j >= ids.length) return;
        [ids[index], ids[j]] = [ids[j], ids[index]];
        setChain(ids);
    };

    const handleChainDragEnd = (e: DragEndEvent) => {
        const { active, over } = e;
        if (!selected || !over || active.id === over.id) return;
        const ids = selected.blockIds;
        const from = ids.indexOf(active.id as number);
        const to = ids.indexOf(over.id as number);
        if (from < 0 || to < 0) return;
        setChain(arrayMove(ids, from, to));
    };

    // ——— blocks ———
    const saveBlock = async () => {
        if (!editor || !editor.title.trim()) return;
        if (editor.id == null) {
            const res = await axios.post('/api/letter-blocks', { title: editor.title, content: editor.content, folderId: editor.folderId ?? null });
            setBlocks(bs => [...bs, res.data]);
        } else {
            const res = await axios.put(`/api/letter-blocks/${editor.id}`, { title: editor.title, content: editor.content });
            setBlocks(bs => bs.map(b => b.id === editor.id ? res.data : b));
        }
        setEditor(null);
    };

    // AI-drafted cell: the result opens in the editor for review — nothing is saved until the user confirms.
    const generateCell = async () => {
        if (!aiGen) return;
        if (aiGen.description.trim().length < 3) {
            setAiError('Describe what the paragraph should say first.');
            return;
        }
        setAiLoading(true);
        setAiError('');
        try {
            const res = await axios.post('/api/ai/generate-cell', {
                description: aiGen.description.trim(),
                minWords: aiGen.minWords.trim() || undefined,
                maxWords: aiGen.maxWords.trim() || undefined,
            });
            setAiGen(null);
            setEditor({ id: null, title: res.data.title, content: res.data.content });
        } catch (e: any) {
            setAiError(e?.response?.data?.error || 'Generation failed. Please try again.');
        } finally {
            setAiLoading(false);
        }
    };

    const deleteBlock = async (id: number) => {
        setBlocks(bs => bs.filter(b => b.id !== id));
        setVersions(vs => vs.map(v => ({ ...v, blockIds: v.blockIds.filter(i => i !== id) })));
        await axios.delete(`/api/letter-blocks/${id}`);
    };

    // ——— folders ———
    const createFolder = async () => {
        const name = `Folder ${folders.length + 1}`;
        const res = await axios.post('/api/letter-folders', { name });
        setFolders(fs => [...fs, res.data]);
        setRenamingFolderId(res.data.id);
        setFolderRenameDraft(res.data.name);
    };

    const commitFolderRename = async (id: number) => {
        const name = folderRenameDraft.trim();
        setRenamingFolderId(null);
        if (!name) return;
        setFolders(fs => fs.map(f => f.id === id ? { ...f, name } : f));
        await axios.put(`/api/letter-folders/${id}`, { name });
    };

    // Deleting a folder keeps its cells — they fall back to the root.
    const deleteFolder = async (id: number) => {
        setBlocks(bs => bs.map(b => b.folderId === id ? { ...b, folderId: null } : b));
        setFolders(fs => fs.filter(f => f.id !== id));
        await axios.delete(`/api/letter-folders/${id}`);
    };

    const toggleFolder = (id: number) => setCollapsedFolders(s => {
        const n = new Set(s);
        n.has(id) ? n.delete(id) : n.add(id);
        return n;
    });

    // Move folder `draggedId` to sit just before `targetId`, and persist the order.
    const reorderFolders = async (draggedId: number, targetId: number) => {
        if (draggedId === targetId) return;
        const order = folders.map(f => f.id);
        if (!order.includes(draggedId) || !order.includes(targetId)) return;
        const without = order.filter(id => id !== draggedId);
        without.splice(without.indexOf(targetId), 0, draggedId);
        const prev = folders;
        setFolders(without.map(id => folders.find(f => f.id === id)!));
        try {
            const res = await axios.put('/api/letter-folders/reorder', { ids: without });
            setFolders(res.data);
        } catch (e) {
            console.error('Failed to reorder folders', e);
            setFolders(prev);
        }
    };

    // Move a cell into a folder (or to root when target is null).
    const moveCell = async (cellId: number, folderId: number | null) => {
        const current = blocks.find(b => b.id === cellId);
        if (!current || (current.folderId ?? null) === folderId) return;
        setBlocks(bs => bs.map(b => b.id === cellId ? { ...b, folderId } : b));
        try {
            await axios.put(`/api/letter-blocks/${cellId}`, { folderId });
        } catch (e) {
            console.error('Failed to move cell', e);
            setBlocks(bs => bs.map(b => b.id === cellId ? { ...b, folderId: current.folderId ?? null } : b));
        }
    };

    const copyText = async () => {
        try {
            await navigator.clipboard.writeText(fullText);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch (e) {
            console.error('Copy failed', e);
        }
    };

    // Downloads the assembled letter as an A4 PDF file.
    const exportPdf = () => {
        if (!fullText) return;
        downloadLetterPdf(selected?.name || 'motivation-letter', chain.map(b => b.content));
    };

    // One cell card — draggable between folders. Collapsed to a single row by default.
    const renderCell = (b: LetterBlock) => {
        const used = !!selected?.blockIds.includes(b.id);
        const open = expandedCells.has(b.id);
        return (
            <div
                key={b.id}
                draggable
                onDragStart={e => {
                    setDraggingCellId(b.id);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', String(b.id));
                }}
                onDragEnd={() => { setDraggingCellId(null); setDragOverFolder(null); }}
                className={`group rounded-xl border transition-all cursor-grab active:cursor-grabbing ${open ? 'p-2.5' : 'px-2 py-1.5'}
                    ${draggingCellId === b.id ? 'opacity-40' : ''}
                    ${used
                        ? 'border-amber-300 bg-amber-50/70'
                        : 'border-stone-200/90 bg-white shadow-card hover:shadow-card-hover'}`}
            >
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => toggleCell(b.id)}
                        className="shrink-0 text-slate-400 hover:text-slate-700 transition-colors"
                        title={open ? 'Collapse' : 'Expand'}
                    >
                        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colorFor(b.id).accent }} />
                    <h4 className="flex-1 min-w-0 truncate text-[12px] font-semibold text-stone-800">{b.title}</h4>
                    {open ? (
                        <>
                            <button
                                onClick={() => setEditor({ id: b.id, title: b.title, content: b.content })}
                                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 transition-opacity"
                                title="Edit cell"
                            >
                                <Pencil className="w-3 h-3" />
                            </button>
                            <button
                                onClick={() => deleteBlock(b.id)}
                                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity"
                                title="Delete cell"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </>
                    ) : (
                        // Collapsed: plug/unplug stays reachable without expanding.
                        <button
                            onClick={() => used ? unplug(b.id) : plugIn(b.id)}
                            disabled={!selected}
                            title={used ? 'Unplug from this version' : 'Plug into this version'}
                            className={`shrink-0 w-5 h-5 rounded-md flex items-center justify-center border transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                                ${used
                                    ? 'border-amber-300 text-amber-700 hover:bg-amber-100'
                                    : 'border-[#bfe0e6] text-[#0e5a6e] hover:bg-[#e8f6f9]'}`}
                        >
                            {used ? <Unplug className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
                        </button>
                    )}
                </div>
                {open && (
                    <>
                        <p className="mt-1 text-[11px] leading-snug text-slate-500 line-clamp-2 whitespace-pre-wrap">{b.content || '—'}</p>
                        <button
                            onClick={() => used ? unplug(b.id) : plugIn(b.id)}
                            disabled={!selected}
                            className={`mt-2 w-full flex items-center justify-center gap-1 py-1 rounded-lg text-[11px] font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                                ${used
                                    ? 'border-amber-300 text-amber-700 hover:bg-amber-100'
                                    : 'border-[#bfe0e6] text-[#0e5a6e] hover:bg-[#e8f6f9]'}`}
                        >
                            {used ? <Unplug className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
                            {used ? 'Unplug' : 'Plug in'}
                        </button>
                    </>
                )}
            </div>
        );
    };

    // Drop-zone handlers shared by folders and the root bucket. Accepts both a
    // dragged cell (moves it here) and a dragged folder (reorders before target).
    const dropZoneProps = (target: number | 'root') => ({
        onDragOver: (e: ReactDragEvent) => {
            if (draggingCellId == null && draggingFolderId == null) return;
            // A folder can only be dropped onto another folder, not the root bucket.
            if (draggingFolderId != null && target === 'root') return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setDragOverFolder(target);
        },
        onDrop: (e: ReactDragEvent) => {
            e.preventDefault();
            if (draggingFolderId != null && typeof target === 'number') {
                reorderFolders(draggingFolderId, target);
            } else if (draggingCellId != null) {
                const id = Number(e.dataTransfer.getData('text/plain'));
                if (id) moveCell(id, target === 'root' ? null : target);
            }
            setDragOverFolder(null);
            setDraggingCellId(null);
            setDraggingFolderId(null);
        },
    });

    const versionDropZoneProps = (target: number | 'root') => ({
        onDragOver: (e: ReactDragEvent) => {
            if (draggingVersionId == null) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setDragOverVersionGroup(target);
        },
        onDrop: (e: ReactDragEvent) => {
            e.preventDefault();
            if (draggingVersionId != null) {
                moveVersionToGroup(draggingVersionId, target === 'root' ? null : target);
            }
            setDraggingVersionId(null);
            setDragOverVersionGroup(null);
        },
    });

    const renderVersion = (v: LetterVersion) => (
        <div
            key={v.id}
            draggable={renamingId !== v.id}
            onDragStart={e => {
                setDraggingVersionId(v.id);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', `version:${v.id}`);
            }}
            onDragEnd={() => {
                setDraggingVersionId(null);
                setDragOverVersionGroup(null);
            }}
            onClick={() => setSelectedId(v.id)}
            className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors
                ${draggingVersionId === v.id ? 'opacity-40' : ''}
                ${v.id === selectedId ? 'bg-[#e8f6f9] text-[#0e4a58]' : 'text-slate-600 hover:bg-slate-100/80'}`}
        >
            {renamingId === v.id ? (
                <input
                    autoFocus
                    value={renameDraft}
                    onChange={e => setRenameDraft(e.target.value)}
                    onBlur={() => commitRename(v.id)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') commitRename(v.id);
                        if (e.key === 'Escape') setRenamingId(null);
                    }}
                    onClick={e => e.stopPropagation()}
                    className="flex-1 min-w-0 text-[12px] bg-white border border-[#9fcdd6] rounded px-1 py-0.5 focus:outline-none"
                />
            ) : (
                <>
                    <span className="flex-1 min-w-0 truncate text-[12.5px] font-medium">{v.name}</span>
                    <span className="text-[10px] text-slate-400 tabular-nums shrink-0">{v.blockIds.length}</span>
                    <button
                        onClick={e => { e.stopPropagation(); setRenamingId(v.id); setRenameDraft(v.name); }}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 transition-opacity shrink-0"
                        title="Rename"
                    >
                        <Pencil className="w-3 h-3" />
                    </button>
                    <button
                        onClick={e => { e.stopPropagation(); duplicateVersion(v); }}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-[#0e5a6e] transition-opacity shrink-0"
                        title="Duplicate version"
                    >
                        <Copy className="w-3 h-3" />
                    </button>
                    <button
                        onClick={e => { e.stopPropagation(); deleteVersion(v.id); }}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity shrink-0"
                        title="Delete version"
                    >
                        <Trash2 className="w-3 h-3" />
                    </button>
                </>
            )}
        </div>
    );

    if (!loaded) {
        return (
            <div className="h-full flex items-center justify-center" style={{ background: 'var(--bg)' }}>
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-stone-200 border-t-stone-800" />
            </div>
        );
    }

    return (
        <div className="board-surface h-full flex min-h-0">
            {/* ——— Left: versions (collapsible) ——— */}
            {versionsCollapsed ? (
                <aside className="shrink-0 w-12 self-stretch min-h-0 bg-[#a5d4de] border-r border-[#8ac2cf] flex flex-col items-center py-3 gap-1">
                    <button
                        onClick={() => setVersionsCollapsed(false)}
                        title="Expand versions"
                        className="relative w-9 h-9 rounded-lg flex items-center justify-center text-white bg-[#0e5a6e] transition-colors mb-1"
                    >
                        <PenLine className="w-[15px] h-[15px]" />
                        {versions.length > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center">
                                {versions.length}
                            </span>
                        )}
                    </button>
                    <div className="mt-auto">
                        <button
                            onClick={() => setVersionsCollapsed(false)}
                            title="Expand"
                            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:text-[#0e5a6e] hover:bg-[#e8f6f9] transition-colors"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </aside>
            ) : (
            <aside className="w-60 shrink-0 border-r border-[var(--border)] bg-white/70 backdrop-blur-sm flex flex-col min-h-0">
                <div className="px-3 pt-3 pb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        <PenLine className="w-3 h-3" />
                        Versions
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={createVersionGroup}
                            className="w-5 h-5 rounded-md flex items-center justify-center text-slate-500 hover:text-[#0e5a6e] hover:bg-[#e8f6f9] transition-colors"
                            title="New version group"
                        >
                            <FolderPlus className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={() => createVersion()}
                            className="w-5 h-5 rounded-md flex items-center justify-center text-white bg-[#0e5a6e] hover:bg-[#0c4c5d] transition-colors"
                            title="New version"
                        >
                            <Plus className="w-3 h-3" />
                        </button>
                        <button
                            onClick={() => setVersionsCollapsed(true)}
                            className="w-5 h-5 rounded-md flex items-center justify-center text-slate-400 hover:text-[#0e5a6e] hover:bg-[#e8f6f9] transition-colors"
                            title="Collapse versions"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1.5">
                    {versions.length === 0 && versionGroups.length === 0 && (
                        <p className="text-[11.5px] text-slate-400 px-1.5 pt-2 leading-relaxed">
                            No versions yet. Create a version or a group, then wire blocks together in the middle panel.
                        </p>
                    )}

                    {versionGroups.map(versionGroup => {
                        const groupedVersions = versions.filter(version => version.groupId === versionGroup.id);
                        const open = !collapsedVersionGroups.has(versionGroup.id);
                        const over = dragOverVersionGroup === versionGroup.id;
                        return (
                            <div
                                key={versionGroup.id}
                                {...versionDropZoneProps(versionGroup.id)}
                                className={`rounded-xl border transition-colors ${
                                    over
                                        ? 'border-[#0e5a6e] bg-[#e8f6f9]/70 ring-1 ring-[#0e5a6e]/30'
                                        : 'border-slate-200/80 bg-slate-50/60'
                                }`}
                            >
                                <div className="group flex items-center gap-1.5 px-2 py-1.5">
                                    <button
                                        onClick={() => toggleVersionGroup(versionGroup.id)}
                                        className="shrink-0 text-slate-400 hover:text-slate-700 transition-colors"
                                        title={open ? 'Collapse group' : 'Expand group'}
                                    >
                                        {open
                                            ? <ChevronDown className="w-3.5 h-3.5" />
                                            : <ChevronRight className="w-3.5 h-3.5" />}
                                    </button>
                                    <Folder className="w-3.5 h-3.5 text-[#0e5a6e] shrink-0" />
                                    {renamingVersionGroupId === versionGroup.id ? (
                                        <input
                                            autoFocus
                                            value={versionGroupRenameDraft}
                                            onChange={e => setVersionGroupRenameDraft(e.target.value)}
                                            onBlur={() => commitVersionGroupRename(versionGroup.id)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') commitVersionGroupRename(versionGroup.id);
                                                if (e.key === 'Escape') setRenamingVersionGroupId(null);
                                            }}
                                            className="flex-1 min-w-0 text-[12px] bg-white border border-[#9fcdd6] rounded px-1 py-0.5 focus:outline-none"
                                        />
                                    ) : (
                                        <span className="flex-1 min-w-0 truncate text-[12px] font-semibold text-slate-700">
                                            {versionGroup.name}
                                        </span>
                                    )}
                                    <span className="text-[10px] text-slate-400 tabular-nums shrink-0">{groupedVersions.length}</span>
                                    <button
                                        onClick={() => createVersion(versionGroup.id)}
                                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-[#0e5a6e] transition-all shrink-0"
                                        title="New version in this group"
                                    >
                                        <Plus className="w-3 h-3" />
                                    </button>
                                    <button
                                        onClick={() => {
                                            setRenamingVersionGroupId(versionGroup.id);
                                            setVersionGroupRenameDraft(versionGroup.name);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 transition-all shrink-0"
                                        title="Rename group"
                                    >
                                        <Pencil className="w-3 h-3" />
                                    </button>
                                    <button
                                        onClick={() => deleteVersionGroup(versionGroup.id)}
                                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all shrink-0"
                                        title="Delete group (versions move to Ungrouped)"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                                {open && (
                                    <div className="pl-3 pr-1 pb-1.5 ml-2 border-l border-slate-200 space-y-0.5 min-h-[26px]">
                                        {groupedVersions.length === 0
                                            ? <p className="text-[10.5px] text-slate-400 py-1 pl-1">Drop versions here</p>
                                            : groupedVersions.map(renderVersion)}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {(() => {
                        const ungroupedVersions = versions.filter(version => version.groupId == null);
                        return (
                        <div
                            {...versionDropZoneProps('root')}
                            className={`rounded-lg transition-colors space-y-0.5 ${
                                dragOverVersionGroup === 'root' ? 'ring-1 ring-[#0e5a6e]/30 bg-[#e8f6f9]/50 p-1' : ''
                            }`}
                        >
                            {versionGroups.length > 0 && ungroupedVersions.length > 0 && (
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2 pt-1">
                                    Ungrouped
                                </div>
                            )}
                            {ungroupedVersions.map(renderVersion)}
                            {versionGroups.length > 0 && ungroupedVersions.length === 0 && draggingVersionId != null && (
                                <p className="text-[10.5px] text-slate-400 py-2 text-center border border-dashed border-slate-300 rounded-lg">
                                    Drop here to remove from group
                                </p>
                            )}
                        </div>
                        );
                    })()}
                </div>
            </aside>
            )}

            {/* ——— Middle: cell library + circuit ——— */}
            <div className="shrink-0 flex min-h-0">
                {/* Cell library */}
                <section className="w-64 shrink-0 border-r border-[var(--border)] flex flex-col min-h-0 bg-white/40">
                    <div className="px-3 pt-3 pb-2 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                            <BatteryCharging className="w-3.5 h-3.5" />
                            Cells
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setExpandedCells(prev =>
                                    prev.size > 0 ? new Set() : new Set(filteredBlocks.map(b => b.id))
                                )}
                                className="w-5 h-5 rounded-md flex items-center justify-center text-slate-400 hover:text-[#0e5a6e] hover:bg-[#e8f6f9] transition-colors"
                                title={expandedCells.size > 0 ? 'Collapse all' : 'Expand all'}
                            >
                                {expandedCells.size > 0 ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                            <button
                                onClick={createFolder}
                                className="w-5 h-5 rounded-md flex items-center justify-center text-slate-500 hover:text-[#0e5a6e] hover:bg-[#e8f6f9] transition-colors"
                                title="New folder"
                            >
                                <FolderPlus className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => { setAiError(''); setAiGen({ description: '', minWords: '200', maxWords: '300' }); }}
                                className="w-5 h-5 rounded-md flex items-center justify-center text-[#0e5a6e] border border-[#bfe0e6] hover:bg-[#e8f6f9] transition-colors"
                                title="Generate cell with AI"
                            >
                                <Sparkles className="w-3 h-3" />
                            </button>
                            <button
                                onClick={() => setEditor({ id: null, title: '', content: '' })}
                                className="w-5 h-5 rounded-md flex items-center justify-center text-white bg-[#0e5a6e] hover:bg-[#0c4c5d] transition-colors"
                                title="New cell"
                            >
                                <Plus className="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                    <div className="px-2.5 pb-2">
                        <div className="relative">
                            <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                            <input
                                value={cellQuery}
                                onChange={e => setCellQuery(e.target.value)}
                                placeholder="Search cells"
                                className="w-full pl-6 pr-2 py-1 rounded-lg border border-slate-200 bg-white text-[11.5px] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0e5a6e]/15 focus:border-[#9fcdd6]"
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto px-2.5 pb-3 space-y-2">
                        {blocks.length === 0 && folders.length === 0 && (
                            <p className="text-[11.5px] text-slate-400 px-1 pt-2 leading-relaxed">
                                Write reusable paragraphs here — an intro, a skills pitch, a closing — then plug them into versions. Use folders to group them by type and drag cells between them.
                            </p>
                        )}
                        {blocks.length > 0 && filteredBlocks.length === 0 && (
                            <p className="text-[11.5px] text-slate-400 px-1 pt-2">No cells match “{cellQuery}”.</p>
                        )}

                        {/* Folders (drop targets) */}
                        {folders.map(f => {
                            const cells = cellsInFolder(f.id);
                            const folderOpen = !collapsedFolders.has(f.id);
                            const over = dragOverFolder === f.id;
                            return (
                                <div
                                    key={f.id}
                                    {...dropZoneProps(f.id)}
                                    className={`rounded-xl border transition-colors ${over ? 'border-[#0e5a6e] bg-[#e8f6f9]/70 ring-1 ring-[#0e5a6e]/30' : 'border-slate-200/80 bg-slate-50/60'}`}
                                >
                                    <div
                                        draggable={renamingFolderId !== f.id}
                                        onDragStart={e => {
                                            setDraggingFolderId(f.id);
                                            e.dataTransfer.effectAllowed = 'move';
                                            e.dataTransfer.setData('text/plain', `folder:${f.id}`);
                                        }}
                                        onDragEnd={() => { setDraggingFolderId(null); setDragOverFolder(null); }}
                                        className={`group flex items-center gap-1.5 px-2 py-1.5 cursor-grab active:cursor-grabbing ${draggingFolderId === f.id ? 'opacity-40' : ''}`}
                                    >
                                        <button
                                            onClick={() => toggleFolder(f.id)}
                                            className="shrink-0 text-slate-400 hover:text-slate-700 transition-colors"
                                            title={folderOpen ? 'Collapse folder' : 'Expand folder'}
                                        >
                                            {folderOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                        </button>
                                        <Folder className="w-3.5 h-3.5 text-[#0e5a6e] shrink-0" />
                                        {renamingFolderId === f.id ? (
                                            <input
                                                autoFocus
                                                value={folderRenameDraft}
                                                onChange={e => setFolderRenameDraft(e.target.value)}
                                                onBlur={() => commitFolderRename(f.id)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') commitFolderRename(f.id);
                                                    if (e.key === 'Escape') setRenamingFolderId(null);
                                                }}
                                                className="flex-1 min-w-0 text-[12px] bg-white border border-[#9fcdd6] rounded px-1 py-0.5 focus:outline-none"
                                            />
                                        ) : (
                                            <h4 className="flex-1 min-w-0 truncate text-[12px] font-semibold text-slate-700">{f.name}</h4>
                                        )}
                                        <span className="text-[10px] text-slate-400 tabular-nums shrink-0">{cells.length}</span>
                                        <button
                                            onClick={() => setEditor({ id: null, title: '', content: '', folderId: f.id })}
                                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-[#0e5a6e] transition-all shrink-0"
                                            title="New cell in this folder"
                                        >
                                            <Plus className="w-3 h-3" />
                                        </button>
                                        <button
                                            onClick={() => { setRenamingFolderId(f.id); setFolderRenameDraft(f.name); }}
                                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 transition-all shrink-0"
                                            title="Rename folder"
                                        >
                                            <Pencil className="w-3 h-3" />
                                        </button>
                                        <button
                                            onClick={() => deleteFolder(f.id)}
                                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all shrink-0"
                                            title="Delete folder (cells move to root)"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                    {folderOpen && (
                                        <div className="pl-3 pr-1.5 pb-2 ml-2 border-l border-slate-200 space-y-1.5 min-h-[8px]">
                                            {cells.length === 0 ? (
                                                <p className="text-[10.5px] text-slate-400 py-1 pl-1">Drop cells here</p>
                                            ) : cells.map(renderCell)}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Root bucket (drop target) */}
                        <div
                            {...dropZoneProps('root')}
                            className={`rounded-xl transition-colors space-y-2 ${dragOverFolder === 'root' ? 'ring-1 ring-[#0e5a6e]/30 bg-[#e8f6f9]/50 p-1' : ''}`}
                        >
                            {folders.length > 0 && rootCells.length > 0 && (
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-1 pt-1">Ungrouped</div>
                            )}
                            {rootCells.map(renderCell)}
                            {folders.length > 0 && rootCells.length === 0 && draggingCellId != null && (
                                <p className="text-[10.5px] text-slate-400 py-2 text-center border border-dashed border-slate-300 rounded-lg">Drop here to remove from folder</p>
                            )}
                        </div>
                    </div>
                </section>

                {/* Circuit */}
                <section className="w-[360px] shrink-0 overflow-y-auto">
                    <div className="px-5 py-5">
                        <div className="flex items-center gap-1.5 mb-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                            <Zap className="w-3.5 h-3.5" />
                            Circuit {selected ? `· ${selected.name}` : ''}
                        </div>

                        {!selected ? (
                            <div className="rounded-2xl border border-dashed border-stone-300 py-16 text-center">
                                <PenLine className="w-7 h-7 text-stone-300 mx-auto mb-2" />
                                <p className="text-[12.5px] text-stone-500">Select or create a version on the left.</p>
                            </div>
                        ) : chain.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-stone-300 py-16 text-center">
                                <BatteryCharging className="w-7 h-7 text-stone-300 mx-auto mb-2" />
                                <p className="text-[12.5px] text-stone-500">Empty circuit.</p>
                                <p className="text-[11.5px] text-stone-400 mt-1">Plug in cells from the library to build this letter.</p>
                            </div>
                        ) : (
                            <div className="relative">
                                {/* the wire */}
                                <div className="absolute left-[13px] top-3 bottom-3 w-[2px] bg-amber-300 rounded-full" />
                                <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleChainDragEnd}>
                                    <SortableContext items={chain.map(b => b.id)} strategy={verticalListSortingStrategy}>
                                        <div className="space-y-3">
                                            {chain.map((b, i) => (
                                                <SortableCell
                                                    key={b.id}
                                                    block={b}
                                                    index={i}
                                                    total={chain.length}
                                                    onMove={move}
                                                    onUnplug={unplug}
                                                />
                                            ))}
                                        </div>
                                    </SortableContext>
                                </DndContext>
                            </div>
                        )}
                    </div>
                </section>
            </div>

            {/* ——— Right: full text ——— */}
            <aside className="flex-1 min-w-0 border-l border-[var(--border)] bg-white flex flex-col min-h-0">
                <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-stone-100">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        <FileText className="w-3.5 h-3.5" />
                        Full text
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10.5px] text-slate-400 tabular-nums">
                            {wordCount} words
                            {fullText && (
                                <span className={pdfPagination.pages > 1 ? 'text-amber-600 font-semibold' : ''}>
                                    {' '}· {pdfPagination.pages} A4 page{pdfPagination.pages > 1 ? 's' : ''}
                                </span>
                            )}
                        </span>
                        <button
                            onClick={() => setColorized(c => !c)}
                            disabled={!fullText}
                            title="Highlight paragraphs with their circuit colors"
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                                ${colorized
                                    ? 'border-amber-300 bg-amber-100 text-amber-800'
                                    : 'border-[#bfe0e6] text-[#0e5a6e] hover:bg-[#e8f6f9]'}`}
                        >
                            <Highlighter className="w-3 h-3" />
                            Colors
                        </button>
                        <button
                            onClick={copyText}
                            disabled={!fullText}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border border-[#bfe0e6] text-[#0e5a6e] hover:bg-[#e8f6f9] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {copied ? 'Copied' : 'Copy'}
                        </button>
                        <button
                            onClick={exportPdf}
                            disabled={!fullText}
                            title="Export as PDF (via print dialog)"
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border border-[#bfe0e6] text-[#0e5a6e] hover:bg-[#e8f6f9] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            <FileDown className="w-3 h-3" />
                            PDF
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    {fullText ? (
                        <div className="max-w-2xl text-[13px] leading-relaxed text-stone-800 font-serif">
                            {chain.filter(b => b.content.trim()).map((b, i) => (
                                <Fragment key={b.id}>
                                    <p
                                        className={`whitespace-pre-wrap mb-4 last:mb-0 transition-colors rounded-md ${colorized ? 'px-2 py-1 -mx-2' : ''}`}
                                        style={colorized ? { backgroundColor: colorFor(b.id).bg } : undefined}
                                    >
                                        {b.content.trim()}
                                    </p>
                                    {pdfPagination.breaks.has(i) && (
                                        <div
                                            className="my-4 flex items-center gap-2 select-none"
                                            title="Approximate A4 page break in the exported PDF"
                                        >
                                            <div className="flex-1 border-t border-dashed border-amber-400" />
                                            <span className="text-[9.5px] uppercase tracking-wider text-amber-600 font-sans whitespace-nowrap">
                                                A4 · page {pdfPagination.breaks.get(i)!.page} ends{pdfPagination.breaks.get(i)!.mid ? ' inside the paragraph above' : ''}
                                            </span>
                                            <div className="flex-1 border-t border-dashed border-amber-400" />
                                        </div>
                                    )}
                                </Fragment>
                            ))}
                        </div>
                    ) : (
                        <p className="text-[12px] text-slate-400 pt-4 text-center">The assembled letter appears here.</p>
                    )}
                </div>
            </aside>

            {/* ——— AI cell generation modal ——— */}
            {aiGen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/30 backdrop-blur-[2px]" onClick={() => !aiLoading && setAiGen(null)}>
                    <div
                        className="w-full max-w-lg mx-4 bg-white rounded-2xl shadow-xl border border-stone-200 p-5"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5">
                                <Sparkles className="w-4 h-4 text-[#0e5a6e]" />
                                <h3 className="text-[14px] font-semibold text-stone-900 tracking-tight">Generate cell with AI</h3>
                            </div>
                            <button onClick={() => !aiLoading && setAiGen(null)} className="text-slate-400 hover:text-slate-700 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-[11.5px] text-slate-500 leading-relaxed mb-3">
                            Describe the paragraph — the AI drafts it, then it opens in the editor so you can review and adjust before saving.
                        </p>
                        {aiError && (
                            <div className="mb-3 bg-rose-50 text-rose-600 px-2.5 py-2 rounded-lg text-[11.5px] font-medium border border-rose-100">
                                {aiError}
                            </div>
                        )}
                        <textarea
                            autoFocus
                            value={aiGen.description}
                            onChange={e => setAiGen({ ...aiGen, description: e.target.value })}
                            placeholder={"e.g. A paragraph explaining why I want to work on developer tools — mention my 3 years of React experience and my love for clean APIs."}
                            rows={6}
                            className="w-full text-[13px] leading-relaxed px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0e5a6e]/15 focus:border-[#9fcdd6] placeholder:text-slate-400 resize-y"
                        />
                        <div className="mt-2.5 flex items-center gap-2">
                            <span className="text-[11.5px] text-slate-500">Length</span>
                            <input
                                type="number"
                                min={1}
                                value={aiGen.minWords}
                                onChange={e => setAiGen({ ...aiGen, minWords: e.target.value })}
                                placeholder="auto"
                                className="w-16 text-[12px] px-2 py-1 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0e5a6e]/15 focus:border-[#9fcdd6] placeholder:text-slate-400 text-center"
                            />
                            <span className="text-[11.5px] text-slate-400">–</span>
                            <input
                                type="number"
                                min={1}
                                value={aiGen.maxWords}
                                onChange={e => setAiGen({ ...aiGen, maxWords: e.target.value })}
                                placeholder="auto"
                                className="w-16 text-[12px] px-2 py-1 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0e5a6e]/15 focus:border-[#9fcdd6] placeholder:text-slate-400 text-center"
                            />
                            <span className="text-[11px] text-slate-400">字 / words — clear both and the AI decides</span>
                        </div>
                        <div className="mt-3.5 flex justify-end gap-2">
                            <button
                                onClick={() => setAiGen(null)}
                                disabled={aiLoading}
                                className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={generateCell}
                                disabled={aiLoading || aiGen.description.trim().length < 3}
                                className="px-3.5 py-1.5 rounded-lg text-[12px] font-medium text-white bg-[#0e5a6e] hover:bg-[#0c4c5d] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                            >
                                {aiLoading ? (
                                    <><span className="animate-spin rounded-full h-3 w-3 border-2 border-white/40 border-t-white" /> Generating…</>
                                ) : (
                                    <><Sparkles className="w-3 h-3" /> Generate</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ——— Cell editor modal ——— */}
            {/* No backdrop-click dismiss: losing a half-written cell to a stray click is worse than an extra Cancel. */}
            {editor && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/30 backdrop-blur-[2px]">
                    <div className="w-full max-w-lg mx-4 bg-white rounded-2xl shadow-xl border border-stone-200 p-5">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-[14px] font-semibold text-stone-900 tracking-tight">
                                {editor.id == null ? 'New cell' : 'Edit cell'}
                            </h3>
                            <button onClick={() => setEditor(null)} className="text-slate-400 hover:text-slate-700 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <input
                            autoFocus
                            value={editor.title}
                            onChange={e => setEditor({ ...editor, title: e.target.value })}
                            placeholder="Cell name — e.g. Intro, Why this company, Closing"
                            className="w-full text-[13px] px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0e5a6e]/15 focus:border-[#9fcdd6] placeholder:text-slate-400"
                        />
                        <textarea
                            value={editor.content}
                            onChange={e => setEditor({ ...editor, content: e.target.value })}
                            placeholder="Paragraph text…"
                            rows={8}
                            className="mt-2.5 w-full text-[13px] leading-relaxed px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0e5a6e]/15 focus:border-[#9fcdd6] placeholder:text-slate-400 resize-y"
                        />
                        <div className="mt-3 flex justify-end gap-2">
                            <button
                                onClick={() => setEditor(null)}
                                className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={saveBlock}
                                disabled={!editor.title.trim()}
                                className="px-3.5 py-1.5 rounded-lg text-[12px] font-medium text-white bg-[#0e5a6e] hover:bg-[#0c4c5d] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
