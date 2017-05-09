import { 
  VNode, NodeFlag, NodeChild, NodeChildren, Fun, Con, ClassNames, Component, 
  newTextNode 
} from "./node";

import { isString, isArray, isNode } from "./util";

interface ComponentPrivate extends Component<any, any> {
  _mounted: boolean;
  _content: VNode;
}

//-------------------------------------------------------------------------------------
// Rendering
//-------------------------------------------------------------------------------------

export function render(what: VNode, where: Node) {
  mount(what, where, false);
}

//-------------------------------------------------------------------------------------
// Mounting
//-------------------------------------------------------------------------------------

function mount(node: VNode, parent: Node | null, isSVG: boolean): Node {
  const flags = node.flags;
  const children = node.children;
  const type = node.type;
  const props = node.props;
  
  let element: Node | null = null;
  let component: ComponentPrivate | null = null;

  if(flags & NodeFlag.Html) {
    element = mountHtml(
      type as string, 
      node.className, 
      props, 
      children as NodeChildren, 
      isSVG || !!(flags & NodeFlag.Svg)
    );
  } else if(flags & NodeFlag.Fun) {
    /*
     * For function nodes we instantiate the function, then recursively mount the result.
     */
    const content = (type as Fun)(props) || newTextNode("");
    element = mount(content, null, isSVG);
    node.children = content;
  } else if(flags & NodeFlag.Class) {
    /*
     * Class nodes are the most complex case, since we need to handle the lifecycle.
     * Luckily, most of this is handled by the component implementation - 
     * for the initial mount we just have to setup the correct values.
     */
    component = (new (type as Con)(props)) as ComponentPrivate;
    component._mounted = false;
    const content = component.render(component.props, component.state) || newTextNode("");
    component._content = content;

    element = mount(content, null, isSVG);
    node.children = component;
  } else {
    /*
     * Aside from text content, text nodes are used to handle "problems" where we don't know what to do.
     * TODO: In development mode, perform input checking and throw exceptions if needed.
     */
    element = document.createTextNode(type as string);
  }

  // Add the resulting data to the nodes and DOM.
  node.mount = element;
  if(parent) {
    parent.appendChild(element);
  }

  const ref = node.ref;
  if(ref) {
    ref(element);
  }

  if(component) {
    component._mounted = true;
    component.onMount();
  }

  return element;
}

const svgNamespace = 'http://www.w3.org/2000/svg';

function mountHtml(
  type: string,
  className: string | null,
  props: any,
  children: NodeChildren,
  isSVG: boolean
): Node {
  /*
   * For HTML nodes we instanciate the node as a DOM element.
   * After that we recursively instantiate its children.
   */

  // Create the base DOM element to modify.
  const element = isSVG ? document.createElementNS(svgNamespace, type as string) : document.createElement(type as string);

  // Instantiate the node children.
  if(isArray(children)) {
    mountChildArray(children as NodeChild[], element, isSVG);
  } else if(children) {
    // As an optimization, we directly set the element textContent if there is a single text child.
    if(!isNode(children)) {
      element.textContent = children as string;
    } else if((children as VNode).flags & NodeFlag.Text) {
      element.textContent = (children as VNode).type as string;
    } else {
      mount(children as VNode, element, isSVG);
    }
  }

  // Set the node properties.
  if(className) {
    if(isSVG) {
      element.setAttribute("class", className);
    } else {
      element.className = className;
    }
  }

  for(let key in props) {
    updateAttribute(key, null, props[key], element as HTMLElement, isSVG);
  }

  return element;
}

function mountChild(child: VNode | string, element: Node, isSVG: boolean) {
  // As an optimization, we directly set the element textContent if there is a single text child.
  if(isString(child)) {
    element.textContent = child as string;
  } else if((child as VNode).flags & NodeFlag.Text) {
    element.textContent = (child as VNode).type as string;
  } else {
    mount(child as VNode, element, isSVG);
  }
}

function mountChildArray(children: NodeChild[], element: Node, isSVG: boolean) {
  for(let i = 0; i < children.length; i++) {
    let child = children[i];
    if(!isNode(child)) child = newTextNode(child);

    mount(child as VNode, element, isSVG);
  }
}

//-------------------------------------------------------------------------------------
// Updating
//-------------------------------------------------------------------------------------

export function updateComponent(from: Component<any, any>, to: VNode) {
  updateClass(
    (from as ComponentPrivate)._content,
    to,
    (((from as ComponentPrivate)._content.mount as Node).parentNode as Node),
    false
  );
}

