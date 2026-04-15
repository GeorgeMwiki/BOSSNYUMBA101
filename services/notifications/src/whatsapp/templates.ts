/**
 * WhatsApp Message Templates for BOSSNYUMBA
 * Bilingual templates in English and Swahili
 * WhatsApp-approved formats with interactive buttons and lists
 */

import type { SupportedLanguage, InteractiveButton, InteractiveSection } from './types.js';

// ============================================================================
// Template Interface
// ============================================================================

export interface MessageTemplate {
  en: string;
  sw: string;
}

export interface InteractiveTemplate {
  en: {
    body: string;
    header?: string;
    footer?: string;
    buttons?: InteractiveButton[];
    sections?: InteractiveSection[];
  };
  sw: {
    body: string;
    header?: string;
    footer?: string;
    buttons?: InteractiveButton[];
    sections?: InteractiveSection[];
  };
}

// ============================================================================
// Onboarding Templates (Module A)
// ============================================================================

export const ONBOARDING_TEMPLATES = {
  welcome: {
    en: `🏠 *Karibu! Welcome to {{propertyName}}!*

I'm Boss Nyumba, your AI property assistant. I'll help you settle in smoothly.

Let's get you set up! First, what language do you prefer?`,
    sw: `🏠 *Karibu! Karibu {{propertyName}}!*

Mimi ni Boss Nyumba, msaidizi wako wa AI wa mali. Nitakusaidia kuishi vizuri.

Tufanye usajili! Kwanza, unapendelea lugha gani?`,
  } satisfies MessageTemplate,

  languageSelection: {
    en: {
      body: 'Please select your preferred language:',
      buttons: [
        { id: 'lang_en', title: 'English' },
        { id: 'lang_sw', title: 'Kiswahili' },
      ],
    },
    sw: {
      body: 'Tafadhali chagua lugha unayopendelea:',
      buttons: [
        { id: 'lang_en', title: 'English' },
        { id: 'lang_sw', title: 'Kiswahili' },
      ],
    },
  } satisfies InteractiveTemplate,

  moveInDateRequest: {
    en: `Great! Now, when are you planning to move in?

Please reply with your move-in date in this format:
📅 DD/MM/YYYY (e.g., 15/03/2026)`,
    sw: `Vizuri! Sasa, unapanga kuhamia lini?

Tafadhali jibu na tarehe yako ya kuhamia kwa muundo huu:
📅 DD/MM/YYYY (mfano, 15/03/2026)`,
  } satisfies MessageTemplate,

  occupantsRequest: {
    en: `Thanks! Your move-in date is confirmed: {{moveInDate}}

How many people will be living in the unit (including yourself)?`,
    sw: `Asante! Tarehe yako ya kuhamia imethibitishwa: {{moveInDate}}

Watu wangapi wataishi katika nyumba (pamoja nawe)?`,
  } satisfies MessageTemplate,

  occupantsButtons: {
    en: {
      body: 'Select the number of occupants:',
      buttons: [
        { id: 'occupants_1', title: '1 Person' },
        { id: 'occupants_2', title: '2 People' },
        { id: 'occupants_3_plus', title: '3 or More' },
      ],
    },
    sw: {
      body: 'Chagua idadi ya wakaaji:',
      buttons: [
        { id: 'occupants_1', title: 'Mtu 1' },
        { id: 'occupants_2', title: 'Watu 2' },
        { id: 'occupants_3_plus', title: '3 au zaidi' },
      ],
    },
  } satisfies InteractiveTemplate,

  emergencyContactRequest: {
    en: `Perfect! {{occupants}} occupant(s) noted.

For safety purposes, please provide an emergency contact:
📞 Name and phone number

Example: "John Doe, 0712345678"`,
    sw: `Vyema! Wakaaji {{occupants}} wameandikwa.

Kwa usalama, tafadhali toa mtu wa kuwasiliana naye wakati wa dharura:
📞 Jina na nambari ya simu

Mfano: "John Doe, 0712345678"`,
  } satisfies MessageTemplate,

  confirmationSummary: {
    en: `*Excellent! Let me confirm your details:*

🏠 Property: {{propertyName}}
🚪 Unit: {{unitNumber}}
📅 Move-in: {{moveInDate}}
👥 Occupants: {{occupants}}
📞 Emergency Contact: {{emergencyContact}}

Is this information correct?`,
    sw: `*Bora! Niruhusu nithibitishe maelezo yako:*

🏠 Mali: {{propertyName}}
🚪 Nyumba: {{unitNumber}}
📅 Kuhamia: {{moveInDate}}
👥 Wakaaji: {{occupants}}
📞 Mtu wa Dharura: {{emergencyContact}}

Maelezo haya ni sahihi?`,
  } satisfies MessageTemplate,

  confirmationButtons: {
    en: {
      body: 'Please confirm your details are correct:',
      buttons: [
        { id: 'confirm_yes', title: '✅ Yes, Correct' },
        { id: 'confirm_no', title: '❌ No, Edit' },
      ],
    },
    sw: {
      body: 'Tafadhali thibitisha maelezo yako ni sahihi:',
      buttons: [
        { id: 'confirm_yes', title: '✅ Ndiyo, Sahihi' },
        { id: 'confirm_no', title: '❌ Hapana, Hariri' },
      ],
    },
  } satisfies InteractiveTemplate,

  onboardingComplete: {
    en: `🎉 *Welcome aboard, {{tenantName}}!*

Your onboarding is complete. Here's what happens next:

1️⃣ You'll receive your Welcome Pack shortly
2️⃣ We'll schedule your move-in inspection
3️⃣ I'll check in with you on Day 3 and Day 10

Need help anytime? Just message me!

*Quick Commands:*
• Type "maintenance" for repairs
• Type "rent" for payment info
• Type "emergency" for urgent issues`,
    sw: `🎉 *Karibu kwenye bodi, {{tenantName}}!*

Usajili wako umekamilika. Nini kinafuata:

1️⃣ Utapokea Pakiti yako ya Karibu hivi karibuni
2️⃣ Tutapanga ukaguzi wako wa kuhamia
3️⃣ Nitakuangalia Siku ya 3 na Siku ya 10

Unahitaji msaada wakati wowote? Nitumie ujumbe tu!

*Amri za Haraka:*
• Andika "matengenezo" kwa ukarabati
• Andika "kodi" kwa maelezo ya malipo
• Andika "dharura" kwa masuala ya haraka`,
  } satisfies MessageTemplate,
} as const;

