# QloApps PMS Adapter — Integration Guide

> This guide documents how to set up **QloApps** as a local PMS via Docker (from the official GitHub source code) and connect it to our existing PMS adapter architecture (`lib/pms/adapter.ts`).

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Clone QloApps from GitHub](#2-clone-qloapps-from-github)
3. [Docker Setup](#3-docker-setup)
4. [QloApps Initial Configuration](#4-qloapps-initial-configuration)
5. [Enable QloApps Webservice API](#5-enable-qloapps-webservice-api)
6. [API Endpoints Reference](#6-api-endpoints-reference)
7. [Implementing the Adapter](#7-implementing-the-adapter)
8. [Connecting to PMS Config UI](#8-connecting-to-pms-config-ui)

---

## 1. Prerequisites

- [Git](https://git-scm.com/) installed
- [Docker Desktop](https://docs.docker.com/desktop/) installed and running
- Port `8080`, `3307`, and `2222` available on your machine (we remap from QloApps defaults to avoid conflicts with your Next.js dev server and existing Supabase / MySQL ports)

---

## 2. Clone QloApps from GitHub

First, clone the official QloApps repository. We recommend placing it **outside** the `a-proposal2` project directory to keep repositories separate.

```bash
# Navigate to a parent directory (e.g., one level above a-proposal2)
cd ..

# Clone the official QloApps repository
git clone https://github.com/Qloapps/QloApps.git

# Enter the cloned directory
cd QloApps
```

> **Repository Info:**
>
> - **Source:** [https://github.com/Qloapps/QloApps](https://github.com/Qloapps/QloApps)
> - **License:** OSL-3.0 (Open Software License)
> - **Tech Stack:** PHP 8.1+, MySQL 5.7+, Apache
> - **Core:** Based on PrestaShop 1.6

### Project Structure (Key Directories)

```
QloApps/
├── admin/          # Back Office (Admin Panel)
├── classes/        # Core PHP classes
├── config/         # Configuration files
├── controllers/    # Front & Admin controllers
├── modules/        # QloApps modules (including hotelreservationsystem)
├── webservice/     # REST API webservice handler
├── install/        # Installer (removed after setup)
└── ...
```

---

## 3. Docker Setup

### Option A: Use the Official Pre-built Docker Image (Recommended for Quick Start)

This is the fastest way to get QloApps running locally.

#### Step 1: Pull the Docker Image

```bash
docker pull webkul/qloapps_docker:latest
```

#### Step 2: Run the Container

We remap the ports to avoid collisions with other local services:

```bash
docker run -tidp 8080:80 -p 3307:3306 -p 2222:22 \
  --name qloapps-dev \
  -e USER_PASSWORD=qloapps123 \
  -e MYSQL_ROOT_PASSWORD=rootpassword \
  -e MYSQL_DATABASE=qloapps_db \
  webkul/qloapps_docker:latest
```

#### Step 3: Verify

```bash
docker ps
# You should see "qloapps-dev" in the list
```

### Option B: Build a Custom Docker Image from the Cloned Source

If you need to modify QloApps source code (e.g., add custom modules or API endpoints), build your own image from the cloned repo.

#### Step 1: Create a `Dockerfile` in the QloApps directory

```dockerfile
# QloApps/Dockerfile
FROM php:8.1-apache

# Install required PHP extensions
RUN apt-get update && apt-get install -y \
    libpng-dev libjpeg-dev libfreetype6-dev libxml2-dev libzip-dev libcurl4-openssl-dev \
    default-mysql-client unzip git \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install pdo_mysql gd curl soap zip simplexml dom

# Enable Apache mod_rewrite
RUN a2enmod rewrite

# Set PHP configuration
RUN echo "memory_limit=128M" > /usr/local/etc/php/conf.d/qloapps.ini \
    && echo "upload_max_filesize=16M" >> /usr/local/etc/php/conf.d/qloapps.ini \
    && echo "max_execution_time=500" >> /usr/local/etc/php/conf.d/qloapps.ini \
    && echo "allow_url_fopen=On" >> /usr/local/etc/php/conf.d/qloapps.ini

# Copy QloApps source code into the container
COPY . /var/www/html/

# Set permissions
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html

EXPOSE 80
```

#### Step 2: Create a `docker-compose.yml`

```yaml
# QloApps/docker-compose.yml
version: "3.8"

services:
  qloapps:
    build: .
    container_name: qloapps-dev
    ports:
      - "8080:80"
    depends_on:
      - mysql
    environment:
      - DB_SERVER=mysql
      - DB_USER=root
      - DB_PASSWD=rootpassword
      - DB_NAME=qloapps_db

  mysql:
    image: mysql:5.7
    container_name: qloapps-mysql
    ports:
      - "3307:3306"
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: qloapps_db
    volumes:
      - qloapps_mysql_data:/var/lib/mysql

volumes:
  qloapps_mysql_data:
```

#### Step 3: Build and Start

```bash
# From inside the QloApps directory
docker compose up -d --build

# Verify
docker ps
```

### Port Summary

| Host Port | Container Port | Service        |
| --------- | -------------- | -------------- |
| `8080`    | `80`           | Apache (Web)   |
| `3307`    | `3306`         | MySQL          |
| `2222`    | `22`           | SSH (Option A) |

---

## 4. QloApps Initial Configuration

1. Open your browser and go to **`http://localhost:8080`**
2. The QloApps installer wizard will appear. Follow the steps:
   - **Database Server:** `localhost`
   - **Database Name:** `qloapps_db`
   - **Database Login:** `root`
   - **Database Password:** `rootpassword`
3. Complete the installation (set admin email, hotel name, etc.)
4. **Important — Remove the install directory:**

```bash
docker exec -i qloapps-dev rm -rf /home/qloapps/www/hotelcommerce/install
```

5. Access the Back Office (Admin Panel) at:
   `http://localhost:8080/<admin-directory-name>/`
   _(QloApps will prompt you to rename this directory on first access)_

---

## 5. Enable QloApps Webservice API

The Webservice API is how our app communicates with QloApps. It must be enabled manually from the Back Office.

1. In the QloApps Back Office, go to:
   **Advanced Parameters → Webservice**
2. Toggle **"Enable QloApps Webservice"** to **Yes**
3. Click **"Add New Webservice Key"**:
   - **Key:** Click "Generate" to create a secure key (e.g., `ABCDEFGHIJ1234567890KLMNOPQRST01`)
   - **Key Description:** `a-proposal2 integration`
   - **Status:** Enabled
   - **Permissions:** Grant at minimum:
     - `bookings` — GET (Read)
     - `customers` — GET (Read)
     - `addresses` — GET (Read)
     - `hotel_booking_detail` — GET (Read)
4. Save.

> ⚠️ **Copy and securely save this API Key.** You will enter it into our PMS Config UI (`/settings/pms`).

---

## 6. API Endpoints Reference

The QloApps Webservice API base URL will be:

```
http://localhost:8080/api/
```

Authentication uses the API Key as the HTTP Basic Auth **username** (password is left empty).

### Key Resources

| Resource                | Endpoint                        | Description                      |
| ----------------------- | ------------------------------- | -------------------------------- |
| Bookings (Reservations) | `GET /api/bookings`             | List all bookings                |
| Single Booking          | `GET /api/bookings/{id}`        | Get specific booking details     |
| Customers (Guests)      | `GET /api/customers`            | List all customers               |
| Single Customer         | `GET /api/customers/{id}`       | Get specific customer details    |
| Hotel Booking Detail    | `GET /api/hotel_booking_detail` | Room assignment and date details |
| Addresses               | `GET /api/addresses`            | Customer address/country info    |

### Example cURL

```bash
# List all bookings (JSON)
curl -u "YOUR_API_KEY:" "http://localhost:8080/api/bookings?output_format=JSON"

# Get specific booking
curl -u "YOUR_API_KEY:" "http://localhost:8080/api/bookings/1?output_format=JSON"

# Get customer details
curl -u "YOUR_API_KEY:" "http://localhost:8080/api/customers/1?output_format=JSON&display=full"
```

### QloApps Booking Statuses → Internal Status Mapping

| QloApps Status ID | QloApps Meaning       | Our Internal Status |
| ----------------- | --------------------- | ------------------- |
| `1`               | Awaiting Check-in     | `pre-arrival`       |
| `2`               | Checked In / In House | `on-stay`           |
| `3`               | Checked Out           | `checked-out`       |
| `6`               | Canceled              | `cancelled`         |

> ⚠️ **Note:** QloApps uses numeric order state IDs inherited from PrestaShop. The exact IDs may vary based on your installation. Verify via `GET /api/order_states?output_format=JSON` after setup.

---

## 7. Implementing the Adapter

A QloApps adapter must conform to the `PMSAdapter` interface in `lib/pms/adapter.ts`.

### File to Create: `lib/pms/qloapps-adapter.ts`

The adapter will:

1. **`init(credentials, endpoint)`** — Store the API Key and the base URL (e.g., `http://localhost:8080`)
2. **`pullReservations(startDate, endDate)`** — Fetch from `/api/bookings?output_format=JSON&filter[date_from]=[startDate,endDate]&display=full`, then for each booking fetch the `hotel_booking_detail` to get room number and dates.
3. **`pullGuest(pmsGuestId)`** — Fetch from `/api/customers/{id}?output_format=JSON&display=full` and map `firstname`, `lastname`, `email`, etc. to `AdapterGuest`.
4. **`mapStatus(pmsStatus)`** — Map QloApps numeric order state IDs to internal statuses using the table above.

### How Authentication Works

QloApps uses HTTP Basic Auth. The API Key is the username, password is empty:

```typescript
const headers = new Headers();
headers.set("Authorization", "Basic " + btoa(apiKey + ":"));
```

Or equivalently with `fetch`:

```typescript
const response = await fetch(`${endpoint}/api/bookings?output_format=JSON`, {
  headers: {
    Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
  },
});
```

---

## 8. Connecting to PMS Config UI

Once the adapter is implemented, connecting it to the existing **PMS Config UI** (`/settings/pms`) requires the following:

### Step 1: Add "QloApps" Provider to the Form

In `components/settings/pms/pms-config-form.tsx`, add "qloapps" as a selectable provider:

```tsx
<Select
  name="pms_type"
  data={[
    { value: "cloudbeds", label: "Cloudbeds" },
    { value: "mews", label: "Mews" },
    { value: "qloapps", label: "QloApps" }, // ← Add this
    { value: "custom", label: "Custom / Generic" },
  ]}
/>
```

### Step 2: Update the Schema Constraint

In `supabase/schema.sql`, add `'qloapps'` to the `pms_type` CHECK constraint:

```sql
-- Migration: YYYYMMDDHHMMSS_add_qloapps_pms_type.sql
ALTER TABLE pms_configurations
  DROP CONSTRAINT pms_configurations_pms_type_check,
  ADD CONSTRAINT pms_configurations_pms_type_check
    CHECK (pms_type IN ('cloudbeds', 'mews', 'qloapps', 'custom'));
```

### Step 3: Update the Sync Action Adapter Factory

In `lib/pms/sync-action.ts`, add adapter selection logic:

```typescript
import { QloAppsAdapter } from "./qloapps-adapter";

// Inside triggerManualSync():
let adapter;
if (config.pms_type === "qloapps") {
  adapter = new QloAppsAdapter();
} else {
  adapter = new MockAdapter(); // fallback
}
adapter.init(config.credentials, config.endpoint);
```

### Step 4: Enter Credentials in the UI

| Field                    | Value                                 |
| ------------------------ | ------------------------------------- |
| **Integration Provider** | QloApps                               |
| **API Endpoint URL**     | `http://localhost:8080`               |
| **API Key**              | _(The key generated in Step 4 above)_ |

After saving, clicking **"Sync PMS"** on the Reservations page will pull data from QloApps into the application.

---

## Summary: File Changes Required

| Action     | File                                          | Description                                  |
| ---------- | --------------------------------------------- | -------------------------------------------- |
| **CREATE** | `lib/pms/qloapps-adapter.ts`                  | QloApps adapter implementing `PMSAdapter`    |
| **MODIFY** | `components/settings/pms/pms-config-form.tsx` | Add "qloapps" to provider dropdown           |
| **MODIFY** | `lib/pms/sync-action.ts`                      | Add adapter factory logic for "qloapps"      |
| **CREATE** | `supabase/migrations/XXXX_add_qloapps.sql`    | Add `'qloapps'` to pms_type CHECK constraint |
| **MODIFY** | `.env.local.example`                          | _(Optional)_ Add `QLOAPPS_BASE_URL` note     |
