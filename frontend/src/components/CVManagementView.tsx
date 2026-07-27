import { useState, useEffect } from 'react';
import { Upload, Download, Trash2, Edit2, FileText, X, Check, Eye } from 'lucide-react';
import axios from 'axios';
import { Resume } from '../types';

export function CVManagementView() {
    const [resumes, setResumes] = useState<Resume[]>([]);
    const [uploading, setUploading] = useState(false);
    const [newResumeName, setNewResumeName] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');
    const [previewResume, setPreviewResume] = useState<Resume | null>(null);

    useEffect(() => {
        fetchResumes();
    }, []);

    const fetchResumes = async () => {
        try {
            const response = await axios.get('/api/resumes');
            setResumes(response.data);
        } catch (error) {
            console.error('Failed to fetch resumes:', error);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile || !newResumeName.trim()) {
            alert('Please select a file and enter a name');
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('name', newResumeName.trim());

        try {
            await axios.post('/api/resumes', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setSelectedFile(null);
            setNewResumeName('');
            fetchResumes();
        } catch (error) {
            console.error('Upload failed:', error);
            alert('Failed to upload resume');
        } finally {
            setUploading(false);
        }
    };

    const handleDownload = async (resume: Resume) => {
        try {
            const response = await axios.get(`/api/resumes/${resume.id}/download`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', resume.fileName);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Download failed:', error);
            alert('Failed to download resume');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this resume?')) return;

        try {
            await axios.delete(`/api/resumes/${id}`);
            if (previewResume?.id === id) setPreviewResume(null);
            fetchResumes();
        } catch (error) {
            console.error('Delete failed:', error);
            alert('Failed to delete resume');
        }
    };

    const handleRename = async (id: number) => {
        if (!editName.trim()) return;

        try {
            await axios.put(`/api/resumes/${id}`, { name: editName.trim() });
            setEditingId(null);
            setEditName('');
            fetchResumes();
        } catch (error) {
            console.error('Rename failed:', error);
            alert('Failed to rename resume');
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const getFileIcon = (fileName: string) => {
        const ext = fileName.split('.').pop()?.toLowerCase();
        if (ext === 'pdf') return '📄';
        if (ext === 'doc' || ext === 'docx') return '📝';
        return '📋';
    };

    // On-brand teal cards — white surface with a teal accent border, matching the board.
    const getResumeGradient = (_id: number) => {
        return 'bg-white/80 backdrop-blur-sm border-slate-200/70 hover:border-[#9fcdd6] shadow-card';
    };

    return (
        <div className="flex h-full overflow-hidden board-surface">
            {/* Left Panel - Resume List */}
            <div className="w-1/3 h-full flex flex-col bg-white/60 backdrop-blur-sm border-r border-slate-200/70">
                <div className="p-5 space-y-4 overflow-y-auto flex-1">
                    {/* Header */}
                    <div>
                        <h2 className="text-xl font-semibold text-[#0e4a58]">CV Library</h2>
                        <p className="text-slate-500 text-[12.5px]">Manage your resume versions</p>
                    </div>

                    {/* Upload Section */}
                    <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl shadow-card border border-slate-200/70">
                        <h3 className="text-[13px] font-semibold text-slate-700 mb-3 flex items-center gap-2">
                            <Upload className="w-4 h-4 text-[#0e5a6e]" />
                            Upload New Resume
                        </h3>
                        <div className="space-y-3">
                            <input
                                type="text"
                                value={newResumeName}
                                onChange={(e) => setNewResumeName(e.target.value)}
                                placeholder="Resume name (e.g., Frontend Developer CV)"
                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0e5a6e]/20 focus:border-[#9fcdd6] outline-none"
                            />

                            {/* Custom File Input */}
                            <div className="relative">
                                <input
                                    type="file"
                                    accept=".pdf,.doc,.docx"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                    id="resume-file-input"
                                />
                                <label
                                    htmlFor="resume-file-input"
                                    className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-sm font-medium text-[#0e5a6e] bg-[#e8f6f9] border-2 border-dashed border-[#9fcdd6] rounded-lg cursor-pointer hover:bg-[#d5eef2] hover:border-[#0e5a6e] transition-all"
                                >
                                    <Upload className="w-4 h-4" />
                                    {selectedFile ? selectedFile.name : 'Choose file (PDF, DOC, DOCX)'}
                                </label>
                            </div>

                            {selectedFile && (
                                <div className="flex items-center justify-between px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                                    <div className="flex items-center gap-2 text-sm text-green-700">
                                        <span className="font-medium">✓ File selected:</span>
                                        <span className="truncate">{selectedFile.name}</span>
                                    </div>
                                    <span className="text-xs text-green-600 font-medium">
                                        {formatFileSize(selectedFile.size)}
                                    </span>
                                </div>
                            )}

                            <button
                                onClick={handleUpload}
                                disabled={uploading || !selectedFile || !newResumeName.trim()}
                                className="w-full px-4 py-2.5 bg-[#0e5a6e] text-white text-sm rounded-lg font-semibold hover:bg-[#0c4c5d] disabled:bg-slate-300 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
                            >
                                {uploading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <span className="animate-spin">⏳</span>
                                        Uploading...
                                    </span>
                                ) : (
                                    'Upload Resume'
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Resume List */}
                    <div className="space-y-2">
                        <h3 className="text-[13px] font-semibold text-slate-700 flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Your Resumes ({resumes.length})
                        </h3>
                        {resumes.length === 0 ? (
                            <p className="text-slate-500 text-sm text-center py-8">No resumes yet</p>
                        ) : (
                            resumes.map((resume) => (
                                <div
                                    key={resume.id}
                                    className={`p-4 border-2 rounded-xl cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5 ${previewResume?.id === resume.id
                                        ? 'ring-2 ring-[#0e5a6e] ring-offset-2 scale-[1.02] -translate-y-0.5'
                                        : ''
                                        } ${getResumeGradient(resume.id)}`}
                                    onClick={() => setPreviewResume(resume)}
                                >
                                    {editingId === resume.id ? (
                                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="text"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="flex-1 px-2 py-1 text-sm border border-[#9fcdd6] rounded focus:ring-2 focus:ring-[#0e5a6e]/20 outline-none"
                                                autoFocus
                                            />
                                            <button
                                                onClick={() => handleRename(resume.id)}
                                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                                            >
                                                <Check className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setEditingId(null);
                                                    setEditName('');
                                                }}
                                                className="p-1 text-slate-600 hover:bg-slate-50 rounded"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex items-center gap-2 flex-1">
                                                    <span className="text-2xl">{getFileIcon(resume.fileName)}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-semibold text-slate-800 text-[15px] truncate">{resume.name}</h4>
                                                        <p className="text-xs text-slate-600 truncate">{resume.fileName}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between text-xs text-slate-600 mb-3">
                                                <span>💾 {formatFileSize(resume.fileSize)}</span>
                                                <span>📅 {new Date(resume.uploadedAt).toLocaleDateString()}</span>
                                            </div>
                                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    onClick={() => handleDownload(resume)}
                                                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
                                                >
                                                    <Download className="w-3 h-3" />
                                                    Download
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setEditingId(resume.id);
                                                        setEditName(resume.name);
                                                    }}
                                                    className="p-1.5 text-slate-700 hover:bg-slate-100 rounded transition-colors"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(resume.id)}
                                                    className="p-1.5 text-red-700 hover:bg-slate-100 rounded transition-colors"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Right Panel - PDF Preview */}
            <div className="flex-1 h-full bg-white flex flex-col">
                {previewResume ? (
                    <>
                        <div className="p-4 border-b border-slate-200 bg-slate-50 flex-shrink-0">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold text-slate-800">{previewResume.name}</h3>
                                    <p className="text-sm text-slate-500">{previewResume.fileName}</p>
                                </div>
                                <button
                                    onClick={() => setPreviewResume(null)}
                                    className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-hidden bg-slate-50 p-4">
                            {previewResume.fileName.toLowerCase().endsWith('.pdf') ? (
                                <div className="h-full w-full flex items-center justify-center">
                                    <iframe
                                        src={`/api${previewResume.filePath}#view=FitH`}
                                        className="w-full h-full border-0 rounded-lg shadow-lg"
                                        title={previewResume.name}
                                    />
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-full text-slate-500">
                                    <div className="text-center">
                                        <FileText className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                                        <p className="text-lg font-semibold mb-2">Preview not available</p>
                                        <p className="text-sm mb-4">DOC/DOCX files cannot be previewed in browser</p>
                                        <button
                                            onClick={() => handleDownload(previewResume)}
                                            className="px-4 py-2 bg-[#0e5a6e] text-white rounded-lg hover:bg-[#0c4c5d] transition-colors"
                                        >
                                            Download to View
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="h-full flex items-center justify-center text-slate-400">
                        <div className="text-center">
                            <Eye className="w-20 h-20 mx-auto mb-4 text-slate-200" />
                            <p className="text-lg font-semibold">Select a resume to preview</p>
                            <p className="text-sm">Click on any resume from the list</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
