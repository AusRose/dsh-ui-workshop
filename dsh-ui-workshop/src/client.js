/**
 * dsh-ui-workshop — browser half.
 *
 * An interface workshop for DeepSeek Harness. Version 0.3.1 carries four features:
 * the sidebar rail and the workspace archive switch, the composer's context ring,
 * and the model panel, all ported from dsh-smooth-skin.
 *
 * ## Why the rail is CSS and not a slot
 *
 * `sidebar` is a `single` slot, and the first registrant owns it. A second
 * registration is stored but stays `active: false`, so the column keeps rendering
 * the shipped SidebarRoot. Trying to displace it, by declaring its child seats from
 * a second registration, makes the shipped entry fail to activate, and one failed
 * client entry aborts the web boot. Both outcomes were observed on this
 * deployment, so this plugin never registers into `sidebar` and never touches
 * another plugin's entries.
 *
 * The layout is therefore the shipped column re-laid-out:
 *
 *     [ rail ][ panel: brand, new chat, workspaces, settings ]
 *
 * Nothing is unmounted or re-registered: New Session, the workspace tree, the
 * recent Session list, the More menu, and the settings foot keep working exactly
 * as shipped. The plugin installs one stylesheet and one body attribute, and
 * removes both when the bundle is disabled.
 *
 * The archive switch, the context ring, and the model panel need seats the shipped
 * column does not have, so they register into additive host seats
 * (`shell.overlay`, `conversation.input.right`, `conversation.input.overlay`).
 * Each registration is guarded, so a missing seat or service drops that feature
 * only.
 *
 * ## Provenance
 *
 * The measurements, paddings, row heights, and the hollow Session state dot are
 * dsh-smooth-skin's. Its colour variables are replaced by host theme tokens, so
 * the layout survives a palette change and follows light and dark themes without a
 * second stylesheet; only the model slider's artwork palette keeps that skin's
 * values.
 *
 * @module dsh-ui-workshop/client
 */

