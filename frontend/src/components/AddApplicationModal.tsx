import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Application } from '../types';

interface AddApplicationModalProps {
    onClose: () => void;
    onAdd: (app: Omit<Application, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

export function AddApplicationModal({ onClose, onAdd }: AddApplicationModalProps) {
    const [formData, setFormData] = useState({
        company: '',
        position: '',
        link: '',
        platform: '',
        status: 'To Apply',
        notes: '',
        salary: '',
        isStarred: false,
        contractType: '',
        resumeId: undefined as number | undefined,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onAdd({
            ...formData,
            isArchived: false,
            appliedDate: new Date().toISOString(),
        });
    };

    return (
        <div className="fixed inset-0 bg-stone-900/30 flex items-center justify-center z-50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-pop border border-stone-200 w-full max-w-md overflow-hidden animate-fade-in">
                <div className="px-6 py-4 border-b border-stone-100 flex justify-between items-center">
                    <h2 className="text-[15px] font-semibold text-stone-900">Add new application</h2>
                    <button onClick={onClose} className="text-stone-400 hover:text-stone-600 transition-colors">
                        <X className="w-[18px] h-[18px]" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-[13px] font-medium text-stone-600 mb-1.5">Company</label>
                        <input
                            required
                            type="text"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300 transition-all text-[14px]"
                            value={formData.company}
                            onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                            placeholder="e.g. Google"
                        />
                    </div>

                    <div>
                        <label className="block text-[13px] font-medium text-stone-600 mb-1.5">Position</label>
                        <input
                            required
                            type="text"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300 transition-all text-[14px]"
                            value={formData.position}
                            onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                            placeholder="e.g. Senior Frontend Engineer"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[13px] font-medium text-stone-600 mb-1.5">Platform</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300 transition-all text-[14px]"
                                value={formData.platform}
                                onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                                placeholder="e.g. LinkedIn"
                            />
                        </div>
                        <div>
                            <label className="block text-[13px] font-medium text-stone-600 mb-1.5">Status</label>
                            <select
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300 transition-all text-[14px] bg-white"
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            >
                                <option value="To Apply">To Apply</option>
                                <option value="Applied">Applied</option>
                                <option value="Interviewing">Interviewing</option>
                                <option value="Offer">Offer</option>
                                <option value="Rejected">Rejected</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-[13px] font-medium text-stone-600 mb-1.5">Job Link</label>
                        <input
                            type="url"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300 transition-all text-[14px]"
                            value={formData.link}
                            onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                            placeholder="https://..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[13px] font-medium text-stone-600 mb-1.5">Salary</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300 transition-all text-[14px]"
                                value={formData.salary}
                                onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                                placeholder="e.g. 80k-100k"
                            />
                        </div>
                        <div>
                            <label className="block text-[13px] font-medium text-stone-600 mb-1.5">Contract Type</label>
                            <select
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300 transition-all text-[14px] bg-white"
                                value={formData.contractType}
                                onChange={(e) => setFormData({ ...formData, contractType: e.target.value })}
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
                    </div>

                    <div>
                        <label className="block text-[13px] font-medium text-stone-600 mb-1.5">Notes</label>
                        <textarea
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300 transition-all text-[14px] resize-none h-24"
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Contact person, interview details, etc."
                        />
                    </div>

                    <div className="pt-2 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-[13px] text-stone-600 hover:bg-stone-100 rounded-lg font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-[13px] bg-stone-900 hover:bg-stone-800 text-white rounded-lg font-medium transition-colors"
                        >
                            Add application
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
