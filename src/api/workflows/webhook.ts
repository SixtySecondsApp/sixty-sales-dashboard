import { supabase } from '@/lib/supabase/clientV2';

export async function handleWorkflowWebhook(workflowId: string, payload: any) {
  // Forward the request to Supabase Edge Function
  const response = await supabase.functions.invoke('workflow-webhook', {
    body: payload,
    headers: {
      'x-workflow-id': workflowId
    }
  });
  
  if (response.error) {
    throw response.error;
  }
  return response.data;
}