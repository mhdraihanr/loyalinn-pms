"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconBuildingCommunity,
  IconCheck,
  IconEdit,
  IconPlus,
  IconSearch,
  IconToolsKitchen2,
  IconTrash,
} from "@tabler/icons-react";

import type {
  ServiceCatalogAvailability,
  ServiceCatalogCategory,
  ServiceCatalogCategoryType,
  ServiceCatalogData,
  ServiceCatalogFulfillment,
  ServiceCatalogItem,
  ServiceCatalogItemType,
} from "@/lib/data/service-catalog";
import type {
  ServiceCatalogCategoryInput,
  ServiceCatalogItemInput,
} from "@/lib/actions/service-catalog";

type ActionResult = Promise<{ success?: boolean; error?: string }>;

type ServiceCatalogManagerProps = {
  initialData: ServiceCatalogData;
  canManage: boolean;
  saveCategoryAction: (input: ServiceCatalogCategoryInput) => ActionResult;
  deleteCategoryAction: (id: string) => ActionResult;
  saveItemAction: (input: ServiceCatalogItemInput) => ActionResult;
  deleteItemAction: (id: string) => ActionResult;
};

type CategoryFormState = {
  id?: string;
  type: ServiceCatalogCategoryType;
  name: string;
  description: string;
  sort_order: number;
  is_active: boolean;
};

type ItemFormState = {
  id?: string;
  category_id: string;
  item_type: ServiceCatalogItemType;
  name: string;
  description: string;
  price: number | null;
  currency: string;
  unit: string;
  availability_status: ServiceCatalogAvailability;
  available_start_time: string;
  available_end_time: string;
  location: string;
  preparation_minutes: number | null;
  fulfillment_type: ServiceCatalogFulfillment;
  guest_notes: string;
  staff_notes: string;
  sort_order: number;
  is_active: boolean;
  aliasesText: string;
};

const CATEGORY_TYPE_LABELS: Record<ServiceCatalogCategoryType, string> = {
  room_service: "Room Service",
  facility: "Facilities",
};

const ITEM_TYPE_OPTIONS = [
  { value: "food", label: "Food" },
  { value: "drink", label: "Drink" },
  { value: "facility", label: "Facility" },
  { value: "service", label: "Service" },
  { value: "amenity", label: "Amenity" },
];

const AVAILABILITY_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "limited", label: "Limited" },
  { value: "by_request", label: "By request" },
  { value: "unavailable", label: "Unavailable" },
];

const FULFILLMENT_OPTIONS = [
  { value: "room_service", label: "Room service order" },
  { value: "housekeeping", label: "Housekeeping request" },
  { value: "front_office", label: "Front office follow-up" },
  { value: "concierge", label: "Concierge follow-up" },
  { value: "info_only", label: "Information only" },
];

const availabilityColors: Record<ServiceCatalogAvailability, string> = {
  available: "green",
  limited: "yellow",
  by_request: "blue",
  unavailable: "red",
};

function emptyCategory(type: ServiceCatalogCategoryType): CategoryFormState {
  return {
    type,
    name: "",
    description: "",
    sort_order: 0,
    is_active: true,
  };
}

function emptyItem(categoryId = ""): ItemFormState {
  return {
    category_id: categoryId,
    item_type: "food",
    name: "",
    description: "",
    price: null,
    currency: "IDR",
    unit: "",
    availability_status: "available",
    available_start_time: "",
    available_end_time: "",
    location: "",
    preparation_minutes: null,
    fulfillment_type: "room_service",
    guest_notes: "",
    staff_notes: "",
    sort_order: 0,
    is_active: true,
    aliasesText: "",
  };
}

function categoryToForm(category: ServiceCatalogCategory): CategoryFormState {
  return {
    id: category.id,
    type: category.type,
    name: category.name,
    description: category.description ?? "",
    sort_order: category.sort_order,
    is_active: category.is_active,
  };
}

