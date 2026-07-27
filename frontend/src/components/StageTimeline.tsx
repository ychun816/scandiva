import { ApplicationStage } from '../types';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import axios from 'axios';

interface StageTimelineProps {
    applicationId: number;
    stages: ApplicationStage[];
    onStagesUpdate: () => void;
}

export function StageTimeline({ applicationId, stages, onStagesUpdate }: StageTimelineProps) {
    const [isAdding, setIsAdding] = useState(false);
    const [formData, setFormData] = useState({
        stageName: '',
        status: 'upcoming' as 'passed' | 'failed' | 'upcoming',
        date: new Date().toISOString().split('T')[0],
        notes: '',
    });

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'passed': return '🟢';
            case 'failed': return '🔴';
            case 'upcoming': return '🟡';
            default: return '⚪';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'passed': return 'Passed';
            case 'failed': return 'Failed';
            case 'upcoming': return 'Upcoming';
            default: return status;
        }
    };

    const handleAdd = async () => {
        try {
            await axios.post(`/api/applications/${applicationId}/stages`, formData);
            setFormData({ stageName: '', status: 'upcoming', date: new Date().toISOString().split('T')[0], notes: '' });
            setIsAdding(false);
            onStagesUpdate();
        } catch (error) {
            console.error('Failed to add stage', error);
            alert('Failed to add stage');
        }
    };

    const handleDelete = async (stageId: number) => {
        if (!window.confirm('Are you sure you want to delete this stage?')) return;
        try {
            await axios.delete(`/api/stages/${stageId}`);
            onStagesUpdate();
        } catch (error) {
            console.error('Failed to delete stage', error);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-800">Application Stages</h4>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Add Stage
                </button>
            </div>

            {/* Add Stage Form */}
            {isAdding && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Stage Name</label>
                            <input
                                type="text"
                                value={formData.stageName}
                                onChange={(e) => setFormData({ ...formData, stageName: e.target.value })}
                                placeholder="e.g., HR Interview"
                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                            <select
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                            >
                                <option value="upcoming">🟡 Upcoming</option>
                                <option value="passed">🟢 Passed</option>
                                <option value="failed">🔴 Failed</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
                        <input
                            type="date"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Notes (Optional)</label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Additional details..."
                            rows={2}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                        />
                    </div>
                    <div className="flex gap-2 justify-end">
                        <button
                            onClick={() => setIsAdding(false)}
                            className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleAdd}
                            disabled={!formData.stageName}
                            className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Add Stage
                        </button>
                    </div>
                </div>
            )}

            {/* Timeline */}
            <div className="space-y-3">
                {stages.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-sm">
                        No stages yet. Click "Add Stage" to track your progress.
                    </div>
                ) : (
                    stages.map((stage, index) => (
                        <div key={stage.id} className="flex gap-3">
                            {/* Timeline Line */}
                            <div className="flex flex-col items-center">
                                <div className="text-2xl">{getStatusIcon(stage.status)}</div>
                                {index < stages.length - 1 && (
                                    <div className="w-0.5 h-full bg-slate-200 mt-1"></div>
                                )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 pb-4">
                                <div className="bg-white border border-slate-200 rounded-xl p-3 hover:shadow-md transition-shadow">
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <h5 className="font-bold text-slate-900 text-sm">{stage.stageName}</h5>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                {new Date(stage.date).toLocaleDateString()} • {getStatusText(stage.status)}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleDelete(stage.id)}
                                            className="text-slate-400 hover:text-red-600 transition-colors p-1"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    {stage.notes && (
                                        <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-2 rounded-lg">
                                            {stage.notes}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