export function update(from: VNode, to: VNode, parent: Node, isSVG: boolean) {
  if(from === to) return;

  const flags = to.flags;
  const fromKind = from.flags & NodeFlag.TypeMask;
  const toKind = flags & NodeFlag.TypeMask;

  const fromType = from.type;
  const toType = to.type;
  const fromKey = from.key;
  const toKey = to.key;

  // For each node kind, we check if it can be updated in-place.
  // If the kinds are different or the cannot by updated in-place, we replace the node.
  if(fromKind === toKind) {
    if(flags & NodeFlag.Class && fromType === toType && fromKey === toKey) {
      return updateClass(from, to, parent, isSVG);
    } else if(flags & NodeFlag.Fun && fromType === toType && fromKey === toKey) {
      return updateFun(from, to, parent, isSVG);
    } else if(flags & NodeFlag.Html && fromType === toType) {
      return updateHtml(from, to, parent, isSVG);
    } else {
      const mount = from.mount;
      to.mount = mount;
      if(flags & NodeFlag.Text && fromType !== toType) {
        (mount as Node).nodeValue = toType as string;
      }
      return;
    }
  }
  
  replaceNode(from, to, parent, isSVG);
}

function updateHtml(from: VNode, to: VNode, parent: Node, isSVG: boolean) {
  const oldChildren = from.children;
  const newChildren = to.children;
  const oldProps = from.props;
  const newProps = to.props;
  const oldClass = from.className;
  const newClass = to.className;
  const oldFlags = from.flags;
  const newFlags = to.flags;

  const element = from.mount as HTMLElement;
  to.mount = element;

  isSVG = isSVG || !!(newFlags & NodeFlag.Svg);
  
  if(oldChildren !== newChildren) {
    updateChildren(oldChildren, newChildren, oldFlags, newFlags, element, isSVG);
  }

  if(oldProps !== newProps) {
    for(let key in newProps) {
      updateAttribute(key, oldProps[key], newProps[key], element, isSVG);
    }

    for(let key in oldProps) {
      if(newProps[key] == null) {
        removeAttribute(key, element);
      }
    }
  }

  if(oldClass !== newClass) {
    if(newClass == null) {
      element.removeAttribute("class");
    } else if(isSVG) {
      element.setAttribute("class", newClass);
    } else {
      element.className = newClass;
    }
  }
}

function updateFun(from: VNode, to: VNode, parent: Node, isSVG: boolean) {

}

function updateClass(from: VNode, to: VNode, parent: Node, isSVG: boolean) {

}

function updateChildren(oldChildren: any, newChildren: any, oldFlags: NodeFlag, newFlags: NodeFlag, element: HTMLElement, isSVG: boolean) {
  if(newFlags & NodeFlag.UnkeyedChildren) {
    updateUnkeyed(oldChildren, newChildren, element, isSVG);
  } else if((newFlags & NodeFlag.KeyedChildren) && (oldFlags & NodeFlag.KeyedChildren)) {
    updateKeyed(oldChildren, newChildren, element, isSVG);
  } else if(newChildren == null) {
    unmountChildren(oldChildren, element);
  } else if(isArray(newChildren)) {
    if(isArray(oldChildren)) {
      if(isKeyed(oldChildren, newChildren)) {
        updateKeyed(oldChildren, newChildren, element, isSVG);
      } else {
        updateUnkeyed(oldChildren, newChildren, element, isSVG);
      }
    } else {
      unmountChildren(oldChildren, element);
      mountChildArray(newChildren, element, isSVG);
    }
  } else if(isNode(newChildren)) {
    if(isNode(oldChildren)) {
      update(oldChildren, newChildren, element, isSVG);
    } else {
      unmountChildren(oldChildren, element);
      mount(newChildren, element, isSVG);
    }
  } else {
    if(oldChildren == null || isArray(oldChildren) || isNode(oldChildren)) {
      unmountChildren(oldChildren, element);
    }

    element.textContent = newChildren;
  }
}

function updateUnkeyed(oldChildren: VNode[], newChildren: VNode[], element: HTMLElement, isSVG: boolean) {
  const oldCount = oldChildren.length;
  const newCount = newChildren.length;
  const commonCount = newCount > oldCount ? oldCount : newCount;

  for(let i = 0; i < commonCount; i++) {
    update(oldChildren[i], newChildren[i], element, isSVG);
  }

  if(oldCount !== newCount) {
    if(newCount > oldCount) {
      for(let i = oldCount; i < newCount; i++) {
        mount(newChildren[i], element, isSVG);
      }
    } else {
      for(let i = newCount; i < oldCount; i++) {
        unmount(oldChildren[i], element);
      }
    }
  }
}

