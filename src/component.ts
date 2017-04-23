import { Component as IComponent, VNode, BaseProps } from "./node";
import { shallowEquals, mapObject, assignObject } from "./util";

export class Component<P, S> implements IComponent<P, S> {
  state?: S;
  props: P;

  constructor(props: P) {
    this.props = props;
  }

  onMount() {}
  onUnmount() {}

  shouldUpdate(newProps: P, newState: S): boolean {
    return newState !== this.state || !shallowEquals(newProps, this.props);
  }

  onUpdate(newProps: P, newState: S): VNode | null {
    return update(this, newProps, newState, false);
  }

  forceUpdate() {
    applyState(this, this.state, true);
  }

  setState(newState: S) {
    applyState(this, newState, false);
  }

  render(props: P, state: S): VNode | null {
    return null;
  }
}

function update<P, S>(component: Component<P, S>, newProps: P & BaseProps, newState: S, force: boolean): VNode | null {
  const oldProps = component.props;
  const oldState = component.state;
  const sameProps = oldProps === newProps;
  const sameState = oldState === newState;
  const shouldUpdate = (!(sameProps && sameState) && component.shouldUpdate(newProps, newState)) || force;

  component.props = newProps;
  component.state = newState;

  if(shouldUpdate) {
    return component.render(newProps, newState);
  } else {
    return null;
  }
}

function patch() {}

function applyState<P, S>(component: Component<P, S>, newState: S, force: boolean) {
  const props = component.props;
  const oldState = component.state;
  if(oldState !== newState) {
    mapObject(oldState, (k, v) => {
      if(!newState.hasOwnProperty(k)) {
        (newState as any)[k] = v;
      }
    });
  }

  if(update(component, props, newState, force)) {
    const node = component.render(props, newState);
    patch();
  }
}