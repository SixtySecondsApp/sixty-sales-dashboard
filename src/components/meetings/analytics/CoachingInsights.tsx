import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Info, AlertTriangle, CheckCircle2, Lightbulb } from 'lucide-react';
import { analyzeTalkTime, type CoachingInsight, type TalkTimeMetrics } from '@/lib/services/coachingService';

interface CoachingInsightsProps {
  metrics: TalkTimeMetrics;
}

const severityIcons = {
  critical: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const severityColors = {
  critical: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
  warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200',
  info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
};

export function CoachingInsights({ metrics }: CoachingInsightsProps) {
  const insights = analyzeTalkTime(metrics);

  if (insights.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            Coaching Insights
          </CardTitle>
          <CardDescription>
            Great job! Your talk time balance looks good.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-purple-500" />
          Coaching Insights
        </CardTitle>
        <CardDescription>
          AI-powered recommendations based on your talk time and sentiment
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {insights.map((insight, index) => {
          const Icon = severityIcons[insight.severity];
          const colorClass = severityColors[insight.severity];

          return (
            <div
              key={index}
              className={`p-4 rounded-lg border ${colorClass}`}
            >
              <div className="flex items-start gap-3">
                <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{insight.message}</p>
                    <Badge variant="outline" className="text-xs">
                      {insight.type.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-sm opacity-90">{insight.recommendation}</p>
                  {insight.actionableSteps && insight.actionableSteps.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <p className="text-xs font-medium opacity-75">Actionable Steps:</p>
                      <ul className="list-disc list-inside text-xs space-y-1 opacity-90">
                        {insight.actionableSteps.map((step, stepIndex) => (
                          <li key={stepIndex}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

