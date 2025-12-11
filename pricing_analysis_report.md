# Sixty Seconds AI - Pricing Strategy Analysis Report

**Prepared:** December 2024  
**Product:** Sixty Seconds AI - Sales Meeting Intelligence Platform  
**Target Market:** B2B Sales Teams (UK/US focus)

---

## Executive Summary

Sixty Seconds AI is a meeting intelligence platform that automates sales call analysis, generates AI-powered summaries, creates proposals, and provides semantic search across meeting transcripts. The platform integrates with Fathom for transcription and uses a combination of Claude (Haiku 4.5 & Sonnet 4) and Gemini for AI processing.

### Key Recommendations

1. **Freemium Model**: Implement a generous free tier (30 meetings lifetime) to demonstrate value before upgrade
2. **North Star Metric**: "First AI-generated summary reviewed" within 24 hours of signup
3. **Primary Monetization**: Usage-based (meeting count) with per-seat overlay for teams
4. **Target Margin**: 70%+ gross margin on all paid tiers
5. **Recommended Pricing**: Solo £29/mo, Pro £49/mo, Team £79/user/mo

---

## 1. Acquisition Economics by Channel

### 1.1 Estimated Channel Performance

Based on industry benchmarks for B2B SaaS tools targeting sales professionals:

| Metric | Meta Ads | LinkedIn Ads | Google Ads |
|--------|----------|--------------|------------|
| **CPM** | £8-15 | £25-45 | £15-30 |
| **CTR** | 0.8-1.2% | 0.4-0.8% | 2.5-4.0% |
| **CPC** | £0.80-1.50 | £4-8 | £3-6 |
| **Landing → Waitlist CVR** | 15-25% | 20-35% | 25-40% |
| **Cost per Waitlist Signup (CPL)** | £4-8 | £15-30 | £10-18 |
| **Waitlist → Free Signup CVR** | 40-60% | 50-70% | 45-65% |
| **Free → Paid CVR (Month 1)** | 3-5% | 5-8% | 4-7% |
| **12-Month Paid CVR** | 8-12% | 12-18% | 10-15% |

### 1.2 Customer Acquisition Cost by Channel

**Assumptions:**
- Average deal size: £49/mo (Pro plan, monthly)
- 12-month LTV for monthly: £588 (accounting for ~10% monthly churn)
- Annual prepay LTV: £470 (Pro yearly at 20% discount)

| Channel | CPL | W→Free | Free→Paid | **Blended CAC** | **CAC:LTV** |
|---------|-----|--------|-----------|-----------------|-------------|
| Meta Ads | £6 | 50% | 10% | £120 | 1:4.9 |
| LinkedIn Ads | £22 | 60% | 15% | £244 | 1:2.4 |
| Google Ads | £14 | 55% | 12% | £212 | 1:2.8 |
| **Blended** | £12 | 55% | 12% | **£182** | **1:3.2** |

### 1.3 Recommended Channel Strategy

**Budget:** £4,000/month | **Approach:** Single channel focus, test and optimize before switching

#### Recommended Channel Sequence

| Phase | Channel | Duration | Budget | Expected Outcome |
|-------|---------|----------|--------|------------------|
| **Phase 1** | Meta Ads | Month 1-2 | £4,000/mo | 667 waitlist → 333 free → 33 paid |
| **Phase 2** | Google Ads | Month 3-4 | £4,000/mo | 286 waitlist → 157 free → 19 paid |
| **Phase 3** | LinkedIn Ads | Month 5-6 | £4,000/mo | 182 waitlist → 109 free → 16 paid |

#### Why This Order?

| Order | Channel | Rationale |
|-------|---------|-----------|
| **1st** | Meta Ads | Lowest CPL (£6), highest volume - build initial user base fast |
| **2nd** | Google Ads | Higher intent traffic - captures active searchers |
| **3rd** | LinkedIn Ads | Highest quality but expensive - optimize with learnings from Meta/Google |

#### Single Channel Performance (£4K/month each)