// ============================================================================
// Maintenance Templates (Module F)
// ============================================================================

export const MAINTENANCE_TEMPLATES = {
  intakePrompt: {
    en: `🔧 *Maintenance Request*

I'll help you report a maintenance issue. What type of problem are you experiencing?`,
    sw: `🔧 *Ombi la Matengenezo*

Nitakusaidia kuripoti tatizo la matengenezo. Tatizo la aina gani unalopitia?`,
  } satisfies MessageTemplate,

  issueTypeList: {
    en: {
      body: 'Select the type of issue:',
      header: '🔧 Maintenance Categories',
      sections: [
        {
          title: 'Plumbing & Water',
          rows: [
            { id: 'issue_plumbing_leak', title: '💧 Leaking Pipe/Tap', description: 'Water leaks from pipes or faucets' },
            { id: 'issue_plumbing_blocked', title: '🚽 Blocked Drain/Toilet', description: 'Drainage or toilet issues' },
            { id: 'issue_plumbing_nowater', title: '🚫 No Water', description: 'No water supply' },
          ],
        },
        {
          title: 'Electrical',
          rows: [
            { id: 'issue_electrical_nopower', title: '💡 No Power', description: 'Electricity not working' },
            { id: 'issue_electrical_socket', title: '🔌 Faulty Socket/Switch', description: 'Outlet or switch problems' },
            { id: 'issue_electrical_sparks', title: '⚡ Sparks/Burning Smell', description: 'URGENT - Electrical hazard' },
          ],
        },
        {
          title: 'Structural & Other',
          rows: [
            { id: 'issue_door_lock', title: '🚪 Door/Lock Issue', description: 'Door or lock problems' },
            { id: 'issue_window', title: '🪟 Window Problem', description: 'Broken or stuck window' },
            { id: 'issue_other', title: '📝 Other Issue', description: 'Something else' },
          ],
        },
      ],
    },
    sw: {
      body: 'Chagua aina ya tatizo:',
      header: '🔧 Makundi ya Matengenezo',
      sections: [
        {
          title: 'Mabomba & Maji',
          rows: [
            { id: 'issue_plumbing_leak', title: '💧 Bomba/Mfereji Unavuja', description: 'Maji yanavuja kutoka mabomba' },
            { id: 'issue_plumbing_blocked', title: '🚽 Mfereji Umeziba', description: 'Matatizo ya mfereji au choo' },
            { id: 'issue_plumbing_nowater', title: '🚫 Hakuna Maji', description: 'Hakuna ugavi wa maji' },
          ],
        },
        {
          title: 'Umeme',
          rows: [
            { id: 'issue_electrical_nopower', title: '💡 Hakuna Stima', description: 'Umeme haufanyi kazi' },
            { id: 'issue_electrical_socket', title: '🔌 Soketi Mbaya', description: 'Matatizo ya plagi au swichi' },
            { id: 'issue_electrical_sparks', title: '⚡ Moto/Harufu ya Kuungua', description: 'HARAKA - Hatari ya umeme' },
          ],
        },
        {
          title: 'Muundo & Mengine',
          rows: [
            { id: 'issue_door_lock', title: '🚪 Tatizo la Mlango', description: 'Matatizo ya mlango au kufuli' },
            { id: 'issue_window', title: '🪟 Tatizo la Dirisha', description: 'Dirisha limeharibika' },
            { id: 'issue_other', title: '📝 Tatizo Lingine', description: 'Kitu kingine' },
          ],
        },
      ],
    },
  } satisfies InteractiveTemplate,

  locationRequest: {
    en: `Got it! You're reporting: *{{issueType}}*

Where exactly is the problem located? Please describe the specific location.

Example: "Kitchen, under the sink" or "Bathroom, shower area"`,
    sw: `Nimeelewa! Unaripoti: *{{issueType}}*

Tatizo liko wapi hasa? Tafadhali eleza mahali maalum.

Mfano: "Jikoni, chini ya sinki" au "Bafuni, eneo la kuoga"`,
  } satisfies MessageTemplate,

  severityRequest: {
    en: `Location noted: {{location}}

How urgent is this issue?`,
    sw: `Mahali pameandikwa: {{location}}

Tatizo hili lina dharura gani?`,
  } satisfies MessageTemplate,

  severityButtons: {
    en: {
      body: 'Select the urgency level:',
      buttons: [
        { id: 'severity_low', title: '🟢 Can Wait (1-3 days)' },
        { id: 'severity_medium', title: '🟡 Soon (24-48 hrs)' },
        { id: 'severity_high', title: '🔴 Urgent (Same day)' },
      ],
    },
    sw: {
      body: 'Chagua kiwango cha dharura:',
      buttons: [
        { id: 'severity_low', title: '🟢 Inaweza Kungoja' },
        { id: 'severity_medium', title: '🟡 Haraka (24-48 saa)' },
        { id: 'severity_high', title: '🔴 Dharura (Leo)' },
      ],
    },
  } satisfies InteractiveTemplate,

  photoRequest: {
    en: `Thanks! Severity: *{{severity}}*

📸 *Please send a photo or short video of the problem.*

This helps our team understand and prepare for the repair.

You can also send a voice note describing the issue in detail.`,
    sw: `Asante! Dharura: *{{severity}}*

📸 *Tafadhali tuma picha au video fupi ya tatizo.*

Hii inasaidia timu yetu kuelewa na kujiandaa kwa ukarabati.

Unaweza pia kutuma ujumbe wa sauti ukielezea tatizo kwa undani.`,
  } satisfies MessageTemplate,

  skipPhotoOption: {
    en: {
      body: 'Or skip the photo:',
      buttons: [
        { id: 'photo_skip', title: '⏭️ Skip Photo' },
      ],
    },
    sw: {
      body: 'Au ruka picha:',
      buttons: [
        { id: 'photo_skip', title: '⏭️ Ruka Picha' },
      ],
    },
  } satisfies InteractiveTemplate,

  maintenanceConfirmation: {
    en: `✅ *Maintenance Request Submitted!*

📋 *Request Summary:*
• Issue: {{issueType}}
• Location: {{location}}
• Urgency: {{severity}}
• Reference: #{{ticketId}}

*What happens next:*
1️⃣ Our team will review your request
2️⃣ A technician will be assigned
3️⃣ You'll receive appointment details

I'll keep you updated on the progress! 🔔`,
    sw: `✅ *Ombi la Matengenezo Limetumwa!*

📋 *Muhtasari wa Ombi:*
• Tatizo: {{issueType}}
• Mahali: {{location}}
• Dharura: {{severity}}
• Rejea: #{{ticketId}}

*Nini kinafuata:*
1️⃣ Timu yetu itakagua ombi lako
2️⃣ Fundi atakabidhiwa
3️⃣ Utapokea maelezo ya miadi

Nitakuarifu kuhusu maendeleo! 🔔`,
  } satisfies MessageTemplate,

  technicianAssigned: {
    en: `🔧 *Technician Assigned!*

Your maintenance request #{{ticketId}} has been assigned.

👷 Technician: {{technicianName}}
📞 Contact: {{technicianPhone}}
📅 Scheduled: {{appointmentDate}}
🕐 Time: {{appointmentTime}}

The technician will contact you to confirm.`,
    sw: `🔧 *Fundi Amekabidhiwa!*

Ombi lako la matengenezo #{{ticketId}} limekabidhiwa.

👷 Fundi: {{technicianName}}
📞 Mawasiliano: {{technicianPhone}}
📅 Imepangwa: {{appointmentDate}}
🕐 Wakati: {{appointmentTime}}

Fundi atawasiliana nawe kuthibitisha.`,
  } satisfies MessageTemplate,

  workCompleted: {
    en: `✨ *Work Completed!*

Maintenance request #{{ticketId}} has been marked as complete.

📝 Work done: {{workDescription}}

*Was the issue resolved to your satisfaction?*`,
    sw: `✨ *Kazi Imekamilika!*

Ombi la matengenezo #{{ticketId}} limekamilika.

📝 Kazi iliyofanywa: {{workDescription}}

*Tatizo limetatuliwa kuridhisha?*`,
  } satisfies MessageTemplate,

  workCompletedButtons: {
    en: {
      body: 'Rate the repair:',
      buttons: [
        { id: 'repair_satisfied', title: '👍 Yes, Satisfied' },
        { id: 'repair_issue', title: '👎 Still has issues' },
      ],
    },
    sw: {
      body: 'Tathmini ukarabati:',
      buttons: [
        { id: 'repair_satisfied', title: '👍 Ndiyo, Nimeridhika' },
        { id: 'repair_issue', title: '👎 Bado kuna matatizo' },
      ],
    },
  } satisfies InteractiveTemplate,
} as const;

