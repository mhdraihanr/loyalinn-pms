# Guests & Reservations UI Design

## Goal

Meningkatkan UI halaman Guests dan Reservations agar lebih konsisten, modern, dan informatif tanpa mengubah alur data server utama.

## Context

Halaman saat ini sudah fungsional tetapi masih minimal. Referensi visual diambil dari dashboard hospitality/SaaS modern: header ringkas, stat cards, filter bar yang jelas, table container premium, dan empty state yang lebih polished.

## Chosen Approach

Pendekatan 3 dengan cakupan ringan:

- Samakan page shell Guests dan Reservations.
- Tambahkan stat summary di level halaman.
- Tambahkan search/filter UI client-side.
- Rapikan table row presentation, spacing, badge, dan empty state.
- Pertahankan fetching data server dan status tabs Reservations yang sudah ada.

## Alternatives Considered

1. Visual-only polish: paling cepat, tetapi value UX terbatas.
2. Summary + layout consistency: seimbang, tetapi kurang membantu pencarian data.
3. Summary + search/filter UI client-side: dipilih karena memberi peningkatan UX nyata dengan risiko implementasi rendah.

## Page Design

### Shared Pattern

- Hero header dengan title + subtitle.
- Grid stat cards untuk quick insight.
- Toolbar/filter bar sebelum tabel.
- Satu container card utama untuk data table.
- Empty state dengan icon, title, dan helper text.

### Guests

- Summary: total guests, tiered members, guests with email, total loyalty points.
- Search: nama, email, phone, country.
- Table rows: avatar initials, metadata sekunder, tier badge, alignment dan spacing lebih lega.

### Reservations

- Summary: total reservations, in-house, upcoming/pre-arrival, revenue snapshot.
- Tetap gunakan status tabs.
- Search: guest name, room number, source.
- Table rows: guest block, date range block, status badge, amount emphasis.

## Data Flow

- Server component tetap load data.
- Search/filter dikerjakan pada client component table.
- Reservations page menghitung stat dari dataset sesuai status aktif yang sedang ditampilkan.

## Error Handling & Edge Cases

- Empty data menampilkan empty state yang konsisten.
- Search tanpa hasil menampilkan empty state khusus hasil filter.
- Nilai null seperti email, phone, source, room tetap tampil sebagai placeholder halus.

## Testing Strategy

- Tambahkan test fokus berbasis source assertions untuk memastikan marker UI baru hadir.
- Verifikasi lint setelah perubahan.
