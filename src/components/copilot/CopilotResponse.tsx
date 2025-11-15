/**
 * Copilot Response Router Component
 * Routes structured responses to the appropriate component based on type
 */

import React from 'react';
import { PipelineResponse } from './responses/PipelineResponse';
import { EmailResponse } from './responses/EmailResponse';
import { CalendarResponse } from './responses/CalendarResponse';
import { ActivityResponse } from './responses/ActivityResponse';
import { LeadResponse } from './responses/LeadResponse';
import { TaskResponse } from './responses/TaskResponse';
import { ContactResponse } from './responses/ContactResponse';
import { RoadmapResponse } from './responses/RoadmapResponse';
import { SalesCoachResponse } from './responses/SalesCoachResponse';
import { GoalTrackingResponse } from './responses/GoalTrackingResponse';
import { TrendAnalysisResponse } from './responses/TrendAnalysisResponse';
import { ForecastResponse } from './responses/ForecastResponse';
import { TeamComparisonResponse } from './responses/TeamComparisonResponse';
import { MetricFocusResponse } from './responses/MetricFocusResponse';
import { InsightsResponse } from './responses/InsightsResponse';
import { StageAnalysisResponse } from './responses/StageAnalysisResponse';
import { ActivityBreakdownResponse } from './responses/ActivityBreakdownResponse';
import { DealHealthResponse } from './responses/DealHealthResponse';
import { ContactRelationshipResponse } from './responses/ContactRelationshipResponse';
import { CommunicationHistoryResponse } from './responses/CommunicationHistoryResponse';
import { MeetingPrepResponse } from './responses/MeetingPrepResponse';
import { DataQualityResponse } from './responses/DataQualityResponse';
import { PipelineForecastResponse } from './responses/PipelineForecastResponse';
import { ActivityPlanningResponse } from './responses/ActivityPlanningResponse';
import { CompanyIntelligenceResponse } from './responses/CompanyIntelligenceResponse';
import { WorkflowProcessResponse } from './responses/WorkflowProcessResponse';
import { SearchDiscoveryResponse } from './responses/SearchDiscoveryResponse';
import type { CopilotResponse as CopilotResponseType } from './types';

interface CopilotResponseProps {
  response: CopilotResponseType;
  onActionClick?: (action: any) => void;
}

/**
 * Main router component that renders the appropriate response component
 * based on the response type
 */
export const CopilotResponse: React.FC<CopilotResponseProps> = ({ response, onActionClick }) => {
  switch (response.type) {
    case 'pipeline':
      return <PipelineResponse data={response} onActionClick={onActionClick} />;
    
    case 'email':
      return <EmailResponse data={response} onActionClick={onActionClick} />;
    
    case 'calendar':
    case 'meeting':
      return <CalendarResponse data={response} onActionClick={onActionClick} />;
    
    case 'activity':
      return <ActivityResponse data={response} onActionClick={onActionClick} />;
    
    case 'lead':
      return <LeadResponse data={response} onActionClick={onActionClick} />;
    
    case 'task':
      return <TaskResponse data={response} onActionClick={onActionClick} />;
    
    case 'contact':
      return <ContactResponse data={response} onActionClick={onActionClick} />;
    
    case 'roadmap':
      return <RoadmapResponse data={response} onActionClick={onActionClick} />;
    
    case 'sales_coach':
      return <SalesCoachResponse data={response} onActionClick={onActionClick} />;
    
    case 'goal_tracking':
      return <GoalTrackingResponse data={response} onActionClick={onActionClick} />;
    
    case 'trend_analysis':
      return <TrendAnalysisResponse data={response} onActionClick={onActionClick} />;
    
    case 'forecast':
      return <ForecastResponse data={response} onActionClick={onActionClick} />;
    
    case 'team_comparison':
      return <TeamComparisonResponse data={response} onActionClick={onActionClick} />;
    
    case 'metric_focus':
      return <MetricFocusResponse data={response} onActionClick={onActionClick} />;
    
    case 'insights':
      return <InsightsResponse data={response} onActionClick={onActionClick} />;
    
    case 'stage_analysis':
      return <StageAnalysisResponse data={response} onActionClick={onActionClick} />;
    
    case 'activity_breakdown':
      return <ActivityBreakdownResponse data={response} onActionClick={onActionClick} />;
    
    case 'deal_health':
      return <DealHealthResponse data={response} onActionClick={onActionClick} />;
    
    case 'contact_relationship':
      return <ContactRelationshipResponse data={response} onActionClick={onActionClick} />;
    
    case 'communication_history':
      return <CommunicationHistoryResponse data={response} onActionClick={onActionClick} />;
    
    case 'meeting_prep':
      return <MeetingPrepResponse data={response} onActionClick={onActionClick} />;
    
    case 'data_quality':
      return <DataQualityResponse data={response} onActionClick={onActionClick} />;
    
    case 'pipeline_forecast':
      return <PipelineForecastResponse data={response} onActionClick={onActionClick} />;
    
    case 'activity_planning':
      return <ActivityPlanningResponse data={response} onActionClick={onActionClick} />;
    
    case 'company_intelligence':
      return <CompanyIntelligenceResponse data={response} onActionClick={onActionClick} />;
    
    case 'workflow_process':
      return <WorkflowProcessResponse data={response} onActionClick={onActionClick} />;
    
    case 'search_discovery':
      return <SearchDiscoveryResponse data={response} onActionClick={onActionClick} />;
    
    default:
      // Fallback to text response if type is unknown
      return (
        <div className="space-y-4">
          <p className="text-sm text-gray-300">{response.summary}</p>
        </div>
      );
  }
};

export default CopilotResponse;

