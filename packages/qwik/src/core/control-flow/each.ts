import type { QRLInternal } from '../../server/qwik-types';
import type { JSXOutput } from '../shared/jsx/types/jsx-node';
import { tryGetInvokeContext } from '../use/use-core';
import { markVNodeDirty } from '../shared/vnode/vnode-dirty';
import { ChoreBits } from '../shared/vnode/enums/chore-bits.enum';
import { isServerPlatform } from '../shared/platform/platform';
import { component$ } from '../shared/component.public';
import { useTask$ } from '../use/use-task-dollar';
import { isServer } from '@qwik.dev/core/build';
import { SkipRender } from '../shared/jsx/utils.public';

export interface EachProps<T> {
  items: T[];
  item$: QRLInternal<(item: T) => JSXOutput>;
  key$: QRLInternal<(item: T, index: number) => string>;
}

/** @public */
export const Each = component$<EachProps<any>>((props) => {
  useTask$(async ({ track }) => {
    track(() => props.items);
    const context = tryGetInvokeContext()!;
    const host = context.$hostElement$!;
    const container = context.$container$!;
    markVNodeDirty(container, host, ChoreBits.RECONCILE);
    const isSsr = import.meta.env.TEST ? isServerPlatform() : isServer;
    if (isSsr) {
      await container.$renderPromise$;
    }
  });
  return SkipRender;
});
