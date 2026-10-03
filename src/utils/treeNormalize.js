/**
 * Tree node field normalisation.
 *
 * The API returns `sponsor` / `parent` as objects (`{ id, memberId, name }`) from
 * BinaryTreeService, but the older fixture shape used plain strings. Components were
 * written against the string shape, so calling `node.sponsor.split(...)` threw
 * "node.sponsor.split is not a function" and rendering it printed "[object Object]".
 *
 * Normalising once, where the tree enters the page, keeps every consumer simple and
 * accepts both shapes.
 */

/** Coerce a reference (string | {memberId,...} | undefined) into a display id. */
export const refId = (ref) => {
  if (!ref) return null;
  if (typeof ref === 'string') return ref.trim().split(' ')[0];
  if (typeof ref === 'object') return ref.memberId || ref.distributorId || ref.id || null;
  return String(ref);
};

/** Coerce a reference into a person's display name, when one is carried. */
export const refName = (ref) => (ref && typeof ref === 'object' ? ref.name || null : null);

/** Normalise one node (recursively) into the flat, string-based shape the UI expects. */
export const normalizeTreeNode = (node) => {
  if (!node || typeof node !== 'object') return node;

  const sponsorRef = node.sponsor ?? node.sponsorId;
  const parentRef = node.placementParent ?? node.parent ?? node.parentId;

  return {
    ...node,
    sponsor: refId(sponsorRef),
    sponsorName: node.sponsorName || refName(sponsorRef),
    placementParent: refId(parentRef),
    placementParentName: node.placementParentName || refName(parentRef),
    left: node.left ? normalizeTreeNode(node.left) : node.left,
    right: node.right ? normalizeTreeNode(node.right) : node.right,
  };
};

/** Accepts either a bare root node or a `{ root }` envelope. */
export const normalizeTree = (tree) => {
  if (!tree) return tree;
  if (tree.root) return { ...tree, root: normalizeTreeNode(tree.root) };
  return normalizeTreeNode(tree);
};
