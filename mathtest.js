const s = require('fs').readFileSync('script/kokoro-pipeline.js', 'utf8');
const i = s.indexOf('function latexToSpeech');
const j = s.indexOf('function sanitizeTextForTTS');
eval(s.slice(i, j));
const cases = [
  '$\\Delta x$', '$e^{-iHt}$', '$\\mathbb{C}$',
  '$\\frac{a}{b}$', '$\\psi(x,t)$', '$C_{max}^2$',
  '$F = T \\frac{\\Delta S}{\\Delta x}$'
];
for (const c of cases) console.log(c, '->', latexToSpeech(c).trim().replace(/\s+/g, ' '));
