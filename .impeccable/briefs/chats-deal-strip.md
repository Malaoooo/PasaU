# Brief: the deal inside the chats pop-up (messenger.js)

Confirmed 2026-10-10. Mode: Operate. From the critique of the chats pop-up (P2 "deal is invisible", raised by the user to in-scope).

## 1. Job and audience
A buyer or seller mid-trade opens Chats from any page. Usually on a phone, often standing at the campus pickup spot, one hand, sometimes on weak signal.

## 2. Outcome and proof
Finish the whole trade inside the pop-up: see where the deal stands, agree on a spot and time, prove the handover with the 6-digit code. Success = a handover confirmed without opening messages.html. Product truth: reserve → meetup at a campus spot → code → done. UniCycle never handles money.

## 3. Direction
Stays in the existing UniCycle world and the existing dock. Thesis: one **deal strip** pinned under the chat header that always shows only *your* next step. Focal moment: the handover (buyer taps to reveal the code; seller types it).

## 4. Strip states (one at a time, worded for the viewer)
| Deal state | Buyer | Seller |
|---|---|---|
| Not reserved for this buyer | "Not reserved yet" · View listing | "Not reserved yet" |
| Reserved, no meetup | **Suggest a time** (spot of that campus + date/time open inside the strip) | same |
| Time suggested by the other person | spot · time · **Accept** · Suggest another · Cancel | same |
| Time suggested by me | "Waiting for <name> to accept" · spot · time · Cancel | same |
| Meetup accepted | spot · time · **Show handover code** (tap to reveal, large digits, tap hides) · Cancel | spot · time · 6-digit code input (numeric keypad) · **Confirm handover** · Cancel |
| Done | "Handover complete" · View listing | same |
| Reserved by someone else / sold / removed | one quiet line, no actions | same |

- Cancelled meetup falls back to "Reserved, no meetup".
- Accepted meetup whose time has passed: "Was today 3:00 PM: confirm or cancel".
- User decisions: full actions in the dock; code is tap-to-reveal; status on list rows.

## 5. List rows
One status per row from the same logic: Interested, Reserved, Meetup suggested, Meetup Tue 3:00 PM, Code ready, Completed. Rows waiting on *you* are emphasised ("Accept meetup", "Confirm handover").

## 6. Interaction and layout
- Strip fixed between header and thread; does not scroll away; at most ~2 lines collapsed; the suggest form expands inside it; 44px targets.
- Meetup bubbles keep their text but drop "Open in Messages to accept or see the code".
- Refresh the strip on any meetup message in that chat (accept/cancel/done post one) and after own actions.
- Buttons disable while working; errors inline in the strip in plain words (e.g. "That code doesn't match. Ask the buyer to read it again."), never raw server text.
- Strip follows the header in tab order; Esc behaviour unchanged; code input `inputmode=numeric`, `autocomplete=one-time-code`.

## 7. Data and constraints
- Existing RPCs only: propose_meetup, accept_meetup, cancel_meetup, confirm_handover; meetup_codes select for the buyer. No new SQL.
- Dock conversation query adds listings(status, reserved_by, school, kind, price_php) and the latest non-cancelled meetup per chat.
- Spots from UC_SPOTS_FOR(listing.school) (universities.js must be loaded on pages with the dock, or fall back to defaults).
- Only messenger.js and the .dock-* CSS change. messages.html stays the full page (photos, quick replies).

## 8. Anti-goals
No second copy of the Messages page, no extra modal, no payments or escrow, the code never on screen without a tap.
