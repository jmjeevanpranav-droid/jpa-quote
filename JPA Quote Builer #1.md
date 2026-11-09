# JPA Quote Builder — improve English handwriting recognition and quotation import

## Goal

Improve the existing quotation import feature in JPA Quote Builder. An employee should be able to upload a handwritten list, phone photo, scanned PDF, digital PDF, Word document, or Excel workbook and receive an editable quotation preview. The assistant should recover the writer’s intended items, produce clear English descriptions, and put each supported value into the correct field. It must handle documents with missing headings, irregular spacing, or no table at all.

The current preview reports “44 lines found.” Several visible lines contain fragments of letters, pipes, and dashes. They are marked “Needs review,” but the same garbled strings still appear in Particulars as if they were proposed product names. Improve both **how the document is read** and **what the employee sees when a reading is uncertain**.

## 1. Use the existing project and tools

Claude Code is installed globally. Use the available Claude Code integration or relevant configured Claude skill as a development aid if Antigravity can access it. Check the project’s existing instructions and configuration before assuming a particular skill exists. If there is no configured Claude skill, continue the source changes directly in Antigravity.

Keep DeepSeek-OCR as the application’s existing recognizer and use the already-installed Fuse.js for catalogue matching. Claude Code is for development. Do not add a Claude API dependency, require employees to have a Claude subscription, or send their uploads to a new external provider. Do not introduce Tesseract, PaddleOCR, MinerU, or EasyOCR. Reuse the project’s existing document readers where they support the input.

**Execution boundary:** Read and edit source files only. Do not open a browser, start or restart the application, install packages, invoke OCR models on documents, run builds, execute tests, deploy, or change the live database. I will run the application and tests myself from my terminal. You may write regression tests and prepare manual checks. At the end, give me the commands you verified from the project configuration without running them.

## 2. Find where the text first becomes garbled

Trace the actual employee workflow from file selection through upload, file decoding, page rendering, OCR, line parsing, catalogue matching, preview, and insertion. Start with the code behind **Process & Extract Line Items** and **Accept & Insert into Quotation**. Follow the real request rather than assuming a handwriting test exercises the same path.

Inspect these specific possibilities:

- A PDF has a damaged or badly encoded text layer. The application accepts it because it contains characters, even though the rendered page may be readable.
- The file is rendered at a resolution that loses small handwritten letters, decimal points, or distinctions such as `1`, `I`, and `l`.
- OCR produces usable words and cells, but a later parser flattens table markup, borders, separators, or empty cells into fabricated item lines.
- The original reading and the proposed English description are populated from the same raw string, even after a row has been classified as uncertain.
- An existing test sends a typed `handwrittenNoteText` string directly to the import endpoint. Keep that parser coverage, but distinguish it from a test that starts with actual image bytes.

Identify which explanations the source supports. If a cause requires a real document or runtime observation to confirm, label it as unverified. Do not claim to have reproduced the screenshot.

## 3. Read each file in the way that preserves its information

**For Excel**, use cells, row positions, merged ranges, and worksheet boundaries. A blank Brand cell must remain blank. The next cell must retain its own column position. Preserve item codes with leading zeros.

**For Word and digital PDFs**, preserve tables, paragraphs, and reading order. A long description can wrap onto a second line while its quantity appears only once. Check whether the text actually covers the item region. A readable page title is insufficient evidence that the product list below it was extracted correctly.

**For photos and scanned PDFs**, pass the actual decoded image or rendered page to DeepSeek-OCR. Preserve the original page and its orientation. Where the source contains enough detail, use a bounded second reading of a difficult region. Include the nearby description and quantity so the recognizer retains context. Keep the better-supported reading. Stop when further processing cannot resolve the marks.

For a mixed PDF, make the reading decision per page or region. Retain useful text from one page even when another needs OCR. Reconcile overlapping readings by source location so a cropped retry does not create a duplicate item.

## 4. Interpret handwriting carefully and produce English output

Use the visible strokes, surrounding words, unit markers, document layout, and catalogue aliases together. The aim is to recover what the employee wrote. A familiar catalogue entry can support a reading, but resemblance alone cannot establish a product’s identity.

- For `evrdy AAA batt`, propose **Eveready AAA Battery** when the visible variant and catalogue evidence agree.
- For `evrdy batt`, preserve the supported description. If both AA and AAA exist, ask **“Which battery size do you need, AA or AAA?”** Leave the rate unresolved until the variant is known.
- For a recognizable item written in Tamil or another supported language, propose its English description. Preserve brand names, product codes, dimensions, and units. Keep the original reading available separately.
- For a short but legitimate code such as `CR2032`, preserve the code and check the catalogue. Do not discard it merely because it is absent from an English dictionary.
- For fragments resembling `Aa Cr A Ee Acein Nti`, do not invent a plausible product. If the relevant source region still cannot be read, leave Particulars empty and show **“Item name unclear — review original.”**

