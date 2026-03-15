# RoomLens Pro — Feature Roadmap

## ✅ v1.0 STABLE (Current — March 2026)
- Login / Dashboard
- Create New Job (15-step workflow)
- Employee/Team Members tab
- File Created By dropdown
- Stop Job + Override system  
- Photos upload (damage_tag, room_tag)
- Documents/WAF upload
- Password reset page
- RLS security fixed on all tables

---

## 🔜 v1.1 — Job Detail Page Improvements
*Reference: Encircle-style layout*

### Job Overview Tab
- [ ] Carrier Identifier field
- [ ] Contractor Identifier (auto-fill company name)
- [ ] Assignment Identifier
- [ ] Type of Loss dropdown (water/fire/mold/wind/other)
- [ ] Project Manager field (team member dropdown)
- [ ] Date of Loss
- [ ] Date Job Created (auto)
- [ ] CAT Code
- [ ] Insurance Company
- [ ] Policy Number
- [ ] Adjuster name + contact
- [ ] Broker / Agent
- [ ] Summary / Notes text area

### Documents Section
- [ ] "Needs Signature" badge on documents
- [ ] Document status filters (All / Missing Info / Needs Signature / Signed)
- [ ] File Type filter dropdown
- [ ] Email document button
- [ ] Delete document button

### Share / Policyholder Portal
- [ ] Shareable link generator for clients
- [ ] Policyholder can view/sign documents online
- [ ] Show who has access (owner + shares list)

### Contents Section
- [ ] Sales Tax field
- [ ] Default Depreciation %
- [ ] Max Depreciation %
- [ ] Total Replacement Cost (auto-calc)
- [ ] Total Actual Cash Value (auto-calc)

### Estimate / Reserve Section
- [ ] Currency selector
- [ ] Emergency Estimate Reserve $
- [ ] Repair Estimate Reserve $
- [ ] Contents Estimate Reserve $

### Exports Section
- [ ] Download Photos & Videos button
- [ ] All Files (Newest to Oldest) list
- [ ] Xactanalysis exports

---

## 🔜 v1.2 — Mobile App / PWA
- [ ] Offline photo capture
- [ ] GPS tagging on photos
- [ ] Moisture reading entry on mobile
- [ ] Signature capture on mobile

## 🔜 v1.3 — Reporting & Billing
- [ ] Generate PDF reports
- [ ] Invoice creation
- [ ] Payment tracking
- [ ] Xactimate integration

---

## 📝 Notes
- Keep MVP simple — get the workflow solid first
- Priority: Job detail page fields → Documents → Share portal
- Mobile comes after desktop is stable

---

## 🎯 Competitive Reference: Encircle
- Industry standard used by major restoration companies
- Key advantages to match or beat:
  - Policyholder portal (client signs docs online)
  - Field app (offline capable)
  - Xactimate / XactAnalysis integration
  - Sketch floor plan tool
  - Contents inventory with pricing
  - Insurance carrier direct submission

## 💡 RoomLens Competitive Advantages to Build:
  - AI-powered damage notes (already built ✅)
  - Faster job creation workflow
  - Better mobile UX
  - Lower price point for smaller contractors
  - Canadian-first (metric, CAD currency, province fields)

---

## 🤖 FUTURE PHASE — OpenClaw AI Growth Engine
*Noted: March 2026 — Build AFTER core app is stable and publicly launched*

### What OpenClaw Is
Open-source AI Agent Framework. Multiple autonomous agents that coordinate,
execute tasks, call APIs, post content, send messages — 24/7 without human input.
Less like a chatbot. More like a full-time autonomous employee team.

### The 5-Agent System Planned for RoomLens

**Agent 1 — Content Writer** (runs daily 7am)
- Reads weather/flood alerts in Ontario → writes timely posts
- Reads insurance news → writes educational content
- Reads RoomLens job data → writes proof/results posts
- Outputs: LinkedIn post, Instagram reel script, Twitter thread,
  email newsletter draft, WhatsApp status — DAILY, automatically

