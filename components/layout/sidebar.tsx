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
  IconMessage,
  IconSettings,
  IconBuildingSkyscraper,
  IconLogout,
  IconUserCircle,
} from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutUser } from "@/lib/auth/logout";

const configurationItems = [
  { href: "/settings/pms", label: "PMS Config", icon: IconSettings },
  { href: "/settings/waha", label: "WhatsApp Connect", icon: IconSettings },
  { href: "/settings/ai", label: "AI Assistant", icon: IconSettings },
  {
    href: "/settings/templates",
    label: "Message Templates",
    icon: IconSettings,
  },
];

const teamItems = [
  { href: "/settings/team", label: "Team Management", icon: IconUsers },
];

const developerItems =
  process.env.NODE_ENV === "development"
    ? [
        {
          href: "/settings/developer",
          label: "Dev Tools (Time Machine)",
          icon: IconSettings,
        },
      ]
    : [];

const navGroups = [
  {
    label: "FRONT DESK",
    items: [
      { href: "/", label: "Dashboard", icon: IconLayoutDashboard },
      { href: "/guests", label: "Guests", icon: IconUsers },
      {
        href: "/reservations",
        label: "Reservations",
        icon: IconCalendarEvent,
      },
      {
        href: "/feedback",
        label: "Feedback Monitor",
        icon: IconMessage,
      },
    ],
  },
  {
    label: "OPERATIONS",
    items: [
      {
        href: "/operations",
        label: "AI Requests ",
        icon: IconLayoutDashboard, // You can change this later to IconConciergeBell or similar
      },
      { href: "/settings/service-catalog", label: "Menu & Facilities", icon: IconSettings },
    ],
  },
  {
    label: "CONFIGURATION",
    items: configurationItems,
  },
  {
    label: "TEAM",
    items: teamItems,
  },
  ...(developerItems.length > 0
    ? [
        {
          label: "DEVELOPER",
          items: developerItems,
        },
      ]
    : []),
];

type SidebarProps = {
  hotelName: string;
  userRole: string;
};

export function Sidebar({ hotelName, userRole }: SidebarProps) {
  const pathname = usePathname();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const isProfileActive = pathname === "/settings/profile";

  return (
    <>
      <Box
        style={{
          width: 240,
          height: "100vh",
          position: "sticky",
          top: 0,
          alignSelf: "flex-start",
          borderRight: "1px solid var(--mantine-color-gray-2)",
          background: "var(--mantine-color-body)",
          display: "flex",
          flexDirection: "column",
          padding: "var(--mantine-spacing-md)",
          overflow: "hidden",
        }}
      >
        {/* Logo / Hotel Name */}
        <Group gap="xs" mb="md" px="xs">
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

        <Divider mb="sm" />

        {/* Nav links */}
        <Stack
          gap={2}
          style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}
        >
          {navGroups.map((group) => (
            <Box key={group.label} mb={8}>
              <Text size="xs" fw={600} c="dimmed" mb={4} px="sm">
                {group.label}
              </Text>
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <NavLink
                    key={item.href}
                    component={Link}
                    href={item.href}
                    label={item.label}
                    leftSection={<item.icon size={16} />}
                    active={isActive}
                    variant="light"
                    style={{ borderRadius: "var(--mantine-radius-sm)" }}
                    styles={{
                      root: {
                        minHeight: 36,
                        paddingBlock: 6,
                        paddingInline: 10,
                      },
                    }}
                  />
                );
              })}
            </Box>
          ))}
        </Stack>

        <Divider my="md" />

        <NavLink
          component={Link}
          href="/settings/profile"
          label="My Profile"
          description={userRole}
          leftSection={<IconUserCircle size={16} />}
          active={isProfileActive}
          variant="light"
          mb="xs"
          style={{ borderRadius: "var(--mantine-radius-sm)" }}
          styles={{
            root: {
              minHeight: 44,
              paddingBlock: 6,
              paddingInline: 10,
            },
            description: { textTransform: "capitalize" },
          }}
        />

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
