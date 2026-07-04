"use client";

import { useState, useTransition } from "react";
import {
  Button,
  Group,
  PasswordInput,
  Select,
  Stack,
  Text,
  useMantineColorScheme,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { createClient } from "@/lib/supabase/client";
import type { UserPreferences } from "@/lib/user-preferences";

const timezoneOptions = [
  { value: "Asia/Jakarta", label: "Asia/Jakarta" },
  { value: "Asia/Makassar", label: "Asia/Makassar" },
  { value: "Asia/Jayapura", label: "Asia/Jayapura" },
  { value: "UTC", label: "UTC" },
];

const dateFormatOptions = [
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
  { value: "MMM D, YYYY", label: "MMM D, YYYY" },
];

const themeOptions = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function PreferencesForm({ initialValues }: { initialValues: UserPreferences }) {
  const [values, setValues] = useState(initialValues);
  const [isPending, startTransition] = useTransition();
  const { setColorScheme } = useMantineColorScheme();

  const updateValue = (key: keyof UserPreferences, value: string | null) => {
    if (!value) return;
    setValues((current) => ({ ...current, [key]: value }));
  };

  const savePreferences = () => {
    startTransition(async () => {
      const supabase = createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError || !userData.user) {
        notifications.show({
          title: "Failed to save preferences",
          message: userError?.message ?? "User session is not available.",
          color: "red",
        });
        return;
      }

      const currentMetadata = userData.user.user_metadata ?? {};
      const { error } = await supabase.auth.updateUser({
        data: {
          ...currentMetadata,
          preferences: values,
        },
      });

      if (error) {
        notifications.show({
          title: "Failed to save preferences",
          message: error.message,
          color: "red",
        });
        return;
      }

      setColorScheme(
        values.theme === "dark"
          ? "dark"
          : values.theme === "light"
            ? "light"
            : "auto",
      );
      notifications.show({
        title: "Preferences saved",
        message: "Your personal preferences have been updated.",
        color: "green",
      });
    });
  };

  return (
    <Stack gap="md">
      <Select
        label="Timezone"
        data={timezoneOptions}
        value={values.timezone}
        onChange={(value) => updateValue("timezone", value)}
        allowDeselect={false}
      />
      <Select
        label="Date format"
        data={dateFormatOptions}
        value={values.dateFormat}
        onChange={(value) => updateValue("dateFormat", value)}
        allowDeselect={false}
      />
      <Select
        label="Theme"
        data={themeOptions}
        value={values.theme}
        onChange={(value) => updateValue("theme", value)}
        allowDeselect={false}
      />
      <Group justify="flex-end">
        <Button onClick={savePreferences} loading={isPending}>
          Save preferences
        </Button>
      </Group>
    </Stack>
  );
}

export function ChangePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPending, startTransition] = useTransition();

  const changePassword = () => {
    if (password.length < 8) {
      notifications.show({
        title: "Password is too short",
        message: "Use at least 8 characters.",
        color: "red",
      });
      return;
    }

    if (password !== confirmPassword) {
      notifications.show({
        title: "Passwords do not match",
        message: "Confirm password must match the new password.",
        color: "red",
      });
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        notifications.show({
          title: "Failed to change password",
          message: error.message,
          color: "red",
        });
        return;
      }

      setPassword("");
      setConfirmPassword("");
      notifications.show({
        title: "Password changed",
        message: "Your password has been updated.",
        color: "green",
      });
    });
  };

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Use at least 8 characters. Depending on Supabase Auth settings, you may
        need to reauthenticate before a password change is accepted.
      </Text>
      <PasswordInput
        label="New password"
        value={password}
        onChange={(event) => setPassword(event.currentTarget.value)}
      />
      <PasswordInput
        label="Confirm new password"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.currentTarget.value)}
      />
      <Group justify="flex-end">
        <Button onClick={changePassword} loading={isPending}>
          Change password
        </Button>
      </Group>
    </Stack>
  );
}
