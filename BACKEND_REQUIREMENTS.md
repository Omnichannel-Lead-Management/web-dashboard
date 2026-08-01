# Backend requirements

The FAQ Manager integrates with the existing chatbot-builder FAQ API through the gateway. Its record format stores `keywords` as a JSON array string, `enabled` as a boolean-compatible value (`0`, `1`, `"false"`, or `"true"`), and timestamps as integer Unix epochs. The frontend accepts epoch seconds or milliseconds and normalizes both to milliseconds.

## List FAQs

- **Method:** `GET`
- **Path:** `/api/businesses/:businessId/faqs`
- **Request body:** none
- **Expected response:** `{ "success": true, "faqs": [{ "id": 27, "business_id": "business_1", "question": "What are your hours?", "answer": "We are open Monday to Saturday.", "keywords": "[\"hours\",\"open\"]", "enabled": 1, "created_at": 1754042400, "updated_at": 1754046000 }] }`
- **Frontend feature:** Loading, searching, editing, toggling, and deleting persisted FAQs.

## Create an FAQ

- **Method:** `POST`
- **Path:** `/api/businesses/:businessId/faqs`
- **Request body:** `{ "question": "string (1-160 chars)", "answer": "string (1-1000 chars)", "keywords": ["string, max 40 chars each"], "enabled": true }`
- **Expected response:** `{ "success": true, "faq": { ...the persisted FAQ record described above... } }`
- **Frontend feature:** Creating a persisted FAQ from a blank form or starter suggestion.

## Replace all business FAQs

- **Method:** `PUT`
- **Path:** `/api/businesses/:businessId/faqs`
- **Request body:** `{ "items": [{ "question": "string", "answer": "string", "keywords": ["string"] }] }`
- **Expected response:** `{ "success": true, "faqs": [{ ...persisted FAQ records... }] }`
- **Frontend feature:** API client support for replacing a business FAQ collection.

## Update or enable/disable an FAQ

- **Method:** `PATCH`
- **Path:** `/api/faqs/:id`
- **Request body:** `{ "question": "string", "answer": "string", "keywords": ["string"], "enabled": true }`
- **Expected response:** `{ "success": true, "faq": { ...the updated FAQ record... } }`
- **Frontend feature:** Editing an FAQ and changing its enabled state.

## Delete an FAQ

- **Method:** `DELETE`
- **Path:** `/api/faqs/:id`
- **Request body:** none
- **Expected response:** `{ "success": true }` or `204 No Content`
- **Frontend feature:** Permanently deleting an FAQ after inline confirmation.

The business-scoped collection routes use the selected Pinia business ID; the frontend never supplies a hardcoded tenant ID.
