/**
 * dsh-catia-model — a DSH bundle that ships the `catia-model` agent skill.
 *
 * The bundle carries no runtime code: it exists so that installing this package
 * into a DSH profile registers the skill directory under `skills/`, which the
 * harness's skill-filesystem provider picks up. Nothing is injected and no
 * service is provided.
 *
 * @module dsh-catia-model
 */

/** Cordis plugin name. */
export const name = 'dsh-catia-model'

/** No-op apply: the value is the `skills/` directory shipped with the package. */
export function apply() {}
