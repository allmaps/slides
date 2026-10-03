---
"@allmaps/slides": patch
---

Replace the backtick shortcut with Space in the central keyboard handler. Hold Space to temporarily hide warped maps for comparison with the basemap, then release it to restore their configured opacity and visibility. Prevent scrolling during the hold, preserve typing and focused controls, and restore the maps when the window loses focus.

Keep shortcuts working after clicking the map or navigating through chapter links. Reserve keys only for controls that use them, and let image dialogs handle Escape before the slideshow's panel overlays.

Move focus to the reading panel when scrolling its text, so Space does not remain assigned to a previously clicked map or navigation button. Give the panel a keyboard focus target, preserve text-entry focus, and keep handled shortcuts from interrupting smooth chapter navigation.

Move focus to the map canvas on wheel and trackpad zoom gestures, so Space is not left assigned to a previous control. Keep native focus handling for clicks and remove the map canvas's browser focus outline.

Explicitly repaint after changing comparison opacity. Allmaps can omit its change event when combining layer and map-specific opacity, leaving a settled map's old frame on screen until another interaction or tile update. Space now redraws immediately after zooming has finished, without relying on focus changes or ongoing rendering.

Also request a repaint after applying per-map options, so the layers-panel hide/show button and clickable layer row update a settled map immediately.
