/**
 * A request the studio refuses with words meant for the creator ("That
 * folder is not a git repo"). The new routes pass its message through; any
 * other error stays the server's generic reply.
 */
export class Refusal extends Error {}
