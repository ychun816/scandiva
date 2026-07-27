import { useEffect, useState } from 'react';
import { X, ExternalLink, Calendar, Building2, Globe, FileText, Pencil, Save, Upload, File, Trash2, Star, DollarSign, Archive, ArchiveRestore, PenLine, FileDown } from 'lucide-react';
import { Application, LetterBlock, LetterVersion } from '../types';
import axios from 'axios';
import { StageTimeline } from './StageTimeline';
import { downloadLetterPdf } from '../lib/letterPdf';

interface ApplicationDetailsModalProps {
    application: Application;
    onClose: () => void;
    onUpdate: (id: number, data: Partial<Application>) => void;
    onDelete: (id: number) => void;
    onOpenLetters?: (versionId: number) => void;
}

export function ApplicationDetailsModal({ application, onClose, onUpdate, onDelete, onOpenLetters }: ApplicationDetailsModalProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        company: application.company,
        position: application.position,
        link: application.link || '',
        platform: application.platform || '',
        notes: application.notes || '',
        status: application.status,
        salary: application.salary || '',
        contractType: application.contractType || '',
    });
    const [cvFile, setCvFile] = useState<File | null>(null);
    const [coverLetterFile, setCoverLetterFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [stages, setStages] = useState(application.stages || []);
    const [letterVersions, setLetterVersions] = useState<LetterVersion[]>([]);

    useEffect(() => {
        axios.get('/api/letter-versions')
            .then(res => setLetterVersions(res.data))
            .catch(e => console.error('Failed to load letter versions', e));
    }, []);

    const linkedVersion = letterVersions.find(v => v.id === application.letterVersionId) || null;

    const handleLinkLetterVersion = async (raw: string) => {
        const id = raw ? Number(raw) : null;
        try {
            await axios.put(`/api/applications/${application.id}/letter-version`, { letterVersionId: id });
            onUpdate(application.id, { letterVersionId: id });
        } catch (error) {
            console.error('Failed to link letter version', error);
            alert('Failed to link the letter version. Please try again.');
        }
    };

    const downloadLetterVersionPdf = async () => {
        if (!linkedVersion) return;
        try {
            const res = await axios.get('/api/letter-blocks');
            const byId = new Map<number, LetterBlock>(res.data.map((b: LetterBlock) => [b.id, b]));
            const paragraphs = linkedVersion.blockIds.map(id => byId.get(id)?.content || '');
            downloadLetterPdf(`${application.company}-${linkedVersion.name}`, paragraphs);
        } catch (error) {
            console.error('Failed to export letter PDF', error);
            alert('Failed to export the letter PDF. Please try again.');
        }
    };

    const fetchStages = async () => {
        try {
            const res = await axios.get(`/api/applications/${application.id}/stages`);
            setStages(res.data);
            // Propagate changes to parent to update Calendar/Board
            onUpdate(application.id, { stages: res.data });
        } catch (error) {
            console.error('Failed to fetch stages', error);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Rejected': return 'bg-rose-50 text-rose-600 border-rose-100';
            case 'Offer': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
            case 'Interviewing': return 'bg-violet-50 text-violet-700 border-violet-100';
            case 'Applied': return 'bg-blue-50 text-blue-700 border-blue-100';
            case 'Archived': return 'bg-amber-50 text-amber-700 border-amber-100';
            default: return 'bg-stone-100 text-stone-600 border-stone-200';
        }
    };

    const handleSave = async () => {
        setIsUploading(true);
        try {
            // 1. Update text fields first
            onUpdate(application.id, formData);

            // 2. Upload files if selected
            if (cvFile || coverLetterFile) {
                const uploadData = new FormData();
                if (cvFile) uploadData.append('cv', cvFile);
                if (coverLetterFile) uploadData.append('coverLetter', coverLetterFile);

                const res = await axios.post(`/api/applications/${application.id}/upload`, uploadData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });

                // Update local state with new file paths from response
                onUpdate(application.id, {
                    cv: res.data.cv,
                    coverLetter: res.data.coverLetter
                });
            }
            setIsEditing(false);
        } catch (error) {
            console.error('Failed to save changes', error);
            alert('Failed to save changes. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-[#0e4a58]/25 flex items-center justify-center z-50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-pop border border-stone-200 w-full max-w-lg overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-stone-100 flex justify-between items-center">
                    <h2 className="text-[15px] font-semibold text-stone-900">
                        {isEditing ? 'Edit application' : 'Application details'}
                    </h2>
                    <div className="flex items-center gap-2">
                        {!isEditing && (
                            <>
                                <button
                                    onClick={() => onUpdate(application.id, { isStarred: !application.isStarred })}
                                    className={`p-2 rounded-lg transition-all ${application.isStarred
                                        ? 'text-amber-500 bg-amber-50 hover:bg-amber-100'
                                        : 'text-stone-400 hover:text-amber-500 hover:bg-amber-50'
                                        }`}
                                    title={application.isStarred ? 'Unstar' : 'Star'}
                                >
                                    <Star className={`w-5 h-5 ${application.isStarred ? 'fill-amber-500' : ''}`} />
                                </button>
                                <button
                                    onClick={() => onUpdate(application.id, { isArchived: !application.isArchived })}
                                    className={`p-2 rounded-lg transition-colors ${application.isArchived
                                        ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                                        : 'text-stone-400 hover:text-amber-600 hover:bg-amber-50'}`}
                                    title={application.isArchived ? 'Unarchive' : 'Archive'}
                                >
                                    {application.isArchived ? <ArchiveRestore className="w-5 h-5" /> : <Archive className="w-5 h-5" />}
                                </button>
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="p-2 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors"
                                    title="Edit"
                                >
                                    <Pencil className="w-5 h-5" />
                                </button>
                            </>
                        )}
                        <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto">
                    {isEditing ? (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-1">Company</label>
                                <input
                                    type="text"
                                    value={formData.company}
                                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                                    className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#0e5a6e]/15 focus:border-[#9fcdd6] outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-1">Position</label>
                                <input
                                    type="text"
                                    value={formData.position}
                                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                                    className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#0e5a6e]/15 focus:border-[#9fcdd6] outline-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-stone-700 mb-1">Status</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#0e5a6e]/15 focus:border-[#9fcdd6] outline-none bg-white"
                                    >
                                        <option value="To Apply">To Apply</option>
                                        <option value="Applied">Applied</option>
                                        <option value="Interviewing">Interviewing</option>
                                        <option value="Offer">Offer</option>
                                        <option value="Rejected">Rejected</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-stone-700 mb-1">Platform</label>
                                    <input
                                        type="text"
                                        value={formData.platform}
                                        onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                                        className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#0e5a6e]/15 focus:border-[#9fcdd6] outline-none"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-stone-700 mb-1">Contract Type</label>
                                    <select
                                        value={formData.contractType}
                                        onChange={(e) => setFormData({ ...formData, contractType: e.target.value })}
                                        className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#0e5a6e]/15 focus:border-[#9fcdd6] outline-none bg-white"
                                    >
                                        <option value="">Select Type</option>
                                        <option value="Full-time">Full-time</option>
                                        <option value="Part-time">Part-time</option>
                                        <option value="Contract">Contract</option>
                                        <option value="CDI">CDI (permanent)</option>
                                        <option value="CDD">CDD (fixed-term)</option>
                                        <option value="Intern">Intern</option>
                                        <option value="Freelance">Freelance</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-stone-700 mb-1">Job Link</label>
                                    <input
                                        type="url"
                                        value={formData.link}
                                        onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                                        className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#0e5a6e]/15 focus:border-[#9fcdd6] outline-none"
                                    />
                                </div>
                            </div>

                            {/* File Uploads */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-stone-700 mb-1">CV / Resume</label>
                                    <div className="relative">
                                        <input
                                            type="file"
                                            onChange={(e) => setCvFile(e.target.files ? e.target.files[0] : null)}
                                            className="hidden"
                                            id="cv-upload"
                                            accept=".pdf,.doc,.docx"
                                        />
                                        <label
                                            htmlFor="cv-upload"
                                            className="flex items-center justify-center gap-2 w-full px-3 py-2 border border-dashed border-stone-300 rounded-lg cursor-pointer hover:bg-stone-50 transition-colors text-sm text-stone-600"
                                        >
                                            <Upload className="w-4 h-4" />
                                            {cvFile ? cvFile.name : (application.cv ? 'Change CV' : 'Upload CV')}
                                        </label>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-stone-700 mb-1">Cover Letter</label>
                                    <div className="relative">
                                        <input
                                            type="file"
                                            onChange={(e) => setCoverLetterFile(e.target.files ? e.target.files[0] : null)}
                                            className="hidden"
                                            id="cl-upload"
                                            accept=".pdf,.doc,.docx"
                                        />
                                        <label
                                            htmlFor="cl-upload"
                                            className="flex items-center justify-center gap-2 w-full px-3 py-2 border border-dashed border-stone-300 rounded-lg cursor-pointer hover:bg-stone-50 transition-colors text-sm text-stone-600"
                                        >
                                            <Upload className="w-4 h-4" />
                                            {coverLetterFile ? coverLetterFile.name : (application.coverLetter ? 'Change CL' : 'Upload CL')}
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-1">Salary</label>
                                <input
                                    type="text"
                                    value={formData.salary}
                                    onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                                    className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#0e5a6e]/15 focus:border-[#9fcdd6] outline-none"
                                    placeholder="e.g. 80k-100k or Not mentioned"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-1">Notes</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    rows={4}
                                    className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#0e5a6e]/15 focus:border-[#9fcdd6] outline-none resize-none"
                                />
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Header Info */}
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="text-xl font-semibold text-stone-900 tracking-tight">{application.position}</h3>
                                    <div className="flex items-center gap-2 text-stone-500 mt-1 text-[13px]">
                                        <Building2 className="w-4 h-4" />
                                        <span className="font-medium">{application.company}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {application.isArchived && (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-medium border bg-amber-50 text-amber-700 border-amber-100">
                                            <Archive className="w-3 h-3" />
                                            Archived
                                        </span>
                                    )}
                                    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(application.status)}`}>
                                        {application.status}
                                    </span>
                                </div>
                            </div>

                            {/* Grid Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-stone-50 rounded-lg border border-stone-100">
                                    <div className="flex items-center gap-2 text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">
                                        <Globe className="w-3 h-3" />
                                        Platform
                                    </div>
                                    <div className="text-stone-800 font-medium">
                                        {application.platform || 'N/A'}
                                    </div>
                                </div>
                                <div className="p-3 bg-stone-50 rounded-lg border border-stone-100">
                                    <div className="flex items-center gap-2 text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">
                                        <Calendar className="w-3 h-3" />
                                        Applied Date
                                    </div>
                                    <div className="text-stone-800 font-medium">
                                        {new Date(application.appliedDate).toLocaleDateString()}
                                    </div>
                                </div>
                                {application.salary && (
                                    <div className="p-3 bg-stone-50 rounded-lg border border-stone-100">
                                        <div className="flex items-center gap-2 text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">
                                            <DollarSign className="w-3 h-3" />
                                            Salary
                                        </div>
                                        <div className="text-stone-800 font-medium">
                                            {application.salary}
                                        </div>
                                    </div>
                                )}
                                {application.contractType && (
                                    <div className="p-3 bg-stone-50 rounded-lg border border-stone-100">
                                        <div className="flex items-center gap-2 text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">
                                            <Building2 className="w-3 h-3" />
                                            Type
                                        </div>
                                        <div className="text-stone-800 font-medium">
                                            {application.contractType}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Motivation letter — link one of the Letters versions */}
                            <div>
                                <h4 className="text-sm font-medium text-stone-700 mb-2 flex items-center gap-2">
                                    <PenLine className="w-4 h-4" />
                                    Motivation letter
                                </h4>
                                <div className="flex items-center gap-2">
                                    <select
                                        value={application.letterVersionId ?? ''}
                                        onChange={(e) => handleLinkLetterVersion(e.target.value)}
                                        className="flex-1 min-w-0 px-3 py-2 border border-stone-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#0e5a6e]/15 focus:border-[#9fcdd6] outline-none"
                                    >
                                        <option value="">None</option>
                                        {letterVersions.map(v => (
                                            <option key={v.id} value={v.id}>{v.name}</option>
                                        ))}
                                    </select>
                                    {linkedVersion && (
                                        <>
                                            <button
                                                onClick={() => onOpenLetters?.(linkedVersion.id)}
                                                title="Open in Letters"
                                                className="p-2 rounded-lg border border-stone-200 text-stone-500 hover:text-[#0e5a6e] hover:bg-[#e8f6f9] transition-colors shrink-0"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={downloadLetterVersionPdf}
                                                title="Download as PDF"
                                                className="p-2 rounded-lg border border-stone-200 text-stone-500 hover:text-[#0e5a6e] hover:bg-[#e8f6f9] transition-colors shrink-0"
                                            >
                                                <FileDown className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Documents */}
                            {(application.cv || application.coverLetter) && (
                                <div>
                                    <h4 className="text-sm font-medium text-stone-700 mb-2 flex items-center gap-2">
                                        <File className="w-4 h-4" />
                                        Documents
                                    </h4>
                                    <div className="flex gap-3">
                                        {application.cv && (
                                            <a
                                                href={`/api${application.cv}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-700 hover:bg-stone-100 hover:text-stone-800 transition-colors"
                                            >
                                                <FileText className="w-4 h-4" />
                                                View CV
                                            </a>
                                        )}
                                        {application.coverLetter && (
                                            <a
                                                href={`/api${application.coverLetter}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-700 hover:bg-stone-100 hover:text-stone-800 transition-colors"
                                            >
                                                <FileText className="w-4 h-4" />
                                                View Cover Letter
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Link */}
                            {application.link && (
                                <div>
                                    <h4 className="text-sm font-medium text-stone-700 mb-2 flex items-center gap-2">
                                        <ExternalLink className="w-4 h-4" />
                                        Job Link
                                    </h4>
                                    <a
                                        href={application.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[#0e5a6e] hover:text-[#0c4c5d] hover:underline break-all text-sm"
                                    >
                                        {application.link}
                                    </a>
                                </div>
                            )}

                            {/* Notes */}
                            <div>
                                <h4 className="text-sm font-medium text-stone-700 mb-2 flex items-center gap-2">
                                    <FileText className="w-4 h-4" />
                                    Notes
                                </h4>
                                <div className="bg-stone-50 p-4 rounded-lg border border-stone-200 text-stone-700 text-sm whitespace-pre-wrap">
                                    {application.notes || 'No notes added.'}
                                </div>
                            </div>

                            {/* Application Stages */}
                            {!isEditing && (
                                <div className="border-t border-stone-200 pt-6">
                                    <StageTimeline
                                        applicationId={application.id}
                                        stages={stages}
                                        onStagesUpdate={fetchStages}
                                    />
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="px-6 py-4 bg-stone-50 border-t border-stone-100 flex justify-between gap-3">
                    {/* Delete button on the left */}
                    {!isEditing && (
                        <button
                            onClick={() => {
                                if (window.confirm(`Are you sure you want to delete the application for ${application.company}?`)) {
                                    onDelete(application.id);
                                    onClose();
                                }
                            }}
                            className="px-4 py-2 text-[13px] bg-rose-50 border border-rose-100 hover:bg-rose-100 text-rose-600 rounded-lg font-medium transition-colors flex items-center gap-2"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete
                        </button>
                    )}

                    {/* Action buttons on the right */}
                    <div className="flex gap-3 ml-auto">
                        {isEditing ? (
                            <>
                                <button
                                    onClick={() => setIsEditing(false)}
                                    className="px-4 py-2 bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 rounded-lg font-medium transition-colors"
                                    disabled={isUploading}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isUploading}
                                    className="px-4 py-2 bg-[#0e5a6e] hover:bg-[#0c4c5d] text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isUploading ? (
                                        'Saving...'
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4" />
                                            Save Changes
                                        </>
                                    )}
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={onClose}
                                className="px-4 py-2 bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 rounded-lg font-medium transition-colors"
                            >
                                Close
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
