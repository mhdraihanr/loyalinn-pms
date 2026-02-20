import { Box, Center } from "@mantine/core";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <Box
      style={{
        minHeight: "100vh",
        background: "var(--mantine-color-gray-0)",
      }}
    >
      <Center style={{ minHeight: "100vh" }}>{children}</Center>
    </Box>
  );
}
