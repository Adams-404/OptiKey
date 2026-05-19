import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { IncomingMessage, ServerResponse } from 'http';

function RemoteMousePlugin() {
  const clients: ServerResponse[] = [];
  
  return {
    name: 'remote-mouse-sse',
    configureServer(server: any) {
      server.middlewares.use('/api/mouse-stream', (req: IncomingMessage, res: ServerResponse) => {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        });
        
        clients.push(res);
        
        req.on('close', () => {
          const index = clients.indexOf(res);
          if (index !== -1) clients.splice(index, 1);
        });
      });

      server.middlewares.use('/api/mouse-send', (req: IncomingMessage, res: ServerResponse) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              clients.forEach(client => {
                client.write(`data: ${JSON.stringify(data)}\n\n`);
              });
              res.writeHead(200, { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*' 
              });
              res.end(JSON.stringify({ success: true }));
            } catch (e) {
              res.writeHead(400);
              res.end('Bad Request');
            }
          });
        } else {
          res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
          });
          res.end();
        }
      });
    }
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), RemoteMousePlugin()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâ€”file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api/groq': {
          target: 'https://api.groq.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/groq/, '')
        }
      }
    },
  };
});
