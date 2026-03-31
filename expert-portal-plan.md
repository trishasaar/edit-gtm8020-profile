# GTM8020 Expert Portal — Implementation Plan

**Goal:** Allow experts in the GTM 80/20 network to log in with a unique username/password, view their existing CMS profile data in an editable form, and submit changes that automatically update the live Webflow site.

**Date:** 2026-03-30
**Status:** Planning

---

## Architecture Overview

```
Expert Browser
     |
     v
[gtm8020.com/edit-profile]  (Webflow hosted, Memberstack-gated)
     |
     v
[Memberstack Auth]  ──>  Returns logged-in user's Webflow CMS Item ID
     |
     v
[Vercel Serverless API]
     |── GET  /api/expert/:itemId  ──>  Fetches CMS item from Webflow API
     |── POST /api/expert/:itemId  ──>  Updates CMS item via Webflow API
     |── POST /api/expert/upload    ──>  Handles headshot image upload
     |
     v
[Webflow CMS API]  ──>  Live site updates on publish
```

---

## Tech Stack

| Layer | Tool | Why |
|-------|------|-----|
| Auth | **Memberstack** | Native Webflow integration, easy to set up, stores custom metadata (CMS Item ID) per member |
| Frontend | **Webflow page + custom JS** | Stays on gtm8020.com, no separate app needed |
| Backend API | **Vercel Serverless Functions** (Node.js) | You already have a Vercel account, free tier is sufficient, handles API key securely |
| Database (optional) | **Supabase** | For audit logging, tracking edits, or storing pending changes for admin approval |
| CMS | **Webflow CMS API v2** | Read/write access to Expert collection items |

---

## CMS Fields Inventory (Experts Collection)

### Editable by Expert
| Field Name | Type | Notes |
|-----------|------|-------|
| Headline | Plain text | e.g., "Partnerships Leader" |
| Short Bio | Plain text | Summary paragraph |
| Career Highlights | Rich text | Key achievements |
| LinkedIn Link | URL | Their LinkedIn profile |
| Profile Link | URL | Personal website or portfolio |
| Years of Experience | Number (as text) | e.g., "13" |
| Headshot | Image | Upload via API |

### Admin-Only (not shown in edit form)
| Field Name | Type | Reason |
|-----------|------|--------|
| Name | Text | Rarely changes, affects slug/URL |
| Slug | Text | URL path, should not be changed by expert |
| Order | Number | Controls display order on /experts page |
| Expertise Tags | Multi-ref to Service Pages | Admin curates these |
| Expert Logos | Multi-ref to Experts Logos | Admin manages company logos |
| Logo URL fields (0-4) | Text | Legacy/admin managed |
| Logos | Multi-image | Admin managed |

---

## Implementation Steps

### Phase 1: Memberstack Setup
**Estimated effort: 1-2 hours**

1. **Create a Memberstack account** and connect it to the GTM8020 Webflow project
2. **Create a "Expert" membership plan** (free plan, just for gating)
3. **Add a custom field** in Memberstack called `webflowItemId` (text)
   - This stores the Webflow CMS Item ID for each expert (e.g., `69cad7cc27a806c5905faec2`)
4. **Create member accounts** for each of your 41 experts
   - Set their email and a temporary password
   - Populate their `webflowItemId` from Webflow
5. **Add Memberstack login/signup components** to Webflow
   - Login page at `/expert-login`
   - Redirect to `/edit-profile` after login

### Phase 2: Vercel Serverless API
**Estimated effort: 3-4 hours**

Create a Vercel project (`gtm8020-api`) with these endpoints:

#### `GET /api/expert/[itemId]`
- **Input:** Webflow CMS Item ID (from URL param)
- **Auth:** Validate Memberstack token in request header
- **Action:** Call Webflow CMS API to fetch the expert's item
- **Response:** Return JSON with editable field values

```
Webflow API call:
GET https://api.webflow.com/v2/collections/{collectionId}/items/{itemId}
Headers: Authorization: Bearer {WEBFLOW_API_TOKEN}
```

#### `POST /api/expert/[itemId]`
- **Input:** JSON body with updated field values
- **Auth:** Validate Memberstack token + confirm itemId matches the logged-in user's `webflowItemId`
- **Action:** Call Webflow CMS API to patch the item, then publish
- **Response:** Success/error status

```
Webflow API call:
PATCH https://api.webflow.com/v2/collections/{collectionId}/items/{itemId}
Headers: Authorization: Bearer {WEBFLOW_API_TOKEN}
Body: { fieldData: { headline: "...", "short-bio": "...", ... } }

Then publish:
POST https://api.webflow.com/v2/sites/{siteId}/publish
```

#### `POST /api/expert/upload`
- **Input:** Multipart form data with image file
- **Auth:** Validate Memberstack token
- **Action:** Upload image to Webflow or a CDN (Supabase Storage), return URL
- **Response:** Image URL to populate the headshot field

