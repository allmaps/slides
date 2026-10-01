# Interface behavior

This reference describes navigation, image loading and mobile behavior for
contributors. To change labels, colors or credits, see
[configuration](configuration.md).

## Navigation

The navigator includes chapter links, a progress bar based on the current chapter,
and menus for maps, chapters, theme and panel visibility. Clicking the chapter
count opens the chapters overlay. The navigator floats
over the bottom of the reading panel. At 1536px, the reading panel widens from
480px to 600px and the navigator sits beside its left edge at 480px wide.
Hiding the text centers the navigator across the full screen at this wide
breakpoint; on smaller desktop screens it stays against the right edge. Position
changes animate on resize and visibility changes.
A subslideshow begins with its title and a back arrow above the first chapter,
inside the scroll. Footer actions return to the main slideshow or, on the right,
to the top. The numbered chapter button beneath each title opens the chapters
overlay. The map button beside it shows the map count and opens the map layers
panel; its singular/plural labels can be translated with `mapCountSingular` and
`mapCountPlural`. The navigator count also opens the chapters overlay.
Closing the chapters overlay resets its scroll position and expanded branches;
reopening it expands only the current chapter's branch.
The map button always counts all maps configured for its chapter, including
temporarily hidden maps. Visibility toggles in the layers panel reset when the
active chapter or slideshow changes.
On mobile, swipe left or right across the navigator's arrows and counter to move
to the next or previous chapter. Drag the handle between full, half-height
and collapsed positions. The rounded card keeps a margin above the bottom edge and moves behind the
fixed navigator. When collapsed, only the card's handle
and a border around the navigator remain visible. The progress bar stays visible
in every position. The expanded card stops below the app title, with the same
margin as around the edges. Tapping the handle also animates the card open.
The maps, chapters and credits overlays open above the navigator. Opening them
does not change the map padding. On mobile, all overlays can grow to the
available height below the app title, independently of the text card's height,
including when the card is collapsed. On wide desktop layouts, overlays can use all the space
between the top screen margin and navigator. Expanding the mobile card to its
maximum height preserves the map's previous framing.

Keyboard shortcuts: **Left / Right** for previous / next chapter, **B** to return
to the main slideshow and **H** to hide / show the sidebar. Shortcuts leave text
entry, modified browser shortcuts and image dialogs alone. The mobile handle also
supports **Up / Down**, **Home** (hide) and **End** (expand).
Rapid chapter navigation advances from the latest requested chapter while smooth
scrolling settles; manual scrolling can interrupt it without snapping back.

## Image viewer

All figures fetch metadata when the page mounts, reserving the correct proportions
before readers reach them. Atlas and image pixels start loading one reading-panel
height above or below the viewport. The preload distance updates when the panel
resizes. Reserved areas update immediately as dimensions become known.
Thumbnail preloading is off in Slides.
The Atlas module is shared across figures. A Svelte component renders Atlas in
non-interactive mode in the story; activating the image opens a zoomable modal with
zoom controls and a caption overlay containing the same source links.
IIIF images require JavaScript; their authored captions remain available without it.
The modal starts at the preview region and allows zooming out to the complete
image. Escape or the close button dismisses it and restores focus. `+` and `-`
zoom; `Home` or `0` fits the complete image. Slides disables the component's download
buttons and View Transition API; opening and closing move the same canvas
immediately between the story and modal. Atlas's context-menu handler remains
active in the non-interactive preview; zoom/pan listeners are limited to the modal.

The interface disables double-tap page zoom while allowing page panning and pinch
zoom. Map and image viewers keep their own gesture handling. The light/dark toggle
also updates the browser's `theme-color`, page background and `color-scheme`, using
the same saved preference as the interface.

The app imports `CanvasPanel` from `@allmaps/slides/canvas-panel`. In the workspace
this forwards to `@allmaps/svelte-canvas-panel`; the Slides release includes its
compiled output. Source edits participate in the development server's hot reload.

The component owns IIIF parsing, Atlas rendering and the modal. Slides owns
Markdown transformation, asset URL resolution and the reading-panel preload
observer. `CanvasFigure.svelte` passes the caption as a Svelte snippet and maps
app theme variables to component CSS variables. See the
[component reference](canvas-panel.md) for its API, interaction lifecycle and
Atlas upgrade notes.

Run Markdown regression tests with `pnpm --filter @allmaps/slides-app test` and
viewer tests with `pnpm --filter @allmaps/svelte-canvas-panel test`.

## Home Screen installation

The app keeps controls inside iOS safe-area insets in portrait and landscape.
An Apple touch icon derived from the favicon is included for Home Screen installs.
The generated `manifest.webmanifest` uses the overall title and scopes
navigation to the deployment's base path, including every subslideshow. It opens
the main slideshow in standalone mode. Installed apps fill the viewport while
only the reading panels scroll. After deploying changes to installation metadata,
remove and re-add the Home Screen shortcut to test with fresh settings. Links to
external sites can still open an iOS browser sheet.
