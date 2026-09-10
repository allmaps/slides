import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { iiifFixture } from './iiif-fixture';

function auditViewerBundle(): Plugin {
  return {
    name: 'audit-viewer-bundle',
    generateBundle(_, bundle) {
      const modules = [...this.getModuleIds()];
      if (modules.some(id => /node_modules\/(react|react-dom|react-reconciler|preact)\//.test(id))) {
        this.error('React or Preact entered the consumer bundle');
      }
      if (!modules.some(id => id.includes('@atlas-viewer/atlas/dist/standalone'))) {
        this.error('The consumer build did not exercise Atlas');
      }
      const initialModules = new Set<string>();
      const visit = (name: string) => {
        const chunk = bundle[name];
        if (!chunk || chunk.type !== 'chunk' || initialModules.has(name)) return;
        initialModules.add(name);
        if (Object.keys(chunk.modules).some(id => id.includes('@atlas-viewer/atlas/') || id.includes('@iiif/helpers/'))) {
          this.error('IIIF runtime was eagerly bundled into the initial entry');
        }
        chunk.imports.forEach(visit);
      };
      for (const chunk of Object.values(bundle)) if (chunk.type === 'chunk' && chunk.isEntry) visit(chunk.fileName);
    }
  };
}

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [svelte(), iiifFixture(), ...isSsrBuild ? [] : [auditViewerBundle()]],
  ssr: { noExternal: ['@allmaps/svelte-canvas-panel', '@lucide/svelte'] },
  build: { outDir: isSsrBuild ? 'dist-ssr' : 'dist' }
}));
