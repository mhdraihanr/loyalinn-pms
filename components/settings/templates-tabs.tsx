"use client";

import { Tabs, Title, Text } from "@mantine/core";
import {
  TemplateForm,
  TemplateVariant,
} from "@/components/settings/template-form";

interface TemplatesTabsProps {
  variantsData: {
    "pre-arrival": TemplateVariant[];
    "on-stay": TemplateVariant[];
    "post-stay": TemplateVariant[];
  };
  saveAction: (
    triggerEvent: string,
    variants: TemplateVariant[],
  ) => Promise<void>;
}

export function TemplatesTabs({
  variantsData,
  saveAction,
}: TemplatesTabsProps) {
  return (
    <div className="space-y-6">
      <div>
        <Title order={1} className="text-3xl font-bold tracking-tight">
          Message Templates
        </Title>
        <Text c="dimmed">
          Configure automated messages for different stages of the guest
          journey.
        </Text>
      </div>

      <Tabs defaultValue="pre-arrival" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="pre-arrival">Pre-Arrival</Tabs.Tab>
          <Tabs.Tab value="on-stay">On-Stay</Tabs.Tab>
          <Tabs.Tab value="post-stay">Post-Stay</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="pre-arrival">
          <TemplateForm
            triggerEvent="pre-arrival"
            initialVariants={variantsData["pre-arrival"]}
            description="Sent 1-2 days before check-in date."
            onSave={saveAction}
          />
        </Tabs.Panel>

        <Tabs.Panel value="on-stay">
          <TemplateForm
            triggerEvent="on-stay"
            initialVariants={variantsData["on-stay"]}
            description="Can be triggered manually or upon check-in to provide WiFi passwords and info."
            onSave={saveAction}
          />
        </Tabs.Panel>

        <Tabs.Panel value="post-stay">
          <TemplateForm
            triggerEvent="post-stay"
            initialVariants={variantsData["post-stay"]}
            description="Sent after check-out to collect feedback and reviews."
            onSave={saveAction}
          />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
