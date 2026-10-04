# DocuMind Demo Questions & Evaluation Guide

This guide contains recommended evaluation questions for testing the DocuMind Multimodal Document Intelligence System against the files in `/sample_docs`.

---

## Sample Documents Overview

| File | Format | Key Content |
|---|---|---|
| `company_policy_2024.pdf` | PDF | Corporate travel & expense policy (2024): $75/day meal allowance, 14-day booking notice, $200-$280 lodging limits. |
| `travel_update_memo_2025.txt` | Plain Text | 2025 executive memo: raises meal allowance to $120/day, shortens booking notice to 3 days, $60 rideshare allowance. |
| `quarterly_invoice.png` | Scanned Image | Apex Systems invoice #INV-2024-884 for Project Titan GPU cluster, InfiniBand switch ($45,000 total), due Nov 30, 2024. |
| `project_titan_spec.pdf` | PDF | Project Titan roadmap: Dr. Elena Rostova (Lead), $250k budget, GCP/GKE stack, target launch September 15, 2025. |
| `infrastructure_inventory.txt` | Plain Text | Facility B Rack 4 hardware audit: Dual 64-core AMD EPYC, 256GB RAM, dual 10Gbps NICs. |

---

## Demo Questions

### 1. Factual Extraction from PDF
- **Question:**  
  `"Who is the Principal Systems Architect for Project Titan and what is the allocated budget?"`
- **Target Document:** `project_titan_spec.pdf`
- **Expected Behavior:**  
  Identifies **Dr. Elena Rostova** as the Principal Systems Architect and **$250,000** as the fiscal 2025 allocated budget.
- **Confidence Expectation:** High (> 0.85).

---

### 2. Visual OCR & Table Reasoning from Scanned Image
- **Question:**  
  `"What is the total amount due on invoice INV-2024-884 from Apex Systems and what is the payment due date?"`
- **Target Document:** `quarterly_invoice.png`
- **Expected Behavior:**  
  Extracts the total due amount of **$45,000.00** and the payment due date of **November 30, 2024**.
- **Confidence Expectation:** High (> 0.80).

---

### 3. Deliberate Contradiction / Cross-Document Conflict
- **Question:**  
  `"What is the maximum daily meal allowance for domestic business travel?"`
- **Target Documents:** `company_policy_2024.pdf` vs. `travel_update_memo_2025.txt`
- **Deliberate Conflict:**
  - `company_policy_2024.pdf` (Section 2): states **$75 per day**.
  - `travel_update_memo_2025.txt` (Section 1): updates this to **$120 per day**.
- **Expected System Behavior:**
  - *Full Requirement:* The system should flag a contradiction between the two documents and present both conflicting sources with their respective values and document references.
  - *Current Implementation Note:* Currently, the RAG retriever retrieves both snippets or the top-reranked snippet without dedicated conflict-arbitration logic (documented under "Needs manual code fix").

---

### 4. Policy Revision Comparison
- **Question:**  
  `"How many days in advance must domestic travel bookings be submitted?"`
- **Target Documents:** `company_policy_2024.pdf` vs. `travel_update_memo_2025.txt`
- **Expected Behavior:**  
  Explains the original rule (**14 days advance notice**) versus the revised policy (**3 business days advance notice**).

---

### 5. Technical Hardware Specs from Inventory
- **Question:**  
  `"What processor and memory configuration is installed in Rack 4 at Facility B?"`
- **Target Document:** `infrastructure_inventory.txt`
- **Expected Behavior:**  
  Retrieves **Dual 64-Core AMD EPYC 9554 Processors (128 cores total)** and **256GB DDR5 ECC RAM**.
- **Confidence Expectation:** High (> 0.85).

---

### 6. Uncertainty & Refusal Handling (Unanswerable Question)
- **Question:**  
  `"What is the reimbursement policy for international relocation visa fees and what is the duration of parental leave?"`
- **Target Document:** None (information does not exist in any document)
- **Expected Behavior:**  
  The system detects that the retrieved context does not contain this information. It explicitly replies that the documents do not contain the answer (e.g. *"I could not find any relevant information in the document to answer this question."*) and outputs a low or zero confidence score (**0.0**), avoiding hallucination.
- **Confidence Expectation:** 0.0 (or < 0.20).
