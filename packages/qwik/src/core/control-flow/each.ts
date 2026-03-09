import type { QRLInternal } from '../../server/qwik-types';
import { component$, useTask$ } from '@qwik.dev/core';
import type { JSXOutput } from '../shared/jsx/types/jsx-node';
import { tryGetInvokeContext } from '../use/use-core';
import { markVNodeDirty } from '../shared/vnode/vnode-dirty';
import { ChoreBits } from '../shared/vnode/enums/chore-bits.enum';

export interface EachProps<T> {
  items: T[];
  item$: QRLInternal<(item: T) => JSXOutput>;
  key$: QRLInternal<(item: T, index: number) => string>;
}

/** @public */
export const Each = component$<EachProps<any>>(() => {
  useTask$(() => {
    const context = tryGetInvokeContext()!;
    const host = context.$hostElement$!;
    const container = context.$container$!;
    markVNodeDirty(container, host, ChoreBits.RECONCILE);
  });
  return null;
});
