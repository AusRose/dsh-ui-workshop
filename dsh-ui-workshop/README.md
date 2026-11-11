# dsh-ui-workshop

Interface workshop for DeepSeek Harness. Ported from `dsh-smooth-skin`: the
sidebar rail layout, the workspace archive switch, the composer tool row with
its context ring, and the model panel.

## What it does

```
[ rail ][ panel: brand, new chat, workspaces, settings ]
```

The sidebar's own global panel list (`panelList`) leaves the flow and becomes the
icon rail at the far left. The column keeps a rail-wide gutter, so the brand row,
New Session, the workspace tree, and the settings foot sit in the panel. Nothing
is unmounted or re-registered, so every shipped control keeps its behaviour:
New Session, the workspace tree, the recent Session list, the More menu, and
Settings.

Hovering a rail icon names it. The row's own `aria-label` (already localized by the
host: 插件, 插件市场, 自动化任务, 更多) is read and painted in a tooltip beside the
icon after a 350ms dwell; leaving, scrolling, clicking, or Escape dismisses it, and
keyboard focus reveals it too. The host's own row tooltip is skipped because it is
disabled while the column is wide, which is exactly this rail; the collapsed rail
keeps the host's tooltip untouched.

The rail measurements are `dsh-smooth-skin`'s (a 0.91 unit, 44 unit rail, 38 unit
buttons, 9 unit gaps, rail starting below the desktop caption). Colours come from
host theme tokens rather than that skin's palette, with one exception: the model
slider keeps its artwork palette (see [Naming parity](#naming-parity)).

### Narrow windows

Windows never uses the sidebar drawer: below the 1024px auto-collapse breakpoint
the frame closes the sidebar by zeroing its grid track, and the sidebar shell
hides its panel list and foot, so the shipped rail disappears. The plugin keeps
the rail: a collapsed sidebar's column leaves that zero-width track, pins to the
frame's left edge at rail width, restores the panel list and foot, and the center
column reserves the same 44px gutter. Expanding the sidebar removes the collapsed
marker, so the normal grid column and the rules above take over again. Non-Windows
compositions keep their own collapsed rail or drawer.

### Workspace archive switch

Hovering the column lays a two-segment control over the 工作区 title: 进行中 shows
running Sessions, 已归档 shows the archive. It is not the rail's own state: the
control reads and writes the workspace browser's persisted view store, the same
one the host's view-options menu uses, so the two never disagree.

The control renders in `shell.overlay` and is positioned by measuring the
browser's section header, so it does not sit inside the host's tree and survives a
region remount. It stays hidden until that measurement succeeds. Tab reveals it,
and `prefers-reduced-motion` drops the fade.

### Composer tool row and context ring

The tool row takes `dsh-smooth-skin`'s metrics: a 36px row with 8px gaps, the add
control as a 32px circle, mode controls at 28px, and the model seat at 32px.

The shipped composer dock row is hidden (`[data-composer-dock]`); the context
reading moves into a 22px ring in the composer row (`conversation.input.right`).
Clicking the ring opens a panel above the composer with the composition bar
(system/tools/messages), the Session's model and tool timings, first-token and
output speed, and the token usage detail. The ring renders nothing until the
projection publishes a context window.

### Model panel

The native model trigger is captured and replaced with a two-page panel: reasoning
effort, and the model catalogue it slides over to. Ported from `dsh-smooth-skin`:

- a 26px track with a 28px glider, draft-while-dragging and commit-per-stop;
- four thinking-level backdrops (`off/low/high/max`) cross-fading as the thumb
  moves, shown only for DeepSeek provider groups;
- on the top stop, 96 drifting sparks and 4 wandering glints;
- the host's own "Default" effort returned by an auto chip;
- the catalogue page with a live search, per-row pending state, and the current
  model marked.

The artwork is `src/think-art.js` (four WebP data URIs, extracted from that skin's
`THINK_ART` and inlined by `build.mjs`, so the bundle carries no extra request).
The panel reads and writes the host's model directory through the
`modelDirectories` service; when that service is absent the plugin captures
nothing and the native menu stays in place.

## What it does not do

Ported: rail geometry, rail surface, panel-list placement, panel button sizing,
label hiding, More ordering, settings foot in the rail, header row heights, the
separator above the workspace tree, Session and workspace row metrics, the
archive switch, the composer tool row, the context ring, and the model panel. The
row's hollow state dot is deliberately not drawn; the leading cell keeps its
width, so Session titles stay aligned.

Not ported: the theme system, workspace tabs, settings pages, the home and plugins
rail buttons, and the session delete action. Those belong to `dsh-smooth-skin`
and can be added here later as separate features.

## Naming parity

The rail, panel, and filter classes (`.smooth-context-*`,
`.smooth-workspace-filter`, `.smooth-filter-option`) and the `--smooth-*` custom
properties are copied from `dsh-smooth-skin`, so a rule here can be read side by
side with its source. The model panel's `.smooth-model-*` classes follow the same
names, and its searchable list reuses that skin's `.smooth-git-*` classes.

Only the values differ: `dsh-smooth-skin` generates its palette tokens from theme
presets, while this plugin binds the same names to host tokens in one block. The
exception is the slider palette (`--smooth-model-track`, `-blue`, `-thumb`,
`-dot`): its light and dark values are copied verbatim, because those are artwork
colours rather than theme surfaces.

Because the class names and token names are identical, run this plugin and
`dsh-smooth-skin` one at a time.

## Why it is CSS, not a slot

`sidebar` is a `single` slot and the first registrant owns it. A second
registration stays `active: false`; declaring the occupant's child seats from it
makes the shipped `ui-sidebar` entry fail to activate, which aborts the web boot.
Both outcomes were observed on this deployment. The rail therefore never
registers into `sidebar`: it is the shipped column re-laid-out by a stylesheet
plus one `body` attribute, so disabling the bundle restores the shipped layout.

The other three features need seats the shipped column does not have, so each
registers into an additive host seat instead:

| Feature | Seat |
| --- | --- |
| workspace archive switch | `shell.overlay` |
| context ring | `conversation.input.right` |
| model panel | `conversation.input.overlay` |

Each registration is wrapped, and each host service or store is resolved
defensively, so a missing seat or service drops that one feature (with a
`console.warn`) and leaves the rest of the plugin alone. Nothing here registers
into `sidebar`, so another plugin's entry activation is never endangered.

## Selectors

Shipped styles are CSS modules named `<hash>_<name>`; the plugin matches the
stable `_<name>` tail in both forms:

```css
:is([class$="_root"], [class*="_root "])
```

The column is identified structurally as the only `root` that owns a `logoRow`,
so no frame class name is assumed. The collapsed rail is excluded with
`:not(_collapsed)` because it already has its own 56px layout.

## Conflict with other sidebar skins

`dsh-smooth-skin` also repositions `panelList`. Run one or the other.

## Files

| File | Role |
| --- | --- |
| `package.json` | bundle manifest (`dsh.bundle.patch`, `dsh.client`), locale and icon exports |
| `cordis.patch.yml` | the single `insert` row that activates the bundle |
| `src/host.js` | Host half: names the row, applies nothing |
| `src/client.js` | selectors, stylesheet, scope attribute, and the three overlay components |
| `src/think-art.js` | the four thinking-level backdrops as WebP data URIs |
| `build.mjs` | wraps `src/` into `lib/index.js` and the module-loader `lib/client.js` |
| `lib/` | build output only: the Host artifact and the browser factory |
| `locale/{en,zh}.json` | `meta.title` / `meta.description` for the Plugins page |
| `icon.svg` | bundle icon |
| `docs/` | verification screenshot: the rail layout |

## Build and install

```powershell
cd dsh-ui-workshop
node build.mjs
```

Install the absolute package directory through `plugin_manager`
(`install_bundle`), then restart DSH: client modules are enumerated at start, not
on a page reload.
