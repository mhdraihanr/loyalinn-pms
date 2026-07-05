import { Box } from "@mantine/core";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <Box
      style={{
        minHeight: "100vh",
        background: "#ffffff",
      }}
    >
      {children}
    </Box>
  );
}
