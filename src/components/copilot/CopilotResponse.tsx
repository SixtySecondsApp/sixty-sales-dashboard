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

