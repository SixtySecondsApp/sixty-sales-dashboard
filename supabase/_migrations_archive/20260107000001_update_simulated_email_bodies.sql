-- Migration: Update Simulated Email Bodies
-- Description: Update existing simulated HITL email approvals to have realistic full email body content
-- Date: 2025-01-07

-- Update simulated email approvals to have the full realistic body
UPDATE hitl_pending_approvals
SET original_content = jsonb_build_object(
  'subject', 'Great call today + next steps for Nexus 🚀',
  'recipient', 'sarah.chen@nexustech.com',
  'recipientName', 'Sarah Chen',
  'recipientEmail', 'sarah.chen@nexustech.com',
  'to', 'sarah.chen@nexustech.com',
  'body', E'Hi Sarah,\n\nThanks so much for taking the time to chat today. It was great learning more about Nexus Technologies and the challenges you''re facing with your current CRM integration.\n\nAs we discussed, here''s a quick recap of the next steps:\n\n**1. Security Review Call** — I''ll send over our SOC 2 report and security questionnaire ahead of our technical deep-dive.\n\n**2. Success Criteria** — Let''s nail down the specific metrics you''d like to track (you mentioned lead response time and pipeline visibility).\n\n**3. Timeline** — Targeting a pilot kickoff in early February, with full rollout by end of Q1.\n\nWould Thursday at 2pm PT work for the security review call? I''ve attached our security documentation for your team to review beforehand.\n\nLooking forward to the next conversation!\n\nBest,\nAndrew'
) || COALESCE(original_content, '{}'::jsonb)
WHERE 
  metadata->>'source' = 'proactive_simulator'
  AND resource_type = 'email_draft'
  AND status = 'pending';
