/**
 * dsh-ui-workshop — Host half.
 *
 * Every feature of this bundle is a browser-side layout, so the Host half only
 * names the row. Keeping it empty is deliberate: the Loader needs a Host plugin
 * for the patch entry, and an empty apply makes the bundle trivially removable.
 *
 * @module dsh-ui-workshop
 */

/* Also the Loader row id in cordis.patch.yml. */
const name = PACKAGE_NAME;

/* No Host service is required. */
const inject = [];

/** Host plugin body: nothing to apply. */
function apply() {}

export { apply, inject, name };
