import { Box, Paper, Text, Alert, Anchor } from "@mantine/core";

export function InviteErrorBox({ message }: { message: string }) {
  return (
    <Box w="100%" maw={440} px="md">
      <Paper radius="md" p="xl" withBorder shadow="sm">
        <Alert color="red" radius="md">
          <Text fw={500} mb={4}>
            Invitation error
          </Text>
          <Text size="sm">{message}</Text>
          <Anchor href="/login" size="sm" mt="xs" display="block">
            Return to login
          </Anchor>
        </Alert>
      </Paper>
    </Box>
  );
}
