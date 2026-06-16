/* eslint-disable bossnyumba/no-jurisdictional-literal -- reason: this file is static
   marketing audience copy. Real-world references like 'NIDA' (Tanzanian ID) and the
   Swahili word 'Huduma' (service) appear as page prose / stat labels, not as tenant
   business-logic bindings — there is no `tenant.country` resolution to route through here. */
import type { AudiencePageCopy } from '@/components/audience/AudiencePage';
import type { Locale } from './i18n';

/**
 * Swahili variants — COMPLETE parity. Every audience in `COPY` has a
 * matching Swahili entry here, so the sw/en toggle is ABSOLUTE: under `sw`
 * no English audience copy ever renders (no cross-language fallback). The
 * `audience-copy-parity.test.ts` gate fails the build if a key drifts.
 */
export const COPY_SW: Partial<Record<string, Readonly<AudiencePageCopy>>> = {
  individualLandlord: {
    heroKicker: 'Kwa mwenye nyumba binafsi',
    heroHeadline: 'Endesha vyumba viwili',
    heroHeadlineAccent: 'kama mali ya mfululizo',
    heroSub:
      'Ukimiliki vitengo 1 hadi 5, Mwl. Mwikila anakusanya kodi kupitia M-Pesa kwa idhini ya mpangaji kwa mguso mmoja, anatuma vikumbusho vya kodi iliyochelewa kiotomatiki, anaandaa wasilisho la ushuru wa halmashauri kwa idhini yako ya mguso mmoja, na kukutumia barua pepe ya muhtasari wa ukurasa mmoja kila tarehe 1. Unabaki bure kwenye kiwango cha Smallholder (T1).',
    heroPrimaryCta: 'Jisajili — bure',
    heroSecondaryCta: 'Inavyofanya kazi',
    trustline: [
      'Bure hadi vitengo 5',
      'Kukusanya kodi kupitia M-Pesa',
      'Hakuna kadi inayohitajika',
    ],
    statsHeading: 'Imejengwa kwa mwenye nyumba wa Kitanzania, sio REIT ya Wall Street.',
    statsSub:
      'Wenye nyumba binafsi hupoteza asilimia 18 ya kodi ya mwaka kwa malipo yanayochelewa, simu za kufuatilia kwa mikono, na risiti zinazokosekana. Mwl. Mwikila huziba pengo hilo kwa vikumbusho vya kiotomatiki, leja ya kuingia mara mbili, na muhtasari wa ukurasa mmoja — kwa gharama sifuri kwenye kiwango cha Smallholder.',
    stats: [
      {
        value: '18%',
        label: 'Wastani wa upotevu wa kodi',
        sub: 'Kwa wenye nyumba wasio na vifaa Dar es Salaam (BOT 2025).',
      },
      {
        value: 'Masaa 4',
        label: 'Yameokolewa kwa mwezi',
        sub: 'Kwenye kufuatilia kodi, risiti na uhasibu.',
      },
      {
        value: 'TZS 0',
        label: 'Kwenye kiwango cha Smallholder',
        sub: 'Hadi vitengo 5, kiti kimoja, shughuli za msingi za mali.',
      },
    ],
    stepsKicker: 'Inavyofanya kazi',
    stepsHeading: 'Hatua tatu. Saa moja. Kisha inajiendesha yenyewe.',
    steps: [
      {
        n: '01',
        title: 'Ongeza vitengo vyako',
        body: 'Piga picha ukurasa wa hati; Mwl. Mwikila huchimba data ya mali na mpangaji. Ongeza nambari yako ya M-Pesa kupokea kodi.',
      },
      {
        n: '02',
        title: 'Mwl. Mwikila anakusanya',
        body: 'Wapangaji wanaidhinisha ombi la M-Pesa kwa simu zao. Waliochelewa hupata ukumbusho wa Kiswahili wa adabu kiotomatiki. Wewe unapata arifa kila malipo yanapofika.',
      },
      {
        n: '03',
        title: 'Muhtasari wa mwenye nyumba tarehe 1',
        body: 'Kila mwezi: kodi iliyopokelewa, ushuru wa halmashauri ulioandaliwa kwa idhini yako, matengenezo yanayodaiwa, salio kwa akaunti yako. PDF na barua pepe.',
      },
    ],
    problemKicker: 'Mkazo',
    problemHeading: 'Kufuatilia kwa mikono, risiti zinazokosekana,',
    problemHeadingAccent: 'na tarehe za mwisho za halmashauri',
    problemSub:
      'Mwenye nyumba binafsi hulipia mifumo iliyokosekana kwa muda wake. Mwl. Mwikila hubadilisha lahajedwali, kufuatilia kwa WhatsApp, na hofu ya mwezi wa ushuru wa halmashauri.',
    problemTitle: 'Bila BossNyumba',
    problems: [
      {
        title: 'Kufuatilia kwa WhatsApp',
        desc: 'Unatumia asubuhi ya Jumamosi kufuatilia kodi kutoka kwa wapangaji watatu wote wanaoahidi "kesho".',
      },
      {
        title: 'Risiti zinazokosekana',
        desc: 'Mpangaji anadai amelipa; huwezi kupata SMS ya M-Pesa. Migogoro inaharibu uaminifu.',
      },
      {
        title: 'Hofu ya ushuru wa halmashauri',
        desc: 'Unakumbuka ushuru unahitajika tarehe 28 unapoona WhatsApp kutoka manispaa.',
      },
      {
        title: 'Karatasi za mwisho wa mwaka',
        desc: 'Kufungua ushuru hugeuka kuwa uchimbaji wa kiakiolojia wa siku kadhaa kwenye simu yako.',
      },
    ],
    solutionTitle: 'Na BossNyumba',
    solutions: [
      {
        title: 'Vikumbusho vya Kiswahili kiotomatiki',
        desc: 'Mwl. Mwikila anatuma vikumbusho vya kodi iliyochelewa kiotomatiki kupitia WhatsApp, SMS na barua pepe kwa toni sahihi — yenye adabu, thabiti, sio ya kuudhi.',
      },
      {
        title: 'Risiti za kripto',
        desc: 'Kila malipo ya M-Pesa yanafika kwenye leja isiyobadilika ya kuingia mara mbili, hivyo risiti ni ile ile pande zote mbili — hakuna migogoro ya malipo tena.',
      },
      {
        title: 'Kalenda ya udhibiti',
        desc: 'Ushuru wa halmashauri, kodi ya mali, kurefusha mikataba — kila tarehe ya mwisho inafika kwenye simu yako siku 14 mapema.',
      },
      {
        title: 'Mwisho wa mwaka tayari kwa ushuru',
        desc: 'Muhtasari wa wamiliki unaunganisha kuwa pack tayari kwa TRA kwa sekunde 90, kwa idhini yako ya mguso mmoja.',
      },
    ],
    ctaHeading: 'Anza bure leo.',
    ctaSub:
      'Kiwango cha Smallholder ni bure hadi vitengo 5. Jisajili na nambari yako ya M-Pesa — hakuna kadi inayohitajika.',
    ctaPrimary: 'Jisajili — bure',
  },

  portfolioLandlord: {
    heroKicker: 'Kwa mwenye nyumba wa kundi la mali',
    heroHeadline: 'Pale vitengo vitano vinapokuwa',
    heroHeadlineAccent: 'hamsini',
    heroSub:
      'Mwl. Mwikila anakua pamoja nawe. Ongeza majengo, vitalu, na mali nzima bila kuongeza lahajedwali. Mtiririko wa fedha kati ya mali, takwimu za kundi la mali, muhtasari wa mwenye nyumba wa kila mwezi, na kifaa cha kudhibiti uhuru kinachokuwezesha kukabidhi sehemu zinazochosha kwa idhini yako.',
    heroPrimaryCta: 'Weka miadi ya onyesho la dakika 20',
    heroSecondaryCta: 'Tazama jukwaa',
    trustline: [
      'Hadi vitengo 2,500 kwenye kiwango cha Corporate',
      'Sarafu nyingi TZS/KES/USD',
      'Hoja za Master Brain',
    ],
    statsHeading: 'Acha kuwa mhasibu wako mwenyewe.',
    statsSub:
      'Wenye nyumba wa kundi la mali huteketeza jioni zao kwenye shughuli za kodi, upangaji wa matengenezo, na muhtasari ambao ungepaswa kuwa wa kiotomatiki. Mwl. Mwikila anarejesha muda huo na badala yake anakupa muhtasari wa asubuhi.',
    stats: [
      {
        value: 'Kila siku',
        label: 'Muhtasari wa asubuhi',
        sub: 'Muhtasari wa skrini moja wa usiku kucha, unaozalishwa kwa ratiba na injini ya muhtasari wa watendaji.',
      },
      {
        value: 'Otomatiki',
        label: 'Vikumbusho vya kodi iliyochelewa',
        sub: 'Vinatumwa kupitia WhatsApp, SMS na barua pepe vikiwa na njia mbadala — hakuna kufuatilia kwa mikono.',
      },
      {
        value: 'Mguso 1',
        label: 'Muhtasari wa mwenye nyumba',
        sub: 'Muhtasari wa kila mwezi kwa kila mali, unaoweza kuhamishwa kwa sarafu yoyote.',
      },
    ],
    stepsKicker: 'Inavyofanya kazi',
    stepsHeading: 'Ingiza kundi lako la mali. Weka kiwango cha uhuru. Ondoka.',
    steps: [
      {
        n: '01',
        title: 'Ingiza',
        body: 'Leta historia yako ya Excel + Drive + WhatsApp. Mwl. Mwikila huchimba mali, mikataba, wapangaji, na madeni ya kodi.',
      },
      {
        n: '02',
        title: 'Weka uhuru',
        body: 'Chagua kiasi gani Mwl. Mwikila anafanya peke yake kwa kila eneo — Fedha, Matengenezo, Utii, Upangishaji.',
      },
      {
        n: '03',
        title: 'Pokea muhtasari',
        body: 'Kila asubuhi saa 12 alfajiri: muhtasari wa skrini moja wa kilichotokea usiku kucha, kinachohitaji jicho lako, na alichoshughulikia yeye.',
      },
    ],
    problemKicker: 'Kodi ya ukuaji',
    problemHeading: 'Vitengo zaidi, lahajedwali',
    problemHeadingAccent: 'zaidi',
    problemSub:
      'Pale kundi la mali linapokua zaidi ya vitengo kumi, lahajedwali huacha kutosha. Ama unaajiri meneja wa ndani, au unakubali upotevu. Mwl. Mwikila ni chaguo la tatu.',
    problemTitle: 'Bila BossNyumba',
    problems: [
      {
        title: 'Mtawanyiko wa lahajedwali',
        desc: 'Karatasi moja kwa kila jengo, hakuna inayolingana, hakuna inayodumu unapobadilisha simu.',
      },
      {
        title: 'Mlundikano wa matengenezo',
        desc: 'Tiketi zinarundikana kwenye WhatsApp; unasahau tangi lililoharibika kwenye kitengo 4B kwa wiki tatu.',
      },
      {
        title: 'Maeneo yasiyoonekana ya mtiririko wa fedha',
        desc: 'Huwezi kujua jengo lipi lina faida hasa hadi mhasibu wa mwisho wa mwaka anapowasili.',
      },
      {
        title: 'Utii wa kukimbiza-kimbiza',
        desc: 'Halmashauri tofauti, tarehe za mwisho tofauti, fomu tofauti. Kuna kitu kinapita kila wakati.',
      },
    ],
    solutionTitle: 'Na BossNyumba',
    solutions: [
      {
        title: 'Dashibodi moja ya kundi la mali',
        desc: 'Kila mali, kila kitengo, kila mpangaji — ukurasa mmoja, wakati halisi.',
      },
      {
        title: 'Upangaji wa matengenezo',
        desc: 'Picha za uvujaji zinafika kwenye tiketi; Mwl. Mwikila anapendekeza muuzaji sahihi na agizo la kazi kwa idhini yako.',
      },
      {
        title: 'Takwimu kwa kila jengo',
        desc: 'Takwimu za ukaaji, mapato, na matumizi kwa kila mali, kwa kila kitalu — zinazoweza kuhamishwa kwa sarafu yoyote.',
      },
      {
        title: 'Kalenda ya udhibiti',
        desc: 'Kila halmashauri, kila tarehe ya mwisho inaonyeshwa mapema; Mwl. Mwikila anaandaa kila wasilisho kwa idhini yako ya mguso mmoja.',
      },
    ],
    ctaHeading: 'Endesha zaidi, fanya kidogo.',
    ctaSub:
      'Weka miadi ya onyesho la dakika 20. Tutaingiza sampuli ya kundi lako la mali moja kwa moja na kukuonyesha dashibodi ambayo ungeitumia kesho.',
    ctaPrimary: 'Weka miadi ya onyesho',
  },

  tenant: {
    heroKicker: 'Kwa wapangaji na watarajiwa',
    heroHeadline: 'Tafuta nyumba,',
    heroHeadlineAccent: 'omba kwa dakika chache',
    heroSub:
      'Tafuta mali iliyohakikiwa Dar es Salaam, Arusha, Mwanza, Mbeya na Nairobi. Omba kutembelea. Omba kwa wasifu wako uliohakikiwa, weka zabuni, na zungumza na meneja wa mali — yote kwa simu yako.',
    heroPrimaryCta: 'Vinjari matangazo',
    heroSecondaryCta: 'Jinsi ya kuomba',
    trustline: [
      'Wenye nyumba waliohakikiwa pekee',
      'Wasifu wa mwombaji uliohakikiwa',
      'Mazungumzo ndani ya programu',
    ],
    statsHeading: 'Matangazo ya BossNyumba ndiyo yaliyohakikiwa.',
    statsSub:
      'Kila mali kwenye BossNyumba ina mwenye nyumba aliyehakikiwa hatimiliki, kitengo kilichokaguliwa, na kiolezo cha mkataba kilichoidhinishwa chini ya Sheria ya Ardhi. Hakuna matangazo ya kubuni.',
    stats: [
      {
        value: '100%',
        label: 'Imehakikiwa hatimiliki',
        sub: 'Kila mwenye nyumba huhakikiwa dhidi ya msajili kabla ya kutangaza.',
      },
      {
        value: 'NIDA',
        label: 'Wasifu uliohakikiwa',
        sub: 'Omba mara moja kwa wasifu wa utambulisho uliohakikiwa; bila kujirudia kwa kila mwenye nyumba.',
      },
      {
        value: '0%',
        label: 'Ada zilizofichwa',
        sub: 'Gharama za huduma na amana hufichuliwa mapema, kwenye kila tangazo.',
      },
    ],
    stepsKicker: 'Jinsi ya kuomba',
    stepsHeading: 'Hatua tatu. Kutoka kuvinjari hadi kuchaguliwa.',
    steps: [
      {
        n: '01',
        title: 'Vinjari + tembelea',
        body: 'Chuja kwa eneo, vyumba vya kulala, bei. Omba ziara ya mtandaoni au kutembelea ana kwa ana moja kwa moja kutoka kwenye tangazo.',
      },
      {
        n: '02',
        title: 'Omba + weka zabuni',
        body: 'Gusa "Nataka hii". Mwenye nyumba anaona wasifu wako uliohakikiwa (NIDA, mwajiri, marejeo) kisha anakubali, anatoa pingamizi, au anakualika kuweka zabuni.',
      },
      {
        n: '03',
        title: 'Kubaliana masharti',
        body: 'Zungumza na meneja wa mali ndani ya programu kupanga kuhamia, amana, na masharti ya mkataba kabla ya kujitolea.',
      },
    ],
    problemKicker: 'Mtego wa upangaji',
    problemHeading: 'Matangazo ya kubuni, amana zinazopotea,',
    problemHeadingAccent: 'hakuna risiti',
    problemSub:
      'Kupanga kupitia makundi ya WhatsApp kunamaanisha ulaghai, wenye nyumba wa kubuni, na migogoro isiyoisha kamwe. BossNyumba huvuta soko la upangaji kuwa mfumo uliohakikiwa, wenye risiti.',
    problemTitle: 'Bila BossNyumba',
    problems: [
      {
        title: 'Matangazo ya kubuni',
        desc: 'Picha ilikuwa nzuri; nyumba ilibomolewa miezi sita iliyopita.',
      },
      {
        title: 'Wenye nyumba wasiohakikiwa',
        desc: 'Huwezi kujua nani hasa anamiliki kitengo, au kama amana iko salama.',
      },
      {
        title: 'Masharti yaliyofichwa',
        desc: 'Gharama za huduma na kanuni za amana hujitokeza tu baada ya kujitolea.',
      },
      {
        title: 'Kufukuzwa kinyume cha haki',
        desc: 'Hakuna notisi ya maandishi, hakuna kipindi cha notisi, hakuna njia ya kupinga.',
      },
    ],
    solutionTitle: 'Na BossNyumba',
    solutions: [
      {
        title: 'Matangazo yaliyohakikiwa pekee',
        desc: 'Wenye nyumba waliokaguliwa hatimiliki, vitengo vilivyokaguliwa, violezo vya mkataba vilivyoidhinishwa na halmashauri.',
      },
      {
        title: 'Wasifu wa mwombaji uliohakikiwa',
        desc: 'Omba mara moja kwa wasifu uliohakikiwa kwa NIDA na marejeo; mwenye nyumba anaona mwombaji halisi, sio ujumbe wa WhatsApp.',
      },
      {
        title: 'Masharti ya wazi mapema',
        desc: 'Gharama za huduma, amana, na masharti ya mkataba hufichuliwa kwenye kila tangazo — na kuthibitishwa kwenye mazungumzo ndani ya programu kabla ya kujitolea.',
      },
      {
        title: 'Haki za mpangaji',
        desc: 'Mkataba + notisi + njia ya kushughulikia migogoro vimeelezwa kwa Kiswahili na Kiingereza. Vimejengwa juu ya Sheria ya Ardhi, sio dhana tupu.',
      },
    ],
    ctaHeading: 'Tafuta nyumba leo.',
    ctaSub: 'Vinjari matangazo yaliyohakikiwa. Hauhitaji akaunti kuangalia — unahitaji tu kuomba.',
    ctaPrimary: 'Vinjari matangazo',
  },

  leasingAgency: {
    heroKicker: 'Kwa kampuni za upangishaji + makazi ya kampuni',
    heroHeadline: 'Panga wapangaji mara kumi',
    heroHeadlineAccent: 'haraka zaidi',
    heroSub:
      'Pata bidhaa zilizothibitishwa kote Tanzania na Kenya. Linganisha wateja watarajiwa na vitengo kwa kilinganishi cha AI. Tengeneza mapendekezo ya makazi ya kampuni kwa dakika chache. Fuatilia kila upangaji na kila kamisheni kwenye leja moja.',
    heroPrimaryCta: 'Panga simu ya ushirikiano',
    heroSecondaryCta: 'Ona dashibodi ya kampuni',
    trustline: [
      'Bidhaa kutoka kwa wenye nyumba wengi',
      'Kamisheni kwenye leja moja',
      'Mfumo wa makazi ya kampuni',
    ],
    statsHeading: 'Mfumo ambao kampuni za upangishaji zingependa kuujenga.',
    statsSub:
      'Kampuni zilizo kwenye BossNyumba hufanya kazi kwa bidhaa hai zilizothibitishwa, hulinganisha wateja watarajiwa kwa kilinganishi cha AI, na hufuatilia kila upangaji na kila kamisheni kwenye leja moja badala ya kundi la WhatsApp.',
    stats: [
      {
        value: 'Hai',
        label: 'Mtiririko wa bidhaa',
        sub: 'Wenye nyumba huhuisha Mwl. Mwikila; wewe unaona upatikanaji uliothibitishwa wakati halisi.',
      },
      {
        value: 'AI',
        label: 'Kilinganishi cha wateja watarajiwa',
        sub: 'Hupanga bidhaa zilizothibitishwa dhidi ya kila ombi — vyumba vya kulala, shule, usalama, safari ya kazini, bajeti.',
      },
      {
        value: '1',
        label: 'Leja ya kamisheni',
        sub: 'Kila upangaji na kila kamisheni huingizwa kwenye leja moja ya kuingia mara mbili yenye muhtasari uliotiwa saini.',
      },
    ],
    stepsKicker: 'Inavyofanya kazi',
    stepsHeading: 'Unganisha wateja wako watarajiwa. Linganisha. Panga. Pata malipo.',
    steps: [
      {
        n: '01',
        title: 'Sawazisha wateja watarajiwa',
        body: 'Leta wateja wa kampuni (benki, balozi, wapangaji wa makampuni). BossNyumba huandaa ombi kutokana na mahitaji yao ya kuhamia.',
      },
      {
        n: '02',
        title: 'Kilinganishi cha AI',
        body: 'Mwl. Mwikila hupanga bidhaa zilizothibitishwa dhidi ya ombi — vyumba vya kulala, shule, usalama, safari ya kazini, bajeti — kwa sekunde chache.',
      },
      {
        n: '03',
        title: 'Fuatilia kamisheni',
        body: 'Upangaji unapokamilika, kamisheni huingizwa kwenye leja moja yenye muhtasari uliotiwa saini — hakuna tena kufuatilia wenye nyumba kupata uthibitisho.',
      },
    ],
    problemKicker: 'Mzigo wa kampuni',
    problemHeading: 'Bidhaa kuyumba, kufuatilia kamisheni,',
    problemHeadingAccent: 'na hakuna jukwaa',
    problemSub:
      'Kampuni nyingi huendeshwa kwa makundi ya WhatsApp, lahajedwali zilizohuishwa nusu, na uaminifu. Zile nzuri hufanikisha mmoja kati ya ishirini; zile bora hufanikisha mmoja kati ya kumi. BossNyumba inakupandisha hadi mmoja kati ya watatu.',
    problemTitle: 'Bila BossNyumba',
    problems: [
      {
        title: 'Bidhaa kuyumba',
        desc: 'Nusu ya vitengo vilivyo kwenye lahajedwali yako havipatikani kihalisia.',
      },
      {
        title: 'Kusubiri kamisheni',
        desc: 'Ulifunga mkataba mwezi Machi; kamisheni inafika mwezi Julai.',
      },
      {
        title: 'Hakuna pendekezo la kampuni',
        desc: 'Benki zinataka PDF ya kiwango cha juu; wewe unatuma ujumbe wa WhatsApp wenye picha.',
      },
      {
        title: 'Ukaguzi wa marejeo kwa mikono',
        desc: 'Unatumia masaa kupiga simu kwa waajiri kuthibitisha kile ambacho BossNyumba inaweza kuthibitisha kwa sekunde chache.',
      },
    ],
    solutionTitle: 'Na BossNyumba',
    solutions: [
      {
        title: 'Mtiririko wa bidhaa hai',
        desc: 'Wenye nyumba huhuisha Mwl. Mwikila; wewe unaona ukweli wakati halisi.',
      },
      {
        title: 'Kamisheni kwenye leja moja',
        desc: 'Kila upangaji na kila kamisheni huingizwa kwenye leja ya kuingia mara mbili yenye muhtasari uliotiwa saini — hakuna tena kusubiri ankara.',
      },
      {
        title: 'Kitengenezi cha mapendekezo ya kampuni',
        desc: 'PDF + ziara ya kimtandao + rasimu ya mkataba kwa kila mteja mtarajiwa, kwa dakika mbili.',
      },
      {
        title: 'Mzunguko wa marejeo uliothibitishwa',
        desc: 'Uthibitisho wa NIDA, mwajiri, na mwenye nyumba wa awali kwenye wasifu wa mwombaji — simu chache zaidi.',
      },
    ],
    ctaHeading: 'Kuwa kampuni mshirika wa BossNyumba.',
    ctaSub:
      'Panga simu ya ushirikiano ya dakika 20. Tutakupitisha kwenye dashibodi ya kampuni na mtiririko wa kamisheni.',
    ctaPrimary: 'Panga simu ya ushirikiano',
  },

  housingCooperative: {
    heroKicker: 'Kwa vyama vya ushirika wa nyumba',
    heroHeadline: 'Endesha ushirika wako',
    heroHeadlineAccent: 'kwa uwazi',
    heroSub:
      'BossNyumba humpa kila mwanachama wa ushirika mwonekano wa wakati halisi wa ada zilizolipwa, mpango wa matengenezo ya jengo, kalenda ya mkutano mkuu wa mwaka (AGM), na salio la benki ya ushirika. Mwl. Mwikila hushughulikia ukusanyaji wa ada, mgawanyo kwa wanachama, na uhasibu ambao msajili anauhitaji.',
    heroPrimaryCta: 'Omba kiwango cha ushirika',
    heroSecondaryCta: 'Inavyofanya kazi',
    trustline: [
      'Punguzo la 30% kwenye viwango vyote',
      'Muhtasari tayari kwa AGM',
      'Leja ya ada inayoonekana kwa wanachama',
    ],
    statsHeading: 'Vyama vya ushirika vinahitaji uwazi. Mwl. Mwikila anauleta.',
    statsSub:
      'BossNyumba huweka modeli ya utawala wa ushirika ndani ya bidhaa ili ada, maamuzi, na migogoro viwe na chanzo kimoja cha ukweli.',
    stats: [
      {
        value: '30%',
        label: 'Punguzo',
        sub: 'Kwenye kila kiwango kwa vyama vya ushirika vilivyosajiliwa.',
      },
      {
        value: 'Mguso 1',
        label: 'Muhtasari wa AGM',
        sub: 'Tayari kwa msajili, tayari kwa wanachama, tayari kwa mhasibu.',
      },
      {
        value: 'Hai',
        label: 'Leja ya ada',
        sub: 'Kila mwanachama anaona aliyelipa, anayedaiwa, na salio la ushirika — limetatuliwa kwa kila mwanachama.',
      },
    ],
    stepsKicker: 'Inavyofanya kazi',
    stepsHeading: 'Kutoka usajili hadi AGM, vyote mahali pamoja.',
    steps: [
      {
        n: '01',
        title: 'Sajili ushirika',
        body: 'Pakia cheti cha ushirika. BossNyumba huunda orodha ya wanachama, ratiba ya ada, na kanuni za utawala.',
      },
      {
        n: '02',
        title: 'Ada + uwazi',
        body: 'Wanachama hulipa ada za kila mwezi kupitia M-Pesa. Kila mwanachama anaona aliyelipa, anayedaiwa, na ushirika ulichotumia.',
      },
      {
        n: '03',
        title: 'AGM + uwasilishaji',
        body: 'Panga AGM ndani ya programu. Wanachama wanaona muhtasari uliokaguliwa. Mwl. Mwikila huunda pack tayari kwa msajili kwa mguso mmoja ili uwasilishe.',
      },
    ],
    problemKicker: 'Mtego wa ushirika',
    problemHeading: 'Migogoro, kumbukumbu zinazokosekana,',
    problemHeadingAccent: 'na uaminifu uliopotea',
    problemSub:
      'Vyama vya ushirika hushindwa pale uwazi unaposhindwa. Mwl. Mwikila husimamisha uwazi kwa chaguo-msingi — kila mwanachama anaona namba zile zile.',
    problemTitle: 'Bila BossNyumba',
    problems: [
      {
        title: 'Utovu wa uwazi wa ada',
        desc: 'Wanachama wanauliza "nani amelipa?" — hakuna anayeweza kutoa leja safi.',
      },
      {
        title: 'Migogoro ya wauzaji',
        desc: 'Ushirika ulilipa TZS 4M kwa muuzaji; kazi imefanyika nusu; hakuna mkataba, hakuna escrow.',
      },
      {
        title: 'Kupotea kwa kumbukumbu za AGM',
        desc: 'Hoja za mwaka jana zinatoweka; mwenyekiti anabadilika; kumbukumbu ya taasisi inakufa.',
      },
      {
        title: 'Msuguano na msajili',
        desc: 'Uwasilishaji wa mwaka unageuka kuwa zoezi la uhasibu la miezi kadhaa.',
      },
    ],
    solutionTitle: 'Na BossNyumba',
    solutions: [
      {
        title: 'Leja hai ya ada',
        desc: 'Kila mwanachama anaona aliyelipa, anayedaiwa, na salio la benki ya ushirika.',
      },
      {
        title: 'Mgawanyo kwa wanachama',
        desc: 'Ada na migawanyo hugawanywa kwa kila mwanachama kupitia leja ya kuingia mara mbili — kila senti inafuatilika.',
      },
      {
        title: 'Kumbukumbu tayari kwa AGM',
        desc: 'Kumbukumbu, mahudhurio, na muhtasari uliokaguliwa — vyote vyenye hash-chain na vinavyoonekana kwa wanachama.',
      },
      {
        title: 'Pack tayari kwa msajili',
        desc: 'Muhtasari wa mwisho wa mwaka na kumbukumbu vimeunganishwa kuwa pack tayari kwa msajili kwa mguso mmoja, ili uwasilishe.',
      },
    ],
    ctaHeading: 'Omba kiwango cha ushirika.',
    ctaSub:
      'Vyama vya ushirika wa nyumba vilivyosajiliwa hupata punguzo la 30% kwenye kila kiwango. Tuma barua pepe kwa community@bossnyumba.com kutoka kwa domain yako iliyosajiliwa.',
    ctaPrimary: 'Omba',
  },

  realEstateInvestor: {
    heroKicker: 'Kwa wawekezaji wa mali',
    heroHeadline: 'Ona mavuno kabla',
    heroHeadlineAccent: 'hujanunua',
    heroSub:
      'BossNyumba huchanganua hatimiliki, mipango ya matumizi ya ardhi, mauzo yanayolingana, rejista za kodi za sasa, na historia ya ushuru wa halmashauri ili kukupa kila mali unayoitarajia 5-yr IRR yenye uhakika wa conformal. Kisha huiendesha kwa niaba yako baada ya kununua.',
    heroPrimaryCta: 'Weka miadi ya onyesho la mwekezaji',
    heroSecondaryCta: 'Ona kibanda cha mpango',
    trustline: [
      'Utabiri wa IRR wa conformal',
      'Hatimiliki na mipango ya ardhi vilivyokaguliwa',
      'Mwendeshaji baada ya kufunga mauzo',
    ],
    statsHeading: 'Kutoka orodha fupi hadi uendeshaji, jukwaa moja.',
    statsSub:
      'Wawekezaji wengi hujikongoja na lahajedwali, wakala, mwanasheria, na meneja wa mali. Mwl. Mwikila huviunganisha vyote hivyo kuwa kibanda kimoja.',
    stats: [
      {
        value: '5-yr IRR',
        label: 'Utabiri wa conformal',
        sub: 'Yenye ukanda wa uhakika wa 80% / 90% / 95%, kwa kila mali — uliokalibriwa, sio kisio la nukta moja.',
      },
      {
        value: 'Moja',
        label: 'Pack ya uchunguzi',
        sub: 'Mnyororo wa hatimiliki, mipango ya ardhi, hali, mauzo yanayolingana, rejista za kodi, historia ya ushuru — PDF moja.',
      },
      {
        value: 'Mguso 1',
        label: 'Kuingia hali ya uendeshaji',
        sub: 'Hamia kutoka uchunguzi wa kina hadi uendeshaji ndani ya programu.',
      },
    ],
    stepsKicker: 'Inavyofanya kazi',
    stepsHeading: 'Orodha fupi. Uchunguzi. Funga mauzo. Endesha.',
    steps: [
      {
        n: '01',
        title: 'Orodha fupi',
        body: 'Weka URL, picha, au nambari ya rejista ya mali. Mwl. Mwikila huandaa muhtasari wa mpango ndani ya sekunde 60.',
      },
      {
        n: '02',
        title: 'Uchunguzi',
        body: 'Mnyororo wa hatimiliki, mipango ya ardhi, hali ya jengo, mauzo yanayolingana, rejista za kodi, historia ya ushuru — PDF moja.',
      },
      {
        n: '03',
        title: 'Endesha',
        body: 'Wakati wa kufunga mauzo, Mwl. Mwikila huingiza orodha ya wapangaji na kuanza kukusanya kodi kupitia M-Pesa kwa idhini ya mpangaji ya mguso mmoja — ikiingizwa kwenye leja ya kuingia mara mbili.',
      },
    ],
    problemKicker: 'Ushuru wa uchunguzi',
    problemHeading: 'Data mbovu, ushuru uliofichwa,',
    problemHeadingAccent: 'na kuhama kwa mwendeshaji',
    problemSub:
      'Hasara nyingi za mali zinaweza kutabirika. Data ipo; ila inaishi katika sehemu kumi na tano zisizounganishwa. Mwl. Mwikila huzisoma zote kumi na tano.',
    problemTitle: 'Bila BossNyumba',
    problems: [
      {
        title: 'Mshtuko wa hatimiliki',
        desc: 'Unagundua kifungu chenye mgogoro miezi minne baada ya kufunga mauzo.',
      },
      {
        title: 'Ushuru uliofichwa',
        desc: 'Halmashauri ina bili ya madeni ya TZS 28M ambayo haikuonekana kwenye wasilisho la wakala.',
      },
      {
        title: 'Rejista za kodi za matumaini',
        desc: 'Rejista ya kodi ya muuzaji imepitwa na miaka miwili na inadhani upangaji wa 100%.',
      },
      {
        title: 'Kuhama kwa mwendeshaji',
        desc: 'Meneja wa mali uliyemrithi anafanya chini ya soko kwa 15% na huoni kwa mwaka mzima.',
      },
    ],
    solutionTitle: 'Na BossNyumba',
    solutions: [
      {
        title: 'Ukaguzi wa mnyororo wa hatimiliki',
        desc: 'Kila uhamishaji hadi rejista, ukiwekewa alama kwa migogoro na haki za njia.',
      },
      {
        title: 'Ukaguzi wa ushuru',
        desc: 'Kila halmashauri, kila ushuru, kila siku ya madeni — vinaibuliwa kabla ya kufunga mauzo.',
      },
      {
        title: 'Rejista za kodi za conformal',
        desc: 'Kodi halisi iliyokusanywa miezi 12 iliyopita + upangaji + uondokaji, vyote vyenye hash-chain.',
      },
      {
        title: 'Ulinganishaji wa mwendeshaji',
        desc: 'Mwl. Mwikila hulinganisha kundi lako la mali na wenzako bila utambulisho kila mwezi.',
      },
    ],
    ctaHeading: 'Uchunguzi kwa siku, sio miezi.',
    ctaSub:
      'Weka miadi ya onyesho la mwekezaji la dakika 30. Lete anwani ya mali unayoitarajia; tutaendesha uchunguzi kamili moja kwa moja.',
    ctaPrimary: 'Weka miadi ya onyesho la mwekezaji',
  },

  familyOffice: {
    heroKicker: 'Kwa ofisi za familia',
    heroHeadline: 'Tendea mali kama',
    heroHeadlineAccent: 'aina ya rasilimali ilivyo',
    heroSub:
      'Uandishi wa ripoti wa kiwango cha ofisi ya familia kwenye kundi la mali ya nyumba: leja ya kuingia mara mbili isiyobadilika, muhtasari wa mwenye nyumba wa kila mwezi, hamishi za utii tayari kwa ukaguzi, na takwimu za kundi la mali — pamoja na mshauri mmoja Mwl. Mwikila kwenye kila mali na kila sarafu.',
    heroPrimaryCta: 'Panga onyesho la ofisi ya familia',
    heroSecondaryCta: 'Ona uandishi wa ripoti',
    trustline: [
      'Leja tayari kwa ukaguzi',
      'Muhtasari wa mwenye nyumba wa kila mwezi',
      'Takwimu za kundi la mali',
    ],
    statsHeading: 'Imejengwa kwa mwenye mali wa muda mrefu.',
    statsSub:
      'Wateja wa ofisi za familia huendesha BossNyumba kwenye makundi makubwa ya mali yanayoenea kwenye kampuni nyingi za umiliki, dhamana, na mamlaka mbalimbali. Mwl. Mwikila huweka kila mali kwenye leja moja iliyo tayari kwa ukaguzi.',
    stats: [
      {
        value: 'Isiyobadilika',
        label: 'Leja ya kuingia mara mbili',
        sub: 'Kila risiti na malipo huandikwa, husawazishwa, na ni ya kuongeza tu — namba ile ile pande zote mbili.',
      },
      {
        value: 'Kila mwezi',
        label: 'Muhtasari wa mwenye nyumba',
        sub: 'Hutengenezwa na kuwasilishwa kwa ratiba, unaweza kuhamishwa kwa sarafu yoyote.',
      },
      {
        value: 'Hamisha',
        label: 'Tayari kwa ukaguzi',
        sub: 'Hamishi za utii yenye hash-chain ambazo mkaguzi wako wa nje anaweza kuthibitisha bila mtandao.',
      },
    ],
    stepsKicker: 'Inavyofanya kazi',
    stepsHeading: 'Leta mali. Mwl. Mwikila anatunza vitabu.',
    steps: [
      {
        n: '01',
        title: 'Chora ramani ya mali',
        body: 'Ongeza mali zote kwenye kampuni zako za umiliki na dhamana. Mwl. Mwikila huzipanga chini ya mwonekano mmoja wa mwenye nyumba.',
      },
      {
        n: '02',
        title: 'Unganisha mtiririko wa kodi',
        body: 'Kusanya kodi kupitia M-Pesa kwa idhini ya mpangaji ya mguso mmoja; kila malipo huandikwa kwenye leja ya kuingia mara mbili.',
      },
      {
        n: '03',
        title: 'Uandishi wa ripoti wa ratiba',
        body: 'Muhtasari wa mwenye nyumba wa kila mwezi na takwimu za kundi la mali — ujazaji, mapato, gharama — pamoja na hamishi tayari kwa ukaguzi pale unapozihitaji.',
      },
    ],
    problemKicker: 'Tatizo la mmiliki mkuu',
    problemHeading: 'Wahasibu watatu, mmiliki mkuu mmoja,',
    problemHeadingAccent: 'seti tatu za vitabu',
    problemSub:
      'Ofisi za familia hutegemea watu wanaoshikilia vitabu vichwani mwao. Mwl. Mwikila huweka kila mali kwenye leja moja iliyo tayari kwa ukaguzi ili mmiliki mkuu daima aone namba zile zile.',
    problemTitle: 'Bila BossNyumba',
    problems: [
      {
        title: 'Seti tatu za vitabu',
        desc: 'Wahasibu watatu, mizunguko mitatu ya usawazishaji. Hakuna unaolingana, na hakuna unaonusurika kabidhiano.',
      },
      {
        title: 'Ucheleweshaji wa muhtasari',
        desc: 'Muhtasari wa mwenye nyumba hufika kwa kuchelewa na bila uthabiti, hivyo mmiliki mkuu hufanya maamuzi kwa picha iliyopitwa na wakati.',
      },
      {
        title: 'Migogoro ya risiti',
        desc: 'Kodi iliyolipwa kupitia pesa ya simu haina kumbukumbu ya pamoja; malipo hupingwa miezi kadhaa baadaye.',
      },
      {
        title: 'Vurugu za ukaguzi',
        desc: 'Ukaguzi wa nje hugeuka kuwa uchimbaji wa kiakiolojia wa wiki kadhaa kwa sababu hakuna chenye hash-chain.',
      },
    ],
    solutionTitle: 'Na BossNyumba',
    solutions: [
      {
        title: 'Leja moja ya mwenye nyumba',
        desc: 'Kila risiti ya kodi na malipo huandikwa kwenye leja moja isiyobadilika ya kuingia mara mbili kwenye kila mali — namba ile ile pande zote mbili.',
      },
      {
        title: 'Muhtasari wa ratiba',
        desc: 'Muhtasari wa mwenye nyumba wa kila mwezi hutengenezwa na kuwasilishwa kiotomatiki, unaweza kuhamishwa kwa sarafu yoyote kwa ajili ya mkutano wa familia.',
      },
      {
        title: 'Takwimu za kundi la mali',
        desc: 'Takwimu za ujazaji, mapato, na gharama kwenye kundi zima la mali — ili mmiliki mkuu daima aone picha ile ile.',
      },
      {
        title: 'Hamishi tayari kwa ukaguzi',
        desc: 'Hamishi za utii yenye hash-chain, za kuongeza tu, ambazo mkaguzi wako wa nje anaweza kuthibitisha bila mtandao.',
      },
    ],
    ctaHeading: 'Mali moja. Mshauri mmoja. Leja moja.',
    ctaSub:
      'Panga onyesho la ofisi ya familia la dakika 45. Tutaanzisha leja, muhtasari, na takwimu kwenye sampuli ya kundi lako la mali.',
    ctaPrimary: 'Panga onyesho',
  },

  bank: {
    heroKicker: 'Kwa benki + ufadhili wa mali',
    heroHeadline: 'Toa mikopo kwa mtiririko wa fedha wa mali',
    heroHeadlineAccent: 'unaoweza kuuthibitisha',
    heroSub:
      'BossNyumba hugeuza mtiririko wa fedha wa mali uliothibitishwa na wenye hash-chain kuwa alama ya mkopo iliyokokotolewa, ili benki ziweze kutoa mikopo ya nyumba, mikopo ya daraja, na ufadhili wa ununuzi kwa ujasiri — hata kwa wenye nyumba wadogo ambao hawajawahi kuwa na vitabu vinavyokubalika benki.',
    heroPrimaryCta: 'Weka miadi ya onyesho la mkopo',
    heroSecondaryCta: 'Ona alama ya mkopo',
    trustline: [
      'Mtiririko wa fedha wenye hash-chain',
      'Alama ya mkopo iliyokokotolewa',
      'Mlisho wa API kwa idhini upo kwenye ramani',
    ],
    statsHeading: 'Mfikishie benki mwenye nyumba asiyefikiwa na huduma za benki.',
    statsSub:
      'Wenye nyumba wengi wa Kitanzania wana mali zinazoweza kupangishwa lakini hawana vitabu vinavyokubalika benki. Mnyororo wa ukaguzi wa BossNyumba hugeuza risiti kuwa mtiririko wa fedha unaoweza kutolewa mkopo.',
    stats: [
      {
        value: 'Miezi 12',
        label: 'Historia ya mtiririko wa fedha',
        sub: 'Kwa kila mwenye nyumba, yenye hash-chain, inayoweza kuhamishwa kwenye mfumo wako wa mkopo kama wasilisho la utii.',
      },
      {
        value: 'Alama',
        label: 'Kiwango cha mkopo',
        sub: 'Alama ya mkopo iliyokokotolewa yenye modeli ya alama, ukokotoaji upya uliopangwa, na cheti kinachoweza kuthibitishwa.',
      },
      {
        value: 'Ramani',
        label: 'Mlisho wa API kwa idhini',
        sub: 'API ya kusoma tu inayoingia kwenye data ya mtiririko wa fedha iliyoidhinishwa na mwenye nyumba ipo kwenye ramani.',
      },
    ],
    stepsKicker: 'Inavyofanya kazi',
    stepsHeading: 'Hamisha. Pima. Kopesha. Kagua.',
    steps: [
      {
        n: '01',
        title: 'Mwenye nyumba anashiriki',
        body: 'Mteja wako anahamisha historia yake ya mtiririko wa fedha yenye hash-chain kama wasilisho la utii unaloweza kulithibitisha bila mtandao. (Mlisho wa moja kwa moja wa API kwa idhini upo kwenye ramani.)',
      },
      {
        n: '02',
        title: 'Pima',
        body: 'Ukusanyaji wa kodi wa miezi 12, ukaaji, na utii wa ushuru huunganishwa kuwa alama ya mkopo iliyokokotolewa yenye cheti kinachoweza kuthibitishwa.',
      },
      {
        n: '03',
        title: 'Kopesha + kagua',
        body: 'Toa fedha kupitia njia zako zilizopo. Vuta ripoti ya kufadhili upya inayopatikana papo hapo yenye majaribio ya msukumo ya LTV/DSCR wakati wa ukaguzi.',
      },
    ],
    problemKicker: 'Pengo la mkopo',
    problemHeading: 'Wenye nyumba wanaostahili mkopo wenye',
    problemHeadingAccent: 'vitabu visivyokubalika benki',
    problemSub:
      'Unajua kuna wenye nyumba wazuri katika mtandao wa matawi yako. Ila huwezi kuwapatia mkopo — hakuna muhtasari, hakuna orodha za kodi zilizokaguliwa, hakuna ukaaji uliothibitishwa.',
    problemTitle: 'Bila BossNyumba',
    problems: [
      {
        title: 'Orodha za kodi za WhatsApp',
        desc: 'Mwombaji analeta picha ya skrini ya WhatsApp. Unakataa.',
      },
      {
        title: 'Dhamana ya hati pekee',
        desc: 'Unaweza kukopesha dhidi ya hati, lakini si dhidi ya mtiririko wa fedha. LTV yako inabaki ya tahadhari.',
      },
      {
        title: 'Upofu baada ya kutoa fedha',
        desc: 'Mara fedha zinapotolewa, huna mwonekano wa DSCR hadi mkopaji ashindwe kulipa.',
      },
      {
        title: 'Ukaguzi wa kundi la mali kwa mikono',
        desc: 'Ukaguzi wa kila mwaka ni zoezi la simu; kushindwa kulipa kunakukuta umechelewa.',
      },
    ],
    solutionTitle: 'Na BossNyumba',
    solutions: [
      {
        title: 'Mtiririko wa fedha uliothibitishwa',
        desc: 'Historia ya miezi 12 ya kodi + matengenezo + ushuru yenye hash-chain kwa kila mwenye nyumba, inayoweza kuhamishwa kwenye mfumo wako wa mkopo.',
      },
      {
        title: 'Alama ya mkopo iliyokokotolewa',
        desc: 'Modeli ya alama hugeuza mavuno ya kodi kuwa alama ya mkopo yenye cheti kinachoweza kuthibitishwa — panga bei kwa hatari unayoweza kuiona kweli.',
      },
      {
        title: 'Jaribio la msukumo papo hapo',
        desc: 'Vuta ripoti ya kufadhili upya yenye majaribio ya msukumo ya LTV/DSCR wakati wa kutoa mkopo na ukaguzi — papo hapo, si mara moja kwa mwaka.',
      },
      {
        title: 'Takwimu za kundi la mali',
        desc: 'Vipimo vya afya kwa kila eneo katika vitabu vilivyoidhinishwa; takwimu, si simu za kumbukumbu ya mwaka.',
      },
    ],
    ctaHeading: 'Kopesha kwa wenye nyumba uliokuwa ukiwatamani siku zote.',
    ctaSub:
      'Weka miadi ya onyesho la mkopo la dakika 30. Tutapitia alama ya mkopo, historia ya mtiririko wa fedha inayoweza kuhamishwa, na modeli ya utoaji mkopo.',
    ctaPrimary: 'Weka miadi ya onyesho la mkopo',
  },

  regulator: {
    heroKicker: 'Kwa wadhibiti wa nyumba',
    heroHeadline: 'Ona soko la upangaji',
    heroHeadlineAccent: 'jinsi lilivyo hasa',
    heroSub:
      'BossNyumba humpa mdhibiti wa nyumba mtazamo hai, usio na utambulisho wa soko la upangaji: idadi ya mikataba, wastani wa kodi kwa wilaya, kiasi cha migogoro ya amana, malalamiko ya wapangaji, na utii wa ushuru wa halmashauri — vyote kwa hiari ya mwenye nyumba na kwa mipaka ya kikatiba.',
    heroPrimaryCta: 'Weka tarehe ya onyesho la mdhibiti',
    heroSecondaryCta: 'Ona dashibodi',
    trustline: [
      'Yenye mipaka ya kikatiba',
      'Idhini ya mpangaji kwanza',
      'Hai + inayoweza kukaguliwa',
    ],
    statsHeading: 'Sera ya nyumba inayotegemea ushahidi.',
    statsSub:
      'Wadhibiti huandaa sera kwa kutegemea tafiti za mwaka. BossNyumba huibua viashiria vilevile vya soko kila siku — bila kamwe kufichua data ya mtu mmoja.',
    stats: [
      {
        value: 'Hai',
        label: 'Kiashiria cha soko',
        sub: 'Idadi ya mikataba, wastani wa kodi kwa wilaya, kiasi cha migogoro — vinasasishwa kila siku.',
      },
      {
        value: 'Bila utambulisho',
        label: 'Faragha tofautishi',
        sub: 'Hakuna mwenye nyumba au mpangaji yeyote anayeweza kutambulika kutoka kwenye dashibodi.',
      },
      {
        value: 'Imekaguliwa',
        label: 'Yenye hash-chain',
        sub: 'Kila uhamishaji hubeba uthibitisho wa asili wa kriptografia.',
      },
    ],
    stepsKicker: 'Inavyofanya kazi',
    stepsHeading: 'Kusanya. Ondoa utambulisho. Kagua. Shiriki.',
    steps: [
      {
        n: '01',
        title: 'Kusanya',
        body: 'BossNyumba hukusanya data ya mikataba, kodi, migogoro, na utii kutoka kwa wenye nyumba walioidhinisha.',
      },
      {
        n: '02',
        title: 'Ondoa utambulisho',
        body: 'Vizingiti vya faragha tofautishi huzuia utambuzi upya katika ngazi ya wilaya au jengo.',
      },
      {
        n: '03',
        title: 'Shiriki',
        body: 'Dashibodi ya mdhibiti + pack ya ushahidi ya kila mwezi + sehemu ya kuuliza maswali ya papo kwa papo, vyote vyenye hash-chain.',
      },
    ],
    problemKicker: 'Pengo la sera',
    problemHeading: 'Tafiti za mwaka, malalamiko ya papo kwa papo,',
    problemHeadingAccent: 'hakuna kiashiria hai',
    problemSub:
      'Wadhibiti wa nyumba huunda mipaka ya kodi na sheria za ulinzi wa wapangaji kwa kutegemea data iliyopitwa na wakati. Mwl. Mwikila huleta kiashiria cha soko kwenye muhtasari wa asubuhi wa mdhibiti.',
    problemTitle: 'Bila BossNyumba',
    problems: [
      {
        title: 'Tafiti zilizopitwa na wakati',
        desc: 'Utafiti wa nyumba wa NBS wa mwaka uliopita ndio unaongoza sera ya halmashauri ya mwaka huu.',
      },
      {
        title: 'Malalamiko ya hadithi',
        desc: 'Chama cha wapangaji kinatuma barua; hujui kama kinawakilisha wengi kiasi gani.',
      },
      {
        title: 'Mgawanyiko wa halmashauri',
        desc: 'Halmashauri 184, miundo 184 tofauti ya usajili wa mikataba. Hakuna mtazamo wa pamoja.',
      },
      {
        title: 'Hakuna onyo la mapema',
        desc: 'Ongezeko la kufukuzwa kwa wapangaji huonekana tu kwenye mzunguko wa habari, sio kwenye dashibodi.',
      },
    ],
    solutionTitle: 'Na BossNyumba',
    solutions: [
      {
        title: 'Kiashiria cha soko cha kila siku',
        desc: 'Wastani wa kodi kwa wilaya, mzunguko wa mikataba, ujazo — vinasasishwa kila usiku.',
      },
      {
        title: 'Ramani ya joto ya migogoro',
        desc: 'Wapangaji na wenye nyumba wanagombana hasa wapi? Pata jibu kila mwezi.',
      },
      {
        title: 'Ushirikiano kati ya halmashauri',
        desc: 'Data thabiti ya mikataba + ushuru katika halmashauri zote zinazoshiriki.',
      },
      {
        title: 'Onyo la mapema la kufukuzwa',
        desc: 'Maombi ya kufukuza yanayoongezeka yanaonekana siku 60-90 kabla ya mzunguko wa habari.',
      },
    ],
    ctaHeading: 'Toa sera kutoka kwenye kioo cha nyuma.',
    ctaSub: 'Weka tarehe ya onyesho la mdhibiti la dakika 30 na kiongozi wetu wa sekta ya umma.',
    ctaPrimary: 'Weka tarehe ya onyesho la mdhibiti',
  },

  communityHousing: {
    heroKicker: 'Kwa makazi ya jamii',
    heroHeadline: 'Makazi kwa watu',
    heroHeadlineAccent: 'wanaojenga mji',
    heroSub:
      'BossNyumba huendesha makazi ya ushirika, dhamana za ardhi za jamii, na ushirikiano wa makazi ya wafanyakazi kwa mashirika yasiyo ya kiserikali, miji ya viwanda, na vyuo vikuu. Mwl. Mwikila huendesha leja ya michango na ugawaji wa vitengo kwa wanachama, na huandaa kumbukumbu zilizo tayari kwa mkutano mkuu wa mwaka (AGM).',
    heroPrimaryCta: 'Omba kiwango cha jamii',
    heroSecondaryCta: 'Tazama mfumo',
    trustline: [
      'Punguzo la asilimia 30 kwa jamii',
      'Uwazi wa ugawaji',
      'Utawala unaowaweka wanachama mbele',
    ],
    statsHeading: 'Makazi ya jamii ambayo jamii inayaamini.',
    statsSub:
      'Makazi mengi ya jamii hushindwa kwa sababu vitabu vya hesabu havieleweki na ugawaji unafuata siasa. Mwl. Mwikila husimamia michango ya wazi, ugawaji wa haki, na kumbukumbu zilizo tayari kwa mkutano mkuu wa mwaka (AGM).',
    stats: [
      {
        value: '30%',
        label: 'Punguzo kwa jamii',
        sub: 'Kwa kila kiwango kwa mipango ya makazi ya jamii iliyosajiliwa.',
      },
      {
        value: 'Hadharani',
        label: 'Leja ya michango',
        sub: 'Kila mwanachama huona kila malipo.',
      },
      {
        value: 'Haki',
        label: 'Bahati nasibu ya ugawaji',
        sub: 'Yenye hash-chain, tayari kwa ukaguzi, isiyoshindikana kwa migogoro.',
      },
    ],
    stepsKicker: 'Inavyofanya kazi',
    stepsHeading: 'Hatua tatu hadi mfumo wa makazi ya jamii.',
    steps: [
      {
        n: '01',
        title: 'Sajili mpango',
        body: 'Pakia cheti cha mpango. BossNyumba huunda orodha ya wanachama, ratiba ya michango, na sheria za ugawaji.',
      },
      {
        n: '02',
        title: 'Michango na ugawaji',
        body: 'Wanachama hulipa michango; vitengo vilivyo wazi hugawanywa kwa uwazi na kuingizwa kupitia leja ya kuingia mara mbili. Kila hatua ina hash-chain.',
      },
      {
        n: '03',
        title: 'AGM na uwazi',
        body: 'Mkutano mkuu wa mwaka (AGM) ndani ya programu: muhtasari wa mkutano, mahudhurio, hesabu zilizokaguliwa — zote zinaonekana kwa wanachama na zina hash-chain.',
      },
    ],
    problemKicker: 'Pengo la jamii',
    problemHeading: 'Michango isiyoeleweka, ugawaji wa kisiasa,',
    problemHeadingAccent: 'uaminifu uliopotea',
    problemSub:
      'Makazi ya jamii hufa wakati uwazi unakufa. Mwl. Mwikila husimamia uwazi kwa chaguo-msingi ili mpango uendelee hata baada ya mabadiliko ya uongozi.',
    problemTitle: 'Bila BossNyumba',
    problems: [
      {
        title: 'Michango isiyoeleweka',
        desc: 'Wanachama hawajui ni nani aliyelipa, ni nani anadaiwa, au mpango ulitumia nini.',
      },
      {
        title: 'Ugawaji wa kisiasa',
        desc: 'Vitengo vilivyo wazi vinakwenda kwa rafiki wa mwenyekiti; wanachama hulalamika bila mafanikio.',
      },
      {
        title: 'Kusahaulika kwa AGM',
        desc: 'Maazimio ya mwaka jana hupotea; mwenyekiti wa mwaka huu hana kumbukumbu ya kitaasisi.',
      },
      {
        title: 'Kutokuaminiwa na wafadhili',
        desc: 'Mashirika yasiyo ya kiserikali na makampuni hupoteza imani; ufadhili hukauka.',
      },
    ],
    solutionTitle: 'Na BossNyumba',
    solutions: [
      {
        title: 'Leja ya michango ya hadharani',
        desc: 'Kila mwanachama, kila malipo, kila matumizi ya ushirika — yanaonekana kwa wanachama wote.',
      },
      {
        title: 'Ugawaji wenye uwazi',
        desc: 'Vitengo vilivyo wazi hugawanywa kwa sheria za wazi zinazoweza kukaguliwa na kuingizwa kupitia leja ya kuingia mara mbili — kila senti inafuatilika.',
      },
      {
        title: 'Kumbukumbu tayari kwa AGM',
        desc: 'Muhtasari wa mkutano, mahudhurio, na hesabu zilizokaguliwa — zenye hash-chain na zinazoonekana kwa wanachama.',
      },
      {
        title: 'Ripoti za wafadhili',
        desc: 'Mashirika yasiyo ya kiserikali na makampuni hupata pack ya athari ya kila robo mwaka, iliyotengenezwa kutoka data hai, tayari kwa ukaguzi.',
      },
    ],
    ctaHeading: 'Uaminifu, umejengwa ndani.',
    ctaSub:
      'Omba kiwango cha makazi ya jamii. Mipango iliyosajiliwa hupata punguzo la asilimia 30 kwa kila kiwango.',
    ctaPrimary: 'Omba',
  },

  corporatePortfolio: {
    heroKicker: 'Kwa makundi ya mali ya makampuni',
    heroHeadline: 'Mshirika wa kwanza duniani wa AI wa Usimamizi wa Mali',
    heroHeadlineAccent: 'kwa mali ya makampuni',
    heroSub:
      'Mwl. Mwikila ni msaidizi mkuu mtulivu kwa kampuni yoyote inayomiliki nyumba za wafanyakazi, ofisi za matawi, maghala, au maeneo ya biashara ya rejareja kama sehemu ya shughuli zake. Leja moja ya mikataba, upimaji na upatanishi wa huduma, takwimu za kundi la mali, na hamishaji za utii zilizo tayari kwa ukaguzi katika kila eneo.',
    heroPrimaryCta: 'Panga onyesho la kampuni',
    heroSecondaryCta: 'Ona ripoti',
    trustline: [
      'Leja ya kuingia mara mbili ya kiwango cha ukaguzi',
      'Upimaji wa huduma + upatanishi',
      'Takwimu za kundi la mali',
    ],
    statsHeading: 'Acha kuendesha kundi lako la mali kwa lahajedwali tatu.',
    statsSub:
      'Makundi ya mali ya makampuni hupoteza gharama zinazoweza kurejeshwa kutokana na kuteleza kwa mikataba, kupungua kwa ushuru, na huduma zisizotolewa risiti. Mwl. Mwikila huweka kila eneo kwenye leja moja na huonyesha upotevu kwenye takwimu, katika kila eneo na kila sarafu.',
    stats: [
      {
        value: 'Moja',
        label: 'Leja ya mikataba',
        sub: 'Kila mkataba, ushuru, na bili ya huduma huandikwa kwenye leja moja isiyobadilika ya kuingia mara mbili.',
      },
      {
        value: 'Yenye mita',
        label: 'Huduma',
        sub: 'Maji, umeme, gesi — akaunti, visomo, na bili hufuatiliwa na kupatanishwa kwa kila eneo.',
      },
      {
        value: 'Hamisha',
        label: 'Tayari kwa ukaguzi',
        sub: 'Hamishaji za utii zenye hash-chain hadi kwenye BI ya kampuni yako, kwa sarafu yoyote.',
      },
    ],
    stepsKicker: 'Inavyofanya kazi',
    stepsHeading: 'Leta kundi la mali. Weka sera. Mwl. Mwikila anahifadhi vitabu.',
    steps: [
      {
        n: '01',
        title: 'Chora kila eneo',
        body: 'Ongeza mikataba yako, ushuru, mikataba ya wauzaji, na akaunti za huduma. Mwl. Mwikila huzipanga chini ya mwonekano mmoja wa eneo kwa eneo.',
      },
      {
        n: '02',
        title: 'Weka sera + uhuru wa kujiamulia',
        body: 'Chagua kiasi gani Mwl. Mwikila anakuandalia kwa kila eneo — mikataba, ushuru, matengenezo — ndani ya matriki yako ya mamlaka ya kampuni; kila hatua inafika kwa idhini ya mguso mmoja.',
      },
      {
        n: '03',
        title: 'Pokea muhtasari wa kila siku',
        body: 'Kila asubuhi saa 06:00: orodha ya tofauti, kalenda ya ushuru, takwimu za kundi la mali, na maamuzi matatu ambayo CFO pekee anaweza kuyafanya.',
      },
    ],
    problemKicker: 'Gharama ya kampuni',
    problemHeading: 'Gharama ya mali huishi kwenye lahajedwali,',
    problemHeadingAccent: 'sio kwenye ERP yako',
    problemSub:
      'ERP nyingi za makampuni huona mali kama mstari wa gharama, sio kundi la mali. Matokeo ni upotevu usioonekana unaozidi kuongezeka robo baada ya robo.',
    problemTitle: 'Bila BossNyumba',
    problems: [
      {
        title: 'Kuteleza kwa mikataba',
        desc: 'Chaguo za kurefusha zinaisha kimya kimya. Ongezeko la kodi linakosa tarehe ya kielelezo. Gharama yako halisi ni kubwa kuliko timu yako ya fedha inavyofikiri.',
      },
      {
        title: 'Kupungua kwa ushuru',
        desc: 'Halmashauri, kodi ya mali, huduma — kila moja inafika kwenye kisanduku tofauti cha barua. Adhabu za ucheleweshaji zinazidi kuongezeka na hakuna anayewajibika.',
      },
      {
        title: 'Sanduku jeusi la huduma',
        desc: 'Huduma za matawi hutozwa kwa mita, hulipwa kwa fedha taslimu, na hupatanishwa na hakuna mtu. Upotevu ni wa kimuundo.',
      },
      {
        title: 'Hakuna mwonekano wa kundi la mali',
        desc: 'Hazina haiwezi kueleza tawi gani lina faida, gani ni mzigo, gani linavunja sawasawa.',
      },
    ],
    solutionTitle: 'Na BossNyumba',
    solutions: [
      {
        title: 'Mnara wa ulinzi wa mikataba',
        desc: 'Kila chaguo la kurefusha, kila ongezeko, kila kifungu cha kuvunja huonyeshwa siku 90 kabla ya tarehe ya kuanzishwa.',
      },
      {
        title: 'Dawati moja la ushuru',
        desc: 'Kila halmashauri, kila mamlaka ya kodi, kila huduma, kila mzunguko huonyeshwa mahali pamoja; Mwl. Mwikila huandaa kila wasilisho kwa idhini yako ya mguso mmoja.',
      },
      {
        title: 'Upatanishi wa huduma',
        desc: 'Visomo vya mita huingizwa, bili huthibitishwa, kasoro huonyeshwa — maji, umeme, na gesi hufuatiliwa na kupatanishwa kwa kila eneo.',
      },
      {
        title: 'Takwimu za kundi la mali',
        desc: 'Takwimu za ukaaji, mapato, na matumizi kwa kila tawi na kila eneo. Zinaweza kuhamishwa hadi kwenye BI ya kampuni yako kwa sarafu yoyote.',
      },
    ],
    ctaHeading: 'Endesha kundi la mali unalomiliki tayari.',
    ctaSub:
      'Panga onyesho la kampuni la dakika 30. Tutasimamisha leja, upatanishi wa huduma, na takwimu kwenye sampuli ya maeneo yako na kuonyesha upotevu usioweza kuuona kwa sasa.',
    ctaPrimary: 'Panga onyesho la kampuni',
  },

  governmentEntity: {
    heroKicker: 'Kwa taasisi za serikali na mashirika ya umma',
    heroHeadline: 'Mali ya umma,',
    heroHeadlineAccent: 'leja ya imani ya umma',
    heroSub:
      'Mwl. Mwikila huyapa mashirika ya umma, wizara, na taasisi za serikali za mikoa mfumo wa uendeshaji wenye uwazi na unaoweza kukaguliwa kwa mali zao. Kila ushuru unaokusanywa, kila mkataba unaorekodiwa, kila mzabuni anayelipwa hufika kwenye leja yenye hash-chain, inayoweza kuhamishwa kwa wadhibiti.',
    heroPrimaryCta: 'Panga onyesho la serikali',
    heroSecondaryCta: 'Ona leja ya umma',
    trustline: [
      'Yenye hash-chain, inayoweza kuhamishwa kwa ukaguzi',
      'Makazi huru ya data',
      'Tayari kwa mkaguzi kwa msingi',
    ],
    statsHeading: 'Mali ya umma inastahili zana za kiwango cha umma.',
    statsSub:
      'Mali za serikali hupoteza thamani kupitia leja zisizo wazi, mikataba iliyokwisha muda, na ushuru usiokusanywa. Mwl. Mwikila husakinisha uwazi ambao umma unautarajia bila gharama ya kisiasa ya ukaguzi wa mikono.',
    stats: [
      {
        value: '100%',
        label: 'Ufikiaji wa ukaguzi',
        sub: 'Kila tendo lenye hash-chain, la kuongezwa tu, linaloweza kuhamishwa kwa ofisi za Mdhibiti na Mkaguzi Mkuu wa Hesabu nje ya mtandao.',
      },
      {
        value: 'Kila siku',
        label: 'Leja ya umma',
        sub: 'Takwimu za muhtasari bila utambulisho kuhusu mapato, ukaaji, na malimbikizo zinapatikana kwa wananchi pale wanapohitaji.',
      },
      {
        value: 'Sifuri',
        label: 'Hatari ya makabidhiano ya mikono',
        sub: 'Mkurugenzi anapohama, kumbukumbu ya kitaasisi huhama na mfumo, sio na mtu.',
      },
    ],
    stepsKicker: 'Inavyofanya kazi',
    stepsHeading: 'Idhini. Ramani. Endesha.',
    steps: [
      {
        n: '01',
        title: 'Idhini',
        body: 'Katibu mkuu wako anasaini idhini ya imani ya umma. Mwl. Mwikila huendesha ndani ya mipaka ya idhini hiyo, kamwe si zaidi.',
      },
      {
        n: '02',
        title: 'Ramani ya kila mali',
        body: 'Leta kumbukumbu zako za sasa za mali. Linganisha mikataba, ushuru, madeni, na hali za migogoro kuwa grafu moja ya maarifa.',
      },
      {
        n: '03',
        title: 'Endesha na mnyororo wa ukaguzi',
        body: 'Kila ukusanyaji, kila ulipaji, kila uamuzi wenye hash-chain. Mdhibiti na Mkaguzi Mkuu wa Hesabu husoma mnyororo, sio kabati lako la mafaili.',
      },
    ],
    problemKicker: 'Gharama ya sekta ya umma',
    problemHeading: 'Leja zisizo wazi,',
    problemHeadingAccent: 'mapato yaliyopotea',
    problemSub:
      'Mali za serikali hubeba mzigo mkubwa zaidi kwenye mizania ya uchumi wowote na zana dhaifu zaidi. Mwl. Mwikila huziba pengo hilo bila gharama ya kisiasa.',
    problemTitle: 'Bila BossNyumba',
    problems: [
      {
        title: 'Mikataba ya serikali iliyokwisha muda',
        desc: 'Mikataba ya sekta ya umma hukwisha muda kwa sababu hakuna anayefuatilia tarehe za kurefusha mahali pamoja na ukusanyaji wa kodi.',
      },
      {
        title: 'Kodi ya ardhi isiyokusanywa',
        desc: 'Mafaili ya kodi ya ardhi yamekaa kwenye makabati. Ukusanyaji hufanyika hovyo. Wananchi hulipa kwa kutofautiana; hakuna anayefuatilia kwa uthabiti.',
      },
      {
        title: 'Rundo la matokeo ya ukaguzi',
        desc: 'Kila mzunguko, Mkaguzi Mkuu wa Hesabu hupata mapungufu yale yale. Marekebisho hayadumu kwa sababu hakuna mfumo wa wakati halisi.',
      },
      {
        title: 'Hatari ya kuhama kwa mkurugenzi',
        desc: 'Mkuu wa mali anapohama, kumbukumbu ya kitaasisi hutoka naye. Mrithi huanza kutoka sifuri.',
      },
    ],
    solutionTitle: 'Na BossNyumba',
    solutions: [
      {
        title: 'Mwongozaji otomatiki wa mikataba',
        desc: 'Chaguo za kurefusha, ongezeko, malipo ya kodi ya ardhi huletwa siku 90 mapema. Mwl. Mwikila huandaa pack ya kurefusha yenyewe.',
      },
      {
        title: 'Njia za malipo za wananchi',
        desc: 'Kodi ya ardhi inakusanywa kupitia M-Pesa, Tigo Pesa, Airtel Money, au benki. Risiti hutolewa kwa sekunde, yenye hash-chain kwenye leja ya umma.',
      },
      {
        title: 'Mnyororo wa ukaguzi kwa otomatiki',
        desc: 'Kila tendo la kuongezwa tu na lenye saini. Mkaguzi Mkuu wa Hesabu husoma mnyororo, sio kabati la mafaili.',
      },
      {
        title: 'Mwendelezo kupitia kuhama',
        desc: 'Kumbukumbu ya kitaasisi huishi ndani ya mfumo. Mrithi hufika siku ya kwanza na muhtasari kamili wa mali, tayari kutenda.',
      },
    ],
    ctaHeading: 'Endesha mali ya umma, hadharani.',
    ctaSub:
      'Panga muhtasari wa dakika 30 na kiongozi wetu wa sekta ya umma. Tutapitia mnyororo wa ukaguzi, njia za malipo za wananchi, na dashibodi ya leja ya umma.',
    ctaPrimary: 'Panga onyesho la serikali',
  },

  reit: {
    heroKicker: 'Kwa REIT na fedha za mali',
    heroHeadline: 'Mshirika wa kwanza duniani wa Usimamizi wa Mali kwa AI',
    heroHeadlineAccent: 'kwa mali ya kitaasisi',
    heroSub:
      'Mwl. Mwikila ni mfumo wa uendeshaji ambao Real Estate Investment Trusts (REIT) na fedha za mali za kitaasisi huendesha mali zao juu yake. Leja ya kuingia mara mbili isiyobadilika, mnyororo wa ukaguzi wa kiwango cha wanachama wa vitengo, takwimu za kundi la mali, mauzo ya utii tayari kwa ukaguzi, na Mkuu wa Wafanyakazi wa AI anayemueleza meneja wa fedha kila asubuhi.',
    heroPrimaryCta: 'Weka miadi ya onyesho la meneja wa fedha',
    heroSecondaryCta: 'Ona chumba cha uendeshaji cha fedha',
    trustline: [
      'Mnyororo wa ukaguzi wa kiwango cha wanachama wa vitengo',
      'Takwimu za kundi la mali',
      'Mauzo ya utii',
    ],
    statsHeading: 'Endesha fedha juu ya leja moja.',
    statsSub:
      'REIT na fedha za mali huendeshwa kwa mizunguko ya taarifa za robo mwaka inayoficha hatari za ndani ya robo. Mwl. Mwikila huweka kila mali kwenye leja moja isiyobadilika ili picha iwe ya sasa kila wakati, bila kuongeza hata mfanyakazi mmoja wa muda kamili.',
    stats: [
      {
        value: 'Isiyobadilika',
        label: 'Leja ya kuingia mara mbili',
        sub: 'Kila risiti ya kodi, malipo, na matumizi ya mtaji yameingizwa, yamesawazishwa, na ni ya kuongeza tu.',
      },
      {
        value: 'Takwimu',
        label: 'Kwa kanda',
        sub: 'Takwimu za ukaaji, mapato, na matumizi kwa kila kanda na chombo cha fedha, zinazoweza kuhamishwa kwa mtunza-mali wako.',
      },
      {
        value: 'Hamisha',
        label: 'Tayari kwa ukaguzi',
        sub: 'Mauzo ya utii yenye hash-chain, ya kuongeza tu, yanayowaridhisha wakaguzi wa nje na wanachama wa vitengo.',
      },
    ],
    stepsKicker: 'Inavyofanya kazi',
    stepsHeading: 'Leta fedha. Weka uhuru. Endesha vitabu.',
    steps: [
      {
        n: '01',
        title: 'Panga ramani ya fedha',
        body: 'Ongeza vyombo vyako vya fedha, fedha ndogo, na SPV. Mwl. Mwikila hupanga kila mali chini ya mwonekano mmoja wa fedha.',
      },
      {
        n: '02',
        title: 'Unganisha kila mali',
        body: 'Kusanya kodi kupitia M-Pesa kwa idhini ya mpangaji ya mguso mmoja; kila risiti, malipo, na ahadi ya matumizi ya mtaji huingia kwenye leja moja ya kuingia mara mbili.',
      },
      {
        n: '03',
        title: 'Muhtasari wa kila siku wa meneja wa fedha',
        body: 'Kila asubuhi: takwimu za kundi la mali, orodha ya kasoro, ripoti ya kufadhili upya inayopatikana papo hapo kwa vipimo vya mkazo wa masharti, na maamuzi matatu ambayo ni meneja wa fedha pekee anayeweza kuyafanya.',
      },
    ],
    problemKicker: 'Ushuru wa kitaasisi',
    problemHeading: 'Taarifa za robo mwaka huficha',
    problemHeadingAccent: 'hatari za ndani ya robo',
    problemSub:
      'REIT na fedha za mali nyingi huendeshwa kwa mzunguko wa taarifa wa siku 90. Hatari inayojengeka ndani ya mzunguko haionekani hadi inapokuwa tatizo la robo inayofuata.',
    problemTitle: 'Bila BossNyumba',
    problems: [
      {
        title: 'Vitabu vilivyopitwa na wakati',
        desc: 'Kufunga kwa robo mwaka kunamaanisha wanachama wa vitengo wanafanya biashara juu ya picha ya miezi mitatu iliyopita. Tofauti za bei za kununua na kuuza zinapanuka.',
      },
      {
        title: 'Upofu wa masharti',
        desc: 'DSCR huhesabiwa mara moja kwa robo. Kufikia wakati unavunja masharti, unavunja kwa miezi.',
      },
      {
        title: 'Mfululizo dhaifu wa ukaguzi',
        desc: 'Kila SPV hutoa taarifa peke yake, kwenye lahajedwali zisizoweza kustahimili makabidhiano au ukaguzi wa nje.',
      },
      {
        title: 'Ukungu wa mwenye nyumba',
        desc: 'Wapangaji hulipa kupitia njia na mizunguko tofauti. Usawazishaji ni zoezi la wiki nyingi.',
      },
    ],
    solutionTitle: 'Na BossNyumba',
    solutions: [
      {
        title: 'Leja moja isiyobadilika',
        desc: 'Kila mali, kila kitengo, kila chombo cha fedha kwenye leja moja ya kuingia mara mbili ya kuongeza tu, inayoweza kuhamishwa kwa mtunza-mali wako.',
      },
      {
        title: 'Kipimo cha masharti papo hapo',
        desc: 'Vuta ripoti ya kufadhili upya yenye vipimo vya mkazo vya DSCR, LTV, na ICR wakati wowote unapoihitaji — wakati wa ukaguzi, sio mara moja kwa robo.',
      },
      {
        title: 'Mauzo tayari kwa ukaguzi',
        desc: 'Kila fedha ndogo na SPV inaweza kuhamishwa kama pack ya utii yenye hash-chain, ya kuongeza tu, ikiwa na mnyororo wa ukaguzi umeambatanishwa.',
      },
      {
        title: 'Usawazishaji wa njia za mpangaji',
        desc: 'Risiti za M-Pesa na benki husawazishwa kuwa leja moja ya mpangaji kupitia mwito wa webhook — zimeingizwa, zimesawazishwa, zinaweza kufuatiliwa.',
      },
    ],
    ctaHeading: 'Fedha moja. Muhtasari mmoja. Leja moja.',
    ctaSub:
      'Weka miadi ya onyesho la meneja wa fedha la dakika 45. Tutasimamisha leja, takwimu, na mauzo tayari kwa ukaguzi juu ya sampuli ya kundi lako la mali.',
    ctaPrimary: 'Weka miadi ya onyesho la meneja wa fedha',
  },

  embassyNgo: {
    heroKicker: 'Kwa balozi na mashirika yasiyo ya kiserikali (NGO)',
    heroHeadline: 'Mali moja, kila',
    heroHeadlineAccent: 'mji mkuu',
    heroSub:
      'Mwl. Mwikila huendesha mali ya balozi, mashirika ya kimataifa yasiyo ya kiserikali (NGO), na mashirika ya wafadhili katika miji mikuu mingi. Leja ya kuingia mara mbili iliyo tayari kwa ukaguzi wa mfadhili, utii unaozingatia mamlaka, hamishaji tayari kwa ukaguzi, na mshauri mmoja katika kila makazi, ofisi, na kituo cha mbali.',
    heroPrimaryCta: 'Weka miadi ya onyesho la balozi',
    heroSecondaryCta: 'Ona dashibodi ya balozi',
    trustline: [
      'Leja iliyo tayari kwa ukaguzi wa mfadhili',
      'Utii kwa kila mamlaka',
      'Hamishaji tayari kwa ukaguzi',
    ],
    statsHeading: 'Imejengwa kwa balozi inayoenea miji mikuu mingi.',
    statsSub:
      'Balozi na mashirika ya kimataifa yasiyo ya kiserikali (NGO) huendesha mali katika mamlaka mingi kwa kutumia lahajedwali zilizorithiwa. Mwl. Mwikila huweka kila kituo kwenye leja moja iliyo tayari kwa ukaguzi bila kulazimisha sheria za nchi moja kwa nyingine.',
    stats: [
      {
        value: 'Leja moja',
        label: 'Kila kituo',
        sub: 'Leja moja ya kuingia mara mbili katika kila makazi, ofisi, na kituo, inayohamishika kwa sarafu yoyote.',
      },
      {
        value: 'Kiwango cha mfadhili',
        label: 'Mnyororo wa ukaguzi',
        sub: 'Kila malipo yenye hash-chain na tayari kwa mkaguzi wa nje wa mfadhili.',
      },
      {
        value: 'Kwa mamlaka',
        label: 'Utii',
        sub: 'Sheria ya mkataba ya eneo, mfumo wa kodi wa eneo, mambo ya kipekee ya huduma za eneo — yanashughulikiwa kwa kila kituo.',
      },
    ],
    stepsKicker: 'Inavyofanya kazi',
    stepsHeading: 'Ramani ya kila mji mkuu. Weka sera. Mwl. Mwikila anaendesha.',
    steps: [
      {
        n: '01',
        title: 'Ramani ya kila mji mkuu',
        body: 'Ongeza mali ya balozi: ofisi kuu, makazi, vituo, na ofisi za uwandani. Mwl. Mwikila huchimba sheria za mkataba, ushuru, na huduma za eneo kwa kila mji mkuu.',
      },
      {
        n: '02',
        title: 'Weka sera ya mfadhili',
        body: 'Sanidi mzunguko wa ukaguzi wa mfadhili na mfumo wa mamlaka ya malipo. Kila kitendo hubaki ndani ya mipaka iliyoidhinishwa na mfadhili.',
      },
      {
        n: '03',
        title: 'Pokea muhtasari wa mkuu wa balozi',
        body: 'Kila asubuhi: gharama kwa kila mji mkuu, orodha ya tofauti, mzunguko wa ukaguzi wa mfadhili, na maamuzi matatu ambayo mkuu wa balozi pekee anaweza kuyafanya.',
      },
    ],
    problemKicker: 'Mzigo wa balozi',
    problemHeading: 'Lahajedwali zilizorithiwa,',
    problemHeadingAccent: 'leja zisizo wazi',
    problemSub:
      'Balozi na NGO huendeshwa kwa kumbukumbu za kitaasisi zinazobadilika kila baada ya miaka 2 hadi 4. Mwl. Mwikila huzihifadhi kumbukumbu hizo nje ili mrithi afike siku ya kwanza akiwa na muhtasari kamili wa mali.',
    problemTitle: 'Bila BossNyumba',
    problems: [
      {
        title: 'Kumbukumbu za kitaasisi zinazobadilika',
        desc: 'Kila kipindi cha kazi huiacha mali ikiwa imehifadhiwa vibaya zaidi kuliko walivyoikuta. Mrithi huanza kutoka kwa mafaili yaliyorithiwa.',
      },
      {
        title: 'Hofu ya ukaguzi wa mfadhili',
        desc: 'Ukaguzi wa mwaka wa wafadhili humchukua afisa fedha kwa wiki kadhaa. Matokeo hayafungwi kabla ya mzunguko unaofuata.',
      },
      {
        title: 'Mtawanyiko wa mamlaka mingi',
        desc: 'Kila mji mkuu hucheza kwa sheria za eneo, kwenye mfumo wa eneo. Balozi haiwezi kujua ni kituo gani kiko salama.',
      },
      {
        title: 'Migogoro na wapangishaji',
        desc: 'Kurefusha mikataba hujadiliwa chini ya shinikizo la muda. Wenye nyumba hutumia vibaya ratiba ya kidiplomasia.',
      },
    ],
    solutionTitle: 'Na BossNyumba',
    solutions: [
      {
        title: 'Kumbukumbu za kitaasisi kiotomatiki',
        desc: 'Kila mkataba, ushuru, mgogoro, na uamuzi huhifadhiwa kwenye mfumo. Mrithi hufika akiwa na muhtasari kamili wa mali.',
      },
      {
        title: 'Mnyororo wa ukaguzi wa mfadhili',
        desc: 'Kila malipo yenye hash-chain, ya kuongeza tu, yanayohamishika kwa mkaguzi wa mfadhili nje ya mtandao.',
      },
      {
        title: 'Utii kwa kila mamlaka',
        desc: 'Sheria ya mkataba ya eneo, mfumo wa kodi wa eneo, mambo ya kipekee ya huduma za eneo yanashughulikiwa kwa kila kituo bila kulazimisha sheria za nchi moja kwa nyingine.',
      },
      {
        title: 'Mwongozo wa wapangishaji',
        desc: 'Mwl. Mwikila anajua kalenda yako ya kurefusha mikataba, chaguo zako mbadala, na vigezo vya soko lako. Mazungumzo huanza kutoka kwenye nguvu.',
      },
    ],
    ctaHeading: 'Endesha mali ya balozi, ipasavyo.',
    ctaSub:
      'Weka miadi ya onyesho la balozi la dakika 30. Tutapitia mnyororo wa ukaguzi wa mfadhili, leja ya kila mamlaka, na muhtasari wa mkuu wa balozi.',
    ctaPrimary: 'Weka miadi ya onyesho la balozi',
  },

  institutionalLandlord: {
    heroKicker: 'Kwa vyuo vikuu na hospitali',
    heroHeadline: 'Endesha chuo kizima',
    heroHeadlineAccent: 'kama mali moja',
    heroSub:
      'Mwl. Mwikila ni mfumo wa uendeshaji kwa vyuo vikuu, vyuo vikuu vishiriki, hospitali, na mifumo ya hospitali za mafunzo zinazomiliki mali kubwa za kitaasisi. Leja ya kuingia mara mbili isiyobadilika, mnyororo wa ukaguzi wa kiwango cha mfadhili, takwimu za kundi la mali kwa kila jengo, upangaji wa matengenezo, na muhtasari wa makamu mkuu wa chuo unaofika saa 12:00 kila asubuhi.',
    heroPrimaryCta: 'Weka onyesho la makamu mkuu wa chuo',
    heroSecondaryCta: 'Ona dashibodi ya chuo',
    trustline: [
      'Takwimu kwa kila jengo',
      'Tayari kwa ukaguzi wa mfadhili na ruzuku',
      'Upangaji wa matengenezo',
    ],
    statsHeading: 'Imejengwa kwa taasisi inayomiliki kitalu chake cha mji.',
    statsSub:
      'Vyuo vikuu na hospitali ni miongoni mwa wamiliki wakubwa wa mali katika mji wowote na wenye vifaa duni zaidi. Mwl. Mwikila humpa makamu mkuu wa chuo na mkurugenzi wa hospitali muhtasari mmoja wa mali bila kulazimisha taratibu mpya kwa wahadhiri.',
    stats: [
      {
        value: 'Kwa jengo',
        label: 'Takwimu',
        sub: 'Takwimu za ukaaji, mapato, na matumizi kwa kila bweni, jengo la mafunzo, na kliniki.',
      },
      {
        value: 'Upangaji',
        label: 'Matengenezo',
        sub: 'Wafanyakazi wa kitivo hupiga picha matatizo; Mwl. Mwikila hupendekeza fundi sahihi na agizo la kazi kwa idhini.',
      },
      {
        value: 'Kiwango cha mfadhili',
        label: 'Ukaguzi',
        sub: 'Kila malipo yenye hash-chain na tayari kwa mkaguzi wa mfadhili au ruzuku.',
      },
    ],
    stepsKicker: 'Inavyofanya kazi',
    stepsHeading: 'Ramani ya chuo. Panga matengenezo. Mwarifu mkuu.',
    steps: [
      {
        n: '01',
        title: 'Weka ramani ya kila jengo',
        body: 'Ongeza mali yako: vitivo, mabweni, kliniki, vituo. Mwl. Mwikila hupatanisha umiliki, mikataba, na vizuizi vya mfadhili kwa kila jengo.',
      },
      {
        n: '02',
        title: 'Panga matengenezo',
        body: 'Wafanyakazi wa kitivo hupiga picha matatizo. Mwl. Mwikila hupendekeza fundi sahihi na agizo la kazi; wewe unaidhinisha, kisha unathibitisha ukamilifu kwa picha.',
      },
      {
        n: '03',
        title: 'Muhtasari wa kila siku wa mkuu',
        body: 'Kila asubuhi: takwimu za chuo kizima, orodha ya hitilafu, ratiba ya ukaguzi wa mfadhili, na maamuzi matatu ambayo makamu mkuu wa chuo au mkurugenzi wa hospitali pekee wanaweza kufanya.',
      },
    ],
    problemKicker: 'Mzigo wa taasisi',
    problemHeading: 'Mafungu ya idara yaliyotengana,',
    problemHeadingAccent: 'upofu wa chuo kizima',
    problemSub:
      'Vyuo vikuu na hospitali huendesha mali zao kwa mafungu ya idara yaliyotengana. Mkurugenzi wa mali hawezi kueleza ni jengo lipi lenye faida, lipi ni mzigo, na lipi linalingana tu mapato na matumizi.',
    problemTitle: 'Bila BossNyumba',
    problems: [
      {
        title: 'Mtawanyiko wa kiidara',
        desc: 'Kila kitivo, kila kliniki, kila bweni huweka leja yake. Kutoa mtazamo mmoja wa mali yote hugharimu wiki kadhaa kila muhula.',
      },
      {
        title: 'Mlundikano wa matengenezo',
        desc: 'Tiketi hujirundika kwa msimamizi wa kitivo. Maabara inayovuja hutengenezwa baada ya wiki tatu. Boiler hubadilishwa kwa kujibu tatizo, sio kwa kujikinga mapema.',
      },
      {
        title: 'Kupotoka kwa vizuizi vya mfadhili',
        desc: 'Jengo lilitolewa kwa ajili ya mafunzo ya uuguzi. Miaka kumi na miwili baadaye, idara ya falsafa inalitumia. Mahusiano na mfadhili huharibika.',
      },
      {
        title: 'Hofu ya ukaguzi wa ruzuku',
        desc: 'Ukaguzi wa ruzuku wa mwaka humeza ofisi ya mhasibu mkuu (bursar) kwa wiki kadhaa. Matokeo mara chache hufungwa kabla ya mzunguko ujao.',
      },
    ],
    solutionTitle: 'Na BossNyumba',
    solutions: [
      {
        title: 'Dashibodi moja ya chuo',
        desc: 'Kila kitivo, kila bweni, kila kliniki — skrini moja, kwa wakati halisi, yenye takwimu zinazohamishika hadi kwenye ERP ya taasisi.',
      },
      {
        title: 'Upangaji wa matengenezo',
        desc: 'Wafanyakazi wa kitivo hupiga picha matatizo. Mwl. Mwikila hupendekeza fundi sahihi na agizo la kazi kwa idhini yako, kisha huandika uthibitisho wa ukamilifu.',
      },
      {
        title: 'Lebo za vizuizi vya mfadhili',
        desc: 'Kila jengo lina lebo ya vizuizi vya mfadhili. Mwl. Mwikila humwonya mkurugenzi wa mali kabla ya kupotoka kwa matumizi yoyote.',
      },
      {
        title: 'Mnyororo wa ukaguzi wa ruzuku',
        desc: 'Kila malipo yaliyofadhiliwa na ruzuku yana hash-chain na yanahamishika hadi kwa mkaguzi wa ruzuku bila intaneti.',
      },
    ],
    ctaHeading: 'Endesha chuo kizima kama mali moja.',
    ctaSub:
      'Weka onyesho la dakika 45 la makamu mkuu wa chuo. Tutapitia dashibodi ya chuo, upangaji wa matengenezo, na lebo za vizuizi vya mfadhili.',
    ctaPrimary: 'Weka onyesho la makamu mkuu wa chuo',
  },

  religiousOrganization: {
    heroKicker: 'Kwa mashirika ya kidini',
    heroHeadline: 'Simamia mali ya kusanyiko lako',
    heroHeadlineAccent: 'kwa uwazi unaostahili imani ya umma',
    heroSub:
      'Mwl. Mwikila anaendesha mali ya misikiti, makanisa, mahekalu na majimbo. Leja ya michango yenye uwazi kwa kusanyiko, muhtasari wa wadhamini tayari kwa AGM, utawala unaoendana na imani, na uthibitisho wa asili wenye hash-chain kwa kila malipo.',
    heroPrimaryCta: 'Omba kiwango cha msimamizi',
    heroSecondaryCta: 'Tazama dashibodi ya wadhamini',
    trustline: [
      'Punguzo la asilimia 30 kwa msimamizi',
      'Leja yenye uwazi kwa kusanyiko',
      'Muhtasari wa AGM tayari kwa wadhamini',
    ],
    statsHeading: 'Jumuiya za imani zinastahili zana za kiwango cha imani.',
    statsSub:
      'Mashirika ya kidini yanamiliki mali kubwa lakini yana bajeti ndogo zaidi ya zana. Mwl. Mwikila anawapa wadhamini uwazi ambao kusanyiko linatarajia bila kulazimisha lugha tata ya uhasibu wa kibiashara.',
    stats: [
      {
        value: '30%',
        label: 'Punguzo la msimamizi',
        sub: 'Kwa kila kiwango kwa nyumba za ibada zilizosajiliwa na mashirika ya kidini.',
      },
      {
        value: 'Hadharani',
        label: 'Leja ya michango',
        sub: 'Kila mwanachama wa kusanyiko anaweza kuona kilichotolewa na kilichotumika.',
      },
      {
        value: 'Tayari kwa AGM',
        label: 'Muhtasari wa wadhamini',
        sub: 'Wasilisho la mkutano mkuu wa mwaka linajiunda upya kutoka data hai kwa mguso mmoja.',
      },
    ],
    stepsKicker: 'Inavyofanya kazi',
    stepsHeading: 'Sajili dhamana. Fungua leja. Simamia hadharani.',
    steps: [
      {
        n: '01',
        title: 'Sajili dhamana',
        body: 'Pakia cheti chako cha usajili wa kidini na orodha ya wadhamini. Mwl. Mwikila anaunda leja ya dhamana, ratiba ya michango, na sheria za utawala.',
      },
      {
        n: '02',
        title: 'Fungua leja ya michango',
        body: 'Zaka, sadaka na michango hulipwa kupitia M-Pesa au benki. Kila malipo yanafika kwenye leja ya hadharani; kila mwanachama anaona aliyetoa na kilichotumika.',
      },
      {
        n: '03',
        title: 'Simamia AGM',
        body: 'Muhtasari wa wadhamini, hesabu zilizokaguliwa, kumbukumbu za vikao, mahudhurio — vyote vyenye hash-chain na vinavyoweza kuhamishwa kwa msajili.',
      },
    ],
    problemKicker: 'Pengo la jumuiya ya imani',
    problemHeading: 'Sadaka za fedha taslimu,',
    problemHeadingAccent: 'dhamana zisizo wazi',
    problemSub:
      'Jumuiya za imani huendeshwa kwa uaminifu, lakini uaminifu bila uwazi huvunjika wakati wa mabadiliko ya uongozi. Mwl. Mwikila anaweka uwazi ambao kusanyiko linatarajia bila kulazimisha lugha tata ya uhasibu wa kibiashara.',
    problemTitle: 'Bila BossNyumba',
    problems: [
      {
        title: 'Utata wa sadaka za fedha taslimu',
        desc: 'Fedha zinazotolewa wakati wa ibada hazina kumbukumbu. Wadhamini na waweka hazina hubeba hatari ya taasisi kibinafsi.',
      },
      {
        title: 'Migogoro ya uuzaji wa mali',
        desc: 'Jimbo linauza ukumbi wa parokia; kusanyiko linagundua baada ya kufanyika. Uaminifu unamomonyoka.',
      },
      {
        title: 'Kupotea kwa kumbukumbu za AGM',
        desc: 'Maazimio ya mwaka jana yanatoweka. Mwenyekiti mpya hana kumbukumbu ya taasisi.',
      },
      {
        title: 'Migogoro ya wachuuzi',
        desc: 'Msikiti ulimlipa mkandarasi kwa matengenezo ambayo hayakukamilika kamwe. Hakuna mkataba, hakuna escrow, hakuna njia ya kudai.',
      },
    ],
    solutionTitle: 'Na BossNyumba',
    solutions: [
      {
        title: 'Njia za kidijitali za zaka',
        desc: 'Njia za zaka kupitia M-Pesa zenye idhini ya mtoaji ya mguso mmoja. Kila zawadi inapata risiti kwenye leja ya kuingia mara mbili, yenye hash-chain, inayoonekana na wanachama.',
      },
      {
        title: 'Uuzaji wenye uwazi',
        desc: 'Uuzaji wowote wa mali huchochea mtiririko wa taarifa kwa kusanyiko pamoja na idhini ya wadhamini. Hakuna mauzo ya kimya.',
      },
      {
        title: 'Kumbukumbu tayari kwa AGM',
        desc: 'Kumbukumbu za vikao, mahudhurio, na hesabu zilizokaguliwa — vyote vyenye hash-chain na vinavyoweza kuhamishwa kwa msajili.',
      },
      {
        title: 'Malipo ya wachuuzi yenye hatua',
        desc: 'Kazi ya mchuuzi imegawanywa kwa hatua; mdhamini anaidhinisha kila hatua kabla Mwl. Mwikila hajaweka malipo kwenye leja — kila senti inafuatilika.',
      },
    ],
    ctaHeading: 'Simamia hadharani.',
    ctaSub:
      'Omba kiwango cha msimamizi. Nyumba za ibada zilizosajiliwa na mashirika ya kidini hupata punguzo la asilimia 30 kwa kila kiwango. Tuma barua pepe steward@bossnyumba.co.tz kutoka kwenye kikoa chako kilichosajiliwa.',
    ctaPrimary: 'Omba',
  },

  cooperativeSacco: {
    heroKicker: 'Kwa SACCO na vyama vya ushirika',
    heroHeadline: 'Mali inayomilikiwa na wanachama,',
    heroHeadlineAccent: 'leja inayoonekana na wanachama',
    heroSub:
      'Mwl. Mwikila huendesha mali ya SACCO, vyama vya ushirika, na vikundi vya uwekezaji vya wanachama. Leja ya michango inayoonekana na wanachama, mgawanyo wa wazi kwa wanachama, mawasilisho ya mkutano mkuu wa mwaka (AGM) tayari kwa msajili, na muhtasari wa idhini ya mguso mmoja unaowaridhisha wanachama na msajili wa ushirika pamoja.',
    heroPrimaryCta: 'Omba kiwango cha ushirika',
    heroSecondaryCta: 'Ona dashibodi ya SACCO',
    trustline: [
      'Punguzo la asilimia 30 kwa ushirika',
      'Mawasilisho tayari kwa msajili',
      'Leja inayoonekana na wanachama',
    ],
    statsHeading:
      'Inayomilikiwa na wanachama. Inayoonekana na wanachama. Inayoaminiwa na wanachama.',
    statsSub:
      'SACCO na vyama vya ushirika hushindwa pale uwazi unaposhindwa. Mwl. Mwikila hulazimisha uwazi kwa chaguo-msingi — kila mwanachama anaona namba zile zile, kila msajili anasoma wasilisho lile lile.',
    stats: [
      {
        value: '30%',
        label: 'Punguzo la ushirika',
        sub: 'Kwenye kila kiwango kwa SACCO na vyama vya ushirika vilivyosajiliwa.',
      },
      {
        value: 'Hadharani',
        label: 'Leja ya michango',
        sub: 'Kila mwanachama anaona kila mchango na kila malipo yaliyotolewa.',
      },
      {
        value: 'Mguso 1',
        label: 'Pack ya msajili',
        sub: 'Muhtasari wa mwaka unaoundwa kwa muundo unaokubaliwa na msajili wa ushirika, ili uwasilishe.',
      },
    ],
    stepsKicker: 'Inavyofanya kazi',
    stepsHeading: 'Sajili. Andikisha wanachama. Endesha hadharani.',
    steps: [
      {
        n: '01',
        title: 'Sajili ushirika',
        body: 'Pakia cheti cha ushirika na orodha ya wanachama. Mwl. Mwikila huunda ratiba ya michango, kanuni za mgawanyo, na grafu ya utawala.',
      },
      {
        n: '02',
        title: 'Andikisha wanachama',
        body: 'Wanachama hulipa hisa na michango kupitia M-Pesa au benki. Kila mchango hupokea risiti, wenye hash-chain, unaoonekana na wanachama.',
      },
      {
        n: '03',
        title: 'AGM + mawasilisho',
        body: 'Mkutano mkuu wa mwaka ndani ya programu: kumbukumbu, mahudhurio, muhtasari uliokaguliwa. Pack tayari kwa msajili kwa mguso mmoja, kwa muundo wanaoukubali, ili uwasilishe.',
      },
    ],
    problemKicker: 'Pengo la ushirika',
    problemHeading: 'Michango isiyo wazi,',
    problemHeadingAccent: 'mgawanyo wa kisiasa',
    problemSub:
      'Vyama vya ushirika hufa pale uwazi unapokufa. Mwl. Mwikila hulazimisha uwazi kwa chaguo-msingi ili ushirika unusurike mabadiliko ya uongozi na kukua zaidi ya mtandao wa upendeleo wa mwenyekiti mmoja.',
    problemTitle: 'Bila BossNyumba',
    problems: [
      {
        title: 'Michango isiyo wazi',
        desc: 'Wanachama hawajui nani alilipa na nani anadaiwa. Mweka hazina hubeba hatari ya taasisi binafsi.',
      },
      {
        title: 'Mgawanyo wa kisiasa',
        desc: 'Vitengo vilivyo wazi au manufaa ya wanachama huenda kwa rafiki wa mwenyekiti. Wanachama hulalamika bila mafanikio.',
      },
      {
        title: 'Kupotea kwa AGM',
        desc: 'Maazimio ya mwaka jana hupotea. Mwenyekiti mpya huanza kutoka ukurasa mtupu.',
      },
      {
        title: 'Msuguano wa msajili',
        desc: 'Wasilisho la mwaka kwa msajili hugeuka kuwa zoezi la uhasibu la miezi kadhaa linaloondoa umakini kutoka huduma kwa wanachama.',
      },
    ],
    solutionTitle: 'Na BossNyumba',
    solutions: [
      {
        title: 'Leja ya michango ya moja kwa moja',
        desc: 'Kila mwanachama anaona kila mchango, kila malipo yaliyotolewa, na salio la benki la ushirika — moja kwa moja.',
      },
      {
        title: 'Mgawanyo wa wazi',
        desc: 'Vitengo vilivyo wazi au manufaa ya wanachama hugawanywa kwa kanuni za wazi na kuwekwa kupitia leja ya kuingia mara mbili — kila senti inafuatilika.',
      },
      {
        title: 'Kumbukumbu tayari kwa AGM',
        desc: 'Kumbukumbu, mahudhurio, na muhtasari uliokaguliwa — vyote vyenye hash-chain na tayari kwa ukaguzi.',
      },
      {
        title: 'Pack tayari kwa msajili',
        desc: 'Muhtasari wa mwaka unaoundwa kwa muundo unaokubaliwa na msajili wa ushirika, kwa mguso mmoja, ili uwasilishe.',
      },
    ],
    ctaHeading: 'Mali inayomilikiwa na wanachama, leja inayoonekana na wanachama.',
    ctaSub:
      'Omba kiwango cha ushirika. SACCO na vyama vya ushirika vilivyosajiliwa hupata punguzo la asilimia 30 kwenye kila kiwango. Tuma barua pepe cooperative@bossnyumba.co.tz kutoka kwenye kikoa chako kilichosajiliwa.',
    ctaPrimary: 'Omba',
  },
};

