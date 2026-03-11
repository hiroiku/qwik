import {
  type VNodeJournal,
  vnode_connectSiblings,
  vnode_getFirstChild,
  vnode_insertBefore,
  vnode_newVirtual,
  vnode_remove,
} from './vnode-utils';
import type { VNode } from '../shared/vnode/vnode';
import type { ElementVNode } from '../shared/vnode/element-vnode';
import type { VirtualVNode } from '../shared/vnode/virtual-vnode';
import { markVNodeDirty } from '../shared/vnode/vnode-dirty';
import { setNodeDiffPayload } from '../shared/cursor/chore-execution';
import type { Container } from '../../server/qwik-types';
import { ChoreBits } from '../shared/vnode/enums/chore-bits.enum';
import type { JSXNode } from '../shared/jsx/types/jsx-node';

type Key = string;
type KeyedRowVNode = ElementVNode | VirtualVNode;

function convertJSXToVNode(container: Container, jsx: JSXNode, host: VirtualVNode): KeyedRowVNode {
  const parent = vnode_newVirtual();
  vnode_connectSiblings(host, parent, null);
  setNodeDiffPayload(parent, jsx);
  markVNodeDirty(container, parent, ChoreBits.NODE_DIFF);
  return parent;
}

function collectCurrentKeyedChildren(parent: VirtualVNode): KeyedRowVNode[] {
  const rows: KeyedRowVNode[] = [];
  let child = vnode_getFirstChild(parent);

  while (child) {
    if ((child as KeyedRowVNode).key != null) {
      rows.push(child as KeyedRowVNode);
    }
    child = (child as KeyedRowVNode).nextSibling as KeyedRowVNode | null;
  }

  return rows;
}

function placeRow(
  journal: VNodeJournal,
  parent: ElementVNode | VirtualVNode,
  vnode: KeyedRowVNode,
  anchor: VNode | null
): void {
  const alreadyInPlace = anchor ? vnode.nextSibling === anchor : parent.lastChild === vnode;

  if (!alreadyInPlace) {
    vnode_insertBefore(journal, parent, vnode, anchor);
  }
}

export function reconcileKeyedLoopToParent<T>(
  container: Container,
  journal: VNodeJournal,
  parent: ElementVNode | VirtualVNode,
  items: readonly T[],
  keyOf: (item: T, index: number) => Key,
  renderItem: (item: T, index: number) => JSXNode
): void {
  const oldRows = collectCurrentKeyedChildren(parent);
  const oldByKey = new Map<Key, KeyedRowVNode>();

  for (const row of oldRows) {
    if (row.key == null) {
      continue;
    }
    oldByKey.set(row.key, row);
  }

  const nextRows = new Array<KeyedRowVNode>(items.length);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const key = keyOf(item, i);

    const reused = oldByKey.get(key);
    if (reused) {
      // Same key => ignore rerender, just reuse vnode.
      nextRows[i] = reused;
      oldByKey.delete(key);
    } else {
      const created = convertJSXToVNode(container, renderItem(item, i), parent);
      created.key = key;
      nextRows[i] = created;
    }
  }

  for (const leftover of oldByKey.values()) {
    vnode_remove(journal, parent, leftover, true);
  }

  let anchor: VNode | null = null;
  for (let i = nextRows.length - 1; i >= 0; i--) {
    const row = nextRows[i];
    placeRow(journal, parent, row, anchor);
    anchor = row;
  }
}
