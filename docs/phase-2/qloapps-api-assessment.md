# QloApps API Assessment & Reference

## Overview

This document evaluates the current state of QloApps API integration for the PMS Adapter. We previously assumed the `/api/hotel_ari` endpoint was necessary to retrieve physical room numbers (e.g., "A-101"). However, testing the APIs directly has revealed a more optimal solution.

## Assessment: Is it sufficient?

**Yes, the currently working endpoints are completely sufficient for our MVP requirements, and no alternative workaround is needed.**

While `/api/bookings` lacks the `booking_status` and physical room numbers, and `/api/hotel_ari` is down, we discovered that the **`/api/room_bookings`** endpoint provides every missing piece of data we need.

### The Missing Linchpin: `/api/room_bookings`

A direct API test on `/api/room_bookings` reveals that QloApps exposes a dedicated resource for individual room reservation lifecycle. This endpoint completely eliminates the need for `/api/hotel_ari`.

From `GET /api/room_bookings/{id}?output_format=JSON`:

- **`room_num`**: Provides the exact physical room number (e.g., `"LR-101"`).
- **`id_status`**: Provides the active status of the room (`1` = Awaiting, `2` = Checked In, `3` = Checked Out).
- **`check_in` / `check_out`**: Provides the actual exact `datetime` the guest was checked in or out via the QloApps front desk.
- **`date_from` / `date_to`**: The planned reservation dates.

### Determining Actual Check-In Time for Automations

A critical requirement for our WhatsApp automation (e.g., sending the "on-stay" welcome message) is knowing when the guest _actually_ arrives.

- The root `/api/bookings` endpoint does **not** contain `booking_status` or actual check-in time in the JSON payload.
- Instead, our Sync Service will query the `/api/room_bookings` endpoint.
- We monitor the `id_status` field. When it transitions to `2` (Checked In), we can read the `check_in` field, which contains the exact timestamp the front desk staff marked the guest as checked in.

## Core API Endpoints Reference for Adapter

To build the QloApps Adapter, we will use a combination of these endpoints:

### 1. Room Bookings (`GET /api/room_bookings`)

**Purpose:** The single source of truth for physical, per-room reservation states and check-in times.

- **Parameters:** `?output_format=JSON&display=full`
- **Crucial Quirks:**
  1. This endpoint ignores native PrestaShop date filters (like `filter[date_from]`) without breaking the JSON structure because it is a custom module. We must fetch all active bookings and filter the objects via native Javascript in-memory.
  2. Despite the endpoint name `/api/room_bookings`, the JSON root structure returned is mapped to `{"bookings": [...]}` instead of `room_bookings`.
- **Key Data Extracted:**
  - `id_order` / `id_customer`: Links to the parent booking and guest.
  - `id_status`: The current real-time status of the room (`1`, `2`, `3`).
  - `check_in` / `check_out`: Real timestamps of physical check-in/out.
  - `room_num`: The human-readable physical room number (e.g., "A-101").
  - `country`: The string representing the guest's country (e.g., "Indonesia") stored locally in the booking.

### 2. Customers (`GET /api/customers`)

**Purpose:** Fetch guest identity details.

- **Parameters for List:** `?output_format=JSON&display=full`
- **Parameters for Single Resource:** `GET /api/customers/{id}?output_format=JSON`
- **Crucial Quirks:** If you append `&display=full` to a single resource request like `/api/customers/1`, the PrestaShop API bugs out and wraps the single object inside a `{"customers": [{"id": 1}]}` array, drastically stripping away all actual data fields (no email, no name). You **MUST** omit `display=full` for single resource lookups to get the true `{"customer": { ... }}` root object.
- **Key Data Extracted:**
  - `firstname`, `lastname`, `email`, `phone`.

### 3. Addresses (`GET /api/addresses`)

**Purpose:** Fetch guest contact details required for WhatsApp.

- **Parameters:** `?output_format=JSON&display=full&filter[id_customer]=[ID]`
- **Key Data Extracted:**
  - `phone` or `phone_mobile`: For WAHA message delivery.

### 4. Orders (`GET /api/orders`)

**Purpose:** Fetch the total financial value of the entire booking, not just the individual room. It also serves as the gatekeeper to ensure we only pull reservations where payment has been accepted.

- **Parameters:** `?output_format=JSON`
- **Key Data Extracted:**
  - `total_paid_tax_incl`: The total cost of the complete order including all rooms.
  - `current_state`: The current order flow state. **Crucial:** We use this to filter our `room_bookings`. We _only_ ingest room bookings if their parent order's `current_state` is `2` (Payment accepted / Complete payment received). Any other state (like Awaiting bank wire payment) is skipped entirely.

### 5. Countries (`GET /api/countries/{id}`)

**Purpose:** Resolve the numeric `id_country` (from `/api/addresses`) into a readable text string.

- **Parameters:** `?output_format=JSON`
- **Key Data Extracted:**
  - `name`: The actual localized country name string (e.g., "Indonesia").

## Dashboard UI & Database Mapping (`app/(dashboard)`)

The data extracted from the four endpoints above provides 100% coverage for what our Dashboard UI (`app/(dashboard)/reservations`, `app/(dashboard)/guests`) needs to render. The PMS Adapter will transform the QloApps payload into our standard Supabase schema.

### 1. Reservations Table (`Reservations` view)

- **PMS Reservation ID:** A composite key built from `id_order` and `id_room` (e.g., `O1-R16`) ensuring uniqueness even if one order has multiple rooms. Extracted from **`room_bookings`**.
- **Room Number:** Displayed as the physical unit (e.g., "LR-101"). Extracted directly from `room_num` in **`room_bookings`**.
- **Dates:** `check_in_date` and `check_out_date` use the planned `date_from`/`date_to`. Extracted from **`room_bookings`**.
- **Status Badge:** Derived from `id_status`. It drives the UI status tags (e.g., `pre-arrival`, `on-stay`, `checked-out`). Extracted from **`room_bookings`**.
- **Amount:** Displayed as the total value of the reservation in the UI. Extracted from `total_paid_tax_incl` in **`orders`**.
- **Guest Identity:** Derived by doing a relational join `guests(name)` on the foreign key `guest_id` in Supabase (the UI does _not_ query a `guest_name` column directly from `reservations`).
- **Source:** Identifies the origin of the booking (e.g., "localhost:8080" or OTA name). Extracted from `source` in **`orders`** or **`bookings`**.

### 2. Guests & Contacts Table (`Guests` view)

- **Guest Name:** Concatenated `firstname` + `lastname`. Extracted from **`customers`**.
- **Email:** The primary contact email. Extracted from **`customers`**.
- **Country:** Extracted either from `country` in **`room_bookings`** or resolved by looking up `id_country` from **`addresses`** against the **`countries`** endpoint to get the text string.
- **Phone:** Used fundamentally for WAHA messaging, but also displayed for staff reference. Extracted from **`addresses`** (using `phone` or `phone_mobile`).

## Conclusion

The absence of `hotel_ari` does not negatively impact our development. The `room_bookings` endpoint is factually superior for our use case because it perfectly aligns with our need to track exact check-in timestamps and physical room assignments simultaneously. The adapter will be implemented using `room_bookings`, `orders`, `customers`, and `addresses`.
