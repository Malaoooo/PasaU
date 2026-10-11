# Shape brief: campus-first home page (index.html) — confirmed 2026-10-09

1. Job and audience: Students from all 8 Baguio schools (UC, UB, SLU, UP Baguio, BCU, BSU, PCC, BCT), mostly on phones between classes; passing things on or looking for them, both equally. Judges in demos. Hero = Persuade, shop = Operate.

2. Outcome and proof: within five seconds a student sees their own campus and what's available there. Success: pick a school (or it's preselected when logged in) and see "12 listings at SLU" with those listings first. Proof from real data only: live counts per campus, a school on every card, the campus on every pickup spot. No invented numbers; no claim that spots are school-approved.

3. Direction (incumbent world: velvet gradient, glass cards, pills, Bricolage Grotesque + Hanken Grotesk): "your campus is the first decision, and the page re-tunes to it." Campus chips directly under "Pass it on to the next class.", above search: All campuses · UC · UB · SLU · UP Baguio · BCU · BSU · PCC · BCT. Picking one updates the count line, search placeholder ("Search SLU listings…"), featured carousel, shop, For you, Free & swaps, and Looking For order. Focal moment: tap a chip, the count changes and listings glide to that campus.

4. Scope: hero switcher + count line; shop split into "At SLU" then "More from other Baguio campuses"; campus chip on every card and hero card; campus + spot in the listing pop-up ("Pick up at SLU · Library lobby"); sell form uses the school's spot list; school data cleanup. Remove the School dropdown from filters (switcher replaces it). Every school gets its own spot list, filled with the five defaults (Library lobby, Guard house, Gym lobby, Student center, Canteen), shown as "SLU · Library lobby".
   Untouched: visual identity, handover section, top bar and menu, accessibility panel, other pages.
   Anti-goals: no blocking "pick your school" pop-up, no hiding other campuses completely, no invented counts, no "approved spot" claims.

5. States and ranges: first visit logged out → All campuses; logged in → profile school; returning → last pick (localStorage; shareable ?campus=SLU). Campus with 0 listings: "Nothing at BCT yet." + List the first item / See other campuses. Listings with no known school (test data "Your University") grouped under other campuses, labelled "School not set". Profile school "Other (not listed)" → All campuses.

6. Interaction and layout: chips ≥44px, show counts ("SLU 12"), zero-count campuses dimmed but tappable; one scrolling row on phones with an edge fade; arrow keys; aria-live announces "12 listings at SLU". "More from other campuses" shows a first set, then Show all.

7. Constraints and open decisions: static HTML/CSS/vanilla JS, no build; school names must match the 8 official names in universities.js. Counts come from loaded listings — builder must confirm the page loads all active listings. Spot lists live per school in universities.js (one short list each) so real names can replace defaults later; defaults are generic names, not buildings; listings keep their saved spot, and spots not in the list still show as written. Real spot names are an optional later edit.
