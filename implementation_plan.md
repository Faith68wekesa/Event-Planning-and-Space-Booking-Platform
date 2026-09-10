# Implementation Plan: Vendor & Venue Owner Account Registration System

Implement a consistent, user-friendly, and validated registration experience for both **Vendors** and **Venue Owners** strictly according to specifications, maintaining clean separation between venue owner accounts and individual venue listings.

## Proposed Changes

### 1. Backend Data Models & Endpoints (`backend/core`)

#### [MODIFY] [models.py](file:///c:/Users/faith/Desktop/Event%20Planning%20and%20SpaceBooking%20Platform/backend/core/models.py)
- **`VendorProfile`**:
  - Add fields: `address` (CharField), `years_in_business` (IntegerField, optional), `website_url` (URLField, optional), `logo_url` (URLField, optional), `verification_status` (CharField with choices `PENDING`, `APPROVED`, `REJECTED`, default `'PENDING'`).
  - Update `vendor_type` choices to support all requested categories:
    * Catering, Photography, Videography, Event Decoration, Entertainment, DJ Services, MC Services, Event Planning, Transport, Florist, Makeup & Beauty, Security, Equipment Rental, Other.
- **`VenueOwnerProfile`**:
  - Add fields: `business_type` (CharField), `address` (CharField), `description` (TextField, optional), `years_in_business` (IntegerField, optional), `website_url` (URLField, optional), `logo_url` (URLField, optional), `verification_status` (CharField with choices `PENDING`, `APPROVED`, `REJECTED`, default `'PENDING'`).

#### [MODIFY] [serializers.py](file:///c:/Users/faith/Desktop/Event%20Planning%20and%20SpaceBooking%20Platform/backend/core/serializers.py)
- Expose the new fields (`address`, `years_in_business`, `website_url`, `logo_url`, `verification_status`, `business_type`, `description`) in `VendorProfileSerializer` and `VenueOwnerProfileSerializer`.

#### [MODIFY] [views.py](file:///c:/Users/faith/Desktop/Event%20Planning%20and%20SpaceBooking%20Platform/backend/core/views.py) & [urls.py](file:///c:/Users/faith/Desktop/Event%20Planning%20and%20SpaceBooking%20Platform/backend/core/urls.py)
- Update `register_vendor` and `register_venue_owner` to ingest:
  - Full Name (parsed into first_name and last_name, with username generated or set from email/provided username).
  - All Section B fields (`business_name`, `business_type`/`vendor_type`, `location`, `address`, `description`, `years_in_business`, `website_url`, `logo_url`).
  - Set `is_verified = False` and `verification_status = 'PENDING'`.
- Add `VenueOwnerProfileViewSet` to API router with `toggle_verify` and `update_status` actions, allowing the Admin dashboard to list, approve, or reject venue owners in addition to vendors and venues.

#### Run Database Migrations
- Execute `python manage.py makemigrations` and `python manage.py migrate` in `backend`.

---

### 2. Frontend Types & API Service (`frontend/src`)

#### [MODIFY] [types/index.ts](file:///c:/Users/faith/Desktop/Event%20Planning%20and%20SpaceBooking%20Platform/frontend/src/types/index.ts)
- Update `Vendor` and `VenueOwner` interfaces to include `address`, `years_in_business`, `website_url`, `logo_url`, and `verification_status?: 'PENDING' | 'APPROVED' | 'REJECTED'`.
- Define type definitions for the exact dropdown options for Vendor and Venue Owner business types.

#### [MODIFY] [services/api.ts](file:///c:/Users/faith/Desktop/Event%20Planning%20and%20SpaceBooking%20Platform/frontend/src/services/api.ts)
- Add `getVenueOwners()`, `toggleVerifyVenueOwner(id)`, and `updateVerificationStatus(type, id, status)` to `ApiService`.

---

### 3. Frontend Registration Components (`frontend/src/components`)

#### [MODIFY] [VendorRegistration.tsx](file:///c:/Users/faith/Desktop/Event%20Planning%20and%20SpaceBooking%20Platform/frontend/src/components/VendorRegistration.tsx)
- Rebuilt with modern, rich aesthetics consistent with the landing page design.
- **Section A — Personal Account Information**:
  - Full Name (required)
  - Email Address (required, login email)
  - Phone Number (required)
  - Password (required, min 8 characters)
  - Confirm Password (required, must match password)
