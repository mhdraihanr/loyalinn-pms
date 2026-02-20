"use client";

import { Button } from "@mantine/core";
import { useFormStatus } from "react-dom";

export function AcceptInviteButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" fullWidth color="teal" loading={pending}>
      Accept invitation &amp; join team
    </Button>
  );
}
