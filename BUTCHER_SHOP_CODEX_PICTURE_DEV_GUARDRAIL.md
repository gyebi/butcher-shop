# Butcher's Shop POS – Product Picture Development Guardrail

## Purpose

This document defines the temporary development boundary for Codex while fixing product pictures in the Butcher's Shop POS application.

The objective is to isolate the picture feature and prevent image work from affecting the already-working offline POS, inventory, sales, printer, SQLite, and synchronization features.

---

## 1. Hard Scope Rule

**Codex must work only on product-picture functionality.**

Do not modify unrelated application files, database logic, sales logic, stock logic, printer logic, business settings, offline synchronization, or product-creation logic.

If a required fix appears to require changes outside the approved picture-related files, **STOP and report the required file and proposed change before editing it.**

Do not make "helpful", cleanup, refactoring, formatting, dependency, schema, or architecture changes outside this scope.

---

## 2. Picture Feature Operating Rule

Product picture **changes are ONLINE ONLY**.

The app's offline-first architecture remains unchanged for core POS operations, but product pictures are an exception.

### Online picture workflow

When internet access is available:

1. User taps the product picture/change-picture control.
2. User selects an image from the device gallery/files.
3. The image is uploaded directly to **Firebase Storage**.
4. The resulting Storage path is written to the relevant Firestore product document as `imagePath`.
5. The current image URL is resolved from Firebase Storage.
6. The UI refreshes and displays the selected image.

Expected data relationship:

```text
Device Gallery
    ↓
Firebase Storage
    products/<image-file>
    ↓
Firestore
    products/<productId>
        imagePath: "products/<image-file>"
    ↓
App displays image
```

**The actual picture file belongs in Firebase Storage. Firestore stores only the picture reference/path.**

---

## 3. Offline Picture Rule

When the device is offline:

- Product picture changes must be disabled/rejected with a clear message such as:
  `Internet required. Product photos can only be changed while online.`
- Do not queue picture uploads.
- Do not write new picture changes to SQLite.
- Do not create `PRODUCT_IMAGE` jobs in `sync_queue`.
- Do not create or maintain an offline image-upload workflow.
- Do not copy newly selected images into app-local product-image storage.

For displaying existing pictures while offline:

- It is acceptable for a previously cached image to appear if the platform/image cache already has it.
- If the image is unavailable offline, show the normal product-image placeholder.
- Do **not** build custom offline picture caching as part of this task.

---

## 4. Approved Picture Behaviour

### Allowed

- Select picture from device gallery/files.
- Upload picture while online.
- Store picture file in Firebase Storage.
- Store/update `imagePath` in Firestore.
- Resolve the Firebase Storage download URL.
- Display the selected/current product picture.
- Replace an existing product picture safely.
- Add focused diagnostic logging related only to the picture workflow.
- Handle online/network errors cleanly.

### Not Allowed

- Camera capture.
- Image URL entry.
- Offline picture upload.
- Offline picture queueing.
- `localImageUri`-based picture editing.
- Picture-related `sync_queue` jobs.
- Product stock changes.
- Sales changes.
- Inventory movement changes.
- SQLite schema changes.
- Printer changes.
- Business settings changes.
- General sync-engine changes.
- Product creation changes.
- General refactoring.

---

## 5. File Modification Boundary

Codex may inspect any file necessary to understand the picture call path, but **must not modify files outside the picture feature without explicit approval**.

Primary approved implementation file:

```text
src/services/product-images.ts
```

If there are additional files that are clearly dedicated only to product-picture functionality, Codex may propose them for approval before editing.

### Important

If the current picture button or gallery callback is located inside a broader file such as:

```text
app/(tabs)/index.tsx
```

Codex may inspect it, but must **not edit that file automatically**.

Instead Codex must report:

- exact file,
- exact function/block involved,
- why a change is necessary,
- smallest proposed change.

Wait for approval before making that edit.

This rule protects the working POS screen from accidental regressions.