function updateKeyed(oldChildren: VNode[], newChildren: VNode[], element: HTMLElement, isSVG: boolean) {
  const oldCount = oldChildren.length;
  const newCount = newChildren.length;

  if(oldCount === 0) {
    if(newCount > 0) {
      mountChildArray(newChildren, element, isSVG);
    }
    return;
  } else if(newCount === 0) {
    unmountChildren(oldChildren, element);
    return;
  }

  let oldUpper = oldCount - 1;
  let newUpper = newCount - 1;
  let oldLower = 0;
  let newLower = 0;
  let oldFirst = oldChildren[0];
  let newFirst = newChildren[0];
  let oldLast = oldChildren[oldUpper];
  let newLast = newChildren[newUpper];

  // Update the child contents from oldChildren to newChildren without
  // recreating any keyed nodes that exist in both.
  // Any change in the position of nodes is detected and the nodes are moved instead.
  updateLoop: while(true) {
    // Update nodes upwards until we find a changed key.
    while(oldFirst.key === newFirst.key) {
      update(oldFirst, newFirst, element, isSVG);
      oldLower++;
      newLower++;
      if(oldLower > oldUpper || newLower > newUpper) break updateLoop;

      oldFirst = oldChildren[oldLower];
      newFirst = newChildren[newLower];
    }

    // Update nodes downwards until we find a changed key.
    while(oldLast.key === newLast.key) {
      update(oldLast, newLast, element, isSVG);
      oldUpper--;
      newUpper--;
      if(oldUpper < oldLower || newUpper < newLower) break updateLoop;

      oldLast = oldChildren[oldUpper];
      newLast = newChildren[newUpper];
    }

    // We now have a range of nodes somewhere in the middle of the array 
    // that may have been added, removed or moved round.
    // TODO: Handle easy cases of moving nodes around here.
    break;
  }

  if(oldLower > oldUpper && newLower <= newUpper) {
    // Elements were added to the end of the array.
    while(newLower <= newUpper) {
      const node = newChildren[newLower];
      newLower++;
      mount(node, element, isSVG);
    }
  } else if(newLower > newUpper) {
    // Elements were removed from the end of the array.
    while(oldLower < oldUpper) {
      unmount(oldChildren[oldLower], element);
      oldLower++;
    }
  } else {
    // TODO: Handle changes in the middle of the array.
  }
}

function updateAttribute(key: string, oldValue: any, newValue: any, element: HTMLElement, isSVG: boolean) {
  if(oldValue === newValue) return;

  if(newValue == null) {
    removeAttribute(key, element);
  } else if(key === "style") {
    updateStyle(oldValue, newValue, element);
  } else {
    element.setAttribute(key, newValue);
  }
}

function removeAttribute(key: string, element: HTMLElement) {
  if(key === "value") {
    element.nodeValue = "";
  } else {
    element.removeAttribute(key);
  }
}

function updateStyle(oldValue: any, newValue: any, element: HTMLElement) {
  const style = element.style;
  for(let key in newValue) {
    style.setProperty(key, newValue[key]);
  }

  if(oldValue) {
    for(let key in oldValue) {
      if(!(key in newValue)) {
        style.removeProperty(key);
      }
    }
  }
}

//-------------------------------------------------------------------------------------
// Unmounting
//-------------------------------------------------------------------------------------

function unmount(node: VNode, parent: Node | null) {
  const flags = node.flags;
  const ref = node.ref;
  const children = node.children;

  // We always unmount the children without a parent element.
  // Unmounting the base element already removes the whole subtree, 
  // so removing children recursively would only slow everything down.
  // However, we obviously still need to unmount any stateful components in the tree.
  if(flags & NodeFlag.Class) {
    const instance = children as ComponentPrivate;
    if(instance._mounted) {
      instance.onUnmount();
      instance._mounted = false;
    }

    unmount(instance._content, null);
  } else if(flags & NodeFlag.Fun) {
    unmount(children as VNode, null);
  } else if(flags & NodeFlag.Html) {
    if(isArray(children)) {
      for(let i = 0; i < (children as VNode[]).length; i++) {
        unmount((children as VNode[])[i], null);
      }
    } else {
      unmount(children as VNode, null);
    }
  }

  if(ref) {
    ref(null);
  }

  if(parent) {
    parent.removeChild(node.mount as Node);
  }
}

function unmountChildren(children: any, element: Node) {
  if(children && isNode(children)) {
    unmount(children, element);
  } else {
    element.textContent = "";

    if(isArray(children)) {
      for(let i = 0; i < children.length; i++) {
        const child = children[i];
        if(child) unmount(child, element);
      }
    }
  }
}

//-------------------------------------------------------------------------------------
// Helper functions
//-------------------------------------------------------------------------------------

function replaceNode(from: VNode, to: VNode, parent: Node, isSVG: boolean) {
  unmount(from, null);
  const toElement = mount(to, null, isSVG);
  to.mount = toElement;
  replaceElement(parent, toElement, from.mount as Node);
}

function replaceElement(parent: Node | null, from: Node, to: Node) {
  (parent || from.parentNode as Node).replaceChild(to, from);
}

function isKeyed(oldChildren: VNode[], newChildren: VNode[]): boolean {
  if(oldChildren.length === 0 || newChildren.length === 0) return false;
  
  const firstOld = oldChildren[0];
  const firstNew = newChildren[0];
  return firstOld != null && firstNew != null && firstOld.key != null && firstNew.key != null;
}