Keep employee-facing descriptions, labels, questions, and review messages in English. Keep raw OCR in a separate **View original** area. Show the source crop where the existing pipeline can reliably identify it. Garbled OCR must never become a suggested English product name merely because it contains Latin letters.

## 5. Assign values to columns, even without headings

Map each source item to the fields available in the actual form: **Section, Particulars, Specification, Pack, Quantity, Unit, Rate, and GST percentage**. Preserve brand, subcategory, or HSN when supported by the relevant product form or record. Keep a line total separate from a unit rate.

When headings are missing or unreadable, compare neighbouring rows. Use cell alignment, repeated patterns, currency signs, unit abbreviations, percentage signs, and arithmetic where appropriate. Re-evaluate the layout if it changes halfway down a page. For an unstructured handwritten list, identify the values by their meaning rather than forcing every line into the same column order.

Use these examples as acceptance cases. Never hard-code their answers into production logic:

| Source reading | Expected interpretation |
|---|---|
| `Garbage cover big 30×50 – 40 kg` | Particulars: Garbage cover, large. Specification: 30×50. Quantity: 40. Unit: kg. Preserve the dimensions without inventing a measurement unit. |
| `Tape 48 mm / 3 rolls / ₹25 each / ₹75` | Particulars: Tape. Specification: 48 mm. Quantity: 3. Unit: roll. Rate: ₹25. The line total is ₹75. |
| `PVC elbow 25 mm – 4 pcs` | Specification: 25 mm. Quantity: 4. Unit: pieces. The number 25 belongs to the product size. |
| `Tape 48 mm / 3 / 25` | Preserve the readable description and size. Use adjacent rows if they establish a consistent layout. Otherwise ask whether 25 is the unit rate or line total. |
| A readable description followed by an overwritten digit | Keep the description. Flag the quantity alone for review and continue processing the remaining items. |

Do not assume every line has a quantity of 1, a unit of Nos, a GST rate of 18%, or a Housekeeping classification. If the employee explicitly chose a section for the import, retain it as the employee’s choice. Keep unknown values empty and distinguish them from a source that explicitly states zero.

## 6. Use Fuse.js to find candidates and verify them against evidence

Search the Rate Library using an exact item code or verified alias first. Use Fuse.js for approximate matches on readable descriptions, aliases, and brands. Compare distinguishing features before transferring product details: model, variant, size, pack, and selling unit. AA and AAA batteries can return similar search scores while having different prices.

Copy a verified rate only when the selected record applies to the same product and selling unit. A supplier’s stated price should remain distinguishable from the approved master rate. Use trusted mappings or approved records for GST and HSN. An unfamiliar but clearly written product must remain a valid editable row even when the catalogue has no match.

## 7. Make the preview useful to the employee

Show **ready items**, **items with fields to review**, and **unreadable regions** separately. The displayed item count should describe actual product candidates. Table borders, repeated headings, punctuation-only lines, and OCR debris must not inflate the count.

If a row has a readable item and one unclear field, retain the good values and highlight that field. If a region contains no recoverable item name, place it in review with the original evidence and a blank editable description. Exclude unresolved regions from **Select All** and bulk insertion. Enforce the same validation on the receiving side so an unresolved row cannot enter a quotation through a stale selection.

Let the employee correct a row, accept it, or skip it. Preserve corrections while they review neighbouring rows. If an entire section shares one uncertain column mapping, ask once and preview the effect across that section. A useful message is **“I found 8 readable items. Two quantities need review.”** Generate the counts from the actual result.

## 8. Leave a verification plan I can run

Prepare focused checks for these cases:

1. A real handwritten photo containing one clear product, one ambiguous variant, and one unreadable line. The expected outcomes are an English description, a focused clarification, and an unselected review region.
2. A headerless workbook with a blank middle cell. Values must stay aligned with their source cells.
3. A digital PDF with a readable title and an image-based item list. The import must process the list as well as the title.
4. A supplied OCR response containing table separators and random fragments. Those fragments must never appear as proposed Particulars or enter a quotation through Select All.
5. A previously unseen handwritten product. Preserve its readable description and quantity without forcing a catalogue match.
6. A list longer than the existing sample fixture. Discover rows from the uploaded document without assuming a fixed item count.

Separate parser tests, upload-path tests with mocked OCR, and manual checks that require genuine handwriting and the real recognizer. For the real sample, ask me to compare the output with a human-written answer key: items recovered, quantities exactly correct, wrong values accepted, and unclear values correctly flagged. This gives me a practical way to tell whether recognition improved.

Finish with **files changed**, **what the source inspection established**, **what still needs runtime confirmation**, and **the exact terminal commands and manual steps for me to use**. Leave the code saved and all execution to me.