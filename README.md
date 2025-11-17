# K53 Rules – Reviewer (v4: server-side report saving)
- **Reports are written to `./reports/`** on your machine (no download button for users).
- Each report is saved as a JSON file and also appended to `./reports/log.csv`.
- Frontend autoloads `rules_questions.json` and posts reports to `/report`.

## How to run
1. Unzip this folder.
2. Open a terminal in the folder and run:
   ```bash
   python server.py
   ```
3. Visit: http://localhost:8080
4. Review questions → click **Report** → pick A/B/C/D → Save.
5. Your files will appear under `./reports/`:
   - `log.csv` (growing master CSV)
   - `TIMESTAMP-<id>.json` (one per report)

> Keep `rules_questions.json` next to `index.html`. If you add images, put them in an `assets/` folder and reference them by path in the JSON.
