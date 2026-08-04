import type { LifecycleLanguage, LifecycleStage } from "./lifecycle-session";

export type LifecycleIntentGuardOutcome =
  | "allow"
  | "clarify"
  | "handoff"
  | "resolved";

export type LifecycleIntentGuardDecision = {
  outcome: LifecycleIntentGuardOutcome;
  intent: string;
  reason: string;
  priority: "normal" | "high";
  reply: string | null;
};

const MAX_INTENT_GUARD_CLARIFICATIONS = 1;

const HUMAN_REQUEST_PATTERN =
  /\b(staff|human|agent|front desk|reception|manager|supervisor|orang|petugas|resepsionis|manajer)\b/i;
const HIGH_PRIORITY_PATTERN =
  /\b(emergency|urgent|fire|police|ambulance|medical|injur(?:y|ed)|assault|violence|threat|kebakaran|darurat|polisi|ambulans|medis|terluka|kekerasan|ancaman)\b/i;
const POLICY_HANDOFF_PATTERN =
  /\b(refund|chargeback|payment|credit card|invoice|legal|privacy|cancel(?:lation)?|booking change|kompensasi|pengembalian dana|pembayaran|kartu kredit|tagihan|hukum|privasi|batal(?:kan)?|ubah booking)\b/i;
const STOP_PATTERN =
  /\b(stop|unsubscribe|do not contact|jangan hubungi|berhenti|tidak mau|ga mau|nggak mau|jgn hubungi)\b/i;
const GREETING_PATTERN = /^(hi|hello|halo|hai|pagi|siang|sore|malam|test|tes|\?|ok|oke|ya|iya)$/i;
const RATING_ONLY_PATTERN = /^[1-5]$/;
const GENERIC_UNSUPPORTED_REQUEST_PATTERN =
  /\b(butuh|perlu|minta|mohon|tolong|bantu(?:an)?|mau\s+beli|ingin\s+(?:beli|membeli)|need|help|assist|please|buy|purchase)\b/i;
const SERVICE_REQUEST_ACTION_PATTERN =
  /\b(tolong|minta|mohon|butuh|perlu|antar(?:kan)?|kirim(?:kan)?|bawa(?:kan)?|tambah(?:kan)?|ganti(?:kan)?|bersihkan|bereskan|rapikan|perbaiki|pesan(?:kan)?|need|please|send|bring|deliver|request|replace|fix|repair|order)\b/i;
const EARLY_CHECKIN_PATTERN =
  /\b(early check[ -]?in|check[ -]?in\s+(?:lebih awal|awal)|(?:lebih awal).{0,24}check[ -]?in|masuk kamar lebih awal)\b/i;
const REQUESTED_TIME_PATTERN =
  /\b(?:(?:jam|pukul)\s*\d{1,2}(?:[.:]\d{2})?|\d{1,2}(?:[.:]\d{2})?\s*(?:pagi|siang|sore|malam)|(?:at\s*)?\d{1,2}(?::\d{2})?\s*(?:am|pm)|at\s+\d{1,2}(?::\d{2})?)\b/i;

const STAGE_PATTERNS: Record<LifecycleStage, RegExp[]> = {
  "pre-arrival": [
    /\b(eta|arrival|arrive|kedatangan|tiba|sampai|flight|penerbangan|check[ -]?in|early check[ -]?in|lebih awal)\b/i,
  ],
  "on-stay": [
    /\b(housekeeping|clean(?:ing)?|tidy|make[ -]?up(?: room)?|bersih(?:kan)?|beres(?:kan)?|rapi(?:h)?(?:kan)?)\b/i,
    /\b(room service|menu|food|drink|breakfast|dinner|makanan|minuman|makan|minum|nasi|mie|ayam|kopi|teh|order\s+(?:food|drink|room service)|(?:pesan(?:kan)?|memesan)\s+(?:room service|makanan|minuman|makan|minum|nasi|mie|ayam|kopi|teh))\b/i,
    /\b(towel|toiletr(?:y|ies)|extra[ -]?bed|pillow|blanket|handuk|bantal|selimut|sprei|sandal|kasur tambahan|tambahan)\b/i,
    /\b(maintenance|ac|aircon|air conditioner|wi[ -]?fi|internet|lamp|light|broken|repair|perbaiki|rusak|kendala|masalah|lampu)\b/i,
  ],
  "post-stay": [
    /\b(rating|rate|score|review|feedback|comment|komentar|nilai|bintang|pengalaman|ulasan|menginap|stay|puas|nyaman|ramah|pelayanan|layanan|staf|staff|kamar|bersih|check[ -]?in|sarapan)\b/i,
  ],
};

const CROSS_STAGE_PATTERNS: Record<LifecycleStage, RegExp[]> = {
  "pre-arrival": STAGE_PATTERNS["on-stay"].concat(STAGE_PATTERNS["post-stay"]),
  "on-stay": STAGE_PATTERNS["pre-arrival"].concat(STAGE_PATTERNS["post-stay"]),
  "post-stay": STAGE_PATTERNS["pre-arrival"].concat(STAGE_PATTERNS["on-stay"]),
};

