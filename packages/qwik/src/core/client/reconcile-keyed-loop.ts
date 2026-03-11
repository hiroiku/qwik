import {
  type VNodeJournal,
  vnode_getFirstChild,
  vnode_insertBefore,
  vnode_remove,
} from './vnode-utils';
import type { VNode } from '../shared/vnode/vnode';
import type { ElementVNode } from '../shared/vnode/element-vnode';
import type { VirtualVNode } from '../shared/vnode/virtual-vnode';
import type { Container } from '../../server/qwik-types';
import type { JSXOutput } from '../shared/jsx/types/jsx-node';
import { vnode_diff_single } from './vnode-diff';
import { isJSXNode } from '../shared/jsx/jsx-node';
import type { ClientContainer } from './types';
import type { Cursor } from '../shared/cursor/cursor';

type Key = string;
type KeyedRowVNode = ElementVNode | VirtualVNode;

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

export async function reconcileKeyedLoopToParent<T>(
  container: Container,
  journal: VNodeJournal,
  parent: ElementVNode | VirtualVNode,
  cursor: Cursor,
  items: readonly T[],
  keyOf: (item: T, index: number) => Key,
  renderItem: (item: T, index: number) => JSXOutput
): Promise<void> {
  const oldRows = collectCurrentKeyedChildren(parent);
  const oldByKey = new Map<Key, KeyedRowVNode>();

  for (const row of oldRows) {
    if (row.key == null) {
      continue;
    }
    oldByKey.set(row.key, row);
  }

  let anchor: VNode | null = null;

  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    const key = keyOf(item, i);

    const reused = oldByKey.get(key) ?? null;
    if (reused) {
      oldByKey.delete(key);
      placeRow(journal, parent, reused, anchor);
    } else {
      const jsx = renderItem(item, i);

      if (!isJSXNode(jsx)) {
        throw new Error('Each item$ must return a single JSX node');
      }
      jsx.key = key;
      await vnode_diff_single(
        container as ClientContainer,
        journal,
        jsx,
        parent,
        reused,
        anchor,
        cursor,
        null
      );
    }

    anchor = (anchor ? anchor.previousSibling : parent.lastChild) ?? null;
  }

  for (const leftover of oldByKey.values()) {
    vnode_remove(journal, parent, leftover, true);
  }
}
