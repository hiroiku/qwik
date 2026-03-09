import { domRender, ssrRenderToDom } from '@qwik.dev/core/testing';
import { describe, expect, it } from 'vitest';
import { component$, Fragment, Fragment as Component } from '@qwik.dev/core';
import { Each } from '../control-flow/each';

const debug = false; //true;
Error.stackTraceLimit = 100;

describe.each([
  { render: ssrRenderToDom }, //
  { render: domRender }, //
])('$render.name: loops', ({ render }) => {
  it('should render each item', async () => {
    const Cmp = component$(() => {
      return (
        <Each
          items={['a', 'b', 'c']}
          key$={(item) => item}
          item$={(item) => <div>Hello {item}</div>}
        />
      );
    });
    const { vNode } = await render(<Cmp />, { debug });
    expect(vNode).toMatchVDOM(
      <Component>
        <Component>
          <Fragment>
            <div>Hello a</div>
          </Fragment>
          <Fragment>
            <div>Hello b</div>
          </Fragment>
          <Fragment>
            <div>Hello c</div>
          </Fragment>
        </Component>
      </Component>
    );
  });
});