// ============================================================================
// Feedback Templates (Module B)
// ============================================================================

export const FEEDBACK_TEMPLATES = {
  day3Checkin: {
    en: `👋 *Quick Check-in (Day 3)*

Hi {{tenantName}}! How are you settling in at {{propertyName}}?

I'd love to hear how your first few days have been.`,
    sw: `👋 *Ukaguzi wa Haraka (Siku 3)*

Habari {{tenantName}}! Unastarehe vipi {{propertyName}}?

Ningependa kusikia siku zako za kwanza zimekuwaje.`,
  } satisfies MessageTemplate,

  day10Checkin: {
    en: `👋 *10-Day Check-in*

Hi {{tenantName}}! You've been at {{propertyName}} for 10 days now.

How has everything been? Any issues I should know about?`,
    sw: `👋 *Ukaguzi wa Siku 10*

Habari {{tenantName}}! Umekuwa {{propertyName}} kwa siku 10 sasa.

Kila kitu kimekuwaje? Kuna matatizo yoyote niyapaswe kujua?`,
  } satisfies MessageTemplate,

  ratingRequest: {
    en: {
      body: 'How would you rate your experience so far? (1-5 stars)',
      buttons: [
        { id: 'rating_1_2', title: '⭐ 1-2 (Poor)' },
        { id: 'rating_3', title: '⭐⭐⭐ 3 (Okay)' },
        { id: 'rating_4_5', title: '⭐⭐⭐⭐⭐ 4-5 (Great)' },
      ],
    },
    sw: {
      body: 'Ungetathmini uzoefu wako hadi sasa? (nyota 1-5)',
      buttons: [
        { id: 'rating_1_2', title: '⭐ 1-2 (Mbaya)' },
        { id: 'rating_3', title: '⭐⭐⭐ 3 (Sawa)' },
        { id: 'rating_4_5', title: '⭐⭐⭐⭐⭐ 4-5 (Nzuri)' },
      ],
    },
  } satisfies InteractiveTemplate,

  issueCheckList: {
    en: {
      body: 'Are you experiencing any issues with:',
      header: '🔍 Quick Issue Check',
      sections: [
        {
          title: 'Utilities & Services',
          rows: [
            { id: 'issue_water', title: '💧 Water Supply', description: 'Pressure, temperature, availability' },
            { id: 'issue_electricity', title: '💡 Electricity', description: 'Power, outlets, lighting' },
            { id: 'issue_internet', title: '📶 Internet/WiFi', description: 'Connection issues' },
          ],
        },
        {
          title: 'Living Conditions',
          rows: [
            { id: 'issue_noise', title: '🔊 Noise/Neighbors', description: 'Disturbances or noise' },
            { id: 'issue_security', title: '🔐 Security', description: 'Safety concerns' },
            { id: 'issue_cleanliness', title: '🧹 Cleanliness', description: 'Common area cleanliness' },
          ],
        },
        {
          title: 'No Issues',
          rows: [
            { id: 'no_issues', title: '✅ Everything is Great!', description: 'No problems to report' },
          ],
        },
      ],
    },
    sw: {
      body: 'Je, unapitia matatizo yoyote na:',
      header: '🔍 Ukaguzi wa Haraka wa Matatizo',
      sections: [
        {
          title: 'Huduma',
          rows: [
            { id: 'issue_water', title: '💧 Ugavi wa Maji', description: 'Shinikizo, joto, upatikanaji' },
            { id: 'issue_electricity', title: '💡 Umeme', description: 'Stima, plagi, mwanga' },
            { id: 'issue_internet', title: '📶 Mtandao/WiFi', description: 'Matatizo ya muunganisho' },
          ],
        },
        {
          title: 'Hali ya Kuishi',
          rows: [
            { id: 'issue_noise', title: '🔊 Kelele/Majirani', description: 'Usumbufu au kelele' },
            { id: 'issue_security', title: '🔐 Usalama', description: 'Wasiwasi wa usalama' },
            { id: 'issue_cleanliness', title: '🧹 Usafi', description: 'Usafi wa eneo la kawaida' },
          ],
        },
        {
          title: 'Hakuna Matatizo',
          rows: [
            { id: 'no_issues', title: '✅ Kila Kitu ni Sawa!', description: 'Hakuna matatizo ya kuripoti' },
          ],
        },
      ],
    },
  } satisfies InteractiveTemplate,

  additionalComments: {
    en: `Thank you for your feedback!

Would you like to add any additional comments or suggestions? 

Feel free to type your message or send a voice note.

Type "skip" if you have nothing to add.`,
    sw: `Asante kwa maoni yako!

Ungependa kuongeza maoni au mapendekezo yoyote?

Jisikie huru kuandika ujumbe wako au kutuma ujumbe wa sauti.

Andika "ruka" kama huna chochote cha kuongeza.`,
  } satisfies MessageTemplate,

  feedbackThanks: {
    en: `🙏 *Thank you for your feedback!*

Your input helps us improve our services. 

{{followUpMessage}}

Remember, I'm here 24/7 if you need anything!`,
    sw: `🙏 *Asante kwa maoni yako!*

Mchango wako unasaidia kuboresha huduma zetu.

{{followUpMessage}}

Kumbuka, niko hapa 24/7 ukihitaji chochote!`,
  } satisfies MessageTemplate,

  serviceRecovery: {
    en: `I'm sorry to hear you're experiencing issues. 

I've flagged this for immediate attention and our team will reach out within {{responseTime}}.

In the meantime, is there anything urgent I can help with right now?`,
    sw: `Pole kusikia unapitia matatizo.

Nimeweka alama hii kwa umakini wa haraka na timu yetu itawasiliana ndani ya {{responseTime}}.

Wakati huo huo, kuna kitu chochote cha haraka ninaweza kusaidia sasa?`,
  } satisfies MessageTemplate,
} as const;

