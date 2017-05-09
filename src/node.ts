import { isString, mapObject } from "./util";

export const enum NodeFlag {
  Text     = 1,
  Html     = 2,
  Fun      = 4,
  Class    = 8,
  Template = 16,

  KeyedChildren   = 32,
  UnkeyedChildren = 64,

  Svg      = 128,
  Input    = 256,
  TextArea = 512,

  TypeMask = Text | Html | Fun | Class,
}

export type NodeChildren = VNode | VNode[];
export type Ref = (node: Node | null) => void;
export type Fun = (props: any) => VNode;
export type Key = string | number;
export type Con = { new(props: any): Component<any, any> }
export type Type = string | Fun | Con;
export type ClassNames = string | { [className: string]: boolean };

export interface Component<P, S> {
  props: P;
  state?: S;

  // Called when the component needs to re-render its contents.
  render(props: P, state: S): VNode | null;

  // Called after render() when this instance is initially mounted.
  onMount(): void;

  // Called when this instance is about to be removed.
  onUnmount(): void;

  // Called when the instance state changes.
  // This should re-render the component if needed and return the created node.
  onUpdate(newProps: P, newState: S): VNode | null;
}

export interface BaseProps {
  key?: Key;
  className?: string;
  children?: NodeChildren;
}

export interface VNode {
  // The currently mounted DOM element for this node.
  mount: Node | null;

  // Flags indicating the node type. This affects the types of other fields.
  flags: NodeFlag;
  
  // A function that is called with the DOM element when this node is mounted.
  // When unmounting it is called with null to prevent leaking the DOM element.
  ref: Ref | null;
  
  // An optional key to determine the position of children, 
  // allowing them to move without unmounting + mounting.
  key: Key | null;
  
  // The css class to set on the DOM element.
  className: string | null;

  // A set of properties. For Class/Fun types these are sent to the component, 
  // for Html types any valid element properties are applied to the DOM.
  props: any;
  
  // The type of this component, one of:
  // - A function(props) that returns a Node (when flags & Fun).
  // - A component class constructor (when flags & Class).
  // - The DOM tag name (when flags & Html).
  // - The node text content (when flags & Text).
  type: Type;

  // The parent node that created this one.
  parent: VNode | null;

  // This node's children - normally this contains a single VNode or array of VNodes.
  // For stateful components, this contains a reference to the Component instance;
  // the Node children are accessed through that instance.
  children: NodeChildren | Component<any, any>;
}

export function newNode<P>(
  flags: NodeFlag,
  type: Type,
  props: P,
  className?: ClassNames | null,
  children?: NodeChildren | null,
  key?: Key | null,
  ref?: Ref | null
): VNode {
  return {
    mount: null,
    flags: flags,
    ref: ref || null,
    key: key || null,
    className: className && buildClasses(className) || null,
    props: props || {},
    type: type,
    parent: null,
    children: children || [],
  };
}

export function newComponent<P>(
  type: Fun | Con,
  props: P,
  children?: NodeChildren | null,
  flags?: NodeFlag,
  className?: ClassNames | null,
  key?: Key | null,
  ref?: Ref | null
): VNode {
  const isComponent = (type as any).prototype && (type as any).prototype.render;
  flags = (flags || 0) | (isComponent ? NodeFlag.Class : NodeFlag.Fun);
  return newNode(flags, type, props, className, children, key, ref);
}

export function newHtml<P>(
  type: string,
  children?: NodeChildren,
  className?: ClassNames | null,
  flags?: NodeFlag,
  props?: P,
  key?: Key | null,
  ref?: Ref | null
): VNode {
  return newNode((flags || 0) | NodeFlag.Html, type, props, className, children, key, ref);
}

export function newTextNode(text: any, key?: Key): VNode {
  return newNode(NodeFlag.Text, text, null, null, null, key);
}

function buildClasses(names: ClassNames): string {
  if(isString(names)) return names as string;

  let nameString = "";
  mapObject<boolean>(names, (k, v) => {
    if(v) {
      nameString += k;
      nameString += " ";
    }
  });
  return nameString;
}