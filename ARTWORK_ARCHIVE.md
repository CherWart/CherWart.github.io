# Artwork Archive Project

This project uses the catalogue raisonne folder as the official source of truth:

`/Volumes/Cher/Catalogue Raisonné（作品总目录）/`

The website Works section is generated from those Word artwork records, not from the older placeholder website data.

## Current Rules

- Read every official Artwork Record automatically.
- Keep metadata exactly as written in the records.
- Use the image embedded in each Artwork Record as that artwork's matched image.
- Do not invent, rename, merge, or modify artwork information.
- If any record or image cannot be matched with certainty, write it to the confirmation report.

## Current Files

- `data/artwork-archive.json`: official master artwork database for the website.
- `data/catalogue-raisonne-master.json`: same catalogue database, kept with an explicit catalogue name.
- `data/artworks.js`: website data used by the Works section.
- `data/artwork-archive.csv`: spreadsheet export of the master records.
- `data/artwork-archive-report.md`: confirmation report.
- `data/catalogue-raisonne-confirmation-report.md`: same confirmation report, kept with an explicit catalogue name.
- `assets/images/catalogue-raisonne/`: website-sized images extracted from each official Word record.

## Build Tool

- `tools/build_catalogue_raisonne.rb`: reads the catalogue folder, extracts all artwork records and embedded images, writes the master database, writes the website data, and generates the confirmation report.

## Current Status

- Artwork records read: 56
- Embedded images matched: 56
- Confirmation issues: 0
- Duplicate artworks requiring confirmation: 0
