---
name: apiritivo-ui-review
description: Review APIritivo UI changes against the repo's layout, copy, and shared style rules. Use for a focused interface review without expanding into backend review.
---

# UI review

Read [UI guidance](../../../ui-guidance/README.md), then inspect the changed UI source.

Check:

* Nested panels: replace inner decoration with rows or spacing.
* Repeated copy: shorten without hiding needed information.
* Dash phrases: flag visible prose, not URLs or technical values.
* Style drift: reuse tokens, fonts, and control variants.
* Interaction: labels, keyboard focus, narrow layouts, long values, real states.
* Behavior: handlers and sign in frame preserved; example data labeled.

Follow current testing permissions. A source review is not browser verification. Report concrete findings with file locations. For a review request, report first; make edits when the task authorizes them.
