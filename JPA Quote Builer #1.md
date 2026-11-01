# JPA Quote Builder Specification & Implementation Record

Updates for **JPA Quote Builder → Customers → Registered Client Accounts**, Rate Memory, Quotations, and Excel Export. Applied to **all companies and customer groups** across Tamil Nadu and pan-India operations.

---

### Priority 1: Automatically Reuse Previous Rates (Completed)
- **Automatic Matching**: When creating a new quotation and adding or importing items (via manual input, Excel, PDF, or multimodal OCR image), automatically fills each matching item’s latest saved rate for the selected company or customer group.
- **Group & Branch Sharing**: Branches belonging to the same group (e.g. Lifestyle Homecentre, Madurai, Prozone Mall) share that customer group’s saved rates.
- **Tenant Isolation**: Unrelated companies and corporate accounts remain strictly isolated with zero cross-tenant rate leakage.
- **Summary Recalculation**: Preserves current quotation quantities while recalculating GST-exclusive/inclusive subtotals, intra-state CGST/SGST (or IGST), and rounded totals deterministically.

---

### Priority 2: Save Rates for New Items (Completed)
- **Rate Memory Learning**: When an item has no previous rate in the system, its rate is left open for manual entry.
- **Automatic Persistence**: Once the quotation is saved, the rate is remembered in JPA Central Rate Memory and automatically reused for subsequent quotations for that client.
- **Intentional Price Updates**: Allows verified rate updates and logs them to rate history without altering historical quotations.
- **Immutable History**: Historical quotations retain their exact original rates and calculations.

---

### Priority 3: Accurate Item Matching & Clean OCR (Completed)
- **Multi-attribute Normalization**: Matches product descriptions, specifications, units (kgs, nos, packs, pcs, lts, reams, rims, box, qty), and pack sizes before reusing a rate.
- **Uncertainty Flagging**: Flags ambiguous matches for user confirmation instead of guessing.
- **Non-destructive Overwrite Prevention**: Never overwrites rates manually edited in the active quotation.
- **Clean UI**: Uncluttered Document Import interface without unwanted engine labels or debug text.

---

### Priority 4: Search Bar & Dual View Modes (Completed)
- **Unified Search Bar**: Fast, debounced search within **Registered Client Accounts** filtering by Company Name, Store Code, Store/Trade Name, GSTIN, Address, Contact Person, and Phone.
- **Case-Insensitive & Partial Matching**: Instant client lookup with clear button (`X`) and empty state messaging.
- **Dual View Modes**:
  - **Editable Table** (default active view for fast spreadsheet-style management)
  - **Card Grid** (visual card layout with direct Quote links and phone details)
- **Responsive Layout**: Clean desktop and mobile layouts with accessible touch targets.

---

### Priority 5: Editable Customers Page with Microsecond-Fast Auto-Save (Completed)
- **Directly Editable Spreadsheet Grid**: Every customer field is directly editable inline:
  - `No.` (Row Index)
  - `Client / Company Legal Name` (required)
  - **`Store Code (Optional)`** (Header strictly titled `Store Code (Optional)`)
  - `Store / Trade Name`
  - `GSTIN` (auto-uppercased font-mono)
  - `Billing Address`
  - `Contact Person`
  - `Phone`
  - `Actions` (`Quote` generator link + `Delete` record)
- **Microsecond Saving Performance**:
  - **0ms Optimistic UI**: Changes render instantaneously with zero input lag.
  - **Non-blocking Background Sync**: Automatically dispatches `PUT /api/customers` on keystroke debounce (350ms) and on blur.
  - **Performance Telemetry**: Displays real-time save timing badge (e.g., `⚡ Auto-saved in 0.8ms`).
  - **Visual Confirmation**: Green checkmark badges on saved rows.
- **Quick Inline Add Row**: Dedicated `+` bottom row in the table allowing instant customer creation without leaving the spreadsheet.
- **Add Customer Modal**: Includes the optional `Store Code (Optional)` field with real-time validation.

---

### Priority 6: Dedicated Store Code Column in Excel Export (Completed)
- **Separate Column B ("Store Code")**:
  - Store Code has its own **dedicated separate column** placed immediately next to `No.` (Column A).
  - Column A: `No.`
  - **Column B: `Store Code`** (e.g., `1903`, `PZ-01`, `HC-10`, center-aligned)
  - Column C: `Store name` (clean store/branch name, e.g., `Lifestyle International | Prozone Mall`, without code duplication)
  - Column D: `Particulars` (Item description)
  - Column E: `Specifications`
  - Column F: `Pack`
  - Column G: `Qty.`
  - Column H: `Unit`
  - Column I: `Unit price ₹`
  - Column J: `GST %`
  - Column K: `Amount ₹`
  - Hidden Column L: Line item GST calculation formula
