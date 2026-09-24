// Custom entry point for Plesk / Phusion Passenger Node.js
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV === 'development';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT, 10) || 3000;

// Initialize Next.js app with explicit directory
const app = next({ dev, dir: __dirname, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request:', req.url, err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Next.js Server running on port ${port} (mode: ${dev ? 'development' : 'production'})`);
  });
}).catch((err) => {
  console.error('Failed to start Next.js server:', err);
  process.exit(1);
});
