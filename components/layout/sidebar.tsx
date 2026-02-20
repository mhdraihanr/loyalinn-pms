"use client";

import { useState } from "react";
import {
  Stack,
  Text,
  NavLink,
  Button,
  Modal,
  Group,
  ThemeIcon,
  Divider,
  Box,
} from "@mantine/core";
import {
  IconLayoutDashboard,
  IconUsers,
  IconCalendarEvent,
  IconSettings,
  IconBuildingSkyscraper,
  IconLogout,
} from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutUser } from "@/lib/auth/logout";

const navItems = [
  { href: "/", label: "Dashboard", icon: IconLayoutDashboard },
  { href: "/guests", label: "Guests", icon: IconUsers },
  {
    href: "/reservations",
    label: "Reservations",
    icon: IconCalendarEvent,
  },
  { href: "/settings", label: "Settings", icon: IconSettings },
  { href: "/settings/pms", label: "PMS Config", icon: IconSettings },
];

export function Sidebar({ hotelName }: { hotelName: string }) {
  const pathname = usePathname();
  const [logoutOpen, setLogoutOpen] = useState(false);

  return (
    <>
      <Box
        style={{
          width: 240,
          minHeight: "100vh",
          borderRight: "1px solid var(--mantine-color-gray-2)",
          background: "white",
          display: "flex",
          flexDirection: "column",
          padding: "var(--mantine-spacing-md)",
        }}
      >
        {/* Logo / Hotel Name */}
        <Group gap="xs" mb="xl" px="xs">
          <ThemeIcon size={32} radius="sm" variant="filled" color="blue">
            <IconBuildingSkyscraper size={18} />
          </ThemeIcon>
          <Stack gap={0}>
            <Text fw={700} size="sm" lineClamp={1}>
              {hotelName}
            </Text>
            <Text size="xs" c="dimmed">
              Hotel PMS
            </Text>
          </Stack>
        </Group>

        <Divider mb="md" />

        {/* Nav links */}
        <Stack gap={4} style={{ flex: 1 }}>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <NavLink
                key={item.href}
                component={Link}
                href={item.href}
                label={item.label}
                leftSection={<item.icon size={18} />}
                active={isActive}
              />
            );
          })}
        </Stack>

        <Divider my="md" />

        {/* Logout button */}
        <Button
          variant="subtle"
          color="red"
          leftSection={<IconLogout size={16} />}
          justify="start"
          fullWidth
          radius="md"
          onClick={() => setLogoutOpen(true)}
        >
          Sign out
        </Button>
      </Box>

      {/* Logout confirmation modal */}
      <Modal
        opened={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        title="Sign out"
        centered
        size="sm"
        radius="md"
      >
        <Text size="sm" mb="lg">
          Are you sure you want to sign out?
        </Text>
        <Group justify="flex-end" gap="sm">
          <Button
            variant="default"
            radius="md"
            onClick={() => setLogoutOpen(false)}
          >
            Cancel
          </Button>
          <form action={signOutUser}>
            <Button type="submit" color="red" radius="md">
              Sign out
            </Button>
          </form>
        </Group>
      </Modal>
    </>
  );
}
