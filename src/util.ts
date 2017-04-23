
export function isString(it: any): boolean { return typeof it === "string"; }
export function isArray(it: any): boolean { return Array.isArray(it); }
export function isNull(it: any): boolean { return it === null; }
export function isUndefined(it: any): boolean { return it === undefined; }

export function isNode(it: any): boolean { return !!it.type; }

export function mapObject<T>(it: any, f: (k: string, v: T) => void) {
  for(let key in it) {
    if(it.hasOwnProperty(key)) {
      f(key, it[key])
    }
  }
}

export function assignObject(to: any, from: any): any {
  mapObject(from, (k, v) => {
    to[k] = v;
  });
  return to;
}

export function shallowEquals(a: any, b: any): boolean {
  if(a === b) return true;
  if(isArray(a)) return shallowEqualsArray(a, b);

  const aType = typeof a;
  if(aType !== "function" && aType !== "object") return false;

  return shallowEqualsObject(a, b);
}

function shallowEqualsArray(a: any[], b: any[]): boolean {
  const length = a.length;
  if(length !== b.length) return false;

  for(let i = 0; i < length; i++) {
    if(a[i] !== b[i]) return false;
  }

  return true;
}

function shallowEqualsObject(a: any, b: any): boolean {
  let aCount = 0, bCount = 0;

  for(let key in a) {
    if(a.hasOwnProperty(key)) {
      aCount++;
      if(a[key] !== b[key]) return false;
    }
  }

  for(let key in b) {
    if(b.hasOwnProperty(key)) {
      bCount++;
    }
  }

  return aCount === bCount;
}