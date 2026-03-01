"use client";

import { useState } from "react";
import {
  Card,
  Textarea,
  Button,
  Group,
  Text,
  Select,
  Stack,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCheck, IconTrash } from "@tabler/icons-react";

export interface TemplateVariant {
  id?: string;
  language_code: string;
  content: string;
}

interface TemplateFormProps {
  triggerEvent: string;
  initialVariants: TemplateVariant[];
  description: string;
  onSave: (triggerEvent: string, variants: TemplateVariant[]) => Promise<void>;
}

const AVAILABLE_LANGUAGES = [
  { value: "en", label: "English (Default)" },
  { value: "id", label: "Indonesian" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
];

export function TemplateForm({
  triggerEvent,
  initialVariants,
  description,
  onSave,
}: TemplateFormProps) {
  const [variants, setVariants] = useState<TemplateVariant[]>(
    initialVariants.length > 0
      ? initialVariants
      : [{ language_code: "en", content: "" }],
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleContentChange = (index: number, content: string) => {
    const newVariants = [...variants];
    newVariants[index].content = content;
    setVariants(newVariants);
  };

  const handleLanguageChange = (index: number, lang: string | null) => {
    if (!lang) return;
    const newVariants = [...variants];
    newVariants[index].language_code = lang;
    setVariants(newVariants);
  };

  const addVariant = () => {
    const usedLangs = variants.map((v) => v.language_code);
    const available = AVAILABLE_LANGUAGES.find(
      (l) => !usedLangs.includes(l.value),
    );

    if (available) {
      setVariants([
        ...variants,
        { language_code: available.value, content: "" },
      ]);
    } else {
      notifications.show({
        title: "Notice",
        message: "All supported languages added.",
        color: "blue",
      });
    }
  };

  const removeVariant = (index: number) => {
    const newVariants = [...variants];
    newVariants.splice(index, 1);
    setVariants(newVariants);
  };

  const handleSave = async () => {
    const emptyContents = variants.some((v) => !v.content.trim());
    if (emptyContents) {
      notifications.show({
        title: "Validation Error",
        message: "Message content cannot be empty.",
        color: "red",
      });
      return;
    }

    const langs = variants.map((v) => v.language_code);
    const hasDuplicates = new Set(langs).size !== langs.length;
    if (hasDuplicates) {
      notifications.show({
        title: "Validation Error",
        message: "Duplicate language variants are not allowed.",
        color: "red",
      });
      return;
    }

    setIsSaving(true);
    try {
      await onSave(triggerEvent, variants);
      notifications.show({
        title: "Success",
        message: "Templates saved successfully!",
        color: "green",
        icon: <IconCheck size={16} />,
      });
    } catch (error: any) {
      notifications.show({
        title: "Error",
        message: error.message || "Failed to save templates.",
        color: "red",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const availableVariables = [
    "{{guestName}}",
    "{{roomNumber}}",
    "{{checkInDate}}",
    "{{checkOutDate}}",
    "{{hotelName}}",
  ];

  return (
    <Card withBorder padding="md" radius="md">
      <Stack gap="lg">
        <Text fw={500}>{description}</Text>
        <Text size="sm" c="dimmed">
          Available Variables:{" "}
          <Text component="span" fw={500} c="blue">
            {availableVariables.join(", ")}
          </Text>
        </Text>

        {variants.map((variant, index) => (
          <div key={index} className="border rounded-md p-4 bg-gray-50/50">
            <Group justify="space-between" mb="sm">
              <Select
                label="Language"
                data={AVAILABLE_LANGUAGES}
                value={variant.language_code}
                onChange={(val) => handleLanguageChange(index, val)}
                allowDeselect={false}
                w={200}
                disabled={
                  variants.length === 1 && variant.language_code === "en"
                }
              />
              {variants.length > 1 && (
                <Tooltip label="Remove variation">
                  <ActionIcon
                    color="red"
                    variant="light"
                    onClick={() => removeVariant(index)}
                    mt={24}
                  >
                    <IconTrash size={18} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>

            <Textarea
              label="Message Content"
              placeholder={`Hello {{guestName}}, welcome to {{hotelName}}!`}
              minRows={4}
              value={variant.content}
              onChange={(e) =>
                handleContentChange(index, e.currentTarget.value)
              }
              required
            />
          </div>
        ))}

        <Group justify="space-between">
          <Button variant="outline" color="gray" onClick={addVariant}>
            + Add Language Variant
          </Button>
          <Button onClick={handleSave} loading={isSaving}>
            Save Changes
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