// ============================================================================
// Rent Reminder Templates (Module D)
// ============================================================================

export const REMINDER_TEMPLATES = {
  rentDueT5: {
    en: `📅 *Friendly Reminder*

Hi {{tenantName}},

Your rent of *{{currency}} {{amount}}* for {{propertyName}} is due in 5 days ({{dueDate}}).

💳 Pay easily via M-Pesa or bank transfer.

Need payment details? Just reply "pay".`,
    sw: `📅 *Kumbusho la Kirafiki*

Habari {{tenantName}},

Kodi yako ya *{{currency}} {{amount}}* kwa {{propertyName}} inatakiwa ndani ya siku 5 ({{dueDate}}).

💳 Lipa kwa urahisi kupitia M-Pesa au uhamisho wa benki.

Unahitaji maelezo ya malipo? Jibu tu "lipa".`,
  } satisfies MessageTemplate,

  rentDueT1: {
    en: `⏰ *Rent Due Tomorrow*

Hi {{tenantName}},

Just a reminder that your rent of *{{currency}} {{amount}}* is due tomorrow, {{dueDate}}.

Please ensure payment is made on time to avoid any late fees.

Reply "pay" for payment options.`,
    sw: `⏰ *Kodi Inatakiwa Kesho*

Habari {{tenantName}},

Kumbusho tu kwamba kodi yako ya *{{currency}} {{amount}}* inatakiwa kesho, {{dueDate}}.

Tafadhali hakikisha malipo yanafanywa kwa wakati kuepuka ada za kuchelewa.

Jibu "lipa" kwa chaguzi za malipo.`,
  } satisfies MessageTemplate,

  rentDueToday: {
    en: `🔔 *Rent Due Today*

Hi {{tenantName}},

Your rent of *{{currency}} {{amount}}* is due today.

Please make your payment to avoid late fees.

Already paid? Reply "paid" with your transaction reference.`,
    sw: `🔔 *Kodi Inatakiwa Leo*

Habari {{tenantName}},

Kodi yako ya *{{currency}} {{amount}}* inatakiwa leo.

Tafadhali fanya malipo yako kuepuka ada za kuchelewa.

Umeshalipa? Jibu "nimelipa" na rejea yako ya muamala.`,
  } satisfies MessageTemplate,

  rentOverdueT3: {
    en: `⚠️ *Payment Overdue (3 Days)*

Hi {{tenantName}},

Your rent payment of *{{currency}} {{amount}}* is now 3 days overdue.

Please settle this immediately to avoid additional charges.

Having difficulty? Reply "help" to discuss payment options.`,
    sw: `⚠️ *Malipo Yamechelewa (Siku 3)*

Habari {{tenantName}},

Malipo yako ya kodi ya *{{currency}} {{amount}}* sasa yamechelewa siku 3.

Tafadhali kamilisha hii mara moja kuepuka gharama za ziada.

Una ugumu? Jibu "msaada" kujadili chaguzi za malipo.`,
  } satisfies MessageTemplate,

  rentOverdueT7: {
    en: `🚨 *Urgent: Payment Required*

Hi {{tenantName}},

Your rent of *{{currency}} {{amount}}* is now 7 days overdue.

This is our final reminder before escalation. Please contact us immediately.

Reply "call me" to schedule a call with our team.`,
    sw: `🚨 *Haraka: Malipo Yanahitajika*

Habari {{tenantName}},

Kodi yako ya *{{currency}} {{amount}}* sasa imechelewa siku 7.

Hii ni kumbusho letu la mwisho kabla ya kuongeza. Tafadhali wasiliana nasi mara moja.

Jibu "nipigie" kupanga simu na timu yetu.`,
  } satisfies MessageTemplate,

  paymentReceived: {
    en: `✅ *Payment Received!*

Thank you, {{tenantName}}!

We've received your payment of *{{currency}} {{amount}}*.

📝 Receipt: {{receiptNumber}}
💰 Remaining Balance: {{currency}} {{balance}}

Thank you for being a great tenant! 🏠`,
    sw: `✅ *Malipo Yamepokelewa!*

Asante, {{tenantName}}!

Tumepokea malipo yako ya *{{currency}} {{amount}}*.

📝 Risiti: {{receiptNumber}}
💰 Salio Lililobaki: {{currency}} {{balance}}

Asante kwa kuwa mpangaji mzuri! 🏠`,
  } satisfies MessageTemplate,

  maintenanceAppointment: {
    en: `🔧 *Maintenance Appointment Reminder*

Hi {{tenantName}},

Your maintenance visit is scheduled for tomorrow:

📅 Date: {{appointmentDate}}
🕐 Time: {{appointmentTime}}
👷 Technician: {{technicianName}}
📋 Issue: {{issueType}}

Please ensure someone is available to provide access.

Need to reschedule? Reply "reschedule".`,
    sw: `🔧 *Kumbusho la Miadi ya Matengenezo*

Habari {{tenantName}},

Ziara yako ya matengenezo imepangwa kesho:

📅 Tarehe: {{appointmentDate}}
🕐 Wakati: {{appointmentTime}}
👷 Fundi: {{technicianName}}
📋 Tatizo: {{issueType}}

Tafadhali hakikisha mtu yupo kutoa ufikiaji.

Unahitaji kupanga upya? Jibu "panga upya".`,
  } satisfies MessageTemplate,

  documentExpiry: {
    en: `📄 *Document Expiry Notice*

Hi {{tenantName}},

Your {{documentType}} will expire on {{expiryDate}}.

Please upload an updated document to avoid any service interruptions.

Reply "upload" for instructions.`,
    sw: `📄 *Notisi ya Kuisha kwa Hati*

Habari {{tenantName}},

{{documentType}} yako itaisha {{expiryDate}}.

Tafadhali pakia hati iliyosasishwa kuepuka usumbufu wowote wa huduma.

Jibu "pakia" kwa maelekezo.`,
  } satisfies MessageTemplate,

  leaseRenewal: {
    en: `📋 *Lease Renewal Reminder*

Hi {{tenantName}},

Your lease at {{propertyName}} expires on {{leaseEndDate}}.

We'd love to have you stay! Reply to discuss renewal options.

🏠 Renew now and enjoy:
• Same great location
• Continued service from Boss Nyumba
• Potential loyalty benefits`,
    sw: `📋 *Kumbusho la Kuhuisha Mkataba*

Habari {{tenantName}},

Mkataba wako katika {{propertyName}} unaisha {{leaseEndDate}}.

Tungependa ukae! Jibu kujadili chaguzi za kuhuisha.

🏠 Huisha sasa na ufurahie:
• Mahali pazuri sawa
• Huduma inayoendelea kutoka Boss Nyumba
• Faida za uaminifu`,
  } satisfies MessageTemplate,
} as const;

