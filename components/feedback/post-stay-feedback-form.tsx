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

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to submit feedback");
      }

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
    return (
      <Card withBorder radius="md" p="xl">
        <Stack gap="md">
          <Title order={2}>Terima kasih, {guestName}!</Title>
          <Text c="dimmed">
            Feedback Anda untuk {hotelName} sudah kami terima.
          </Text>
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
