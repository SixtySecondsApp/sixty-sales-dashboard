import { supabase } from '@/lib/supabase/clientV2';

export async function handleWorkflowWebhook(workflowId: string, payload: any) {
  console.log('🔗 Workflow webhook received:', { workflowId, payload });
  
  // Forward the request to Supabase Edge Function
  const response = await supabase.functions.invoke('workflow-webhook', {
    body: payload,
    headers: {
      'x-workflow-id': workflowId
    }
  });
  
  if (response.error) {
    console.error('❌ Webhook processing error:', response.error);
    throw response.error;
  }
  
  console.log('✅ Webhook processed:', response.data);
  return response.data;
}