**Agent 2 — Social Poster** (posts to all platforms)
- LinkedIn → targeting adjusters, brokers, TPAs
- Instagram → targeting homeowners, property managers
- Facebook → local community groups (high ROI for restoration)
- Twitter/X → insurance industry conversations
- Uses Postiz (open-source scheduler) via API
- Posts at optimal times, adds hashtags, location tags, images

**Agent 3 — Outreach Agent** (B2B sales robot)
Targets:
- Insurance adjusters → LinkedIn DM
  "Here's how RoomLens auto-generates your 24hr report"
- Brokers/agents → Email
  "Your clients get faster claims with contractors using RoomLens"
- Insurance boards (IBAO, RIBO) → Email
  "IICRC-compliant documentation built for Ontario carriers"
- Property managers → WhatsApp
  "3 restoration teams available in your area right now"
- TPAs (Sedgwick, Crawford) → LinkedIn
  "POMS score improvement built into the workflow"
Personalizes each message using contact name, company, LinkedIn activity.
CASL-compliant (includes opt-out). NOT mass spam — targeted B2B outreach.

**Agent 4 — Analytics Agent** (runs every Sunday 8pm)
- Reads all platform engagement data
- Identifies which posts/messages got adjuster responses
- Tracks email open rates, LinkedIn reply rates, WhatsApp conversions
- Generates weekly performance report
- Recommends content pivot for next week
- Makes the entire system smarter over time — no more guesswork

**Agent 5 — Closer Agent** (always-on reply handler)
- Monitors all inboxes: email, LinkedIn DM, WhatsApp
- Reads replies, understands intent
- Responds intelligently to qualify the lead
- Books demos directly into calendar (Calendly integration)
- Creates lead record in Supabase
- Sends Nasser a WhatsApp notification:
  "🔥 Hot lead — adjuster from Intact replied. Demo booked Tuesday 2pm"

### Target Market (Canada — fully reachable)
- ~45,000 licensed insurance adjusters
- ~120,000 insurance brokers and agents
- ~30,000 restoration contractors
- ~15 major TPAs (Sedgwick, Crawford, Eberl, etc.)
- 3 major insurance boards (IBAO, RIBO, ICBC)
All on LinkedIn daily. All reachable by email. All in WhatsApp groups.

### Projected Impact
- Week 1: 200 adjuster LinkedIn messages → 40 opens → 12 replies → 8 demos → 2-3 clients
- Month 3: Analytics Agent identifies mould-risk content converts 3x better → pivot
- Month 6: 200 restoration companies at $199/month = $39,800 MRR from agent alone
- Cost to run: ~$50-150/month (self-hosted OpenClaw + LLM API costs)

### Build Sequence
1. April 2026 → Launch RoomLens publicly
2. April 2026 → Start Agent 1 + 2 (content + posting) — brand building
3. May 2026  → Add Agent 3 (outreach) — now you have a product to sell
4. June 2026 → Add Agent 4 (analytics) — optimize what's working
5. June 2026 → Add Agent 5 (closer) — close at scale, fully automated

### Why This Is a Competitive Moat
The insurance restoration market in Canada is still sold via phone calls
and golf games. An AI agent that posts daily, reaches 200 adjusters/week,
reads every reply, books demos, and tells you what's working —
NOBODY in this industry has this yet. First mover wins.

### Setup Notes (for developer)
- Self-hosted OpenClaw instance on a VPS (not Cloudflare Pages — needs persistent server)
- Connect to: LinkedIn API, Gmail API, WhatsApp Business API, Twilio (SMS),
  Postiz (social scheduler), Calendly API, Supabase (lead records)
- Use Claude/GPT-4o as the LLM backbone (own API key)
- Estimated setup: 3-4 weeks with a developer
- Legal: CASL-compliant outreach — include opt-out in all messages