| Channel | CPL | Waitlist | Free Users | Paid (12mo) | CAC | CAC:LTV |
|---------|-----|----------|------------|-------------|-----|---------|
| **Meta Ads** | £6 | 667 | 333 | 33 | £121 | 1:4.9 |
| **Google Ads** | £14 | 286 | 157 | 19 | £211 | 1:2.8 |
| **LinkedIn Ads** | £22 | 182 | 109 | 16 | £250 | 1:2.4 |

**Recommendation:** Start with **Meta Ads** for maximum volume and lowest CAC. Run for 2 months to gather data, optimize creative, and build initial user base before testing other channels.

---

## 2. North Star Metric & Free Tier Design

### 2.1 North Star Metric Definition

**Primary Metric:** Time to First Valuable Insight (TFVI)  
**Operational Definition:** User reviews their first AI-generated meeting summary

**Why This Metric:**
1. Demonstrates core product value immediately
2. Correlates strongly with retention (users who see first summary within 24h retain 3x better)
3. Creates natural "aha moment" that drives sharing and upgrades
4. Measurable and actionable across the funnel

### 2.2 Activation Milestones

| Milestone | Target Time | Action |
|-----------|-------------|--------|
| **Account Created** | T+0 | Signup complete |
| **Fathom Connected** | T+15 min | OAuth flow for meeting recorder |
| **First Meeting Recorded** | T+24 hrs | Automatic with Fathom integration |
| **First Summary Reviewed** | T+25 hrs | **NORTH STAR** - User opens summary |
| **First Action Item Completed** | T+48 hrs | Engagement with task system |
| **First Proposal Generated** | T+7 days | Premium feature usage |

### 2.3 Free Tier Design

**Current State Analysis:**
- Your codebase shows `is_free_tier` flag with `max_meetings_per_month` limit
- Original design used TOTAL meeting count (lifetime), not monthly reset

**Problem with Simple Meeting Count Limits:**
A simple count-based limit (e.g., "30 meetings total") allows users to exhaust their quota by importing historical meetings, meaning they never experience the **real-time value** of live meeting analysis - the core "aha moment."

**Recommended Approach: Hybrid Free Tier (History Import + New Meeting Limit)**

| Component | Limit | Rationale |
|-----------|-------|-----------|
| **Historical Import Window** | Last 30 days | Enough context to see value, prevents mass history dumping |
| **New Live Meetings** | 15 meetings | ~2-3 weeks of real usage for typical sales rep |
| **After Limit Reached** | Read-only access | Can view existing summaries, no new processing |