function reply(language: LifecycleLanguage, key: string) {
  const replies: Record<LifecycleLanguage, Record<string, string>> = {
    id: {
      "clarify-pre-arrival":
        "Agar saya membantu dengan tepat, apakah ini terkait waktu kedatangan, early check-in, atau persiapan check-in Anda?",
      "clarify-early-checkin-time":
        "Boleh informasikan jam berapa Anda ingin early check-in agar dapat kami teruskan untuk dikonfirmasi tim hotel?",
      "clarify-on-stay":
        "Agar saya membantu dengan tepat, apakah Anda membutuhkan room service, housekeeping, barang tambahan, atau bantuan maintenance?",
      "clarify-post-stay":
        "Agar saya memahami dengan tepat, apakah Anda ingin memberi rating atau komentar tentang pengalaman menginap Anda?",
      "handoff-pre-arrival":
        "Baik, permintaan ini akan kami teruskan ke staf hotel agar dapat diperiksa sesuai data reservasi Anda.",
      "handoff-on-stay":
        "Baik, staf hotel akan membantu memeriksa dan menindaklanjuti permintaan Anda.",
      "handoff-post-stay":
        "Reservasi Anda sudah selesai. Jika masih membutuhkan bantuan, staf hotel akan membantu menindaklanjuti.",
      "handoff-out-of-stage-pre-arrival":
        "Saat ini reservasi Anda belum berada pada masa menginap. Staf hotel akan membantu memeriksa permintaan Anda.",
      "handoff-out-of-stage-on-stay":
        "Kami akan bantu periksa data reservasi Anda. Staf hotel akan menindaklanjuti.",
      "handoff-out-of-stage-post-stay":
        "Reservasi Anda sudah selesai. Jika masih membutuhkan bantuan, staf hotel akan membantu menindaklanjuti.",
      "handoff-unclear-pre-arrival":
        "Maaf, kami perlu memastikan maksud permintaan Anda. Staf hotel akan membantu menindaklanjutinya.",
      "handoff-unclear-on-stay":
        "Maaf, kami belum dapat memastikan permintaannya. Staf hotel akan membantu Anda.",
      "handoff-unclear-post-stay":
        "Maaf, kami perlu memastikan perubahan atau bantuan yang dimaksud. Staf hotel akan membantu Anda.",
      "handoff-policy":
        "Pertanyaan ini perlu dikonfirmasi oleh staf hotel. Kami akan meneruskannya agar informasi yang diberikan sesuai kebijakan hotel.",
      "handoff-urgent":
        "Permintaan ini perlu ditangani segera oleh staf hotel. Kami akan meneruskannya sekarang untuk bantuan lanjutan.",
      resolved:
        "Baik, saya akan menghentikan tindak lanjut otomatis untuk percakapan ini.",
    },
    en: {
      "clarify-pre-arrival":
        "To help correctly, is this about your arrival time, early check-in, or check-in preparation?",
      "clarify-early-checkin-time":
        "What time would you like to check in early so we can forward it for hotel staff confirmation?",
      "clarify-on-stay":
        "To help correctly, do you need room service, housekeeping, extra items, or maintenance assistance?",
      "clarify-post-stay":
        "To understand correctly, would you like to share a rating or comment about your stay?",
      "handoff-pre-arrival":
        "Understood. We will forward this to hotel staff so they can check it against your reservation details.",
      "handoff-on-stay":
        "Understood. Hotel staff will help check and follow up on your request.",
      "handoff-post-stay":
        "Your reservation has ended. If you still need assistance, hotel staff will help follow up.",
      "handoff-out-of-stage-pre-arrival":
        "Your reservation is not in the stay period yet. Hotel staff will help check your request.",
      "handoff-out-of-stage-on-stay":
        "We will help check your reservation details. Hotel staff will follow up.",
      "handoff-out-of-stage-post-stay":
        "Your reservation has ended. If you still need assistance, hotel staff will help follow up.",
      "handoff-unclear-pre-arrival":
        "Sorry, we need to confirm what you mean. Hotel staff will help follow up.",
      "handoff-unclear-on-stay":
        "Sorry, we cannot confirm the request yet. Hotel staff will help you.",
      "handoff-unclear-post-stay":
        "Sorry, we need to confirm the change or assistance you mean. Hotel staff will help you.",
      "handoff-policy":
        "This question needs confirmation from hotel staff. We will forward it so the information matches hotel policy.",
      "handoff-urgent":
        "This request needs immediate help from hotel staff. We will forward it now for follow-up assistance.",
      resolved:
        "Understood. I will stop automated follow-up for this conversation.",
    },
  };

  return replies[language][key];
}

