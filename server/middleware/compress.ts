import compression from 'compression';

// gzip for text responses (HTML, JS, CSS, JSON). The server sends the built files as they are, so without this a phone
// downloads the full 548 kB of first-load JavaScript and CSS instead of about 137 kB. The library only compresses
// compressible content types, so images and the animated GIF are left alone, and it respects `Cache-Control: no-transform`.
// Anything under 1 kB is sent as is, because the CPU time costs more than the bytes saved.
export const compressResponses = compression({ threshold: 1024 });
