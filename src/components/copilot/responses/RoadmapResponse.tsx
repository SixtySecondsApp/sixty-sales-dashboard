/**
 * Roadmap Response Component
 * Displays roadmap item creation results with success confirmation
 */

import React from 'react';
import { CheckCircle2, FileText, Tag, Flag, Calendar } from 'lucide-react';
import { ActionButtons } from '../ActionButtons';
import type { RoadmapResponse, RoadmapItem } from '../types';

interface RoadmapResponseProps {
  data: RoadmapResponse;
  onActionClick?: (action: any) => void;
}

const getTypeColor = (type: string): string => {
  switch (type) {
    case 'feature':
      return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    case 'bug':
      return 'text-red-400 bg-red-500/10 border-red-500/20';
    case 'improvement':
      return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    default:
      return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
  }
};

const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case 'urgent':
      return 'text-red-400';
    case 'high':
      return 'text-amber-400';
    case 'medium':
      return 'text-blue-400';
    case 'low':
      return 'text-gray-400';
    default:
      return 'text-gray-400';
  }
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'submitted':
      return 'text-blue-400 bg-blue-500/20';
    case 'under_review':
      return 'text-amber-400 bg-amber-500/20';
    case 'planned':
      return 'text-purple-400 bg-purple-500/20';
    case 'in_progress':
      return 'text-emerald-400 bg-emerald-500/20';
    case 'completed':
      return 'text-green-400 bg-green-500/20';
    case 'rejected':
      return 'text-red-400 bg-red-500/20';
    default:
      return 'text-gray-400 bg-gray-500/20';
  }
};

const formatDate = (dateString?: string): string => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const RoadmapResponse: React.FC<RoadmapResponseProps> = ({ data, onActionClick }) => {
  const { roadmapItem, success, message } = data.data;

  if (!success) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-300">{data.summary}</p>
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-sm text-red-400">{message || 'Failed to create roadmap item'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <p className="text-sm text-gray-300">{data.summary}</p>

      {/* Success Message */}
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-emerald-400 mb-1">Success!</h4>
          <p className="text-sm text-gray-300">{message}</p>
        </div>
      </div>

      {/* Roadmap Item Details */}
      <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800/50 rounded-lg p-6">
        <div className="space-y-4">
          {/* Title */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-100">{roadmapItem.title}</h3>
            </div>
            {roadmapItem.description && (
              <p className="text-sm text-gray-400 ml-6">{roadmapItem.description}</p>
            )}
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 ml-6">
            {/* Type */}
            <div className="space-y-1">
              <div className="text-xs text-gray-500 flex items-center gap-1">
                <Tag className="w-3 h-3" />
                Type
              </div>
              <div className={`text-sm font-medium px-2 py-1 rounded border ${getTypeColor(roadmapItem.type)}`}>
                {roadmapItem.type}
              </div>
            </div>

            {/* Priority */}
            <div className="space-y-1">
              <div className="text-xs text-gray-500 flex items-center gap-1">
                <Flag className="w-3 h-3" />
                Priority
              </div>
              <div className={`text-sm font-medium ${getPriorityColor(roadmapItem.priority)}`}>
                {roadmapItem.priority}
              </div>
            </div>

            {/* Status */}
            <div className="space-y-1">
              <div className="text-xs text-gray-500">Status</div>
              <div className={`text-sm font-medium px-2 py-1 rounded ${getStatusColor(roadmapItem.status)}`}>
                {roadmapItem.status.replace('_', ' ')}
              </div>
            </div>

            {/* Ticket ID */}
            {roadmapItem.ticket_id && (
              <div className="space-y-1">
                <div className="text-xs text-gray-500">Ticket ID</div>
                <div className="text-sm font-mono text-gray-300">{roadmapItem.ticket_id}</div>
              </div>
            )}
          </div>

          {/* Timestamps */}
          {(roadmapItem.created_at || roadmapItem.updated_at) && (
            <div className="flex items-center gap-4 text-xs text-gray-500 ml-6 pt-2 border-t border-gray-800/50">
              {roadmapItem.created_at && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>Created: {formatDate(roadmapItem.created_at)}</span>
                </div>
              )}
              {roadmapItem.updated_at && roadmapItem.updated_at !== roadmapItem.created_at && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>Updated: {formatDate(roadmapItem.updated_at)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      {data.actions && data.actions.length > 0 && (
        <ActionButtons actions={data.actions} onActionClick={onActionClick} />
      )}
    </div>
  );
};

export default RoadmapResponse;






