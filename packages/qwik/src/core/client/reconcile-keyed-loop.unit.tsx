import { _jsxSorted, Fragment } from '@qwik.dev/core';
import { vnode_fromJSX } from '@qwik.dev/core/testing';
import { describe, expect, it } from 'vitest';
import { _flushJournal } from '../shared/cursor/cursor-flush';
import type { Cursor } from '../shared/cursor/cursor';
import type { ElementVNode } from '../shared/vnode/element-vnode';
import { RemoveAllChildrenOperation } from '../shared/vnode/types/dom-vnode-operation';
import type { VirtualVNode } from '../shared/vnode/virtual-vnode';
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

  it('should append keyed rows without moving the existing prefix', async () => {
    const initialItems = ['0', '1', '2'];
    const nextItems = ['0', '1', '2', '3', '4'];
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

    expect(vNode).toMatchVDOM(_jsxSorted('test', {}, null, nextItems.map(createRow), 0, 'KA_root'));

    _flushJournal(journal);

    expect(container.document.querySelectorAll('b')).toHaveLength(5);
    expect(
      Array.from(container.document.querySelectorAll('b')).map((node) => node.textContent)
    ).toEqual(nextItems);
  });

  it('should not throw when moving keyed children inside a virtual parent', async () => {
    const initialItems = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const nextItems = ['0', '8', '2', '3', '4', '5', '6', '7', '1', '9'];
    const { vNode, container } = vnode_fromJSX(
      _jsxSorted(
        'table',
        {},
        null,
        [_jsxSorted(Fragment, {}, null, initialItems.map(createRow), 0, null)],
        0,
        'KA_root'
      )
    );
    const parent = (vNode as ElementVNode).firstChild as VirtualVNode;
    const journal: VNodeJournal = [];

    await reconcileKeyedLoopToParent(
      container,
      journal,
      parent,
      null as unknown as Cursor,
      nextItems,
      (item) => item,
      (item) => createRow(item)
    );

    expect(() => _flushJournal(journal)).not.toThrow();
    expect(container.document.querySelectorAll('b')).toHaveLength(10);
    expect(
      Array.from(container.document.querySelectorAll('b')).map((node) => node.textContent)
    ).toEqual(nextItems);
  });

  it('should remove keyed children inside a virtual parent with a single remove-all operation', async () => {
    const initialItems = ['0', '1', '2'];
    const { vNode, container } = vnode_fromJSX(
      _jsxSorted(
        'table',
        {},
        null,
        [_jsxSorted(Fragment, {}, null, initialItems.map(createRow), 0, null)],
        0,
        'KA_root'
      )
    );
    const parent = (vNode as ElementVNode).firstChild as VirtualVNode;
    const journal: VNodeJournal = [];

    await reconcileKeyedLoopToParent(
      container,
      journal,
      parent,
      null as unknown as Cursor,
      [],
      (item) => item,
      (item) => createRow(item)
    );

    expect(journal).toHaveLength(1);
    expect(journal[0]).toBeInstanceOf(RemoveAllChildrenOperation);
    expect((journal[0] as RemoveAllChildrenOperation).target).toBe((vNode as ElementVNode).node);

    _flushJournal(journal);

    expect(container.document.querySelectorAll('b')).toHaveLength(0);
    expect(container.document.querySelector('table')?.innerHTML).toBe('');
  });
});
