import { isDev } from '@qwik.dev/core/build';
import type { Container } from '../../server/qwik-types';
import type { Cursor } from '../shared/cursor/cursor';
import { isJSXNode } from '../shared/jsx/jsx-node';
import type { JSXNode, JSXOutput } from '../shared/jsx/types/jsx-node';
import type { ElementVNode } from '../shared/vnode/element-vnode';
import type { VirtualVNode } from '../shared/vnode/virtual-vnode';
import type { VNode } from '../shared/vnode/vnode';
import type { ClientContainer } from './types';
import { vnode_diff, vnode_diff_single } from './vnode-diff';
import {
  type VNodeJournal,
  vnode_getFirstChild,
  vnode_insertBefore,
  vnode_isElementOrVirtualVNode,
  vnode_remove,
  vnode_truncate,
} from './vnode-utils';

type Key = string;
type KeyedRowVNode = ElementVNode | VirtualVNode;

function collectCurrentKeyedChildren(parent: ElementVNode | VirtualVNode): KeyedRowVNode[] {
  const rows: KeyedRowVNode[] = [];
  let child = vnode_getFirstChild(parent);

  while (child) {
    if (vnode_isElementOrVirtualVNode(child) && child.key != null) {
      rows.push(child);
    }
    child = child.nextSibling as VNode | null;
  }

  return rows;
}

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

function renderKeyedRow<T>(
  item: T,
  index: number,
  key: Key,
  renderItem: (item: T, index: number) => JSXOutput
): JSXNode {
  const jsx = renderItem(item, index) as JSXNode;
  if (isDev && !isJSXNode(jsx)) {
    throw new Error('Each item$ must return a single JSX node');
  }
  jsx.key = key;
  return jsx;
}