// ============================================================================
// Emergency Templates
// ============================================================================

export const EMERGENCY_TEMPLATES = {
  emergencyDetected: {
    en: `🚨 *EMERGENCY DETECTED*

I've detected an emergency situation from your message.

Your safety is our top priority. Please confirm the emergency type:`,
    sw: `🚨 *DHARURA IMEGUNDULIKA*

Nimegundua hali ya dharura kutoka ujumbe wako.

Usalama wako ni kipaumbele chetu cha juu. Tafadhali thibitisha aina ya dharura:`,
  } satisfies MessageTemplate,

  emergencyTypeButtons: {
    en: {
      body: 'Select emergency type:',
      buttons: [
        { id: 'emergency_fire', title: '🔥 Fire' },
        { id: 'emergency_flood', title: '🌊 Flooding' },
        { id: 'emergency_security', title: '🚨 Break-in/Security' },
      ],
    },
    sw: {
      body: 'Chagua aina ya dharura:',
      buttons: [
        { id: 'emergency_fire', title: '🔥 Moto' },
        { id: 'emergency_flood', title: '🌊 Mafuriko' },
        { id: 'emergency_security', title: '🚨 Uvamizi/Usalama' },
      ],
    },
  } satisfies InteractiveTemplate,

  emergencyConfirmed: {
    en: `🚨 *EMERGENCY CONFIRMED*

*{{emergencyType}}* emergency logged at {{time}}.

🆘 *IMMEDIATE ACTIONS:*
{{safetyInstructions}}

📞 *Emergency contacts notified:*
{{notifiedContacts}}

*Stay safe! Help is on the way.*

Reply with updates on your situation.`,
    sw: `🚨 *DHARURA IMETHIBITISHWA*

Dharura ya *{{emergencyType}}* imeandikwa saa {{time}}.

🆘 *HATUA ZA HARAKA:*
{{safetyInstructions}}

📞 *Mawasiliano ya dharura yameariflwa:*
{{notifiedContacts}}

*Kaa salama! Msaada unakuja.*

Jibu na masasisho juu ya hali yako.`,
  } satisfies MessageTemplate,

  fireSafetyInstructions: {
    en: `1. If safe, evacuate immediately
2. DO NOT use elevators
3. Feel doors before opening
4. Stay low if there's smoke
5. Call emergency services: 112
6. Meet at the designated assembly point`,
    sw: `1. Ikiwa salama, hama mara moja
2. USITUMIE lifti
3. Gusa milango kabla ya kufungua
4. Kaa chini ikiwa kuna moshi
5. Piga simu huduma za dharura: 112
6. Kutana mahali pa kusanyiko`,
  } satisfies MessageTemplate,

  floodSafetyInstructions: {
    en: `1. Move to higher ground if possible
2. Turn off electricity at main switch
3. DO NOT walk through flowing water
4. Avoid electrical equipment
5. Document damage with photos
6. Wait for further instructions`,
    sw: `1. Nenda mahali pa juu ikiwezekana
2. Zima umeme kwenye swichi kuu
3. USITEMBEE kupitia maji yanayotiririka
4. Epuka vifaa vya umeme
5. Rekodi uharibifu kwa picha
6. Ngoja maelekezo zaidi`,
  } satisfies MessageTemplate,

  securitySafetyInstructions: {
    en: `1. If intruder is present, hide quietly
2. DO NOT confront the intruder
3. Call police: 999 or 112
4. Lock yourself in a safe room
5. Only open for security/police
6. Document what you can safely`,
    sw: `1. Ikiwa mvamizi yupo, jificha kimya
2. USIMKABILI mvamizi
3. Piga polisi: 999 au 112
4. Jifunge ndani ya chumba salama
5. Fungua tu kwa usalama/polisi
6. Rekodi unachoweza salama`,
  } satisfies MessageTemplate,

  emergencyEscalation: {
    en: `📞 *ESCALATION NOTICE*

The emergency response team has been notified:

• Security: {{securityContact}}
• Property Manager: {{managerContact}}
• Emergency Services: Contacted

We're coordinating response. Stay on this chat for updates.`,
    sw: `📞 *NOTISI YA KUONGEZA*

Timu ya dharura imeariflwa:

• Usalama: {{securityContact}}
• Meneja wa Mali: {{managerContact}}
• Huduma za Dharura: Zimewasiliana

Tunaratibu jibu. Kaa kwenye gumzo hili kwa masasisho.`,
  } satisfies MessageTemplate,

  emergencyResolved: {
    en: `✅ *Emergency Resolved*

The {{emergencyType}} emergency has been marked as resolved.

📝 Resolution: {{resolutionNotes}}
⏱️ Duration: {{duration}}

Please let us know if you need any follow-up support.

Stay safe! 🏠`,
    sw: `✅ *Dharura Imetatuliwa*

Dharura ya {{emergencyType}} imewekwa alama kuwa imetatuliwa.

📝 Utatuzi: {{resolutionNotes}}
⏱️ Muda: {{duration}}

Tafadhali tuambie ikiwa unahitaji msaada wa ufuatiliaji.

Kaa salama! 🏠`,
  } satisfies MessageTemplate,
} as const;

