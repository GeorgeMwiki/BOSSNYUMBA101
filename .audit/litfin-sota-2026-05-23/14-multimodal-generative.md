# Multi-modal Generative Content — SOTA 2026 Research

**Date:** 2026-05-23
**Scope:** Image, video, voice/audio, multi-modal foundation models, reference-style transfer,
property-specific use cases (virtual staging, 3D capture, sky replacement), brand-consistent
generation, OSS pipelines, pricing/quota strategy.
**Audience:** BOSSNYUMBA101 platform engineering — informs the "Content Studio" extension to
`@bossnyumba/marketing-brain` and a new `@bossnyumba/content-studio` package.
**Method:** WebSearch + WebFetch across vendor docs, leaderboards, and 2026-dated reviews.

---

## 0. TL;DR — what to use for what

| Job | Pick (May 2026) | Fallback / OSS |
|---|---|---|
| Photoreal property hero shot | **Imagen 4 Ultra** (Vertex) or **Flux 1.2 Pro Ultra** | SD 3.5 Large + Flux LoRA |
| Listings text-on-image (signage, watermarks, brochures) | **Ideogram 3.0** | gpt-image-1 |
| Brand-system vector (logos, icons, PDF covers) | **Recraft V3** | Figma + manual |
| Conversational edit / virtual restage from photo | **Nano Banana Pro** (Gemini 3 Pro Image) + **Flux Kontext Pro** | SDXL + IP-Adapter |
| Property "sizzle reel" 8–15s | **Veo 3.1** (audio+video native) | Runway Gen-4 Turbo |
| Static photo → walkthrough video | **Kling 2.6 / 3.0** (i2v) | Hailuo 2.3, Luma Ray3 |
| Long-form narrated tour | **Veo 3.1 Scene Extension** + ElevenLabs v3 | Runway Gen-4 + 11Labs |
| Open-weights video on a tenant GPU | **Wan 2.2 (MoE)** | HunyuanVideo 1.5 |
| Multilingual narration (Swahili, Sheng, Luganda, Hausa, Yoruba) | **ElevenLabs v3** (70+ langs incl. Swahili, Hausa) + **Spitch** (Yoruba/Igbo/Hausa) + **Lelapa Vulavula** (Bantu/SA) | YarnGPT (NG) |
| Real-time voice agent (Mr. Mwikila phone calls) | **OpenAI gpt-realtime-2** (~1s e2e) or **Cartesia Sonic-2** (40 ms TTFB) | Deepgram Aura-2 + Whisper Turbo |
| Speech-to-text for inbound calls | **Whisper Large v3 Turbo** (multi-lang) | NVIDIA Parakeet (EN only, 6.5× faster) |
| Soundtrack / jingle | **Suno v5.5** (commercial rights on Pro/Premier) | Udio Standard |
| Virtual staging | **Reimagine Home** API or roll-your-own with Flux Kontext + masking | RoomGPT (cheap) |
| Sky replacement / dehaze | Topaz Photo / Luminar Sky AI (desktop) | OSS: Real-ESRGAN + masked outpaint |
| 3D walkthrough of a unit | **Polycam Gauss** (mobile, $8/mo) or **Postshot** (desktop NVIDIA RTX) | Matterport (premium hardware) |
| Floor plan from phone scan | **CubiCasa** (5–10 min capture, 24h delivery, API) | Polycam LiDAR |
| Brand consistency per tenant (estate logo, colour palette, voice) | **Flux LoRA** trained per tenant + **Recraft brand library** + **--sref** for Midjourney workflows | Adobe Firefly Style Kits |

---

## 1. Image generation SOTA (May 2026)

### 1.1 Flux family — Black Forest Labs (BFL)
- **SOTA:** *FLUX.1.2 Pro Ultra* (Feb 2026) — 4 MP photorealistic in ~1 s, ~10× faster than predecessor;
  also ships as **Flux 1.1 Pro Ultra** (still widely used at ~$0.06/img, 4 MP in 10 s).
- **Provider / repo:** BFL hosted API (`docs.bfl.ml`); on Replicate, fal.ai, Together. Open-weights
  `FLUX.1-dev` and `FLUX.1-schnell` on Hugging Face (Apache-2.0 for schnell, non-commercial for dev).
- **Property use case:** photoreal property exteriors with real architectural detail (Swahili-coast
  villas, Nairobi townhouses, Kampala bungalows). Raw mode for candid texture, Ultra mode for
  brochure-ready composition.
