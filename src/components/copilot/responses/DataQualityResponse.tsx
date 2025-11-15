import React from 'react';
import { DataQualityResponse as DataQualityResponseType } from '../types';
import { AlertTriangle, Copy, FileX, CheckCircle2, TrendingUp } from 'lucide-react';

interface DataQualityResponseProps {
  data: DataQualityResponseType;
  onActionClick?: (action: string, data?: any) => void;
}

export const DataQualityResponse: React.FC<DataQualityResponseProps> = ({ data, onActionClick }) => {
  const { issues, duplicates, incompleteRecords, metrics, recommendations } = data.data;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-500 bg-red-500/20 border-red-500/30';
      case 'medium': return 'text-yellow-500 bg-yellow-500/20 border-yellow-500/30';
      default: return 'text-gray-500 bg-gray-500/20 border-gray-500/30';
    }
  };

  const getIssueTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'missing_close_date': 'Missing Close Date',
      'missing_email': 'Missing Email',
      'missing_phone': 'Missing Phone',
      'missing_value': 'Missing Value',
      'stale_data': 'Stale Data',
      'invalid_data': 'Invalid Data'
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      {/* Quality Score */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">Overall Data Quality Score</h3>
            <p className="text-sm text-gray-400">Based on completeness, accuracy, and freshness</p>
          </div>
          <div className={`text-4xl font-bold ${
            metrics.overallQualityScore >= 80 ? 'text-green-500' :
            metrics.overallQualityScore >= 60 ? 'text-yellow-500' :
            'text-red-500'
          }`}>
            {metrics.overallQualityScore}
          </div>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${
              metrics.overallQualityScore >= 80 ? 'bg-green-500' :
              metrics.overallQualityScore >= 60 ? 'bg-yellow-500' :
              'bg-red-500'
            }`}
            style={{ width: `${metrics.overallQualityScore}%` }}
          />
        </div>
      </div>

      {/* Metrics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-sm font-medium text-gray-400">Total Issues</span>
          </div>
          <div className="text-2xl font-bold text-white">{metrics.totalIssues}</div>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-sm font-medium text-gray-400">High Severity</span>
          </div>
          <div className="text-2xl font-bold text-white">{metrics.highSeverityIssues}</div>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Copy className="w-4 h-4 text-yellow-500" />
            <span className="text-sm font-medium text-gray-400">Duplicates</span>
          </div>
          <div className="text-2xl font-bold text-white">{metrics.duplicateCount}</div>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileX className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-medium text-gray-400">Incomplete</span>
          </div>
          <div className="text-2xl font-bold text-white">{metrics.incompleteCount}</div>
        </div>
      </div>

      {/* Data Issues */}
      {issues.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Data Issues ({issues.length})
          </h3>
          <div className="space-y-3">
            {issues.map((issue) => (
              <div key={issue.id} className={`border rounded-lg p-4 ${getSeverityColor(issue.severity)}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium px-2 py-1 rounded bg-current/20">
                        {getIssueTypeLabel(issue.type)}
                      </span>
                      <span className="text-xs text-gray-400 capitalize">{issue.entityType}</span>
                    </div>
                    <h4 className="font-semibold text-white mt-2">{issue.entityName}</h4>
                    <p className="text-sm text-gray-300 mt-1">{issue.issue}</p>
                  </div>
                  {issue.fixable && (
                    <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
                      Fixable
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Duplicates */}
      {duplicates.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Copy className="w-5 h-5 text-yellow-500" />
            Potential Duplicates ({duplicates.length})
          </h3>
          <div className="space-y-4">
            {duplicates.map((dup) => (
              <div key={dup.id} className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="text-xs font-medium text-yellow-400 px-2 py-1 rounded bg-yellow-500/20 capitalize">
                      {dup.type}
                    </span>
                    <div className="mt-2">
                      <span className="text-sm text-gray-400">Confidence: </span>
                      <span className="text-sm font-semibold text-white">{dup.confidence}%</span>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${
                    dup.recommendation === 'merge' ? 'bg-green-500/20 text-green-400' :
                    dup.recommendation === 'review' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {dup.recommendation}
                  </span>
                </div>
                <div className="space-y-2">
                  {dup.records.map((record) => (
                    <div key={record.id} className="bg-gray-900/50 rounded p-3">
                      <div className="font-medium text-white">{record.name}</div>
                      {record.email && <div className="text-sm text-gray-400">{record.email}</div>}
                      {record.company && <div className="text-sm text-gray-400">{record.company}</div>}
                      {record.value && (
                        <div className="text-sm text-gray-400 mt-1">
                          Value: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(record.value)}
                        </div>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        Updated: {new Date(record.lastUpdated).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Incomplete Records */}
      {incompleteRecords.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <FileX className="w-5 h-5 text-orange-500" />
            Incomplete Records ({incompleteRecords.length})
          </h3>
          <div className="space-y-3">
            {incompleteRecords.map((record) => (
              <div key={record.id} className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-orange-400 px-2 py-1 rounded bg-orange-500/20 capitalize">
                        {record.type}
                      </span>
                      <span className="text-xs text-gray-400">
                        {record.completeness}% complete
                      </span>
                    </div>
                    <h4 className="font-semibold text-white mt-2">{record.name}</h4>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-xs text-gray-400 mb-1">Missing fields:</div>
                  <div className="flex flex-wrap gap-1">
                    {record.missingFields.map((field, idx) => (
                      <span key={idx} className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">
                        {field}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            Recommendations
          </h3>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <ul className="space-y-2">
              {recommendations.map((rec, idx) => (
                <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

