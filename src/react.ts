import { isString, shallowEquals, mapObject, assignObject } from "./util";
import { newNode, VNode, Component as BaseComponent, BaseProps, NodeFlag, NodeChildren } from "./node";

export function createElement(type: any, props?: any, ...children: any[]): VNode {
  let flags;
  if(isString(type)) {
    flags = NodeFlag.Html;
  } else if(type.prototype && type.prototype.render) {
    flags = NodeFlag.Class;
  } else {
    flags = NodeFlag.Fun;
  }

  const className = props.className || null;
  const key = props.key || null;
  const ref = props.ref || null;

  delete props.className;
  delete props.key;
  delete props.ref;

  return newNode(flags, type, props, className, children.length === 1 ? children[0] : children, key, ref);
}

export function createClass(how: any) {
  const constructor = function(this: any, props: any) {
    this.props = props;
    if(this.getInitialState) {
      this.state = this.getInitialState();
    }
  };

  mapObject(how, (k, v) => {
    constructor.prototype[k] = v;
  });

  return constructor;
}

export class Component<P, S> implements BaseComponent<P, S> {
  props: P & BaseProps;
  state: S;

  componentDidMount?(): void;
	componentWillMount?(): void;
	componentWillReceiveProps?(newProps: P): void;
  componentWillUpdate?(newProps: P, newState: S): void;
	componentDidUpdate?(oldProps: P, oldState: S): void;
	componentWillUnmount?(): void;

  constructor(props: P & BaseProps) {
    this.props = props;
  }

  forceUpdate() {
    applyState(this, this.state, true);
  }

  setState(newState: S) {
    applyState(this, newState, false);
  }

  shouldComponentUpdate(newProps: P, newState: S): boolean {
    return newState !== this.state || !shallowEquals(newProps, this.props);
  }

  onMount() {
    this.componentDidMount && this.componentDidMount();
  }

  onUnmount() {
    this.componentWillUnmount && this.componentWillUnmount();
  }

  onUpdate(newProps: P, newState: S): VNode | null {
    return update(this, newProps, newState, false);
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

  if(!sameProps && component.componentWillReceiveProps) component.componentWillReceiveProps(newProps);

  const shouldUpdate = (!(sameProps && sameState) && component.shouldComponentUpdate(newProps, newState)) || force;
  if(shouldUpdate && component.componentWillUpdate) component.componentWillUpdate(newProps, newState);

  component.props = newProps;
  component.state = newState;

  if(shouldUpdate) {
    return component.render(newProps, newState);
  } else {
    return null;
  }
}

function patch() {

}

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
    if(component.componentDidUpdate) component.componentDidUpdate(props, oldState);
  }
}