function renderAllRows<T>(
  items: readonly T[],
  keyOf: (item: T, index: number) => Key,
  renderItem: (item: T, index: number) => JSXOutput
): JSXNode[] {
  const rows = new Array<JSXNode>(items.length);
  for (let i = 0; i < items.length; i++) {
    rows[i] = renderKeyedRow(items[i], i, keyOf(items[i], i), renderItem);
  }
  return rows;
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
  const clientContainer = container as ClientContainer;
  const oldRows = collectCurrentKeyedChildren(parent);
  const itemsLength = items.length;
  const oldRowsLength = oldRows.length;
  const keys = new Array<Key>(itemsLength);

  for (let i = 0; i < itemsLength; i++) {
    keys[i] = keyOf(items[i], i);
  }

  // Fast path: initial keyed mount, so let the full diff create the whole loop.
  if (oldRowsLength === 0) {
    if (itemsLength > 0) {
      await vnode_diff(
        clientContainer,
        journal,
        renderAllRows(items, keyOf, renderItem),
        parent,
        cursor,
        null
      );
    }
    return;
  }

  // Fast path: removing the entire loop is cheaper than row-by-row deletes.
  if (itemsLength === 0) {
    vnode_truncate(journal, parent, oldRows[0], true);
    return;
  }

  // Trim the unchanged prefix/suffix first so the expensive keyed work only sees the middle window.
  let start = 0;
  while (start < oldRowsLength && start < itemsLength && oldRows[start].key === keys[start]) {
    start++;
  }

  let oldEnd = oldRowsLength - 1;
  let newEnd = itemsLength - 1;
  while (oldEnd >= start && newEnd >= start && oldRows[oldEnd].key === keys[newEnd]) {
    oldEnd--;
    newEnd--;
  }

  // Fast path: head/tail scans consumed everything, so the lists already match.
  if (start > oldEnd && start > newEnd) {
    return;
  }

  // Fast path: only insertions remain between the matched head and tail.
  if (start > oldEnd) {
    const tailAnchor = newEnd + 1 < itemsLength ? (oldRows[start] ?? null) : null;

    if (tailAnchor === null) {
      // Pure append: stream new rows at the end without any move bookkeeping.
      for (let i = start; i <= newEnd; i++) {
        await vnode_diff_single(
          clientContainer,
          journal,
          renderKeyedRow(items[i], i, keys[i], renderItem),
          parent,
          null,
          null,
          cursor,
          null
        );
      }
      return;
    }

    // Insert before an unchanged tail by walking the new middle window from right to left.
    let anchor: VNode | null = tailAnchor;
    for (let i = newEnd; i >= start; i--) {
      await vnode_diff_single(
        clientContainer,
        journal,
        renderKeyedRow(items[i], i, keys[i], renderItem),
        parent,
        anchor,
        anchor,
        cursor,
        null
      );

      const inserted = anchor.previousSibling as KeyedRowVNode | null;
      if (isDev && !inserted) {
        throw new Error('Failed to insert keyed loop row');
      }
      if (inserted) {
        anchor = inserted;
      }
    }
    return;
  }

  // Fast path: only removals remain between the matched head and tail.
  if (start > newEnd) {
    if (start === 0) {
      vnode_truncate(journal, parent, oldRows[0], true);
    } else {
      for (let i = start; i <= oldEnd; i++) {
        vnode_remove(journal, parent, oldRows[i], true);
      }
    }
    return;
  }

  const oldByKey = new Map<Key, KeyedRowVNode>();
  const oldIndexByKey = new Map<Key, number>();
  for (let i = start; i <= oldEnd; i++) {
    const row = oldRows[i];
    oldByKey.set(row.key!, row);
    oldIndexByKey.set(row.key!, i - start);
  }

  let overlap = 0;
  const oldIndexes = new Int32Array(newEnd - start + 1);
  oldIndexes.fill(-1);
  for (let i = start; i <= newEnd; i++) {
    const oldIndex = oldIndexByKey.get(keys[i]);
    if (oldIndex !== undefined) {
      overlap++;
      oldIndexes[i - start] = oldIndex;
    }
  }

  // Fast path: the middle window has no shared keys, so replace that slice instead of moving rows.
  if (overlap === 0) {
    if (start === 0 && newEnd === itemsLength - 1 && oldEnd === oldRowsLength - 1) {
      vnode_truncate(journal, parent, oldRows[0], true);
      await vnode_diff(
        clientContainer,
        journal,
        renderAllRows(items, keyOf, renderItem),
        parent,
        cursor,
        null
      );
    } else {
      for (let i = start; i <= oldEnd; i++) {
        vnode_remove(journal, parent, oldRows[i], true);
      }

      let anchor: VNode | null = newEnd + 1 < itemsLength ? oldRows[newEnd + 1] : null;
      if (anchor === null) {
        for (let i = start; i <= newEnd; i++) {
          await vnode_diff_single(
            clientContainer,
            journal,
            renderKeyedRow(items[i], i, keys[i], renderItem),
            parent,
            null,
            null,
            cursor,
            null
          );
        }
      } else {
        for (let i = newEnd; i >= start; i--) {
          await vnode_diff_single(
            clientContainer,
            journal,
            renderKeyedRow(items[i], i, keys[i], renderItem),
            parent,
            anchor,
            anchor,
            cursor,
            null
          );

          const inserted = anchor.previousSibling as KeyedRowVNode | null;
          if (isDev && !inserted) {
            throw new Error('Failed to insert keyed loop row');
          }
          if (inserted) {
            anchor = inserted;
          }
        }
      }
    }
    return;
  }

  // General keyed path: preserve the longest stable subsequence and only move the rest.
  const stableRows = getStableRowMask(oldIndexes);
  let anchor: VNode | null = newEnd + 1 < itemsLength ? oldRows[newEnd + 1] : null;

  for (let i = newEnd; i >= start; i--) {
    const item = items[i];
    const key = keys[i];
    const reused = oldByKey.get(key) ?? null;

    if (reused) {
      oldByKey.delete(key);
      if (stableRows[i - start] === 0) {
        vnode_insertBefore(journal, parent, reused, anchor);
      }
      anchor = reused;
    } else {
      await vnode_diff_single(
        clientContainer,
        journal,
        renderKeyedRow(item, i, key, renderItem),
        parent,
        anchor,
        anchor,
        cursor,
        null
      );

      const inserted: KeyedRowVNode | null =
        (anchor
          ? (anchor.previousSibling as KeyedRowVNode | null)
          : (parent.lastChild as KeyedRowVNode | null)) || null;
      if (isDev && !inserted) {
        throw new Error('Failed to insert keyed loop row');
      }
      if (inserted) {
        anchor = inserted;
      }
    }
  }

  for (const leftover of oldByKey.values()) {
    vnode_remove(journal, parent, leftover, true);
  }
}
