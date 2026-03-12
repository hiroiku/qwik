import { _jsxSorted } from '@qwik.dev/core';
import { vnode_fromJSX } from '@qwik.dev/core/testing';
import { describe, expect, it } from 'vitest';
import { _flushJournal } from '../shared/cursor/cursor-flush';
import type { Cursor } from '../shared/cursor/cursor';
import type { ElementVNode } from '../shared/vnode/element-vnode';
import { reconcileKeyedLoopToParent } from './reconcile-keyed-loop';
import type { VNodeJournal } from './vnode-utils';

const createRow = (item: string) => _jsxSorted('b', { id: `row-${item}` }, null, item, 0, item);

describe('reconcile-keyed-loop', () => {
  it('should only move the swapped rows when an interior item moves near the end', async () => {
    const initialItems = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const nextItems = ['0', '8', '2', '3', '4', '5', '6', '7', '1', '9'];
    const { vNode, container } = vnode_fromJSX(
      _jsxSorted('test', {}, null, initialItems.map(createRow), 0, 'KA_root')
    );

    const journal: VNodeJournal = [];
    await reconcileKeyedLoopToParent(
      container,
      journal,
      vNode as ElementVNode,
      null as unknown as Cursor,
      nextItems,
      (item) => item,
      (item) => createRow(item)
    );

    expect(journal).toHaveLength(2);
    expect(vNode).toMatchVDOM(_jsxSorted('test', {}, null, nextItems.map(createRow), 0, 'KA_root'));

    _flushJournal(journal);

    expect(container.document.querySelectorAll('b')).toHaveLength(10);
    expect(
      Array.from(container.document.querySelectorAll('b')).map((node) => node.textContent)
    ).toEqual(nextItems);
  });
});