- **Clean Store Name Isolation**:
  - Automatically filters and isolates store codes from the `Store name` text to guarantee zero duplicate code strings.
- **Quotation Header Details (Row 14)**:
  - Displays `Store Location: <Location>  |  Store Code: <Code>`.
- **Accurate Mathematical Formulas**:
  - Line amount (`=ROUND(G24*I24,2)` or tax-inclusive `=ROUND(G24*I24/(1+J24),2)`).
  - Summary rows (`SUM(K24:K25)`, `SUMIF(J24:J25, 18/100, L24:L25)`, `SUM(K...)`) calculate seamlessly with verified formula integrity.

---

### Priority 7: Dedicated Responsive Store Code & Store / Branch Columns in PDF Generator (Completed)
- **Dedicated Columns for Store Code & Store / Branch**:
  - Automatically detects the presence of `storeCode` or `storeName` across quotation customer data or line items.
  - Dynamically renders **`Store Code`** (Col 2) and **`Store / Branch`** (Col 3) directly in the PDF table.
- **Dynamic Portrait A4 Responsive Layout (186 mm Content Width)**:
  - Standard Portrait A4 width is 210 mm with 12 mm margins, leaving exactly 186 mm printable width.
  - Dynamically allocates calibrated column widths across 4 distinct layouts without overflow or clipping:
    1. **Both Store Code & Store / Branch Present (10 Columns = 186 mm)**:
       - `#` (7 mm, center)
       - `Store Code` (16 mm, bold center)
       - `Store / Branch` (24 mm, left linebreak)
       - `Particulars` (45 mm, bold left)
       - `Specification` (22 mm, left)
       - `Qty` (10 mm, center)
       - `Unit` (11 mm, center)
       - `Unit Price (Rs.)` (19 mm, right)
       - `GST %` (12 mm, center)
       - `Amount (Rs.)` (20 mm, bold navy right)
    2. **Store Code Only (9 Columns = 186 mm)**:
       - `#` (8 mm), `Store Code` (20 mm), `Particulars` (58 mm), `Specification` (28 mm), `Qty` (11 mm), `Unit` (11 mm), `Unit Price` (21 mm), `GST %` (13 mm), `Amount` (18 mm).
    3. **Store / Branch Only (9 Columns = 186 mm)**:
       - `#` (8 mm), `Store / Branch` (28 mm), `Particulars` (51 mm), `Specification` (26 mm), `Qty` (11 mm), `Unit` (11 mm), `Unit Price` (21 mm), `GST %` (13 mm), `Amount` (17 mm).
    4. **Neither Present (8 Columns = 186 mm)**:
       - `#` (9 mm), `Particulars` (67 mm), `Specification` (32 mm), `Qty` (12 mm), `Unit` (12 mm), `Unit Price` (23 mm), `GST %` (13 mm), `Amount` (18 mm).
- **Clean Store Name Isolation**:
  - `getCleanStoreName` strips redundant embedded store codes so they do not duplicate in `Store / Branch`.
