# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Students at eight Baguio City schools**: University of the Cordilleras (UC), University of Baguio (UB), Saint Louis University (SLU), University of the Philippines Baguio, Baguio Central University (BCU), Benguet State University (BSU), Pines City Colleges (PCC) and Baguio College of Technology (BCT). Both sides matter equally:
  - **Passing things on:** upper years and graduates with PE uniforms, textbooks, lab kits and supplies they no longer need.
  - **Looking for things:** freshmen and lower years who need exactly those items for the coming term.
  - Mostly on phones, between classes, and busiest around enrollment and the start and end of a semester.
- **The PasaU team (admins)**: review reports and verification requests, remove listings, suspend accounts.
- **Competition judges** (inferred from the competition entry): see the product in live demos and pitch materials.

## Product Purpose

PasaU is a student-to-student marketplace for Baguio campuses. Students sell, swap or give away what they have finished with to the class after theirs, then meet on campus to hand it over. Success means items get reused instead of bought new, deals finish with a confirmed handover, and students trust each other enough to meet.

## Positioning

Campus-bound, course-aware and handover-verified, unlike a general classifieds site or a Facebook group:
- listings carry school, college, program, course code and year;
- a reservation and waiting line, so items go first come, first served;
- meetups only at campus pickup spots, with no shipping and no home addresses;
- a 6-digit handover code that confirms the right person received the item;
- vouches only after a completed handover together;
- Looking For posts matched to sellers, past buyers and higher years in the same course.

## Operating Context

- Entered in a Philippine startup competition; live demos to judges are a real use of the product.
- Launching at all eight schools at once, as one shared market that can be filtered by school.
- Money changes hands in person. PasaU handles no payments.
- Pickup spots are currently one generic list for every campus (Library lobby, Guard house, Gym lobby, Student center, Canteen). They are not approved by any school, and no school partnership is confirmed.
- The academic calendar (enrollment, semester start and end) drives supply and demand.

## Capabilities and Constraints

- **Stack:** static HTML, CSS and vanilla JavaScript on Vercel (no build step), with Supabase for Postgres with row-level security, email and password accounts, Realtime, Storage and pg_cron. supabase-js is loaded from a CDN.
- **Built:**
  - catalog with search, category chips and filters;
  - sell, swap and free listings with up to 5 photos;
  - reserve, waiting line and swap offers;
  - chat with meetup suggestions, the handover code and reminders;
  - Looking For with matching;
  - profile with history, vouches and settings;
  - notifications, reports, blocks and an admin dashboard;
  - accessibility settings panel.
- Prices are in Philippine pesos (₱). The interface is in English.
- **Undecided:** verification by school email, pickup spots per campus, a Filipino language option, account deletion and data export. Payments are out of scope by design.

## Brand Commitments

- **Name:** PasaU (renamed from UniCycle, Oct 2026). Tagline "Pass it on to the next batch". Logo: concept A, cap on a U-turn arrow (logos/mark.svg, mark-white.svg, icon.svg); wordmark is live Poppins 700 text, "Pasa" green #1F5A36 (white on dark) and "U" gold #F2A900.
- **Colour roles:** brand green #1F5A36 is the UI green (buttons, focus on light cards); brand gold #F2A900 is the one accent (selected chips, primary highlights, swap/reserved, focus on the green page); mint #BFE3C9 is success/free/done. Tokens in site.css :root.
- **Mark:** a graduation cap on a U-turn arrow; on the hero badge and waitlist section it sits inside two cycle arrows that turn (the .wheel). Old UniCycle files are in `backups/unicycle-brand/`.
- **Tagline:** "Pass it on to the next batch." Shown in the footer lockup and the page title.
- **Voice:** plain, warm, honest, student to student. Examples: "No shipping and no home addresses", "No code, no sale", "Your email is never shown".

## Evidence on Hand

- Live site at unicycle-seven.vercel.app.
- Product map with speaker notes: https://claude.ai/artifact/QdgsYgTncjFeHwtNyWi61J
- No real users, testimonials, transaction numbers or school endorsements yet. The current listings are test data ("test offer", school "Your University"). Never invent traction, user counts, testimonials, prices or school approval.
- The course lists per school in `universities.js` are unverified starter lists.

## Product Principles

1. **Campus first:** every listing belongs to a school, and every meetup happens on a campus.
2. **Show the trust mechanics:** the line, the code and vouches build trust better than claims do.
3. **Both sides equally:** selling and finding are equally first-class.
4. **Honest by default:** no made-up listings, users or endorsements; say plainly what PasaU does not do (money, shipping).
5. **Phone first, little effort:** quick to list and quick to find, one-handed.

## Accessibility & Inclusion

- Target WCAG AA contrast in both light and dark themes. Respect reduced motion, and keep every action reachable by keyboard.
- Keep the existing accessibility panel: text size, contrast, colour theme, motion, easy-to-read font, keyboard shortcuts.
- Plain English for a bilingual (English and Filipino) student audience.
