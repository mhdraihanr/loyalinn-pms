# QloApps Webhook Module Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Scaffold a production-oriented QloApps module that captures booking lifecycle hooks and forwards signed webhook events to the app.

**Architecture:** The module stays thin: it registers QloApps hooks, reads admin-configured integration settings, builds minimal event payloads, signs them with HMAC, sends them to the app endpoint, and logs delivery results to local files. Business mapping remains in the app backend.

**Tech Stack:** PHP, QloApps/PrestaShop module system, Smarty template, cURL/file logging

---

### Task 1: Create module skeleton

- Create module root, classes, views, logs, and safety index files.

### Task 2: Add main module class

- Implement install/uninstall.
- Register order lifecycle hooks.
- Add admin configuration form handling.

### Task 3: Add helper classes

- Add signer, HTTP client, and logger.
- Keep payload/event generation minimal.

### Task 4: Add config template

- Render current config values and usage notes in back office.

### Task 5: Verify scaffold structure

- Ensure files are self-consistent and ready to copy into a QloApps instance.
