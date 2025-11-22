/**
 * Viewer Count Store
 *
 * Simple external store for viewer count state that can be used with useSyncExternalStore.
 * This store receives updates from the viewer worker and provides them to React components.
 */

type ViewerCountState = {
  count: number | null;
  updatedAt: number | null;
};

type Listener = () => void;

class ViewerCountStore {
  private state: ViewerCountState = {
    count: null,
    updatedAt: null,
  };

  private listeners = new Set<Listener>();

  getSnapshot(): ViewerCountState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  update(count: number, updatedAt: number): void {
    const previousCount = this.state.count;
    this.state = {
      count,
      updatedAt,
    };

    console.log(`[ViewerCountStore] Updated: ${previousCount} -> ${count} (listeners: ${this.listeners.size})`);

    // Notify all listeners
    this.listeners.forEach(listener => {
      listener();
    });
  }
}

// Singleton instance
export const viewerCountStore = new ViewerCountStore();