function itemToForm(item: ServiceCatalogItem): ItemFormState {
  return {
    id: item.id,
    category_id: item.category_id,
    item_type: item.item_type,
    name: item.name,
    description: item.description ?? "",
    price: item.price,
    currency: item.currency,
    unit: item.unit ?? "",
    availability_status: item.availability_status,
    available_start_time: item.available_start_time ?? "",
    available_end_time: item.available_end_time ?? "",
    location: item.location ?? "",
    preparation_minutes: item.preparation_minutes,
    fulfillment_type: item.fulfillment_type,
    guest_notes: item.guest_notes ?? "",
    staff_notes: item.staff_notes ?? "",
    sort_order: item.sort_order,
    is_active: item.is_active,
    aliasesText: item.aliases.join(", "),
  };
}

function formatPrice(item: ServiceCatalogItem) {
  if (item.price === null) return "-";
  return `${item.currency} ${item.price.toLocaleString("id-ID")}`;
}

function matchesItem(item: ServiceCatalogItem, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [
    item.name,
    item.description,
    item.category?.name,
    item.item_type,
    item.availability_status,
    item.fulfillment_type,
    item.location,
    item.guest_notes,
    item.staff_notes,
    ...item.aliases,
  ]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(normalized));
}

export function ServiceCatalogManager({
  initialData,
  canManage,
  saveCategoryAction,
  deleteCategoryAction,
  saveItemAction,
  deleteItemAction,
}: ServiceCatalogManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [categoryForm, setCategoryForm] = useState<CategoryFormState | null>(
    null,
  );
  const [itemForm, setItemForm] = useState<ItemFormState | null>(null);

  const roomServiceCategories = initialData.categories.filter(
    (category) => category.type === "room_service",
  );
  const facilityCategories = initialData.categories.filter(
    (category) => category.type === "facility",
  );

  const filteredItems = useMemo(
    () => initialData.items.filter((item) => matchesItem(item, query)),
    [initialData.items, query],
  );

  const roomServiceItems = filteredItems.filter((item) =>
    ["food", "drink"].includes(item.item_type),
  );
  const facilityItems = filteredItems.filter((item) =>
    ["facility", "service", "amenity"].includes(item.item_type),
  );

  const categoryOptions = initialData.categories.map((category) => ({
    value: category.id,
    label: `${category.name} (${CATEGORY_TYPE_LABELS[category.type]})`,
  }));

  async function handleResult(result: { success?: boolean; error?: string }) {
    if (result.error) throw new Error(result.error);
    notifications.show({
      title: "Saved",
      message: "Service catalog updated.",
      color: "green",
      icon: <IconCheck size={16} />,
    });
    router.refresh();
  }

  function submitCategory() {
    if (!categoryForm) return;
    startTransition(async () => {
      try {
        await handleResult(await saveCategoryAction(categoryForm));
        setCategoryForm(null);
      } catch (error) {
        notifications.show({
          title: "Error",
          message:
            error instanceof Error ? error.message : "Failed to save category.",
          color: "red",
        });
      }
    });
  }

  function submitItem() {
    if (!itemForm) return;
    const payload: ServiceCatalogItemInput = {
      ...itemForm,
      available_start_time: itemForm.available_start_time || null,
      available_end_time: itemForm.available_end_time || null,
      aliases: itemForm.aliasesText
        .split(",")
        .map((alias) => alias.trim())
        .filter(Boolean),
    };

    startTransition(async () => {
      try {
        await handleResult(await saveItemAction(payload));
        setItemForm(null);
      } catch (error) {
        notifications.show({
          title: "Error",
          message: error instanceof Error ? error.message : "Failed to save item.",
          color: "red",
        });
      }
    });
  }

  function removeCategory(category: ServiceCatalogCategory) {
    startTransition(async () => {
      try {
        await handleResult(await deleteCategoryAction(category.id));
      } catch (error) {
        notifications.show({
          title: "Error",
          message:
            error instanceof Error
              ? error.message
              : "Failed to delete category. Disable it if items still use it.",
          color: "red",
        });
      }
    });
  }

  function removeItem(item: ServiceCatalogItem) {
    startTransition(async () => {
      try {
        await handleResult(await deleteItemAction(item.id));
      } catch (error) {
        notifications.show({
          title: "Error",
          message:
            error instanceof Error
              ? error.message
              : "Failed to delete catalog item.",
          color: "red",
        });
      }
    });
  }

  function renderItems(items: ServiceCatalogItem[], emptyLabel: string) {
    if (items.length === 0) {
      return (
        <Paper withBorder radius="md" p="xl">
          <Stack gap="sm" align="center">
            <ThemeIcon size={44} radius="xl" variant="light" color="gray">
              <IconSearch size={20} />
            </ThemeIcon>
            <Text fw={600}>{emptyLabel}</Text>
            <Text size="sm" c="dimmed" ta="center">
              Tambahkan data agar AI bisa menjawab tamu dari catalog, bukan
              mengarang menu atau fasilitas.
            </Text>
          </Stack>
        </Paper>
      );
    }

    return (
      <Table highlightOnHover verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Category</Table.Th>
            <Table.Th>Availability</Table.Th>
            <Table.Th>Fulfillment</Table.Th>
            <Table.Th>Price</Table.Th>
            <Table.Th>Aliases</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((item) => (
            <Table.Tr key={item.id}>
              <Table.Td>
                <Stack gap={0}>
                  <Group gap="xs">
                    <Text fw={500} size="sm">
                      {item.name}
                    </Text>
                    {!item.is_active && (
                      <Badge color="gray" variant="light">
                        inactive
                      </Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed" lineClamp={2}>
                    {item.description || item.guest_notes || "No guest-facing description"}
                  </Text>
                </Stack>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{item.category?.name ?? "-"}</Text>
                <Text size="xs" c="dimmed">
                  {item.item_type}
                </Text>
              </Table.Td>
              <Table.Td>
                <Badge color={availabilityColors[item.availability_status]} variant="light">
                  {item.availability_status.replace("_", " ")}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{item.fulfillment_type.replace("_", " ")}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{formatPrice(item)}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="xs" c="dimmed" lineClamp={2}>
                  {item.aliases.length > 0 ? item.aliases.join(", ") : "-"}
                </Text>
              </Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <ActionIcon
                    variant="light"
                    aria-label={`Edit ${item.name}`}
                    disabled={!canManage}
                    onClick={() => setItemForm(itemToForm(item))}
                  >
                    <IconEdit size={16} />
                  </ActionIcon>
                  <ActionIcon
                    color="red"
                    variant="light"
                    aria-label={`Delete ${item.name}`}
                    disabled={!canManage}
                    onClick={() => removeItem(item)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    );
  }

  function renderCategories(categories: ServiceCatalogCategory[], type: ServiceCatalogCategoryType) {
    return (
      <Stack gap="sm">
        <Group justify="space-between">
          <Text fw={600}>{CATEGORY_TYPE_LABELS[type]} categories</Text>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconPlus size={14} />}
            disabled={!canManage}
            onClick={() => setCategoryForm(emptyCategory(type))}
          >
            Add category
          </Button>
        </Group>
        {categories.length === 0 ? (
          <Text size="sm" c="dimmed">
            No categories yet.
          </Text>
        ) : (
          <Group gap="xs">
            {categories.map((category) => (
              <Badge
                key={category.id}
                variant="light"
                color={category.is_active ? "blue" : "gray"}
                rightSection={
                  canManage ? (
                    <ActionIcon
                      size="xs"
                      variant="transparent"
                      aria-label={`Edit ${category.name}`}
                      onClick={() => setCategoryForm(categoryToForm(category))}
                    >
                      <IconEdit size={10} />
                    </ActionIcon>
                  ) : null
                }
              >
                {category.name}
              </Badge>
            ))}
          </Group>
        )}
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="end">
        <Stack gap={2}>
          <Title order={1} className="text-3xl font-bold tracking-tight">
            Menu & Facilities
          </Title>
          <Text c="dimmed">
            Kelola data room service, makanan, minuman, fasilitas, dan layanan
            yang boleh dijawab oleh AI saat tamu sedang on-stay.
          </Text>
        </Stack>
        <TextInput
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Search menu or facilities"
          leftSection={<IconSearch size={16} />}
          w={{ base: "100%", sm: 300 }}
        />
      </Group>

      {!canManage && (
        <Card withBorder radius="md" padding="md">
          <Text size="sm" c="dimmed">
            Staff can view this catalog. Only owners can edit menu and facility
            configuration.
          </Text>
        </Card>
      )}

      <Tabs defaultValue="room-service" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="room-service" leftSection={<IconToolsKitchen2 size={16} />}>
            Room Service Menu
          </Tabs.Tab>
          <Tabs.Tab value="facilities" leftSection={<IconBuildingCommunity size={16} />}>
            Facilities & Services
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="room-service">
          <Stack gap="md">
            {renderCategories(roomServiceCategories, "room_service")}
            <Group justify="flex-end">
              <Button
                leftSection={<IconPlus size={16} />}
                disabled={!canManage || roomServiceCategories.length === 0}
                onClick={() => setItemForm(emptyItem(roomServiceCategories[0]?.id))}
              >
                Add menu item
              </Button>
            </Group>
            {renderItems(roomServiceItems, "No room-service menu items found")}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="facilities">
          <Stack gap="md">
            {renderCategories(facilityCategories, "facility")}
            <Group justify="flex-end">
              <Button
                leftSection={<IconPlus size={16} />}
                disabled={!canManage || facilityCategories.length === 0}
                onClick={() => {
                  const next = emptyItem(facilityCategories[0]?.id);
                  next.item_type = "facility";
                  next.fulfillment_type = "info_only";
                  setItemForm(next);
                }}
              >
                Add facility/service
              </Button>
            </Group>
            {renderItems(facilityItems, "No facilities or services found")}
          </Stack>
        </Tabs.Panel>
      </Tabs>

      <Modal
        opened={categoryForm !== null}
        onClose={() => setCategoryForm(null)}
        title={categoryForm?.id ? "Edit category" : "Add category"}
        centered
      >
        {categoryForm && (
          <Stack gap="md">
            <Select
              label="Type"
              data={[
                { value: "room_service", label: "Room Service" },
                { value: "facility", label: "Facilities" },
              ]}
              value={categoryForm.type}
              onChange={(value) =>
                value &&
                setCategoryForm({
                  ...categoryForm,
                  type: value as ServiceCatalogCategoryType,
                })
              }
              allowDeselect={false}
            />
            <TextInput
              label="Name"
              value={categoryForm.name}
              onChange={(event) =>
                setCategoryForm({ ...categoryForm, name: event.currentTarget.value })
              }
              required
            />
            <Textarea
              label="Description"
              value={categoryForm.description}
              onChange={(event) =>
                setCategoryForm({
                  ...categoryForm,
                  description: event.currentTarget.value,
                })
              }
            />
            <NumberInput
              label="Sort order"
              value={categoryForm.sort_order}
              onChange={(value) =>
                setCategoryForm({
                  ...categoryForm,
                  sort_order: typeof value === "number" ? value : 0,
                })
              }
            />
            <Switch
              label="Active"
              checked={categoryForm.is_active}
              onChange={(event) =>
                setCategoryForm({
                  ...categoryForm,
                  is_active: event.currentTarget.checked,
                })
              }
            />
            <Group justify="space-between">
              {categoryForm.id && (
                <Button
                  color="red"
                  variant="light"
                  loading={isPending}
                  onClick={() => {
                    removeCategory(categoryForm as ServiceCatalogCategory);
                    setCategoryForm(null);
                  }}
                >
                  Delete
                </Button>
              )}
              <Box flex={1} />
              <Button variant="default" onClick={() => setCategoryForm(null)}>
                Cancel
              </Button>
              <Button loading={isPending} onClick={submitCategory}>
                Save
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      <Modal
        opened={itemForm !== null}
        onClose={() => setItemForm(null)}
        title={itemForm?.id ? "Edit catalog item" : "Add catalog item"}
        centered
        size="lg"
      >
        {itemForm && (
          <Stack gap="md">
            <Group grow align="start">
              <Select
                label="Category"
                data={categoryOptions}
                value={itemForm.category_id}
                onChange={(value) =>
                  value && setItemForm({ ...itemForm, category_id: value })
                }
                allowDeselect={false}
                required
              />
              <Select
                label="Item type"
                data={ITEM_TYPE_OPTIONS}
                value={itemForm.item_type}
                onChange={(value) =>
                  value &&
                  setItemForm({
                    ...itemForm,
                    item_type: value as ServiceCatalogItemType,
                  })
                }
                allowDeselect={false}
              />
            </Group>

            <TextInput
              label="Name"
              value={itemForm.name}
              onChange={(event) =>
                setItemForm({ ...itemForm, name: event.currentTarget.value })
              }
              required
            />
            <Textarea
              label="Description"
              value={itemForm.description}
              onChange={(event) =>
                setItemForm({ ...itemForm, description: event.currentTarget.value })
              }
            />

            <Group grow align="start">
              <NumberInput
                label="Price"
                value={itemForm.price ?? undefined}
                min={0}
                onChange={(value) =>
                  setItemForm({
                    ...itemForm,
                    price: typeof value === "number" ? value : null,
                  })
                }
              />
              <TextInput
                label="Currency"
                value={itemForm.currency}
                onChange={(event) =>
                  setItemForm({ ...itemForm, currency: event.currentTarget.value })
                }
              />
              <TextInput
                label="Unit"
                placeholder="per item, per glass, per trip"
                value={itemForm.unit}
                onChange={(event) =>
                  setItemForm({ ...itemForm, unit: event.currentTarget.value })
                }
              />
            </Group>

            <Group grow align="start">
              <Select
                label="Availability"
                data={AVAILABILITY_OPTIONS}
                value={itemForm.availability_status}
                onChange={(value) =>
                  value &&
                  setItemForm({
                    ...itemForm,
                    availability_status: value as ServiceCatalogAvailability,
                  })
                }
                allowDeselect={false}
              />
              <Select
                label="Fulfillment"
                data={FULFILLMENT_OPTIONS}
                value={itemForm.fulfillment_type}
                onChange={(value) =>
                  value &&
                  setItemForm({
                    ...itemForm,
                    fulfillment_type: value as ServiceCatalogFulfillment,
                  })
                }
                allowDeselect={false}
              />
            </Group>

            <Group grow align="start">
              <TextInput
                label="Available from"
                type="time"
                value={itemForm.available_start_time}
                onChange={(event) =>
                  setItemForm({
                    ...itemForm,
                    available_start_time: event.currentTarget.value,
                  })
                }
              />
              <TextInput
                label="Available until"
                type="time"
                value={itemForm.available_end_time}
                onChange={(event) =>
                  setItemForm({
                    ...itemForm,
                    available_end_time: event.currentTarget.value,
                  })
                }
              />
              <NumberInput
                label="Preparation minutes"
                min={0}
                value={itemForm.preparation_minutes ?? undefined}
                onChange={(value) =>
                  setItemForm({
                    ...itemForm,
                    preparation_minutes: typeof value === "number" ? value : null,
                  })
                }
              />
            </Group>

            <TextInput
              label="Location"
              placeholder="Lobby, level 2, restaurant, etc."
              value={itemForm.location}
              onChange={(event) =>
                setItemForm({ ...itemForm, location: event.currentTarget.value })
              }
            />
            <Textarea
              label="Guest-facing notes"
              value={itemForm.guest_notes}
              onChange={(event) =>
                setItemForm({ ...itemForm, guest_notes: event.currentTarget.value })
              }
            />
            <Textarea
              label="Internal staff notes"
              value={itemForm.staff_notes}
              onChange={(event) =>
                setItemForm({ ...itemForm, staff_notes: event.currentTarget.value })
              }
            />
            <TextInput
              label="Aliases"
              description="Comma-separated guest phrases, e.g. nasgor, teh es, kolam."
              value={itemForm.aliasesText}
              onChange={(event) =>
                setItemForm({ ...itemForm, aliasesText: event.currentTarget.value })
              }
            />
            <Group grow align="end">
              <NumberInput
                label="Sort order"
                value={itemForm.sort_order}
                onChange={(value) =>
                  setItemForm({
                    ...itemForm,
                    sort_order: typeof value === "number" ? value : 0,
                  })
                }
              />
              <Switch
                label="Active"
                checked={itemForm.is_active}
                onChange={(event) =>
                  setItemForm({
                    ...itemForm,
                    is_active: event.currentTarget.checked,
                  })
                }
              />
            </Group>

            <Group justify="flex-end">
              <Button variant="default" onClick={() => setItemForm(null)}>
                Cancel
              </Button>
              <Button loading={isPending} onClick={submitItem}>
                Save item
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
