import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing Supabase configuration for process-lead-prep function");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: leads, error } = await supabase
      .from("leads")
      .select(`
        id,
        contact_name,
        contact_first_name,
        contact_last_name,
        contact_email,
        company_id,
        owner_id,
        domain,
        meeting_title,
        meeting_start,
        meeting_description,
        enrichment_status,
        prep_status,
        prep_summary,
        metadata,
        created_at,
        companies(id, name, industry, description)
      `)
      .in("prep_status", ["pending", "in_progress"])
      .order("created_at", { ascending: true })
      .limit(25);

    if (error) {
      throw error;
    }

    if (!leads || leads.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No leads requiring prep" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let processed = 0;
    const now = new Date().toISOString();

    for (const lead of leads) {
      try {
        const summary = buildPrepSummary(lead);
        const prepNotes = await buildPrepNotesWithAI(lead, summary, supabase);

        // Remove previous auto-generated notes to avoid duplicates
        await supabase
          .from("lead_prep_notes")
          .delete()
          .eq("lead_id", lead.id)
          .eq("is_auto_generated", true);

        if (prepNotes.length > 0) {
          await supabase
            .from("lead_prep_notes")
            .insert(
              prepNotes.map((note, index) => ({
                ...note,
                lead_id: lead.id,
                created_at: now,
                updated_at: now,
                sort_order: index,
              })),
            );
        }

        await supabase
          .from("leads")
          .update({
            enrichment_status: "completed",
            prep_status: "completed",
            prep_summary: summary.overview,
            metadata: {
              ...(lead.metadata ?? {}),
              prep_generated_at: now,
            },
            updated_at: now,
          })
          .eq("id", lead.id);

        processed += 1;
      } catch (leadError) {
        console.error("Failed to process lead prep", {
          leadId: lead.id,
          error: leadError,
        });

        await supabase
          .from("leads")
          .update({
            prep_status: "failed",
            updated_at: now,
          })
          .eq("id", lead.id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("process-lead-prep error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

function buildPrepSummary(lead: any) {
  const contact = lead.contact_name ||
    [lead.contact_first_name, lead.contact_last_name].filter(Boolean).join(" ") ||
    lead.contact_email;

  const company = lead.domain ? lead.domain.replace(/^www\./, "") : "the prospect";
  const meetingWhen = lead.meeting_start
    ? new Date(lead.meeting_start).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    })
    : "TBD";

  const overview = `Prep ready for ${contact} (${company}). Meeting scheduled ${meetingWhen}.`;

  return {
    overview,
    company,
    contact,
    meetingWhen,
    meetingTitle: lead.meeting_title ?? "Discovery Call",
  };
}

async function buildPrepNotesWithAI(
  lead: any,
  summary: ReturnType<typeof buildPrepSummary>,
  supabase: any
) {
  const baseNotes = [
    {
      note_type: "summary",
      title: "Lead Overview",
      body: `${summary.contact} booked via SavvyCal for "${summary.meetingTitle}". Confirm goals and current tooling.`,
      created_by: lead.owner_id,
      is_auto_generated: true,
      is_pinned: true,
      metadata: {
        type: "overview",
        generated_from: "process-lead-prep",
        confidence: 1.0,
        sources: [],
      },
    },
  ];

  // Get company industry for playbook matching
  const company = lead.companies?.[0] || lead.companies;
  const industry = company?.industry || null;

  // Generate AI-powered insights with evidence and confidence
  let aiInsights: any = null;
  if (lead.domain || lead.contact_email) {
      try {
        aiInsights = await generateAIInsights(lead, summary, industry);
      } catch (error) {
        console.error("Failed to generate AI insights:", error);
      }
  }

  // Add industry playbook if available
  if (industry) {
    const playbook = getIndustryPlaybook(industry);
    if (playbook) {
      baseNotes.push({
        note_type: "question",
        title: "Industry-Specific Discovery Questions",
        body: playbook.discoveryQuestions.map((q) => `• ${q}`).join("\n"),
        created_by: lead.owner_id,
        is_auto_generated: true,
        is_pinned: false,
        metadata: {
          type: "industry_playbook_questions",
          industry: playbook.industry,
          confidence: 0.9,
          sources: [`Industry playbook: ${playbook.industry}`],
        },
      });

      baseNotes.push({
        note_type: "insight",
        title: "Value Points for " + playbook.industry,
        body: playbook.valuePoints.map((v) => `• ${v}`).join("\n"),
        created_by: lead.owner_id,
        is_auto_generated: true,
        is_pinned: false,
        metadata: {
          type: "industry_playbook_value",
          industry: playbook.industry,
          confidence: 0.9,
          sources: [`Industry playbook: ${playbook.industry}`],
        },
      });

      baseNotes.push({
        note_type: "insight",
        title: "Potential Risks & Considerations",
        body: playbook.risks.map((r) => `• ${r}`).join("\n"),
        created_by: lead.owner_id,
        is_auto_generated: true,
        is_pinned: false,
        metadata: {
          type: "industry_playbook_risks",
          industry: playbook.industry,
          confidence: 0.9,
          sources: [`Industry playbook: ${playbook.industry}`],
        },
      });
    }
  }

  // Add AI-generated insights if available
  if (aiInsights) {
    if (aiInsights.prospect_info) {
      baseNotes.push({
        note_type: "insight",
        title: "Prospect Information",
        body: [
          aiInsights.prospect_info.role_and_responsibilities || "",
          aiInsights.prospect_info.background || "",
        ]
          .filter(Boolean)
          .join("\n\n"),
        created_by: lead.owner_id,
        is_auto_generated: true,
        is_pinned: false,
        metadata: {
          type: "prospect_info",
          confidence: aiInsights.evidence?.[0]?.confidence || 0.7,
          sources: aiInsights.evidence?.[0]?.sources || [],
        },
      });
    }

    if (aiInsights.offer_info) {
      baseNotes.push({
        note_type: "insight",
        title: "What They Need",
        body: aiInsights.offer_info.what_they_need || "",
        created_by: lead.owner_id,
        is_auto_generated: true,
        is_pinned: false,
        metadata: {
          type: "offer_info",
          confidence: aiInsights.evidence?.[1]?.confidence || 0.7,
          sources: aiInsights.evidence?.[1]?.sources || [],
        },
      });
    }

    if (aiInsights.why_sixty_seconds) {
      baseNotes.push({
        note_type: "insight",
        title: "Why Sixty Seconds",
        body: aiInsights.why_sixty_seconds.fit_assessment || "",
        created_by: lead.owner_id,
        is_auto_generated: true,
        is_pinned: false,
        metadata: {
          type: "fit_assessment",
          confidence: aiInsights.evidence?.[2]?.confidence || 0.7,
          sources: aiInsights.evidence?.[2]?.sources || [],
        },
      });
    }
  }

  // Fetch and add live signals
  if (lead.domain) {
    try {
      const liveSignals = await fetchLiveSignals(lead.domain);
      if (liveSignals && liveSignals.length > 0) {
        baseNotes.push({
          note_type: "insight",
          title: "Latest Signals",
          body: liveSignals.map((s: string) => `• ${s}`).join("\n"),
          created_by: lead.owner_id,
          is_auto_generated: true,
          is_pinned: false,
          metadata: {
            type: "live_signals",
            confidence: 0.8,
            sources: [`${lead.domain}`, "Recent news"],
            fetched_at: new Date().toISOString(),
          },
        });
      }
    } catch (error) {
      console.error("Failed to fetch live signals:", error);
    }
  }

  // Add default discovery questions if no playbook
  if (!industry || !getIndustryPlaybook(industry)) {
    baseNotes.push({
      note_type: "question",
      title: "Discovery Questions",
      body: [
        `• What triggered ${summary.company} to explore solutions now?`,
        `• Which metrics will define success for this initiative?`,
        "• Who else joins the decision process after this call?",
      ].join("\n"),
      created_by: lead.owner_id,
      is_auto_generated: true,
      is_pinned: false,
      metadata: {
        type: "discovery_questions",
        confidence: 0.8,
        sources: [],
      },
    });
  }

  baseNotes.push({
    note_type: "task",
    title: "Prep Checklist",
    body: [
      "☑️ Confirm agenda and stakeholders 24h before call.",
      "☑️ Prepare relevant case studies from similar industries.",
      "☑️ Draft follow-up email template tailored to their needs.",
    ].join("\n"),
    created_by: lead.owner_id,
    is_auto_generated: true,
    is_pinned: false,
    metadata: {
      type: "prep_checklist",
      confidence: 1.0,
      sources: [],
    },
  });

  return baseNotes;
}

// Industry playbook mapping
function getIndustryPlaybook(industry: string | null): any {
  if (!industry) return null;
  
  const playbooks: Record<string, any> = {
    technology: {
      industry: "Technology",
      discoveryQuestions: [
        "What technical challenges are you facing with your current stack?",
        "How does your team currently handle scaling and infrastructure?",
        "What integration requirements do you have with existing tools?",
      ],
      valuePoints: [
        "Reduced technical debt and improved system reliability",
        "Faster time-to-market for new features",
        "Better developer experience and productivity",
      ],
      risks: [
        "Complex migration from legacy systems",
        "Team resistance to new tooling",
      ],
    },
    healthcare: {
      industry: "Healthcare",
      discoveryQuestions: [
        "How do you ensure HIPAA compliance in your current processes?",
        "What patient data management challenges are you facing?",
        "How do you handle interoperability with other healthcare systems?",
      ],
      valuePoints: [
        "Enhanced patient care coordination",
        "Improved regulatory compliance",
        "Reduced administrative burden on clinical staff",
      ],
      risks: [
        "Strict regulatory requirements and compliance concerns",
        "Long approval cycles and procurement processes",
      ],
    },
    "financial services": {
      industry: "Financial Services",
      discoveryQuestions: [
        "What regulatory compliance requirements must you meet?",
        "How do you currently handle risk management and reporting?",
        "What security and data protection measures are in place?",
      ],
      valuePoints: [
        "Improved regulatory reporting and compliance",
        "Enhanced fraud detection and risk management",
        "Better customer data security and privacy",
      ],
      risks: [
        "Stringent security and compliance requirements",
        "Complex integration with legacy banking systems",
      ],
    },
  };

  const normalized = industry.toLowerCase().trim();
  return playbooks[normalized] || null;
}

// Generate AI insights with evidence and confidence
async function generateAIInsights(lead: any, summary: any, industry: string | null) {
  const apiKey = ANTHROPIC_API_KEY || OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("No AI API key configured, skipping AI insights");
    return null;
  }

  const useAnthropic = !!ANTHROPIC_API_KEY;
  const model = useAnthropic ? "claude-3-5-sonnet-20241022" : "gpt-4o-mini";

  const prompt = `Generate lead prep insights for a sales meeting with ${summary.contact} from ${summary.company}.

Meeting: ${lead.meeting_title || "Discovery Call"}
${lead.meeting_description ? `Description: ${lead.meeting_description}` : ""}
${industry ? `Industry: ${industry}` : ""}
${lead.domain ? `Company website: ${lead.domain}` : ""}

Provide a JSON response with this structure:
{
  "prospect_info": {
    "role_and_responsibilities": "Brief description of their role and what they're responsible for",
    "background": "Relevant background information about the prospect"
  },
  "offer_info": {
    "what_they_need": "What solutions or capabilities they likely need based on their role and company"
  },
  "why_sixty_seconds": {
    "fit_assessment": "Why Sixty Seconds might be a good fit for this prospect"
  },
  "evidence": [
    {
      "for": "prospect_info.background",
      "confidence": 0.0-1.0,
      "sources": ["URL or source name if available"]
    },
    {
      "for": "offer_info.what_they_need",
      "confidence": 0.0-1.0,
      "sources": ["URL or source name if available"]
    },
    {
      "for": "why_sixty_seconds.fit_assessment",
      "confidence": 0.0-1.0,
      "sources": ["URL or source name if available"]
    }
  ]
}

Be concise but specific. Confidence should reflect how certain you are about the information.`;

  try {
    let response: Response;
    if (useAnthropic) {
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          system: "You are a sales intelligence assistant. Always respond with valid JSON only.",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 2000,
        }),
      });
    } else {
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "You are a sales intelligence assistant. Always respond with valid JSON only." },
            { role: "user", content: prompt },
          ],
          max_tokens: 2000,
          response_format: { type: "json_object" },
        }),
      });
    }

    if (!response.ok) {
      throw new Error(`AI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = useAnthropic
      ? data.content[0].text
      : data.choices[0].message.content;

    // Parse JSON response
    const parsed = JSON.parse(content);
    return parsed;
  } catch (error) {
    console.error("Error generating AI insights:", error);
    return null;
  }
}

// Fetch live signals from homepage and news
async function fetchLiveSignals(domain: string): Promise<string[]> {
  const signals: string[] = [];

  try {
    // Fetch homepage content
    const homepageUrl = domain.startsWith("http") ? domain : `https://${domain}`;
    const homepageResponse = await fetch(homepageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LeadPrepBot/1.0)",
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (homepageResponse.ok) {
      const html = await homepageResponse.text();
      // Extract text content (simple approach - could be improved)
      const textMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      if (textMatch) {
        const bodyText = textMatch[1]
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .substring(0, 500);

        if (bodyText.length > 50) {
          signals.push(`Homepage highlights: ${bodyText.substring(0, 150)}...`);
        }
      }
    }
  } catch (error) {
    console.error("Error fetching homepage:", error);
  }

  // Try to fetch recent news (simplified - could use a news API)
  try {
    // Use a simple news search approach
    const newsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(domain)}&hl=en-US&gl=US&ceid=US:en`;
    const newsResponse = await fetch(newsUrl, {
      signal: AbortSignal.timeout(5000),
    });

    if (newsResponse.ok) {
      const xml = await newsResponse.text();
      // Simple RSS parsing
      const titleMatches = xml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/g);
      if (titleMatches && titleMatches.length > 1) {
        // Skip first title (usually "Search results")
        const recentNews = titleMatches
          .slice(1, 4)
          .map((match) => match.replace(/<title><!\[CDATA\[(.*?)\]\]><\/title>/, "$1"));
        signals.push(...recentNews.map((title) => `Recent news: ${title}`));
      }
    }
  } catch (error) {
    console.error("Error fetching news:", error);
  }

  return signals.slice(0, 3); // Return max 3 signals
}

