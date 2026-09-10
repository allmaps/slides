import type { Plugin, PreviewServer, ViteDevServer } from 'vite';

// Self-contained resources for trying the packed component in a browser.
export function iiifFixture(): Plugin {
  function configure(server: ViteDevServer | PreviewServer) {
    server.middlewares.use((request, response, next) => {
      const origin = `http://${request.headers.host}`;
      const image = `${origin}/image`;
      let resource: unknown;
      if (request.url === '/image/info.json') {
        resource = {
          '@context': 'http://iiif.io/api/image/3/context.json',
          id: image, type: 'ImageService3', profile: 'level0', width: 300, height: 200,
          sizes: [{ width: 300, height: 200 }]
        };
      } else if (request.url === '/manifest.json') {
        const canvas = `${origin}/canvas/1`;
        resource = {
          '@context': 'http://iiif.io/api/presentation/3/context.json',
          id: `${origin}/manifest.json`, type: 'Manifest',
          items: [{ id: canvas, type: 'Canvas', width: 300, height: 200,
            items: [{ id: `${origin}/page/1`, type: 'AnnotationPage', items: [{
              id: `${origin}/annotation/1`, type: 'Annotation', motivation: 'painting', target: canvas,
              body: { id: `${image}/full/max/0/default.jpg`, type: 'Image', format: 'image/jpeg', width: 300, height: 200,
                service: [{ id: image, type: 'ImageService3', profile: 'level0' }] }
            }] }]
          }]
        };
      } else return next();
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify(resource));
    });
  }
  return { name: 'iiif-consumer-fixture', configureServer: configure, configurePreviewServer: configure };
}