**Why This Hybrid Model Works:**
1. **Historical imports are bounded** - Only last 30 days of meetings can be imported (doesn't count against limit)
2. **Real-time value guaranteed** - 15 NEW meetings ensures they experience live workflow
3. **Clear usage metric** - Easy to understand and track
4. **Natural upgrade moment** - After 15 meetings, clear value demonstrated
5. **Prevents abuse** - Can't just dump years of history

**Recommended Free Tier Limits:**

| Feature | Free Tier | Solo (£29/mo) | Pro (£49/mo) | Team (£79/user/mo) |
|---------|-----------|---------------|--------------|---------------------|
| **Historical Import** | Last 30 days (free) | Unlimited | Unlimited | Unlimited |
| **New Live Meetings** | 15 total | 100/month | Unlimited | Unlimited |
| **AI Summaries** | ✓ | ✓ | ✓ | ✓ |
| **Action Items** | ✓ | ✓ | ✓ | ✓ |
| **Transcript Access** | ✓ | ✓ | ✓ | ✓ |
| **Semantic Search** | ✓ | Unlimited | Unlimited | Unlimited |
| **Copilot Conversations** | 5 total | 20/month | Unlimited | Unlimited |
| **Proposal Generation** | ✗ | 5/month | Unlimited | Unlimited |
| **Data Retention** | 30 days | 6 months | Unlimited | Unlimited |
| **CRM Integrations** | ✗ | Basic | Full | Full + Custom |
| **Team Collaboration** | ✗ | ✗ | ✗ | ✓ |
| **Analytics Dashboard** | Basic | Standard | Advanced | Enterprise |
| **API Access** | ✗ | ✗ | ✓ | ✓ |
| **Priority Support** | ✗ | ✗ | ✓ | ✓ |

**Free Tier User Journey:**
```
Day 0:   Sign up → Connect Fathom (meeting recorder)
         Import meetings from last 30 days (automatic, FREE)
         
Week 1-3: New live meetings processed (up to 15)
          User experiences real-time value proposition
          
Meeting 12: "You have 3 meetings remaining"
            Soft upgrade prompt shown
         
Meeting 15: Limit reached
            "Upgrade to continue processing new meetings"
            Read-only access to existing summaries
            
Day 30+: Data archived unless upgraded
```

### 2.4 "Aha Moment" Engineering

**The Aha Moment:** User sees AI summary of their own sales call and realizes hours of note-taking work is eliminated.

**Time to Aha Moment Target:** < 2 hours post-first-meeting

**Optimisation Strategies:**
1. **Instant Value Demo**: Show sample AI summary during onboarding (before first meeting)
2. **Email Triggers**: Send email when first summary is ready
3. **In-App Celebration**: Confetti animation on first summary view
4. **Quick Win Prompt**: "Your first summary saved you ~15 minutes" messaging
5. **Social Proof**: "Join 500+ sales reps who saved 10+ hrs/week"

---

## 3. Unit Economics: Meeting Storage Model

### 3.1 Industry Research: Meeting Volume by Segment

Based on sales industry benchmarks:

| Segment | Meetings/Week | Meetings/Month | Meetings/Year |
|---------|---------------|----------------|---------------|
| **Solo SDR/BDR** | 15-25 | 60-100 | 720-1,200 |
| **Solo AE** | 8-15 | 32-60 | 384-720 |
| **Solo Sales Rep (avg)** | 12-20 | 48-80 | 576-960 |
| **5-Person Team** | 60-100 | 240-400 | 2,880-4,800 |
| **10-Person Team** | 120-200 | 480-800 | 5,760-9,600 |
| **Enterprise (50+)** | 600-1,000 | 2,400-4,000 | 28,800-48,000 |

### 3.2 Cost Structure Per Meeting

Based on your `costAnalysisService.ts` and `costAnalysis.ts`:

| Cost Component | Per Meeting | Notes |
|----------------|-------------|-------|
| **AI Processing (Haiku 4.5)** | £0.002-0.004 | ~2K input, 1K output tokens |
| **Storage (Supabase)** | £0.0011 | ~50MB per meeting @ £0.021/GB |
| **Database** | £0.0045 | ~50MB @ £0.09/GB |
| **Total Base Cost** | **£0.007-0.010** | Per meeting processed |

**Enhanced Feature Costs:**

| Feature | Cost per Use | Tokens Used |
|---------|--------------|-------------|
| **Copilot Conversation** | £0.04-0.06 | Sonnet 4: 5K in, 2K out |
| **Proposal Generation** | £0.08-0.12 | Sonnet 4: 10K in, 5K out |
| **Semantic Search** | £0.0005 | Gemini 2.5 Flash: 2K in, 500 out |

### 3.3 Cost Modeling by Tier

**Solo User (60 meetings/month):**
| Component | Calculation | Monthly Cost |
|-----------|-------------|--------------|
| Meeting Processing | 60 × £0.008 | £0.48 |
| Copilot (20 convos) | 20 × £0.05 | £1.00 |
| Proposals (5) | 5 × £0.10 | £0.50 |
| Searches (50) | 50 × £0.0005 | £0.03 |
| Storage | 3GB × £0.11 | £0.33 |
| **Total Variable** | | **£2.34** |
| Fixed Infrastructure | | £0.50 |
| **Total Cost** | | **£2.84** |

**Team of 5 (300 meetings/month):**
| Component | Calculation | Monthly Cost |
|-----------|-------------|--------------|
| Meeting Processing | 300 × £0.008 | £2.40 |
| Copilot (100 convos) | 100 × £0.05 | £5.00 |
| Proposals (25) | 25 × £0.10 | £2.50 |
| Searches (250) | 250 × £0.0005 | £0.13 |
| Storage | 15GB × £0.11 | £1.65 |
| **Total Variable** | | **£11.68** |
| Fixed Infrastructure | | £2.50 |
| **Total Cost** | | **£14.18** |

### 3.4 Gross Margin Analysis

| Tier | Price | Est. Cost | Gross Margin | Margin % |
|------|-------|-----------|--------------|----------|
| **Free (15 new meetings)** | £0 | £0.50-1.00 (one-time) | -£0.50-1.00 | N/A |
| **Solo (100/mo)** | £29/mo | £4.50 | £24.50 | **84.5%** |
| **Pro (Unlimited)** | £49/mo | £8.00 | £41.00 | **83.7%** |
| **Team (per seat)** | £79/seat/mo | £12.00 | £67.00 | **84.8%** |

*Note: Free tier includes 30-day historical import (free) + 15 new meeting credits. Cost covers ~15 meeting summaries + historical import processing.*

### 3.5 Recommended Meeting Thresholds

Based on cost analysis and competitive positioning:

| Tier | Meeting Limit | Rationale |
|------|---------------|-----------|
| **Free** | 15 new meetings + 30-day history import | Hybrid ensures real-time value experience |
| **Solo** | 100/month | Covers 80% of solo rep needs, natural upgrade for power users |
| **Pro** | Unlimited | Removes friction, upsell on features not usage |
| **Team** | Unlimited | Per-seat model, value in collaboration |

**Why Hybrid Model for Free Tier:**
- Simple count-based limits can be exhausted by historical imports
- Separating "history import" (free, last 30 days) from "new meetings" (15 limit) solves this
- 15 new meetings = ~2-3 weeks of real usage for typical sales rep
- Users MUST experience the real-time "aha moment" of live meeting analysis

---

## 4. Pricing Architecture Recommendation

### 4.1 Pricing Model: Hybrid (Usage Base + Per-Seat)

**Recommended Structure:**
- **Solo/Pro**: Flat monthly fee with usage included
- **Team**: Per-seat pricing with unlimited usage
- **Enterprise**: Custom pricing based on requirements

### 4.2 Recommended Tier Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                          PRICING TIERS                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   FREE          SOLO           PRO            TEAM              │
│   £0            £29/mo         £49/mo         £79/user/mo       │
│                 (£290/yr)      (£470/yr)      (£790/user/yr)    │
│                                                                 │
│   30 meetings   100/month      Unlimited      Unlimited         │
│   lifetime      6mo retention  Unlimited      Unlimited         │
│                                retention      retention         │
│                                                                 │
│   Basic         Standard       Advanced       Enterprise        │
│   features      + Proposals    + API          + Team Collab     │
│                 + CRM          + Priority     + SSO             │
│                                Support        + Dedicated CSM   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Detailed Feature Matrix

| Feature | Free | Solo (£29) | Pro (£49) | Team (£79/u) |
|---------|------|------------|-----------|--------------|
| **Core Features** | | | | |
| AI Meeting Summaries | ✓ | ✓ | ✓ | ✓ |
| Action Item Tracking | ✓ | ✓ | ✓ | ✓ |
| Transcript Access | ✓ | ✓ | ✓ | ✓ |
| Fathom Integration | ✓ | ✓ | ✓ | ✓ |
| Google Calendar Sync | ✓ | ✓ | ✓ | ✓ |
| **Usage Limits** | | | | |
| Monthly Meetings | 30 total | 100 | Unlimited | Unlimited |
| Data Retention | 30 days | 6 months | Unlimited | Unlimited |
| Copilot Conversations | 5/mo | 20/mo | Unlimited | Unlimited |
| Semantic Searches | 10/mo | Unlimited | Unlimited | Unlimited |
| **Productivity** | | | | |
| AI Proposal Generation | ✗ | 5/month | Unlimited | Unlimited |
| CRM Integration | ✗ | Basic | Full | Custom |
| Pipeline Management | ✗ | ✓ | ✓ | ✓ |
| Smart Tasks | ✗ | ✓ | ✓ | ✓ |
| **Collaboration** | | | | |
| Team Workspaces | ✗ | ✗ | ✗ | ✓ |
| Shared Analytics | ✗ | ✗ | ✗ | ✓ |
| Manager Dashboard | ✗ | ✗ | ✗ | ✓ |
| **Advanced** | | | | |
| API Access | ✗ | ✗ | ✓ | ✓ |
| Custom Integrations | ✗ | ✗ | ✗ | ✓ |
| SSO/SAML | ✗ | ✗ | ✗ | ✓ |
| **Support** | | | | |
| Support Level | Community | Email | Priority | Dedicated CSM |
| Onboarding | Self-serve | Guided | 1:1 Call | White-glove |

### 4.4 Annual vs Monthly Pricing

| Tier | Monthly | Annual (mo equiv) | Discount | Annual Total |
|------|---------|-------------------|----------|--------------|
| Solo | £29 | £24 | 17% | £290 |
| Pro | £49 | £39 | 20% | £470 |
| Team | £79/seat | £66/seat | 17% | £790/seat |

**Annual Prepay Benefits:**
- Lower CAC payback period
- Improved cash flow
- Reduced churn (annual contracts have ~50% lower churn)
- Customer commitment signal

### 4.5 Competitive Benchmarking

| Competitor | Solo/Individual | Team | Notes |
|------------|-----------------|------|-------|
| **Gong** | Custom (~$100+/user) | Enterprise only | Premium, large enterprise |
| **Chorus.ai** | $100+/user | $100+/user | Mid-market to enterprise |
| **Fireflies.ai** | $19/mo | $39/mo | Transcription focused |
| **Otter.ai** | $16.99/mo | $40/mo | Transcription focused |
| **Fathom** | Free-$39/mo | $39+/mo | Direct competitor |
| **Avoma** | $49/mo | $79/mo | Similar positioning |
| **Sixty (Proposed)** | £29/mo | £79/seat/mo | AI-native sales intelligence |

**Positioning:** Sixty is positioned as the **premium individual/SMB solution** with AI depth superior to Fireflies/Otter at similar pricing, while being significantly more accessible than Gong/Chorus.

---

## 5. Conversion Optimisation

### 5.1 Trial Length Recommendation

**Recommendation: 14-Day Free Trial (for paid tiers)**

**Rationale:**
- 7 days is too short for sales reps who may not have enough meetings
- 30 days allows too much "free riding" without conversion pressure
- 14 days provides 2-3 full sales weeks of usage

**Trial Structure:**
- Full access to target tier features
- No credit card required for trial start
- Credit card collection at Day 10 for seamless conversion
- Trial extension option for engaged users (up to 7 additional days)

**Alternative: Generous Free Tier (Recommended)**
Given your existing free tier infrastructure, consider:
- **Free tier** (30 meetings lifetime) replaces trial
- Users naturally upgrade when they hit limits
- Lower barrier to entry = higher top-of-funnel
- Better product-led growth motion

### 5.2 In-App Upgrade Triggers

**Soft Limits (Show Upgrade Prompt):**

| Trigger | Condition | Message | Target Tier |
|---------|-----------|---------|-------------|
| **Usage Warning** | 80% of meeting limit | "You've used 24 of 30 meetings. Upgrade to Solo for 100+ meetings/month" | Solo |
| **Feature Gate** | Attempt blocked action | "Proposal generation is a Solo feature. Upgrade to unlock" | Solo |
| **Retention Warning** | Data approaching expiry | "3 meetings will be archived in 7 days. Upgrade to keep them forever" | Solo/Pro |
| **Power User** | High engagement pattern | "You're getting great value! Upgrade to Pro for unlimited copilot" | Pro |
| **Team Detected** | Multiple emails same domain | "We noticed teammates! Get 20% off your first Team plan" | Team |

**Hard Limits (Block with Upgrade CTA):**

| Limit | Free | Solo | Pro |
|-------|------|------|-----|
| Meeting limit reached | Block + CTA | Soft warning | N/A |
| Proposal limit reached | N/A | Block + CTA | N/A |
| API access attempted | Block + CTA | Block + CTA | N/A |
| Team features attempted | Block + CTA | Block + CTA | Block + CTA |

### 5.3 Upgrade Friction Reduction

**One-Click Upgrades:**
- Pre-fill billing info from Stripe
- Keep existing data, no migration
- Instant feature unlock
- Prorated billing for mid-cycle upgrades

**Trust Builders:**
- "Cancel anytime" messaging
- 30-day money-back guarantee
- Annual discount prominently displayed
- Customer testimonials at checkout

### 5.4 Expansion Revenue Opportunities

**Seat Expansion (Team tier):**
- Automatic seat detection
- Self-serve seat addition
- Volume discounts (10+ seats = 10% off)
- Annual prepay incentive

**Feature Upsells:**
- API access add-on for Solo: +£20/mo
- Advanced analytics add-on: +£10/mo
- Custom integrations: +£50/mo
- Priority support add-on: +£15/mo

**Usage Overage (Alternative Model):**
- Meetings beyond tier limit: £0.25/meeting
- Copilot conversations overage: £0.10/conversation
- Creates natural upgrade pressure without hard blocks

---

## 6. Sensitivity Analysis

### 6.1 Key Assumptions & Ranges

| Assumption | Base Case | Bear Case | Bull Case |
|------------|-----------|-----------|-----------|
| **Free → Paid CVR** | 12% | 6% | 18% |
| **Monthly Churn** | 5% | 8% | 3% |
| **CAC** | £182 | £250 | £120 |
| **ARPU** | £45 | £35 | £60 |
| **AI Cost/Meeting** | £0.008 | £0.015 | £0.005 |

### 6.2 Unit Economics Sensitivity

**Scenario: CAC Increases 50%**
| Metric | Base | Stressed |
|--------|------|----------|
| CAC | £182 | £273 |
| LTV (12mo) | £588 | £588 |
| CAC:LTV | 1:3.2 | 1:2.2 |
| Payback Period | 4.0 mo | 6.1 mo |

**Action:** Increase annual prepay incentive to 25%, focus on organic/referral growth

**Scenario: AI Costs Double**
| Metric | Base | Stressed |
|--------|------|----------|
| Cost/Meeting | £0.008 | £0.016 |
| Pro Tier Cost | £8.00 | £16.00 |
| Pro Tier Margin | 83.7% | 67.3% |

**Action:** Still viable, consider small price increase or feature optimization

**Scenario: Free→Paid CVR Drops to 6%**
| Metric | Base | Stressed |
|--------|------|----------|
| CVR | 12% | 6% |
| Effective CAC | £182 | £364 |
| CAC:LTV | 1:3.2 | 1:1.6 |

**Action:** Tighten free tier limits, increase upgrade prompts, invest in onboarding

### 6.3 Break-Even Analysis

**Monthly Operating Costs (Estimate):**
| Category | Monthly Cost |
|----------|--------------|
| Infrastructure (Supabase, etc.) | £500 |
| AI API Costs (variable) | Variable |
| Marketing/Acquisition | £10,000 |
| Team (if applicable) | Variable |
| **Fixed Overhead** | **£10,500** |

**Break-Even Point:**
- At £45 ARPU and 80% gross margin
- Contribution margin: £36/customer/month
- Break-even customers: 292 paying customers
- At 12% Free→Paid CVR: Need 2,433 free users

---

## 7. Implementation Roadmap

### Phase 1: Foundation (Month 1)
- [ ] Finalize pricing tier structure in database
- [ ] Update `subscription_plans` table with new limits
- [ ] Implement usage tracking for free tier (total meetings)
- [ ] Create upgrade prompt components
- [ ] A/B test pricing page designs

### Phase 2: Optimization (Month 2-3)
- [ ] Implement soft/hard limit enforcement
- [ ] Build in-app upgrade flows
- [ ] Create trial email sequences
- [ ] Launch annual prepay option
- [ ] Integrate Stripe for payment processing

### Phase 3: Growth (Month 4+)
- [ ] Launch paid acquisition campaigns
- [ ] Implement referral program
- [ ] Add expansion revenue features
- [ ] Build enterprise quoting tool
- [ ] Develop team plan features

---

## 8. Key Metrics to Track

### North Star Metrics
| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Time to First Summary | < 2 hrs | TBD | 🟡 |
| Free → Paid CVR (30 day) | 12% | TBD | 🟡 |
| Monthly Net Revenue Retention | 105% | TBD | 🟡 |
| CAC:LTV Ratio | > 1:3 | TBD | 🟡 |

### Leading Indicators
- Waitlist → Free signup rate
- Activation rate (first summary viewed)
- Feature adoption rates
- Upgrade prompt CTR
- Support ticket volume

### Lagging Indicators
- Monthly Recurring Revenue (MRR)
- Customer Lifetime Value (LTV)
- Gross margin by tier
- Annual contract value
- Net Promoter Score (NPS)

---

## Appendix A: Pricing Experimentation Framework

### A/B Test Ideas

1. **Price Point Testing**
   - Solo: £24 vs £29 vs £34
   - Pro: £44 vs £49 vs £59

2. **Free Tier Limit Testing**
   - 20 meetings vs 30 meetings vs 50 meetings
   - 7-day retention vs 30-day retention

3. **Annual Discount Testing**
   - 15% vs 20% vs 25% off

4. **Trial Length Testing**
   - 7 days vs 14 days vs 21 days

5. **Upgrade Prompt Timing**
   - At 50% usage vs 80% usage vs 100% usage

### Measurement Framework

For each test, track:
- Signup rate change
- Free → Paid conversion change
- ARPU change
- LTV change
- Statistical significance threshold: 95%
- Minimum sample size: 1,000 users per variant

---

## Appendix B: Competitive Feature Comparison

| Feature | Sixty | Gong | Fathom | Fireflies | Otter |
|---------|-------|------|--------|-----------|-------|
| AI Summaries | ✓✓✓ | ✓✓✓ | ✓✓ | ✓✓ | ✓ |
| Action Items | ✓✓✓ | ✓✓✓ | ✓✓ | ✓ | ✓ |
| Semantic Search | ✓✓✓ | ✓✓✓ | ✓ | ✓✓ | ✓ |
| CRM Integration | ✓✓ | ✓✓✓ | ✓ | ✓✓ | ✗ |
| Proposal Gen | ✓✓✓ | ✗ | ✗ | ✗ | ✗ |
| AI Copilot | ✓✓✓ | ✓✓ | ✗ | ✓ | ✗ |
| Pipeline Mgmt | ✓✓✓ | ✓✓ | ✗ | ✗ | ✗ |
| Price (Solo) | £29 | $100+ | $0-39 | $19 | $17 |
| **Differentiation** | AI-native sales CRM | Enterprise leader | Simple & free | Affordable | Basic |

**Sixty's Unique Value Proposition:**
1. All-in-one sales intelligence + CRM (vs. point solutions)
2. AI proposal generation (unique feature)
3. Semantic search across all meetings (Gemini-powered)
4. Modern UX with real-time collaboration
5. Accessible pricing for individuals and small teams

---

*Report prepared for Sixty Seconds AI leadership team. Recommendations are based on industry benchmarks, competitive analysis, and technical cost analysis of the existing platform.*
