/**
 * CSA-1 — Canonical capability registry (PUBLIC vs INTERNAL).
 *
 * ──────────────────────────────────────────────────────────────────────
 * RT-1 — THESE ARE REASONING GUIDELINES, NOT SCRIPTS.
 *
 * Mr. Mwikila reasons FRESH per turn. He pulls from this registry to:
 *   - Verify a capability EXISTS before claiming it (guardrail).
 *   - Ground his response in user OUTCOMES (not internal mechanics).
 *   - Stay on-topic and on-persona.
 *
 * He does NOT return these strings verbatim. Each turn produces fresh,
 * context-aware language using live tenant data + current conversation
 * + tool calls (entity search, scope query, web search where relevant).
 *
 * The `example_response_pattern` field (semantically an
 * `example_reasoning_trace`) shows ONE valid shape — not THE shape.
 * The `public_description` field (semantically a `reasoning_hint`) is
 * GUIDANCE for the LLM, not a fixed string to recite.
 *
 * Variation across turns is EXPECTED and DESIRED — it proves the AI is
 * thinking, not retrieving.
 * ──────────────────────────────────────────────────────────────────────
 *
 * 50+ outcome-only capabilities Mr. Mwikila can disclose to the owner
 * WITHOUT leaking IP. Real-estate retailored — every entry frames a
 * landlord / agency / tenant / estate-manager outcome.
 *
 * Hard rules:
 *   1. user_outcome is what the OWNER gets, never what the system does.
 *   2. public_description (reasoning_hint) NEVER names a service,
 *      package, agent count, table, prompt template, file path, or
 *      downstream provider. It is GUIDANCE for the model, not copy.
 *   3. example_response_pattern (example_reasoning_trace) is ONE VALID
 *      SHAPE — Mr. Mwikila must reason fresh from live context, not
 *      recite this verbatim.
 *   4. related[] strings are foreign keys back into this registry —
 *      `requireCapability` enforces referential integrity at boot.
 *
 * The registry is a frozen module constant — no module-level mutation.
 *
 * Ported from Borjie — real-estate retailored (mining tools removed,
 * lease / rent / maintenance / viewing flows substituted).
 */

import type { CapabilityEntry } from './types.js';
import {
  CapabilityEntrySchema,
  isDisclosable,
  type CapabilityTopic,
  type CapabilityVisibility,
} from './types.js';