/**
 * Resolve audience copy by key + locale. Falls back to EN if SW
 * translation does not exist yet for a given audience.
 */
export function getAudienceCopy(
  key: keyof typeof COPY,
  locale: Locale
): Readonly<AudiencePageCopy> {
  if (locale === 'sw' && COPY_SW[String(key)]) {
    return COPY_SW[String(key)] as Readonly<AudiencePageCopy>;
  }
  return COPY[key] as Readonly<AudiencePageCopy>;
}

/**
 * Per-audience-vertical copy for marketing pages. Adapted from the
 * parent fork's audience template and reframed for real estate.
 *
 * Real-estate audience verticals (see
 * Docs/PORT/BOSSNYUMBA_PORT_COORDINATION.md §4 domain map):
 *   for-individual-landlord
 *   for-portfolio-landlord
 *   for-tenant
 *   for-leasing-agency
 *   for-housing-cooperative
 *   for-real-estate-investor
 *   for-family-office
 *   for-bank (property finance / mortgage)
 *   for-regulator (housing regulator)
 *   for-community-housing
 *
 * Each entry is a `Readonly<AudiencePageCopy>` so the audience page
 * file is <40 LOC: a stub that imports the copy + the kicker icon.
 */

export const COPY = {
  individualLandlord: {
    heroKicker: 'For the individual landlord',
    heroHeadline: 'Run two flats',
    heroHeadlineAccent: 'like a portfolio',
    heroSub:
      'If you own one to five units, Mr. Mwikila collects rent over M-Pesa with one-tap tenant approval, sends polite late-rent reminders automatically, prepares your council-levy filing for your one-tap approval, and emails you a one-page owner statement on the 1st. You stay free on the Smallholder tier (T1).',
    heroPrimaryCta: 'Sign Up — free',
    heroSecondaryCta: 'How it works',
    trustline: ['Free up to 5 units', 'M-Pesa rent collection', 'No card needed'],
    statsHeading: 'Built for the Tanzanian landlord, not the Wall-Street REIT.',
    statsSub:
      'Individual landlords lose 18% of annual rent to late payments, manual chase calls, and missing receipts. Mr. Mwikila closes the gap with automatic reminders, a double-entry rent ledger, and a one-page owner statement — at zero cost on the Smallholder tier.',
    stats: [
      {
        value: '18%',
        label: 'Average rent leakage',
        sub: 'For untooled landlords in Dar es Salaam (BOT 2025).',
      },
      { value: '4 hrs', label: 'Saved per month', sub: 'On rent chase + receipts + bookkeeping.' },
      {
        value: '0 TZS',
        label: 'On Smallholder tier',
        sub: 'Up to 5 units, one seat, core property ops.',
      },
    ],
    stepsKicker: 'How it works',
    stepsHeading: 'Three steps. One hour. Then it runs itself.',
    steps: [
      {
        n: '01',
        title: 'Add your units',
        body: 'Snap a photo of the title page; Mr. Mwikila extracts the property + tenant data. Add your M-Pesa number to receive rent.',
      },
      {
        n: '02',
        title: 'Mr. Mwikila collects',
        body: 'Tenants approve the M-Pesa prompt on their phone. Late payers get a polite Swahili reminder automatically. You get a notification when each payment lands.',
      },
      {
        n: '03',
        title: 'Owner statement on the 1st',
        body: 'Every month: rent received, council levy prepared for your approval, maintenance owed, net to your account. PDF + email.',
      },
    ],
    problemKicker: 'The squeeze',
    problemHeading: 'Manual chase, missing receipts,',
    problemHeadingAccent: 'and council deadlines',
    problemSub:
      'The single landlord pays for the missing systems with their own time. Mr. Mwikila replaces the spreadsheet, the WhatsApp chase, and the panicked council-levy month.',
    problemTitle: 'Without BossNyumba',
    problems: [
      {
        title: 'WhatsApp chase loops',
        desc: 'You spend Saturday morning chasing rent from three tenants who all promise "kesho".',
      },
      {
        title: 'Missing receipts',
        desc: 'Tenant claims they paid; you cannot find the M-Pesa SMS. Disputes erode trust.',
      },
      {
        title: 'Council levy panic',
        desc: 'You remember the levy is due on the 28th when you see the WhatsApp from the municipality.',
      },
      {
        title: 'Year-end paperwork',
        desc: 'Tax filing turns into a multi-day archaeology dig through your phone.',
      },
    ],
    solutionTitle: 'With BossNyumba',
    solutions: [
      {
        title: 'Automatic Swahili reminders',
        desc: 'Mr. Mwikila sends late-rent reminders automatically over WhatsApp, SMS, and email with the right tone — polite, firm, never spammy.',
      },
      {
        title: 'Cryptographic receipts',
        desc: 'Every M-Pesa payment lands in an immutable double-entry ledger, so the receipt is the same on both sides — no more disputed payments.',
      },
      {
        title: 'Regulatory calendar',
        desc: 'Council levy, property tax, lease renewals — every deadline lands on your phone 14 days early.',
      },
      {
        title: 'Tax-ready year-end',
        desc: 'Owner statements concatenate into a TRA-ready filing pack in 90 seconds, for your one-tap approval.',
      },
    ],
    ctaHeading: 'Start free today.',
    ctaSub:
      'The Smallholder tier is free up to 5 units. Sign up with your M-Pesa number — no card needed.',
    ctaPrimary: 'Sign Up — free',
  },

  portfolioLandlord: {
    heroKicker: 'For the portfolio landlord',
    heroHeadline: 'When five units become',
    heroHeadlineAccent: 'fifty',
    heroSub:
      'Mr. Mwikila scales with you. Add buildings, blocks, and entire estates without adding spreadsheets. Cross-property cash flow, portfolio analytics, monthly owner statements, and an autonomy dial that lets you delegate the boring parts for your approval.',
    heroPrimaryCta: 'Book a 20-minute demo',
    heroSecondaryCta: 'See the platform',
    trustline: [
      'Up to 2,500 units on Corporate tier',
      'Multi-currency TZS/KES/USD',
      'Master Brain reasoning',
    ],
    statsHeading: 'Stop being your own bookkeeper.',
    statsSub:
      'Portfolio landlords burn their evenings on rent ops, maintenance triage, and statements that should be automated. Mr. Mwikila reclaims that time and gives you a morning briefing instead.',
    stats: [
      {
        value: 'Daily',
        label: 'Morning brief',
        sub: 'A one-screen overnight brief, generated on a schedule by the executive-brief engine.',
      },
      {
        value: 'Auto',
        label: 'Late-rent reminders',
        sub: 'Sent over WhatsApp, SMS, and email with channel failover — no manual chase.',
      },
      {
        value: '1 click',
        label: 'Owner statement',
        sub: 'Monthly statement across every property, exportable in any currency.',
      },
    ],
    stepsKicker: 'How it works',
    stepsHeading: 'Import your portfolio. Set the autonomy. Walk away.',
    steps: [
      {
        n: '01',
        title: 'Import',
        body: 'Bring your Excel + Drive + WhatsApp history. Mr. Mwikila extracts properties, leases, tenants, and arrears.',
      },
      {
        n: '02',
        title: 'Set autonomy',
        body: 'Choose how much Mr. Mwikila does on his own per domain — Finance, Maintenance, Compliance, Leasing.',
      },
      {
        n: '03',
        title: 'Receive briefing',
        body: 'Each morning at 6am: a one-screen brief of what happened overnight, what needs your eye, and what he handled.',
      },
    ],
    problemKicker: 'The growth tax',
    problemHeading: 'More units, more',
    problemHeadingAccent: 'spreadsheets',
    problemSub:
      'When the portfolio grows past ten units, the spreadsheet stops being enough. You either hire an in-house manager, or you accept the leakage. Mr. Mwikila is the third option.',
    problemTitle: 'Without BossNyumba',
    problems: [
      {
        title: 'Spreadsheet sprawl',
        desc: 'One sheet per building, none of them reconcile, none of them survive a phone change.',
      },
      {
        title: 'Maintenance backlog',
        desc: 'Tickets pile up on WhatsApp; you forget the broken cistern in unit 4B for three weeks.',
      },
      {
        title: 'Cash-flow blind spots',
        desc: 'You cannot tell which building is actually profitable until the year-end accountant arrives.',
      },
      {
        title: 'Compliance whack-a-mole',
        desc: 'Different councils, different deadlines, different forms. Something always slips.',
      },
    ],
    solutionTitle: 'With BossNyumba',
    solutions: [
      {
        title: 'One portfolio cockpit',
        desc: 'Every property, every unit, every tenant — one page, real-time.',
      },
      {
        title: 'Maintenance triage',
        desc: 'Photos of leaks land in tickets; Mr. Mwikila proposes the right vendor and the work order for your approval.',
      },
      {
        title: 'Per-building analytics',
        desc: 'Occupancy, revenue, and expense analytics per property, per block — exportable in any currency.',
      },
      {
        title: 'Regulatory calendar',
        desc: 'Every council, every deadline surfaced early; Mr. Mwikila prepares each filing for your one-tap approval.',
      },
    ],
    ctaHeading: 'Run more, do less.',
    ctaSub:
      'Book a 20-minute demo. We will import a sample of your portfolio live and show you the cockpit you would land on tomorrow.',
    ctaPrimary: 'Book a demo',
  },

  tenant: {
    heroKicker: 'For tenants and prospects',
    heroHeadline: 'Find a home,',
    heroHeadlineAccent: 'apply in minutes',
    heroSub:
      'Search verified properties across Dar, Arusha, Mwanza, Mbeya, and Nairobi. Request a tour. Apply with your verified profile, place a bid, and chat with the property manager — all from your phone.',
    heroPrimaryCta: 'Browse listings',
    heroSecondaryCta: 'How applying works',
    trustline: ['Verified landlords only', 'Verified applicant profile', 'In-app chat'],
    statsHeading: 'BossNyumba listings are the verified ones.',
    statsSub:
      'Every property on BossNyumba has a title-verified landlord, an inspected unit, and a lease template approved under the Land Act. No ghost listings.',
    stats: [
      {
        value: '100%',
        label: 'Title-verified',
        sub: 'Every landlord verified against the registry before listing.',
      },
      {
        value: 'NIDA',
        label: 'Verified profile',
        sub: 'Apply once with a verified identity profile; no repeating yourself per landlord.',
      },
      {
        value: '0%',
        label: 'Hidden fees',
        sub: 'Service charges and deposits disclosed up front, on every listing.',
      },
    ],
    stepsKicker: 'How applying works',
    stepsHeading: 'Three steps. From scroll to shortlist.',
    steps: [
      {
        n: '01',
        title: 'Browse + tour',
        body: 'Filter by area, bedrooms, price. Request a virtual tour or an in-person visit straight from the listing.',
      },
      {
        n: '02',
        title: 'Apply + bid',
        body: 'Tap "I want this". The landlord sees your verified profile (NIDA, employer, references) and accepts, counter-offers, or invites a bid.',
      },
      {
        n: '03',
        title: 'Agree the terms',
        body: 'Chat with the property manager in-app to settle move-in, deposit, and lease terms before you commit.',
      },
    ],
    problemKicker: 'The rental trap',
    problemHeading: 'Ghost listings, missing deposits,',
    problemHeadingAccent: 'no receipts',
    problemSub:
      'Renting on WhatsApp groups means scams, ghost landlords, and disputes that never settle. BossNyumba pulls the rental market into a verified, receipt-backed system.',
    problemTitle: 'Without BossNyumba',
    problems: [
      {
        title: 'Ghost listings',
        desc: 'The photo was beautiful; the apartment was demolished six months ago.',
      },
      {
        title: 'Unverified landlords',
        desc: 'You cannot tell who actually owns the unit, or whether the deposit is safe.',
      },
      {
        title: 'Hidden terms',
        desc: 'Service charges and deposit rules surface only after you have committed.',
      },
      {
        title: 'Unfair eviction',
        desc: 'No written notice, no notice period, no path to dispute.',
      },
    ],
    solutionTitle: 'With BossNyumba',
    solutions: [
      {
        title: 'Verified listings only',
        desc: 'Title-checked landlords, inspected units, council-approved lease templates.',
      },
      {
        title: 'Verified applicant profile',
        desc: 'Apply once with a NIDA-verified profile and references; the landlord sees a real applicant, not a WhatsApp message.',
      },
      {
        title: 'Transparent terms up front',
        desc: 'Service charges, deposit, and lease terms disclosed on every listing — and confirmed in in-app chat before you commit.',
      },
      {
        title: 'Tenant rights',
        desc: 'Lease + notice + dispute path explained in Swahili and English. Built on the Land Act, not vibes.',
      },
    ],
    ctaHeading: 'Find a home today.',
    ctaSub: 'Browse verified listings. No account needed to look — only to apply.',
    ctaPrimary: 'Browse listings',
  },

  leasingAgency: {
    heroKicker: 'For leasing agencies + corporate housing',
    heroHeadline: 'Place tenants ten times',
    heroHeadlineAccent: 'faster',
    heroSub:
      'Source verified inventory across Tanzania and Kenya. Match prospects to units with the AI matcher. Generate corporate-housing offers in minutes. Track every placement and commission on one ledger.',
    heroPrimaryCta: 'Book a partner call',
    heroSecondaryCta: 'See the agency cockpit',
    trustline: ['Multi-landlord inventory', 'Commission on one ledger', 'Corporate-housing OS'],
    statsHeading: 'The OS leasing agencies wish they had built.',
    statsSub:
      'Agencies on BossNyumba work from live verified inventory, match prospects with the AI matcher, and track every placement and commission on one ledger instead of a WhatsApp thread.',
    stats: [
      {
        value: 'Live',
        label: 'Inventory feed',
        sub: 'Landlords update Mr. Mwikila; you see verified availability in real time.',
      },
      {
        value: 'AI',
        label: 'Prospect matcher',
        sub: 'Ranks verified inventory against each brief — bedrooms, schools, security, commute, budget.',
      },
      {
        value: '1',
        label: 'Commission ledger',
        sub: 'Every placement and commission booked to one double-entry ledger with a signed statement.',
      },
    ],
    stepsKicker: 'How it works',
    stepsHeading: 'Wire up your prospects. Match. Place. Get paid.',
    steps: [
      {
        n: '01',
        title: 'Sync prospects',
        body: 'Bring corporate clients (banks, embassies, enterprise tenants). BossNyumba builds a brief from their relocation requirements.',
      },
      {
        n: '02',
        title: 'AI matcher',
        body: 'Mr. Mwikila ranks verified inventory against the brief — bedrooms, schools, security, commute, budget — in seconds.',
      },
      {
        n: '03',
        title: 'Track commission',
        body: 'When the placement lands, the commission is booked to one ledger with a signed statement — no more chasing landlords for a confirmation.',
      },
    ],
    problemKicker: 'The agency tax',
    problemHeading: 'Inventory drift, commission chasing,',
    problemHeadingAccent: 'and no platform',
    problemSub:
      'Most agencies run on WhatsApp groups, half-updated spreadsheets, and trust. The good ones close one in twenty; the great ones close one in ten. BossNyumba moves you to one in three.',
    problemTitle: 'Without BossNyumba',
    problems: [
      {
        title: 'Inventory drift',
        desc: "Half the units in your spreadsheet aren't actually available.",
      },
      {
        title: 'Commission limbo',
        desc: 'You closed the lease in March; the commission lands in July.',
      },
      {
        title: 'No corporate offer',
        desc: 'Banks want a slick PDF; you send a WhatsApp message with photos.',
      },
      {
        title: 'Manual reference checks',
        desc: 'You spend hours calling employers to verify what BossNyumba can verify in seconds.',
      },
    ],
    solutionTitle: 'With BossNyumba',
    solutions: [
      {
        title: 'Live inventory feed',
        desc: 'Landlords update Mr. Mwikila; you see the truth in real time.',
      },
      {
        title: 'Commission on one ledger',
        desc: 'Every placement and commission booked to a double-entry ledger with a signed statement — no more invoice limbo.',
      },
      {
        title: 'Corporate offer generator',
        desc: 'PDF + virtual tour + lease draft for every prospect, in two minutes.',
      },
      {
        title: 'Verified reference loop',
        desc: 'NIDA, employer, and prior-landlord verification on the applicant profile — far fewer phone calls.',
      },
    ],
    ctaHeading: 'Become a BossNyumba partner agency.',
    ctaSub:
      'Book a 20-minute partner call. We will walk you through the agency cockpit and the commission flow.',
    ctaPrimary: 'Book a partner call',
  },

  housingCooperative: {
    heroKicker: 'For housing cooperatives',
    heroHeadline: 'Run your cooperative',
    heroHeadlineAccent: 'transparently',
    heroSub:
      'BossNyumba gives every cooperative member a real-time view of dues paid, the building maintenance plan, the AGM calendar, and the cooperative bank balance. Mr. Mwikila handles dues collection, member allocations, and the bookkeeping the registrar wants.',
    heroPrimaryCta: 'Apply for cooperative tier',
    heroSecondaryCta: 'How it works',
    trustline: ['30% off all tiers', 'AGM-ready statements', 'Member-visible dues ledger'],
    statsHeading: 'Cooperatives need transparency. Mr. Mwikila ships it.',
    statsSub:
      'BossNyumba bakes the cooperative-governance model into the product so dues, decisions, and disputes have one source of truth.',
    stats: [
      { value: '30%', label: 'Discount', sub: 'Off every tier for registered cooperatives.' },
      {
        value: '1-tap',
        label: 'AGM statement',
        sub: 'Registrar-ready, member-ready, accountant-ready.',
      },
      {
        value: 'Live',
        label: 'Dues ledger',
        sub: 'Every member sees who paid, who owes, and the cooperative balance — settled per member.',
      },
    ],
    stepsKicker: 'How it works',
    stepsHeading: 'From registration to AGM, all in one place.',
    steps: [
      {
        n: '01',
        title: 'Register the cooperative',
        body: 'Upload the cooperative certificate. BossNyumba mints the member roster, dues schedule, and governance rules.',
      },
      {
        n: '02',
        title: 'Dues + transparency',
        body: 'Members pay monthly dues over M-Pesa. Every member sees who paid, who owes, what the cooperative spent.',
      },
      {
        n: '03',
        title: 'AGM + filing',
        body: 'Schedule the AGM in-app. Members see the audited statement. Mr. Mwikila generates a registrar-ready filing pack in one tap for you to submit.',
      },
    ],
    problemKicker: 'The cooperative trap',
    problemHeading: 'Disputes, missing minutes,',
    problemHeadingAccent: 'and lost trust',
    problemSub:
      'Cooperatives fail when transparency fails. Mr. Mwikila enforces transparency by default — every member sees the same numbers.',
    problemTitle: 'Without BossNyumba',
    problems: [
      {
        title: 'Dues opacity',
        desc: 'Members ask "who paid?" — nobody can produce a clean ledger.',
      },
      {
        title: 'Vendor disputes',
        desc: 'The cooperative paid TZS 4M to a vendor; the work is half-done; no contract, no escrow.',
      },
      {
        title: 'AGM minutes drift',
        desc: "Last year's motions disappear; the chair changes; institutional memory dies.",
      },
      {
        title: 'Registrar friction',
        desc: 'Annual filing turns into a multi-month accounting exercise.',
      },
    ],
    solutionTitle: 'With BossNyumba',
    solutions: [
      {
        title: 'Live dues ledger',
        desc: 'Every member sees who paid, who owes, and the cooperative bank balance.',
      },
      {
        title: 'Member allocations',
        desc: 'Dues and distributions allocated per member through the double-entry ledger — every cent traceable.',
      },
      {
        title: 'AGM-ready records',
        desc: 'Minutes, attendance, and the audited statement — all hash-chained and member-visible.',
      },
      {
        title: 'Registrar-ready pack',
        desc: 'Year-end statement and minutes assembled into a registrar-ready filing pack in one tap, for you to submit.',
      },
    ],
    ctaHeading: 'Apply for the cooperative tier.',
    ctaSub:
      'Registered housing cooperatives get 30% off every tier. Email community@bossnyumba.com from your registered domain.',
    ctaPrimary: 'Apply',
  },

  realEstateInvestor: {
    heroKicker: 'For real-estate investors',
    heroHeadline: 'See yield before',
    heroHeadlineAccent: 'you buy',
    heroSub:
      'BossNyumba reasons over title, zoning, comparable sales, current rent rolls, and council levy history to give every prospect property a five-year IRR with conformal confidence. Then operates it for you after you buy.',
    heroPrimaryCta: 'Book an investor demo',
    heroSecondaryCta: 'See the deal cockpit',
    trustline: ['Conformal IRR predictions', 'Title-and-zoning audited', 'Operator after close'],
    statsHeading: 'From shortlist to operator, one platform.',
    statsSub:
      'Most investors juggle a spreadsheet, an agent, a lawyer, and a property manager. Mr. Mwikila collapses that into one cockpit.',
    stats: [
      {
        value: '5-yr IRR',
        label: 'Conformal prediction',
        sub: 'With 80% / 90% / 95% confidence band, per prospect — calibrated, not a point guess.',
      },
      {
        value: 'One',
        label: 'Diligence pack',
        sub: 'Title chain, zoning, condition, comparables, rent rolls, levy history — one PDF.',
      },
      {
        value: '1 click',
        label: 'To operator mode',
        sub: 'Move from due-diligence to operations in-app.',
      },
    ],
    stepsKicker: 'How it works',
    stepsHeading: 'Shortlist. Diligence. Close. Operate.',
    steps: [
      {
        n: '01',
        title: 'Shortlist',
        body: 'Drop in URLs, photos, or the property registry number. Mr. Mwikila builds a deal brief in 60 seconds.',
      },
      {
        n: '02',
        title: 'Diligence',
        body: 'Title chain, zoning, building condition, comparable sales, rent rolls, levy history — one PDF.',
      },
      {
        n: '03',
        title: 'Operate',
        body: 'At close, Mr. Mwikila imports the tenant roster and starts collecting rent over M-Pesa with one-tap tenant approval — booked to a double-entry ledger.',
      },
    ],
    problemKicker: 'The diligence tax',
    problemHeading: 'Bad data, hidden levies,',
    problemHeadingAccent: 'and operator drift',
    problemSub:
      'Most real-estate losses are foreseeable. The data exists; it just lives in fifteen unconnected places. Mr. Mwikila reads all fifteen.',
    problemTitle: 'Without BossNyumba',
    problems: [
      {
        title: 'Title surprises',
        desc: 'You discover the disputed clause four months after closing.',
      },
      {
        title: 'Hidden levies',
        desc: "The council has a TZS 28M arrears bill that did not show up in the agent's deck.",
      },
      {
        title: 'Optimistic rent rolls',
        desc: "The seller's rent roll is two years out of date and assumes 100% occupancy.",
      },
      {
        title: 'Operator drift',
        desc: 'The property manager you inherit underperforms the market by 15% and you do not notice for a year.',
      },
    ],
    solutionTitle: 'With BossNyumba',
    solutions: [
      {
        title: 'Title-chain audit',
        desc: 'Every transfer back to the registry, flagged for disputes and easements.',
      },
      {
        title: 'Levy audit',
        desc: 'Every council, every levy, every arrears day — surfaced before close.',
      },
      {
        title: 'Conformal rent rolls',
        desc: 'Actual rent collected last 12 months + occupancy + churn, all hash-chained.',
      },
      {
        title: 'Operator benchmarking',
        desc: 'Mr. Mwikila compares your portfolio against anonymised peers monthly.',
      },
    ],
    ctaHeading: 'Diligence in days, not months.',
    ctaSub:
      'Book a 30-minute investor demo. Bring a prospect address; we will run the full diligence live.',
    ctaPrimary: 'Book an investor demo',
  },

  familyOffice: {
    heroKicker: 'For family offices',
    heroHeadline: 'Treat property like the',
    heroHeadlineAccent: 'asset class it is',
    heroSub:
      'Family-office-grade reporting on a real-estate portfolio: an immutable double-entry ledger, monthly owner statements, audit-ready compliance exports, and portfolio analytics — with a single Mr. Mwikila advisor across every property and currency.',
    heroPrimaryCta: 'Book a family-office demo',
    heroSecondaryCta: 'See the reporting',
    trustline: ['Audit-ready ledger', 'Monthly owner statements', 'Portfolio analytics'],
    statsHeading: 'Built for the long-horizon owner.',
    statsSub:
      'Family-office clients run BossNyumba across large property portfolios spanning multiple holding companies, trusts, and jurisdictions. Mr. Mwikila keeps every property on one audit-ready ledger.',
    stats: [
      {
        value: 'Immutable',
        label: 'Double-entry ledger',
        sub: 'Every receipt and disbursement booked, balanced, and append-only — the same number on both sides.',
      },
      {
        value: 'Monthly',
        label: 'Owner statements',
        sub: 'Generated and delivered on schedule, exportable in any currency.',
      },
      {
        value: 'Export',
        label: 'Audit-ready',
        sub: 'Hash-chained compliance exports your external auditor can verify offline.',
      },
    ],
    stepsKicker: 'How it works',
    stepsHeading: 'Bring the estate. Mr. Mwikila keeps the books.',
    steps: [
      {
        n: '01',
        title: 'Map the estate',
        body: 'Add the properties across your holding companies and trusts. Mr. Mwikila organises them under one owner view.',
      },
      {
        n: '02',
        title: 'Connect rent flows',
        body: 'Collect rent over M-Pesa with one-tap tenant approval; every payment books to the double-entry ledger.',
      },
      {
        n: '03',
        title: 'Scheduled reporting',
        body: 'Monthly owner statements and portfolio analytics — occupancy, revenue, expenses — with audit-ready exports on demand.',
      },
    ],
    problemKicker: "The principal's problem",
    problemHeading: 'Three accountants, one principal,',
    problemHeadingAccent: 'three sets of books',
    problemSub:
      'Family offices run on humans who hold the books in their heads. Mr. Mwikila puts every property on one audit-ready ledger so the principal always sees the same numbers.',
    problemTitle: 'Without BossNyumba',
    problems: [
      {
        title: 'Three sets of books',
        desc: 'Three accountants, three reconciliation cycles. None of them agree, and none survives a handover.',
      },
      {
        title: 'Statement lag',
        desc: 'Owner statements arrive late and inconsistent, so the principal trades on a stale picture.',
      },
      {
        title: 'Receipt disputes',
        desc: 'Rent paid over mobile money has no shared record; payments get disputed months later.',
      },
      {
        title: 'Audit scramble',
        desc: 'External audits turn into a multi-week archaeology dig because nothing is hash-chained.',
      },
    ],
    solutionTitle: 'With BossNyumba',
    solutions: [
      {
        title: 'One owner ledger',
        desc: 'Every rent receipt and disbursement booked to one immutable double-entry ledger across every property — the same number on both sides.',
      },
      {
        title: 'Scheduled statements',
        desc: 'Monthly owner statements generated and delivered automatically, exportable in any currency for the family meeting.',
      },
      {
        title: 'Portfolio analytics',
        desc: 'Occupancy, revenue, and expense analytics across the portfolio — so the principal always sees the same picture.',
      },
      {
        title: 'Audit-ready exports',
        desc: 'Hash-chained, append-only compliance exports your external auditor can verify offline.',
      },
    ],
    ctaHeading: 'One estate. One advisor. One ledger.',
    ctaSub:
      'Book a 45-minute family-office demo. We will stand up the ledger, statements, and analytics on a sample of your portfolio.',
    ctaPrimary: 'Book a demo',
  },

  bank: {
    heroKicker: 'For banks + property finance',
    heroHeadline: 'Underwrite property cash flows',
    heroHeadlineAccent: 'you can verify',
    heroSub:
      'BossNyumba turns verified, hash-chained property cash flows into a computed credit score so banks can underwrite mortgages, bridge loans, and acquisition finance with confidence — even for small landlords who never had bankable books.',
    heroPrimaryCta: 'Book a credit demo',
    heroSecondaryCta: 'See the credit score',
    trustline: [
      'Hash-chained cash flows',
      'Computed credit score',
      'Consented API feed on the roadmap',
    ],
    statsHeading: 'Bank the underbanked landlord.',
    statsSub:
      "Most Tanzanian landlords have rentable assets and no bankable books. BossNyumba's audit chain turns receipts into underwritable cash flow.",
    stats: [
      {
        value: '12 mo',
        label: 'Cash-flow history',
        sub: 'Per landlord, hash-chained, exportable to your credit system as a compliance export.',
      },
      {
        value: 'Score',
        label: 'Credit rating',
        sub: 'A computed credit score with a scoring model, scheduled recompute, and a verifiable certificate.',
      },
      {
        value: 'Roadmap',
        label: 'Consented API feed',
        sub: 'A read-only API into landlord-consented cash-flow data is on the roadmap.',
      },
    ],
    stepsKicker: 'How it works',
    stepsHeading: 'Export. Score. Lend. Review.',
    steps: [
      {
        n: '01',
        title: 'Landlord shares',
        body: 'Your customer exports their hash-chained cash-flow history as a compliance export you can verify offline. (A direct consented API feed is on the roadmap.)',
      },
      {
        n: '02',
        title: 'Score',
        body: '12-month rent collection, occupancy, and levy compliance roll into a computed credit score with a verifiable certificate.',
      },
      {
        n: '03',
        title: 'Lend + review',
        body: 'Disburse over your existing rails. Pull an on-demand refinancing report with LTV/DSCR stress tests at review time.',
      },
    ],
    problemKicker: 'The credit gap',
    problemHeading: 'Bankable landlords with',
    problemHeadingAccent: 'unbankable books',
    problemSub:
      'You know there are good landlords in your branch network. You just cannot underwrite them — no statements, no audited rent rolls, no verified occupancy.',
    problemTitle: 'Without BossNyumba',
    problems: [
      {
        title: 'WhatsApp rent rolls',
        desc: 'The applicant brings a WhatsApp screenshot. You decline.',
      },
      {
        title: 'Title-only collateral',
        desc: 'You can lend against the deed, but not against the cash flow. Your LTV stays conservative.',
      },
      {
        title: 'Post-disburse blindness',
        desc: 'Once disbursed, you have no visibility on DSCR until the borrower defaults.',
      },
      {
        title: 'Manual portfolio review',
        desc: 'Annual reviews are a phone-call exercise; defaults catch you late.',
      },
    ],
    solutionTitle: 'With BossNyumba',
    solutions: [
      {
        title: 'Verified cash flows',
        desc: 'Hash-chained 12-month rent + maintenance + levy history per landlord, exportable to your credit system.',
      },
      {
        title: 'Computed credit score',
        desc: 'A scoring model turns rent yield into a credit score with a verifiable certificate — price for risk you can actually see.',
      },
      {
        title: 'On-demand stress test',
        desc: 'Pull a refinancing report with LTV/DSCR stress tests at underwriting and review — on demand, not once a year.',
      },
      {
        title: 'Portfolio analytics',
        desc: 'Per-region health metrics across the consented book; analytics, not anniversary phone calls.',
      },
    ],
    ctaHeading: 'Lend to the landlords you have always wanted to.',
    ctaSub:
      'Book a 30-minute credit demo. We will walk through the credit score, the exportable cash-flow history, and the underwriting model.',
    ctaPrimary: 'Book a credit demo',
  },

  regulator: {
    heroKicker: 'For housing regulators',
    heroHeadline: 'See the rental market',
    heroHeadlineAccent: 'as it actually is',
    heroSub:
      'BossNyumba gives the housing regulator a live, anonymised view of the rental market: lease counts, average rents by district, deposit-dispute volumes, tenant complaints, and council-levy compliance — all opt-in by landlord and constitutionally bounded.',
    heroPrimaryCta: 'Book a regulator demo',
    heroSecondaryCta: 'See the dashboard',
    trustline: ['Constitutionally bounded', 'Tenant-consent first', 'Live + auditable'],
    statsHeading: 'Evidence-based housing policy.',
    statsSub:
      "Regulators craft policy on yearly surveys. BossNyumba surfaces the same market signals daily — without ever exposing a single individual's data.",
    stats: [
      {
        value: 'Live',
        label: 'Market signal',
        sub: 'Lease counts, district median rents, dispute volumes — updated daily.',
      },
      {
        value: 'Anon',
        label: 'Differential privacy',
        sub: 'No individual landlord or tenant ever identifiable from the dashboard.',
      },
      {
        value: 'Audited',
        label: 'Hash-chained',
        sub: 'Every export carries a cryptographic provenance proof.',
      },
    ],
    stepsKicker: 'How it works',
    stepsHeading: 'Aggregate. Anonymise. Audit. Share.',
    steps: [
      {
        n: '01',
        title: 'Aggregate',
        body: 'BossNyumba aggregates lease, rent, dispute, and compliance data across consented landlords.',
      },
      {
        n: '02',
        title: 'Anonymise',
        body: 'Differential-privacy thresholds prevent re-identification at district or building level.',
      },
      {
        n: '03',
        title: 'Share',
        body: 'Regulator dashboard + monthly evidence pack + ad-hoc query endpoint, all hash-chained.',
      },
    ],
    problemKicker: 'The policy gap',
    problemHeading: 'Yearly surveys, ad-hoc complaints,',
    problemHeadingAccent: 'no live signal',
    problemSub:
      "Housing regulators design rent caps and tenant-protection acts on stale data. Mr. Mwikila brings the market signal into the regulator's morning brief.",
    problemTitle: 'Without BossNyumba',
    problems: [
      {
        title: 'Stale surveys',
        desc: "Last year's NBS housing survey informs this year's council policy.",
      },
      {
        title: 'Anecdotal complaints',
        desc: 'Tenant association sends a letter; you do not know how representative it is.',
      },
      {
        title: 'Council fragmentation',
        desc: '184 councils, 184 different lease-registration formats. No consolidated view.',
      },
      {
        title: 'No early warning',
        desc: 'Eviction spikes are visible only in news cycles, not in dashboards.',
      },
    ],
    solutionTitle: 'With BossNyumba',
    solutions: [
      {
        title: 'Daily market signal',
        desc: 'District median rents, lease churn, occupancy — updated nightly.',
      },
      {
        title: 'Dispute heat-map',
        desc: 'Where are tenants and landlords actually fighting? Get the answer monthly.',
      },
      {
        title: 'Council interoperability',
        desc: 'Consistent lease + levy data across all participating councils.',
      },
      {
        title: 'Eviction early-warning',
        desc: 'Rising eviction filings visible 60-90 days before the news cycle.',
      },
    ],
    ctaHeading: 'Bring policy out of the rear-view mirror.',
    ctaSub: 'Book a 30-minute regulator demo with our public-sector lead.',
    ctaPrimary: 'Book a regulator demo',
  },

  communityHousing: {
    heroKicker: 'For community housing',
    heroHeadline: 'Housing for the people',
    heroHeadlineAccent: 'who build the city',
    heroSub:
      'BossNyumba powers cooperative housing, community land trusts, and worker-housing partnerships for NGOs, industrial towns, and university campuses. Mr. Mwikila runs the dues ledger and member allocations, and assembles AGM-ready records.',
    heroPrimaryCta: 'Apply for community tier',
    heroSecondaryCta: 'See the model',
    trustline: ['30% community discount', 'Allocation transparency', 'Member-first governance'],
    statsHeading: 'Community housing that the community trusts.',
    statsSub:
      'Most community housing fails because the books are opaque and the allocations are political. Mr. Mwikila enforces transparent dues, fair allocations, and AGM-ready records.',
    stats: [
      {
        value: '30%',
        label: 'Community discount',
        sub: 'Off every tier for registered community-housing schemes.',
      },
      { value: 'Public', label: 'Dues ledger', sub: 'Every member sees every payment.' },
      {
        value: 'Fair',
        label: 'Allocation lottery',
        sub: 'Hash-chained, audit-ready, dispute-resistant.',
      },
    ],
    stepsKicker: 'How it works',
    stepsHeading: 'Three steps to a community-housing OS.',
    steps: [
      {
        n: '01',
        title: 'Register the scheme',
        body: 'Upload the scheme certificate. BossNyumba mints the member roster, dues schedule, and allocation rules.',
      },
      {
        n: '02',
        title: 'Dues + allocation',
        body: 'Members pay dues; vacancies are allocated transparently and booked through the double-entry ledger. Every step is hash-chained.',
      },
      {
        n: '03',
        title: 'AGM + transparency',
        body: 'AGM in-app: minutes, attendance, audited financials — all member-visible and hash-chained.',
      },
    ],
    problemKicker: 'The community gap',
    problemHeading: 'Opaque dues, political allocations,',
    problemHeadingAccent: 'lost trust',
    problemSub:
      'Community housing dies when transparency dies. Mr. Mwikila enforces transparency by default so the scheme survives leadership changes.',
    problemTitle: 'Without BossNyumba',
    problems: [
      {
        title: 'Opaque dues',
        desc: 'Members do not know who paid, who owes, or what the scheme spent.',
      },
      {
        title: 'Political allocations',
        desc: "Vacant units go to the chair's friend; members complain in vain.",
      },
      {
        title: 'AGM drift',
        desc: "Last year's motions disappear; this year's chair has no institutional memory.",
      },
      { title: 'Donor distrust', desc: 'NGOs and corporates lose confidence; funding dries up.' },
    ],
    solutionTitle: 'With BossNyumba',
    solutions: [
      {
        title: 'Public dues ledger',
        desc: 'Every member, every payment, every cooperative spend — visible to all members.',
      },
      {
        title: 'Transparent allocation',
        desc: 'Vacancies allocated on transparent, auditable rules and booked through the double-entry ledger — every cent traceable.',
      },
      {
        title: 'AGM-ready records',
        desc: 'Minutes, attendance, and audited financials — hash-chained and member-visible.',
      },
      {
        title: 'Donor reports',
        desc: 'NGOs and corporates get a quarterly impact pack, generated from live data, audit-ready.',
      },
    ],
    ctaHeading: 'Trust, baked in.',
    ctaSub: 'Apply for the community-housing tier. Registered schemes get 30% off every tier.',
    ctaPrimary: 'Apply',
  },

  corporatePortfolio: {
    heroKicker: 'For corporate portfolios',
    heroHeadline: "The world's first AI Estate-Management Partner",
    heroHeadlineAccent: 'for corporate property',
    heroSub:
      'Mr. Mwikila is the calm second-in-command for any enterprise holding staff housing, branch offices, warehouses, or retail premises as part of operations. One lease ledger, utilities metering and reconciliation, portfolio analytics, and audit-ready compliance exports across every site.',
    heroPrimaryCta: 'Book an enterprise demo',
    heroSecondaryCta: 'See the reporting',
    trustline: [
      'Audit-grade double-entry ledger',
      'Utilities metering + reconciliation',
      'Portfolio analytics',
    ],
    statsHeading: 'Stop running your property estate on three spreadsheets.',
    statsSub:
      'Corporate portfolios leak recoverable cost to lease drift, levy slippage, and uninvoiced utilities. Mr. Mwikila puts every site on one ledger and surfaces the leakage in analytics, across every site and currency.',
    stats: [
      {
        value: 'One',
        label: 'Lease ledger',
        sub: 'Every lease, levy, and utility bill booked to one immutable double-entry ledger.',
      },
      {
        value: 'Metered',
        label: 'Utilities',
        sub: 'Water, electricity, gas — accounts, readings, and bills tracked and reconciled per site.',
      },
      {
        value: 'Export',
        label: 'Audit-ready',
        sub: 'Hash-chained compliance exports into your enterprise BI, in any currency.',
      },
    ],
    stepsKicker: 'How it works',
    stepsHeading: 'Bring the portfolio. Set the policy. Mr. Mwikila keeps the books.',
    steps: [
      {
        n: '01',
        title: 'Map every site',
        body: 'Add your leases, levies, vendor contracts, and utility accounts. Mr. Mwikila organises them under one site-by-site view.',
      },
      {
        n: '02',
        title: 'Set policy + autonomy',
        body: 'Choose how much Mr. Mwikila prepares for you per domain — leases, levies, maintenance — within your corporate authority matrix; every action lands for one-tap approval.',
      },
      {
        n: '03',
        title: 'Receive the daily brief',
        body: 'Each morning at 06:00: the exception list, the levy calendar, portfolio analytics, and the three decisions only a CFO can make.',
      },
    ],
    problemKicker: 'The enterprise tax',
    problemHeading: 'Real-estate cost lives in spreadsheets,',
    problemHeadingAccent: 'not your ERP',
    problemSub:
      'Most enterprise ERPs treat real estate as a cost line, not a portfolio. The result is invisible leakage that compounds quarter over quarter.',
    problemTitle: 'Without BossNyumba',
    problems: [
      {
        title: 'Lease drift',
        desc: 'Renewal options lapse silently. Rent escalations miss the index date. Your real cost is higher than your finance team thinks.',
      },
      {
        title: 'Levy slippage',
        desc: 'Council, property tax, utilities — each lands in a different inbox. Late fees compound and nobody is accountable.',
      },
      {
        title: 'Utilities black box',
        desc: 'Branch utilities are billed by the meter, paid by petty cash, and reconciled by nobody. Leakage is structural.',
      },
      {
        title: 'No portfolio view',
        desc: 'Treasury cannot tell which branch is profitable, which is a millstone, which is breaking even.',
      },
    ],
    solutionTitle: 'With BossNyumba',
    solutions: [
      {
        title: 'Lease watchtower',
        desc: 'Every renewal option, every escalation, every break clause surfaced 90 days before the trigger date.',
      },
      {
        title: 'Single levy desk',
        desc: 'Every council, every tax authority, every utility, every cadence surfaced in one place; Mr. Mwikila prepares each filing for your one-tap approval.',
      },
      {
        title: 'Utilities reconciliation',
        desc: 'Meter reads ingested, bills validated, anomalies surfaced — water, electricity, and gas tracked and reconciled per site.',
      },
      {
        title: 'Portfolio analytics',
        desc: 'Occupancy, revenue, and expense analytics per branch and per region. Exportable into your enterprise BI in any currency.',
      },
    ],
    ctaHeading: 'Run the portfolio you already own.',
    ctaSub:
      'Book a 30-minute enterprise demo. We will stand up the ledger, utilities reconciliation, and analytics on a sample of your sites and surface the leakage you cannot currently see.',
    ctaPrimary: 'Book an enterprise demo',
  },

  governmentEntity: {
    heroKicker: 'For government and parastatal entities',
    heroHeadline: 'Public property,',
    heroHeadlineAccent: 'public-trust ledger',
    heroSub:
      'Mr. Mwikila gives parastatals, ministries, and regional government entities a transparent, auditable operating system for their property estate. Every levy collected, every lease recorded, every vendor paid lands on a hash-chained, regulator-exportable ledger.',
    heroPrimaryCta: 'Book a government demo',
    heroSecondaryCta: 'See the public ledger',
    trustline: [
      'Hash-chained, audit-exportable',
      'Sovereign data residency',
      'Auditor-ready by default',
    ],
    statsHeading: 'Public property deserves public-grade tools.',
    statsSub:
      'Government property estates lose value through opaque ledgers, lapsed leases, and uncollected levies. Mr. Mwikila installs the transparency the public expects without the political cost of a manual audit.',
    stats: [
      {
        value: '100%',
        label: 'Audit coverage',
        sub: 'Every action hash-chained, append-only, exportable to the Controller and Auditor General offline.',
      },
      {
        value: 'Daily',
        label: 'Public ledger',
        sub: 'Anonymised summary statistics on revenue, occupancy, and arrears available to citizens on demand.',
      },
      {
        value: 'Zero',
        label: 'Manual handover risk',
        sub: 'When the director rotates, the institutional memory rotates with the system, not with the person.',
      },
    ],
    stepsKicker: 'How it works',
    stepsHeading: 'Mandate. Map. Operate.',
    steps: [
      {
        n: '01',
        title: 'Mandate',
        body: 'Your principal secretary signs the public-trust mandate. Mr. Mwikila operates inside the bounds of the mandate, never beyond.',
      },
      {
        n: '02',
        title: 'Map every asset',
        body: 'Bring your existing estate records. Reconcile leases, levies, encumbrances, and dispute status into one knowledge graph.',
      },
      {
        n: '03',
        title: 'Operate with audit chain',
        body: 'Every collection, every disbursement, every decision hash-chained. The Controller and Auditor General reads the chain, not your filing cabinet.',
      },
    ],
    problemKicker: 'The public-sector tax',
    problemHeading: 'Opaque ledgers,',
    problemHeadingAccent: 'lost revenue',
    problemSub:
      'Government property estates carry the largest balance-sheet exposure in any economy and the weakest tooling. Mr. Mwikila closes the gap without political cost.',
    problemTitle: 'Without BossNyumba',
    problems: [
      {
        title: 'Lapsed government leases',
        desc: 'Public-sector leases lapse because no one is tracking renewal dates in the same place as rent collection.',
      },
      {
        title: 'Uncollected ground rent',
        desc: 'Ground-rent files sit in cabinets. Collection runs ad hoc. Citizens pay irregularly; nobody chases consistently.',
      },
      {
        title: 'Audit findings stack',
        desc: 'Every cycle, the Auditor General finds the same gaps. Remediation never sticks because there is no real-time system.',
      },
      {
        title: 'Director rotation risk',
        desc: 'When the head of property estate rotates, institutional memory walks out with them. Successor starts from zero.',
      },
    ],
    solutionTitle: 'With BossNyumba',
    solutions: [
      {
        title: 'Lease auto-pilot',
        desc: 'Renewal options, escalations, ground-rent payments surfaced 90 days early. Mr. Mwikila drafts the renewal pack itself.',
      },
      {
        title: 'Citizen-pay rails',
        desc: 'Ground rent collectible on M-Pesa, Tigo Pesa, Airtel Money, or bank. Receipt issued in seconds, hash-chained on the public ledger.',
      },
      {
        title: 'Audit chain by default',
        desc: 'Every action append-only and signed. Auditor General reads the chain, not the filing cabinet.',
      },
      {
        title: 'Continuity through rotation',
        desc: 'Institutional memory lives in the system. Successor lands on day one with a full estate brief, ready to act.',
      },
    ],
    ctaHeading: 'Run the public estate, in public.',
    ctaSub:
      'Book a 30-minute briefing with our public-sector lead. We will walk through the audit chain, the citizen-pay rails, and the public-ledger dashboard.',
    ctaPrimary: 'Book a government demo',
  },

  reit: {
    heroKicker: 'For REITs and property funds',
    heroHeadline: "The world's first AI Estate-Management Partner",
    heroHeadlineAccent: 'for institutional real estate',
    heroSub:
      'Mr. Mwikila is the operating system Real Estate Investment Trusts and institutional property funds run their estate on. An immutable double-entry ledger, unitholder-grade audit chains, portfolio analytics, audit-ready compliance exports, and an AI Chief of Staff that briefs the fund manager every morning.',
    heroPrimaryCta: 'Book a fund-manager demo',
    heroSecondaryCta: 'See the fund cockpit',
    trustline: ['Unitholder-grade audit chain', 'Portfolio analytics', 'Compliance exports'],
    statsHeading: 'Run the fund on one ledger.',
    statsSub:
      'REITs and property funds run on quarterly reporting cycles that hide intra-quarter risk. Mr. Mwikila keeps every asset on one immutable ledger so the picture is always current, without adding a single FTE.',
    stats: [
      {
        value: 'Immutable',
        label: 'Double-entry ledger',
        sub: 'Every rent receipt, disbursement, and capex booked, balanced, and append-only.',
      },
      {
        value: 'Analytics',
        label: 'Per-region',
        sub: 'Occupancy, revenue, and expense analytics per region and fund vehicle, exportable to your custodian.',
      },
      {
        value: 'Export',
        label: 'Audit-ready',
        sub: 'Hash-chained, append-only compliance exports that satisfy external auditors and unitholders.',
      },
    ],
    stepsKicker: 'How it works',
    stepsHeading: 'Bring the fund. Set the autonomy. Run the books.',
    steps: [
      {
        n: '01',
        title: 'Map the fund',
        body: 'Add your fund vehicles, sub-funds, and SPVs. Mr. Mwikila organises every asset under one fund view.',
      },
      {
        n: '02',
        title: 'Wire every asset',
        body: 'Collect rent over M-Pesa with one-tap tenant approval; every receipt, disbursement, and capex commitment books to one double-entry ledger.',
      },
      {
        n: '03',
        title: 'Daily fund manager brief',
        body: 'Each morning: portfolio analytics, the exception list, an on-demand refinancing report for covenant stress tests, and the three decisions only the fund manager can make.',
      },
    ],
    problemKicker: 'The institutional tax',
    problemHeading: 'Quarterly reporting hides',
    problemHeadingAccent: 'intra-quarter risk',
    problemSub:
      "Most REITs and property funds run on a 90-day reporting cycle. The risk that builds inside the cycle is invisible until it is the next quarter's problem.",
    problemTitle: 'Without BossNyumba',
    problems: [
      {
        title: 'Stale books',
        desc: 'Quarterly close means unitholders trade on a three-month-old picture. Bid-ask spreads widen.',
      },
      {
        title: 'Covenant blindness',
        desc: 'DSCR is computed once a quarter. By the time you breach, you breach by months.',
      },
      {
        title: 'Fragile audit trail',
        desc: 'Each SPV reports separately, in spreadsheets that do not survive a handover or an external audit.',
      },
      {
        title: 'Lessor opacity',
        desc: 'Tenants pay on different rails and cycles. Reconciliation is a multi-week exercise.',
      },
    ],
    solutionTitle: 'With BossNyumba',
    solutions: [
      {
        title: 'One immutable ledger',
        desc: 'Every asset, every unit, every fund vehicle on one append-only double-entry ledger, exportable to your custodian.',
      },
      {
        title: 'On-demand covenant test',
        desc: 'Pull a refinancing report with DSCR, LTV, and ICR stress tests whenever you need it — at review, not once a quarter.',
      },
      {
        title: 'Audit-ready exports',
        desc: 'Every sub-fund and SPV exportable as a hash-chained, append-only compliance pack with the audit chain attached.',
      },
      {
        title: 'Tenant rail reconciliation',
        desc: 'M-Pesa and bank receipts reconciled into one tenant ledger via webhook callbacks — booked, balanced, traceable.',
      },
    ],
    ctaHeading: 'One fund. One brief. One ledger.',
    ctaSub:
      'Book a 45-minute fund-manager demo. We will stand up the ledger, analytics, and audit-ready exports on a sample of your portfolio.',
    ctaPrimary: 'Book a fund-manager demo',
  },

  embassyNgo: {
    heroKicker: 'For diplomatic missions and NGOs',
    heroHeadline: 'One estate, every',
    heroHeadlineAccent: 'capital',
    heroSub:
      'Mr. Mwikila runs the property estate of diplomatic missions, international NGOs, and donor agencies across multiple capitals. A donor-audit-ready double-entry ledger, jurisdiction-aware compliance, audit-ready exports, and a single advisor across every residence, office, and field outpost.',
    heroPrimaryCta: 'Book a mission demo',
    heroSecondaryCta: 'See the mission cockpit',
    trustline: ['Donor-audit-ready ledger', 'Per-jurisdiction compliance', 'Audit-ready exports'],
    statsHeading: 'Built for the mission that spans capitals.',
    statsSub:
      "Diplomatic missions and international NGOs run property estates across multiple jurisdictions on inherited spreadsheets. Mr. Mwikila puts every outpost on one audit-ready ledger without imposing one country's rules on another.",
    stats: [
      {
        value: 'One ledger',
        label: 'Every outpost',
        sub: 'One double-entry ledger across every residence, office, and outpost, exportable in any currency.',
      },
      {
        value: 'Donor-grade',
        label: 'Audit chain',
        sub: "Every disbursement hash-chained and ready for the donor's external auditor.",
      },
      {
        value: 'Per jurisdiction',
        label: 'Compliance',
        sub: 'Local lease law, local tax regime, local utility quirks — handled per outpost.',
      },
    ],
    stepsKicker: 'How it works',
    stepsHeading: 'Map every capital. Set the policy. Mr. Mwikila operates.',
    steps: [
      {
        n: '01',
        title: 'Map every capital',
        body: 'Add the mission estate: chancery, residences, outposts, field offices. Mr. Mwikila ingests the local lease, levy, and utility rules per capital.',
      },
      {
        n: '02',
        title: 'Set the donor policy',
        body: 'Configure the donor-audit cadence and disbursement authority matrix. Every action stays inside donor-approved bounds.',
      },
      {
        n: '03',
        title: 'Receive the head-of-mission brief',
        body: 'Each morning: per-capital cost, exception list, donor-audit cadence, and the three decisions only the head of mission can make.',
      },
    ],
    problemKicker: 'The mission tax',
    problemHeading: 'Inherited spreadsheets,',
    problemHeadingAccent: 'opaque ledgers',
    problemSub:
      'Missions and NGOs run on institutional memory that rotates every 2-4 years. Mr. Mwikila externalises that memory so the successor lands on day one with the full estate brief.',
    problemTitle: 'Without BossNyumba',
    problems: [
      {
        title: 'Rotating institutional memory',
        desc: 'Each tour leaves the estate slightly worse documented than they found it. Successor starts from inherited folders.',
      },
      {
        title: 'Donor-audit panic',
        desc: 'Annual donor audits consume the finance officer for weeks. Findings rarely close before the next cycle.',
      },
      {
        title: 'Multi-jurisdiction drift',
        desc: 'Each capital plays by local rules, on local rails. The mission cannot tell which outpost is healthy.',
      },
      {
        title: 'Lessor disputes',
        desc: 'Lease renewals negotiated under time pressure. Landlords exploit the diplomatic timeline.',
      },
    ],
    solutionTitle: 'With BossNyumba',
    solutions: [
      {
        title: 'Institutional memory by default',
        desc: 'Every lease, levy, dispute, and decision lives in the system. Successor lands with a full estate brief.',
      },
      {
        title: 'Donor audit chain',
        desc: 'Every disbursement hash-chained, append-only, exportable to the donor auditor offline.',
      },
      {
        title: 'Per-jurisdiction compliance',
        desc: "Local lease law, local tax regime, local utility quirks handled per outpost without imposing one country's rules on another.",
      },
      {
        title: 'Lessor playbook',
        desc: 'Mr. Mwikila knows your renewal calendar, your fallback options, and your market comparables. Negotiations start from strength.',
      },
    ],
    ctaHeading: 'Run the mission estate, properly.',
    ctaSub:
      'Book a 30-minute mission demo. We will walk through the donor audit chain, the per-jurisdiction ledger, and the head-of-mission brief.',
    ctaPrimary: 'Book a mission demo',
  },

  institutionalLandlord: {
    heroKicker: 'For universities and hospitals',
    heroHeadline: 'Run the campus',
    heroHeadlineAccent: 'as one estate',
    heroSub:
      'Mr. Mwikila is the operating system for universities, university colleges, hospitals, and teaching-hospital systems that hold large institutional property estates. An immutable double-entry ledger, donor-grade audit chain, portfolio analytics per building, maintenance triage, and a vice-chancellor brief that lands at 06:00 every morning.',
    heroPrimaryCta: 'Book a vice-chancellor demo',
    heroSecondaryCta: 'See the campus cockpit',
    trustline: ['Per-building analytics', 'Donor + grant audit-ready', 'Maintenance triage'],
    statsHeading: 'Built for the institution that owns its city block.',
    statsSub:
      'Universities and hospitals are among the largest property owners in any city and the worst-tooled. Mr. Mwikila gives the vice-chancellor and the hospital director a single estate brief without imposing new processes on faculty.',
    stats: [
      {
        value: 'Per building',
        label: 'Analytics',
        sub: 'Occupancy, revenue, and expense analytics per residence hall, teaching block, and outpost clinic.',
      },
      {
        value: 'Triage',
        label: 'Maintenance',
        sub: 'Faculty staff photograph issues; Mr. Mwikila proposes the right trade and work order for sign-off.',
      },
      {
        value: 'Donor-grade',
        label: 'Audit',
        sub: 'Every disbursement hash-chained and ready for the donor or grant auditor.',
      },
    ],
    stepsKicker: 'How it works',
    stepsHeading: 'Map the campus. Route the maintenance. Brief the principal.',
    steps: [
      {
        n: '01',
        title: 'Map every building',
        body: 'Add your estate: faculties, residences, clinics, outposts. Mr. Mwikila reconciles ownership, leases, and donor restrictions per building.',
      },
      {
        n: '02',
        title: 'Triage maintenance',
        body: 'Faculty staff photograph issues. Mr. Mwikila proposes the right trade and the work order; you approve, then sign off on completion with a photo.',
      },
      {
        n: '03',
        title: 'Daily principal brief',
        body: 'Each morning: campus-wide analytics, exception list, donor-audit cadence, and the three decisions only the vice-chancellor or hospital director can make.',
      },
    ],
    problemKicker: 'The institution tax',
    problemHeading: 'Departmental silos,',
    problemHeadingAccent: 'campus-wide blindness',
    problemSub:
      'Universities and hospitals run their property estate on departmental silos. The estate director cannot tell which building is profitable, which is a millstone, which is breaking even.',
    problemTitle: 'Without BossNyumba',
    problems: [
      {
        title: 'Departmental sprawl',
        desc: 'Each faculty, each clinic, each residence hall keeps its own books. Pulling one estate-wide view costs weeks every term.',
      },
      {
        title: 'Maintenance backlog',
        desc: 'Tickets pile up on faculty admin. The leaking lab is fixed three weeks late. The boiler is replaced reactively, not proactively.',
      },
      {
        title: 'Donor restriction drift',
        desc: 'A building was donated for nursing instruction. Twelve years later, the philosophy department occupies it. Donor relations fray.',
      },
      {
        title: 'Grant-audit panic',
        desc: "Annual grant audits consume the bursar's office for weeks. Findings rarely close before the next cycle.",
      },
    ],
    solutionTitle: 'With BossNyumba',
    solutions: [
      {
        title: 'Single campus cockpit',
        desc: "Every faculty, every residence, every clinic — one screen, real-time, with analytics exportable into the institution's ERP.",
      },
      {
        title: 'Maintenance triage',
        desc: 'Faculty staff photograph issues. Mr. Mwikila proposes the right trade and work order for your approval, then records sign-off on completion.',
      },
      {
        title: 'Donor restriction tags',
        desc: 'Every building tagged with donor restrictions. Mr. Mwikila warns the estate director before any usage drift.',
      },
      {
        title: 'Grant-audit chain',
        desc: 'Every grant-funded disbursement hash-chained and exportable to the grant auditor offline.',
      },
    ],
    ctaHeading: 'Run the campus as one estate.',
    ctaSub:
      'Book a 45-minute vice-chancellor demo. We will walk through the campus cockpit, the maintenance triage, and the donor restriction tags.',
    ctaPrimary: 'Book a vice-chancellor demo',
  },

  religiousOrganization: {
    heroKicker: 'For religious organisations',
    heroHeadline: "Steward your congregation's estate",
    heroHeadlineAccent: 'with public-trust transparency',
    heroSub:
      'Mr. Mwikila runs the property estate of mosques, churches, temples, and dioceses. Congregation-transparent dues ledger, AGM-ready trustee statements, faith-aligned governance, and hash-chained provenance on every disbursement.',
    heroPrimaryCta: 'Apply for the steward tier',
    heroSecondaryCta: 'See the trustee dashboard',
    trustline: [
      '30% steward discount',
      'Congregation-transparent ledger',
      'Trustee-ready AGM statements',
    ],
    statsHeading: 'Faith communities deserve faith-grade tools.',
    statsSub:
      'Religious organisations hold significant property estates and the lowest tooling budget. Mr. Mwikila gives the trustees the transparency the congregation expects without imposing commercial accounting jargon.',
    stats: [
      {
        value: '30%',
        label: 'Steward discount',
        sub: 'Off every tier for registered places of worship and faith-based organisations.',
      },
      {
        value: 'Public',
        label: 'Dues ledger',
        sub: 'Every congregation member can see what was given and what was spent.',
      },
      {
        value: 'AGM-ready',
        label: 'Trustee statement',
        sub: 'Annual general meeting deck regenerates from live data in one click.',
      },
    ],
    stepsKicker: 'How it works',
    stepsHeading: 'Register the trust. Open the ledger. Steward in public.',
    steps: [
      {
        n: '01',
        title: 'Register the trust',
        body: 'Upload your faith-based registration certificate and trustee roster. Mr. Mwikila mints the trust ledger, dues schedule, and governance rules.',
      },
      {
        n: '02',
        title: 'Open the dues ledger',
        body: 'Tithes, offerings, and dues paid over M-Pesa or bank. Every payment lands in the public ledger; every member sees who gave and what was spent.',
      },
      {
        n: '03',
        title: 'Steward the AGM',
        body: 'Trustee statements, audited financials, minutes, attendance — all hash-chained and exportable to the registrar.',
      },
    ],
    problemKicker: 'The faith-community gap',
    problemHeading: 'Cash offerings,',
    problemHeadingAccent: 'opaque trusts',
    problemSub:
      'Faith communities run on trust, but trust without transparency breaks across leadership transitions. Mr. Mwikila installs the transparency the congregation expects without imposing commercial accounting jargon.',
    problemTitle: 'Without BossNyumba',
    problems: [
      {
        title: 'Cash-offering opacity',
        desc: 'Cash given at service has no record. Trustees and treasurers carry institutional risk personally.',
      },
      {
        title: 'Property-disposal disputes',
        desc: 'A diocese sells a parish hall; the congregation discovers it after the fact. Trust erodes.',
      },
      {
        title: 'AGM minutes drift',
        desc: "Last year's motions disappear. The new chair has no institutional memory.",
      },
      {
        title: 'Vendor disputes',
        desc: 'The mosque paid a contractor for repairs that were never completed. No contract, no escrow, no recourse.',
      },
    ],
    solutionTitle: 'With BossNyumba',
    solutions: [
      {
        title: 'Digital tithe rails',
        desc: 'M-Pesa tithe channels with one-tap giver approval. Every gift receipted to the double-entry ledger, hash-chained, member-visible.',
      },
      {
        title: 'Transparent disposal',
        desc: 'Any property disposal triggers a congregation-notification + trustee sign-off workflow. No silent sales.',
      },
      {
        title: 'AGM-ready records',
        desc: 'Minutes, attendance, and audited financials — all hash-chained and exportable to the registrar.',
      },
      {
        title: 'Milestoned vendor pay',
        desc: 'Vendor work milestoned; trustee approves each milestone before Mr. Mwikila books the payment to the ledger — every cent traceable.',
      },
    ],
    ctaHeading: 'Steward in public.',
    ctaSub:
      'Apply for the steward tier. Registered places of worship and faith-based organisations get 30% off every tier. Email steward@bossnyumba.co.tz from your registered domain.',
    ctaPrimary: 'Apply',
  },

  cooperativeSacco: {
    heroKicker: 'For SACCOs and cooperatives',
    heroHeadline: 'Member-owned property,',
    heroHeadlineAccent: 'member-visible ledger',
    heroSub:
      'Mr. Mwikila runs the property estate of SACCOs, cooperative societies, and member-investment groups. Member-transparent dues ledger, transparent member allocations, registrar-ready AGM filings, and one-tap statements that satisfy both members and the cooperative registrar.',
    heroPrimaryCta: 'Apply for the cooperative tier',
    heroSecondaryCta: 'See the SACCO cockpit',
    trustline: ['30% cooperative discount', 'Registrar-ready filings', 'Member-visible ledger'],
    statsHeading: 'Member-owned. Member-visible. Member-trusted.',
    statsSub:
      'SACCOs and cooperatives fail when transparency fails. Mr. Mwikila enforces transparency by default — every member sees the same numbers, every registrar reads the same filing.',
    stats: [
      {
        value: '30%',
        label: 'Cooperative discount',
        sub: 'Off every tier for registered SACCOs and cooperative societies.',
      },
      {
        value: 'Public',
        label: 'Dues ledger',
        sub: 'Every member sees every contribution and every disbursement.',
      },
      {
        value: '1-tap',
        label: 'Registrar pack',
        sub: 'Annual statement assembled in the format the cooperative registrar accepts, for you to submit.',
      },
    ],
    stepsKicker: 'How it works',
    stepsHeading: 'Register. Enrol members. Operate in public.',
    steps: [
      {
        n: '01',
        title: 'Register the cooperative',
        body: 'Upload the cooperative certificate and member roster. Mr. Mwikila mints the dues schedule, allocation rules, and governance graph.',
      },
      {
        n: '02',
        title: 'Enrol members',
        body: 'Members pay shares and dues over M-Pesa or bank. Every contribution receipted, hash-chained, member-visible.',
      },
      {
        n: '03',
        title: 'AGM + filings',
        body: 'Annual general meeting in-app: minutes, attendance, audited statement. Registrar-ready pack in one tap, in the format they accept, for you to submit.',
      },
    ],
    problemKicker: 'The cooperative gap',
    problemHeading: 'Opaque dues,',
    problemHeadingAccent: 'political allocations',
    problemSub:
      "Cooperatives die when transparency dies. Mr. Mwikila enforces transparency by default so the cooperative survives leadership transitions and grows beyond a single chair's patronage network.",
    problemTitle: 'Without BossNyumba',
    problems: [
      {
        title: 'Dues opacity',
        desc: 'Members do not know who paid and who owes. Treasurer carries institutional risk personally.',
      },
      {
        title: 'Political allocations',
        desc: "Vacant units or member benefits go to the chair's friend. Members complain in vain.",
      },
      {
        title: 'AGM drift',
        desc: "Last year's motions disappear. New chair starts from a blank slate.",
      },
      {
        title: 'Registrar friction',
        desc: 'Annual registrar filing turns into a multi-month accounting exercise that distracts from member service.',
      },
    ],
    solutionTitle: 'With BossNyumba',
    solutions: [
      {
        title: 'Live dues ledger',
        desc: 'Every member sees every contribution, every disbursement, and the cooperative bank balance — live.',
      },
      {
        title: 'Transparent allocation',
        desc: 'Vacant units or member benefits allocated on transparent rules and booked through the double-entry ledger — every cent traceable.',
      },
      {
        title: 'AGM-ready records',
        desc: 'Minutes, attendance, and the audited statement — all hash-chained and audit-ready.',
      },
      {
        title: 'Registrar-ready pack',
        desc: 'Annual statement assembled in the format the cooperative registrar accepts, in one tap, for you to submit.',
      },
    ],
    ctaHeading: 'Member-owned property, member-visible ledger.',
    ctaSub:
      'Apply for the cooperative tier. Registered SACCOs and cooperative societies get 30% off every tier. Email cooperative@bossnyumba.co.tz from your registered domain.',
    ctaPrimary: 'Apply',
  },
} as const satisfies Record<string, AudiencePageCopy>;