// ============================================================================
// General Templates
// ============================================================================

export const GENERAL_TEMPLATES = {
  unknownCommand: {
    en: `I didn't quite understand that. Here's what I can help you with:

🔧 *"maintenance"* - Report a repair issue
💰 *"rent"* or *"pay"* - Payment information
📋 *"lease"* - Lease questions
🚨 *"emergency"* - Report an emergency
❓ *"help"* - Get assistance

How can I help you today?`,
    sw: `Sikuelewa vizuri. Hivi ndivyo ninavyoweza kukusaidia:

🔧 *"matengenezo"* - Ripoti tatizo la ukarabati
💰 *"kodi"* au *"lipa"* - Maelezo ya malipo
📋 *"mkataba"* - Maswali ya mkataba
🚨 *"dharura"* - Ripoti dharura
❓ *"msaada"* - Pata msaada

Ninawezaje kukusaidia leo?`,
  } satisfies MessageTemplate,

  humanHandoff: {
    en: `I understand this requires personal attention.

I'm connecting you with our team. A human agent will respond within {{responseTime}}.

In the meantime, is there anything else I can help with?`,
    sw: `Naelewa hii inahitaji umakini wa kibinafsi.

Ninakuunganisha na timu yetu. Wakala wa binadamu atajibu ndani ya {{responseTime}}.

Wakati huo huo, kuna kitu kingine ninaweza kusaidia?`,
  } satisfies MessageTemplate,

  officeHours: {
    en: `🕐 *Office Hours*

Our team is available:
Monday - Friday: 8:00 AM - 6:00 PM
Saturday: 9:00 AM - 1:00 PM
Sunday: Closed

For emergencies, type "emergency" anytime.`,
    sw: `🕐 *Saa za Ofisi*

Timu yetu inapatikana:
Jumatatu - Ijumaa: 8:00 AM - 6:00 PM
Jumamosi: 9:00 AM - 1:00 PM
Jumapili: Imefungwa

Kwa dharura, andika "dharura" wakati wowote.`,
  } satisfies MessageTemplate,

  greeting: {
    en: `👋 Hi {{tenantName}}!

Welcome back to Boss Nyumba. How can I help you today?

Quick options:
🔧 Maintenance
💰 Rent & Payments
📋 Lease Info
❓ General Help`,
    sw: `👋 Habari {{tenantName}}!

Karibu tena kwa Boss Nyumba. Ninawezaje kukusaidia leo?

Chaguzi za haraka:
🔧 Matengenezo
💰 Kodi na Malipo
📋 Maelezo ya Mkataba
❓ Msaada wa Jumla`,
  } satisfies MessageTemplate,

  sessionExpired: {
    en: `Your previous session has expired. Let's start fresh!

How can I help you today?`,
    sw: `Kipindi chako kilichopita kimeisha. Tuanze upya!

Ninawezaje kukusaidia leo?`,
  } satisfies MessageTemplate,
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get template content for a specific language
 */
export function getTemplate(
  template: MessageTemplate | InteractiveTemplate,
  language: SupportedLanguage = 'en'
): string | InteractiveTemplate['en'] {
  return template[language];
}

/**
 * Render template with variable substitution.
 *
 * Supports both positional (`{{1}}`, `{{2}}`) and named (`{{var}}`)
 * placeholders. Meta-approved templates use positional substitution
 * while our in-app copy uses named substitution; this function handles
 * both. Unknown placeholders are left intact so a template editor can
 * surface them to the operator.
 */
export function renderTemplate(
  template: string,
  variables: Record<string, string | number> | Array<string | number>
): string {
  let result = template;
  if (Array.isArray(variables)) {
    variables.forEach((value, index) => {
      const pattern = new RegExp(`\\{\\{\\s*${index + 1}\\s*\\}\\}`, 'g');
      result = result.replace(pattern, String(value));
    });
    return result;
  }
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`\\{\\{\\s*${escapeRegex(key)}\\s*\\}\\}`, 'g');
    result = result.replace(placeholder, value === undefined || value === null ? '' : String(value));
  }
  return result;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================================