const ENTRIES: ReadonlyArray<CapabilityEntry> = [
  // ─────────────────────────────────────────────────────────────────
  // DRAFTING (10) — owner asks Mr. Mwikila to PRODUCE a document.
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'mwikila.draft.lease',
    topic: 'drafting',
    user_outcome: 'Owner receives a lease draft within a chat turn.',
    public_name: {
      en: 'Draft leases via chat',
      sw: 'Tengeneza mkataba wa kupangisha kwa kuzungumza',
    },
    public_description: {
      en: 'Ask Mr. Mwikila to draft a residential or commercial lease. Review fields, edit inline, lock and send when ready.',
      sw: 'Mwombe Mwikila aandae mkataba wa kupangisha (makazi au biashara). Hakiki nyanja, hariri papo hapo, funga na tuma ukimaliza.',
    },
    example_question: {
      en: 'Can you write leases?',
      sw: 'Unaweza kuandika mkataba wa kupangisha?',
    },
    example_response_pattern: {
      en: 'Yes. Tell me the property, the tenant, and the key terms. For example, "draft a 12-month residential lease for Unit 4B, Acme Heights, tenant Mary Wanjiku, monthly rent KES 65,000, 1-month deposit." I will produce the draft, you review the fields, then we lock and send.',
      sw: 'Ndio. Niambie nyumba, mpangaji, na masharti makuu. Kwa mfano, "andaa mkataba wa miezi 12 wa Unit 4B, Acme Heights, mpangaji Mary Wanjiku, kodi KES 65,000 kwa mwezi, dhamana ya mwezi mmoja." Nitaandaa rasimu, wewe hakiki nyanja, kisha tunafunga na kutuma.',
    },
    related: ['mwikila.draft.notice', 'mwikila.draft.lock', 'mwikila.tracking.lease'],
    visibility: 'PUBLIC',
  },
  {
    id: 'mwikila.draft.notice',
    topic: 'drafting',
    user_outcome: 'Owner has a polished notice (eviction, rent change, inspection) ready to send.',
    public_name: {
      en: 'Draft notices to tenants',
      sw: 'Andaa notisi kwa wapangaji',
    },
    public_description: {
      en: 'Notices for rent increase, lease end, inspection schedule, or arrears escalation — Mr. Mwikila composes them in the format the relevant tenancy authority accepts.',
      sw: 'Notisi za kuongeza kodi, mwisho wa mkataba, ratiba ya ukaguzi, au kupanda kwa madeni — Mwikila huandika kwa muundo unaokubaliwa na mamlaka husika.',
    },
    example_question: {
      en: 'Draft a 60-day rent increase notice for Unit 2A',
      sw: 'Andaa notisi ya siku 60 ya kuongeza kodi kwa Unit 2A',
    },
    example_response_pattern: {
      en: 'Sure. Current rent, proposed new rent, effective date, and the legal basis (CPI adjustment, market alignment, or lease clause). I will produce the notice in the right tone for the tenant and the right format for the authority.',
      sw: 'Sawa. Kodi ya sasa, kodi mpya unayopendekeza, tarehe ya kuanza, na msingi wa kisheria (mabadiliko ya CPI, mfumo wa soko, au kifungu cha mkataba). Nitaandaa notisi kwa lugha sahihi kwa mpangaji na muundo sahihi kwa mamlaka.',
    },
    related: ['mwikila.draft.lease', 'mwikila.tracking.arrears'],
    visibility: 'PUBLIC',
  },
  {
    id: 'mwikila.draft.report',
    topic: 'drafting',
    user_outcome: 'Owner receives a portfolio report ready for board / lender / partner.',
    public_name: {
      en: 'Draft monthly portfolio reports',
      sw: 'Andaa ripoti za mwezi za mali',
    },
    public_description: {
      en: 'Mr. Mwikila compiles a board-ready or lender-ready report from your operating data — collections, occupancy, work-orders, arrears, and net income.',
      sw: 'Mwikila hukusanya ripoti kamili kutoka takwimu zako za uendeshaji — makusanyo, kujaa kwa nyumba, kazi za matengenezo, madeni, na mapato halisi.',
    },
    example_question: {
      en: 'Give me April board report',
      sw: 'Nipe ripoti ya bodi ya Aprili',
    },
    example_response_pattern: {
      en: 'Pulling April now. I will give you a one-page executive summary and a deeper appendix you can hand to the board. Want the export PDF or do you want to edit in the chat first?',
      sw: 'Ninakusanya ya Aprili sasa. Nitakupa muhtasari wa ukurasa mmoja na kiambatisho cha kina utakachoweza kupeleka bodini. Unataka PDF moja kwa moja au unataka kuhariri kwenye gumzo kwanza?',
    },
    related: ['mwikila.tracking.collections', 'mwikila.compliance.statutory'],
    visibility: 'PUBLIC',
  },
  {
    id: 'mwikila.draft.letter',
    topic: 'drafting',
    user_outcome: 'Owner has a polished letter to send the same hour.',
    public_name: {
      en: 'Draft formal letters',
      sw: 'Andaa barua rasmi',
    },
    public_description: {
      en: 'Letters to the housing authority (RERA / KRA), the bank, contractors, body corporates, community leaders — Mr. Mwikila produces the draft in the right register and language.',
      sw: 'Barua kwa mamlaka ya nyumba (RERA / KRA), benki, wakandarasi, kamati za nyumba, viongozi wa jamii — Mwikila huandaa rasimu kwa lugha na muundo unaohitajika.',
    },
    example_question: {
      en: 'Write a letter to KRA asking for a rental income filing extension',
      sw: 'Andika barua kwa KRA kuomba muda zaidi wa kuwasilisha mapato ya kodi',
    },
    example_response_pattern: {
      en: 'Will do. Reason for the extension, the new date you are requesting, and which filing month — that is all I need.',
      sw: 'Sawa. Sababu ya kuomba muda, tarehe mpya unayotaka, na mwezi wa kuwasilisha — hayo tu ndio ninayohitaji.',
    },
    related: ['mwikila.draft.notice', 'mwikila.compliance.statutory'],
    visibility: 'PUBLIC',
  },
  {
    id: 'mwikila.draft.payslip',
    topic: 'drafting',
    user_outcome: 'Staff member receives a payslip the moment payroll runs.',
    public_name: {
      en: 'Generate payslips for staff',
      sw: 'Tengeneza vipande vya mishahara kwa wafanyakazi',
    },
    public_description: {
      en: 'Each payroll cycle Mr. Mwikila produces a bilingual payslip for every estate-manager, caretaker, or admin assistant on the payroll — gross, deductions, net, and the period worked.',
      sw: 'Kila mzunguko wa malipo Mwikila huandaa kipande cha mshahara cha lugha mbili kwa kila msimamizi, mlinzi, au msaidizi — jumla, makato, halisi, na kipindi cha kazi.',
    },
    example_question: {
      en: 'Did Juma get his April payslip?',
      sw: 'Je, Juma alipata kipande chake cha mshahara cha Aprili?',
    },
    example_response_pattern: {
      en: "Yes, Juma's April payslip was issued on the 30th. Want me to re-send it to his phone?",
      sw: 'Ndio, kipande cha Juma cha Aprili kilitolewa tarehe 30. Unataka nimtumie tena kwa simu yake?',
    },
    related: ['mwikila.hr.payroll', 'mwikila.communicate.staff'],
    visibility: 'PUBLIC',
  },
  {
    id: 'mwikila.draft.share-link',
    topic: 'drafting',
    user_outcome: 'Counterparty receives a shareable, time-limited link to the draft.',
    public_name: {
      en: 'Share a draft via secure link',
      sw: 'Shiriki rasimu kwa kiungo salama',
    },
    public_description: {
      en: "Mr. Mwikila produces a time-limited link tenants or applicants can open without an account. They review, sign, and the lease comes back into the owner's portal.",
      sw: 'Mwikila huandaa kiungo cha muda kifupi mpangaji au mwombaji anaweza kufungua bila akaunti. Wanahakiki, wanasaini, na mkataba unarudi kwenye portal ya mmiliki.',
    },
    example_question: {
      en: 'Send the lease to the new tenant for signing',
      sw: 'Mtumie mpangaji mkataba kwa kusaini',
    },
    example_response_pattern: {
      en: 'Done. Link valid 7 days. Want me to text it to her phone too?',
      sw: 'Imekamilika. Kiungo kinafanya kazi siku 7. Unataka nimtumie pia kwa simu?',
    },
    related: ['mwikila.draft.lease', 'mwikila.draft.lock'],
    visibility: 'PUBLIC',
  },
  {
    id: 'mwikila.draft.lock',
    topic: 'drafting',
    user_outcome: 'Owner locks a draft and triggers the signing flow.',
    public_name: {
      en: 'Lock a draft, send for signing',
      sw: 'Funga rasimu, peleka kwa kusaini',
    },
    public_description: {
      en: 'Once the owner approves a draft, Mr. Mwikila locks it (no more edits), captures the final version on the audit chain, and sends the signing request to the counterparties.',
      sw: 'Mmiliki akikubali rasimu, Mwikila huifunga (hakuna mabadiliko zaidi), hupandisha toleo la mwisho kwenye msururu wa ukaguzi, na kupeleka ombi la kusaini kwa wahusika.',
    },
    example_question: {
      en: 'Lock the lease for Unit 4B',
      sw: 'Funga mkataba wa Unit 4B',
    },
    example_response_pattern: {
      en: 'Locked. Sending to Mary Wanjiku now. I will ping you the moment she signs.',
      sw: 'Imefungwa. Ninampelekea Mary Wanjiku sasa. Nitakupigia mara atakaposaini.',
    },
    related: ['mwikila.draft.lease', 'mwikila.draft.share-link'],
    visibility: 'PUBLIC',
  },
  {
    id: 'mwikila.draft.receipt',
    topic: 'drafting',
    user_outcome: 'Tenant receives an official receipt immediately after paying rent.',
    public_name: {
      en: 'Issue rent receipts',
      sw: 'Toa risiti za kodi',
    },
    public_description: {
      en: 'When rent reconciles (M-Pesa, bank transfer, cash), Mr. Mwikila issues a receipt with the lease reference, period covered, and outstanding balance.',
      sw: 'Kodi inapowekwa (M-Pesa, akaunti ya benki, fedha taslimu), Mwikila hutoa risiti yenye namba ya mkataba, kipindi kilicholipiwa, na deni lililobaki.',
    },
    example_question: {
      en: 'Did the new tenant get a receipt?',
      sw: 'Je, mpangaji mpya alipata risiti?',
    },
    example_response_pattern: {
      en: 'Yes, receipt issued at 14:02 by SMS and email. Want me to also resend it to the WhatsApp number on file?',
      sw: 'Ndio, risiti ilitolewa saa 14:02 kwa SMS na barua pepe. Unataka nimtumie pia kwa WhatsApp namba uliyowahi kuingiza?',
    },
    related: ['mwikila.tracking.collections', 'mwikila.communicate.tenant'],
    visibility: 'PUBLIC',
  },
  {
    id: 'mwikila.draft.inspection-report',
    topic: 'drafting',
    user_outcome: 'Owner / estate manager has a complete move-in or move-out inspection report.',
    public_name: {
      en: 'Generate inspection reports',
      sw: 'Tengeneza ripoti za ukaguzi',
    },
    public_description: {
      en: "Move-in, move-out, mid-term, or annual inspection — Mr. Mwikila compiles the inspector's photos and notes into a structured report with the deposit reconciliation attached.",
      sw: 'Ukaguzi wa kuingia, kutoka, wa kati, au wa mwaka — Mwikila huunganisha picha na maelezo ya mkaguzi kuwa ripoti yenye muundo na maafikiano ya dhamana yaliyoambatishwa.',
    },
    example_question: {
      en: 'Pull the move-out report for Unit 7C',
      sw: 'Toa ripoti ya kutoka ya Unit 7C',
    },
    example_response_pattern: {
      en: 'Move-out completed 12-Apr. Deposit retained for two items (wall repaint, broken latch). Want me to send the breakdown to the outgoing tenant?',
      sw: 'Kutoka kulikamilika 12-Apr. Dhamana imezuiliwa kwa vitu viwili (kupaka ukuta, fimbo iliyovunjika). Unataka nimtumie mpangaji mgawanyo?',
    },
    related: ['mwikila.tracking.workorder', 'mwikila.draft.receipt'],
    visibility: 'PUBLIC',
  },
  {
    id: 'mwikila.draft.work-order',
    topic: 'drafting',
    user_outcome: 'Maintenance issue becomes a structured work-order assigned to a vendor or in-house team.',
    public_name: {
      en: 'Create maintenance work-orders',
      sw: 'Anzisha kazi za matengenezo',
    },
    public_description: {
      en: 'Tenant reports a leak, blackout, or broken fixture; Mr. Mwikila turns it into a work-order with severity, vendor assignment, photos, and the estimated repair window.',
      sw: 'Mpangaji anaripoti uvujaji, kukatika kwa umeme, au kifaa kilichovunjika; Mwikila huibadilisha kuwa kazi ya matengenezo yenye uzito, mkandarasi aliyepewa, picha, na muda wa ukarabati.',
    },
    example_question: {
      en: 'Create a work-order: tap leaking in 5A',
      sw: 'Anzisha kazi: bomba linalovuja kwa 5A',
    },
    example_response_pattern: {
      en: 'Logged WO-2401. Severity MEDIUM, plumber Eric assigned, ETA tomorrow before noon. Want to attach a photo from the tenant?',
      sw: 'Imeingizwa WO-2401. Uzito wa KATIKATI, fundi Eric kapewa, atakuja kesho kabla ya saa sita. Unataka kuambatisha picha kutoka kwa mpangaji?',
    },
    related: ['mwikila.tracking.workorder', 'mwikila.alerting.maintenance'],
    visibility: 'PUBLIC',
  },

  // ─────────────────────────────────────────────────────────────────
  // TRACKING (8) — owner asks "where do we stand on …".
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'mwikila.tracking.collections',
    topic: 'tracking',
    user_outcome: 'Owner sees real-time rent collection vs. invoiced for any period.',
    public_name: {
      en: 'Track rent collections',
      sw: 'Fuatilia makusanyo ya kodi',
    },
    public_description: {
      en: 'Real-time view of what was invoiced this month, what came in, what is overdue, and which units are responsible — by portfolio, building, or unit.',
      sw: 'Muonekano wa wakati halisi: kilichotumwa mwezi huu, kilichoingia, kilichochelewa, na nyumba zinazohusika — kwa kibao kizima, jengo, au nyumba moja.',
    },
    example_question: {
      en: 'How is April collection looking?',
      sw: 'Makusanyo ya Aprili yakoje?',
    },
    example_response_pattern: {
      en: 'KES 4.2M invoiced, KES 3.6M collected (86%). Three units overdue more than 7 days: Unit 2A, Unit 5B, Unit 9C. Want me to start the gentle reminder cycle on those three?',
      sw: 'KES 4.2M zimetumwa, KES 3.6M zimekusanywa (86%). Nyumba tatu zimechelewa zaidi ya siku 7: Unit 2A, Unit 5B, Unit 9C. Unataka nianze kumbusho la upole kwa hizi tatu?',
    },
    related: ['mwikila.tracking.arrears', 'mwikila.alerting.late-rent'],
    visibility: 'PUBLIC',
  },
  {
    id: 'mwikila.tracking.arrears',
    topic: 'tracking',
    user_outcome: 'Owner knows exactly which tenants are in arrears and at which ladder stage.',
    public_name: {
      en: 'Track arrears ladder',
      sw: 'Fuatilia ngazi za madeni',
    },
    public_description: {
      en: 'Every overdue tenant is positioned on the arrears ladder: friendly reminder, formal demand, lawyer letter, vacate notice. Mr. Mwikila shows the stage, the next scheduled action, and what authorisation it needs.',
      sw: 'Kila mpangaji aliyechelewa hupangwa kwenye ngazi: kumbusho la kirafiki, dai rasmi, barua ya wakili, notisi ya kuondoka. Mwikila huonyesha hatua, hatua inayofuata, na ridhaa inayohitajika.',
    },
    example_question: {
      en: 'Who is in arrears beyond stage 2?',
      sw: 'Ni nani aliyepita ngazi ya pili ya madeni?',
    },
    example_response_pattern: {
      en: 'Two cases past stage 2: Unit 5B (KES 65,000, 23 days overdue, demand letter sent yesterday); Unit 9C (KES 130,000, 41 days overdue, lawyer letter scheduled for tomorrow — needs your sign-off).',
      sw: 'Kesi mbili zimepita ngazi ya 2: Unit 5B (KES 65,000, siku 23, dai limetumwa jana); Unit 9C (KES 130,000, siku 41, barua ya wakili imeratibiwa kesho — inahitaji ridhaa yako).',
    },
    related: ['mwikila.tracking.collections', 'mwikila.draft.notice'],
    visibility: 'PUBLIC',
  },
  {
    id: 'mwikila.tracking.workorder',
    topic: 'tracking',
    user_outcome: 'Owner sees every open and closed maintenance work-order across the portfolio.',
    public_name: {
      en: 'Track maintenance work-orders',
      sw: 'Fuatilia kazi za matengenezo',
    },
    public_description: {
      en: 'Open work-orders by severity, vendor, ETA, and unit. Closed work-orders by resolution time and cost. Trends by category (plumbing, electrical, paint, common areas).',
      sw: 'Kazi zilizo wazi kwa uzito, mkandarasi, ETA, na nyumba. Zilizofungwa kwa muda wa ukamilishaji na gharama. Mwelekeo kwa aina (mabomba, umeme, rangi, maeneo ya kawaida).',
    },
    example_question: {
      en: 'Any work-orders overdue?',
      sw: 'Kuna kazi yoyote iliyochelewa?',
    },
    example_response_pattern: {
      en: 'Two HIGH severity overdue: WO-2389 (broken lift at Acme Heights, day 4, vendor Lazima Lifts); WO-2392 (water tank pump, day 3, vendor Plumb-It). Want me to escalate the vendors?',
      sw: 'Mbili za uzito wa JUU zimechelewa: WO-2389 (lifti iliyoharibika Acme Heights, siku ya 4, mkandarasi Lazima Lifts); WO-2392 (pampu ya tanki la maji, siku ya 3, mkandarasi Plumb-It). Niwakaribishe wakandarasi?',
    },
    related: ['mwikila.draft.work-order', 'mwikila.alerting.maintenance'],
    visibility: 'PUBLIC',
  },
  {
    id: 'mwikila.tracking.lease',
    topic: 'tracking',
    user_outcome: 'Owner sees every active lease, renewal pipeline, and vacancy.',
    public_name: {
      en: 'Track lease lifecycle',
      sw: 'Fuatilia mzunguko wa mkataba',
    },
    public_description: {
      en: 'Active leases with end-dates, leases nearing expiry (60/30/14 days), renewals pending, and vacant units. The renewal pipeline highlights tenants worth retaining vs. those with recurring complaints.',
      sw: 'Mikataba ya sasa na tarehe za mwisho, ile inayokaribia kuisha (siku 60/30/14), kukubali kuongeza muda, na nyumba zilizo wazi. Mkondo wa kuongeza muda huonyesha wapangaji wa thamani vs. wenye malalamiko ya mara kwa mara.',
    },
    example_question: {
      en: 'Which leases end in the next 30 days?',
      sw: 'Ni mikataba ipi inayoisha katika siku 30 zijazo?',
    },
    example_response_pattern: {
      en: 'Four leases end in the next 30 days. Two confirmed renewals (Unit 1A, Unit 3D), one undecided (Unit 6B — third complaint about noise), one declared moving out (Unit 8A). Want me to start move-out logistics for 8A?',
      sw: 'Mikataba minne inaisha katika siku 30. Miwili imekubaliwa kuongezwa (Unit 1A, Unit 3D), mmoja haijaamuliwa (Unit 6B — lalamiko la tatu la kelele), mmoja amesema atatoka (Unit 8A). Nianze kupanga kutoka kwa 8A?',
    },
    related: ['mwikila.draft.lease', 'mwikila.draft.notice'],
    visibility: 'PUBLIC',
  },
  {
    id: 'mwikila.tracking.viewings',
    topic: 'tracking',
    user_outcome: 'Owner sees scheduled viewings, no-shows, and conversion rate.',
    public_name: {
      en: 'Track property viewings',
      sw: 'Fuatilia ziara za kuangalia nyumba',
    },
    public_description: {
      en: 'Upcoming viewings with confirmed applicants, no-show history, and conversion-to-application rate per listing. Helps the owner decide which channels (Jumia, OLX, Facebook, in-house referrals) are worth the spend.',
      sw: 'Ziara zinazokuja na waombaji waliothibitisha, historia ya kushindwa kuja, na uongofu kuwa maombi kwa kila tangazo. Husaidia mmiliki kuamua njia zipi (Jumia, OLX, Facebook, rufaa za ndani) zinastahili gharama.',
    },
    example_question: {
      en: 'How are viewings going for Unit 4B?',
      sw: 'Ziara za Unit 4B zinakwenda vipi?',
    },
    example_response_pattern: {
      en: '6 viewings scheduled this week, 4 confirmed. Last week 5 viewings → 2 applications → 1 lease. Conversion is healthy. Want me to focus the next listing budget on the channel that produced the lease (Jumia)?',
      sw: 'Ziara 6 zimepangwa wiki hii, 4 zimethibitishwa. Wiki iliyopita ziara 5 → maombi 2 → mkataba 1. Uongofu uko vizuri. Nimakinishe bajeti ya tangazo lijalo kwenye njia iliyoleta mkataba (Jumia)?',
    },
    related: ['mwikila.marketplace.listing', 'mwikila.tracking.lease'],
    visibility: 'PUBLIC',
  },
  {
    id: 'mwikila.tracking.deposit',
    topic: 'tracking',
    user_outcome: 'Owner sees every deposit held, with the lease and statutory reconciliation status.',
    public_name: {
      en: 'Track deposits across the portfolio',
      sw: 'Fuatilia dhamana zote za mali',
    },
    public_description: {
      en: 'Every deposit held, the lease it backs, where it sits (escrow / operating account), and the reconciliation status at move-out. Helps avoid the most common litigation cause in property management: deposit disputes.',
      sw: 'Kila dhamana inayoshikiliwa, mkataba unaohusiana, mahali ilipo (akaunti ya escrow / uendeshaji), na hali ya makubaliano wakati wa kutoka. Husaidia kuepuka kesi za kawaida — mizozo ya dhamana.',
    },
    example_question: {
      en: 'How much deposit are we holding total?',
      sw: 'Tunashikilia dhamana kiasi gani jumla?',
    },
    example_response_pattern: {
      en: 'KES 2.34M across 36 active leases. 31 in escrow, 5 in the operating account (those should move). Want me to flag the 5 for treasury so they get to escrow by week-end?',
      sw: 'KES 2.34M kwa mikataba 36. 31 kwenye escrow, 5 kwenye akaunti ya uendeshaji (hizo zinapaswa kuhama). Niwajulishe hazina ili wahame ifikapo wiki hii?',
    },
    related: ['mwikila.draft.receipt', 'mwikila.tracking.lease'],
    visibility: 'PUBLIC',
  },
  {
    id: 'mwikila.tracking.utilities',
    topic: 'tracking',
    user_outcome: 'Owner sees water / electricity / fuel cost per unit and flags anomalies.',
    public_name: {
      en: 'Track utility cost and anomalies',
      sw: 'Fuatilia gharama za huduma na isiyo ya kawaida',
    },
    public_description: {
      en: "Per-unit utility cost over time. Flags spikes (a 60% jump usually means a leak or a meter swap). Helps decide whether to pass through, absorb, or investigate.",
      sw: 'Gharama za huduma kwa kila nyumba kwa muda. Huangalia milipuko (kuongezeka kwa 60% kawaida ni uvujaji au mita iliyobadilishwa). Husaidia kuamua kuhamishia mpangaji, kubeba, au kuchunguza.',
    },
    example_question: {
      en: 'Any utility anomalies this month?',
      sw: 'Kuna kasoro yoyote ya huduma mwezi huu?',
    },
    example_response_pattern: {
      en: 'One. Unit 5C water consumption tripled vs. 3-month average. That is usually a hidden leak. Want me to log a work-order for a plumber to inspect?',
      sw: 'Moja. Matumizi ya maji ya Unit 5C yameongezeka mara tatu kuliko wastani wa miezi 3. Hiyo ni uvujaji uliojificha. Niandike kazi kwa fundi wa mabomba kukagua?',
    },
    related: ['mwikila.draft.work-order', 'mwikila.alerting.maintenance'],
    visibility: 'PUBLIC',
  },
  {
    id: 'mwikila.tracking.compliance',
    topic: 'tracking',
    user_outcome: 'Owner sees every regulatory deadline coming up (rental income, fire cert, lift cert).',
    public_name: {
      en: 'Track compliance deadlines',
      sw: 'Fuatilia tarehe za mwisho za usajili',
    },
    public_description: {
      en: 'Every statutory deadline: KRA / TRA rental income, fire safety certification, lift inspection certificate, body-corporate AGM, insurance renewal. Day-precise calendar with the form pre-staged.',
      sw: 'Kila tarehe ya mwisho ya kisheria: KRA / TRA mapato ya kodi, hati ya usalama wa moto, hati ya ukaguzi wa lifti, AGM ya kamati ya nyumba, kuhuisha bima. Ratiba ya siku kamili na fomu iko tayari.',
    },
    example_question: {
      en: 'What is due in the next 14 days?',
      sw: 'Kuna nini cha kuwasilisha katika siku 14 zijazo?',
    },
    example_response_pattern: {
      en: 'Three items. KRA monthly rental income (due day 9 of next month), fire safety re-cert for Acme Heights (due day 12), Q2 insurance renewal (due day 14). I have the rental income filing pre-staged — want me to walk you through it?',
      sw: 'Vitu vitatu. KRA mapato ya mwezi (siku ya 9 mwezi ujao), hati ya usalama wa moto Acme Heights (siku ya 12), kuhuisha bima ya Q2 (siku ya 14). Nimepanga fomu ya KRA tayari — nikuelekeze?',
    },
    related: ['mwikila.compliance.statutory', 'mwikila.alerting.deadline'],
    visibility: 'PUBLIC',
  },

  // ─────────────────────────────────────────────────────────────────
  // ALERTING (5) — Mr. Mwikila pings the owner unprompted.
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'mwikila.alerting.late-rent',
    topic: 'alerting',
    user_outcome: 'Owner is alerted the moment a tenant misses rent.',
    public_name: {
      en: 'Alert on late rent',
      sw: 'Tahadharisha kuhusu kodi iliyochelewa',
    },
    public_description: {
      en: 'Mr. Mwikila pings the owner the day rent goes overdue, with the tenant context (history, current arrears stage, channel preference), and offers a graduated response (gentle SMS → call → formal demand).',
      sw: 'Mwikila humjulisha mmiliki siku kodi inapochelewa, akiwa na muktadha wa mpangaji (historia, hatua ya madeni, njia anayopendelea), na hutoa mwitikio wa pole pole (SMS upole → simu → dai rasmi).',
    },
    example_question: {
      en: 'Tell me about overdue tenants right now',
      sw: 'Niambie kuhusu wapangaji waliochelewa sasa hivi',
    },
    example_response_pattern: {
      en: 'Two tenants newly overdue today (day 1). Both have a clean track record. Want me to send the soft SMS reminder to both, or handle case by case?',
      sw: 'Wapangaji wawili wameanza kuchelewa leo (siku 1). Wote wana historia safi. Niwatumie SMS la pole, au nishughulike kesi kwa kesi?',
    },
    related: ['mwikila.tracking.arrears', 'mwikila.communicate.tenant'],
    visibility: 'PUBLIC',
  },
  {
    id: 'mwikila.alerting.maintenance',
    topic: 'alerting',
    user_outcome: 'Owner is alerted when a maintenance issue exceeds the SLA window.',
    public_name: {
      en: 'Alert on maintenance SLA breach',
      sw: 'Tahadharisha kuhusu kushindwa kufikia muda wa matengenezo',
    },
    public_description: {
      en: 'Each severity has an SLA (HIGH 24h, MEDIUM 72h, LOW 1 week). Mr. Mwikila alerts when a work-order is going to breach, with the vendor history and an escalation path.',
      sw: 'Kila uzito una muda wa SLA (JUU saa 24, KATI saa 72, CHINI wiki 1). Mwikila hutahadharisha kazi inapokaribia kupita muda, akiwa na historia ya mkandarasi na njia ya kupanda.',
    },
    example_question: {
      en: 'What is about to breach SLA?',
      sw: 'Ni kazi ipi inakaribia kupita muda?',
    },
    example_response_pattern: {
      en: 'WO-2389 (lift) — SLA was 24h, now at hour 96. Vendor Lazima Lifts has missed twice in the last 60 days. Want me to escalate to a backup vendor or call Lazima directly?',
      sw: 'WO-2389 (lifti) — SLA ilikuwa saa 24, sasa ipo kwenye saa 96. Mkandarasi Lazima Lifts ameshindwa mara mbili katika siku 60 zilizopita. Nipande kwa mkandarasi mwingine au nimpigie Lazima moja kwa moja?',
    },
    related: ['mwikila.tracking.workorder', 'mwikila.draft.work-order'],
    visibility: 'PUBLIC',
  },
  {
    id: 'mwikila.alerting.deadline',
    topic: 'alerting',
    user_outcome: 'Owner is alerted before any regulator deadline.',
    public_name: {
      en: 'Alert on regulatory deadlines',
      sw: 'Tahadharisha kuhusu tarehe za mwisho za usajili',
    },
    public_description: {
      en: 'T-30, T-14, T-7, T-1 alerts on rental income filings, fire safety, lift certificate, body-corporate AGMs, insurance renewals. Filing form pre-staged where the form is standard.',
      sw: 'Tahadhari za T-30, T-14, T-7, T-1 kuhusu kuwasilisha mapato ya kodi, usalama wa moto, hati ya lifti, AGM za kamati, kuhuisha bima. Fomu iko tayari pale ambapo ni ya kawaida.',
    },
    example_question: {
      en: 'Anything urgent on compliance?',
      sw: 'Kuna kitu chochote cha haraka cha usajili?',
    },
    example_response_pattern: {
      en: 'One urgent. Fire safety re-cert for Acme Heights is in 5 days, and we have not yet booked the inspector. Want me to book NK Fire Services (used last year, no issues) for Friday?',
      sw: 'Moja la haraka. Hati ya moto ya Acme Heights ina siku 5 kabla ya kuisha, na bado hatujamuita mkaguzi. Nimuite NK Fire Services (alitumika mwaka jana, hakuna shida) Ijumaa?',
    },
    related: ['mwikila.tracking.compliance', 'mwikila.compliance.statutory'],
    visibility: 'PUBLIC',
  },
  {
    id: 'mwikila.alerting.safety',
    topic: 'alerting',
    user_outcome: 'Owner is alerted to safety incidents (fire alarm, security breach, water leak).',
    public_name: {
      en: 'Alert on safety incidents',
      sw: 'Tahadharisha kuhusu matukio ya usalama',
    },
    public_description: {
      en: 'Tenant- or sensor-reported safety incidents (fire alarm, security alert, gas smell, water leak in common area) escalate to the owner immediately with the on-call response template ready to send.',
      sw: 'Matukio ya usalama yaliyoripotiwa na mpangaji au kifaa (kengele ya moto, tahadhari ya usalama, harufu ya gesi, uvujaji wa maji eneo la kawaida) huenda kwa mmiliki mara moja na fomu ya mwitikio iko tayari.',
    },
    example_question: {
      en: 'Any safety alerts open?',
      sw: 'Kuna tahadhari yoyote ya usalama wazi?',
    },
    example_response_pattern: {
      en: 'One. Gas smell reported by Unit 5A at 14:12. I already dispatched the duty caretaker. Want me to ring the gas board too?',
      sw: 'Moja. Harufu ya gesi imeripotiwa na Unit 5A saa 14:12. Tayari nimemtuma mlinzi wa zamu. Niwapigie pia bodi ya gesi?',
    },
    related: ['mwikila.alerting.maintenance', 'mwikila.communicate.tenant'],
    visibility: 'PUBLIC',
  },
  {
    id: 'mwikila.alerting.fx',
    topic: 'alerting',
    user_outcome: 'Owner running USD-denominated leases is alerted when the local rate moves a payment by ≥3%.',
    public_name: {
      en: 'Alert on FX movement affecting rent',
      sw: 'Tahadharisha kuhusu mabadiliko ya FX yanayoathiri kodi',
    },
    public_description: {
      en: 'When a lease is quoted in USD but paid in TZS / KES / UGX, Mr. Mwikila alerts the owner when the local rate moves the rent due by ≥3% so they can re-quote or hedge.',
      sw: 'Mkataba ukiandikwa kwa USD lakini ulipwe kwa TZS / KES / UGX, Mwikila humjulisha mmiliki kiwango cha ndani kinapobadilika kwa ≥3% ili ahuisha au ahedge.',
    },
    example_question: {
      en: 'Any FX alerts this week?',
      sw: 'Kuna tahadhari za FX wiki hii?',
    },
    example_response_pattern: {
      en: 'Yes. TZS weakened 3.4% against USD this week. Two USD-denominated leases (Office Tower, Unit 3) are due next week — the tenant will pay 3.4% more in TZS. Want me to send a courtesy heads-up?',
      sw: 'Ndio. TZS imedhoofika 3.4% dhidi ya USD wiki hii. Mikataba miwili ya USD (Office Tower, Unit 3) inalipa wiki ijayo — mpangaji atalipa 3.4% zaidi kwa TZS. Niwajulishe kwa heshima?',
    },
    related: ['mwikila.tracking.collections'],
    visibility: 'PUBLIC',
  },

  // ─────────────────────────────────────────────────────────────────
  // FORECASTING (4) — owner asks "what will happen / what is the trend".
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'mwikila.forecasting.collections',
    topic: 'forecasting',
    user_outcome: 'Owner sees a forecast of next-month rent collection.',
    public_name: {
      en: 'Forecast next-month collections',
      sw: 'Onyesha makadirio ya makusanyo ya mwezi ujao',
    },
    public_description: {
      en: 'Based on the rent roll, seasonal patterns, and arrears trajectory, Mr. Mwikila forecasts next-month gross collections with a band (best / likely / worst) the owner can budget against.',
      sw: 'Kulingana na kibao cha kodi, mwelekeo wa msimu, na mwendo wa madeni, Mwikila huonyesha makadirio ya makusanyo ya mwezi ujao kwa bendi (bora / inayowezekana / mbaya).',
    },
    example_question: {
      en: 'What should we expect to collect in May?',
      sw: 'Tutegemee kukusanya kiasi gani Mei?',
    },
    example_response_pattern: {
      en: 'May forecast: best KES 4.4M, likely KES 4.1M, worst KES 3.7M. The worst-case factors in two tenants currently at stage 3 arrears. Want me to walk through the assumptions?',
      sw: 'Makadirio ya Mei: bora KES 4.4M, inayowezekana KES 4.1M, mbaya KES 3.7M. Hali mbaya inajumuisha wapangaji wawili wa ngazi ya 3 ya madeni. Nikuelekeze mawazo ya msingi?',
    },
    related: ['mwikila.tracking.collections', 'mwikila.tracking.arrears'],
    visibility: 'PUBLIC',
  },
  {
    id: 'mwikila.forecasting.vacancy',
    topic: 'forecasting',
    user_outcome: 'Owner sees the vacancy-rate trajectory across the portfolio.',
    public_name: {
      en: 'Forecast vacancy and renewal pipeline',
      sw: 'Onyesha makadirio ya nyumba zilizo wazi na waliokubali kuongeza muda',
    },
    public_description: {
      en: 'Knowing how many leases end in 30 / 60 / 90 days and the renewal-acceptance rate, Mr. Mwikila projects portfolio vacancy and flags units worth marketing now.',
      sw: 'Kujua mikataba inayoisha siku 30 / 60 / 90 na kiwango cha kukubali kuongeza muda, Mwikila huonyesha makadirio ya nyumba zilizo wazi na nyumba zinazostahili kutangazwa sasa.',
    },
    example_question: {
      en: 'What does vacancy look like over the next 90 days?',
      sw: 'Nyumba zilizo wazi zitakuwaje siku 90 zijazo?',
    },
    example_response_pattern: {
      en: 'Portfolio vacancy is at 8% today. Forecast peak 14% in 60 days (4 confirmed move-outs land in May). Two of those units rented quickly last cycle — want me to pre-stage the listings now?',
      sw: 'Nyumba zilizo wazi 8% leo. Makadirio ya juu ya 14% baada ya siku 60 (kutoka 4 kunatokea Mei). Mbili kati ya hizo zilikodisha haraka mzunguko uliopita — niandae matangazo sasa?',
    },
    related: ['mwikila.tracking.lease', 'mwikila.marketplace.listing'],
    visibility: 'PUBLIC',
  },
  {
    id: 'mwikila.forecasting.maintenance',
    topic: 'forecasting',
    user_outcome: 'Owner sees expected maintenance spend for the quarter.',
    public_name: {
      en: 'Forecast maintenance spend',
      sw: 'Onyesha makadirio ya gharama za matengenezo',
    },
    public_description: {
      en: 'Based on the work-order history per building and the age of major systems (lift, generator, water tank), Mr. Mwikila projects quarterly maintenance spend with a planned-vs-reactive split.',
      sw: 'Kulingana na historia ya kazi za matengenezo kwa kila jengo na umri wa mifumo mikuu (lifti, jenereta, tanki la maji), Mwikila huonyesha makadirio ya gharama za robo na mgawanyo wa zilizopangwa vs. za dharura.',
    },
    example_question: {
      en: 'What should maintenance cost us next quarter?',
      sw: 'Matengenezo yatatugharimu kiasi gani robo ijayo?',
    },
    example_response_pattern: {
      en: 'Forecast KES 480k next quarter. Of that, KES 300k is planned (annual lift service, generator inspection, paint cycle). Reactive forecast KES 180k. Want me to push the paint cycle to Q4 to save Q3 cash?',
      sw: 'Makadirio KES 480k robo ijayo. Kati ya hayo, KES 300k yamepangwa (huduma ya mwaka ya lifti, ukaguzi wa jenereta, mzunguko wa rangi). Ya dharura KES 180k. Niahirishe mzunguko wa rangi hadi Q4 ili kuokoa fedha za Q3?',
    },
    related: ['mwikila.tracking.workorder'],
    visibility: 'PUBLIC',
  },
  {
    id: 'mwikila.forecasting.market-rent',
    topic: 'forecasting',
    user_outcome: 'Owner sees market-rent benchmarks for upcoming renewals or new listings.',
    public_name: {
      en: 'Benchmark market rent',
      sw: 'Linganisha kodi ya soko',
    },
    public_description: {
      en: 'Using comparable units in the neighbourhood (size, age, amenities), Mr. Mwikila suggests a defensible rent range — useful for renewal negotiation or pricing a new listing.',
      sw: 'Kwa kutumia nyumba zinazofanana katika eneo (ukubwa, umri, vifaa), Mwikila hupendekeza kiwango cha kodi cha kuhalalisha — muhimu kwa kutia muda mkataba au bei ya tangazo jipya.',
    },
    example_question: {
      en: 'What should I charge for Unit 4B if I re-let?',
      sw: 'Niombe kiasi gani kwa Unit 4B nikikodisha tena?',
    },
    example_response_pattern: {
      en: 'Comparable units in Kilimani 2-bed, 90sqm, secure parking, going for KES 60k–72k. Your unit is mid-tier. Market range: 64k–70k. Want me to draft a market-rent justification letter to the existing tenant for renewal?',
      sw: 'Nyumba zinazofanana Kilimani, 2-bed, mita 90, paki salama, zinakwenda KES 60k–72k. Yako iko katikati. Soko: 64k–70k. Niandae barua ya kuhalalisha kodi mpya kwa mpangaji wa sasa kwa kuongeza muda?',
    },
    related: ['mwikila.tracking.lease', 'mwikila.draft.notice'],
    visibility: 'PUBLIC',
  },

  // ─────────────────────────────────────────────────────────────────
  // COMMUNICATING (4) — owner sends a message via Mr. Mwikila.
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'mwikila.communicate.tenant',
    topic: 'communicating',
    user_outcome: 'Owner sends a tenant a message in the channel and language they actually use.',
    public_name: {
      en: 'Talk to tenants in their language',
      sw: 'Ongea na wapangaji kwa lugha yao',
    },
    public_description: {
      en: 'SMS, WhatsApp, email, or in-app — Mr. Mwikila picks the channel each tenant responds to fastest and switches between EN and SW based on their last reply.',
      sw: 'SMS, WhatsApp, barua pepe, au ndani ya programu — Mwikila huchagua njia mpangaji anayoitikia haraka na kubadilisha kati ya EN na SW kulingana na jibu lao la mwisho.',
    },
    example_question: {
      en: 'Send the new tenant the welcome message',
      sw: 'Mtumie mpangaji mpya ujumbe wa karibu',
    },
    example_response_pattern: {
      en: 'Sent via WhatsApp (her preferred channel). I included the lease PDF, M-Pesa paybill, the caretaker number, and the WiFi password. Anything else?',
      sw: 'Imetumwa kwa WhatsApp (njia anayopendelea). Nimejumuisha PDF ya mkataba, M-Pesa paybill, namba ya mlinzi, na neno la siri la WiFi. Kingine?',
    },
    related: ['mwikila.draft.lease', 'mwikila.draft.receipt'],
    visibility: 'PUBLIC',
  },
  {
    id: 'mwikila.communicate.staff',
    topic: 'communicating',
    user_outcome: 'Owner relays instructions to caretakers / managers in their preferred channel.',
    public_name: {
      en: 'Brief estate staff',
      sw: 'Eleza wafanyakazi wa nyumba',
    },
    public_description: {
      en: 'Caretakers and on-the-ground staff get briefs in the format they actually read (WhatsApp voice memo, SMS, daily summary). Mr. Mwikila confirms delivery and acknowledgment.',
      sw: 'Walinzi na wafanyakazi wa shambani hupata maelekezo kwa muundo wanaosoma kweli (sauti ya WhatsApp, SMS, muhtasari wa siku). Mwikila huthibitisha kupelekewa na kukubaliwa.',
    },
    example_question: {
      en: 'Tell the caretaker to switch off Unit 5A water main',
      sw: 'Mwambie mlinzi azime maji ya Unit 5A',
    },
    example_response_pattern: {
      en: 'Sent to caretaker Daniel via WhatsApp with the request. He read it 30 seconds ago. Want me to ping him for a confirmation when he is done?',
      sw: 'Imetumwa kwa Daniel kwa WhatsApp na ombi. Amesoma sekunde 30 zilizopita. Nimpigie kuthibitisha akimaliza?',
    },
    related: ['mwikila.hr.payroll', 'mwikila.tracking.workorder'],
    visibility: 'PUBLIC',
  },
  {
    id: 'mwikila.communicate.regulator',
    topic: 'communicating',
    user_outcome: 'Owner files / corresponds with the regulator in the right format.',
    public_name: {
      en: 'Correspond with the housing authority',
      sw: 'Wasiliana na mamlaka ya nyumba',
    },
    public_description: {
      en: 'Letters and filings to KRA / TRA / RERA / county housing offices — Mr. Mwikila uses the authority-required format and tone. Where the form is standard, he pre-fills it for one-click submission.',
      sw: 'Barua na fomu kwa KRA / TRA / RERA / ofisi za nyumba za kaunti — Mwikila hutumia muundo na lugha inayotakwa. Pale fomu iko sanifu, anaijaza kabla ili itumwe kwa mguso mmoja.',
    },
    example_question: {
      en: 'File this month rental income to KRA',
      sw: 'Wasilisha mapato ya kodi ya mwezi huu kwa KRA',
    },
    example_response_pattern: {
      en: 'KRA form pre-filled with this month gross rent (KES 4.1M) and allowable expenses (KES 0.62M). Want to review the deductions list before I submit?',
      sw: 'Fomu ya KRA imejazwa kabla ikiwa na kodi ya jumla ya mwezi huu (KES 4.1M) na gharama zinazoruhusiwa (KES 0.62M). Hakiki orodha ya makato kabla sijawasilisha?',
    },
    related: ['mwikila.draft.letter', 'mwikila.compliance.statutory'],
    visibility: 'PUBLIC',
  },
  {
    id: 'mwikila.communicate.vendor',
    topic: 'communicating',
    user_outcome: 'Owner brings a contractor / vendor up to speed in seconds.',
    public_name: {
      en: 'Brief vendors and contractors',
      sw: 'Eleza wakandarasi na wauzaji',
    },
    public_description: {
      en: 'When dispatching a contractor (plumber, electrician, fumigator), Mr. Mwikila sends the work-order, the access window, the contact tenant, and the agreed price. Logs everything for invoice reconciliation.',
      sw: 'Anapotumwa mkandarasi (fundi wa mabomba, umeme, dawa za wadudu), Mwikila hutuma kazi, muda wa kufika, mpangaji wa mawasiliano, na bei iliyokubaliwa. Hupandisha yote kwa kufungamanisha bili.',
    },
    example_question: {
      en: 'Tell the plumber the job for 5A',
      sw: 'Mwambie fundi wa mabomba kazi ya 5A',
    },
    example_response_pattern: {
      en: 'Sent Eric the WO-2401 brief, the tenant phone, and the access window (10–12 tomorrow). Quote ceiling KES 5,000 unless he flags a bigger issue. Anything to add?',
      sw: 'Nimemtumia Eric muhtasari wa WO-2401, simu ya mpangaji, na muda wa kuingia (10–12 kesho). Bei ya juu KES 5,000 isipokuwa atakuta kasoro kubwa zaidi. Cha kuongeza?',
    },
    related: ['mwikila.draft.work-order'],
    visibility: 'PUBLIC',
  },

  // ─────────────────────────────────────────────────────────────────
  // SEARCHING (3) — owner asks Mr. Mwikila to FIND something.
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'mwikila.searching.entity',
    topic: 'searching',
    user_outcome: 'Owner finds a tenant, unit, contract, or work-order by name / partial detail.',
    public_name: {
      en: 'Find a tenant, unit, or document',
      sw: 'Tafuta mpangaji, nyumba, au hati',
    },
    public_description: {
      en: 'Type or speak any partial detail — first name, phone last 4 digits, unit number, the word from the complaint. Mr. Mwikila returns the right entity with its context.',
      sw: 'Andika au sema sehemu yoyote — jina, namba 4 za mwisho za simu, namba ya nyumba, neno la lalamiko. Mwikila atarudisha mhusika sahihi pamoja na muktadha.',
    },
    example_question: {
      en: 'Find the tenant in 5A',
      sw: 'Tafuta mpangaji wa 5A',
    },
    example_response_pattern: {
      en: 'Sarah Otieno, Unit 5A, Acme Heights. Lease ends Aug 31. Rent current. One open work-order (broken tap). Want the full file?',
      sw: 'Sarah Otieno, Unit 5A, Acme Heights. Mkataba unaisha Ago 31. Kodi imefika. Kazi moja iko wazi (bomba lililovunjika). Faili kamili?',
    },
    related: ['mwikila.tracking.lease', 'mwikila.tracking.workorder'],
    visibility: 'PUBLIC',
  },
  {
    id: 'mwikila.searching.history',
    topic: 'searching',
    user_outcome: 'Owner recalls a past conversation, decision, or document.',
    public_name: {
      en: 'Recall past decisions and conversations',
      sw: 'Kumbuka maamuzi na mazungumzo ya zamani',
    },
    public_description: {
      en: 'Every prior conversation with Mr. Mwikila, every signed document, every approved action is indexed. The owner can ask "what did we decide about the Unit 4B rent increase?" and get the date, the reasoning, and the document.',
      sw: 'Kila mazungumzo na Mwikila, kila hati iliyosainiwa, kila hatua iliyokubaliwa imetiwa kwenye orodha. Mmiliki anaweza kuuliza "tuliamua nini kuhusu kuongezeka kwa kodi ya Unit 4B?" na kupata tarehe, sababu, na hati.',
    },
    example_question: {
      en: 'What did we decide last month about Unit 4B rent?',
      sw: 'Tuliamua nini mwezi uliopita kuhusu kodi ya Unit 4B?',
    },
    example_response_pattern: {
      en: 'On 12 April you approved a 6% rent increase from June 1, KES 72k → 76k. Notice was sent the same day, tenant acknowledged on 15 April. Want to see the notice?',
      sw: 'Tarehe 12 Aprili ulikubali kuongeza kodi kwa 6% kuanzia Juni 1, KES 72k → 76k. Notisi ilitumwa siku hiyo, mpangaji akakubali tarehe 15 Aprili. Onyesha notisi?',
    },
    related: ['mwikila.searching.entity', 'mwikila.memory.cross-session'],
    visibility: 'PUBLIC',
  },
  {
    id: 'mwikila.searching.market',
    topic: 'searching',
    user_outcome: 'Owner gets a current external answer (market price, regulator change) via web search.',
    public_name: {
      en: 'Look up current market or regulatory info',
      sw: 'Tafuta taarifa za soko au sheria za sasa',
    },
    public_description: {
      en: 'When the owner asks something time-sensitive Mr. Mwikila does not already know (today FX rate, a new RERA fee, a new fire-safety regulation), he runs a web search, cites the source, and proposes the action.',
      sw: 'Mmiliki akiuliza jambo la wakati huu Mwikila asilojua (kiwango cha FX cha leo, ada mpya ya RERA, sheria mpya ya usalama wa moto), hutafuta wavuti, hutaja chanzo, na kupendekeza hatua.',
    },
    example_question: {
      en: 'Is there a new KRA rental income deduction this year?',
      sw: 'Kuna makato mapya ya KRA mwaka huu?',
    },
    example_response_pattern: {
      en: 'Yes, the 1% advance tax was abolished as of 1 January, and the residential rental income rate stayed at 7.5% gross. Source: KRA notice 2026-01. Want me to update your next filing accordingly?',
      sw: 'Ndio, kodi ya 1% ya awali imeondolewa tangu Januari 1, na kiwango cha mapato ya kodi kibaki 7.5% jumla. Chanzo: notisi ya KRA 2026-01. Niboreshe fomu yako inayofuata?',
    },
    related: ['mwikila.tracking.compliance', 'mwikila.communicate.regulator'],
    visibility: 'PUBLIC',
  },

  // ─────────────────────────────────────────────────────────────────
  // COMPLIANCE (3) — owner stays on the right side of every regulator.
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'mwikila.compliance.statutory',
    topic: 'compliance',
    user_outcome: 'Owner stays current on every statutory filing.',
    public_name: {
      en: 'Stay compliant with housing regulators',
      sw: 'Tii sheria za mamlaka ya nyumba',
    },
    public_description: {
      en: 'KRA / TRA rental income, fire safety certification, lift inspection, body-corporate AGM minutes, insurance renewals — Mr. Mwikila keeps the calendar, pre-fills the standard forms, and reminds the owner before every deadline.',
      sw: 'KRA / TRA mapato ya kodi, hati ya moto, ukaguzi wa lifti, AGM ya kamati, kuhuisha bima — Mwikila huweka ratiba, kujaza fomu sanifu, na kumkumbusha mmiliki kabla ya kila tarehe.',
    },
    example_question: {
      en: 'Are we compliant on everything right now?',
      sw: 'Tuko sawa kwa kila kitu sasa hivi?',
    },
    example_response_pattern: {
      en: 'Yes for KRA / fire / lift / insurance. One soft flag: the Acme Heights AGM minutes have not been filed for last quarter (they are 12 days late but no fine yet). Want me to draft the catch-up?',
      sw: 'Ndio kwa KRA / moto / lifti / bima. Kasoro ndogo: muhtasari wa AGM wa Acme Heights wa robo iliyopita haujawasilishwa (umechelewa siku 12 lakini hakuna faini bado). Niandae kuipata?',
    },
    related: ['mwikila.tracking.compliance', 'mwikila.alerting.deadline'],
    visibility: 'PUBLIC',
  },
  {
    id: 'mwikila.compliance.audit-trail',
    topic: 'compliance',
    user_outcome: 'Owner has an immutable audit trail of every action Mr. Mwikila took on their behalf.',
    public_name: {
      en: 'See the audit trail of every action',
      sw: 'Ona msururu wa ukaguzi wa kila hatua',
    },
    public_description: {
      en: 'Every notice sent, every payment posted, every work-order created, every escalation approved is on a hash-chained, append-only audit trail. The owner can inspect any action, see the reasoning, and replay.',
      sw: 'Kila notisi iliyotumwa, kila malipo yaliyowekwa, kila kazi iliyoanzishwa, kila kupanda kulikokubaliwa kipo kwenye msururu wa ukaguzi usiobadilishwa. Mmiliki anaweza kukagua hatua yoyote, kuona sababu, na kucheza tena.',
    },
    example_question: {
      en: 'Show me the audit trail for last month',
      sw: 'Nionyeshe ukaguzi wa mwezi uliopita',
    },
    example_response_pattern: {
      en: '147 actions logged. Top categories: rent receipts (38), work-orders (22), tenant messages (54). Anything you want to drill into?',
      sw: 'Hatua 147 zimeingizwa. Aina kuu: risiti za kodi (38), kazi za matengenezo (22), ujumbe kwa wapangaji (54). Cha kuangalia kwa kina?',
    },
    related: ['mwikila.compliance.statutory'],
    visibility: 'PUBLIC',
  },
  {
    id: 'mwikila.compliance.kyc',
    topic: 'compliance',
    user_outcome: 'Owner runs KYC on prospective tenants before signing the lease.',
    public_name: {
      en: 'Run tenant KYC pre-signing',
      sw: 'Fanya KYC ya mpangaji kabla ya kusaini',
    },
    public_description: {
      en: 'Pre-lease checks (ID, employer, prior landlord reference, payment-history flag) so the owner takes on a tenant they trust. Result is decision-grade, not a hard pass / fail.',
      sw: 'Ukaguzi kabla ya mkataba (kitambulisho, ajira, rufaa kutoka mwenye nyumba wa zamani, alama ya historia ya malipo) ili mmiliki achukue mpangaji aliyemwamini. Matokeo ni mwongozo wa uamuzi, sio kukubali / kukataa moja kwa moja.',
    },
    example_question: {
      en: 'Run KYC on the new applicant for 4B',
      sw: 'Fanya KYC kwa mwombaji mpya wa 4B',
    },
    example_response_pattern: {
      en: 'ID verified. Employer (Acme Bank) confirmed via direct payslip. Prior landlord reached 14 months on lease, no issues. Payment-history flag clean. Recommend proceed with standard 1-month deposit.',
      sw: 'Kitambulisho kimethibitishwa. Ajira (Acme Bank) imethibitishwa moja kwa moja. Mwenye nyumba wa zamani: miezi 14, hakuna shida. Historia ya malipo safi. Pendekezo: endelea na dhamana ya kawaida ya mwezi mmoja.',
    },
    related: ['mwikila.draft.lease'],
    visibility: 'PUBLIC',
  },

  // ─────────────────────────────────────────────────────────────────
  // MARKETPLACE (3) — listings, applications, marketing.
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'mwikila.marketplace.listing',
    topic: 'marketplace',
    user_outcome: 'Owner publishes a listing across multiple portals in one go.',
    public_name: {
      en: 'Publish multi-channel listings',
      sw: 'Tangaza kwa njia nyingi mara moja',
    },
    public_description: {
      en: 'One listing with photos, rent, terms, and amenities goes to the owner-chosen mix (Jumia, OLX, Facebook, in-house referrals). Tracks views, enquiries, viewings per channel.',
      sw: 'Tangazo moja lenye picha, kodi, masharti, na vifaa hupelekwa kwa mchanganyiko aliouchagua mmiliki (Jumia, OLX, Facebook, rufaa za ndani). Hupima muonekano, maombi, ziara kwa kila njia.',
    },
    example_question: {
      en: 'Publish Unit 4B as available from May 1',
      sw: 'Tangaza Unit 4B inapatikana kuanzia Mei 1',
    },
    example_response_pattern: {
      en: 'Draft listing ready. KES 65k rent, 1-month deposit, available May 1. Pushing to Jumia / OLX / Facebook (your usual mix). Want to add WhatsApp Status to your own list too?',
      sw: 'Tangazo tayari. Kodi KES 65k, dhamana mwezi 1, inapatikana Mei 1. Ninapeleka Jumia / OLX / Facebook (mchanganyiko wako). Niongeze WhatsApp Status pia?',
    },
    related: ['mwikila.tracking.viewings', 'mwikila.marketplace.application'],
    visibility: 'PUBLIC',
  },
  {
    id: 'mwikila.marketplace.application',
    topic: 'marketplace',
    user_outcome: 'Applicant submits a structured application the owner can act on.',
    public_name: {
      en: 'Receive tenant applications',
      sw: 'Pokea maombi ya wapangaji',
    },
    public_description: {
      en: 'Applications flow into the owner portal with employment, references, ID, and rent budget pre-validated. Mr. Mwikila ranks them by likely success and proposes the next step (viewing, KYC, lease draft).',
      sw: 'Maombi huingia kwenye portal ya mmiliki yakiwa na ajira, rufaa, kitambulisho, na bajeti ya kodi vimethibitishwa. Mwikila huyapanga kulingana na uwezekano wa mafanikio na kupendekeza hatua inayofuata (ziara, KYC, rasimu ya mkataba).',
    },
    example_question: {
      en: 'Any new applications for 4B?',
      sw: 'Kuna maombi mapya ya 4B?',
    },
    example_response_pattern: {
      en: 'Three new this week. One stand-out: Mary Wanjiku, Acme Bank, KES 80k budget, prior landlord rave reference. Want me to fast-track her to KYC?',
      sw: 'Matatu mapya wiki hii. Mmoja anajitokeza: Mary Wanjiku, Acme Bank, bajeti KES 80k, rufaa nzuri kutoka mwenye nyumba wa zamani. Nimpeleke moja kwa moja kwa KYC?',
    },
    related: ['mwikila.compliance.kyc', 'mwikila.draft.lease'],
    visibility: 'PUBLIC',
  },
  {
    id: 'mwikila.marketplace.dispatch',
    topic: 'marketplace',
    user_outcome: "Owner dispatches a manager / agent to a specific application or viewing.",
    public_name: {
      en: 'Dispatch a manager or agent',
      sw: 'Mpeleke msimamizi au wakala',
    },
    public_description: {
      en: 'Owner clicks dispatch on an application; Mr. Mwikila assigns the right manager (closest, free, language match) and notifies the applicant. The full handoff packet (application, KYC notes, viewing slot) follows the manager.',
      sw: 'Mmiliki anabofya kupeleka kwa ombi; Mwikila humpangia msimamizi sahihi (karibu zaidi, huru, anaelewa lugha) na kumjulisha mwombaji. Kifurushi kamili (ombi, KYC, ratiba ya ziara) huenda kwa msimamizi.',
    },
    example_question: {
      en: 'Send John to handle the 4B viewing tomorrow',
      sw: 'Mtume John kushughulikia ziara ya 4B kesho',
    },
    example_response_pattern: {
      en: 'Done. John has the applicant brief, the access code, and a one-page summary on his phone. He confirms 10:30am tomorrow.',
      sw: 'Imekamilika. John ana muhtasari wa mwombaji, namba ya kuingia, na ukurasa mmoja kwenye simu yake. Amethibitisha saa 4:30 asubuhi kesho.',
    },
    related: ['mwikila.marketplace.application', 'mwikila.tracking.viewings'],
    visibility: 'PUBLIC',
  },

  // ─────────────────────────────────────────────────────────────────
  // HR (2) — payroll + onboarding for in-house staff.
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'mwikila.hr.payroll',
    topic: 'hr',
    user_outcome: 'Owner runs payroll for caretakers / managers / admin staff with one approval.',
    public_name: {
      en: 'Run payroll for estate staff',
      sw: 'Endesha malipo ya wafanyakazi wa nyumba',
    },
    public_description: {
      en: "Payroll pre-computed (basic, allowances, NHIF / NSSF / PAYE deductions, net). Owner reviews the totals, approves, and Mr. Mwikila disburses via M-Pesa B2C or bank transfer. Payslips auto-issued.",
      sw: 'Malipo yamehesabiwa kabla (msingi, posho, makato ya NHIF / NSSF / PAYE, halisi). Mmiliki anahakiki jumla, anakubali, na Mwikila hulipa kwa M-Pesa B2C au benki. Vipande vya mishahara hutolewa moja kwa moja.',
    },
    example_question: {
      en: 'Run April payroll',
      sw: 'Endesha malipo ya Aprili',
    },
    example_response_pattern: {
      en: '6 staff, gross KES 312k, statutory deductions KES 38k, net to disburse KES 274k. All within last-month band. Want me to go?',
      sw: 'Wafanyakazi 6, jumla KES 312k, makato ya sheria KES 38k, halisi ya kulipa KES 274k. Vyote ndani ya kiwango cha mwezi uliopita. Nianze?',
    },
    related: ['mwikila.draft.payslip', 'mwikila.communicate.staff'],
    visibility: 'PUBLIC',
  },
  {
    id: 'mwikila.hr.onboarding',
    topic: 'hr',
    user_outcome: 'New staff member is onboarded with contract, NHIF / NSSF registration, and tool access.',
    public_name: {
      en: 'Onboard new estate staff',
      sw: 'Mkaribishe mfanyakazi mpya',
    },
    public_description: {
      en: 'A new caretaker or admin assistant goes through KYC, contract signing, NHIF / NSSF / KRA PIN registration, M-Pesa till linking, and tool access in a single guided flow.',
      sw: 'Mlinzi mpya au msaidizi anapitia KYC, kusaini mkataba, kusajili NHIF / NSSF / KRA PIN, kuunganisha M-Pesa till, na kupata zana kwa muongozo mmoja.',
    },
    example_question: {
      en: 'Onboard Daniel as caretaker for Acme Heights',
      sw: 'Mkaribishe Daniel kuwa mlinzi wa Acme Heights',
    },
    example_response_pattern: {
      en: 'Step 1 of 5: KYC. Ask Daniel to bring his ID and a passport photo to the office or upload via the link I will text him. Want me to send the link now?',
      sw: 'Hatua 1 ya 5: KYC. Mwambie Daniel alete kitambulisho na picha ya pasipoti ofisini au apakie kupitia kiungo nitakachomtumia. Nitume kiungo sasa?',
    },
    related: ['mwikila.hr.payroll'],
    visibility: 'PUBLIC',
  },

  // ─────────────────────────────────────────────────────────────────
  // DECISION-MAKING (3) — Mr. Mwikila helps the owner THINK.
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'mwikila.decision.strategize',
    topic: 'decision-making',
    user_outcome: 'Owner gets a structured strategy memo with options, tradeoffs, and a recommendation.',
    public_name: {
      en: 'Strategy memos on big calls',
      sw: 'Maelezo ya mkakati kwa maamuzi makubwa',
    },
    public_description: {
      en: "When the owner asks 'what should I do?' on something non-trivial (raise rent, evict, refinance, expand), Mr. Mwikila lays out the current state, the constraints, 2-4 options with pros / cons, and a recommendation with the why.",
      sw: 'Mmiliki anapouliza "nifanye nini?" kuhusu jambo zito (kuongeza kodi, kufukuza, kukopa upya, kupanua), Mwikila huelezea hali ya sasa, vikwazo, mbinu 2-4 na hasara / faida, na pendekezo na sababu.',
    },
    example_question: {
      en: 'Should I evict the tenant in 9C or restructure the arrears?',
      sw: 'Nimfukuze mpangaji wa 9C au nibadilishe muundo wa madeni?',
    },
    example_response_pattern: {
      en: 'Current state: KES 130k arrears, 41 days. Constraints: 4-month notice required under RERA, vacancy cost is KES 65k / month, finding a like-for-like tenant takes 6 weeks. Two options: (A) restructure into a 6-month catch-up plan; (B) eviction process + replacement. Recommendation: A. Reasoning: restructure costs less even if 30% of catch-up plans fail. I will draft a retrospective check we can run in 90 days.',
      sw: 'Hali ya sasa: deni KES 130k, siku 41. Vikwazo: notisi ya miezi 4 chini ya RERA, gharama ya nyumba wazi KES 65k / mwezi, kupata mpangaji mwingine sawa ni wiki 6. Mbinu: (A) kubadilisha kuwa mpango wa miezi 6; (B) mchakato wa kufukuza + kubadilisha. Pendekezo: A. Sababu: gharama ndogo hata kama 30% ya mipango inashindwa. Nitaandaa ukaguzi tutakaoufanya baada ya siku 90.',
    },
    related: ['mwikila.tracking.arrears', 'mwikila.draft.notice'],
    visibility: 'PUBLIC',
  },
  {
    id: 'mwikila.decision.what-if',
    topic: 'decision-making',
    user_outcome: 'Owner runs a "what if" scenario without touching live data.',
    public_name: {
      en: '"What if" portfolio scenarios',
      sw: 'Hali za "kama" za mali',
    },
    public_description: {
      en: 'Owner asks "what if I raise rent 8% across the portfolio?" — Mr. Mwikila models retention sensitivity, projected vacancy, and net income change. No live data changes.',
      sw: 'Mmiliki anauliza "kama nikiongeza kodi 8% kwa mali zote?" — Mwikila huiga uvumilivu wa kubaki, makadirio ya nyumba wazi, na mabadiliko ya mapato halisi. Hakuna data inayoharibika.',
    },
    example_question: {
      en: 'What if I raise rent 8% across the portfolio?',
      sw: 'Kama nikiongeza kodi 8% kwa mali zote?',
    },
    example_response_pattern: {
      en: 'Model: 8% raise = +KES 328k / month gross. Expected retention loss: 3 tenants (medium-sensitivity profile). Net of vacancy cost during refill: +KES 220k / month after month 3. Want me to break it down per unit?',
      sw: 'Mfano: 8% = +KES 328k / mwezi jumla. Hasara ya kubaki: wapangaji 3 (wenye uvumilivu wa kati). Halisi baada ya gharama ya nyumba wazi: +KES 220k / mwezi baada ya mwezi 3. Nikuoneshe kwa kila nyumba?',
    },
    related: ['mwikila.decision.strategize', 'mwikila.forecasting.collections'],
    visibility: 'PUBLIC',
  },
  {
    id: 'mwikila.decision.undo',
    topic: 'decision-making',
    user_outcome: "Owner can undo any reversible action Mr. Mwikila took on their behalf.",
    public_name: {
      en: 'Undo a recent action',
      sw: 'Tendua hatua ya hivi karibuni',
    },
    public_description: {
      en: 'Notices sent, work-orders created, rent receipts issued — any reversible action can be undone within the same day. Mr. Mwikila notifies all impacted parties on undo.',
      sw: 'Notisi zilizotumwa, kazi zilizoanzishwa, risiti za kodi zilizotolewa — hatua yoyote inayoweza kutenduliwa inaweza kutenduliwa siku hiyo hiyo. Mwikila huwajulisha wote walioathirika.',
    },
    example_question: {
      en: 'Undo the rent reminder I sent to 4B by mistake',
      sw: 'Tendua kumbusho la kodi nililomtumia 4B kwa makosa',
    },
    example_response_pattern: {
      en: 'Reminder retracted with a follow-up SMS apologising for the confusion. Want me to also delete it from her WhatsApp thread?',
      sw: 'Kumbusho limeondolewa kwa SMS ya kuomba msamaha kwa kuchanganyikiwa. Niliondoe pia kwenye WhatsApp yake?',
    },
    related: ['mwikila.compliance.audit-trail'],
    visibility: 'PUBLIC',
  },

  // ─────────────────────────────────────────────────────────────────
  // MEMORY (2) — cross-session memory + on-demand recall.
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'mwikila.memory.cross-session',
    topic: 'memory',
    user_outcome: "Mr. Mwikila remembers prior conversations across sessions and devices.",
    public_name: {
      en: 'Remembers across sessions',
      sw: 'Huwa anakumbuka kati ya mazungumzo',
    },
    public_description: {
      en: "Yesterday's conversation about Unit 5C, last week's lease renewal of 2A, the contractor preference for Plumb-It vs. AAA Plumbers — all remembered and used in this turn without the owner having to repeat.",
      sw: 'Mazungumzo ya jana kuhusu Unit 5C, kukubali kuongeza muda wa 2A wiki iliyopita, mapendeleo ya mkandarasi Plumb-It vs. AAA Plumbers — vyote vinakumbukwa na kutumika sasa bila mmiliki kurudia.',
    },
    example_question: {
      en: 'Continue from where we left off',
      sw: 'Endeleza pale tulipoachia',
    },
    example_response_pattern: {
      en: 'We left off mid-conversation on the 9C arrears case yesterday. You were leaning toward restructure rather than eviction. Pick up from there?',
      sw: 'Tulisimama katikati ya mazungumzo ya deni la 9C jana. Ulikuwa unaegemea kubadilisha muundo kuliko kufukuza. Tuendelee?',
    },
    related: ['mwikila.searching.history'],
    visibility: 'PUBLIC',
  },
  {
    id: 'mwikila.memory.preferences',
    topic: 'memory',
    user_outcome: 'Owner has the AI tuned to their preferred channels, language, and tone.',
    public_name: {
      en: 'Remembers owner preferences',
      sw: 'Hukumbuka mapendeleo ya mmiliki',
    },
    public_description: {
      en: 'Default greeting time, language switching cadence, preferred channels per tenant cohort, signature vendor list, threshold for asking permission — Mr. Mwikila learns and adapts.',
      sw: 'Wakati wa salamu, ratiba ya kubadili lugha, njia za mapendeleo kwa kila kundi la wapangaji, orodha ya wakandarasi wapendwa, kiwango cha kuomba ridhaa — Mwikila hujifunza na kubadilika.',
    },
    example_question: {
      en: 'Switch all my comms to WhatsApp by default',
      sw: 'Geuza mazungumzo yangu yote kwa WhatsApp kama msingi',
    },
    example_response_pattern: {
      en: 'Set. From now on, WhatsApp is the default for tenant and staff messages where the phone is verified. SMS as fallback for unverified. Want me to apply retroactively to the next batch of reminders?',
      sw: 'Imewekwa. Kuanzia sasa, WhatsApp ndio msingi kwa ujumbe wa wapangaji na wafanyakazi pale simu imethibitishwa. SMS kama mbadala. Niitumie pia kwa kundi linalofuata la kumbusho?',
    },
    related: ['mwikila.memory.cross-session'],
    visibility: 'PUBLIC',
  },

  // ─────────────────────────────────────────────────────────────────
  // MULTI-DEVICE / MULTI-LANGUAGE / MULTI-CURRENCY / MULTI-SCALE (4)
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'mwikila.multi-device.continuity',
    topic: 'multi-device',
    user_outcome: "Owner picks up the same conversation on phone, laptop, or web.",
    public_name: {
      en: 'Continue any device',
      sw: 'Endeleza kwa kifaa chochote',
    },
    public_description: {
      en: 'A chat started on the owner-portal web is continuable on the workforce mobile app and vice-versa. Same memory, same context, same tools.',
      sw: 'Mazungumzo yaliyoanza kwenye portal ya wavuti yanaweza kuendelezwa kwenye programu ya simu na vice-versa. Kumbukumbu sawa, muktadha sawa, zana sawa.',
    },
    example_question: {
      en: 'Pick up our chat on my phone',
      sw: 'Endeleza mazungumzo yetu kwa simu yangu',
    },
    example_response_pattern: {
      en: 'Already there. Open the BOSSNYUMBA app and the conversation is loaded. Anything you want to add before we move on?',
      sw: 'Tayari yapo. Fungua programu ya BOSSNYUMBA na mazungumzo yapo. Cha kuongeza kabla hatujaendelea?',
    },
    related: ['mwikila.memory.cross-session'],
    visibility: 'PUBLIC',
  },
  {
    id: 'mwikila.multi-language.bilingual',
    topic: 'multi-language',
    user_outcome: 'Owner uses either Swahili or English; both stay first-class.',
    public_name: {
      en: 'Bilingual Swahili + English',
      sw: 'Lugha mbili: Kiswahili + Kiingereza',
    },
    public_description: {
      en: 'Switch language mid-sentence; Mr. Mwikila keeps up. Documents render in the language each counterparty actually reads. The audit trail logs language per turn for compliance with bilingual disclosure norms.',
      sw: 'Badilisha lugha katikati ya sentensi; Mwikila anaendana nawe. Hati huandikwa kwa lugha kila mhusika anasoma. Ukaguzi hupandisha lugha kwa kila zamu kufuata sheria za lugha mbili.',
    },
    example_question: {
      en: 'Send the notice in Swahili',
      sw: 'Tuma notisi kwa Kiswahili',
    },
    example_response_pattern: {
      en: 'Done. Notice in Swahili for the tenant, English copy in the audit trail for KRA. Want me to bcc your lawyer the EN copy too?',
      sw: 'Imefanyika. Notisi kwa Kiswahili kwa mpangaji, nakala ya Kiingereza kwenye ukaguzi kwa KRA. Niwasilishie pia wakili wako nakala ya EN?',
    },
    related: ['mwikila.communicate.tenant'],
    visibility: 'PUBLIC',
  },
  {
    id: 'mwikila.multi-currency.tzs-primary',
    topic: 'multi-currency',
    user_outcome: 'Owner sees every figure in the right currency with the right code.',
    public_name: {
      en: 'Multi-currency with explicit codes',
      sw: 'Sarafu nyingi zenye misimbo wazi',
    },
    public_description: {
      en: 'Local currency is primary (TZS, KES, UGX) — every figure carries the ISO-4217 code on first mention. USD-quoted leases are supported and converted with the BoT or CBK reference rate.',
      sw: 'Sarafu ya ndani ni ya msingi (TZS, KES, UGX) — kila tarakimu ina msimbo wa ISO-4217 mwanzoni. Mikataba ya USD inakubaliwa na kubadilishwa kwa kiwango cha rejea cha BoT au CBK.',
    },
    example_question: {
      en: 'Convert the Office Tower lease to TZS for the report',
      sw: 'Badilisha mkataba wa Office Tower kuwa TZS kwa ripoti',
    },
    example_response_pattern: {
      en: 'Done at today BoT mid-rate (USD 1 = TZS 2,541). The lease values reflect that. Want me to lock the rate for the rest of this month so the report stays stable?',
      sw: 'Imebadilishwa kwa kiwango cha BoT cha leo (USD 1 = TZS 2,541). Mkataba unaonyesha hivyo. Nifunge kiwango kwa mwezi mzima ili ripoti ibaki imara?',
    },
    related: ['mwikila.alerting.fx'],
    visibility: 'PUBLIC',
  },
  {
    id: 'mwikila.multi-scale.single-to-portfolio',
    topic: 'multi-scale',
    user_outcome: 'Owner uses Mr. Mwikila whether they own one unit or two hundred.',
    public_name: {
      en: 'Works at any scale',
      sw: 'Inafanya kazi kwa ukubwa wowote',
    },
    public_description: {
      en: 'One landlord with one unit gets the same first-class experience as a portfolio with 250 units across 12 buildings. The UI and the tools adapt; the audit chain, the compliance discipline, and the persona stay constant.',
      sw: 'Mwenye nyumba mmoja wa nyumba moja anapata uzoefu sawa na bibi yenye nyumba 250 katika majengo 12. UI na zana hubadilika; ukaguzi, nidhamu ya sheria, na utu hubaki sawa.',
    },
    example_question: {
      en: 'Does this work for me, I have just two units?',
      sw: 'Inafanya kazi kwangu, nina nyumba mbili tu?',
    },
    example_response_pattern: {
      en: 'Yes. The exact same tools that move a 200-unit portfolio also handle two. You will see a slimmer dashboard, but the lease drafting, rent tracking, and KRA filing are identical. Want me to set up your two units now?',
      sw: 'Ndio. Zana zile zile zinazoendesha mali 200 huendesha pia mbili. Utaona dashibodi ndogo, lakini kuandika mkataba, kufuatilia kodi, na kuwasilisha KRA ni sawa. Niandike nyumba zako mbili sasa?',
    },
    related: [],
    visibility: 'PUBLIC',
  },

  // ─────────────────────────────────────────────────────────────────
  // META (3) — identity, jurisdiction, capability disclosure.
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'mwikila.meta.about',
    topic: 'meta',
    user_outcome: "User understands who Mr. Mwikila is and what kind of help he gives.",
    public_name: {
      en: 'About Mr. Mwikila',
      sw: 'Kuhusu Bwana Mwikila',
    },
    public_description: {
      en: "Mr. Mwikila is BOSSNYUMBA's AI counterpart for property owners and managers — purpose-built for East-African residential and commercial property management. Not a general chatbot; tuned to leases, rent, work-orders, and the housing authorities.",
      sw: 'Mwikila ni AI ya BOSSNYUMBA kwa wamiliki na wasimamizi wa nyumba — iliyoundwa kwa ajili ya mali za makazi na biashara Afrika Mashariki. Sio chatbot ya kawaida; imelengwa kwa mikataba, kodi, kazi za matengenezo, na mamlaka za nyumba.',
    },
    example_question: {
      en: 'What are you?',
      sw: 'Wewe ni nani?',
    },
    example_response_pattern: {
      en: "I am Mr. Mwikila, BOSSNYUMBA's AI property manager. I work alongside you on leases, rent, maintenance, compliance, and tenant relations. Not a generic assistant — tuned for property work in your jurisdiction.",
      sw: 'Mimi ni Bwana Mwikila, AI ya BOSSNYUMBA. Ninafanya kazi nawe katika mikataba, kodi, matengenezo, sheria, na uhusiano wa wapangaji. Sio msaidizi wa kawaida — nimelengwa kwa kazi za nyumba katika eneo lako.',
    },
    related: ['mwikila.meta.capabilities'],
    visibility: 'PUBLIC',
  },
  {
    id: 'mwikila.meta.capabilities',
    topic: 'meta',
    user_outcome: 'User asks "what can you do" and gets an outcome-focused answer.',
    public_name: {
      en: 'What can you do',
      sw: 'Unaweza kufanya nini',
    },
    public_description: {
      en: 'When asked "what can you do" / "how does this work" / "show me your features", Mr. Mwikila answers in user-outcome language drawn from this registry — never internal architecture.',
      sw: 'Akiulizwa "unaweza kufanya nini" / "inafanyaje kazi" / "nionyeshe vipengele", Mwikila hujibu kwa lugha ya matokeo kwa mtumiaji kutoka kwa orodha hii — kamwe si muundo wa ndani.',
    },
    example_question: {
      en: 'What can you do?',
      sw: 'Unaweza kufanya nini?',
    },
    example_response_pattern: {
      en: 'I draft leases and notices, chase rent, run KRA filings, dispatch maintenance, track viewings, and brief your staff — in Swahili or English. What is the thing you would most like off your plate this week?',
      sw: 'Ninaandika mikataba na notisi, kufuatilia kodi, kuwasilisha KRA, kupanga matengenezo, kufuatilia ziara, na kuelekeza wafanyakazi wako — kwa Kiswahili au Kiingereza. Ni kitu gani ungependa kuondolewa wiki hii?',
    },
    related: ['mwikila.meta.about'],
    visibility: 'PUBLIC',
  },
  {
    id: 'mwikila.meta.jurisdiction',
    topic: 'meta',
    user_outcome: "User sees the current jurisdiction Mr. Mwikila is using for laws and currency.",
    public_name: {
      en: 'Current jurisdiction',
      sw: 'Sheria ya sasa',
    },
    public_description: {
      en: "Mr. Mwikila operates with a per-tenant jurisdiction (TZ / KE / UG / NG / ZA / AU / CL / ID) — laws, authorities, currency, and form templates all adapt. Locked at signup; can be temporarily switched for a turn or a session.",
      sw: 'Mwikila anafanya kazi kwa sheria ya tenant (TZ / KE / UG / NG / ZA / AU / CL / ID) — sheria, mamlaka, sarafu, na muundo wa fomu zote hubadilika. Hufungwa wakati wa kujisajili; inaweza kubadilika kwa zamu au kikao.',
    },
    example_question: {
      en: 'Which jurisdiction am I in?',
      sw: 'Niko sheria ipi?',
    },
    example_response_pattern: {
      en: 'You are set to Kenya (KE). Currency KES, housing authority RERA-KE / KRA for rental income, lease formats per the Landlord and Tenant Act. Want to switch to TZ for this turn only?',
      sw: 'Umewekwa Kenya (KE). Sarafu KES, mamlaka RERA-KE / KRA kwa mapato ya kodi, muundo wa mkataba kwa mujibu wa Landlord and Tenant Act. Ubadilishe kwa TZ kwa zamu hii tu?',
    },
    related: ['mwikila.compliance.statutory'],
    visibility: 'PUBLIC',
  },
];