function hasPattern(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function handoffReplyKey(
  stage: LifecycleStage,
  reason:
    | "normal"
    | "out_of_stage"
    | "unclear"
    | "policy" = "normal",
) {
  if (reason === "policy") return "handoff-policy";
  if (reason === "out_of_stage") return `handoff-out-of-stage-${stage}`;
  if (reason === "unclear") return `handoff-unclear-${stage}`;
  return `handoff-${stage}`;
}

function hasEarlyCheckinIntent(text: string) {
  return EARLY_CHECKIN_PATTERN.test(text);
}

function hasRequestedTime(text: string) {
  return REQUESTED_TIME_PATTERN.test(text);
}

function hasServiceRequestAction(text: string) {
  return SERVICE_REQUEST_ACTION_PATTERN.test(text);
}

export function evaluateLifecycleIntentGuard(params: {
  stage: LifecycleStage;
  text: string;
  language: LifecycleLanguage;
  clarificationCount: number;
}): LifecycleIntentGuardDecision {
  const text = params.text.trim();

  if (STOP_PATTERN.test(text)) {
    return {
      outcome: "resolved",
      intent: "stop",
      reason: "guest_opted_out",
      priority: "normal",
      reply: reply(params.language, "resolved"),
    };
  }

  if (HIGH_PRIORITY_PATTERN.test(text)) {
    return {
      outcome: "handoff",
      intent: "urgent_or_sensitive",
      reason: "high_priority_safety_or_medical",
      priority: "high",
      reply: reply(params.language, "handoff-urgent"),
    };
  }

  if (HUMAN_REQUEST_PATTERN.test(text)) {
    return {
      outcome: "handoff",
      intent: "human_request",
      reason: "guest_requested_human",
      priority: "normal",
      reply: reply(params.language, handoffReplyKey(params.stage)),
    };
  }

  if (POLICY_HANDOFF_PATTERN.test(text)) {
    return {
      outcome: "handoff",
      intent: "policy_or_financial_request",
      reason: "requires_staff_judgment",
      priority: "normal",
      reply: reply(params.language, handoffReplyKey(params.stage, "policy")),
    };
  }

  if (params.stage === "post-stay" && RATING_ONLY_PATTERN.test(text)) {
    return {
      outcome: "allow",
      intent: "post-stay_rating_only_followup",
      reason: "rating_followup_supported_for_post_stay",
      priority: "normal",
      reply: null,
    };
  }

  if (params.stage === "pre-arrival" && hasEarlyCheckinIntent(text)) {
    if (hasRequestedTime(text)) {
      return {
        outcome: "allow",
        intent: "early_checkin_with_requested_time",
        reason: "early_checkin_time_provided",
        priority: "normal",
        reply: null,
      };
    }

    if (params.clarificationCount >= MAX_INTENT_GUARD_CLARIFICATIONS) {
      return {
        outcome: "handoff",
        intent: "early_checkin_missing_time",
        reason: "clarification_limit_reached",
        priority: "normal",
        reply: reply(params.language, handoffReplyKey(params.stage)),
      };
    }

    return {
      outcome: "clarify",
      intent: "early_checkin_missing_time",
      reason: "requested_time_required_before_tool_call",
      priority: "normal",
      reply: reply(params.language, "clarify-early-checkin-time"),
    };
  }

  if (
    params.stage === "post-stay" &&
    hasServiceRequestAction(text) &&
    hasPattern(text, STAGE_PATTERNS["on-stay"])
  ) {
    return {
      outcome: "handoff",
      intent: "out_of_stage_request",
      reason: "out_of_stage_request",
      priority: "normal",
      reply: reply(params.language, handoffReplyKey(params.stage, "out_of_stage")),
    };
  }

  if (hasPattern(text, STAGE_PATTERNS[params.stage])) {
    return {
      outcome: "allow",
      intent: `${params.stage}_supported_request`,
      reason: "intent_supported_for_lifecycle_stage",
      priority: "normal",
      reply: null,
    };
  }

  if (hasPattern(text, CROSS_STAGE_PATTERNS[params.stage])) {
    return {
      outcome: "handoff",
      intent: "out_of_stage_request",
      reason: "out_of_stage_request",
      priority: "normal",
      reply: reply(params.language, handoffReplyKey(params.stage, "out_of_stage")),
    };
  }

  if (text.length <= 3 || GREETING_PATTERN.test(text)) {
    if (params.clarificationCount >= MAX_INTENT_GUARD_CLARIFICATIONS) {
      return {
        outcome: "handoff",
        intent: "repeated_ambiguous_message",
        reason: "clarification_limit_reached",
        priority: "normal",
        reply: reply(params.language, handoffReplyKey(params.stage, "unclear")),
      };
    }

    return {
      outcome: "clarify",
      intent: "ambiguous_message",
      reason: "needs_lifecycle_context",
      priority: "normal",
      reply: reply(params.language, `clarify-${params.stage}`),
    };
  }

  if (GENERIC_UNSUPPORTED_REQUEST_PATTERN.test(text)) {
    return {
      outcome: "handoff",
      intent: "out_of_scope_request",
      reason: "unsupported_or_out_of_topic_request",
      priority: "normal",
      reply: reply(params.language, handoffReplyKey(params.stage, "unclear")),
    };
  }

  return {
    outcome: "allow",
    intent: "general_stage_conversation",
    reason: "no_deterministic_blocking_signal",
    priority: "normal",
    reply: null,
  };
}
