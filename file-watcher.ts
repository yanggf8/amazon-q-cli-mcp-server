import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';

// Types for file change events
export interface FileChangeEvent {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
  path: string;
  stats?: fs.Stats;
  timestamp: Date;
}

export interface WatcherOptions {
  // Patterns to include (glob patterns)
  include?: string[];
  // Patterns to exclude (glob patterns)
  exclude?: string[];
  // Whether to watch subdirectories recursively
  recursive?: boolean;
  // Debounce delay in milliseconds to prevent rapid fire events
  debounceMs?: number;
  // Whether to emit initial scan events
  ignoreInitial?: boolean;
  // Custom polling interval for fallback polling (ms)
  pollingInterval?: number;
  // Use polling instead of native file system events
  usePolling?: boolean;
}

export class FileWatcher extends EventEmitter {
  private watchers: Map<string, fs.FSWatcher> = new Map();
  private fileStates: Map<string, fs.Stats> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private options: Required<WatcherOptions>;
  private isWatching = false;

  constructor(private watchPaths: string[], options: WatcherOptions = {}) {
    super();
    
    this.options = {
      include: options.include || ['**/*'],
      exclude: options.exclude || ['**/node_modules/**', '**/.git/**'],
      recursive: options.recursive ?? true,
      debounceMs: options.debounceMs ?? 100,
      ignoreInitial: options.ignoreInitial ?? false,
      pollingInterval: options.pollingInterval ?? 1000,
      usePolling: options.usePolling ?? false,
    };
  }

  /**
   * Start watching the specified paths
   */
  async start(): Promise<void> {
    if (this.isWatching) {
      throw new Error('Watcher is already running');
    }

    this.isWatching = true;

    try {
      // Initial scan if not ignoring initial events
      if (!this.options.ignoreInitial) {
        await this.performInitialScan();
      }

      // Start watching each path
      for (const watchPath of this.watchPaths) {
        await this.watchPath(watchPath);
      }

      this.emit('ready');
    } catch (error) {
      this.isWatching = false;
      throw error;
    }
  }

  /**
   * Stop watching and clean up resources
   */
  stop(): void {
    if (!this.isWatching) {
      return;
    }

    this.isWatching = false;

    // Close all watchers
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();

    // Clear debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Clear file states
    this.fileStates.clear();

    this.emit('close');
  }

  /**
   * Add a new path to watch
   */
  async addPath(watchPath: string): Promise<void> {
    if (!this.isWatching) {
      this.watchPaths.push(watchPath);
      return;
    }

    await this.watchPath(watchPath);
  }

  /**
   * Remove a path from watching
   */
  removePath(watchPath: string): void {
    const watcher = this.watchers.get(watchPath);
    if (watcher) {
      watcher.close();
      this.watchers.delete(watchPath);
    }

    this.watchPaths = this.watchPaths.filter(p => p !== watchPath);
  }