/**
 * Canonical capability registry — frozen at module load.
 *
 * Hard-fails at boot if any entry is malformed (CapabilityEntrySchema), or
 * if any `related[]` foreign key does not resolve to a known entry id.
 */
export const CAPABILITY_REGISTRY: ReadonlyArray<CapabilityEntry> = (() => {
  const seen = new Set<string>();
  const validated = ENTRIES.map((raw) => {
    const parsed = CapabilityEntrySchema.parse(raw);
    if (seen.has(parsed.id)) {
      throw new Error(
        `capability-registry: duplicate id ${parsed.id} — every entry must be unique.`,
      );
    }
    seen.add(parsed.id);
    return Object.freeze(parsed);
  });

  // Referential integrity — every `related[]` foreign key must resolve.
  const ids = new Set(validated.map((entry) => entry.id));
  for (const entry of validated) {
    for (const ref of entry.related) {
      if (!ids.has(ref)) {
        throw new Error(
          `capability-registry: ${entry.id}.related references unknown id ${ref}`,
        );
      }
    }
  }

  return Object.freeze(validated);
})();

export const CAPABILITY_COUNT: number = CAPABILITY_REGISTRY.length;

export function getCapabilityById(id: string): CapabilityEntry | undefined {
  return CAPABILITY_REGISTRY.find((entry) => entry.id === id);
}

export function listCapabilitiesByTopic(
  topic: CapabilityTopic,
): ReadonlyArray<CapabilityEntry> {
  return CAPABILITY_REGISTRY.filter((entry) => entry.topic === topic);
}

export function listCapabilitiesByVisibility(
  visibility: CapabilityVisibility,
): ReadonlyArray<CapabilityEntry> {
  return CAPABILITY_REGISTRY.filter(
    (entry) => entry.visibility === visibility,
  );
}

/**
 * Mr. Mwikila uses this to ground his disclosure answers — only PUBLIC +
 * EXPERIMENTAL entries are exposed to the user.
 */
export function listDisclosableCapabilities(): ReadonlyArray<CapabilityEntry> {
  return CAPABILITY_REGISTRY.filter(isDisclosable);
}
