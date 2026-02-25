# BOSSNYUMBA Mobile & Web App

Flutter app for BOSSNYUMBA Property Management — **iOS**, **Android**, and **Web**.

## Prerequisites

- [Flutter SDK](https://docs.flutter.dev/get-started/install) (3.2+)
- Dart 3.2+

## Setup

```bash
# Install Flutter (if not installed)
# https://docs.flutter.dev/get-started/install

# From repo root
cd apps/bossnyumba_app

# Create platform folders (run once)
flutter create . --platforms=android,ios,web

# Install dependencies
flutter pub get
```

## Run

```bash
# Web
flutter run -d chrome

# Android
flutter run -d android

# iOS (macOS only)
flutter run -d ios
```

## Build for deploy

**Production:** Always pass `API_BASE_URL` so the app has no hardcoded API URL:

```bash
# Web
flutter build web --dart-define=API_BASE_URL=https://api.yoursite.com/api/v1

# Android APK
flutter build apk --release --dart-define=API_BASE_URL=https://api.yoursite.com/api/v1

# Android App Bundle (Play Store)
flutter build appbundle --release --dart-define=API_BASE_URL=https://api.yoursite.com/api/v1

# iOS (macOS only)
flutter build ios --release --dart-define=API_BASE_URL=https://api.yoursite.com/api/v1
```

## API

Set base URL (no hardcoded production URL):

- **Dev default**: `http://localhost:4000/api/v1` (see `lib/core/api_config.dart`).
- **Override**: `--dart-define=API_BASE_URL=https://api.yoursite.com/api/v1` for run or build.

## Roles & screens

- **RESIDENT** → Customer: Home, Payments, Maintenance, Lease, Profile
- **PROPERTY_MANAGER / MAINTENANCE_STAFF / TENANT_ADMIN** → Manager: Dashboard, Work Orders, Inspections, Profile
- **OWNER / ACCOUNTANT** → Owner: Portfolio, Profile
- **ADMIN / SUPPORT / SUPER_ADMIN** → Admin: Tenants, Roles, Support, Profile