  /**
   * Check if a file path should be watched based on include/exclude patterns
   */
  private shouldWatch(filePath: string): boolean {
    const relativePath = path.relative(process.cwd(), filePath);
    
    // Check exclude patterns first
    for (const pattern of this.options.exclude) {
      if (this.matchesPattern(relativePath, pattern)) {
        return false;
      }
    }

    // Check include patterns
    for (const pattern of this.options.include) {
      if (this.matchesPattern(relativePath, pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Simple glob pattern matching (basic implementation)
   */
  private matchesPattern(filePath: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }

  /**
   * Perform initial scan of watch paths
   */
  private async performInitialScan(): Promise<void> {
    for (const watchPath of this.watchPaths) {
      await this.scanDirectory(watchPath, true);
    }
  }

  /**
   * Recursively scan a directory
   */
  private async scanDirectory(dirPath: string, isInitial = false): Promise<void> {
    try {
      const stats = await fs.promises.stat(dirPath);
      
      if (stats.isFile()) {
        if (this.shouldWatch(dirPath)) {
          this.fileStates.set(dirPath, stats);
          if (!isInitial) {
            this.emitEvent('add', dirPath, stats);
          }
        }
        return;
      }

      if (!stats.isDirectory()) {
        return;
      }

      const entries = await fs.promises.readdir(dirPath);
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        const entryStats = await fs.promises.stat(fullPath);
        
        if (entryStats.isDirectory()) {
          if (this.options.recursive) {
            await this.scanDirectory(fullPath, isInitial);
          }
        } else if (this.shouldWatch(fullPath)) {
          this.fileStates.set(fullPath, entryStats);
          if (!isInitial) {
            this.emitEvent('add', fullPath, entryStats);
          }
        }
      }
    } catch (error) {
      // Ignore errors for files that might have been deleted during scan
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.emit('error', error);
      }
    }
  }

  /**
   * Start watching a specific path
   */
  private async watchPath(watchPath: string): Promise<void> {
    try {
      const stats = await fs.promises.stat(watchPath);
      
      if (this.options.usePolling) {
        this.startPollingWatch(watchPath);
      } else {
        this.startNativeWatch(watchPath, stats.isDirectory());
      }
    } catch (error) {
      this.emit('error', new Error(`Failed to watch path ${watchPath}: ${error}`));
    }
  }

  /**
   * Start native file system watching
   */
  private startNativeWatch(watchPath: string, isDirectory: boolean): void {
    const watcher = fs.watch(watchPath, { recursive: this.options.recursive }, 
      (eventType, filename) => {
        if (!filename) return;
        
        const fullPath = path.resolve(watchPath, filename);
        this.handleFileSystemEvent(eventType, fullPath);
      });

    watcher.on('error', (error) => {
      this.emit('error', error);
    });

    this.watchers.set(watchPath, watcher);
  }

  /**
   * Start polling-based watching (fallback for systems without native support)
   */
  private startPollingWatch(watchPath: string): void {
    const poll = async () => {
      if (!this.isWatching) return;
      
      try {
        await this.scanDirectory(watchPath);
        setTimeout(poll, this.options.pollingInterval);
      } catch (error) {
        this.emit('error', error);
      }
    };

    poll();
  }

  /**
   * Handle file system events from native watcher
   */
  private async handleFileSystemEvent(eventType: string, filePath: string): Promise<void> {
    if (!this.shouldWatch(filePath)) {
      return;
    }

    try {
      const stats = await fs.promises.stat(filePath);
      const previousStats = this.fileStates.get(filePath);
      
      if (!previousStats) {
        // New file
        this.fileStates.set(filePath, stats);
        this.emitEvent('add', filePath, stats);
      } else if (stats.mtime > previousStats.mtime) {
        // Modified file
        this.fileStates.set(filePath, stats);
        this.emitEvent('change', filePath, stats);
      }
    } catch (error) {
      // File was deleted
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        const previousStats = this.fileStates.get(filePath);
        if (previousStats) {
          this.fileStates.delete(filePath);
          this.emitEvent('unlink', filePath);
        }
      } else {
        this.emit('error', error);
      }
    }
  }

  /**
   * Emit a file change event with debouncing
   */
  private emitEvent(type: FileChangeEvent['type'], filePath: string, stats?: fs.Stats): void {
    // Clear existing debounce timer
    const existingTimer = this.debounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounce timer
    const timer = setTimeout(() => {
      this.debounceTimers.delete(filePath);
      
      const event: FileChangeEvent = {
        type,
        path: filePath,
        stats,
        timestamp: new Date(),
      };

      this.emit('change', event);
      this.emit(type, event);
    }, this.options.debounceMs);

    this.debounceTimers.set(filePath, timer);
  }
}

// Usage example and utility functions
export class FileWatcherBuilder {
  private paths: string[] = [];
  private options: WatcherOptions = {};

  watch(path: string): this {
    this.paths.push(path);
    return this;
  }

  include(patterns: string[]): this {
    this.options.include = patterns;
    return this;
  }

  exclude(patterns: string[]): this {
    this.options.exclude = patterns;
    return this;
  }

  recursive(enabled = true): this {
    this.options.recursive = enabled;
    return this;
  }

  debounce(ms: number): this {
    this.options.debounceMs = ms;
    return this;
  }

  ignoreInitial(enabled = true): this {
    this.options.ignoreInitial = enabled;
    return this;
  }

  usePolling(enabled = true): this {
    this.options.usePolling = enabled;
    return this;
  }

  build(): FileWatcher {
    if (this.paths.length === 0) {
      throw new Error('At least one path must be specified');
    }
    return new FileWatcher(this.paths, this.options);
  }
}

// Convenience function to create a watcher
export function createWatcher(paths: string | string[], options?: WatcherOptions): FileWatcher {
  const pathArray = Array.isArray(paths) ? paths : [paths];
  return new FileWatcher(pathArray, options);
}
