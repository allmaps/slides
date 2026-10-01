# Licensing

Allmaps Slides separates the licenses for its tooling, application and authored
content. The [root license notice](../LICENSE.md) defines the directory scopes.

| Material | Terms |
| --- | --- |
| CLI, reusable packages and repository documentation | [MIT](../LICENSE-MIT.txt). |
| Slides application | [GPL-3.0-or-later](../apps/slides/static/licenses/GPL-3.0.txt), with the [Allmaps Slides Content Permission](../apps/slides/static/licenses/CONTENT-PERMISSION.txt). |
| Independently authored slides, configuration, images, annotations and other content | The respective rights holders' chosen terms. |
| Dependencies, fonts and third-party material | Their own notices and licenses. |

The npm package contains both MIT and GPL-covered parts. Its manifest uses
`SEE LICENSE IN LICENSE.md` to point to the scoped notice and custom permission,
rather than describing the entire archive as MIT or offering a choice between
MIT and GPL.

## Content permission

The additional permission is granted under GPL version 3, section 7. It permits
combining the app with independently authored content without applying GPL to
that content, including when Markdown, frontmatter and assets become HTML, JSON,
Svelte components or JavaScript in a generated presentation.

It also waives any requirement arising solely from that combination to include
the content in the app's Corresponding Source. It does not waive source
obligations for application code or modifications to it, including application
code inside generated files. Moving copied app code into a content repository
does not turn it into independently authored content.

The permission does not license the generated site as a whole under the content
license. It does not grant rights to third-party maps, photographs, fonts or
dependencies. The [permission text](../apps/slides/static/licenses/CONTENT-PERMISSION.txt)
is the authoritative grant; this guide summarizes it.

GPL section 7 allows a downstream distributor to remove an additional permission
from a copy. Users of a fork should check that it still carries this permission.

## Choose a content license

A content repository may choose [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
for its own text and other material. CC BY allows sharing and adaptation, including
commercial reuse, with attribution, a license link and identification of changes.
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) also requires
qualifying adaptations to use the same or a compatible license.

Neither the app's content permission nor CC BY requires publication of the
editable Markdown originals. We encourage authors to publish their content
repositories and sources, but do not make that a condition of this permission.

State the content license in that repository's own license notice and credits.
Identify separately licensed material explicitly: a CC BY notice for your text
does not relicense a museum's images, an ODbL basemap or third-party annotations.
Existing content repositories keep their own notices; the framework license
does not assign them a new license.

## Distributing a site

Browser JavaScript is distributed to visitors. Distributors of GPL-covered app
code must meet the applicable GPL source and notice requirements, even when the
website is entirely static.

The default application carries these files into development and built sites:

- `licenses/NOTICE.txt`: software scope, copyright and warranty notice.
- `licenses/GPL-3.0.txt`: the complete GPL version 3 text.
- `licenses/CONTENT-PERMISSION.txt`: the custom additional permission.
- `licenses/MIT.txt`: the original Slides tooling/library notice.
- `fonts/OFL.txt` and `fonts/SourceSans3-OFL.txt`: bundled font notices.

The credits footer automatically displays the Slides version and links to the
repository's `LICENSE.md`, pinned to the software commit for clean builds (or
`main` for development builds). A package without a repository URL falls back to
the bundled software notice. For a clean packaged build, it also links to the exact software
commit and release notes. This identifies the software, not the content repository.
The HTML links to the software notice using `rel="license"`. Production builds
also generate `_app/licenses/dependencies.md` with bundled dependency notices.
All paths are beneath the site's configured base path.

License files alone do not supply Corresponding Source. Provide recipients with
access to the source matching the application you distribute, including your app
changes and the scripts needed to build it. The automatic commit link can provide
that access for the unmodified released app while the matching source remains
publicly available there. Keep that source available for as long as required;
a commit hash alone does not guarantee availability. A separate release archive
is not required by this release process. A link only to the latest upstream branch
does not identify modified or older deployed versions.

If you change the app, publish its matching source, licenses and build instructions.
For a forked package, configure its public repository before packing; for a custom
app, set `app.sourceUrl` to the matching source. Modified local builds do not claim
that the unmodified upstream commit contains their full source. The automatic
credits identify the build; they do not verify that you have supplied everything
required by the license.

Keep independently licensed content distinct in that source distribution. The
content permission allows its omission; it does not exempt application code
that contains or displays it. See [GPL sections 1 and 6](https://www.gnu.org/licenses/gpl-3.0.en.html)
for the full source-distribution requirements.

## Packages and contributions

`pnpm bundle` includes the application's scoped notice, GPL text and permission
in `@allmaps/slides`. Each reusable helper package includes its MIT notice when
packed separately. Node dependencies retain their own package license files.

For original contributions, use the license and permission applicable to the
destination directory. Retain existing copyright and third-party notices.
Only copyright holders with the necessary rights can grant the additional
permission; it must not be assumed to apply to imported GPL-only code.

The app's canonical GPL and permission texts live in `apps/slides/static/licenses/`,
so source checkouts, npm packages and static sites carry the same files.
The MIT notice is also copied into the individual library packages and the
app's notices; keep those copies consistent when updating copyright notices.

The legal mechanism is documented in [GPL section 7](https://www.gnu.org/licenses/gpl-3.0.en.html#section7).
npm documents the manifest convention under
[package license metadata](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#license).
