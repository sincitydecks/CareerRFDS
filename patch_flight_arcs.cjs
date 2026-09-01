const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace('/* CONTINUOUS SCROLL PHYSICS OVERRIDES */', '/* CONTINUOUS SCROLL PHYSICS OVERRIDES */\n#rfds-app .flight-arc { transition: none !important; }');
fs.writeFileSync('index.html', html, 'utf8');
