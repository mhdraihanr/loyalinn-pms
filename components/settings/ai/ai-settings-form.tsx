"use client";

import { useState } from "react";
import {
  Button,
  Card,
  Group,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCheck } from "@tabler/icons-react";

export type AiSettingsFormValues = {
  hotel_name: string;
  ai_name: string;
  tone_of_voice: string;
  custom_instructions: string;
};

type AiSettingsFormProps = {
  initialValues: AiSettingsFormValues;
  saveAction: (values: AiSettingsFormValues) => Promise<void>;
};

export function AiSettingsForm({
  initialValues,
  saveAction,
}: AiSettingsFormProps) {
  const [values, setValues] = useState<AiSettingsFormValues>(initialValues);
  const [isSaving, setIsSaving] = useState(false);

  const updateField = (field: keyof AiSettingsFormValues, value: string) => {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      await saveAction(values);
      notifications.show({
        title: "Saved",
        message: "AI settings updated successfully.",
        color: "green",
        icon: <IconCheck size={16} />,
      });
    } catch (error) {
      notifications.show({
        title: "Error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to save AI settings.",
        color: "red",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card withBorder padding="lg" radius="md">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Ubah konteks AI follow-up agar balasan otomatis sesuai brand hotel
          Anda.
        </Text>

        <TextInput
          label="Hotel Name Override"
          placeholder="Contoh: Hotel Merdeka Jakarta"
          description="Jika diisi, AI akan memakai nama ini saat menyebut hotel."
          value={values.hotel_name}
          onChange={(event) =>
            updateField("hotel_name", event.currentTarget.value)
          }
        />

        <TextInput
          label="AI Persona Name"
          placeholder="Contoh: Ayu"
          description="Nama asisten AI yang dipakai dalam persona sistem prompt."
          value={values.ai_name}
          onChange={(event) =>
            updateField("ai_name", event.currentTarget.value)
          }
        />

        <Textarea
          label="Tone of Voice"
          placeholder="Contoh: hangat, profesional, ringkas"
          minRows={2}
          description="Preferensi gaya bahasa AI saat membalas tamu."
          value={values.tone_of_voice}
          onChange={(event) =>
            updateField("tone_of_voice", event.currentTarget.value)
          }
        />

        <Textarea
          label="Custom Instructions"
          placeholder="Contoh: jika tamu memberi rating 4 atau 5, arahkan untuk ulasan publik."
          minRows={4}
          description="Instruksi tambahan yang selalu disertakan ke system prompt AI."
          value={values.custom_instructions}
          onChange={(event) =>
            updateField("custom_instructions", event.currentTarget.value)
          }
        />

        <Group justify="flex-end" mt="sm">
          <Button onClick={handleSave} loading={isSaving}>
            Save AI Settings
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