// Meta Business-Approved Template Registry (Module F.3)
// ============================================================================

/**
 * Template approval lifecycle as returned by the Meta Cloud API. Only
 * `APPROVED` templates may be used to initiate a conversation outside
 * of the 24-hour customer-service window.
 *
 * See: https://developers.facebook.com/docs/whatsapp/message-templates/
 */
export type WhatsAppTemplateApprovalState =
  | 'APPROVED'
  | 'PENDING'
  | 'REJECTED'
  | 'PAUSED'
  | 'DISABLED'
  | 'IN_APPEAL'
  | 'PENDING_DELETION';

export type WhatsAppTemplateCategory =
  | 'AUTHENTICATION'
  | 'MARKETING'
  | 'UTILITY';

export type WhatsAppTemplateComponentType =
  | 'HEADER'
  | 'BODY'
  | 'FOOTER'
  | 'BUTTONS';

export interface WhatsAppTemplateVariable {
  /** 1-indexed position matching `{{1}}`, `{{2}}` inside the template body. */
  position: number;
  name: string;
  description?: string;
  example?: string;
  required?: boolean;
}

export interface WhatsAppTemplateComponent {
  type: WhatsAppTemplateComponentType;
  /** Sub-format for the HEADER component (TEXT, IMAGE, DOCUMENT, VIDEO, LOCATION). */
  format?: 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'VIDEO' | 'LOCATION';
  text?: string;
  variables?: WhatsAppTemplateVariable[];
}

/**
 * A Meta-registered template. `metaTemplateId` is the asset ID returned
 * by the Cloud API once the template is submitted for review. `name`
 * (template_name) and `language` (BCP-47 with Meta fallbacks, e.g.
 * `en`, `sw`) are what we actually send on the wire.
 */
export interface WhatsAppTemplateDefinition {
  /** Logical key used by application code to reference the template. */
  key: string;
  /** Canonical template name registered with Meta (snake_case). */
  name: string;
  /** Meta language code, e.g. `en`, `sw`. */
  language: 'en' | 'sw';
  /** Asset ID returned by the Meta API after submission. */
  metaTemplateId?: string;
  category: WhatsAppTemplateCategory;
  approvalState: WhatsAppTemplateApprovalState;
  /** Optional reason provided by Meta when approvalState is REJECTED or PAUSED. */
  approvalRejectionReason?: string;
  approvalUpdatedAt?: string;
  components: WhatsAppTemplateComponent[];
  /** Positional variables required when rendering the template body. */
  variables: WhatsAppTemplateVariable[];
  /** Documentation for support/ops consumers. */
  description?: string;
}

/**
 * Default template catalogue. Approval state and Meta template IDs are
 * environment-specific and should be provided via configuration in
 * production, but we ship a conservative default set so the service
 * comes up even before ops have finalised template registration.
 *
 * The catalogue is intentionally minimal: only those messages we need
 * to initiate outside the 24h session (rent reminders, receipts,
 * emergency notifications) need registered templates. Free-form
 * in-session replies use the interactive/text-message APIs instead.
 */
export const DEFAULT_META_TEMPLATES: readonly WhatsAppTemplateDefinition[] = [
  {
    key: 'rent_reminder_en',
    name: 'rent_reminder',
    language: 'en',
    category: 'UTILITY',
    approvalState: 'PENDING',
    components: [
      {
        type: 'BODY',
        text: 'Hello {{1}}, your rent of {{2}} is due on {{3}}. Reply PAY to receive payment options.',
      },
    ],
    variables: [
      { position: 1, name: 'tenantName', example: 'Jane Wangui', required: true },
      { position: 2, name: 'amount', example: 'KES 25,000', required: true },
      { position: 3, name: 'dueDate', example: '5 May 2026', required: true },
    ],
    description: 'Rolling monthly rent reminder. Dispatched 3 days before due date.',
  },
  {
    key: 'rent_reminder_sw',
    name: 'rent_reminder',
    language: 'sw',
    category: 'UTILITY',
    approvalState: 'PENDING',
    components: [
      {
        type: 'BODY',
        text: 'Habari {{1}}, kodi yako ya {{2}} inahitajika tarehe {{3}}. Jibu PAY kupata njia za malipo.',
      },
    ],
    variables: [
      { position: 1, name: 'tenantName', example: 'Jane Wangui', required: true },
      { position: 2, name: 'amount', example: 'KES 25,000', required: true },
      { position: 3, name: 'dueDate', example: '5 Mei 2026', required: true },
    ],
    description: 'Kiswahili variant of rent_reminder.',
  },
  {
    key: 'payment_confirmation_en',
    name: 'payment_confirmation',
    language: 'en',
    category: 'UTILITY',
    approvalState: 'PENDING',
    components: [
      {
        type: 'BODY',
        text: 'Thank you {{1}}, we have received your payment of {{2}} on {{3}}. Receipt: {{4}}.',
      },
    ],
    variables: [
      { position: 1, name: 'tenantName', example: 'Jane Wangui', required: true },
      { position: 2, name: 'amount', example: 'KES 25,000', required: true },
      { position: 3, name: 'paidAt', example: '1 May 2026', required: true },
      { position: 4, name: 'receiptNumber', example: 'RCPT-000123', required: true },
    ],
    description: 'Payment confirmation receipt. Dispatched after successful settlement.',
  },
  {
    key: 'payment_confirmation_sw',
    name: 'payment_confirmation',
    language: 'sw',
    category: 'UTILITY',
    approvalState: 'PENDING',
    components: [
      {
        type: 'BODY',
        text: 'Asante {{1}}, tumepokea malipo yako ya {{2}} tarehe {{3}}. Risiti: {{4}}.',
      },
    ],
    variables: [
      { position: 1, name: 'tenantName', example: 'Jane Wangui', required: true },
      { position: 2, name: 'amount', example: 'KES 25,000', required: true },
      { position: 3, name: 'paidAt', example: '1 Mei 2026', required: true },
      { position: 4, name: 'receiptNumber', example: 'RCPT-000123', required: true },
    ],
    description: 'Kiswahili variant of payment_confirmation.',
  },
  {
    key: 'emergency_ack_en',
    name: 'emergency_acknowledgement',
    language: 'en',
    category: 'UTILITY',
    approvalState: 'PENDING',
    components: [
      {
        type: 'BODY',
        text: 'We received your emergency report at {{1}}. Reference: {{2}}. Help is on the way.',
      },
    ],
    variables: [
      { position: 1, name: 'timestamp', required: true },
      { position: 2, name: 'caseId', required: true },
    ],
  },
];