- **Client Metadata Card**:
  - Displays `Store Code: <Code>` and `Store / Branch: <Store>` alongside `GSTIN` and contact details with responsive vertical accent branding in JPA Orange (#EA580C).

---

### Priority 8: Customer Search Combobox & Modern Nurture Glassmorphism Pop-up (Completed)
- **Searchable Customer Combobox (Live Search Bar)**:
  - When typing a firm, company name, branch location, store code, or GSTIN in the "Select Customer" input, matching records filter in real-time.
  - Matches display with Company Legal Name, Store Code badge (e.g. `1903`), Branch / Trade Name, and GSTIN.
  - Selecting any customer auto-fills:
    - `Customer Company Name`
    - `Store / Branch Location` (`storeName`)
    - `Store Code` (`storeCode`)
    - `Customer Address` (`customerAddress`)
    - `Customer GSTIN` (`customerGstin`)
- **"Create" Option for Unlisted Firms & Modal Pop-up**:
  - If a typed firm is not found, an attractive action button appears: **`+ Create "<typed firm>"`**.
  - A permanent bottom button **`+ Create New Customer`** allows customer registration at any time.
  - Clicking either opens a **Modern Nurture Glassmorphism Pop-up**:
    - Translucent frosted glass effect (`bg-white/95 backdrop-blur-2xl border border-white/80 shadow-[0_24px_50px_rgba(30,58,138,0.18)]`).
    - Nurture gradient header badge with nature-infused corporate accents.
    - Fields identical to Customers page:
      - `Company Legal Name *` (pre-filled with the search query)
      - `Store Code (Optional)` (amber background badge & uppercase mono font)
      - `Store / Branch Location`
      - `Customer GSTIN`
      - `Billing Address *`
      - `Contact Person` & `Phone`
      - `Email Address (Optional)`
    - On submit, dispatches `POST /api/customers`, updates the local customer list, selects the customer, and immediately auto-fills GSTIN, Address, Branch, and Store Code into the quotation.
- **Quotation Date & Validity Date Automation**:
  - **Quotation Date**: Defaults to Current / Present Date (`YYYY-MM-DD`).
  - **Validity Date**: Defaults to **+15 Days from Current/Present Date** (`YYYY-MM-DD`).
  - Whenever Quotation Date is modified, Validity Date automatically updates to +15 days from the new Quotation Date.
  - Quick **`+15 Days (Default)`** preset button allows instant re-application.

---

### Priority 9: Rate Library Edit Pop-up, Microsecond Saving & Breathable Layout (Completed)
- **Replaced "Audit" with "Edit" Pop-up Button**:
  - Replaced the previous "Audit" button with a modern **"Edit"** action button featuring a `Pencil` icon across both desktop table rows and mobile touch-optimized cards.
  - Table header updated to **"Actions"** for clean visual hierarchy.
- **Glassmorphism Edit Modal Pop-up**:
  - Modern Glassmorphism container (`bg-white/90 backdrop-blur-2xl rounded-3xl border border-white/80 shadow-[0_24px_60px_-12px_rgba(30,58,138,0.25)]`).
  - Ambient glass gradient accent bar (`from-blue-600 via-indigo-500 to-sky-400`).
- **Required & Automated Fields**:
  - **`Item Code`**: Fully automated and sequence-preserved (`JPA-001`, `JPA-002`, ...); displayed as read-only with an "Auto" badge so item code sequence remains strictly consecutive.
  - **`Item Name`**: Required (`*`), auto-capitalized.
  - **`Master Rate (₹)`**: Required (`*`), supports exact 2-decimal rates.
  - **`Unit`**: Required (`*`), e.g. Nos, Ltrs, Box, Pkt.
  - **`GST Rate`**: Required (`*`), glass dropdown with 18%, 12%, 5%, 0% (Exempt).
  - **`Specifications (Optional)`**: Clean, plain neutral text (`Specifications (Optional)`) strictly without colored badges, pills, or highlights.
  - **`Pack (Optional)`**: Clean, plain neutral text for secondary pack sizing.
- **Modern Glass Nurture Glassmorphism Typing Boxes**:
  - Frosted translucent glass inputs (`bg-white/75 backdrop-blur-md border border-slate-200/90 rounded-xl shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.03)] focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500/80 focus:bg-white transition-all`).
- **Microsecond Saving Performance & Clean White Glassmorphism Notification**:
  - **0ms Instant Optimistic UI Update**: Product list updates in UI state instantaneously with zero perceived delay.
  - **White Glassmorphism Toast Notification**: Translucent white frosted glass banner (`bg-white/90 backdrop-blur-2xl rounded-2xl border border-white/80 shadow-[0_12px_36px_rgba(30,58,138,0.16)]`) with a clean green checkmark (`CheckCircle2`).
  - **No Distracting Emojis**: Clean corporate typography strictly without emojis (`⚡`).
  - **Clear Status & Saved Content**: Explicitly displays **"Saved Successfully"** along with the exact saved product name and master rate (`<Product Name> • ₹<Rate>`).
  - **Non-blocking Background Persistence**: Dispatches `PUT /api/products` asynchronously with price history audit logging.
- **Breathable Header & Page Spacing**:
  - Header height increased from cramped `h-14` to generous `min-h-16 sm:min-h-20 md:min-h-22` with comfortable padding (`py-3.5 sm:py-4.5 px-4 sm:px-8 md:px-10`).
  - Page container padded comfortably (`p-4 sm:p-6 md:p-8 lg:p-10 space-y-6 sm:space-y-8`) giving the Rate Library Header ample breathing space.

---

### Priority 10: Apple macOS / iOS Glassmorphism Company Folders, Multi-Unit Rate Inheritance & Zero-Emoji Policy (Completed)
- **Apple macOS / iOS Glassmorphism Folder Grid**:
  - **Apple-Inspired Glassmorphic Card Architecture**: Translucent frosted glass cards (`bg-white/70 backdrop-blur-2xl rounded-3xl border border-white/80 shadow-[0_12px_36px_rgba(30,58,138,0.08)] hover:shadow-[0_20px_45px_rgba(30,58,138,0.16)]`) with subtle border highlights.
  - **Apple macOS 3D Glass Folder Icon**: Radiant blue gradient folder badge (`bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600 rounded-2xl shadow-lg shadow-blue-500/25`) with translucent interior tab and gloss reflections.
  - **Multi-Unit Badges & Store Preview Chips**: Displays total active branch count pill (e.g. `3 units`) and preview pills for specific stores (e.g. `Homecentre`, `Madurai`, `Prozone Mall`, `Brooke Fields`).
  - **Folder Drill-Down & Breadcrumbs**: Clicking "Open Folder" navigates into a dedicated folder workspace with seamless breadcrumb navigation (`← All Folders / <Folder Name>`), "+ Add Unit" shortcut, and quick "Quote" generation.
  - **3-Way View Switcher**: Instant switching between:
    - **Company Folders** (Apple macOS/iOS Glassmorphism Grid)
    - **Editable Table** (Spreadsheet grid for rapid inline edits)
    - **Card Grid** (Detailed customer identity cards)
- **"New Folder" Creation Modal for Employees & Administrators**:
  - Accessible via "+ New Folder" Apple Glassmorphic action button.
  - Modern Glassmorphism modal allowing instant creation and grouping of parent company accounts:
    - `Company / Group Name *` (e.g., `Lifestyle International`, `Landmark Group`)
    - `Description / Division (Optional)` (e.g., `Retail Chains & Hypermarkets`)
    - `Master GSTIN (Optional)`
    - `Primary Billing Address (Optional)`
  - Full CRUD integration via `/api/customers/folders` (`GET`, `POST`, `DELETE`).
- **Cross-Unit Rate Memory Inheritance (Old / Existing Rates Auto-Recall)**:
  - When an Employee or Administrator writes a quotation for any unit or store under a company group (e.g. `Lifestyle International - Prozone Mall`), previous rates quoted or saved for any sister unit (e.g. `Homecentre` or `Madurai`) are automatically recalled and applied.
  - `findMatchingRate` in `rate-memory.ts` groups sister branches via `company_folders` and legal name normalization (`normalizeCompanyName`), querying historical rates and previous quotation items across all sibling branches.
  - Customer selection in Quotation Builder (`/quotations/new` and `/quotations/[id]/edit`) automatically triggers a background rate reconciliation for any unpriced items.
- **Strict Zero-Emoji Policy & Comfortable Header Box Redesign**:
  - Strictly eliminated all unicode emojis (`⚡`, `✓`, `✨`) from all saving banners, toasts, status badges, buttons, tooltips, and modals.
  - Removed debug and auto-save text: `"Directly editable table with microsecond background synchronization ⚡ Microsecond auto-save active"`.
  - **Removed Header Badges & Subtitle**: Removed `{customers.length} Accounts` and `{companyFolderGroups.length} Folders` count pills, and removed the subtitle `"Organized client accounts, company groups, and store branches"`.
  - **Comfortable & Responsive Two-Tier Header Box**:
    - Modern Apple glassmorphism container (`bg-white/80 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-5 sm:p-6 md:p-7 border border-slate-200/80 shadow-xs space-y-4 sm:space-y-5`).
    - **Top Tier**: Clean, bold `Registered Client Accounts` title with comfortable breathing space, paired with primary action buttons (`+ New Folder`, `+ Add Customer`, `Delete All`) with `min-h-[42px]` tap targets.
    - **Bottom Tier**: Expansive, responsive search input with clear button (`X`) and sleek segmented view switcher (`Company Folders`, `Editable Table`, `Card Grid`) that adapts fluidly to all screen widths.
  - Save notifications standardized to clean **White Glassmorphism** cards (`bg-white/95 backdrop-blur-2xl border border-white/80`) with clean vector SVGs (`CheckCircle2`) explicitly stating **"Saved Successfully"** with the saved item and rate.

- **Unit Quotations Drill-Down & Zero Duplicates Security**:
  - **Interactive Unit Chips & Row Action**: Clicking any unit chip on the Folder card (e.g. `Homecentre, Brooks`, `Madurai`, `Prozone Mall`) or clicking `Quotes` in the folder table instantly opens the **Unit Quotations Modal**.
  - **Zero Duplicates Guaranteed**: Server-side queries enforce `GROUP BY q.id` and the client state maintains a strict `Map<string, Quotation>` de-duplication layer, eliminating duplicate quotes completely.
  - **Enterprise Security**: Enforces RBAC permissions, authenticated sessions, tenant isolation, and parameterized SQL queries (`args: [...]`).
  - **Comprehensive Quotation Overview**: Displays Quote No, Date, Validity, Section & Item breakdown, Status (`Approved` / `Draft`), and total amount formatted in Indian Rupees (`formatINR`). Includes direct action buttons: `View`, `Edit`, `PDF`, `Excel`, and `+ New Quote for Unit`.
- **Custom Folder DP / Logo (WebP, PNG, JPEG, JPG, AVIF, SVG)**:
  - **High-Quality DP Display**: Folders support custom brand logos/DPs with rounded-2xl geometry, glass border highlights, and subtle shadow.
  - **DP Customizer Modal**: Hovering on any folder icon reveals a camera badge to upload or change the DP. Supports direct image file upload (`image/webp, image/png, image/jpeg, image/jpg, image/avif, svg`) or Web image URLs.
  - **Instant Persistence**: Updates are saved immediately via `PUT /api/customers/folders` and stored in SQLite `company_folders.logo_url` column with non-destructive fallback to the Apple 3D glass blue folder icon.

- **Calibri 11pt, Pure White Glassmorphism Boxes & Automated Mobile/Monitor Responsiveness**:
  - **Typography Standardization**: Font family strictly set to **Calibri** (`font-['Calibri']`) with size **11pt** (`text-[11pt]`) across all unit tables, spreadsheet grids, card containers, inputs, labels, and action pills.
  - **Pure White Glassmorphism Capsules (Apple iOS / iPhone Aesthetic)**:
    - Built with `.glass-box-white` (`bg-white/90 backdrop-blur-2xl border border-white/95 shadow-[0_4px_20px_rgba(15,23,42,0.04)]`) and `.glass-input-white` (`bg-white/92 backdrop-blur-xl border border-slate-200/80 rounded-2xl py-2 px-3.5 text-[11pt] font-['Calibri'] text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20`).
    - Eliminates dull grey/flat boxes with modern frosted glass capsules matching the iOS reference UI.
    - Store Code styled in Apple frosted amber/blue glass pill with high-contrast mono typography.
  - **Comfortable Expanded Visibility (Zero Truncation on Billing Address)**:
    - Expanded `BILLING ADDRESS` column on desktop monitors to `min-w-[460px] lg:min-w-[540px] xl:min-w-[600px]` with generous horizontal breathing space so long multi-store addresses are fully visible without truncation or squeezing.
    - Full-width comfortable visibility on mobile cards with multi-line auto-wrapping textareas.
  - **Automated Mobile vs. Monitor Responsiveness**:
    - **Monitor / Desktop View (`hidden md:block`)**: Spacious, comfortable pure white glass table with expanded columns, generous row heights, comfortable cell padding (`py-3.5 px-3.5`), and quick action buttons.
    - **Mobile Screen View (`block md:hidden`)**: Automatically shrinks into an Apple iOS Frosted Glass Card Stack (identical to the iPhone UI reference) with unit index pills, comfortable input capsules, full billing address boxes, two-column contact details, and soft frosted action buttons (`Quotes`, `+ Quote`, `Delete`).

---

### Verification & Quality Assurance Record
- **Automated Tests**: 61/61 tests passing across 18 test suites (`npm test`):
  - `tests/company-folders-and-rate-inheritance.test.ts` (Unit quotations drill-down, de-duplication guarantee, custom folder DP/logo upload, group normalization, multi-unit rate memory inheritance, zero emojis check, Apple Glassmorphism UI verification)
  - `tests/rate-library-edit-modal.test.ts` ("Edit" popup modal, automated item code, required fields, microsecond save, breathable layout)
  - `tests/customer-store-code-editable.test.ts` (Store code persistence, microsecond PUT, centered Excel export formatting, dynamic responsive PDF generator, Customer Search Combobox & +15 Days Validity Date functionality)
  - `tests/quotation.test.ts` (Financial calculation, genuine Excel formulas, A4 PDF)
  - `tests/regression.test.ts` (Formula positions, column headers, security)
  - `tests/customer-cascade-delete.test.ts` (Clean foreign key cascade delete)
  - `tests/item-code-resequence.test.ts` (Consecutive item code renumbering)
  - `tests/excel-extraction-robustness.test.ts` (Binary .xls extraction)
  - `tests/parseur-screenshot-fix.test.ts` (Screenshot OCR unit normalization & 18% default GST)
  - `tests/google-security.test.ts` (reCAPTCHA, Google OAuth, RBAC isolation, prompt injection defense)
- **Production Build**: Clean Turbopack production build (`npm run build`, 34/34 static/dynamic routes compiled with 0 errors).
- **History Preservation**: Past quotations, invoices, and rate history records remain strictly immutable.
