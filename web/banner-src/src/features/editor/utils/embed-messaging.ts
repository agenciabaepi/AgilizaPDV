/** Serializa dados Vue/Pinia para postMessage e persistência. */
export function clonePlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function postToParent(data: unknown): void {
  window.parent.postMessage(clonePlain(data), '*')
}

export function isParentMessage(event: MessageEvent): boolean {
  return event.source === window.parent
}