/**
 * In-memory template registry. Callers (typically the service
 * composition root) should seed with Meta-returned IDs and approval
 * state at startup, then update via `updateApprovalState` as webhooks
 * from Meta arrive.
 */
export class WhatsAppTemplateRegistry {
  private readonly byKey = new Map<string, WhatsAppTemplateDefinition>();

  constructor(seed: readonly WhatsAppTemplateDefinition[] = DEFAULT_META_TEMPLATES) {
    for (const t of seed) this.byKey.set(t.key, { ...t });
  }

  list(): WhatsAppTemplateDefinition[] {
    return Array.from(this.byKey.values());
  }

  get(key: string): WhatsAppTemplateDefinition | undefined {
    return this.byKey.get(key);
  }

  /**
   * Resolve a template by name + language. Returns `undefined` if no
   * template matches, in which case the caller should not attempt to
   * send and should fall back to a free-form session message (if the
   * recipient is still within the 24h window).
   */
  resolve(name: string, language: 'en' | 'sw'): WhatsAppTemplateDefinition | undefined {
    for (const t of this.byKey.values()) {
      if (t.name === name && t.language === language) return t;
    }
    return undefined;
  }

  upsert(template: WhatsAppTemplateDefinition): void {
    this.byKey.set(template.key, { ...template });
  }

  /**
   * Update approval state from a Meta webhook. Downstream senders should
   * check `isSendable()` before dispatching.
   */
  updateApprovalState(
    key: string,
    approvalState: WhatsAppTemplateApprovalState,
    options?: { rejectionReason?: string; metaTemplateId?: string; updatedAt?: string },
  ): WhatsAppTemplateDefinition | undefined {
    const existing = this.byKey.get(key);
    if (!existing) return undefined;
    const next: WhatsAppTemplateDefinition = {
      ...existing,
      approvalState,
      approvalRejectionReason:
        approvalState === 'REJECTED' || approvalState === 'PAUSED'
          ? options?.rejectionReason ?? existing.approvalRejectionReason
          : undefined,
      metaTemplateId: options?.metaTemplateId ?? existing.metaTemplateId,
      approvalUpdatedAt: options?.updatedAt ?? new Date().toISOString(),
    };
    this.byKey.set(key, next);
    return next;
  }

  /** A template is sendable iff Meta has APPROVED it and it is not PAUSED. */
  isSendable(key: string): boolean {
    const t = this.byKey.get(key);
    return !!t && t.approvalState === 'APPROVED';
  }
}

/**
 * Build the `components` payload expected by the Meta Cloud API for a
 * given registered template, applying variable substitution.
 *
 * Throws if the template is not sendable or required variables are
 * missing; this is deliberately strict so production does not silently
 * drop variables and ship broken messages.
 */
export function buildMetaTemplatePayload(
  template: WhatsAppTemplateDefinition,
  values: Record<string, string | number>,
): { name: string; language: { code: string }; components: unknown[] } {
  if (template.approvalState !== 'APPROVED') {
    throw new Error(
      `WhatsApp template '${template.key}' is not sendable (approvalState=${template.approvalState})`,
    );
  }

  const bodyComponent = template.components.find((c) => c.type === 'BODY');
  if (!bodyComponent) {
    throw new Error(`WhatsApp template '${template.key}' is missing a BODY component`);
  }

  const parameters = [...template.variables]
    .sort((a, b) => a.position - b.position)
    .map((variable) => {
      const value = values[variable.name];
      if ((value === undefined || value === null) && variable.required !== false) {
        throw new Error(
          `WhatsApp template '${template.key}' missing required variable '${variable.name}'`,
        );
      }
      return { type: 'text', text: String(value ?? '') };
    });

  return {
    name: template.name,
    language: { code: template.language },
    components: [{ type: 'body', parameters }],
  };
}

/**
 * Get all emergency keywords for detection
 */
export function getEmergencyKeywords(): Record<SupportedLanguage, string[]> {
  return {
    en: [
      'fire', 'burning', 'smoke', 'flames',
      'flood', 'flooding', 'water everywhere', 'burst pipe',
      'break in', 'break-in', 'breakin', 'intruder', 'robbery', 'thief', 'stolen',
      'gas leak', 'gas smell', 'smells like gas',
      'electrical', 'sparks', 'electrocuted', 'shock',
      'emergency', 'urgent', 'help', 'danger', 'unsafe',
    ],
    sw: [
      'moto', 'inawaka', 'moshi', 'miali',
      'mafuriko', 'maji mengi', 'bomba limepasuka',
      'uvamizi', 'wizi', 'mwizi', 'imeibwa',
      'gesi inavuja', 'harufu ya gesi',
      'umeme', 'cheche', 'umeguswa na stima',
      'dharura', 'haraka', 'msaada', 'hatari', 'si salama',
    ],
  };
}

/**
 * Detect language from message content
 */
export function detectLanguage(text: string): SupportedLanguage {
  const swahiliPatterns = [
    /\b(habari|asante|tafadhali|karibu|ndiyo|hapana|sawa|vipi|nina|ninayo)\b/i,
    /\b(matengenezo|kodi|maji|umeme|nyumba|dharura)\b/i,
  ];

  for (const pattern of swahiliPatterns) {
    if (pattern.test(text)) {
      return 'sw';
    }
  }

  return 'en';
}
