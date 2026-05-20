import http from 'node:http';

/**
 * Wait until the Next.js dev server returns HTML (not just TCP open).
 */
export function waitForDevServer(url, { attempts = 90, intervalMs = 500 } = {}) {
  const target = new URL(url);

  return new Promise((resolve, reject) => {
    let tries = 0;

    const tick = () => {
      tries += 1;
      const req = http.get(
        {
          hostname: target.hostname,
          port: target.port || 80,
          path: target.pathname || '/',
          timeout: 3000,
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => {
            body += chunk;
          });
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 400 && body.includes('__next')) {
              resolve(true);
              return;
            }
            retry();
          });
        }
      );

      req.on('error', retry);
      req.on('timeout', () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (tries >= attempts) {
        reject(new Error(`Dev server not ready at ${url}`));
        return;
      }
      setTimeout(tick, intervalMs);
    };

    tick();
  });
}

export function normalizeDevUrl(url) {
  const parsed = new URL(url || 'http://127.0.0.1:3000/');
  if (!parsed.pathname || parsed.pathname === '') {
    parsed.pathname = '/';
  }
  if (!parsed.pathname.endsWith('/')) {
    parsed.pathname += '/';
  }
  return parsed.toString();
}
