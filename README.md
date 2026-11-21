# VocabPulse v27 — IELTS 200 Advanced Vocabulary

**Changes in v27:** new logo (`logo-light.png` + `logo-dark.png` — replace logo-light.png and logo-dark.png with your final logos, same names), top bar with Lessons / Progress tabs + voice, speed and theme controls, page box with Previous / Next, Progress dashboard.


## How to Run and Test
1. Extract this ZIP archive into any folder.
2. Double-click **`index.html`** to open it directly in Google Chrome, Microsoft Edge, Safari, or Firefox (no server or installation required).
3. **Optional local server** (if you prefer `http://localhost`):
   ```bash
   python -m http.server 8000
   ```
   Then visit `http://localhost:8000`.

## Structure & Features
- **`index.html` / `styles.css` / `app.js` / `vocab-data.js`**: Complete standalone web application.
- **Exact 11-Page Mapping from `IELTS_Advanced_Vocabulary_200.docx`**:
  - Page 1: Words #1 – #18 (18 words)
  - Page 2: Words #19 – #38 (20 words)
  - Page 3: Words #39 – #57 (19 words)
  - Page 4: Words #58 – #75 (18 words)
  - Page 5: Words #76 – #92 (17 words)
  - Page 6: Words #93 – #114 (22 words)
  - Page 7: Words #115 – #136 (22 words)
  - Page 8: Words #137 – #159 (23 words)
  - Page 9: Words #160 – #176 (17 words)
  - Page 10: Words #177 – #195 (19 words)
  - Page 11: Words #196 – #200 (5 words)
- **Built-in Discussion Audio Story**: Every page includes a cohesive, natural discussion story incorporating 100% of that page's vocabulary words, voiced via the browser's built-in Neural/Standard Text-to-Speech engine with voice selector, speed controls (`0.85x`–`1.3x`), pause/resume, and an optional highlighted transcript.
- **`scripts/page_01_story.txt` – `page_11_story.txt`**: Standalone text scripts for each page's audio story and word list.
- **Full-Page MCQ & Final Corrected Scorecard**: Answer every word's meaning on the current page before advancing to the next page, and view your complete score, wrong-answer filter, synonyms, antonyms, and example sentences at the end.
