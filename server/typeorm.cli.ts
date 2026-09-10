import 'reflect-metadata';

/**
 * Thin wrapper around TypeORM's CLI.
 *
 * npm workspaces hoist dependencies to the repository root, so `node_modules`
 * does not sit inside `server/` and a hardcoded `./node_modules/typeorm/cli.js`
 * path does not resolve. `require.resolve` walks up the tree the way Node
 * itself does, which works whether the install is hoisted or not.
 */
/*
 * The CLI is a side-effecting script with no exports, and `import` would be
 * hoisted above the reflect-metadata import it depends on.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
require(require.resolve('typeorm/cli.js'));