import { Fragment, createElement as h, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

/* ---------------------------------------------------------------- selectors */

/**
 * One shipped CSS-module part, matched by its stable name suffix.
 *
 * The shipped styles are CSS modules whose class names are `<hash>_<name>`. The
 * build hash changes between releases, the `_<name>` tail does not. Both the
 * "last class" and the "followed by another class" forms are matched because a
 * part carries extra state classes when it is active, collapsed, or animating.
 *
 * @param name - the CSS-module part name, for example `root` or `panelList`.
 * @returns a selector matching any element carrying that part.
 */
function part(name) {
  return `:is([class$="_${name}"],[class*="_${name} "])`;
}

/** The frame's sidebar column. */
const COLUMN = part('sidebarCol');
/** The sidebar shell: the only `root` that owns a brand row, while expanded. */
const ROOT = `${part('root')}:has(> ${part('logoRow')}):not(${part('collapsed')})`;

/** Body attribute scoping every rule, so nothing leaks into another surface. */
const ATTR = 'data-dsh-ui-workshop';

const STYLE_TAG_ID = `${PACKAGE_NAME}-style`;

/**
 * The rail, ported from dsh-smooth-skin's sidebar block.
 *
 * Every rule is scoped by `body[ATTR]`, and every colour is a host theme token.
 * The `--smooth-*` variables carry that skin's measurements verbatim.
 */
const CSS = `
body[${ATTR}]{
  --smooth-l:.91px;
  --smooth-rail-width:calc(44 * var(--smooth-l));
  --smooth-rail-button-size:calc(38 * var(--smooth-l));
  --smooth-rail-icon-size:calc(24 * var(--smooth-l));
  --smooth-rail-gap:calc(9 * var(--smooth-l));
  --smooth-caption:var(--dsh-windows-titlebar-height,40px);
  --smooth-rail-top:calc(var(--smooth-caption) + 4 * var(--smooth-l));
  --smooth-rail-panels-top:calc(var(--smooth-rail-top) + var(--smooth-rail-button-size) + var(--smooth-rail-gap));
  /* dsh-smooth-skin generates the palette tokens from its theme presets; here the same
     names are bound to host theme tokens, so the rules below can stay verbatim. */
  --smooth-radius-xs:var(--dsw-radius-sm);
  --smooth-radius-sm:var(--dsw-radius-sm);
  --smooth-radius-md:var(--dsw-radius-md);
  --smooth-radius-lg:var(--dsw-radius-lg);
  --smooth-radius-xl:var(--dsw-radius-lg);
  --smooth-sidebar:var(--dsw-specific-sidebar-fill);
  --smooth-rail:color-mix(in srgb,var(--dsw-alias-label-primary) 5%,var(--dsw-specific-sidebar-fill));
  --smooth-surface:var(--dsw-alias-bg-layer-1);
  --smooth-surface-2:var(--dsw-alias-bg-layer-1);
  --smooth-surface-3:var(--dsw-alias-bg-layer-2);
  --smooth-selected:color-mix(in srgb,var(--dsw-alias-label-primary) 12%,transparent);
  --smooth-line:var(--dsw-alias-border-l1);
  --smooth-line-strong:var(--dsw-alias-border-l2);
  --smooth-muted:var(--dsw-alias-label-secondary);
  --smooth-text:var(--dsw-alias-label-primary);
  --smooth-accent:var(--dsw-alias-brand-primary);
  --smooth-ink:var(--dsw-alias-bg-base);
  --smooth-shadow-2:var(--dsw-elevation-panel,0 2px 5px rgb(0 0 0 / 20%),0 8px 24px rgb(0 0 0 / 16%));
  /* The slider palette, taken verbatim from dsh-smooth-skin's light preset. */
  --smooth-model-track:#eef2f6;
  --smooth-model-blue:#4f86c6;
  --smooth-model-thumb:#ffffff;
  --smooth-model-dot:rgba(40,55,70,.22);
}

/* And its dark preset, under the attribute the host sets for dark themes. */
body[${ATTR}][data-ds-dark-theme]{
  --smooth-model-track:#2a2d31;
  --smooth-model-blue:#6aa8f0;
  --smooth-model-thumb:#f4f6f9;
  --smooth-model-dot:rgba(255,255,255,.32);
}

/* The column owns the sidebar fill; its border is drawn by the rail instead. */
body[${ATTR}] ${COLUMN}{background:var(--smooth-sidebar);border-right:0}

/* The rail is made from the existing panel buttons and the account trigger. */
body[${ATTR}] ${COLUMN} ${ROOT}{
  position:relative;
  padding:0 calc(18 * var(--smooth-l)) 10px calc(var(--smooth-rail-width) + 18 * var(--smooth-l));
  background:var(--smooth-sidebar);
  --dsh-sidebar-inline-padding:calc(14 * var(--smooth-l));
}
/* The rail's own surface, behind the buttons. */
body[${ATTR}] ${COLUMN} ${ROOT}::after{
  content:"";position:absolute;top:0;bottom:0;left:0;width:var(--smooth-rail-width);
  border-radius:0 var(--smooth-radius-lg) 0 0;
  background:var(--smooth-rail);box-shadow:none;pointer-events:none;
}

body[${ATTR}] ${COLUMN} ${part('logoRow')}{
  height:calc(32 * var(--smooth-l));min-height:calc(32 * var(--smooth-l));margin:0;padding:0;
}
body[${ATTR}] ${COLUMN} ${part('newSession')}{
  height:calc(30 * var(--smooth-l));min-height:calc(30 * var(--smooth-l));
  margin-top:calc(2 * var(--smooth-l));margin-bottom:calc(3 * var(--smooth-l) + 1px);
  border:1px solid var(--smooth-line);border-radius:var(--smooth-radius-md);
  background:var(--smooth-surface-2);font-weight:500;font-size:calc(14 * var(--smooth-l));
}
body[${ATTR}] ${COLUMN} ${part('newSession')}:hover{background:var(--smooth-surface-3)}

/* The global panel list is the rail: fixed to the column edge, labels dropped. */
body[${ATTR}] ${COLUMN} ${ROOT} > ${part('panelList')}{
  position:fixed;top:var(--smooth-rail-panels-top);bottom:calc(24px + var(--smooth-rail-button-size));left:0;
  box-sizing:border-box;width:var(--smooth-rail-width);
  display:flex;flex-direction:column;align-items:center;gap:var(--smooth-rail-gap);
  margin:0;padding:0;overflow-x:hidden;overflow-y:auto;z-index:29;
  scrollbar-width:none;
}
body[${ATTR}] ${COLUMN} ${ROOT} > ${part('panelList')}::-webkit-scrollbar{width:0;height:0}
/* More stays the lowest entry however many panels a plugin appends. */
body[${ATTR}] ${COLUMN} ${ROOT} > ${part('panelList')} > :is(${part('moreAnchor')},*:has(${part('moreAnchor')})){order:1}

body[${ATTR}] ${COLUMN} ${part('panelRow')}{
  box-sizing:border-box;display:flex;align-items:center;align-self:center;flex:none;
  width:var(--smooth-rail-button-size);height:var(--smooth-rail-button-size);
  min-width:0;min-height:0;margin:0;padding:0;
  justify-content:center;border:0;border-radius:var(--smooth-radius-md);
}
body[${ATTR}] ${COLUMN} ${part('panelRow')} ${part('panelTitle')}{
  position:absolute;width:1px;height:1px;padding:0;margin:-1px;
  clip-path:inset(50%);overflow:hidden;white-space:nowrap;border:0;
}
body[${ATTR}] ${COLUMN} ${part('panelActive')}{background:var(--smooth-selected)}
/* The rail's glyphs take the reference icon size, and the glyph cell is centred. */
body[${ATTR}] ${COLUMN} ${part('panelRow')} svg{
  width:var(--smooth-rail-icon-size);height:var(--smooth-rail-icon-size);flex:none;
}
body[${ATTR}] ${COLUMN} ${part('panelRow')} ${part('panelIcon')}{
  width:var(--smooth-rail-icon-size);height:var(--smooth-rail-icon-size);
  display:flex;align-items:center;justify-content:center;flex:none;
}

/* The account and settings controls stack at the rail's foot. */
body[${ATTR}] ${COLUMN} ${ROOT} > ${part('footArea')}{
  position:fixed;bottom:10px;left:0;box-sizing:border-box;width:var(--smooth-rail-width);
  display:flex;flex-direction:column;align-items:center;gap:6px;
  margin:0;padding:0;z-index:29;
}
body[${ATTR}] ${COLUMN} ${part('footArea')} ${part('triggerRow')}{width:var(--smooth-rail-button-size);margin:0 auto}
body[${ATTR}] ${COLUMN} ${part('footArea')} ${part('trigger')}{
  width:var(--smooth-rail-button-size);min-width:var(--smooth-rail-button-size);height:var(--smooth-rail-button-size);
  padding:0;justify-content:center;border-radius:var(--smooth-radius-md);
}

/* Windows never uses the sidebar drawer: the frame closes the sidebar by zeroing
   its grid track, and the shell hides the panel list and foot, so the rail
   vanishes once the window narrows past the auto-collapse breakpoint. Keep the
   workshop rail instead: the column leaves the zero-width grid track and pins to
   the frame's left edge, the shell's hidden parts come back, and the center column
   reserves the same gutter. Expanding the sidebar drops the attribute, so the
   normal grid layout and the rules above take over again. */
html[data-windows-titlebar] body[${ATTR}] [data-sidebar-collapsed] ${COLUMN}{
  position:fixed;left:0;top:var(--smooth-caption);bottom:0;z-index:29;
  box-sizing:border-box;width:var(--smooth-rail-width);overflow:visible;
  background:var(--smooth-sidebar);border-right:0;
}
html[data-windows-titlebar] body[${ATTR}] [data-sidebar-collapsed] ${part('centerCol')}{
  box-sizing:border-box;padding-left:var(--smooth-rail-width);
}
html[data-windows-titlebar] body[${ATTR}] [data-sidebar-collapsed] ${COLUMN} ${part('root')}${part('collapsed')}{
  position:relative;padding:0;background:var(--smooth-sidebar);
}
html[data-windows-titlebar] body[${ATTR}] [data-sidebar-collapsed] ${COLUMN} ${part('root')}${part('collapsed')}::after{
  content:"";position:absolute;top:0;bottom:0;left:0;width:var(--smooth-rail-width);
  border-radius:0 var(--smooth-radius-lg) 0 0;
  background:var(--smooth-rail);box-shadow:none;pointer-events:none;
}
html[data-windows-titlebar] body[${ATTR}] [data-sidebar-collapsed] ${COLUMN} ${part('root')}${part('collapsed')} > ${part('panelList')}{
  display:flex;position:fixed;top:var(--smooth-rail-panels-top);bottom:calc(24px + var(--smooth-rail-button-size));left:0;
  box-sizing:border-box;width:var(--smooth-rail-width);
  flex-direction:column;align-items:center;gap:var(--smooth-rail-gap);
  margin:0;padding:0;overflow-x:hidden;overflow-y:auto;z-index:29;
  scrollbar-width:none;
}
html[data-windows-titlebar] body[${ATTR}] [data-sidebar-collapsed] ${COLUMN} ${part('root')}${part('collapsed')} > ${part('panelList')}::-webkit-scrollbar{width:0;height:0}
html[data-windows-titlebar] body[${ATTR}] [data-sidebar-collapsed] ${COLUMN} ${part('root')}${part('collapsed')} > ${part('panelList')} > :is(${part('moreAnchor')},*:has(${part('moreAnchor')})){order:1}
html[data-windows-titlebar] body[${ATTR}] [data-sidebar-collapsed] ${COLUMN} ${part('root')}${part('collapsed')} > ${part('footArea')}{
  display:flex;position:fixed;bottom:10px;left:0;box-sizing:border-box;width:var(--smooth-rail-width);
  flex-direction:column;align-items:center;gap:6px;margin:0;padding:0;z-index:29;
}
body[${ATTR}] ${COLUMN} ${part('footArea')} ${part('triggerLabel')}{
  position:absolute;width:1px;height:1px;padding:0;margin:-1px;
  clip-path:inset(50%);overflow:hidden;white-space:nowrap;border:0;
}
/* The desktop update pill becomes one more square rail button above the account. */
body[${ATTR}] ${COLUMN} ${part('footArea')} ${part('indicator')}[aria-disabled]{
  position:absolute;left:50%;bottom:calc(100% + 8px);transform:translateX(-50%);
  box-sizing:border-box;width:var(--smooth-rail-button-size);min-width:var(--smooth-rail-button-size);
  height:var(--smooth-rail-button-size);padding:0;justify-content:center;
  grid-template-columns:auto;column-gap:0;border:0;background:transparent;
  color:var(--dsw-alias-brand-primary);border-radius:var(--smooth-radius-md);
}
body[${ATTR}] ${COLUMN} ${part('footArea')} ${part('indicator')}[aria-disabled]:hover:not([aria-disabled="true"]){
  background:var(--smooth-surface-3);
}
body[${ATTR}] ${COLUMN} ${part('footArea')} ${part('indicator')}[aria-disabled] > span:last-child{
  position:absolute;width:1px;height:1px;clip-path:inset(50%);overflow:hidden;white-space:nowrap;
}
body[${ATTR}] ${COLUMN} ${part('footArea')} ${part('indicator')}[aria-disabled] ${part('icon')}{
  width:var(--smooth-rail-icon-size);height:var(--smooth-rail-icon-size);
}
body[${ATTR}] ${COLUMN} ${part('footArea')} ${part('indicator')}[aria-disabled] ${part('icon')} > svg{
  width:var(--smooth-rail-icon-size);height:var(--smooth-rail-icon-size);
}
body[${ATTR}] ${COLUMN} ${part('footArea')} ${part('indicator')}[aria-disabled] ${part('errorDot')}{
  background:var(--dsw-alias-state-error-primary);
}
body[${ATTR}] ${COLUMN} ${part('footArea')} button[data-signed-out]{
  box-sizing:border-box;display:flex;align-items:center;align-self:center;flex:none;
  width:var(--smooth-rail-button-size);min-width:var(--smooth-rail-button-size);height:var(--smooth-rail-button-size);
  margin:0 auto;padding:0;gap:0;justify-content:center;border:0;border-radius:var(--smooth-radius-md);
}
body[${ATTR}] ${COLUMN} ${part('footArea')} button[data-signed-out] > ${part('label')}{
  position:absolute;width:1px;height:1px;clip-path:inset(50%);overflow:hidden;white-space:nowrap;
}
/* The account avatar is round and rail-sized inside whichever foot control holds it. */
body[${ATTR}] ${COLUMN} ${part('footArea')} :is(${part('trigger')},button[data-signed-out]) ${part('avatar')}{
  display:flex;align-items:center;justify-content:center;
  width:var(--smooth-rail-icon-size);height:var(--smooth-rail-icon-size);border-radius:50%;overflow:hidden;flex:none;
}
body[${ATTR}] ${COLUMN} ${part('footArea')} :is(${part('trigger')},button[data-signed-out]) img{
  width:100%;height:100%;object-fit:cover;
}

/* The workspace list: tighter rows, smaller Session titles, one shared time colour. */
body[${ATTR}] ${COLUMN} [role="treeitem"]{border-radius:var(--smooth-radius-sm)}
body[${ATTR}] ${COLUMN} ${part('sessionRow')}{height:28px;border-radius:var(--smooth-radius-sm)}
body[${ATTR}] ${COLUMN} ${part('sessionRow')} ${part('title')}{
  font-size:12.5px;line-height:18px;color:var(--smooth-muted);
}
body[${ATTR}] ${COLUMN} ${part('sessionRow')}[aria-selected="true"] ${part('title')}{
  color:var(--smooth-text);font-weight:600;
}
body[${ATTR}] ${COLUMN} ${part('sessionRow')} ${part('time')}{font-size:11px;line-height:16px;color:var(--smooth-muted)}
body[${ATTR}] ${COLUMN} ${part('sessionRow')} > ${part('slot')}{position:relative}
body[${ATTR}] ${COLUMN} ${part('sessionRow')} > ${part('slot')} svg{
  width:8.84px;height:8.84px;color:color-mix(in srgb,var(--smooth-muted) 72%,transparent);
}
body[${ATTR}] ${COLUMN} ${part('sessionRow')} > ${part('slot')} svg *{stroke-width:2.71}
body[${ATTR}] ${COLUMN} ${part('sessionRow')} > ${part('slot')} svg g > circle:first-child{opacity:.4}

body[${ATTR}] ${COLUMN} ${part('projectRow')}{height:29px;border-radius:var(--smooth-radius-sm)}
body[${ATTR}] ${COLUMN} ${part('projectRow')} :is(${part('folder')},${part('chevron')}){display:none}
body[${ATTR}] ${COLUMN} ${part('projectRow')} ${part('title')}{font-size:13.5px;line-height:19px;font-weight:500}
body[${ATTR}] ${COLUMN} ${part('sectionLabel')}{font-size:12px;line-height:18px}
body[${ATTR}] ${COLUMN} [role="treeitem"][aria-selected="true"]{
  background:var(--smooth-selected);border-color:transparent;box-shadow:none;
}
body[${ATTR}] ${COLUMN} [role="treeitem"]:not([aria-selected="true"]):hover{background:var(--smooth-surface-2)}

body[${ATTR}] ${COLUMN} [role="tree"]{font-size:calc(19 * var(--smooth-l))}
body[${ATTR}] ${COLUMN} ${ROOT} > ${part('regionArea')}{
  border-top:1px solid var(--smooth-line);padding-top:10px;margin-inline:0;padding-inline:0;
}

/* Hover hint for the rail icons. The shipped panel rows carry their label in
   aria-label, but their own tooltip only runs while the column is collapsed, so
   the expanded rail gets this one, painted beside the icon. */
body[${ATTR}] .smooth-rail-tip{
  position:fixed;z-index:1300;pointer-events:none;
  max-width:240px;padding:4px 8px;border-radius:var(--smooth-radius-sm);
  background:color-mix(in srgb,var(--smooth-text) 90%,transparent);
  color:var(--smooth-sidebar);
  font-size:12px;line-height:18px;white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis;
  opacity:0;transform:translateY(-50%);
  transition:opacity .12s ease;
}
body[${ATTR}] .smooth-rail-tip[data-open="true"]{opacity:1}
@media(prefers-reduced-motion:reduce){body[${ATTR}] .smooth-rail-tip{transition:none}}

/* The workspace archive switch: hovering the column layers a two-segment filter
   over the region title, so running Sessions and the archive flip without opening
   the host's view-options menu. The control is frame-fixed and is given the
   measured header coordinates by the component; it stays hidden until placed. */
body[${ATTR}] .smooth-workspace-filter{
  position:fixed;left:0;top:0;z-index:40;display:inline-flex;align-items:center;box-sizing:border-box;
  height:24px;padding:2px;border:0;border-radius:var(--smooth-radius-sm);
  background:color-mix(in srgb,var(--smooth-text) 6%,var(--smooth-sidebar));
  opacity:0;pointer-events:none;user-select:none;-webkit-app-region:no-drag;
  transition:opacity .16s cubic-bezier(.2,0,0,1);
}
/* Hovering the column reveals it; hovering the control itself keeps it open, and
   Tab reveals it through :focus-visible. A click keeps :focus but not
   :focus-visible, so the pointer keeps driving the reveal afterwards. */
body[${ATTR}]:where(:has(${COLUMN}:hover, [data-slot="sidebar"]:hover, .smooth-workspace-filter:hover)) .smooth-workspace-filter[data-placed="true"],
body[${ATTR}] .smooth-workspace-filter[data-placed="true"]:has(:focus-visible){opacity:1;pointer-events:auto}
body[${ATTR}] .smooth-filter-option{
  appearance:none;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;
  height:20px;min-width:0;margin:0;padding:0 9px;border:0;
  border-radius:calc(var(--smooth-radius-sm) - 2px);background:transparent;
  color:color-mix(in srgb,var(--smooth-muted) 62%,var(--smooth-sidebar));
  font-family:inherit;font-size:12px;font-weight:500;line-height:20px;letter-spacing:.01em;
  white-space:nowrap;cursor:pointer;
  transition:background-color .14s ease,color .14s ease;
}
body[${ATTR}] .smooth-filter-option:hover{color:var(--smooth-text)}
body[${ATTR}] .smooth-filter-option[data-selected="true"]{
  background:color-mix(in srgb,var(--smooth-text) 18%,var(--smooth-sidebar));color:var(--smooth-text);
}
body[${ATTR}] .smooth-filter-option:active{transform:translateY(1px)}
body[${ATTR}] .smooth-filter-option:focus-visible{
  outline:2px solid var(--smooth-accent);outline-offset:1px;
}
/* The collapsed rail has no title row, and an expanded search owns the same strip. */
body[${ATTR}]:has([data-sidebar-collapsed]) .smooth-workspace-filter,
body[${ATTR}]:has(${part('sectionLabelHidden')}) .smooth-workspace-filter{opacity:0;pointer-events:none}
@media(prefers-reduced-motion:reduce){
  body[${ATTR}] .smooth-workspace-filter,body[${ATTR}] .smooth-filter-option{transition:none}
}

/* The composer tool row, ported from dsh-smooth-skin: a 36px row with 8px gaps,
   the add control as a 32px circle, mode controls at 28px, and the model seat at
   32px. The dock row those readings used to live in is hidden below. */
body[${ATTR}] [data-composer-dock]{display:none}
body[${ATTR}] [data-composer-card] ${part('row')}{
  box-sizing:border-box;flex:none;justify-content:flex-start;min-height:36px;
  padding:6px 12px 0 4px;gap:8px;border:0;border-radius:0;background:transparent;
  font-size:13px;line-height:20px;
}
body[${ATTR}] [data-composer-card] :is(${part('tools')},${part('modes')},${part('trailing')},${part('standardControls')}){
  gap:8px;
}
body[${ATTR}] [data-composer-card] ${part('add')}{
  box-sizing:border-box;flex:none;width:32px;height:32px;padding:0;border-radius:50%;
  background:transparent;color:var(--smooth-muted);transform:none;
}
body[${ATTR}] [data-composer-card] ${part('add')}:hover:not(:disabled){
  background:var(--smooth-surface-3);color:var(--smooth-text);
}
body[${ATTR}] [data-composer-card] ${part('modes')} :is(button,[role="button"]){
  height:28px;min-height:28px;padding:0 6px;border:0;border-radius:var(--smooth-radius-sm);
  background:transparent;color:var(--smooth-text);font-size:13px;line-height:18px;gap:5px;cursor:pointer;
}
body[${ATTR}] [data-composer-card] ${part('modes')} :is(button,[role="button"]):hover:not(:disabled){
  background:var(--smooth-surface-3);color:var(--smooth-text);
}
body[${ATTR}] [data-composer-card] ${part('modes')} svg{width:14px;height:14px}
body[${ATTR}] [data-slot="conversation.input.model"] button{
  height:32px;min-height:32px;font-size:13px;line-height:20px;padding-block:0;
}

/* The context ring that replaces the dock meter: the reading sits in the ring. */
body[${ATTR}] .smooth-context-button{
  display:grid;place-items:center;flex:none;width:22px;height:22px;margin:0;padding:0;
  border:0;border-radius:50%;background:transparent;color:var(--smooth-muted);cursor:pointer;
  transition:background-color .16s ease;
}
body[${ATTR}] .smooth-context-button:hover,
body[${ATTR}] .smooth-context-button:focus-visible,
body[${ATTR}] .smooth-context-button[aria-expanded="true"]{background:var(--smooth-surface-3)}
body[${ATTR}] .smooth-context-button:focus-visible{outline:2px solid var(--smooth-accent);outline-offset:2px}
body[${ATTR}] .smooth-context-button svg{display:block;overflow:visible}
body[${ATTR}] .smooth-context-ring-track{fill:none;stroke:color-mix(in srgb,var(--smooth-muted) 42%,transparent);stroke-width:2.1}
body[${ATTR}] .smooth-context-ring-fill{
  fill:none;stroke:var(--smooth-accent);stroke-width:2.1;
  transition:stroke-dasharray .3s cubic-bezier(.22,1,.36,1);
}
body[${ATTR}] .smooth-context-ring-label{
  fill:var(--smooth-text);font-family:inherit;font-size:7.2px;font-weight:700;
  letter-spacing:-.02em;font-variant-numeric:tabular-nums;
}

/* The panel the ring opens, above the composer. */
body[${ATTR}] .smooth-context-menu{
  position:fixed;z-index:1200;box-sizing:border-box;padding:12px;
  border:1px solid var(--smooth-line-strong);border-radius:var(--smooth-radius-lg);
  background:var(--dsw-alias-bg-overlay,var(--smooth-surface));
  box-shadow:var(--smooth-shadow-2);
  color:var(--smooth-muted);font-size:12px;line-height:20px;
  animation:smooth-context-in .16s cubic-bezier(.2,0,0,1);
}
@keyframes smooth-context-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
body[${ATTR}] .smooth-context-head{display:flex;align-items:baseline;gap:6px;min-width:0}
body[${ATTR}] .smooth-context-heading{color:var(--smooth-muted);white-space:nowrap}
body[${ATTR}] .smooth-context-head-value{color:var(--smooth-text);font-weight:600}
body[${ATTR}] .smooth-context-figures{
  margin-left:auto;color:var(--smooth-text);font-weight:500;white-space:nowrap;font-variant-numeric:tabular-nums;
}
body[${ATTR}] .smooth-context-bar{
  display:flex;gap:1px;height:4px;margin:10px 0;border-radius:999px;overflow:hidden;
  background:color-mix(in srgb,var(--smooth-text) 8%,transparent);
}
body[${ATTR}] .smooth-context-segment{flex:none;min-width:2px;height:100%;border-radius:1px}
body[${ATTR}] .smooth-context-segment.is-system{background:var(--smooth-muted)}
body[${ATTR}] .smooth-context-segment.is-tools{background:#a78bfa}
body[${ATTR}] .smooth-context-segment.is-messages{background:var(--smooth-accent)}
body[${ATTR}] .smooth-context-legend{display:flex;flex-direction:column;gap:2px;margin:0;padding:0}
body[${ATTR}] .smooth-context-legend-row{
  display:flex;align-items:center;justify-content:space-between;gap:12px;padding:2px 0;
}
body[${ATTR}] .smooth-context-legend-row dt{display:flex;align-items:center;gap:6px;margin:0;color:var(--smooth-muted)}
body[${ATTR}] .smooth-context-legend-row dd{margin:0;color:var(--smooth-text);font-variant-numeric:tabular-nums}
body[${ATTR}] .smooth-context-swatch{flex:none;width:8px;height:8px;border-radius:2px}
body[${ATTR}] .smooth-context-swatch.is-system{background:var(--smooth-muted)}
body[${ATTR}] .smooth-context-swatch.is-tools{background:#a78bfa}
body[${ATTR}] .smooth-context-swatch.is-messages{background:var(--smooth-accent)}
body[${ATTR}] .smooth-context-rule{height:1px;margin:10px 0;border:0;background:var(--smooth-line)}
body[${ATTR}] .smooth-context-section{margin:0 0 6px;font-size:12px;font-weight:500;line-height:20px;color:var(--smooth-muted)}
body[${ATTR}] .smooth-context-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 12px}
body[${ATTR}] .smooth-context-metric{display:flex;flex-direction:column;gap:1px;min-width:0}
body[${ATTR}] .smooth-context-metric-label{
  color:var(--smooth-muted);font-size:11.5px;line-height:16px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
body[${ATTR}] .smooth-context-metric-value{
  color:var(--smooth-text);font-size:13px;font-weight:600;line-height:20px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums;
}
/* ---- The model panel, ported from dsh-smooth-skin ---- */
body[${ATTR}] .smooth-model-effort{display:flex;flex-direction:column;align-items:stretch;gap:0;width:100%;min-width:0;max-width:100%}
body[${ATTR}] .smooth-model-level{display:flex;align-items:center;justify-content:center;gap:6px;min-height:18px;margin-bottom:1px;color:var(--smooth-muted);font-size:10.5px;line-height:16px;letter-spacing:.05em}
body[${ATTR}] .smooth-model-level::before{content:"";flex:none;width:4px;height:4px;border-radius:50%;background:var(--smooth-model-blue)}
body[${ATTR}] .smooth-model-effort:has(.smooth-model-slider[data-default="true"]) .smooth-model-level::before{background:var(--smooth-muted)}
body[${ATTR}] .smooth-model-auto{order:-1;box-sizing:border-box;display:inline-flex;align-items:center;flex:none;height:15px;min-height:15px;padding:0 6px;border:1px solid var(--smooth-line-strong);border-radius:999px;background:transparent;color:var(--smooth-muted);font-family:inherit;font-size:9.5px;line-height:13px;letter-spacing:.04em;cursor:pointer;transition:background-color .16s ease,border-color .16s ease,color .16s ease}
body[${ATTR}] .smooth-model-auto:hover:not(:disabled){background:var(--smooth-surface-3);color:var(--smooth-text)}
body[${ATTR}] .smooth-model-auto[data-active="true"]{border-color:transparent;background:color-mix(in srgb,var(--smooth-model-blue) 20%,transparent);color:var(--smooth-text)}
body[${ATTR}] .smooth-model-auto:focus-visible{outline:2px solid var(--smooth-model-blue);outline-offset:2px}
body[${ATTR}] .smooth-model-auto:disabled{opacity:.5;cursor:default}
body[${ATTR}] .smooth-model-level-name{color:var(--smooth-text);font-size:11px;font-weight:600;animation:smooth-model-level-in .26s cubic-bezier(.22,1,.36,1)}
@keyframes smooth-model-level-in{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}
body[${ATTR}] .smooth-model-effort .smooth-model-trigger{display:flex;align-items:center;justify-content:center;gap:5px;height:22px;min-height:22px;padding:0 4px;border:0;border-radius:var(--smooth-radius-sm);background:transparent;color:var(--smooth-muted);font-size:12px;line-height:18px;cursor:pointer}
body[${ATTR}] .smooth-model-effort .smooth-model-trigger:hover:not(:disabled){background:var(--smooth-surface-3);color:var(--smooth-text)}
body[${ATTR}] .smooth-model-trigger:disabled{opacity:.55;cursor:default}
body[${ATTR}] .smooth-model-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--smooth-text);font-weight:500}
body[${ATTR}] .smooth-model-trigger svg{flex:none;color:var(--smooth-muted)}
@property --smooth-model-ratio{syntax:"<number>";inherits:true;initial-value:0}
body[${ATTR}] .smooth-model-slider{--smooth-model-ratio:0;position:relative;isolation:isolate;padding:0;transition:--smooth-model-ratio .3s cubic-bezier(.22,1,.36,1)}
body[${ATTR}] .smooth-model-slider.is-dragging{transition:none}
body[${ATTR}] .smooth-model-track{position:absolute;left:0;right:0;top:0;box-sizing:border-box;height:26px;border:1px solid var(--smooth-line-strong);border-radius:999px;background:var(--smooth-model-track);overflow:hidden;pointer-events:none}
body[${ATTR}] .smooth-model-fill{position:absolute;z-index:1;left:0;top:0;bottom:0;width:calc(13px + (100% - 26px) * var(--smooth-model-ratio));border-radius:999px;background:var(--smooth-model-blue)}
body[${ATTR}] .smooth-model-dot{position:absolute;z-index:2;top:50%;width:4px;height:4px;border-radius:50%;background:var(--smooth-model-thumb);transform:translate(-50%,-50%)}
body[${ATTR}] .smooth-model-glow{position:absolute;z-index:1;left:0;top:0;bottom:0;width:calc(13px + (100% - 26px) * var(--smooth-model-ratio));overflow:hidden;border-radius:999px;pointer-events:none}
body[${ATTR}] .smooth-model-glow-blob{position:absolute;top:50%;translate:-50% -50%;border-radius:50%;background:radial-gradient(closest-side,#ffffff 0%,color-mix(in srgb,#ffffff 72%,transparent) 34%,color-mix(in srgb,#ffffff 30%,transparent) 64%,transparent 86%);opacity:calc(var(--glow-opacity,.35) * .9);mix-blend-mode:screen;animation:smooth-model-glow var(--glow-duration,6s) ease-in-out infinite alternate;animation-delay:var(--glow-delay,0s)}
@keyframes smooth-model-glow{0%{transform:translate(0,0) scale(.9);opacity:calc(var(--glow-opacity,.35) * .5)}50%{transform:translate(calc(var(--glow-dx,120px) * .55),calc(var(--glow-dy,0) * .55)) scale(1.05);opacity:calc(var(--glow-opacity,.35) * 1)}100%{transform:translate(var(--glow-dx,120px),var(--glow-dy,0)) scale(1.15);opacity:calc(var(--glow-opacity,.35) * .65)}}
body[${ATTR}] .smooth-model-sparks{position:absolute;z-index:2;inset:0;overflow:hidden;border-radius:999px;pointer-events:none}
body[${ATTR}] .smooth-model-spark{position:absolute;width:var(--spark-size,3px);height:var(--spark-size,3px);border-radius:50%;background:#f2f7ff;box-shadow:0 0 8px color-mix(in srgb,#f2f7ff 85%,transparent),0 0 2px #fff;opacity:0;animation:smooth-model-spark var(--spark-duration,1.4s) linear infinite;animation-delay:var(--spark-delay,0s)}
@keyframes smooth-model-spark{0%{opacity:0;transform:translate(0,0) scale(.45)}14%{opacity:var(--spark-opacity,.8)}78%{opacity:calc(var(--spark-opacity,.8) * .55)}100%{opacity:0;transform:translate(var(--spark-dx,-120px),var(--spark-dy,0)) scale(.3)}}
body[${ATTR}] .smooth-model-slider input[type="range"]{position:relative;z-index:2;appearance:none;-webkit-appearance:none;display:block;box-sizing:border-box;width:100%;height:26px;margin:0;padding:0;background:transparent;cursor:pointer}
body[${ATTR}] .smooth-model-slider input[type="range"]::-webkit-slider-runnable-track{height:26px;border:0;background:transparent}
body[${ATTR}] .smooth-model-slider input[type="range"]::-webkit-slider-thumb{appearance:none;-webkit-appearance:none;width:28px;height:28px;margin-top:-1px;border:0;border-radius:50%;background:transparent;box-shadow:none;opacity:0}
body[${ATTR}] .smooth-model-glider{position:absolute;z-index:3;top:-1px;left:calc(14px + (100% - 28px) * var(--smooth-model-ratio));box-sizing:border-box;width:28px;height:28px;border-radius:50%;border:1px solid color-mix(in srgb,var(--smooth-text) 28%,transparent);background:var(--smooth-model-thumb);box-shadow:0 3px 10px rgba(0,0,0,.3);transform:translateX(-50%);pointer-events:none;transition:transform .32s cubic-bezier(.16,1,.3,1),box-shadow .32s ease}
body[${ATTR}] .smooth-model-slider input[type="range"]:active + .smooth-model-glider{transform:translateX(-50%) scale(1.06);box-shadow:0 5px 16px rgba(0,0,0,.36)}
body[${ATTR}] .smooth-model-slider:has(input[type="range"]:focus-visible) .smooth-model-track{box-shadow:0 0 0 2px color-mix(in srgb,var(--smooth-accent) 65%,transparent)}
body[${ATTR}] .smooth-model-slider input[type="range"]:disabled{opacity:.55;cursor:default}
body[${ATTR}] .smooth-model-slider input[type="range"]:disabled + .smooth-model-glider{opacity:.55}
body[${ATTR}] .smooth-model-slider[data-default="true"] .smooth-model-fill{background:var(--smooth-muted)}
body[${ATTR}] .smooth-model-slider[data-default="true"] .smooth-model-track{background:color-mix(in srgb,var(--smooth-model-track) 70%,var(--smooth-muted))}
body[${ATTR}] .smooth-model-error{margin-top:6px;padding:6px 8px;border-radius:var(--smooth-radius-sm);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,var(--smooth-surface-2));color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 82%,var(--smooth-text));font-size:12px;line-height:17px;white-space:pre-wrap}
body[${ATTR}] .smooth-model-group{display:flex;flex-direction:column;gap:1px}
body[${ATTR}] .smooth-model-media{position:relative;flex:none;height:168px;overflow:hidden;border-radius:calc(var(--smooth-radius-lg) - 1px) calc(var(--smooth-radius-lg) - 1px) 0 0;background:radial-gradient(130% 150% at 50% 6px,color-mix(in srgb,var(--smooth-model-blue) 14%,transparent),transparent 72%)}
body[${ATTR}] .smooth-model-media::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent calc(68% + 6px),var(--smooth-model-fade) 100%);pointer-events:none}
body[${ATTR}] .smooth-model-art{position:absolute;left:0;top:6px;width:100%;height:100%;object-fit:cover;object-position:50% 38%;opacity:0;transition:opacity .28s ease;pointer-events:none;user-select:none}
body[${ATTR}] .smooth-model-art[data-active="true"]{opacity:1}
body[${ATTR}] .smooth-model-body{display:flex;flex-direction:column;align-items:stretch;gap:2px;min-width:0;padding:10px 12px 12px}
body[${ATTR}] .smooth-model-panel .smooth-model-trigger{height:24px;min-height:24px;font-size:13px}
body[${ATTR}] .smooth-model-panel .smooth-model-slider{margin-top:4px}
body[${ATTR}] .smooth-git-menu{position:fixed;z-index:1200;box-sizing:border-box;display:flex;flex-direction:column;gap:4px;max-height:min(420px,calc(100vh - 24px));padding:8px;border:1px solid var(--smooth-line);border-radius:var(--smooth-radius-lg);background:color-mix(in srgb,var(--smooth-surface-3) 80%,var(--dsw-specific-input-major));box-shadow:0 18px 48px rgba(0,0,0,.38);color:var(--smooth-text);font-size:13px;line-height:20px;overflow:auto}
body[${ATTR}] .smooth-git-heading{padding:4px 8px 2px;color:var(--smooth-muted);font-size:12px}
body[${ATTR}] .smooth-git-search{box-sizing:border-box;width:100%;height:32px;margin:2px 0 4px;padding:0 10px;border:1px solid var(--smooth-line);border-radius:var(--smooth-radius-md);background:var(--dsw-specific-input-major);color:var(--smooth-text);font:inherit;outline:none}
body[${ATTR}] .smooth-git-search:focus{border-color:var(--smooth-accent)}
body[${ATTR}] .smooth-git-list{display:flex;flex-direction:column;gap:1px;min-height:0;overflow:auto}
body[${ATTR}] .smooth-git-row{display:flex;align-items:center;gap:9px;width:100%;min-height:34px;padding:5px 8px;border:0;border-radius:var(--smooth-radius-sm);background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
body[${ATTR}] .smooth-git-row:hover:not(:disabled){background:var(--smooth-surface-3)}
body[${ATTR}] .smooth-git-row[data-current="true"]{background:var(--smooth-selected)}
body[${ATTR}] .smooth-git-row:disabled{opacity:.5;cursor:default}
body[${ATTR}] .smooth-git-row-main{display:flex;flex-direction:column;min-width:0;flex:1}
body[${ATTR}] .smooth-git-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
body[${ATTR}] .smooth-git-note{padding:0 8px;color:var(--smooth-muted);font-size:11.5px;line-height:17px}
body[${ATTR}] .smooth-git-check{margin-left:auto;flex:none;width:14px;height:14px;color:var(--smooth-text)}
body[${ATTR}] .smooth-git-error{padding:6px 8px;border-radius:var(--smooth-radius-sm);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,var(--smooth-surface-2));color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 82%,var(--smooth-text));font-size:12px;line-height:17px;white-space:pre-wrap}
body[${ATTR}] .smooth-git-menu.smooth-model-panel{padding:0;gap:0;overflow:hidden;max-height:none;--smooth-model-fade:color-mix(in srgb,var(--smooth-surface-3) 80%,var(--dsw-specific-input-major))}
body[${ATTR}] .smooth-model-panel{transform-origin:bottom center}
body[${ATTR}] .smooth-model-panel[data-state="open"]{animation:smooth-model-panel-in .16s cubic-bezier(.2,.8,.3,1)}
body[${ATTR}] .smooth-model-panel[data-state="closing"]{animation:smooth-model-panel-out .15s cubic-bezier(.4,0,1,1) forwards;pointer-events:none}
@keyframes smooth-model-panel-in{from{opacity:0;transform:translateY(6px) scale(.99)}to{opacity:1;transform:none}}
@keyframes smooth-model-panel-out{from{opacity:1;transform:none}to{opacity:0;transform:translateY(6px) scale(.99)}}
body[${ATTR}] .smooth-model-panel-viewport{position:relative;overflow:hidden;transition:height .26s cubic-bezier(.2,0,0,1)}
body[${ATTR}] .smooth-model-panel-pane{position:absolute;top:0;left:0;width:100%;min-width:0;display:flex;flex-direction:column;opacity:0;pointer-events:none;transform:translateX(14px);transition:opacity .2s ease,transform .26s cubic-bezier(.2,0,0,1)}
body[${ATTR}] .smooth-model-panel-pane[data-pane="effort"]{transform:translateX(-14px)}
body[${ATTR}] .smooth-model-panel-pane[data-active="true"]{opacity:1;pointer-events:auto;transform:none}
body[${ATTR}] .smooth-model-list{display:flex;flex-direction:column;gap:6px;min-width:0;padding:10px 12px 12px}
body[${ATTR}] .smooth-model-list-head{display:flex;align-items:center;gap:4px;min-height:22px}
body[${ATTR}] .smooth-model-back{display:grid;place-items:center;width:22px;height:22px;padding:0;border:0;border-radius:var(--smooth-radius-sm);background:transparent;color:var(--smooth-muted);cursor:pointer}
body[${ATTR}] .smooth-model-back:hover{background:var(--smooth-surface-3);color:var(--smooth-text)}
body[${ATTR}] .smooth-model-list-title{flex:1;min-width:0;font-size:12.5px;font-weight:600;color:var(--smooth-text)}
body[${ATTR}] .smooth-model-list .smooth-git-list{max-height:min(42vh,320px);overflow-y:auto;overscroll-behavior:contain;padding:0;border:0;border-radius:0;background:transparent;box-shadow:none}
body[${ATTR}] .smooth-model-list .smooth-git-heading{padding:4px 4px 2px}
@media(prefers-reduced-motion:reduce){
  body[${ATTR}] .smooth-context-menu{animation:none}
  body[${ATTR}] .smooth-context-button,body[${ATTR}] .smooth-context-ring-fill{transition:none}
  body[${ATTR}] .smooth-model-level-name,body[${ATTR}] .smooth-model-glow-blob,body[${ATTR}] .smooth-model-spark,body[${ATTR}] .smooth-model-art,body[${ATTR}] .smooth-model-slider,body[${ATTR}] .smooth-model-glider,body[${ATTR}] .smooth-model-panel,body[${ATTR}] .smooth-model-panel-viewport,body[${ATTR}] .smooth-model-panel-pane{animation:none;transition:none}
}
`;

/* --------------------------------------------------------------- lifecycle */

/** Insert the plugin stylesheet once; the returned disposer removes it. */
function ensureStyleTag() {
  if (typeof document === 'undefined') return () => {};
  if (document.getElementById(STYLE_TAG_ID) !== null) return () => {};
  const tag = document.createElement('style');
  tag.id = STYLE_TAG_ID;
  tag.setAttribute('data-plugin', PACKAGE_NAME);
  tag.textContent = CSS;
  document.head.appendChild(tag);
  return () => {
    tag.remove();
  };
}

/* ---------------------------------------------------------------------- apply */

const name = PACKAGE_NAME;

/* `slots` hosts the three seat registrations; `locale` carries every UI string. */
const inject = ['slots', 'locale'];

/** Namespace of this plugin's own UI strings. */
const NS = PACKAGE_NAME;

/** The segmented control's height: its centre is matched to the header's. */
const FILTER_HEIGHT = 24;

const dictionaries = {
  zh: {
    workspaceFilter: '工作区筛选',
    inProgress: '进行中',
    archived: '已归档',
    contextAria: '上下文已用',
    contextUsed: '上下文已用',
    contextSystem: '系统提示词',
    contextTools: '工具定义',
    contextMessages: '对话消息',
    contextStats: '会话统计',
    contextLlmTime: '模型用时',
    contextToolTime: '工具调用用时',
    contextTtft: '首 token 平均（TTFT）',
    contextTps: '输出速度（TPS）',
    contextTpsValue: '%s tok/s',
    contextTokensHeading: 'Token 用量',
    contextCacheHit: '缓存命中',
    contextUncached: '未缓存输入',
    contextCacheRead: '缓存读取',
    contextOutput: '输出',
    contextTok: '%s tok',
    contextSeconds: '%s秒',
    contextMinutes: '%s分%s秒',
    modelMenu: '模型',
    reasoningEffort: '思考强度',
    effortDefault: 'Default',
    effortAuto: '使用 Default 思考强度',
    modelLoading: '正在读取…',
    searchModel: '搜索模型',
    noModels: '没有模型',
    back: '返回',
    modelFailed: '模型切换失败',
  },
  en: {
    workspaceFilter: 'Workspace filter',
    inProgress: 'In progress',
    archived: 'Archived',
    contextAria: 'Context used',
    contextUsed: 'Context used',
    contextSystem: 'System prompt',
    contextTools: 'Tool definitions',
    contextMessages: 'Messages',
    contextStats: 'Session stats',
    contextLlmTime: 'Model time',
    contextToolTime: 'Tool time',
    contextTtft: 'First token (TTFT)',
    contextTps: 'Output speed (TPS)',
    contextTpsValue: '%s tok/s',
    contextTokensHeading: 'Token usage',
    contextCacheHit: 'Cache hit',
    contextUncached: 'Uncached input',
    contextCacheRead: 'Cache read',
    contextOutput: 'Output',
    contextTok: '%s tok',
    contextSeconds: '%s s',
    contextMinutes: '%s m %s s',
    modelMenu: 'Model',
    reasoningEffort: 'Reasoning effort',
    effortDefault: 'Default',
    effortAuto: 'Use the provider Default effort',
    modelLoading: 'Loading…',
    searchModel: 'Search models',
    noModels: 'No models',
    back: 'Back',
    modelFailed: 'Could not switch models',
  },
};

/**
 * The workspace browser's persisted view store, read from its slot entry.
 *
 * The entry publishes a store whose `archivedFilter` is `default` (running
 * Sessions), `show` (both), or `only` (archived); the quick switch and the host's
 * own view-options menu therefore stay one filter. Resolved defensively: a host
 * without that store simply gets no control.
 *
 * @param slots - the Client slot service.
 * @returns a store instance exposing `setArchivedFilter`, or undefined.
 */
function findFilterStore(slots) {
  try {
    if (typeof slots?.entries !== 'function') return undefined;
    for (const entry of slots.entries('sidebar.workspaces')) {
      const store = entry?.store?.create?.();
      if (typeof store?.actions?.setArchivedFilter === 'function') return store;
    }
  } catch {
    /* A replaced or half-mounted region is not an error: there is just no control. */
  }
  return undefined;
}

/**
 * Move the control over the browser's section header.
 *
 * The header sits in the sidebar's normal flow, so it is measured rather than
 * assumed: on mount, on a window resize, and once more after a relayout. The
 * control stays hidden until this succeeds, so an unmeasurable header cannot
 * leave it pinned to the viewport's corner.
 *
 * @param node - the control element, or null.
 * @returns whether the header was found and the control placed.
 */
function placeFilter(node) {
  if (!node || !node.style || typeof document === 'undefined') return false;
  try {
    const header = document.querySelector(`[data-slot="sidebar"] ${part('sectionHeader')}`)
      ?? document.querySelector(`${COLUMN} ${part('sectionHeader')}`);
    const rect = header?.getBoundingClientRect?.();
    if (!rect) return false;
    const label = header.querySelector?.(part('sectionLabel'));
    const labelRect = label?.getBoundingClientRect?.();
    node.style.left = `${Math.round(labelRect ? labelRect.left - 2 : rect.left + 2)}px`;
    node.style.top = `${Math.round(rect.top + (rect.height - FILTER_HEIGHT) / 2)}px`;
    node.setAttribute('data-placed', 'true');
    return true;
  } catch {
    return false;
  }
}

/**
 * Enable the rail layout, the workspace archive switch, the context ring, and the
 * model panel.
 *
 * Everything here is additive: a stylesheet, one body attribute, and three seat
 * registrations (`shell.overlay`, `conversation.input.right`,
 * `conversation.input.overlay`). Nothing is registered into `sidebar`, so this
 * cannot fail an entry activation of another plugin.
 *
 * @param ctx - the plugin context.
 */
function apply(ctx) {
  ctx.effect(() => {
    const removeStyle = ensureStyleTag();
    const root = document.body;
    const had = root.getAttribute(ATTR);
    root.setAttribute(ATTR, 'on');
    return () => {
      removeStyle();
      if (had === null) root.removeAttribute(ATTR);
      else root.setAttribute(ATTR, had);
    };
  }, 'ui-workshop: sidebar rail');

  /* ---- Hover hints for the rail icons ---- */

  /**
   * Paint one label beside whichever rail icon the pointer rests on.
   *
   * The shipped panel rows already carry their localized name in `aria-label`,
   * so nothing is re-derived here: this only reads that attribute and places a
   * tooltip. The rows' own tooltip is skipped because it is disabled while the
   * column is wide, which is exactly the rail this plugin draws.
   */
  ctx.effect(() => {
    if (typeof document === 'undefined') return () => {};
    const tip = document.createElement('div');
    tip.className = 'smooth-rail-tip';
    tip.setAttribute('role', 'tooltip');
    tip.setAttribute('aria-hidden', 'true');
    document.body.appendChild(tip);
    let timer = 0;
    let row = null;
    const hide = () => {
      if (timer) window.clearTimeout(timer);
      timer = 0;
      row = null;
      tip.removeAttribute('data-open');
    };
    const place = (target) => {
      const label = target.getAttribute('aria-label')
        || target.querySelector(part('panelTitle'))?.textContent
        || '';
      if (label.trim() === '') return;
      tip.textContent = label.trim();
      tip.setAttribute('data-open', 'true');
      const rect = target.getBoundingClientRect();
      const width = tip.offsetWidth;
      const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.right + 8));
      const top = Math.max(16, Math.min(window.innerHeight - 16, rect.top + rect.height / 2));
      tip.style.left = `${Math.round(left)}px`;
      tip.style.top = `${Math.round(top)}px`;
    };
    const rowOf = (node) => (node?.closest ? node.closest(part('panelRow')) : null);
    /* The collapsed rail already shows the host's own tooltip. */
    const expanded = (target) => target.closest(part('collapsed')) === null;
    const over = (event) => {
      const target = rowOf(event.target);
      if (target === null || target === row) return;
      if (!expanded(target)) return;
      if (timer) window.clearTimeout(timer);
      row = target;
      timer = window.setTimeout(() => {
        timer = 0;
        if (row === target) place(target);
      }, 350);
    };
    const out = (event) => {
      const target = rowOf(event.target);
      if (target === null) return;
      if (typeof Node !== 'undefined' && event.relatedTarget instanceof Node
        && target.contains(event.relatedTarget)) return;
      hide();
    };
    const focusIn = (event) => {
      const target = rowOf(event.target);
      if (target !== null && expanded(target)) place(target);
    };
    const keydown = (event) => {
      if (event.key === 'Escape') hide();
    };
    document.addEventListener('pointerover', over, true);
    document.addEventListener('pointerout', out, true);
    document.addEventListener('pointerdown', hide, true);
    document.addEventListener('focusin', focusIn, true);
    document.addEventListener('focusout', hide, true);
    document.addEventListener('keydown', keydown, true);
    window.addEventListener('scroll', hide, true);
    return () => {
      hide();
      document.removeEventListener('pointerover', over, true);
      document.removeEventListener('pointerout', out, true);
      document.removeEventListener('pointerdown', hide, true);
      document.removeEventListener('focusin', focusIn, true);
      document.removeEventListener('focusout', hide, true);
      document.removeEventListener('keydown', keydown, true);
      window.removeEventListener('scroll', hide, true);
      tip.remove();
    };
  }, 'ui-workshop: rail hints');

  try {
    ctx.effect(() => ctx.locale.register(NS, dictionaries), 'ui-workshop: dictionaries');
  } catch (error) {
    console.warn('[ui-workshop] dictionaries failed; the archive switch stays off', error);
    return;
  }
  const t = ctx.locale.bind(NS);

  /** The two-segment switch that the host's view-options menu also drives. */
  const WorkspaceFilter = () => {
    const node = useRef(null);
    const [store, setStore] = useState(() => findFilterStore(ctx.slots));

    /* The region may mount after this overlay; retry briefly, and on any slot change. */
    useEffect(() => {
      if (store !== undefined) return undefined;
      const retry = () => setStore(findFilterStore(ctx.slots));
      const timer = setTimeout(retry, 500);
      let off;
      try {
        off = ctx.slots.onMutate?.(retry);
      } catch {
        off = undefined;
      }
      return () => {
        clearTimeout(timer);
        if (typeof off === 'function') off();
      };
    }, [store]);

    const filter = useSyncExternalStore(
      typeof store?.subscribe === 'function' ? store.subscribe : noopSubscribe,
      () => (store === undefined ? 'default' : store.getSnapshot().archivedFilter || 'default'),
    );

    useEffect(() => {
      if (store === undefined) return undefined;
      let frame = 0;
      let tries = 0;
      const place = () => {
        if (placeFilter(node.current)) return;
        if (tries++ < 40) frame = window.requestAnimationFrame(place);
      };
      place();
      const relayout = () => {
        tries = 0;
        place();
      };
      window.addEventListener('resize', relayout);
      return () => {
        if (frame) window.cancelAnimationFrame(frame);
        window.removeEventListener('resize', relayout);
      };
    }, [store]);

    if (store === undefined) return null;
    const archived = filter === 'only';
    const pick = (only) => (event) => {
      /* A pointer click focuses the option; release it, the control is transient. */
      if (event?.detail > 0) event.currentTarget?.blur?.();
      const next = only ? 'only' : 'default';
      try {
        if ((store.getSnapshot().archivedFilter || 'default') === next) return;
        store.actions.setArchivedFilter(next);
      } catch (error) {
        console.warn('[ui-workshop] the archive filter could not be switched', error);
      }
    };
    return h('div', {
      ref: node,
      className: 'smooth-workspace-filter',
      role: 'group',
      'aria-label': t('workspaceFilter'),
    }, [
      h('button', {
        key: 'running',
        type: 'button',
        className: 'smooth-filter-option',
        'data-selected': archived ? 'false' : 'true',
        'aria-pressed': !archived,
        onClick: pick(false),
      }, t('inProgress')),
      h('button', {
        key: 'archived',
        type: 'button',
        className: 'smooth-filter-option',
        'data-selected': archived ? 'true' : 'false',
        'aria-pressed': archived,
        onClick: pick(true),
      }, t('archived')),
    ]);
  };

  try {
    ctx.slots.inject('shell.overlay', () => {
      try {
        return ctx.slots.register({
          name: 'shell.overlay',
          id: 'ui-workshop.workspace-filter',
          order: 10,
          inject: () => ({ t }),
        }, WorkspaceFilter);
      } catch (error) {
        console.warn('[ui-workshop] the workspace filter could not be registered', error);
        return undefined;
      }
    });
  } catch (error) {
    console.warn('[ui-workshop] the overlay seat could not be awaited', error);
  }

  /* ---- The composer's context ring, ported from dsh-smooth-skin ---- */

  /** `%s` substitution for the one counter the ring's label carries. */
  const fill = (template, ...values) => {
    let index = 0;
    return template.replace(/%s/g, () => String(values[index++] ?? ''));
  };

  /** Compact token count: 517 / 12.2K / 1.2M. */
  const compactTokens = (value) => {
    const total = Number(value) || 0;
    if (total < 1e3) return String(total);
    const scaled = (size) => {
      const number = total / size;
      return String(number >= 100 ? Math.round(number) : Math.round(number * 10) / 10);
    };
    return total < 1e6 ? `${scaled(1e3)}K` : `${scaled(1e6)}M`;
  };

  /** Host-style duration: 45.2秒 under a minute, 81分10秒 from there on. */
  const durationOf = (ms) => {
    const seconds = Math.max(0, Number(ms) || 0) / 1e3;
    if (seconds < 60) return fill(t('contextSeconds'), Math.round(seconds * 10) / 10);
    const whole = Math.round(seconds);
    return fill(t('contextMinutes'), Math.floor(whole / 60), whole % 60);
  };

  /** Exact count with three-digit groups: 4,055,212. */
  const exactTokens = (value) => {
    const digits = String(Math.max(0, Math.round(Number(value) || 0)));
    const groups = [];
    for (let end = digits.length; end > 0; end -= 3) {
      groups.unshift(digits.slice(Math.max(0, end - 3), end));
    }
    return groups.join(',');
  };

  /** An honest cache-hit share: a partial hit never displays as a flat 100%. */
  const cacheHitOf = (usage) => {
    const cacheRead = Number(usage?.cacheReadTokens) || 0;
    const prompt = cacheRead
      + (Number(usage?.uncachedInputTokens) || 0)
      + (Number(usage?.cacheWriteTokens) || 0);
    if (!prompt) return null;
    if (cacheRead >= prompt) return '100';
    const rounded = Math.round(cacheRead / prompt * 100);
    return rounded >= 100 ? (Math.round(cacheRead / prompt * 1000) / 10).toFixed(1) : String(rounded);
  };

  /**
   * The context meter, moved out of the host's dock row and into the composer row
   * just before the model seat. The ring shows the same bounded occupancy the dock
   * meter showed; its panel keeps the composition breakdown those stat pills owned.
   */
  const ContextRing = (props) => {
    const [open, setOpen] = useState(false);
    const triggerRef = useRef(null);
    const panelRef = useRef(null);
    const read = props.useProjection;
    const pressure = typeof read === 'function' ? read('contextPressure') : undefined;
    const breakdown = typeof read === 'function' ? read('contextBreakdown') : undefined;
    const stats = typeof read === 'function' ? read('sessionStats') : undefined;
    const usage = typeof read === 'function' ? read('tokenUsage') : undefined;

    useEffect(() => {
      if (!open) return undefined;
      const dismiss = (event) => {
        if (panelRef.current?.contains?.(event.target)) return;
        if (triggerRef.current?.contains?.(event.target)) return;
        setOpen(false);
      };
      const escape = (event) => {
        if (event.key === 'Escape') setOpen(false);
      };
      document.addEventListener('pointerdown', dismiss, true);
      document.addEventListener('keydown', escape);
      return () => {
        document.removeEventListener('pointerdown', dismiss, true);
        document.removeEventListener('keydown', escape);
      };
    }, [open]);

    /**
     * Re-render the panel while it is open, so the render-time anchor below runs
     * again with a fresh trigger rectangle.
     *
     * The anchor expression itself is dsh-smooth-skin's and is copied verbatim; the
     * only addition is this subscription, because that skin reads the rectangle once
     * per render and therefore needs a render to happen after a resize.
     */
    const [, bump] = useState(0);
    useEffect(() => {
      if (!open) return undefined;
      let frame = 0;
      const schedule = () => {
        if (frame !== 0) return;
        frame = window.requestAnimationFrame(() => {
          frame = 0;
          bump((value) => value + 1);
        });
      };
      window.addEventListener('resize', schedule);
      const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : undefined;
      const trigger = triggerRef.current;
      const card = trigger?.closest?.('[data-composer-card]') ?? null;
      if (observer !== undefined && trigger !== null) observer.observe(trigger);
      /* The card resizes when the sidebar is dragged or the composer grows. */
      if (observer !== undefined && card !== null) observer.observe(card);
      if (observer !== undefined && document.body !== null) observer.observe(document.body);
      return () => {
        window.removeEventListener('resize', schedule);
        observer?.disconnect?.();
        if (frame !== 0) window.cancelAnimationFrame(frame);
      };
    }, [open]);

    const used = pressure?.projectedTokens ?? pressure?.pressureTokens;
    const windowSize = pressure?.contextWindow;
    const context = used === undefined || windowSize === undefined || windowSize <= 0
      ? null
      : { percent: Math.min(100, Math.round(used / windowSize * 100)), used, windowSize };
    if (context === null) return null;

    const reading = `${context.percent}%`;
    const size = 22;
    const radius = 9.1;
    const circumference = 2 * Math.PI * radius;
    const label = fill(t('contextAria'), reading);

    let panel = null;
    if (open) {
      /* Anchor the panel above the trigger, exactly as dsh-smooth-skin does it. */
      const rect = triggerRef.current?.getBoundingClientRect?.();
      const width = Math.min(268, window.innerWidth - 16);
      const left = rect ? Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)) : 8;
      const bottom = rect ? Math.max(8, window.innerHeight - rect.top + 8) : 8;
      const rows = [
        { key: 'system', tint: 'is-system', label: t('contextSystem'), tokens: breakdown?.systemTokens ?? 0 },
        { key: 'tools', tint: 'is-tools', label: t('contextTools'), tokens: breakdown?.toolsTokens ?? 0 },
        { key: 'messages', tint: 'is-messages', label: t('contextMessages'), tokens: breakdown?.messageTokens ?? 0 },
      ];
      const total = rows.reduce((sum, row) => sum + row.tokens, 0);
      const segments = breakdown && total > 0
        ? rows.map((row) => ({ ...row, width: context.percent * row.tokens / total }))
          .filter((segment) => segment.width > 0)
        : [{ key: 'total', tint: 'is-messages', width: context.percent }];
      const statRows = [
        { key: 'llm', label: t('contextLlmTime'), value: stats && stats.llmMs > 0 ? durationOf(stats.llmMs) : null },
        { key: 'tool', label: t('contextToolTime'), value: stats && stats.toolMs > 0 ? durationOf(stats.toolMs) : null },
        { key: 'ttft', label: t('contextTtft'), value: stats && stats.ttftSteps > 0 ? durationOf(stats.ttftMs / stats.ttftSteps) : null },
        {
          key: 'tps',
          label: t('contextTps'),
          value: stats && stats.decodeMs > 0
            ? fill(t('contextTpsValue'), Math.round(stats.decodeTokens / (stats.decodeMs / 1e3)))
            : null,
        },
      ].filter((row) => row.value !== null);
      const cacheHit = usage === undefined ? null : cacheHitOf(usage);
      const tokenRows = usage === undefined ? [] : [
        { key: 'cacheHit', label: t('contextCacheHit'), value: cacheHit === null ? null : `${cacheHit}%` },
        { key: 'uncached', label: t('contextUncached'), value: fill(t('contextTok'), exactTokens(usage.uncachedInputTokens)) },
        { key: 'cacheRead', label: t('contextCacheRead'), value: fill(t('contextTok'), exactTokens(usage.cacheReadTokens)) },
        { key: 'output', label: t('contextOutput'), value: fill(t('contextTok'), exactTokens(usage.outputTokens)) },
      ].filter((row) => row.value !== null);
      const metric = (row) => h('div', { key: row.key, className: 'smooth-context-metric' }, [
        h('span', { key: 'label', className: 'smooth-context-metric-label' }, row.label),
        h('span', { key: 'value', className: 'smooth-context-metric-value' }, row.value),
      ]);
      panel = createPortal(h('div', {
        ref: panelRef,
        className: 'smooth-context-menu',
        role: 'dialog',
        'aria-label': t('contextUsed'),
        style: { left: `${left}px`, bottom: `${bottom}px`, width: `${width}px` },
      }, [
        h('div', { key: 'head', className: 'smooth-context-head' }, [
          h('span', { key: 'heading', className: 'smooth-context-heading' }, t('contextUsed')),
          h('span', { key: 'value', className: 'smooth-context-head-value' }, reading),
          h('span', { key: 'figures', className: 'smooth-context-figures' },
            `~${compactTokens(context.used)} / ${compactTokens(context.windowSize)}`),
        ]),
        h('div', { key: 'bar', className: 'smooth-context-bar', 'aria-hidden': 'true' },
          segments.map((segment) => h('span', {
            key: segment.key,
            className: `smooth-context-segment ${segment.tint}`,
            style: { width: `${segment.width}%` },
          }))),
        breakdown === undefined ? null : h('dl', { key: 'legend', className: 'smooth-context-legend' },
          rows.map((row) => h('div', { key: row.key, className: 'smooth-context-legend-row' }, [
            h('dt', { key: 'label' },
              h('i', { key: 'swatch', className: `smooth-context-swatch ${row.tint}`, 'aria-hidden': 'true' }),
              row.label),
            h('dd', { key: 'value' }, `~${compactTokens(row.tokens)}`),
          ]))),
        ...(statRows.length > 0 ? [
          h('hr', { key: 'stats-rule', className: 'smooth-context-rule' }),
          h('h4', { key: 'stats-heading', className: 'smooth-context-section' }, t('contextStats')),
          h('div', { key: 'stats-grid', className: 'smooth-context-grid' }, statRows.map(metric)),
        ] : []),
        ...(tokenRows.length > 0 ? [
          h('hr', { key: 'tokens-rule', className: 'smooth-context-rule' }),
          h('h4', { key: 'tokens-heading', className: 'smooth-context-section' }, t('contextTokensHeading')),
          h('div', { key: 'tokens-grid', className: 'smooth-context-grid' }, tokenRows.map(metric)),
        ] : []),
      ]), document.body);
    }

    return h(Fragment, null,
      h('button', {
        key: 'trigger',
        ref: triggerRef,
        type: 'button',
        className: 'smooth-context-button',
        title: label,
        'aria-label': label,
        'aria-haspopup': 'dialog',
        'aria-expanded': open,
        onClick: () => setOpen((value) => !value),
      }, h('svg', {
        viewBox: `0 0 ${size} ${size}`,
        width: size,
        height: size,
        'aria-hidden': 'true',
      }, [
        h('circle', {
          key: 'track', className: 'smooth-context-ring-track', cx: size / 2, cy: size / 2, r: radius,
        }),
        h('circle', {
          key: 'fill',
          className: 'smooth-context-ring-fill',
          cx: size / 2,
          cy: size / 2,
          r: radius,
          strokeDasharray: `${circumference * context.percent / 100} ${circumference}`,
          transform: `rotate(-90 ${size / 2} ${size / 2})`,
        }),
        h('text', {
          key: 'label',
          className: 'smooth-context-ring-label',
          x: size / 2,
          y: size / 2,
          'text-anchor': 'middle',
          dominantBaseline: 'central',
        }, reading),
      ])),
      panel,
    );
  };

  try {
    ctx.slots.inject('conversation.input.right', () => {
      try {
        return ctx.slots.register({
          name: 'conversation.input.right',
          id: 'ui-workshop.context',
          order: 60,
        }, ContextRing);
      } catch (error) {
        console.warn('[ui-workshop] the context ring could not be registered', error);
        return undefined;
      }
    });
  } catch (error) {
    console.warn('[ui-workshop] the composer seat could not be awaited', error);
  }

  /* ---- The model panel, ported from dsh-smooth-skin ---- */

  /** Chevron-left, chevron-right and check, drawn to the host's 16px line style. */
  const IconChevronLeft = (props) => h('svg', {
    width: props.size ?? 16, height: props.size ?? 16, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
    className: props.className, 'aria-hidden': 'true',
  }, h('path', { d: 'm14.5 5.5-6.5 6.5 6.5 6.5' }));
  const IconChevronRight = (props) => h('svg', {
    width: props.size ?? 14, height: props.size ?? 14, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
    className: props.className, 'aria-hidden': 'true',
  }, h('path', { d: 'm9.5 5.5 6.5 6.5-6.5 6.5' }));
  const IconCheck = (props) => h('svg', {
    width: props.size ?? 14, height: props.size ?? 14, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
    className: props.className, 'aria-hidden': 'true',
  }, h('path', { d: 'm5 12.5 4.5 4.5L19 7.5' }));

  const THINK_LEVELS = ['off', 'low', 'high', 'max'];

  /** The level artwork names the effort id first; other effort sets map by position. */
  const thinkArtFor = (efforts, index) => {
    const id = String(efforts[index]?.id || '').toLowerCase();
    if (THINK_ART[id] !== undefined) return id;
    const ratio = efforts.length > 1 ? index / (efforts.length - 1) : 1;
    return THINK_LEVELS[Math.max(0, Math.min(THINK_LEVELS.length - 1, Math.round(ratio * (THINK_LEVELS.length - 1))))];
  };

  /** Only the DeepSeek groups get the backdrop; other providers keep the plain panel. */
  const deepseekBackdrop = (group) => Boolean(group && /deepseek/i.test(`${group.id || ''} ${group.name || ''}`));

  /** Host offers "Default" exactly for catalogues without a fixed default stop. */
  const offersDefaultEffort = (reasoning) => Boolean(
    reasoning && reasoning.efforts?.length > 0 && reasoning.defaultEffort === undefined,
  );

  /** The top stop's pale glints; geometry baked once so re-renders never reshuffle it. */
  const MODEL_GLOWS = Array.from({ length: 4 }, (_, index) => {
    const random = (salt) => {
      const value = Math.sin((index + 3.7) * salt) * 43758.5453;
      return value - Math.floor(value);
    };
    return {
      left: 6 + random(17.31) * 88,
      top: (random(63.97) - .5) * 8,
      opacity: .13 + random(88.13) * .12,
      size: 32 + random(45.77) * 36,
      dx: (random(29.53) - .5) * 160,
      dy: (random(74.11) - .5) * 28,
      duration: 4.5 + random(12.71) * 4,
      delay: -random(59.37) * 8,
    };
  });

  /** The top stop's particle field; also baked once, packed toward the thumb. */
  const MODEL_SPARKS = Array.from({ length: 96 }, (_, index) => {
    const random = (salt) => {
      const value = Math.sin((index + 1) * salt) * 43758.5453;
      return value - Math.floor(value);
    };
    const left = 4 + Math.pow(random(12.9898), .38) * 94;
    const weight = Math.min(1, Math.max(0, (left - 4) / 94));
    return {
      left,
      top: (random(78.233) - .5) * 18,
      dx: -(40 + random(37.719) * 140),
      dy: (random(4.898) - .5) * 14,
      duration: .8 + random(93.989) * 1.4,
      delay: -random(23.14) * 2.6,
      size: 2.2 + weight * 2.4 + random(68.7) * 1.2,
      opacity: .35 + weight * .4 + random(51.3) * .25,
    };
  });

  /** The model catalogue page. */
  const ModelList = (props) => {
    const { groups, current, onPick, onBack, onDone, active } = props;
    const [query, setQuery] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [picking, setPicking] = useState(null);
    const searchRef = useRef(null);
    useEffect(() => {
      if (active) searchRef.current?.focus?.();
    }, [active]);
    const needle = query.trim().toLowerCase();
    const filtered = groups.map((group) => ({
      ...group,
      models: (group.models || []).filter((model) => !needle || model.name.toLowerCase().includes(needle)),
    })).filter((group) => group.models.length > 0);
    const pick = async (group, model) => {
      setBusy(true);
      setPicking(`${group.id}:${model.id}`);
      setError('');
      try {
        await onPick(group, model);
        onDone();
      } catch (reason) {
        setError(reason?.message || t('modelFailed'));
      } finally {
        setPicking(null);
        setBusy(false);
      }
    };
    return h('div', { className: 'smooth-model-list', role: 'group', 'aria-label': t('modelMenu') },
      h('div', { className: 'smooth-model-list-head' },
        h('button', {
          type: 'button', className: 'smooth-model-back', onClick: onBack, 'aria-label': t('back'),
        }, h(IconChevronLeft, { size: 16 })),
        h('span', { className: 'smooth-model-list-title' }, t('modelMenu'))),
      h('input', {
        ref: searchRef,
        className: 'smooth-git-search',
        type: 'search',
        value: query,
        placeholder: t('searchModel'),
        onChange: (event) => setQuery(event.target.value),
      }),
      error ? h('div', { className: 'smooth-git-error', role: 'alert' }, error) : null,
      h('div', { className: 'smooth-git-list', role: 'group', 'aria-label': t('modelMenu') },
        filtered.map((group) => h('div', {
          key: group.id, className: 'smooth-model-group', role: 'group', 'aria-label': group.name,
        },
        h('div', { className: 'smooth-git-heading' }, group.name),
        (group.models || []).map((model) => {
          const selected = group.id === current?.provider && model.id === current?.model;
          return h('button', {
            key: model.id,
            type: 'button',
            className: 'smooth-git-row',
            disabled: busy && picking === `${group.id}:${model.id}`,
            'aria-current': selected ? 'true' : undefined,
            'data-current': selected ? 'true' : undefined,
            onClick: () => {
              if (busy) return;
              pick(group, model);
            },
          },
          h('span', { className: 'smooth-git-row-main' }, h('span', { className: 'smooth-git-name' }, model.name)),
          selected ? h(IconCheck, { className: 'smooth-git-check' }) : null);
        })))),
      filtered.length === 0 ? h('div', { className: 'smooth-git-note' }, t('noModels')) : null);
  };

  /** The effort page: model name above a reasoning slider with the level artwork. */
  const ModelEffortControl = (props) => {
    const directory = props.directory;
    const state = useSyncExternalStore(
      (listener) => directory.subscribe(listener),
      () => directory.getSnapshot(),
    );
    const [draft, setDraft] = useState(null);
    const [autoDraft, setAutoDraft] = useState(false);
    const [error, setError] = useState('');
    const triggerRef = useRef(null);
    const draftRef = useRef(null);
    const committedRef = useRef(null);
    useEffect(() => {
      if (props.available !== false) props.load?.();
    }, [props.available, props.load]);
    const groups = state.groups || [];
    const current = state.current;
    const choices = groups.flatMap((group) => (group.models || []).map((model) => ({ group, model })));
    const choice = choices.find(({ group, model }) => group.id === current?.provider && model.id === current?.model);
    const model = choice?.model;
    const group = choice?.group;
    const reasoning = model?.reasoning;
    const efforts = reasoning?.efforts || [];
    const defaultOption = offersDefaultEffort(reasoning);
    const defaultActive = defaultOption && draft == null && (autoDraft || current?.reasoningEffort === undefined);
    const effective = defaultActive ? undefined : (current?.reasoningEffort ?? reasoning?.defaultEffort);
    const explicitIndex = defaultActive ? -1 : efforts.findIndex((effort) => effort.id === effective);
    const currentIndex = Math.max(0, explicitIndex);
    const lastExplicitRef = useRef(currentIndex);
    useEffect(() => {
      if (explicitIndex >= 0) lastExplicitRef.current = explicitIndex;
    }, [explicitIndex]);
    const index = draft == null
      ? (defaultActive ? lastExplicitRef.current : currentIndex)
      : Math.max(0, Math.min(draft, efforts.length - 1));
    const disabled = Boolean(props.locked) || props.available === false;
    const ratio = efforts.length > 1 ? index / (efforts.length - 1) : 1;
    const sliderRef = useRef(null);
    const ratioRef = useRef(ratio);
    ratioRef.current = ratio;
    const dragRef = useRef(null);
    const setPointerRatio = (clientX) => {
      const node = sliderRef.current;
      const track = node?.querySelector?.('.smooth-model-track');
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const span = Math.max(1, rect.width - 26);
      const pointerRatio = Math.min(1, Math.max(0, (clientX - rect.left - 13) / span));
      node.style.setProperty('--smooth-model-ratio', String(pointerRatio));
    };
    const restoreRatio = () => {
      sliderRef.current?.classList.remove('is-dragging');
      sliderRef.current?.style.setProperty('--smooth-model-ratio', String(ratioRef.current));
    };
    const beginDrag = (event) => {
      dragRef.current = { x: event.clientX, y: event.clientY };
      setPointerRatio(event.clientX);
    };
    const endDrag = () => {
      dragRef.current = null;
      restoreRatio();
    };
    useEffect(() => {
      if (dragRef.current) return;
      sliderRef.current?.style.setProperty('--smooth-model-ratio', String(ratio));
    }, [ratio]);
    useEffect(() => {
      const move = (event) => {
        const start = dragRef.current;
        if (!start || !event.buttons) return;
        if (Math.abs(event.clientX - start.x) < 4 && Math.abs(event.clientY - start.y) < 4) return;
        sliderRef.current?.classList.add('is-dragging');
        setPointerRatio(event.clientX);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', endDrag);
      window.addEventListener('pointercancel', endDrag);
      return () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', endDrag);
        window.removeEventListener('pointercancel', endDrag);
      };
    }, []);
    const commit = (next) => {
      const effort = efforts[next];
      if (!effort || !current) return;
      committedRef.current = next;
      setError('');
      Promise.resolve(props.select({
        provider: current.provider,
        model: current.model,
        reasoningEffort: effort.id,
      })).catch((reason) => {
        if (committedRef.current === next) committedRef.current = null;
        if (draftRef.current === next) {
          draftRef.current = null;
          setDraft(null);
        }
        setError(reason?.message || t('modelFailed'));
      });
    };
    const chooseDefault = () => {
      if (!current || !defaultOption || defaultActive) return;
      committedRef.current = null;
      draftRef.current = null;
      setDraft(null);
      setAutoDraft(true);
      setError('');
      Promise.resolve(props.select({ provider: current.provider, model: current.model })).catch((reason) => {
        setAutoDraft(false);
        setError(reason?.message || t('modelFailed'));
      });
    };
    const preview = (next) => {
      setAutoDraft(false);
      setDraft(next);
      draftRef.current = next;
      if (committedRef.current !== next) commit(next);
    };
    const flush = () => {
      const next = draftRef.current;
      if (next == null || committedRef.current === next) return;
      commit(next);
    };
    useEffect(() => {
      if (draft != null && currentIndex === draft) {
        draftRef.current = null;
        setDraft(null);
      }
    }, [currentIndex, draft]);
    useEffect(() => {
      if (autoDraft && current?.reasoningEffort === undefined) setAutoDraft(false);
    }, [autoDraft, current?.reasoningEffort]);
    const atMax = !defaultActive && efforts.length > 0 && index === efforts.length - 1;
    const level = !defaultActive && reasoning && efforts.length > 0 ? thinkArtFor(efforts, index) : undefined;
    const backdrop = Boolean(level && deepseekBackdrop(group));
    const levelName = defaultActive ? t('effortDefault') : efforts[index]?.name || '';
    return h('div', { className: 'smooth-model-effort' },
      backdrop ? h('div', { className: 'smooth-model-media', 'data-level': level, 'aria-hidden': 'true' },
        THINK_LEVELS.map((key) => h('img', {
          key,
          className: 'smooth-model-art',
          src: THINK_ART[key],
          alt: '',
          'data-active': key === level ? 'true' : undefined,
          draggable: false,
        }))) : null,
      h('div', { className: 'smooth-model-body' },
        (levelName || defaultOption) ? h('div', { className: 'smooth-model-level' },
          defaultOption ? h('button', {
            type: 'button',
            className: 'smooth-model-auto',
            'data-active': defaultActive ? 'true' : undefined,
            'aria-pressed': defaultActive ? 'true' : 'false',
            'aria-label': t('effortAuto'),
            title: t('effortAuto'),
            disabled,
            onClick: chooseDefault,
          }, t('effortDefault')) : null,
          levelName && !defaultActive ? h('span', { key: levelName, className: 'smooth-model-level-name' }, levelName) : null) : null,
        h('button', {
          ref: triggerRef,
          type: 'button',
          className: 'smooth-model-trigger',
          'data-smooth-model-trigger': '',
          disabled,
          title: model?.name,
          'aria-haspopup': 'dialog',
          'aria-expanded': props.modelsOpen === undefined ? undefined : (props.modelsOpen ? 'true' : 'false'),
          onClick: () => props.onOpenModels?.(),
        },
        h('span', { className: 'smooth-model-name' }, model?.name || t('modelLoading')),
        h(IconChevronRight, { size: 14 })),
        reasoning && efforts.length > 0 ? h('div', {
          ref: sliderRef,
          className: 'smooth-model-slider',
          'data-default': defaultActive ? 'true' : undefined,
        },
        h('div', { className: 'smooth-model-track', 'aria-hidden': 'true' },
          h('div', { className: 'smooth-model-fill' }),
          efforts.map((effort, at) => {
            const percent = efforts.length > 1 ? at / (efforts.length - 1) : 0;
            return h('span', {
              key: `dot:${effort.id}`,
              className: 'smooth-model-dot',
              style: { left: `calc(13px + (100% - 26px) * ${percent})` },
            });
          }),
          atMax ? h('div', { className: 'smooth-model-glow' },
            MODEL_GLOWS.map((glow, glowIndex) => h('span', {
              key: `glow:${glowIndex}`,
              className: 'smooth-model-glow-blob',
              style: {
                left: `${glow.left}%`,
                top: `calc(50% + ${glow.top}px)`,
                width: `${glow.size}px`,
                height: `${glow.size}px`,
                '--glow-opacity': String(glow.opacity),
                '--glow-dx': `${glow.dx}px`,
                '--glow-dy': `${glow.dy}px`,
                '--glow-duration': `${glow.duration}s`,
                '--glow-delay': `${glow.delay}s`,
              },
            }))) : null),
        atMax ? h('div', { className: 'smooth-model-sparks', 'aria-hidden': true },
          MODEL_SPARKS.map((spark, sparkIndex) => h('span', {
            key: `spark:${sparkIndex}`,
            className: 'smooth-model-spark',
            style: {
              left: `${spark.left}%`,
              top: `calc(50% + ${spark.top}px)`,
              '--spark-size': `${spark.size}px`,
              '--spark-opacity': String(spark.opacity),
              '--spark-dx': `${spark.dx}px`,
              '--spark-dy': `${spark.dy}px`,
              '--spark-duration': `${spark.duration}s`,
              '--spark-delay': `${spark.delay}s`,
            },
          }))) : null,
        h('input', {
          type: 'range',
          min: 0,
          max: Math.max(0, efforts.length - 1),
          step: 1,
          value: index,
          disabled,
          'aria-label': t('reasoningEffort'),
          'aria-valuenow': index,
          'aria-valuetext': levelName,
          onChange: (event) => {
            if (!disabled) preview(Number(event.target.value));
          },
          onPointerDown: beginDrag,
          onPointerUp: () => {
            endDrag();
            flush();
          },
          onPointerCancel: endDrag,
          onKeyUp: flush,
          onBlur: () => {
            endDrag();
            flush();
          },
        }),
        h('span', { className: 'smooth-model-glider', 'aria-hidden': true })) : null,
        error ? h('div', { className: 'smooth-model-error', role: 'alert' }, error) : null));
  };

  /** The two-page panel: effort, and the model catalogue it slides over to. */
  const ModelPanel = (props) => {
    const { anchor, directory, load, select, onClose, closeRef } = props;
    const panelRef = useRef(null);
    const effortRef = useRef(null);
    const modelsRef = useRef(null);
    const [view, setView] = useState('effort');
    const [contentHeight, setContentHeight] = useState(0);
    const [phase, setPhase] = useState('open');
    const closingRef = useRef(false);
    const closeTimer = useRef(0);
    const reduced = () => typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
    const requestClose = () => {
      if (closingRef.current) return;
      closingRef.current = true;
      if (reduced()) {
        onClose();
        return;
      }
      setPhase('closing');
      closeTimer.current = window.setTimeout(onClose, 160);
    };
    const state = useSyncExternalStore(
      (listener) => directory.subscribe(listener),
      () => directory.getSnapshot(),
    );
    useEffect(() => {
      const pane = (view === 'models' ? modelsRef : effortRef).current;
      if (!pane) return undefined;
      const update = () => setContentHeight(pane.offsetHeight);
      update();
      const observer = new ResizeObserver(update);
      observer.observe(pane);
      return () => observer.disconnect();
    }, [view]);
    useEffect(() => () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    }, []);
    useEffect(() => {
      if (!closeRef) return undefined;
      closeRef.current = requestClose;
      return () => {
        if (closeRef.current === requestClose) closeRef.current = null;
      };
    });
    useEffect(() => {
      const outside = (event) => {
        if (panelRef.current?.contains?.(event.target)) return;
        if (event.target?.closest?.('[data-slot="conversation.input.model"]')) return;
        requestClose();
      };
      document.addEventListener('pointerdown', outside, true);
      return () => document.removeEventListener('pointerdown', outside, true);
    }, [onClose]);
    useEffect(() => {
      const escape = (event) => {
        if (event.key !== 'Escape') return;
        if (view === 'models') setView('effort');
        else requestClose();
      };
      document.addEventListener('keydown', escape);
      return () => document.removeEventListener('keydown', escape);
    }, [view, onClose]);
    const pick = async (group, model) => {
      await select({
        provider: group.id,
        model: model.id,
        ...(model.reasoning?.defaultEffort === undefined ? {} : { reasoningEffort: model.reasoning.defaultEffort }),
      });
    };
    const width = Math.min(Math.max(anchor.width || 0, 260), 360, window.innerWidth - 16);
    const right = anchor.right ?? anchor.left + width;
    const left = Math.max(8, Math.min(right - width, window.innerWidth - width - 8));
    const bottom = Math.max(8, window.innerHeight - anchor.top + 8);
    return createPortal(h('div', {
      ref: panelRef,
      className: 'smooth-git-menu smooth-model-panel',
      'data-view': view,
      'data-state': phase,
      style: { left: `${left}px`, bottom: `${bottom}px`, width: `${width}px` },
      role: 'dialog',
      'aria-label': view === 'models' ? t('modelMenu') : t('reasoningEffort'),
    },
    h('div', {
      className: 'smooth-model-panel-viewport',
      style: contentHeight ? { height: `${contentHeight}px` } : undefined,
    },
    h('div', {
      ref: effortRef,
      className: 'smooth-model-panel-pane',
      'data-pane': 'effort',
      'data-active': view === 'effort' ? 'true' : undefined,
      'aria-hidden': view === 'models',
      inert: view === 'models',
    },
    h(ModelEffortControl, {
      directory,
      load,
      select,
      available: true,
      locked: false,
      onOpenModels: () => setView('models'),
      modelsOpen: view === 'models',
    })),
    h('div', {
      ref: modelsRef,
      className: 'smooth-model-panel-pane',
      'data-pane': 'models',
      'data-active': view === 'models' ? 'true' : undefined,
      'aria-hidden': view !== 'models',
      inert: view !== 'models',
    },
    h(ModelList, {
      groups: state.groups || [],
      current: state.current,
      active: view === 'models',
      onPick: pick,
      onBack: () => setView('effort'),
      onDone: () => setView('effort'),
    })))),
    document.body);
  };

  /** Listens on the shipped model trigger; the panel component owns all changes. */
  const ModelPanelHost = (props) => {
    const modelDirectories = ctx.get('modelDirectories');
    let directory;
    if (modelDirectories && props.sessionId) {
      try {
        directory = modelDirectories.directoryFor(props.sessionId);
      } catch {
        directory = undefined;
      }
    }
    const ready = Boolean(directory?.store);
    const [anchor, setAnchor] = useState(undefined);
    const closeRef = useRef(null);
    useEffect(() => {
      if (!ready) return undefined;
      let trigger;
      const capture = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (closeRef.current) {
          closeRef.current();
          return;
        }
        const rect = trigger.getBoundingClientRect();
        setAnchor({ left: rect.left, top: rect.top, width: rect.width, right: rect.right });
      };
      const attach = () => {
        const next = document.querySelector('[data-slot="conversation.input.model"] button[aria-haspopup="menu"]')
          || document.querySelector('[data-slot="conversation.input.model"] button');
        if (!next || next === trigger) return;
        trigger?.removeEventListener('click', capture, true);
        trigger = next;
        trigger.addEventListener('click', capture, true);
      };
      attach();
      const observer = new MutationObserver(attach);
      observer.observe(document.body, { childList: true, subtree: true });
      return () => {
        observer.disconnect();
        trigger?.removeEventListener('click', capture, true);
      };
    }, [ready]);
    useEffect(() => {
      if (!ready) setAnchor(undefined);
    }, [ready]);
    if (!ready) return null;
    const load = () => {
      try {
        directory.load?.().catch?.(() => {});
      } catch {
        /* A directory that cannot load simply keeps the last snapshot. */
      }
    };
    const select = async (selection) => {
      const result = await directory.select(selection);
      if (result && result.ok === false) {
        throw new Error(result.error?.message || t('modelFailed'));
      }
    };
    return anchor
      ? h(ModelPanel, {
        anchor,
        directory: directory.store,
        load,
        select,
        closeRef,
        onClose: () => setAnchor(undefined),
      })
      : null;
  };

  try {
    ctx.slots.inject('conversation.input.overlay', () => {
      try {
        return ctx.slots.register({
          name: 'conversation.input.overlay',
          id: 'ui-workshop.model',
          order: -70,
        }, ModelPanelHost);
      } catch (error) {
        console.warn('[ui-workshop] the model panel could not be registered', error);
        return undefined;
      }
    });
  } catch (error) {
    console.warn('[ui-workshop] the composer overlay seat could not be awaited', error);
  }
}

/** A stable no-op subscription for the case where no store exists yet. */
function noopSubscribe() {
  return () => {};
}

export { apply, inject, name };
