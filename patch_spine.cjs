const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// Update MOTION.spine.stops
html = html.replace(
  'stops: [0.15, 0.30, 0.48, 0.68, 0.90]',
  'stops: [0.15, 0.30, 0.48, 0.68, 0.82, 0.94]'
);

// Add spine5 to spinePipsList
html = html.replace(
  "document.getElementById('spine4')",
  "document.getElementById('spine4'),\n    document.getElementById('spine5')"
);

fs.writeFileSync('index.html', html, 'utf8');