#### Environment Variables (Vercel)
```
WEBFLOW_API_TOKEN=<your Webflow API token>
WEBFLOW_COLLECTION_ID=<Experts collection ID>
WEBFLOW_SITE_ID=<GTM8020 site ID>
MEMBERSTACK_SECRET_KEY=<your Memberstack secret key>
```

### Phase 3: Edit Profile Page in Webflow
**Estimated effort: 2-3 hours**

1. **Create a new page** at `/edit-profile` in Webflow
2. **Gate it** with Memberstack (only logged-in experts can access)
3. **Design the form** with these fields:
   - Headshot preview + upload button
   - Headline (text input)
   - Short Bio (textarea)
   - Career Highlights (rich text editor — use a lightweight JS editor like Quill or TipTap)
   - LinkedIn Link (URL input)
   - Profile Link (URL input)
   - Years of Experience (number input)
   - Submit button
4. **Add custom JavaScript** (in Webflow page settings or via embed block):
   - On page load:
     1. Get logged-in user's `webflowItemId` from Memberstack
     2. Call `GET /api/expert/{itemId}` to fetch current data
     3. Populate all form fields with the returned data
   - On form submit:
     1. Collect all field values from the form
     2. Call `POST /api/expert/{itemId}` with the data
     3. Show success/error message

### Phase 4: Supabase (Optional — Recommended)
**Estimated effort: 1-2 hours**

Use Supabase for:

1. **Audit log table** — track every edit (who, what, when)
   ```sql
   CREATE TABLE expert_edits (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     expert_name TEXT,
     webflow_item_id TEXT,
     field_changed TEXT,
     old_value TEXT,
     new_value TEXT,
     edited_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

2. **Admin approval flow (optional future feature)**
   - Instead of publishing immediately, save changes to a `pending_edits` table
   - Admin reviews and approves before pushing to Webflow

3. **Image storage** — Use Supabase Storage for headshot uploads instead of managing Webflow asset uploads directly

---

## Security Considerations

- **Webflow API token** is stored only in Vercel env vars, never exposed to the browser
- **Memberstack token validation** on every API request ensures only authenticated experts can read/write
- **Item ID matching** — the API verifies the logged-in user's `webflowItemId` matches the item they're trying to edit (prevents editing someone else's profile)
- **Input sanitization** — sanitize all text inputs before sending to Webflow API
- **Rate limiting** — add basic rate limiting to the Vercel endpoints to prevent abuse
- **CORS** — only allow requests from `gtm8020.com`

---

## Onboarding Flow for Experts

1. Admin (you) creates their Memberstack account with their email + temporary password + `webflowItemId`
2. Expert receives an email invite: "You can now edit your GTM 80/20 profile"
3. Expert logs in at `gtm8020.com/expert-login`
4. Redirected to `/edit-profile` with their data pre-filled
5. They edit and submit
6. Changes go live on the site

---

## Future Enhancements

- **Admin dashboard** — view all pending edits, approve/reject
- **Email notifications** — notify admin when an expert updates their profile
- **Profile completeness score** — show experts what fields are missing
- **Bulk onboarding** — script to create Memberstack accounts from your existing Google Sheet of experts
- **Edit history** — let experts see their own change log

---

## Key IDs to Collect Before Building

| Item | Where to Find | Value |
|------|--------------|-------|
| Webflow Site ID | Webflow Project Settings → General | TBD |
| Experts Collection ID | Webflow CMS API or designer URL | TBD |
| Webflow API Token | Webflow Dashboard → Integrations → API Access | TBD |
| Memberstack Public Key | Memberstack Dashboard | TBD |
| Memberstack Secret Key | Memberstack Dashboard | TBD |

---

## File Structure (Vercel Project)

```
gtm8020-api/
├── api/
│   └── expert/
│       ├── [itemId].js        # GET and POST handler for profile data
│       └── upload.js           # Image upload handler
├── lib/
│   ├── webflow.js             # Webflow API helper functions
│   ├── memberstack.js         # Memberstack token validation
│   └── supabase.js            # Supabase client (optional)
├── vercel.json                # CORS and route config
├── package.json
└── .env.local                 # Local dev environment variables
```

---

## Order of Execution

| Step | Task | Dependencies |
|------|------|-------------|
| 1 | Get Webflow API token + Site ID + Collection ID | None |
| 2 | Set up Memberstack on Webflow | None |
| 3 | Build Vercel serverless API (GET + POST endpoints) | Step 1 |
| 4 | Test API with Postman/curl | Step 3 |
| 5 | Build edit-profile page in Webflow | Step 2 |
| 6 | Add custom JS to connect form to API | Steps 3 + 5 |
| 7 | Create Memberstack accounts for experts (link to CMS Item IDs) | Step 2 |
| 8 | Set up Supabase audit log (optional) | Step 3 |
| 9 | End-to-end testing with a real expert account | All above |
| 10 | Send invite emails to experts | Step 9 |
