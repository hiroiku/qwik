import { _jsxSorted, Fragment } from '@qwik.dev/core';
import { vnode_fromJSX } from '@qwik.dev/core/testing';
import { describe, it, expect } from 'vitest';
import { _flushJournal } from '../shared/cursor/cursor-flush';
import {
  DeleteOperation,
  RemoveAllChildrenOperation,
} from '../shared/vnode/types/dom-vnode-operation';
import type { ElementVNode } from '../shared/vnode/element-vnode';
import type { VirtualVNode } from '../shared/vnode/virtual-vnode';
import type { VNodeJournal } from './vnode-utils';
import { splitVNodeData, vnode_truncate } from './vnode-utils';

describe('splitVNodeData', () => {
  it('should split DOM element vNodeData and virtual element vNodeData', () => {
    const input = '||=6`4||2{J=7`3|q:type|S}';
    const { elementVNodeData, virtualVNodeData } = splitVNodeData(input);
    expect(elementVNodeData).toBe('=6`4');
    expect(virtualVNodeData).toBe('2{J=7`3|q:type|S}');
  });

  it('should handle escaped characters in custom block for DOM element', () => {
    const input =
      '|||aria\\-labelledby|34`32=82||{{1||13A`33=5@i8_1<35[36^37||q:type|C}E|q:type|P?10AB~}';
    const { elementVNodeData, virtualVNodeData } = splitVNodeData(input);
    expect(elementVNodeData).toBe('|aria\\-labelledby|34`32=82');
    expect(virtualVNodeData).toBe('{{1||13A`33=5@i8_1<35[36^37||q:type|C}E|q:type|P?10AB~}');
  });
});

describe('vnode_truncate', () => {
  it('should remove all element children with a single remove-all operation', () => {
    const { vNode } = vnode_fromJSX(
      _jsxSorted('div', {}, null, [_jsxSorted('b', {}, null, '1', 0, null)], 0, null)
    );
    const parent = vNode as ElementVNode;
    const firstChild = parent.firstChild!;
    const journal: VNodeJournal = [];

    vnode_truncate(journal, parent, firstChild, true);

    expect(journal).toHaveLength(1);
    expect(journal[0]).toBeInstanceOf(RemoveAllChildrenOperation);
    expect((journal[0] as RemoveAllChildrenOperation).target).toBe(parent.node);
    expect(parent.firstChild).toBeNull();
    expect(parent.lastChild).toBeNull();

    _flushJournal(journal);

    expect(parent.node?.innerHTML).toBe('');
  });

  it('should remove virtual children with a single remove-all operation when they are the only DOM children', () => {
    const { vNode } = vnode_fromJSX(
      _jsxSorted(
        'div',
        {},
        null,
        [_jsxSorted(Fragment, {}, null, [_jsxSorted('b', {}, null, '1', 0, null)], 0, null)],
        0,
        null
      )
    );
    const domParent = vNode as ElementVNode;
    const virtualParent = domParent.firstChild as VirtualVNode;
    const firstChild = virtualParent.firstChild!;
    const journal: VNodeJournal = [];

    vnode_truncate(journal, virtualParent, firstChild, true);

    expect(journal).toHaveLength(1);
    expect(journal[0]).toBeInstanceOf(RemoveAllChildrenOperation);
    expect((journal[0] as RemoveAllChildrenOperation).target).toBe(domParent.node);
    expect(virtualParent.firstChild).toBeNull();
    expect(virtualParent.lastChild).toBeNull();

    _flushJournal(journal);

    expect(domParent.node?.innerHTML).toBe('');
  });

  it('should fall back to deleting virtual children one by one when sibling DOM nodes remain', () => {
    const { vNode } = vnode_fromJSX(
      _jsxSorted(
        'div',
        {},
        null,
        [
          _jsxSorted('span', {}, null, 'before', 0, null),
          _jsxSorted(
            Fragment,
            {},
            null,
            [_jsxSorted('b', {}, null, '1', 0, null), _jsxSorted('b', {}, null, '2', 0, null)],
            0,
            null
          ),
          _jsxSorted('i', {}, null, 'after', 0, null),
        ],
        0,
        null
      )
    );
    const domParent = vNode as ElementVNode;
    const virtualParent = domParent.firstChild?.nextSibling as VirtualVNode;
    const firstChild = virtualParent.firstChild!;
    const journal: VNodeJournal = [];

    vnode_truncate(journal, virtualParent, firstChild, true);

    expect(journal).toHaveLength(2);
    expect(journal[0]).toBeInstanceOf(DeleteOperation);
    expect(journal[1]).toBeInstanceOf(DeleteOperation);
    expect(virtualParent.firstChild).toBeNull();
    expect(virtualParent.lastChild).toBeNull();

    _flushJournal(journal);

    expect(domParent.node?.innerHTML).toBe('<span>before</span><i>after</i>');
  });
});