---

## 6. Firebase Storage Rule

Do not delete an existing Storage image before a replacement upload has succeeded.

Unsafe sequence:

```text
delete old image
→ upload new image
→ upload fails
→ product has no image
```

Preferred sequence:

```text
upload new image
→ confirm upload
→ get download URL
→ update Firestore imagePath
→ confirm Firestore update
→ optionally remove old Storage object later
```

A new unique Storage filename is preferred when replacing a picture, for example:

```text
products/product-<productId>-<timestamp>.jpg
```

This avoids stale image-cache problems caused by repeatedly reusing the same Storage URL/path.

---

## 7. Firestore Rule

After a successful image upload, the corresponding product document must contain:

```text
imagePath: "products/<uploaded-file-name>"
```

Example:

```text
products/product-1-1788193500000.jpg
```

Products without a picture may legitimately have no `imagePath` or a null/undefined value.

Do not write local device paths such as:

```text
file:///data/user/0/...
```

to Firestore.

---

## 8. Existing Offline Image Experiment

The earlier offline-image experiment is abandoned.

The following concepts must not be used for new picture changes:

```text
localImageUri
saveProductImageLocally()
updateLocalProductImage()
queueProductImageSync()
PRODUCT_IMAGE sync queue jobs
```

Existing historical values may remain temporarily in SQLite, but they must not drive the active picture workflow.

Do not alter SQLite tables merely to clean them up during this image fix.

Cleanup can be handled separately after the online picture feature is stable.

---

## 9. Diagnostic Logging

During development, picture-specific temporary logs are allowed.

Recommended checkpoints:

```text
PICTURE PICKER RESULT
IMAGE UPLOAD START
IMAGE STORAGE PATH
IMAGE UPLOAD COMPLETE
FIRESTORE IMAGE UPDATE START
FIRESTORE IMAGE UPDATE COMPLETE
IMAGE DISPLAY URL
```

Logs should make it possible to determine precisely whether a failure occurred during:

```text
picker
→ Storage upload
→ Firestore path write
→ URL retrieval
→ UI display
```

Do not add broad logging to sales, stock, sync, printer, or database features.

---

## 10. Acceptance Test

The picture task is complete only when this test passes.

### Online test

1. Internet ON.
2. Open app.
3. Select one product.
4. Choose a new image from gallery/files.
5. Confirm the selected file appears in Firebase Storage.
6. Confirm that exact product document in Firestore has the new `imagePath`.
7. Confirm the correct newly selected picture appears in the app.
8. Restart the app.
9. Confirm the same picture is loaded again from the Firebase-backed product data.

Expected result: **PASS**

### Offline test

1. Disconnect internet.
2. Open app.
3. Core products/POS remain usable from SQLite.
4. Attempt to change a product picture.
5. App refuses the change and displays an Internet-required message.
6. No image upload, Firestore write, SQLite image write, or picture sync job is created.

Expected result: **PASS**

---

## 11. Regression Protection

While performing this task, Codex must preserve these already-working areas:

```text
Offline app startup
SQLite product loading
Sales
Multi-item cart
Stock reduction
Add Stock
Stock batches
New Product
Inventory movements
Receipt printing
Bluetooth printer settings
Offline sync queue
Sales/stock/product synchronization
Business settings
```

No picture fix is acceptable if it changes the behavior of these areas.

---

## 12. Codex Working Instruction

Use the following rule for every proposed change:

> Fix the product-picture feature only. Make the smallest possible change. Do not touch unrelated files or architecture. Product picture changes require internet and use Firebase Storage + Firestore directly. Core POS operations remain offline-first. If a fix requires modifying a non-picture file, stop and request approval before editing it.

Before editing, state which file will be changed and why.

After editing, run TypeScript validation and test the image path only.

Do not build a release APK merely for a small source change. Use the development build during debugging. Create a release build only after the picture acceptance test passes and a development checkpoint is agreed.
