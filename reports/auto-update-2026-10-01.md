# MMA Academy Dictionary — Monthly Auto-Update, 2026-10-01

## Status: deployed and verified live

The production deploy was initially blocked by the Claude Code auto-mode permission classifier (consequential/deploy action); the user approved it afterward. The first deploy attempt returned "Not authorized" (team-scope mismatch), and a retry with `--scope serkans-projects-a99e9e5f` succeeded. `https://mma-academy-dictionary.vercel.app/`, `.../term/vibe-marketing/`, and `.../term/automation-boundary/` all return HTTP 200.

## 1. Backup

`backup-2026-10-01-auto/` — copies of `glossary-source.json`, `MMA_Dictionary_Master_Glossary_v1.xlsx`, `acronyms_2026*.json`, `term_of_week.json`, `add_sozluk_terms.py`, `build_public.py`, taken before any changes.

## 2. Protocol status refresh (13 checked, 7 changed, 6 unchanged)

Delegated to 3 parallel `mma-researcher` agents (groups of 5/5/3 protocols), each required to open and cite a vendor/standards-body page or named trade outlet before reporting a change.

**Changed:**
- **AP2 (Agent Payments Protocol)** — Google donated AP2 to the FIDO Alliance on April 28, 2026; it now governs AP2 as a platform-agnostic, community-led standard. Source: PYMNTS / FIDO Alliance's own republication; PaymentsJournal.
- **A2A (Agent2Agent Protocol)** — On August 17, 2026, A2A became a hosted project of the Agentic AI Foundation (the same body that governs MCP), supported by 150+ partner organizations (figure specific to A2A, not conflated with AAIF's broader membership). Source: AAIF's own blog, Linux Foundation press release, Axios.
- **x402** — On April 2, 2026, the x402 Foundation moved under Linux Foundation governance. Supporting members: Visa, Mastercard, American Express, AWS, Google and Stripe (Microsoft was initially drafted in error and removed after fact-check — it is not an actual member per Coinbase's own foundation page). Source: Coinbase's own docs (docs.cdp.coinbase.com), Linux Foundation press release.
- **PAIR** — Updated to PAIR 1.1 in July 2025 (clearer technical definitions, Data Clean Rooms now handle Base64 encoding instead of publishers, new Open PAIR Prebid module). This update predates the previous "As of September 2026" line and was missed in an earlier pass; corrected now. Source: ppc.land (opened and verified directly, twice — once by the research agent, once independently by me).
- **TAP (Trusted Agent Protocol)** — Re-scoped: "100+ partners" is honestly attributed to Visa's broader agentic-commerce ecosystem (which TAP is part of), not claimed as TAP-exclusive. Fiserv and Akamai added as newer named adopters. Source: Visa's own Dec 2025 press release.
- **AdCP (Ad Context Protocol)** — Now governed by the nonprofit trade association AgenticAdvertising.org, which has grown past 140 members (148+ confirmed live); spec has advanced to version 3.x. Source: agenticadvertising.org and docs.adcontextprotocol.org, both opened directly.
- **ACS (Agentic Commerce Suite)** — At Stripe Sessions 2026 (April 29, 2026), Stripe added a Link agent wallet, new partnerships with Google (Gemini/AI Mode via UCP) and Meta (native Facebook checkout), and co-authored the Machine Payments Protocol with Tempo. Source: Stripe's own blog, opened directly.

**Unchanged (verified, no qualifying change found):** MCP, ACP, UCP, AAMP (still in draft/public comment through Oct 22, 2026), NLWeb, UID2.

## 3. New terms discovery

**Sources checked:**
- Greg Stuart's podcasts: "Decoding AI for Marketing" published 2 episodes in the window (Sept 8: Mike Lane/Fluency — "Frankenstack", already in the dictionary as a prior Term of the Week; Aug 25: Zack Kass — "Automation Boundary", new). "Building Better CMOs" published **zero** new episodes in September 2026 (last episode July 22, 2026) — nothing to mine there this month.
- Broader trade press (Adweek, Digiday, AdExchanger, Search Engine Land, eMarketer, Advertising Week, MarTech, TechCrunch): surfaced several candidates, most of which turned out to already be in the dictionary (ACP, AP2, Share of Model) once cross-checked against the 367-term export. One genuinely new, well-sourced candidate passed the strict relevance filter: **Vibe Marketing**.

**Added (2):**
1. **Vibe Marketing** — AI-assisted marketing workflow where the marketer states outcome/tone/audience in natural language and AI tools handle execution. Derives from "vibe coding" (Andrej Karpathy, Feb 2025). Sources: eMarketer, Advertising Week, MarTech.
2. **Automation Boundary** — The practical line between what a brand lets AI agents handle and what stays human, per Zack Kass (former OpenAI Head of Go-to-Market), discussed on MMA's own Decoding AI for Marketing podcast (Aug 25, 2026 episode, recorded at MMA's CMO & CEO Summit). Sources: podcast episode notes, ACEDS blog (independent corroboration).

**Rejected candidates and why:**
- ACP, AP2, Share of Model (SoM) — already in the dictionary (duplicates).
- Ant International's Agentic Mobile Protocol (AMP) — real and recent, but an Asia-Pacific mobile-wallet payments protocol; fails the "would a Türkiye/MEA marketer realistically meet this" filter.
- Data clean rooms, composable CDP, context engineering, zero-party data, dark funnel, llms.txt, "Chief AI Officer" as a title, nano-influencers — all established concepts (12+ months old) re-surfacing in 2026 trend coverage, not newly coined or newly mainstream. Did not pass the strict relevance/novelty filter.
- Cloudflare "Pay Per Crawl" — real but developer/publisher-infrastructure, not something a brand marketer encounters directly.

## 4. Independent fact-check gate (mma-fact-checker)

Checked all 2 new entries and all 7 changed status lines. Found and the following were fixed before anything was built:
1. **Vibe Marketing** — a specific statistic ("practitioner community of 2,600+ members across 47 countries within eight months") did not appear in either cited source (Advertising Week, MarTech) and could not be found anywhere else. Removed from both `usage_context` and `long_explanation`; replaced with verifiable content from the same sources.
2. **Automation Boundary** — Zack Kass's former OpenAI title corrected from a paraphrase ("go-to-market lead") to his exact title, "Head of Go-to-Market."
3. **x402 status line** — Microsoft was incorrectly listed as a supporting Foundation member; removed and replaced with AWS, which Coinbase's own foundation page confirms as an actual member.

All other items passed as drafted, each against a source the fact-checker opened directly (vendor page, standards-body site, or Stripe's own blog).

## 5. Build and validation

- `uv run --quiet --with openpyxl python tools/add_sozluk_terms.py`: total=369, added=267 (267 is cumulative across all prior runs, not just this month). One pre-existing duplicate-term warning (`viewability`) unrelated to this month's changes.
- `python3 tools/build_public.py`: **leaks=[]**, public records=321, term pages=321.
- Raw record count: 367 → 369 (+2, matches the 2 new items exactly).
- Every public record has a non-empty TR Definition.
- No em-dashes in either new entry's text.
- `dist/term/vibe-marketing/index.html` and `dist/term/automation-boundary/index.html` both exist.

## 6. Deploy — completed

`cd dist && vercel deploy --prod --yes` was blocked on the first pass by the Claude Code auto-mode permission classifier (consequential production-deploy action), consistent with the 2026-09-28 Term of the Week run. The user approved the deploy; the first attempt then returned `{"status":"error","reason":"deploy_failed","message":"Not authorized"}` even though `vercel whoami` and `vercel project ls` both worked — a team-scope mismatch, not an auth failure. Retrying with `vercel deploy --prod --yes --scope serkans-projects-a99e9e5f` succeeded and aliased to the production domain.

Verified: `https://mma-academy-dictionary.vercel.app/`, `.../term/vibe-marketing/`, and `.../term/automation-boundary/` all return HTTP 200.

## 7. Rollback (if needed after deploy)

Geri almak için: `backup-2026-10-01-auto` içindeki dosyaları geri kopyalayıp `tools/add_sozluk_terms.py` ve `tools/build_public.py`'yi çalıştır, sonra `dist` içinde `vercel deploy --prod --yes`; ya da Vercel panelinden önceki deployment'a Promote.

## Sources opened across all research (non-exhaustive, see individual agent reports for full lists)

anthropic.com, pymnts.com, fidoalliance.org, aaif.io, linuxfoundation.org, docs.cdp.coinbase.com, theblock.co, ppc.land, usa.visa.com, agenticadvertising.org, docs.adcontextprotocol.org, stripe.com/newsroom, stripe.com/blog, adexchanger.com, aceds.org, podcasts.apple.com, castbox.fm, bettercmos.com, emarketer.com, advertisingweek.com, martech.org.
