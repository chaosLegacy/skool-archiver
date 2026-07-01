# Build a Chrome Extension to Archive My Purchased Skool Courses

You are an expert Chrome Extension engineer with deep experience in Manifest V3, TypeScript, React, Playwright, PDF generation, DOM extraction, and browser APIs.

I want you to build a **production-quality Chrome Extension** that allows me to archive the Skool courses that **I have legitimately purchased and have access to** for **personal offline use only**.

The extension must **not** bypass authentication, DRM, paywalls, or access controls. It should only operate on pages I can already access in my logged-in browser session.

## Tech Stack

* Manifest V3
* TypeScript
* React for popup/options UI
* Vite
* Tailwind CSS
* Chrome Storage API
* Chrome Downloads API
* jsPDF or pdf-lib
* JSZip
* FileSaver
* IndexedDB for temporary storage if needed

The code should be clean, modular, documented, and easy to maintain.

---

# Main Features

## 1. Detect Skool

When browsing skool.com, the extension should activate automatically.

If not on Skool:

Show:

"This page is not a Skool classroom."

---

## 2. Scan Entire Classroom

The extension should:

* Discover all modules
* Discover every lesson
* Build a lesson tree
* Show progress while scanning

Display something like:

Module 1

* Lesson 1
* Lesson 2

Module 2

* Lesson 3
* Lesson 4

---

## 3. Download Lesson Content

For every lesson, extract:

* Title
* Subtitle
* Author
* Publish date (if available)
* Body text
* Lists
* Tables
* Images
* Code blocks
* Quotes
* Embedded links

Preserve formatting as accurately as possible.

---

## 4. Export PDF

Generate a clean PDF for each lesson.

Requirements:

* Large title
* Module name
* Lesson name
* Images embedded
* Proper typography
* Page numbers
* Footer
* Hyperlinks
* Table formatting
* Code block formatting

The PDF should look professional.

---

## 5. Download Images

Download every image referenced inside lessons.

Replace remote URLs inside the PDF with local references if possible.

---

## 6. Download Videos

If the lesson contains videos that are directly accessible through the browser (without bypassing DRM or protected streaming mechanisms), offer to save them for offline viewing using the browser's normal capabilities.

Support detection of common embedded providers such as:

* Vimeo
* Loom
* Wistia
* YouTube
* Native HTML5 video

If a video cannot be saved because it is DRM-protected or otherwise restricted, clearly indicate that instead of attempting to circumvent protections.

---

## 7. Export Formats

Allow exporting:

* PDF
* HTML
* Markdown
* JSON

---

## 8. Entire Classroom Export

One click:

Archive Classroom

The extension should:

Scan

↓

Extract

↓

Generate PDFs

↓

Download videos where permitted

↓

Download images

↓

Create folder structure

↓

Zip everything

Folder structure:

Course Name/

Modules/

Lesson.pdf

Lesson.html

Lesson.md

images/

videos/

manifest.json

metadata.json

---

## 9. Resume Interrupted Downloads

If Chrome closes:

Resume automatically.

Track:

Completed lessons

Remaining lessons

Failed lessons

---

## 10. Progress Window

Display:

Scanning...

Lesson 14 / 83

PDF generation

Downloading images

Downloading videos

Creating ZIP

Estimated remaining time

---

## 11. Error Recovery

If a lesson fails:

Retry

If it still fails:

Skip

Continue.

Generate a final report.

---

## 12. Settings

Allow:

Export PDF

Export HTML

Export Markdown

Download images

Download videos where available

Maximum parallel downloads

Output filename format

Dark/light theme

---

## 13. Popup UI

Beautiful modern interface.

Dashboard showing:

Course detected

Lessons found

Export button

Progress

Logs

Errors

---

## 14. Architecture

Separate into modules:

content/

background/

popup/

options/

utils/

pdf/

extractors/

exporters/

download/

storage/

types/

---

## 15. Code Quality

Use:

Strict TypeScript

ESLint

Prettier

No duplicated code

Dependency injection where appropriate

Reusable utilities

---

## 16. DOM Extraction

Create reusable extractors for:

Title

Module

Body

Images

Tables

Videos

Downloads

Code blocks

Attachments

Quotes

Links

---

## 17. PDF Engine

Create reusable PDF builder.

Support:

Automatic page breaks

Image scaling

Syntax highlighted code blocks

Clickable links

Headers

Footers

Table rendering

---

## 18. ZIP Export

Generate:

Course.zip

Containing:

PDFs

Images

Videos (where saved)

Metadata

HTML

Markdown

---

## 19. Metadata

Generate:

metadata.json

Containing:

Course title

Export date

Number of modules

Number of lessons

Image count

Video count

PDF count

Version

---

## 20. Future Extensibility

Design so new LMS platforms can later be supported by implementing new extractor modules without changing the core export pipeline.

---

# Deliverables

Produce:

1. Complete source code

2. Folder structure

3. Build instructions

4. README

5. Installation guide

6. Manifest V3 configuration

7. Icons

8. PDF templates

9. Type definitions

10. Unit tests where practical

11. A polished UI with loading states and error handling.

Do not use deprecated Chrome APIs. Follow Manifest V3 best practices and ensure the extension only accesses pages the user is already authorized to view, without bypassing any technical protection measures.

