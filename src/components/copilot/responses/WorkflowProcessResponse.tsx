import React from 'react';
import { WorkflowProcessResponse as WorkflowProcessResponseType } from '../types';
import { Workflow, Clock, AlertTriangle, TrendingUp, ArrowRight } from 'lucide-react';

interface WorkflowProcessResponseProps {
  data: WorkflowProcessResponseType;
  onActionClick?: (action: string, data?: any) => void;
}

export const WorkflowProcessResponse: React.FC<WorkflowProcessResponseProps> = ({ data, onActionClick }) => {
  const { process, currentStep, nextSteps, stuckItems, bottlenecks, recommendations } = data.data;

  return (
    <div className="space-y-6">
      {/* Process Header */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Workflow className="w-5 h-5 text-blue-500 mt-1" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white capitalize">{process.name} Process</h3>
            {process.description && (
              <p className="text-sm text-gray-400 mt-1">{process.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Current Step */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
          <div className="flex-1">
            <div className="text-xs text-blue-400 mb-1">Current Step</div>
            <h4 className="font-semibold text-white">{currentStep.name}</h4>
            {currentStep.description && (
              <p className="text-sm text-gray-300 mt-1">{currentStep.description}</p>
            )}
            <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
              <div>
                <span className="text-gray-400">Items:</span>
                <span className="text-white ml-2 font-semibold">{currentStep.itemsInStage}</span>
              </div>
              <div>
                <span className="text-gray-400">Avg Time:</span>
                <span className="text-white ml-2 font-semibold">{currentStep.averageTime} days</span>
              </div>
              <div>
                <span className="text-gray-400">Avg Age:</span>
                <span className="text-white ml-2 font-semibold">{currentStep.averageAge} days</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Next Steps */}
      {nextSteps.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-white mb-3 flex items-center gap-2">
            <ArrowRight className="w-5 h-5 text-green-500" />
            Next Steps
          </h4>
          <div className="space-y-3">
            {nextSteps.map((step, idx) => (
              <div key={step.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500/20 text-green-400 text-sm font-semibold">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <h5 className="font-semibold text-white">{step.name}</h5>
                    {step.description && (
                      <p className="text-sm text-gray-300 mt-1">{step.description}</p>
                    )}
                    <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                      <div>
                        <span className="text-gray-400">Items:</span>
                        <span className="text-white ml-2 font-semibold">{step.itemsInStage}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Avg Time:</span>
                        <span className="text-white ml-2 font-semibold">{step.averageTime} days</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Avg Age:</span>
                        <span className="text-white ml-2 font-semibold">{step.averageAge} days</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stuck Items */}
      {stuckItems.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-white mb-3 flex items-center gap-2">
            <Clock className="w-5 h-5 text-yellow-500" />
            Stuck Items ({stuckItems.length})
          </h4>
          <div className="space-y-3">
            {stuckItems.map((item) => (
              <div key={item.id} className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h5 className="font-semibold text-white">{item.name}</h5>
                    <p className="text-sm text-gray-400">{item.stage}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-yellow-400">{item.daysInStage} days</div>
                    <div className="text-xs text-gray-400">in stage</div>
                  </div>
                </div>
                {item.lastActivity && (
                  <div className="text-xs text-gray-400 mb-2">
                    Last activity: {new Date(item.lastActivity).toLocaleDateString()}
                  </div>
                )}
                <div className="text-sm text-gray-300 mt-2">
                  <span className="text-gray-400">Owner: </span>
                  <span className="text-white">{item.owner}</span>
                </div>
                <div className="text-sm text-gray-300 mt-2">
                  💡 {item.recommendation}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottlenecks */}
      {bottlenecks.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-white mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Process Bottlenecks ({bottlenecks.length})
          </h4>
          <div className="space-y-3">
            {bottlenecks.map((bottleneck, idx) => (
              <div
                key={idx}
                className={`border rounded-lg p-4 ${
                  bottleneck.impact === 'high' ? 'bg-red-500/10 border-red-500/20' :
                  bottleneck.impact === 'medium' ? 'bg-yellow-500/10 border-yellow-500/20' :
                  'bg-orange-500/10 border-orange-500/20'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h5 className="font-semibold text-white">{bottleneck.stage}</h5>
                      <span className={`text-xs px-2 py-1 rounded ${
                        bottleneck.impact === 'high' ? 'bg-red-500/20 text-red-400' :
                        bottleneck.impact === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-orange-500/20 text-orange-400'
                      }`}>
                        {bottleneck.impact} impact
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 mt-2">{bottleneck.issue}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-white">{bottleneck.itemsAffected}</div>
                    <div className="text-xs text-gray-400">items affected</div>
                  </div>
                </div>
                <div className="text-sm text-gray-300 mt-2">
                  💡 {bottleneck.recommendation}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-white mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            Recommendations
          </h4>
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

