"use client";

import { useState } from "react";
import { Button, Group, Text, Alert } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconCheck,
  IconAlertCircle,
  IconClockHour4,
} from "@tabler/icons-react";
import { DateTimePicker } from "@mantine/dates";
// @ts-ignore: Mantine CSS module types mapping issue
import "@mantine/dates/styles.css";

export function DeveloperTimeMachine() {
  const [targetDate, setTargetDate] = useState<Date | null>(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    preArrivalEnqueued: number;
    postStayEnqueued: number;
    processed: number;
    deadLettered: number;
    message?: string;
  } | null>(null);

  const handleSimulate = async () => {
    if (!targetDate) return;

    setIsLoading(true);
    setResult(null);

    // Provide a neat formatted warning/notification
    notifications.show({
      id: "simulate-start",
      loading: true,
      title: "Time Traveling...",
      message: `Triggering worker as if the time is ${targetDate.toLocaleString()}`,
      autoClose: false,
      withCloseButton: false,
    });

    try {
      const response = await fetch("/api/dev/scheduler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          simulatedDateIso: targetDate.toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();

      setResult({
        preArrivalEnqueued: data.preArrivalEnqueued,
        postStayEnqueued: data.postStayEnqueued,
        processed: data.processed,
        deadLettered: data.deadLettered,
      });

      notifications.update({
        id: "simulate-start",
        color: "teal",
        title: "Simulation Complete",
        message: `Enqueued ${data.preArrivalEnqueued} pre-arrival, ${data.postStayEnqueued} post-stay jobs.`,
        icon: <IconCheck size={18} />,
        loading: false,
        autoClose: 4000,
      });
    } catch (error) {
      notifications.update({
        id: "simulate-start",
        color: "red",
        title: "Simulation Failed",
        message:
          error instanceof Error ? error.message : "Internal Server Error",
        icon: <IconAlertCircle size={18} />,
        loading: false,
        autoClose: 4000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Group align="flex-end">
        <DateTimePicker
          label="Time Machine Target Date"
          description="Select a future or past date/time to test the Cron worker."
          placeholder="Pick date and time"
          value={targetDate}
          onChange={(date) => {
            if (date) {
              setTargetDate(new Date(date));
            } else {
              setTargetDate(null);
            }
          }}
          w={280}
        />
        <Button
          leftSection={<IconClockHour4 size={18} />}
          variant="filled"
          color="indigo"
          onClick={handleSimulate}
          loading={isLoading}
        >
          Simulate Cron Worker
        </Button>
      </Group>

      {result && (
        <Alert
          icon={<IconCheck size={18} />}
          title="Success"
          color="green"
          mt="md"
        >
          <Text fw={500}>Cron Results for {targetDate?.toLocaleString()}:</Text>
          <ul className="list-disc pl-5 mt-2">
            <li>
              <strong>Pre-arrival Jobs Created: </strong>{" "}
              {result.preArrivalEnqueued}
            </li>
            <li>
              <strong>Post-stay Jobs Created: </strong>{" "}
              {result.postStayEnqueued}
            </li>
            <li>
              <strong>Jobs Directly Processed: </strong> {result.processed}
            </li>
            {result.deadLettered > 0 && (
              <li className="text-red-600">
                <strong>Dead-Lettered (Failed jobs): </strong>{" "}
                {result.deadLettered}
              </li>
            )}
          </ul>
          <Text size="sm" c="dimmed" mt="xs">
            Note: The scheduler window lock (must be &gt;10AM UTC) applies only
            in production. Time Machine forces a bypass of the logic constraint!
          </Text>
        </Alert>
      )}
    </div>
  );
}
