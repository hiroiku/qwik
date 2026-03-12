import {
  type VNodeJournal,
  vnode_getFirstChild,
  vnode_insertBefore,
  vnode_remove,
  vnode_truncate,
} from './vnode-utils';
import type { VNode } from '../shared/vnode/vnode';
import type { ElementVNode } from '../shared/vnode/element-vnode';
import type { VirtualVNode } from '../shared/vnode/virtual-vnode';
import type { Container } from '../../server/qwik-types';
import type { JSXNode, JSXOutput } from '../shared/jsx/types/jsx-node';
import { vnode_diff_single } from './vnode-diff';
import { isJSXNode } from '../shared/jsx/jsx-node';
import type { ClientContainer } from './types';
import type { Cursor } from '../shared/cursor/cursor';
import { isDev } from '@qwik.dev/core/build';

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

// Reused rows that belong to the LIS can stay where they are; everything else needs to move.
// This computes the plan only. We still need a later pass to apply inserts/moves/removals against
// the actual vnode tree, because the LIS works on indexes rather than concrete sibling pointers.
function getStableRowMask(oldIndexes: ArrayLike<number>): Uint8Array {
  const stableRows = new Uint8Array(oldIndexes.length);
  const predecessors = new Int32Array(oldIndexes.length);
  predecessors.fill(-1);
  const lis = new Int32Array(oldIndexes.length);
  let lisLength = 0;
  let lastOldIndex = -1;
  let isIncreasing = true;

  for (let i = 0; i < oldIndexes.length; i++) {
    const oldIndex = oldIndexes[i];
    if (oldIndex < 0) {
      continue;
    }

    if (oldIndex <= lastOldIndex) {
      isIncreasing = false;
    } else {
      lastOldIndex = oldIndex;
    }

    let low = 0;
    let high = lisLength;

    while (low < high) {
      const mid = (low + high) >> 1;
      const lisIndex = lis[mid];
      if (oldIndexes[lisIndex] < oldIndex) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    if (low > 0) {
      predecessors[i] = lis[low - 1];
    }

    lis[low] = i;
    if (low === lisLength) {
      lisLength++;
    }
  }

  if (isIncreasing) {
    for (let i = 0; i < oldIndexes.length; i++) {
      if (oldIndexes[i] >= 0) {
        stableRows[i] = 1;
      }
    }
    return stableRows;
  }

  let current = lisLength > 0 ? lis[lisLength - 1] : -1;
  while (current !== -1) {
    stableRows[current] = 1;
    current = predecessors[current];
  }

  return stableRows;
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
  const itemsLength = items.length;
  const oldRowsLength = oldRows.length;
  let anchor: VNode | null = null;
  if (oldRowsLength === 0) {
    // Fast path: no keyed children, we can just append everything.
    for (let i = itemsLength - 1; i >= 0; i--) {
      const jsx = renderItem(items[i], i) as JSXNode;
      const key = keyOf(items[i], i);
      jsx.key = key;
      await insertNode(container, journal, parent, anchor, cursor, jsx, key, null);
      anchor = (anchor ? anchor.previousSibling : parent.lastChild) ?? null;
    }
    return;
  } else if (itemsLength === 0) {
    // Fast path: no new items, we can just remove everything.
    vnode_truncate(journal, parent, oldRows[0], true);
    return;
  }
  const oldByKey = new Map<Key, KeyedRowVNode>();
  const oldIndexByKey = new Map<Key, number>();

  for (let i = 0; i < oldRowsLength; i++) {
    const row = oldRows[i];
    if (row.key == null) {
      continue;
    }
    oldByKey.set(row.key, row);
    oldIndexByKey.set(row.key, i);
  }

  const keys = new Array<Key>(itemsLength);
  const oldIndexes = new Int32Array(itemsLength);
  oldIndexes.fill(-1);
  for (let i = 0; i < itemsLength; i++) {
    const key = keyOf(items[i], i);
    keys[i] = key;
    const oldIndex = oldIndexByKey.get(key);
    if (oldIndex !== undefined) {
      oldIndexes[i] = oldIndex;
    }
  }
  const stableRows = getStableRowMask(oldIndexes);

  // Walk from the end so `anchor` is always the vnode that should come after the current item in
  // the final order. `stableRows` tells us which reused nodes can stay put; this pass performs the
  // concrete vnode operations and creates any newly inserted rows.
  for (let i = itemsLength - 1; i >= 0; i--) {
    const item = items[i];
    const key = keys[i];

    const reused = oldByKey.get(key) ?? null;
    if (reused) {
      oldByKey.delete(key);
      if (stableRows[i] === 0) {
        vnode_insertBefore(journal, parent, reused, anchor);
      }
      anchor = reused;
    } else {
      const jsx = renderItem(item, i) as JSXNode;
      await insertNode(container, journal, parent, anchor, cursor, jsx, key, reused);
      anchor = (anchor ? anchor.previousSibling : parent.lastChild) ?? null;
    }
  }

  // Anything still left in the old-key map was not claimed by the new list and must be removed.
  for (const leftover of oldByKey.values()) {
    vnode_remove(journal, parent, leftover, true);
  }
}

async function insertNode(
  container: Container,
  journal: VNodeJournal,
  parent: ElementVNode | VirtualVNode,
  anchor: VNode | null,
  cursor: Cursor,
  jsx: JSXNode,
  key: Key,
  reused: VNode | null
): Promise<void> {
  if (isDev && !isJSXNode(jsx)) {
    throw new Error('Each item$ must return a single JSX node');
  }
  (jsx as JSXNode).key = key;
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
