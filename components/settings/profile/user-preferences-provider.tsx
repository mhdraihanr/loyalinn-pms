"use client";

import { useEffect } from "react";
import { useMantineColorScheme } from "@mantine/core";
import { createClient } from "@/lib/supabase/client";
import { getUserPreferencesFromMetadata } from "@/lib/user-preferences";

export function UserPreferencesProvider({ children }: { children: React.ReactNode }) {
  const { setColorScheme } = useMantineColorScheme();

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      const preferences = getUserPreferencesFromMetadata(
        data.user?.user_metadata ?? {},
      );

      setColorScheme(
        preferences.theme === "dark"
          ? "dark"
          : preferences.theme === "light"
            ? "light"
            : "auto",
      );
    });
  }, [setColorScheme]);

  return children;
}
