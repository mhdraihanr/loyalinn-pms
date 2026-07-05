import type { Metadata } from "next";
import {
  ColorSchemeScript,
  MantineProvider,
  mantineHtmlProps,
  createTheme,
} from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { UserPreferencesProvider } from "@/components/settings/profile/user-preferences-provider";
import "./globals.css";

const theme = createTheme({
  primaryColor: "blue",
  fontFamily: "Inter, sans-serif",
});

export const metadata: Metadata = {
  title: "Hotel PMS — WhatsApp Automation",
  description: "Hotel PMS integration and WhatsApp automation platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body suppressHydrationWarning>
        <MantineProvider theme={theme} defaultColorScheme="light">
          <UserPreferencesProvider>
            <Notifications position="top-right" />
            {children}
          </UserPreferencesProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
