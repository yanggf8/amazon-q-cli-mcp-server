import { FileWatcher, FileWatcherBuilder, createWatcher, FileChangeEvent } from './file-watcher';

// Example 1: Basic usage
async function basicExample() {
  console.log('=== Basic File Watcher Example ===');
  
  const watcher = createWatcher('./src', {
    include: ['**/*.ts', '**/*.js'],
    exclude: ['**/node_modules/**', '**/*.test.ts'],
    debounceMs: 200,
  });

  // Listen for all file changes
  watcher.on('change', (event: FileChangeEvent) => {
    console.log(`File ${event.type}: ${event.path} at ${event.timestamp.toISOString()}`);
  });

  // Listen for specific event types
  watcher.on('add', (event: FileChangeEvent) => {
    console.log(`New file added: ${event.path}`);
  });

  watcher.on('unlink', (event: FileChangeEvent) => {
    console.log(`File deleted: ${event.path}`);
  });

  // Handle errors
  watcher.on('error', (error: Error) => {
    console.error('Watcher error:', error.message);
  });

  // Start watching
  try {
    await watcher.start();
    console.log('Watcher started successfully');
    
    // Stop after 30 seconds for demo
    setTimeout(() => {
      watcher.stop();
      console.log('Watcher stopped');
    }, 30000);
  } catch (error) {
    console.error('Failed to start watcher:', error);
  }
}

// Example 2: Using the builder pattern
async function builderExample() {
  console.log('=== Builder Pattern Example ===');
  
  const watcher = new FileWatcherBuilder()
    .watch('./src')
    .watch('./config')
    .include(['**/*.ts', '**/*.json', '**/*.yaml'])
    .exclude(['**/node_modules/**', '**/.git/**', '**/*.log'])
    .recursive(true)
    .debounce(300)
    .ignoreInitial(false)
    .build();

  watcher.on('change', (event: FileChangeEvent) => {
    console.log(`[${event.type.toUpperCase()}] ${event.path}`);
    
    // Example: Trigger different actions based on file type
    const ext = event.path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
        console.log('  → TypeScript file changed, consider recompiling');
        break;
      case 'json':
        console.log('  → Configuration file changed, consider reloading');
        break;
      case 'yaml':
        console.log('  → YAML file changed, consider validating');
        break;
    }
  });

  await watcher.start();
}

// Example 3: Advanced usage with custom processing
async function advancedExample() {
  console.log('=== Advanced File Watcher Example ===');
  
  const watcher = createWatcher(['./src', './tests'], {
    include: ['**/*.ts'],
    exclude: ['**/*.d.ts', '**/node_modules/**'],
    debounceMs: 500,
    recursive: true,
  });

  // Track file statistics
  const fileStats = {
    added: 0,
    changed: 0,
    deleted: 0,
  };

  watcher.on('add', (event: FileChangeEvent) => {
    fileStats.added++;
    console.log(`✅ Added: ${event.path}`);
    logStats();
  });

  watcher.on('change', (event: FileChangeEvent) => {
    fileStats.changed++;
    console.log(`📝 Changed: ${event.path}`);
    
    // Example: Check file size
    if (event.stats && event.stats.size > 1024 * 1024) {
      console.log(`  ⚠️  Large file detected: ${(event.stats.size / 1024 / 1024).toFixed(2)}MB`);
    }
    
    logStats();
  });

  watcher.on('unlink', (event: FileChangeEvent) => {
    fileStats.deleted++;
    console.log(`🗑️  Deleted: ${event.path}`);
    logStats();
  });

  watcher.on('ready', () => {
    console.log('🚀 File watcher is ready and monitoring changes...');
  });

  watcher.on('error', (error: Error) => {
    console.error('❌ Watcher error:', error.message);
  });

  function logStats() {
    console.log(`📊 Stats - Added: ${fileStats.added}, Changed: ${fileStats.changed}, Deleted: ${fileStats.deleted}`);
  }

  await watcher.start();
}

// Example 4: Hot reload simulation
async function hotReloadExample() {
  console.log('=== Hot Reload Simulation Example ===');
  
  const watcher = createWatcher('./src', {
    include: ['**/*.ts', '**/*.js'],
    exclude: ['**/*.test.*', '**/node_modules/**'],
    debounceMs: 1000, // Longer debounce for compilation
  });

  let isReloading = false;

  watcher.on('change', async (event: FileChangeEvent) => {
    if (isReloading) {
      console.log('⏳ Reload already in progress, skipping...');
      return;
    }

    console.log(`🔄 File changed: ${event.path}`);
    console.log('🔨 Starting hot reload...');
    
    isReloading = true;
    
    try {
      // Simulate compilation/build process
      await simulateCompilation();
      
      // Simulate server restart
      await simulateServerRestart();
      
      console.log('✅ Hot reload completed successfully');
    } catch (error) {
      console.error('❌ Hot reload failed:', error);
    } finally {
      isReloading = false;
    }
  });

  async function simulateCompilation(): Promise<void> {
    console.log('  📦 Compiling TypeScript...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('  ✅ Compilation complete');
  }

  async function simulateServerRestart(): Promise<void> {
    console.log('  🔄 Restarting server...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('  ✅ Server restarted');
  }

  await watcher.start();
}

// Example 5: Multiple watchers with different configurations
async function multipleWatchersExample() {
  console.log('=== Multiple Watchers Example ===');
  
  // Watcher for source code
  const sourceWatcher = createWatcher('./src', {
    include: ['**/*.ts'],
    exclude: ['**/*.test.ts'],
    debounceMs: 200,
  });

  // Watcher for configuration files
  const configWatcher = createWatcher(['./config', './package.json'], {
    include: ['**/*.json', '**/*.yaml', '**/*.yml'],
    debounceMs: 500,
  });

  // Watcher for documentation
  const docsWatcher = createWatcher('./docs', {
    include: ['**/*.md'],
    debounceMs: 1000,
  });

  sourceWatcher.on('change', (event: FileChangeEvent) => {
    console.log(`🔧 Source code ${event.type}: ${event.path}`);
  });

  configWatcher.on('change', (event: FileChangeEvent) => {
    console.log(`⚙️  Configuration ${event.type}: ${event.path}`);
  });

  docsWatcher.on('change', (event: FileChangeEvent) => {
    console.log(`📚 Documentation ${event.type}: ${event.path}`);
  });

  // Start all watchers
  await Promise.all([
    sourceWatcher.start(),
    configWatcher.start(),
    docsWatcher.start(),
  ]);

  console.log('All watchers started successfully');

  // Cleanup function
  const cleanup = () => {
    sourceWatcher.stop();
    configWatcher.stop();
    docsWatcher.stop();
    console.log('All watchers stopped');
  };

  // Handle process termination
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

// Run examples
async function runExamples() {
  try {
    // Uncomment the example you want to run
    await basicExample();
    // await builderExample();
    // await advancedExample();
    // await hotReloadExample();
    // await multipleWatchersExample();
  } catch (error) {
    console.error('Example failed:', error);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  runExamples();
}

export {
  basicExample,
  builderExample,
  advancedExample,
  hotReloadExample,
  multipleWatchersExample,
};