- **BOSSNYUMBA build:** `packages/content-studio/src/providers/flux-provider.ts` with a `generate({
  prompt, mode: 'ultra'|'raw', aspect, count })` typed wrapper. Cache by content-hash. Sources:
  [BFL Ultra](https://bfl.ai/models/flux-pro-ultra), [Replicate Flux 1.1 Pro](https://replicate.com/black-forest-labs/flux-1.1-pro).

### 1.2 Ideogram 3.0 — best text-in-image
- **SOTA:** Ideogram 3.0 (released Mar 2025, still SOTA for text rendering in May 2026 — 90–95%
  accuracy on embedded text vs 30–40% for MJ/SD). Turbo $0.03/img, Quality $0.09/img.
- **Provider:** ideogram.ai API, Together AI, Segmind. Four style types, three speed tiers, 512–1536px grid.
- **Property use case:** "FOR RENT" placards, "Apartment 4B — Westlands" hero banner, social-post
  graphics with legible price tags in KES/UGX/TZS, branded property brochures.
- **BOSSNYUMBA build:** `packages/content-studio/src/providers/ideogram-provider.ts`. Use for any
  text-baked asset (PDF covers, watermarked listings, social grids).

### 1.3 Recraft V3 / V4 — brand & vector
- **SOTA:** Recraft V3 (red_panda) → V4 — only mainstream AI tool that generates **native SVG vectors**
  (not raster-traced). Top of Artificial Analysis text-to-image benchmark. Built-in brand-style
  library: upload references, AI learns identity, applies to subsequent generations.
- **Provider:** recraft.ai, fal.ai (`fal-ai/recraft/v3/text-to-image`).
- **Property use case:** per-tenant logo/wordmark, icon sets for the estate manager UI, vector floor-plan
  decorations, PDF covers for owner reports.
- **BOSSNYUMBA build:** wire Recraft as the vector branch of Content Studio. Map each `tenant_brand`
  row → Recraft style preset; persist `recraft_style_id` on the tenant.

### 1.4 Imagen 4 / 4 Ultra / 4 Fast (Google)
- **SOTA:** Imagen 4 family GA in Gemini API + AI Studio (Feb 2026). Ultra = best photoreal output of
  any public API; up to 2K res; improved text. Pricing: Fast $0.02, Standard ~$0.04, Ultra ~$0.06–$0.08/img.
- **Provider:** Gemini API (`models/imagen-4*`), Vertex AI, AI Studio.
- **Property use case:** ultra-photoreal exterior renders for high-value listings; safer commercial
  licensing than community-trained open weights.
- **BOSSNYUMBA build:** add Vertex provider next to Anthropic in the brain router; route "photoreal
  hero" jobs to Imagen 4 Ultra by default.

### 1.5 Gemini "Nano Banana" / "Nano Banana Pro"
- **SOTA:** native multimodal image-in/image-out — **Gemini 3 Pro Image Preview** ($0.134/img),
  **Gemini 3.1 Flash Image Preview** ($0.045/img), **Gemini 2.5 Flash Image** ($0.039/img).
- **Property use case:** *conversational editing* — "remove the car from the driveway, swap the sofa
  for a beige three-seater, add evening lighting". This is the **virtual staging** workhorse because
  it preserves identity while editing locally; cheaper and faster than Flux Kontext for many edits.
- **BOSSNYUMBA build:** Nano Banana is the default "edit a listing photo" backend. Wrap as
  `packages/content-studio/src/providers/gemini-image-provider.ts`. Multi-turn loop for iterative refines.

### 1.6 OpenAI gpt-image-1 (DALL-E successor)
- **SOTA:** native-multimodal LLM with image output (released Mar 2025). DALL-E 3 retired Mar 2026.
  Pricing $0.02/$0.07/$0.19 for low/med/high square. Image edits + inpainting endpoint.
- **Property use case:** when the user is already in an OpenAI Realtime voice session and asks
  "show me what that room would look like with the staging" — generate inline.

### 1.7 Midjourney v7 (and v8 in beta)
- **SOTA:** v7 with revamped `--sref` (six versions via `--sv`) for style-reference. v8 in private beta.
  **No production-grade public API**; 2025 closed beta has severely limited access.
- **Property use case:** designer-led brand-mood exploration during onboarding of a new tenant.
  Not for automated production pipelines.
- **BOSSNYUMBA verdict:** skip for automation; use only inside the brand-onboarding human workflow.

### 1.8 Anthropic Claude — image gen status
- **Status (May 2026):** Claude *does not* natively generate raster images. Generates **SVG/React
  artifacts** (Claude Design, launched 2026). Vision input up to 2,576px (Opus 4.7).
- **Property use case:** generate styled HTML/SVG owner reports and inline charts (already aligned
  with `@bossnyumba/genui`); pair with a raster provider above for photographic content.

### 1.9 Stable Diffusion 3.5 (Stability AI)
- **SOTA:** SD 3.5 Large (8B), Large Turbo, Medium (2.5B). **Free for commercial use up to $1M ARR**.
- **Property use case:** on-prem option for tenants who require data sovereignty (e.g., a corporate
  landlord that refuses cloud uploads). Train per-tenant LoRA for brand consistency.
- **BOSSNYUMBA build:** add SD 3.5 as the *self-hosted fallback* through ComfyUI on a tenant GPU box.

### 1.10 ControlNet, IP-Adapter, T2I-Adapter, InstantID
- **What they do:** add spatial / pose / depth / reference-style control on top of any diffusion model.
  Flux ControlNet Union and **InstantX Flux IP-Adapter** (Nov 2024) bring SDXL-grade conditioning to Flux.
- **Property use case:** preserve exact wall geometry of an existing photo while restyling decor
  (ControlNet Canny + IP-Adapter style) — non-negotiable for honest virtual staging.
- **BOSSNYUMBA build:** ship a **ComfyUI workflow JSON** in `packages/content-studio/workflows/` for
  "preserve geometry, restyle decor" and call via ComfyDeploy.

### 1.11 LoRA training for brand consistency
- **Recipe:** 15–30 reference images of the tenant's existing brand (signage, brochures, hero shots)
  → train a Flux/SDXL LoRA in 1–3 GPU-hours. Cost ~$2–$10 per LoRA on Replicate/fal.
- **Property use case:** every tenant brand gets a per-tenant LoRA. Marketing assets injected with
  `--lora tenant_id_v1` keep colour/typography/architectural style consistent across all generations.

---

## 2. Video generation SOTA

### 2.1 Sora 2 (OpenAI) — IMPORTANT STATUS CHANGE
- **Status:** Sora app shutting down **2026-04-26**; **Videos API deprecated, sunsets 2026-09-24**.
  Do not build new dependencies on it.
- **Capability (historic):** synchronized dialogue + sound effects, strong physics.

### 2.2 Veo 3 / Veo 3.1 (Google) — current king for production
- **SOTA:** **Veo 3.1** + **Veo 3.1 Lite** (50% cheaper than 3.1 Fast). Native audio (dialogue,
  ambient, SFX). Scene Extension for 1 min+ clips. Image-to-video, frame-to-frame transition between
  two stills (perfect for "empty room → staged room" reveals). 720p/1080p, 16:9 + 9:16, upscaling to 4K.
- **Provider:** Gemini API + AI Studio (paid tier), Vertex AI.
- **Property use case:** 8–15 s narrated walk-throughs synced with Swahili/English voice; vertical
  9:16 reels for TikTok / Instagram / WhatsApp Status; bridge "before staging → after staging" stills
  into a single transition clip.
- **BOSSNYUMBA build:** Veo 3.1 is the **default video backend**.
  `packages/content-studio/src/providers/veo-provider.ts`.

### 2.3 Runway Gen-4 / Gen-4 Turbo
- **SOTA:** Gen-4 Turbo — 10-s clips in ~30 s, ~5× faster than Gen-4, all common aspect ratios.
  Commercial rights on Standard/Unlimited/Enterprise tiers.
- **Property use case:** fast-turnaround social cuts; agency-style editing in Runway UI for the
  marketing team. Use when Veo quota is tight.

### 2.4 Kling 2.6 / 3.0 (Kuaishou)
- **SOTA:** **Kling 3.0** (Feb 2026): 15 s clips, native 4K, 60 FPS, 3 new lip-sync languages.
  Kling 2.6 (Dec 2025): simultaneous audio+visual generation in one pass.
- **Provider:** klingai.com, Fal.ai, WaveSpeed; ~$0.07–$0.14/sec of generated video.
- **Property use case:** highest-fidelity image-to-video — feed in a single hero photo, get a slow
  cinematic camera dolly.

### 2.5 Luma Dream Machine — Ray 3 / Ray 3.14
- **SOTA:** Ray3 (studio-grade, HDR) + Ray3.14 (4× faster, 3× cheaper, 1080p native). 3D-aware,
  excellent for architectural walkthroughs.
- **Property use case:** cinematic architectural reveal, "drone-style" exterior fly-around from a
  single still.

### 2.6 Pika 2.5
- **SOTA:** Scene Ingredients, Pikaframes (first/last frame transitions), Pikaformance (near-real-time
  lip-sync talking images).
- **Property use case:** lip-sync a property manager's headshot to a recorded WhatsApp voice message.

### 2.7 Hailuo 2.3 (MiniMax)
- **SOTA:** Oct 2025 release; better motion + lighting. Anime/illustration/ink styles added.
- **Property use case:** cheap "good-enough" social cuts at scale.

### 2.8 Open-weights video
- **Wan 2.2 (Alibaba)** — first OSS video model with Mixture-of-Experts; high-/low-noise expert
  split; runs on commodity GPUs.
- **HunyuanVideo 1.5 (Tencent)** — 13 B params; 15-s @ 720p with audio.
- **LTXVideo 13B** — fast 1080p generation.
- **Mochi 1 (Genmo)** — open Apache-2.0.
- **Property use case:** self-host on tenant infrastructure for data-sovereign generation; cheap
  bulk production of "social filler" clips.

### 2.9 Adobe Firefly Video
- **SOTA:** Style Kits (Feb 2026) — pre-trained brand profiles constrain output to brand guidelines.
  12 third-party models integrated. **Commercially safe** (trained on Adobe Stock + public domain).
- **Property use case:** enterprise tenants needing IP indemnification (e.g., listed REITs).

---

## 3. Voice / audio SOTA

### 3.1 ElevenLabs v3 — best multilingual + emotional
- **SOTA:** Eleven v3 — 70+ languages, audio tags (`[laughs] [whispers]`), Text-to-Dialogue API,
  3,000 char/req limit. Multilingual v2 still production-grade for stable batch jobs. Conversational
  AI v2 for full voice-agent pipelines.
- **African language coverage:** Swahili, Somali, Lingala, Hausa, Chichewa explicitly listed.
- **Property use case:** narrated property tours in Swahili/English; multilingual phone agent for
  Mr. Mwikila; emotional intonation when delivering "your rent is overdue" with appropriate empathy.

### 3.2 OpenAI gpt-realtime-2 / -translate / -whisper
- **SOTA:** GPT-Realtime-2 is the primary agentic voice model (GPT-5-class reasoning).
  Function-call latency 400–800 ms; end-to-end achievable <1 s in production.
- **Property use case:** Mr. Mwikila phone calls — "find me a 2-bedroom in Kileleshwa under 80k,
  schedule a viewing Saturday". Already cited by OpenAI for Zillow.

### 3.3 Cartesia Sonic-2 / Sonic-Turbo / Sonic-3
- **SOTA:** Sonic-Turbo holds TTFB record at **40 ms**, SSM (State-Space) architecture — stable under
  load. $0.038 per 1k chars.
- **Property use case:** snappiest possible interruption/barge-in for the inbound call agent.

### 3.4 Deepgram Aura-2
- **SOTA:** 90 ms TTFB, $0.030 per 1k chars (cheaper than 11Labs Flash and Sonic-2), 7 langs sub-200 ms.
  Enterprise pronunciation accuracy.
- **Property use case:** high-volume tenant-facing IVR (rent reminders, payment confirmation).

### 3.5 Suno v5.5 (Mar 2026)
- **SOTA:** Voices (clone your own voice and sing), Custom Models (fine-tune on tracks), My Taste,
  8 min length, 1,200+ genre tags. Commercial rights on Pro ($10/mo) + Premier ($30/mo). WMG/UMG
  settlements closed (Nov 2025); Sony still litigating.
- **Property use case:** branded jingle per estate, background tracks for property reels.

### 3.6 Udio
- **SOTA:** pristine instrumental quality. Better for corporate BGM than vocal-heavy tracks.
- **Property use case:** background music for owner-report video summaries.

### 3.7 Stability Audio 2 / Meta Voicebox / Audiobox
- Niche; not recommended as primary path.

### 3.8 STT — WhisperX, Whisper Turbo, NVIDIA Parakeet
- **Whisper Large v3 Turbo** — 6× faster than Large v3, accuracy within 1–2%, 99+ languages. The
  practical default for multilingual STT.
- **NVIDIA Parakeet TDT 1.1B** — fastest on Open ASR leaderboard (RTFx >2000) but **English only**.
- **Use case:** Parakeet for real-time English transcript of tenant calls; Whisper Turbo for any
  non-English (Swahili, Sheng, Luganda, Hausa, Yoruba inbound voice).

---

## 4. Multilingual TTS for African languages

| Language | Best provider (May 2026) | Notes |
|---|---|---|
| Swahili | **ElevenLabs v3** | Officially supported in 70+ langs; emotional control |
| Hausa | ElevenLabs v3 / **Spitch** | Spitch is Nigeria-focused, simple API/SDK |
| Yoruba | **Spitch** / YarnGPT | Spitch better quality; YarnGPT free OSS Nigerian TTS |
| Igbo | **Spitch** | Nigerian-accented English + 3 langs (Oct 2024 launch) |
| Luganda | **ElevenLabs v3** (general coverage) or fine-tuned XTTS | Limited; consider fine-tuning open model |
| Sheng (Nairobi creole) | ElevenLabs v3 with code-switched prompting | No native model; mix Swahili + English voice with code-switch script |
| isiZulu, Sesotho, Afrikaans | **Lelapa AI Vulavula** | South-African focused; transcription + analysis + TTS |
| Lingala, Chichewa, Somali | ElevenLabs v3 | Officially listed |

**Architectural note:** put a `LanguageRouter` in `@bossnyumba/content-studio/voice` that picks
provider by `(language, latency_budget, cost_tier, emotional_range_needed)`. Route Yoruba/Igbo to
Spitch, Swahili/Hausa/Lingala to 11Labs v3, SA-Bantu to Lelapa.

---

## 5. Reference-style transfer techniques

| Technique | Strength | When to use |
|---|---|---|
| **IP-Adapter** (single ref) | Apply style of one image | "make this listing look like our hero shot" |
| **InstantID** | Identity-preserving from one face/object | property-manager avatars in marketing |
| **OmniGen** | Encoder-based personalization | near-instant edits; some identity loss vs DreamBooth |
| **Style-Aligned** | Cross-image style consistency | batch of 10 listing photos in one look |
| **DreamBooth + LoRA** | Highest fidelity; needs ~15 imgs + GPU-hours | per-tenant brand LoRA |
| **Flux Kontext Pro/Max** | In-context multimodal edit (text+image prompt) | "remove the car" — fastest hosted option |
| **ControlNet Union** | Multi-conditioning (depth, canny, pose, normal) | preserve room geometry while restyling decor |

---

## 6. Property-specific use cases

### 6.1 Virtual staging
- **Reimagine Home** (Styldod) — purpose-built, trained on real staging projects; from $19/mo, API
  available.
- **RoomGPT** — casual; credit model ($9 = 30 credits ~ 3 rooms with retries).
- **DIY**: Flux Kontext + mask + IP-Adapter style ref (best control, no per-room cost beyond compute).
- **Recommend:** wire Reimagine Home as the off-the-shelf MVP; ship the Flux+ComfyUI workflow as the
  premium tier with per-tenant brand LoRA.

### 6.2 Image enhancement / sky replacement
- **Skylum Luminar Sky AI** — one-click sky replacement, real-estate library presets.
- **Topaz Photo AI** — sharpen, denoise, upscale (rescue blurry phone shots before listing).
- **OSS:** Real-ESRGAN (upscale), MODNet/InSPyReNet (matting), masked outpaint via Flux Fill.
- **Recommend:** ship an "enhance" button that pipelines `Topaz-style upscaler → sky/dehaze → Flux
  Fill outpaint to fix crops`.

### 6.3 Floor-plan to 3D
- **Matterport** — premium hardware + service; gold standard; APIs + MLS integrations.
- **CubiCasa** — phone scan in 5–10 min, 2D + 3D + CAD delivered in 24–48 h; API for embedding.
- **Polycam** — mobile LiDAR floor plan + Gaussian Splat.
- **Recommend:** CubiCasa is the unit-economics sweet spot for African market (no Matterport
  hardware needed). Add a `@bossnyumba/connectors/cubicasa` connector.

### 6.4 3D Gaussian Splatting (3DGS)
- **SOTA producers:** Polycam Pro ($150/yr) for mobile capture; **Postshot** (Jawset) for desktop
  (NVIDIA RTX 2060+, unlimited free, 4K training, live preview).
- **Adoption:** Zillow shipped SkyTours (3DGS) first; Apartments.com added exterior 3DGS via Matterport.
- **Property use case:** photoreal real-time walkthrough that runs in a browser via gsplat.js or
  Spz/Spv viewers — the next-gen replacement for 360° photos.
- **BOSSNYUMBA build:** add `<GaussianSplatViewer>` component in `@bossnyumba/design-system`; accept
  `.spz`/`.splat` files; store in tenant object storage; CDN-serve to listing pages.

### 6.5 AI virtual property tours
- **Giraffe360** — automated robotic camera + virtual tour pipeline.
- **Asteroom** — phone-scan-only virtual tour.
- **Recommend:** wrap Giraffe360 for premium tenants; CubiCasa + 3DGS for self-serve tier.

---

## 7. Brand-consistent generation per tenant

### 7.1 Recipe
1. **Onboard** the tenant brand: upload 15–30 reference assets (logos, signage, hero shots, brochures).
2. **Extract brand tokens** (Recraft brand library + Adobe Firefly Brand Pack style): primary/
   secondary colours (OKLCH), typography, geometric motifs, photographic style.
3. **Train a tenant LoRA** on Flux (Replicate `ostris/flux-dev-lora-trainer` style) — 1–3 GPU-hours,
   ~$2–$10. Store `lora_id` on the tenant.
4. **Generate** with `style_ref + lora_id + brand_palette` triple. Recraft generates vectors; Flux
   generates rasters; Veo applies brand colour grading via `style_kit_id` reference frame.

### 7.2 Cross-platform style codes
- **Midjourney**: `--sref <code>` + `--sv 6` for v7. Useful for designer-mood exploration only (no API).
- **Adobe Firefly Style Kits** — enterprise; commercially safe; tenants who need IP indemnification.

---

## 8. Multi-modal foundation models

| Model | Strength | BOSSNYUMBA fit |
|---|---|---|
| **Claude Opus 4.7 / Sonnet 4.6** | Best agentic reasoning; vision up to 2,576 px (~3.75 MP) | Already the brain |
| **Gemini 3 Pro / 2.5 Pro** | Native multimodal in/out (incl. Nano Banana image gen) | Image gen + edit + understanding in one call |
| **GPT-5o (and gpt-realtime-2)** | Realtime voice + vision | Voice agents |
| **Pixtral, Molmo, NVLM** | OSS vision LLMs | Self-host tier for inspection photo analysis |

**Recommendation:** keep Anthropic as the orchestrator brain (Claude Opus 4.7), route generative
sub-tasks to specialist models (Imagen 4 Ultra, Veo 3.1, Nano Banana, Flux Kontext, Recraft, 11Labs)
via the model router we already have for LLMs.

---

## 9. OSS pipelines

| Tool | Use case | Note |
|---|---|---|
| **ComfyUI** | Node-graph workflows for any diffusion model | Industry-default for production diffusion pipelines |
| **ComfyDeploy** | "Vercel for ComfyUI" — version, deploy, scale | TS/Python/Ruby SDKs, staging+prod envs |
| **Replicate** | Hosted any-model API incl. `fofr/any-comfyui-workflow` | Easiest first-step deploy |
| **fal.ai** | Lowest-latency hosted diffusion | Best for interactive UX |
| **InvokeAI** | Pro UI / self-hosted | Studio tier |
| **A1111 / Fooocus / Forge** | Power-user UIs | Skip for prod |

**BOSSNYUMBA recommend:** check workflow JSONs into `packages/content-studio/workflows/` and deploy
via ComfyDeploy → API endpoints consumed by content-studio providers. Promote workflows from
staging → prod with versioning.

---

## 10. Pricing / quota strategy

### 10.1 Cost cheat sheet (May 2026, per asset)

| Asset | Provider | $/unit |
|---|---|---|
| 1024² image | gpt-image-1 medium | $0.07 |
| 4 MP photoreal | Flux 1.1 Pro Ultra | $0.06 |
| 1024² with text | Ideogram 3.0 Turbo | $0.03 |
| 1024² Imagen 4 Fast | Vertex | $0.02 |
| 2K Imagen 4 Ultra | Vertex | ~$0.06–$0.08 |
| Vector logo | Recraft V3 | ~$0.04 |
| Nano Banana edit | Gemini API | $0.039 |
| Nano Banana Pro | Gemini API | $0.134 |
| 10 s Runway Gen-4 Turbo | Runway | ~$0.50–$1.00 |
| 10 s Kling 2.6 | Fal.ai | ~$0.70–$1.40 |
| Veo 3.1 Lite 8 s | Vertex | <50% of Veo 3.1 Fast |
| 1k chars 11Labs v3 | ElevenLabs | $0.05 |
| 1k chars Sonic-2 | Cartesia | $0.038 |
| 1k chars Aura-2 | Deepgram | $0.030 |
| 1 song 5 min | Suno Pro | flat $10/mo |

### 10.2 Quota strategy
- **Per-tenant content budget** (KES) → token-bucket per provider class (image/video/voice).
- **Subscription tiers**: Starter (200 image-credits/mo, 50 voice-credits, no video) → Pro (2000
  image, 500 voice, 30 video sec) → Premium (unlimited cached + brand LoRA).
- **Cache aggressively** by `hash(prompt|model|seed|style_ref)` — most listings reshare a hero asset.

### 10.3 On-device vs cloud
- **Apple Neural Engine**: CoreML conversions of SDXL / SD 3.5 Medium run on iPhone 15 Pro+ and
  iPads — useful for the **estate-manager-app** (mobile inspections do on-device denoising/dehaze
  before upload to save bandwidth in low-connectivity Kenyan/Ugandan/Tanzanian areas).
- **Snapdragon AI (Snapdragon X Elite / 8 Gen 4)** — on-device Stable Diffusion / Llama runs.
- **Cloud**: keep all expensive generation server-side under tenant credits; bill via existing
  Stripe.

---

## "Content Studio" reference architecture

```
@bossnyumba/content-studio          NEW package
├── src/
│   ├── types.ts                    Generation request/response, brand profile, asset metadata
│   ├── router.ts                   Picks provider by (job, language, budget, latency, brand)
│   ├── providers/
│   │   ├── flux-provider.ts        BFL / Replicate / fal
│   │   ├── ideogram-provider.ts    Ideogram 3.0 (text-in-image)
│   │   ├── recraft-provider.ts     SVG/vector
│   │   ├── imagen-provider.ts      Vertex Imagen 4 family
│   │   ├── nano-banana-provider.ts Gemini image edit (default for edits)
│   │   ├── gpt-image-provider.ts   OpenAI gpt-image-1
│   │   ├── veo-provider.ts         Veo 3.1 / 3.1 Lite (default video)
│   │   ├── runway-provider.ts      Gen-4 Turbo
│   │   ├── kling-provider.ts       Kling 2.6 / 3.0 (highest fidelity i2v)
│   │   ├── reimagine-home.ts       Virtual staging API
│   │   ├── cubicasa-provider.ts    Floor plan API
│   │   └── self-hosted/
│   │       ├── comfy-deploy.ts     Call deployed ComfyUI workflows
│   │       └── sd35-lora.ts        Tenant-LoRA generation on tenant GPU
│   ├── voice/
│   │   ├── eleven-labs-v3.ts       Multilingual + emotional
│   │   ├── spitch-provider.ts      Yoruba / Igbo / Hausa
│   │   ├── lelapa-vulavula.ts      isiZulu / Sesotho / Afrikaans
│   │   ├── openai-realtime.ts      Realtime agent
│   │   ├── cartesia-sonic.ts       Lowest TTFB
│   │   ├── deepgram-aura.ts        Cheap high-volume
│   │   ├── whisper-turbo.ts        Multilingual STT
│   │   └── language-router.ts      (language, latency, cost) → provider
│   ├── brand/
│   │   ├── brand-profile.ts        Tenant brand tokens (OKLCH, fonts, motifs, photo style)
│   │   ├── lora-trainer.ts         Train per-tenant Flux LoRA on Replicate
│   │   └── style-pack.ts           Maps to Recraft brand library + Firefly Style Kits
│   ├── workflows/                  ComfyUI workflow JSON
│   │   ├── virtual-staging.json    Flux Kontext + ControlNet (preserve geometry)
│   │   ├── sky-replace.json        Mask sky + outpaint clean sky
│   │   ├── dehaze-enhance.json     Real-ESRGAN + Flux Fill
│   │   └── floor-plan-stylize.json
│   ├── cache.ts                    Content-hash cache; KV-backed
│   ├── quota.ts                    Per-tenant token-bucket per provider class
│   └── audit.ts                    Provenance log (C2PA-style) for every generated asset
└── package.json
```

The router and quota plug into existing `@bossnyumba/central-intelligence` tool registry, so the
brain can call Content Studio as a tool. Outputs persist via `@bossnyumba/database` with a new
`generated_assets` table (`tenant_id, asset_type, provider, model, prompt_hash, brand_lora_id,
cost_cents, c2pa_manifest, storage_url, listing_id, created_by`).

---

## 15 property-management content workflows worth automating

1. **One-tap listing kit** — phone photo upload → dehaze + sky replace + restage in 3 styles + brand
   watermark + Swahili/English caption + 9:16 reel + 1:1 grid + PDF brochure. (Flux Kontext + Veo
   3.1 + Ideogram + 11Labs v3.)
2. **Virtual staging variants** — same empty room, 5 furnishings (modern, classic, family,
   minimalist, executive). (Nano Banana Pro multi-turn.)
3. **Photo enhancement batch** — bulk upscale, denoise, white-balance fix, perspective correction
   for existing listing libraries. (Topaz/OSS pipeline.)
4. **Sky-of-the-day** — automatic golden-hour sky for any listing shot at midday. (Luminar Sky AI
   or Flux outpaint.)
5. **Floor-plan to interactive tour** — CubiCasa scan → 2D plan + 3D model + 3DGS walkthrough
   embedded on listing page. (CubiCasa + Polycam Gauss + gsplat viewer.)
6. **Property "sizzle reel"** — 8-s exterior fly-around + 8-s interior pan + agent voiceover + jingle.
   (Veo 3.1 + Luma Ray3 + 11Labs + Suno.)
7. **AI-narrated virtual tour** — guided walkthrough with multilingual narration (Swahili, English,
   Sheng) and on-screen feature callouts. (Veo + 11Labs v3 + GenUI captions.)
8. **Owner monthly report PDF** — branded cover, charts, occupancy timeline, AI-generated property
   "story", in tenant's brand style. (Claude artifacts + Recraft cover + python-docx/pdf pipeline.)
9. **Maintenance request triage video** — tenant uploads phone clip → Claude vision summarises
   "leaking pipe under kitchen sink" → routed to plumber. (Whisper Turbo + Claude vision; no
   generation needed.)
10. **Branded jingle / on-hold music** per estate. (Suno v5.5 Pro.)
11. **Voice agent in 5 languages** — phone-answering Mr. Mwikila for rent reminders, viewing
    bookings, maintenance intake. (gpt-realtime-2 + Spitch/Lelapa/11Labs routed.)
12. **Social campaign per property** — 30-day calendar of IG / FB / TikTok / WhatsApp posts with
    on-brand visuals. (Recraft + Ideogram + Veo 3.1 Lite + scheduling.)
13. **Comparable-listing comp sheet** — auto-render comparable units in matching brand style for
    market analyses. (Flux + Recraft.)
14. **Tenant move-in welcome kit** — personalized PDF + voice greeting in tenant's preferred language.
    (Claude + 11Labs v3 + PDF.)
15. **Compliance signage** — fire-exit, COVID, "no smoking" posters in EN/SW/LG in each tenant's
    brand. (Ideogram 3.0 text-in-image + brand LoRA.)

---

## What BOSSNYUMBA already has

Inventory (verified by repo scan):
- `@bossnyumba/marketing-brain` — text-only marketing chat brain, persona, lead-qualifier,
  pricing-advisor, blog-engine, sandbox, lead-capture, waitlist-integrator, demo-data-generator.
  **No image/video/audio generation.**
- `@bossnyumba/central-intelligence` — agent loop, tools/registry, memory, audit, maintenance-triage,
  credit-scoring. Generation-ready integration point.
- `@bossnyumba/ai-copilot` includes `document-analysis/` — vision-based document understanding (input
  side only). No content generation.
- `@bossnyumba/genui` — generative UI artifacts. Pair naturally with Claude SVG/React output for
  reports.
- `@bossnyumba/design-system` — host point for `<GaussianSplatViewer>`, branded-PDF templates.
- No existing dependencies on Replicate, fal, BFL, ElevenLabs, OpenAI Audio, Stability, Suno, or
  Vertex AI in any package.json — clean greenfield for `@bossnyumba/content-studio`.

---

## 10 concrete things to build

1. **`packages/content-studio/` package skeleton** with router, provider interface (`generate`,
   `edit`, `synthesize`, `transcribe`), quota, cache, audit.
2. **5 image providers** wired: Flux Pro Ultra (BFL), Imagen 4 (Vertex), Ideogram 3.0, Recraft V3,
   Nano Banana / Nano Banana Pro (Gemini). Pluggable via `IMAGE_PROVIDER_DEFAULT` env.
3. **2 video providers**: Veo 3.1 (default) + Runway Gen-4 Turbo (fallback); shared `i2v`, `t2v`,
   `frame-bridge` operations.
4. **Voice stack** with `LanguageRouter` → ElevenLabs v3 + Spitch + Lelapa Vulavula for synthesis;
   Whisper Large v3 Turbo for STT; `OpenAIRealtimeSession` for phone agent.
5. **Brand profile + per-tenant Flux LoRA training pipeline** (Replicate `ostris/flux-dev-lora-trainer`)
   with `train`, `version`, `promote` lifecycle persisted on tenant row.
6. **ComfyUI workflow library** (`workflows/`) for virtual staging, sky replacement, dehaze, floor
   plan stylize — deployed via ComfyDeploy; consumed through `self-hosted/comfy-deploy.ts`.
7. **Asset audit + C2PA provenance**: every generated asset stores manifest (provider, model,
   prompt hash, lora_id, seed, timestamp, tenant) — required for landlord trust + future regulatory
   AI-disclosure laws.
8. **`<GaussianSplatViewer>` component** in `@bossnyumba/design-system` + CubiCasa connector for
   floor-plan-to-3D pipeline; storage on tenant object store; CDN delivery on listing pages.
9. **"Content Studio" UI** in `apps/estate-manager-app` — generate-on-demand interface:
   chat → preview → approve → publish to listing. Wire keyboard shortcuts and brand-LoRA toggle.
10. **Quota + billing**: per-tenant content-credit ledger, plan tiers (Starter / Pro / Premium /
    Enterprise), Stripe usage records, monthly carry-over rules. Hook into existing billing.

---

## Sources

- [BFL — FLUX 1.1 Pro Ultra](https://bfl.ai/models/flux-pro-ultra)
- [BFL — FLUX.1 Tools (Fill, Kontext)](https://bfl.ai/flux-1-tools/)
- [Replicate — FLUX 1.1 Pro](https://replicate.com/black-forest-labs/flux-1.1-pro)
- [Ideogram 3.0](https://ideogram.ai/features/3.0)
- [Together AI — Ideogram 3.0](https://www.together.ai/models/ideogram-3-0)
- [Recraft](https://www.recraft.ai/)
- [fal.ai — Recraft V3](https://fal.ai/models/fal-ai/recraft/v3/text-to-image)
- [OpenAI — Sora 2](https://openai.com/index/sora-2/)
- [Google — Veo 3.1 Lite](https://blog.google/innovation-and-ai/technology/ai/veo-3-1-lite/)
- [Google AI Studio — Veo 3](https://aistudio.google.com/models/veo-3)
- [Runway — Gen-4 Research](https://runwayml.com/research/introducing-runway-gen-4)
- [MindStudio — Runway Gen-4 Turbo](https://www.mindstudio.ai/blog/what-is-runway-gen-4-turbo-video)
- [Kuaishou — Kling Video 2.6](https://ir.kuaishou.com/news-releases/news-release-details/kling-ai-launches-video-26-model-simultaneous-audio-visual)
- [Atlas Cloud — Kling 3.0 API](https://www.atlascloud.ai/collections/kling-v3)
- [Pickaxe — Top AI Video Generators 2026](https://pickaxe.co/post/top-ai-video-generators)
- [Crazyrouter — AI Video Comparison 2026](https://crazyrouter.com/en/blog/ai-video-generation-comparison-2026)
- [Wan-Video — Wan 2.1 GitHub](https://github.com/Wan-Video/Wan2.1)
- [Tencent — HunyuanVideo GitHub](https://github.com/Tencent-Hunyuan/HunyuanVideo)
- [ElevenLabs — Eleven v3](https://elevenlabs.io/v3)
- [ElevenLabs — Swahili TTS](https://elevenlabs.io/text-to-speech/swahili)
- [OpenAI — gpt-realtime](https://openai.com/index/introducing-gpt-realtime/)
- [OpenAI — Low-latency voice AI](https://openai.com/index/delivering-low-latency-voice-ai-at-scale/)
- [Deepgram — Best TTS APIs 2026](https://deepgram.com/learn/best-text-to-speech-apis-2026)
- [Deepgram — Aura-2](https://deepgram.com/learn/introducing-aura-2-enterprise-text-to-speech)
- [Cartesia — Sonic 3 docs](https://docs.cartesia.ai/build-with-cartesia/tts-models/latest)
- [Lelapa AI — Vulavula](https://lelapa.ai/products/vulavula/)
- [Vulavula — Supported Languages](https://docs.lelapa.ai/getting-started/language-support)
- [Spitch](https://spitch.app/)
- [Suno — Commercial Rights](https://dynamoi.com/learn/ai-music-distribution/suno-commercial-rights-explained)
- [Suno vs Udio 2026](https://undetectr.com/blog/suno-vs-udio-2026)
- [Reimagine Home — Virtual Staging](https://www.reimaginehome.ai/ai-virtual-staging)
- [Housing Wire — Virtual Staging 2026](https://www.housingwire.com/articles/virtual-staging-companies-apps/)
- [CubiCasa](https://www.cubi.casa/)
- [Matterport — Real Estate](https://matterport.com/industries/real-estate)
- [Polycam — Gaussian Splatting](https://poly.cam/tools/gaussian-splatting)
- [Postshot Review 2026](https://www.thefuture3d.com/software/postshot/)
- [State of Gaussian Splatting 2026](https://www.thefuture3d.com/blog/state-of-gaussian-splatting-2026/)
- [Skylum — Sky AI](https://skylum.com/luminar/sky-ai)
- [Topaz Photo](https://www.topazlabs.com/topaz-photo)
- [Adobe Firefly Video — Commercial Safety](https://www.thrumos.com/insights/adobe-firefly-commercially-safe-generative-ai-video)
- [Stability AI — Stable Diffusion 3.5](https://stability.ai/news-updates/introducing-stable-diffusion-3-5)
- [OpenAI — gpt-image-1](https://developers.openai.com/api/docs/models/gpt-image-1)
- [Google — Nano Banana](https://ai.google.dev/gemini-api/docs/image-generation)
- [Google — Imagen 4 GA](https://developers.googleblog.com/announcing-imagen-4-fast-and-imagen-4-family-generally-available-in-the-gemini-api/)
- [Anthropic Claude Design](https://creati.ai/ai-news/2026-04-24/anthropic-launches-claude-design-ai-generated-visuals/)
- [Anthropic — Claude Opus 4.7](https://www.anthropic.com/news/claude-opus-4-7)
- [Midjourney — Style Reference](https://docs.midjourney.com/hc/en-us/articles/32180011136653-Style-Reference)
- [ComfyDeploy](https://www.comfydeploy.com/)
- [Replicate — ComfyUI workflows](https://replicate.com/docs/guides/extend/comfyui)
- [Northflank — Best OSS STT 2026](https://northflank.com/blog/best-open-source-speech-to-text-stt-model-in-2026-benchmarks)
- [InstantX Flux IP-Adapter](https://comfyui-wiki.com/en/news/2024-11-22-instantx-flux-ipadapter-release)
- [Style Transfer ControlNet + IPAdapter (ComfyUI)](https://comfyui.org/en/image-style-transfer-controlnet-ipadapter-workflow)
- [Few-shot DreamBooth + LoRA (arXiv)](https://arxiv.org/abs/2510.09475)
- [TechCabal — Voice is Africa's gateway to AI](https://techcabal.com/2026/02/12/voice-is-africas-gateway-to-ai-and-google-wants-to-lead-it/)
