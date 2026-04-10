type TemplateVariant = {
  language_code: string;
  content: string;
};

type RenderVariables = {
  guestName: string;
  roomNumber: string;
  checkInDate: string;
  checkOutDate: string;
  hotelName: string;
};

type SendGuardInput = {
  guestPhone: string | null;
  templateVariant: TemplateVariant | null;
  hasSuccessfulDelivery: boolean;
};

type SendGuardResult =
  | { allowed: true }
  | {
      allowed: false;
      reason: "missing-phone" | "missing-template" | "already-sent";
    };

const TEMPLATE_VARIABLES: Record<keyof RenderVariables, string> = {
  guestName: "{{guestName}}",
  roomNumber: "{{roomNumber}}",
  checkInDate: "{{checkInDate}}",
  checkOutDate: "{{checkOutDate}}",
  hotelName: "{{hotelName}}",
};

export function renderTemplate(
  content: string,
  variables: RenderVariables,
): string {
  return Object.entries(TEMPLATE_VARIABLES).reduce(
    (message, [key, placeholder]) =>
      message.replaceAll(placeholder, variables[key as keyof RenderVariables]),
    content,
  );
}

export function selectTemplateVariant(
  variants: TemplateVariant[],
  preferredLanguage: string,
): TemplateVariant | null {
  if (variants.length === 0) {
    return null;
  }

  return (
    variants.find((variant) => variant.language_code === preferredLanguage) ??
    variants.find((variant) => variant.language_code === "en") ??
    variants[0]
  );
}

export function canSendAutomatedMessage({
  guestPhone,
  templateVariant,
  hasSuccessfulDelivery,
}: SendGuardInput): SendGuardResult {
  if (!guestPhone) {
    return { allowed: false, reason: "missing-phone" };
  }

  if (!templateVariant) {
    return { allowed: false, reason: "missing-template" };
  }

  if (hasSuccessfulDelivery) {
    return { allowed: false, reason: "already-sent" };
  }

  return { allowed: true };
}