- **Section B — Business Information**:
  - Business Name (required)
  - Business Type (required, dropdown: Catering, Photography, Videography, Event Decoration, Entertainment, DJ Services, MC Services, Event Planning, Transport, Florist, Makeup & Beauty, Security, Equipment Rental, Other)
  - Conditional: "Specify Business Type" if "Other" is selected
  - Location (required, e.g. Nyeri, Nairobi, etc.)
  - Business Address (required)
  - Business Description (required textarea)
  - Years in Business (optional number)
  - Portfolio/Website URL (optional URL)
  - Business Image/Logo (optional image URL or upload preview)
- **Agreement**:
  - "I agree to the Terms and Conditions" (checkbox)
- **Step / Form Navigation**:
  - Clear section headers or stepped progression (Section A & Section B) with `← Back` button.
  - `[Create Vendor Account]` button.
  - `Already have an account? Login` link.
- **Success Screen ("Pending Verification")**:
  - Rather than jumping straight into the dashboard, display the requested post-registration screen:
    * **Registration Successful! 🎉**
    * *"Your vendor account has been created and is currently pending verification. An administrator will review your information before your business is listed as verified."*
    * Button: `[Go to Vendor Login]` to proceed cleanly to the login screen.

#### [MODIFY] [VenueOwnerRegistration.tsx](file:///c:/Users/faith/Desktop/Event%20Planning%20and%20SpaceBooking%20Platform/frontend/src/components/VenueOwnerRegistration.tsx)
- Mirrors the exact design and UX of Vendor Registration for high consistency.
- **Section A — Personal Account Information**:
  - Full Name (required)
  - Email Address (required, login email)
  - Phone Number (required)
  - Password (required, min 8 characters)
  - Confirm Password (required, must match)
- **Section B — Business Information**:
  - Business Name (required)
  - Business Type (required, dropdown: Hotel, Conference Centre, Event Hall, Wedding Venue, Garden, Restaurant, Outdoor Space, Community Centre, Beach Venue, Resort, Private Estate, Other)
  - Conditional: "Specify Venue Type" if "Other" is selected
  - Location (required)
  - Business Address (required)
  - Business Description (required textarea)
  - Years in Business (optional number)
  - Business Website URL (optional URL)
  - Business Logo (optional image URL / upload)
- **Strict Adherence to Rule #3**:
  - Explicitly does NOT ask for venue capacity, pricing, amenities, venue photos, or availability (a clear visual callout will inform owners that individual venue listings are added from their owner dashboard).
- **Agreement & Buttons**:
  - "I agree to the Terms and Conditions" checkbox.
  - `[Create Venue Owner Account]`.
  - `Already have an account? Login`.
  - `← Back` button.
- **Success Screen ("Pending Verification")**:
  - **Registration Successful! 🎉**
  - *"Your venue owner account has been created and is currently pending verification. An administrator will review your information before your business is listed as verified."*
  - Button: `[Go to Venue Owner Login]`.

---

### 4. Admin Dashboard Verification Table (`AdminDashboard.tsx`)

#### [MODIFY] [AdminDashboard.tsx](file:///c:/Users/faith/Desktop/Event%20Planning%20and%20SpaceBooking%20Platform/frontend/src/components/AdminDashboard.tsx)
- Implement the requested verification table view:
  ```
  Business      | Type        | Location | Status  | Action
  ABC Catering  | Vendor      | Nyeri    | Pending | [Approve] [Reject]
  XYZ Gardens   | Venue Owner | Nyeri    | Pending | [Approve] [Reject]
  ```
- Support filtering by status (`Pending`, `Approved`, `Rejected`, or `All`).
- Enable one-click `Approve` or `Reject` actions directly updating verification status in the backend.

---

## Verification Plan

### Automated Verification
- Run Django test / migration check:
  `cd backend && python manage.py makemigrations && python manage.py migrate`
- Verify TypeScript compilation without errors:
  `cd frontend && npm run build` or Vite build check.

### Manual / Browser Verification
- Open the application in the browser.
- Open **Vendor Registration**:
  - Validate Section A password validation (< 8 chars, mismatch between Password and Confirm Password).
  - Validate Section B "Other" dropdown trigger ("Specify Business Type").
  - Submit form -> Check display of the "Registration Successful! 🎉" pending verification screen.
  - Click "[Go to Vendor Login]" -> verify it switches to Vendor Login.
- Open **Venue Owner Registration**:
  - Verify fields match Section A and Section B specifications.
  - Confirm venue-specific details (capacity, pricing, amenities) are NOT requested.
  - Verify "Other" venue type conditional input.
  - Submit form -> Check display of the "Registration Successful! 🎉" pending verification screen.
  - Click "[Go to Venue Owner Login]".
- Test Admin Dashboard:
  - Verify newly registered Vendor and Venue Owner appear with "Pending" status.
  - Test clicking `[Approve]` and `[Reject]` buttons to verify status transitions.
