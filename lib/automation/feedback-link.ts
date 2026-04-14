import { createHmac, timingSafeEqual } from "node:crypto";

type FeedbackTokenPayload = {
  v: 1;
  reservationId: string;
  tenantId: string;
  exp: number;
};

type CreateFeedbackTokenInput = {
  reservationId: string;
  tenantId: string;
  expiresInSeconds?: number;
};

function resolveFeedbackSecret() {
  const secret =
    process.env.POST_STAY_FEEDBACK_SECRET ?? process.env.PMS_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error(
      "Missing POST_STAY_FEEDBACK_SECRET or PMS_WEBHOOK_SECRET env var.",
    );
  }

  return secret;
}

function signPayload(encodedPayload: string) {
  return createHmac("sha256", resolveFeedbackSecret())
    .update(encodedPayload)
    .digest("base64url");
}

export function createFeedbackToken({
  reservationId,
  tenantId,
  expiresInSeconds = 60 * 60 * 24 * 7,
}: CreateFeedbackTokenInput): string {
  const payload: FeedbackTokenPayload = {
    v: 1,
    reservationId,
    tenantId,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
  const signature = signPayload(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifyFeedbackToken(
  token: string,
): Omit<FeedbackTokenPayload, "v"> | null {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signPayload(encodedPayload);
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expectedSignature);

  if (actualBytes.length !== expectedBytes.length) {
    return null;
  }

  if (!timingSafeEqual(actualBytes, expectedBytes)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<FeedbackTokenPayload>;

    if (
      parsed.v !== 1 ||
      typeof parsed.reservationId !== "string" ||
      typeof parsed.tenantId !== "string" ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }

    if (parsed.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      reservationId: parsed.reservationId,
      tenantId: parsed.tenantId,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

export function buildFeedbackLink(token: string): string {
  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");

  return `${appUrl}/feedback/${encodeURIComponent(token)}`;
}
