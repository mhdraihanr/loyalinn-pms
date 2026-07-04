"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  defaultUserPreferences,
  getUserPreferencesFromMetadata,
  type UserPreferences,
} from "@/lib/user-preferences";

export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(
    defaultUserPreferences,
  );

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      setPreferences(
        getUserPreferencesFromMetadata(data.user?.user_metadata ?? {}),
      );
    });
  }, []);

  return preferences;
}
