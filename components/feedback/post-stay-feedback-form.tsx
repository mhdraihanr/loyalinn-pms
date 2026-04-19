"use client";

import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  Group,
  Rating,
  Stack,
  Text,
  Textarea,
  Title,
} from "@mantine/core";

type PostStayFeedbackFormProps = {
  token: string;
  guestName: string;
  hotelName: string;
};

type SubmissionCopy = {
  pointsMessage: string;
  redeemMessage: string;
};

export function getFeedbackSubmissionCopy(
  rewardPoints: number,
): SubmissionCopy {
  if (rewardPoints > 0) {
    return {
      pointsMessage: `Sebagai apresiasi, Anda mendapatkan ${rewardPoints} poin reward.`,
      redeemMessage:
        "Poin ini bisa ditukar dengan servis seperti minuman gratis, extra bed, bahkan potongan harga menginap.",
    };
  }

  return {
    pointsMessage:
      "Feedback Anda sudah kami terima dan poin reward untuk reservasi ini sudah tercatat satu kali.",
    redeemMessage:
      "Poin yang Anda miliki tetap bisa ditukar dengan servis seperti minuman gratis, extra bed, bahkan potongan harga menginap.",
  };
}

export function PostStayFeedbackForm({
  token,
  guestName,
  hotelName,
}: PostStayFeedbackFormProps) {
  const [rating, setRating] = useState<number>(0);
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [rewardPoints, setRewardPoints] = useState(0);

  const canSubmit = rating >= 1 && rating <= 5 && comments.trim().length > 0;

  async function onSubmit() {
    if (!canSubmit || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/feedback/submit", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          token,
          rating,
          comments: comments.trim(),
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        rewardPoints?: number;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to submit feedback");
      }

      const points = Number(payload.rewardPoints ?? 0);
      setRewardPoints(
        Number.isFinite(points) && points >= 0 ? Math.floor(points) : 0,
      );
      setSubmitted(true);
    } catch (submitError: unknown) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to submit feedback",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    const submissionCopy = getFeedbackSubmissionCopy(rewardPoints);

    return (
      <Card withBorder radius="md" p="xl">
        <Stack gap="md">
          <Title order={2}>Terima kasih, {guestName}!</Title>
          <Text c="dimmed">
            Feedback Anda untuk {hotelName} sudah kami terima.
          </Text>
          <Alert color="teal" variant="light">
            <Stack gap={4}>
              <Text fw={600}>{submissionCopy.pointsMessage}</Text>
              <Text size="sm">{submissionCopy.redeemMessage}</Text>
            </Stack>
          </Alert>
        </Stack>
      </Card>
    );
  }

  return (
    <Card withBorder radius="md" p="xl">
      <Stack gap="lg">
        <Stack gap={4}>
          <Title order={2}>Post-Stay Feedback</Title>
          <Text c="dimmed">
            Halo {guestName}, bantu kami meningkatkan layanan di {hotelName}.
          </Text>
        </Stack>

        {error ? <Alert color="red">{error}</Alert> : null}

        <Stack gap={8}>
          <Text fw={500}>Rating pengalaman Anda</Text>
          <Group>
            <Rating
              value={rating}
              onChange={setRating}
              size="lg"
              fractions={1}
            />
            <Text size="sm" c="dimmed">
              {rating > 0 ? `${rating}/5` : "Pilih rating 1-5"}
            </Text>
          </Group>
        </Stack>

        <Textarea
          label="Komentar"
          placeholder="Ceritakan pengalaman Anda selama menginap"
          minRows={4}
          value={comments}
          onChange={(event) => setComments(event.currentTarget.value)}
          required
        />

        <Button loading={submitting} onClick={onSubmit} disabled={!canSubmit}>
          Kirim Feedback
        </Button>
      </Stack>
    </Card>
  );
}
