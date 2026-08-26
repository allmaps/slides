/**
 * @typedef {Object} HastNode
 * @property {string} [type]
 * @property {string} [tagName]
 * @property {Record<string, unknown>} [properties]
 * @property {HastNode[]} [children]
 */

/**
 * @param {unknown} node
 * @returns {node is HastNode}
 */
const isElement = (node) =>
  typeof node === "object" &&
  node !== null &&
  "type" in node &&
  /** @type {HastNode} */ (node).type === "element";

/**
 * @param {unknown} value
 */
const getClasses = (value) => {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return value.split(/\s+/);

  return [];
};

/**
 * @param {HastNode} node
 * @param {string} className
 */
const hasClass = (node, className) =>
  getClasses(node.properties?.className)
    .concat(getClasses(node.properties?.class))
    .includes(className);

/**
 * @param {HastNode} parent
 */
const transformChildren = (parent) => {
  if (!parent.children) return;

  let index = 0;

  while (index < parent.children.length) {
    const child = parent.children[index];

    if (
      isElement(child) &&
      child.tagName === "hr" &&
      hasClass(parent, "footnotes")
    ) {
      parent.children.splice(index, 1);
      continue;
    }

    if (
      isElement(child) &&
      child.tagName === "a" &&
      hasClass(child, "footnote-backref")
    ) {
      parent.children.splice(index, 1);
      continue;
    }

    if (
      isElement(child) &&
      child.tagName === "a" &&
      hasClass(child, "footnote-ref")
    ) {
      parent.children.splice(index, 1, ...(child.children ?? []));
      continue;
    }

    if (isElement(child)) {
      transformChildren(child);
    }

    index += 1;
  }
};

const removeFootnoteLinks = () => {
  /**
   * @param {HastNode} tree
   */
  return (tree) => {
    transformChildren(tree);
  };
};

export default removeFootnoteLinks;
