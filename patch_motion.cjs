const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// 1. Add CSS overrides at the end of the <style> block
const styleOverride = `
/* CONTINUOUS SCROLL PHYSICS OVERRIDES */
#rfds-app .narrative-card,
#rfds-app .hero-lockup,
#rfds-app .map-stage-wrapper,
#rfds-app .story-stat-card,
#rfds-app .beat-final-first,
#rfds-app .beat-final-second,
#rfds-app .spine-pip {
  transition: none !important;
}

#rfds-app .story-stat-deck {
  transition: none !important;
}

#rfds-app .final-header-banner,
#rfds-app .section-structure-note {
  transition: opacity 0.4s ease, transform 0.4s ease !important;
}
`;

html = html.replace('</style>', styleOverride + '\n</style>');

// 2. Replace onScroll and its related vars
// We'll replace everything from `function scrubBeat` up to `function requestScrollUpdate()`
// Actually, let's find the start of `function onScroll()` and the end of it.

const startMarker = 'function onScroll() {';
const endMarker = 'var scrollFramePending = false;';

const startIndex = html.indexOf(startMarker);
const endIndex = html.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error("Could not find onScroll block markers.");
  process.exit(1);
}

const newOnScroll = `
// --- MOTION ENGINE ---
function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}
function inverseLerp(min, max, val) {
  return clamp((val - min) / (max - min), 0, 1);
}
function lerp(start, end, amt) {
  return start + (end - start) * amt;
}
function smoothstep(min, max, val) {
  var x = inverseLerp(min, max, val);
  return x * x * (3 - 2 * x);
}
function smootherstep(min, max, val) {
  var x = inverseLerp(min, max, val);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

// MOTION CONSTANTS (Global Scroll Progress Percentages)
var MOTION = {
  hero: { start: 0.0, end: 0.15 },
  beat1: { enter: 0.14, hold: 0.19, exitStart: 0.29, exitEnd: 0.35 },
  beat2: { enter: 0.28, hold: 0.34, exitStart: 0.44, exitEnd: 0.50 },
  beat3: { enter: 0.44, hold: 0.50, exitStart: 0.61, exitEnd: 0.67 },
  stats: {
    reveal1: { start: 0.16, end: 0.20 },
    reveal2: { start: 0.30, end: 0.34 },
    reveal3: { start: 0.35, end: 0.39 },
    clear: { start: 0.64, end: 0.68 }
  },
  closing: {
    enter: 0.68, hold: 0.72, exitStart: 0.94, exitEnd: 0.98,
    finalLine1: { start: 0.71, end: 0.75 },
    finalLine2: { start: 0.79, end: 0.83 },
    furtherWord: { start: 0.88, end: 0.96 }
  },
  map: {
    hero: { start: 0.0, end: 0.15 },
    destination: { start: 0.86, end: 0.98 }
  },
  flightPaths: { start: 0.35, end: 0.70 },
  spine: {
    stops: [0.15, 0.30, 0.48, 0.68, 0.90]
  }
};

function applyNarrativeBeat(node, p, config) {
  if (!node) return;
  var enterP = smoothstep(config.enter, config.hold, p);
  var exitP = smoothstep(config.exitStart, config.exitEnd, p);
  
  // Enter phase: opacity 0->1, Y 24->0, blur 8->0
  // Exit phase: opacity 1->0, Y 0->-24, blur 0->8
  
  var opacity = enterP - exitP;
  var y = (1 - enterP) * 24 - (exitP * 24);
  var blur = (1 - enterP) * 8 + (exitP * 8);
  var scale = 1.02 - (enterP * 0.02) - (exitP * 0.02);
  
  if (opacity <= 0.001) {
    node.style.opacity = '0';
    node.style.transform = 'translateY(24px) scale(1.02)';
    node.style.filter = 'blur(8px)';
    node.style.pointerEvents = 'none';
  } else {
    node.style.opacity = opacity.toFixed(3);
    node.style.transform = 'translate3d(0, ' + y.toFixed(1) + 'px, 0) scale(' + scale.toFixed(3) + ')';
    if (blur > 0.1) {
      node.style.filter = 'blur(' + blur.toFixed(1) + 'px)';
    } else {
      node.style.filter = 'none';
    }
    node.style.pointerEvents = opacity > 0.9 ? 'auto' : 'none';
  }
}

function applyStatCard(card, p, enterConfig, exitConfig) {
  if (!card) return;
  var enterP = smoothstep(enterConfig.start, enterConfig.end, p);
  var exitP = smoothstep(exitConfig.start, exitConfig.end, p);
  
  var opacity = enterP - exitP;
  var y = (1 - enterP) * 16 + (exitP * 16);
  var blur = (1 - enterP) * 5 + (exitP * 5);
  var scale = 1.03 - (enterP * 0.03) - (exitP * 0.02);
  
  if (opacity <= 0.001) {
    card.style.opacity = '0';
    card.style.transform = 'translateY(16px) scale(1.03)';
    card.style.filter = 'blur(5px)';
    card.style.pointerEvents = 'none';
  } else {
    card.style.opacity = opacity.toFixed(3);
    card.style.transform = 'translate3d(0, ' + y.toFixed(1) + 'px, 0) scale(' + scale.toFixed(3) + ')';
    card.style.filter = blur > 0.1 ? 'blur(' + blur.toFixed(1) + 'px)' : 'none';
    card.style.pointerEvents = 'auto';
  }
}

function applyClosingLine(node, p, config) {
  if (!node) return;
  var enterP = smoothstep(config.start, config.end, p);
  var exitP = smoothstep(MOTION.closing.exitStart, MOTION.closing.exitEnd, p);
  
  var opacity = enterP - exitP;
  var y = (1 - enterP) * 16 - (exitP * 16);
  
  if (opacity <= 0.001) {
    node.style.opacity = '0';
    node.style.transform = 'translateY(16px)';
  } else {
    node.style.opacity = opacity.toFixed(3);
    node.style.transform = 'translate3d(0, ' + y.toFixed(1) + 'px, 0)';
  }
}

function onScroll() {
  var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  var trackHeight = scrollTrack.offsetHeight - window.innerHeight;
  if (trackHeight <= 0) return;
  var progress = clamp(scrollTop / trackHeight, 0, 1);
  var isMobile = window.innerWidth <= 900;
  var isShortLandscape = isMobile && window.innerWidth > window.innerHeight && window.innerHeight <= 520;
  var isCompactPortrait = isMobile && window.innerWidth <= 560 && window.innerHeight <= 650 && window.innerHeight >= window.innerWidth;

  // Cinematic scroll prompt hide
  if (progress > 0.03) scrollPrompt.classList.add('hidden');
  else scrollPrompt.classList.remove('hidden');

  // ACT I: Hero Lockup
  var heroP = inverseLerp(MOTION.hero.start, MOTION.hero.end, progress);
  if (heroP < 1) {
    var heroEase = smoothstep(0, 1, heroP);
    heroLockup.style.opacity = (1 - heroEase).toFixed(3);
    heroLockup.style.transform = 'translate3d(0, ' + (-heroEase * 50).toFixed(1) + 'px, 0) scale(' + (1 - heroEase * 0.02).toFixed(3) + ')';
    heroLockup.style.filter = 'blur(' + (heroEase * 4).toFixed(1) + 'px)';
    heroLockup.style.pointerEvents = heroP < 0.2 ? 'auto' : 'none';
  } else {
    heroLockup.style.opacity = '0';
    heroLockup.style.pointerEvents = 'none';
  }

  // NARRATIVE BEATS
  applyNarrativeBeat(n1, progress, MOTION.beat1);
  applyNarrativeBeat(n2, progress, MOTION.beat2);
  applyNarrativeBeat(n3, progress, MOTION.beat3);
  applyNarrativeBeat(closingCard, progress, MOTION.closing);

  // STAT CARDS
  if (storyStatDeck) {
    // Reveal individually, clear together
    applyStatCard(storyStats[0], progress, MOTION.stats.reveal1, MOTION.stats.clear);
    applyStatCard(storyStats[1], progress, MOTION.stats.reveal2, MOTION.stats.clear);
    applyStatCard(storyStats[2], progress, MOTION.stats.reveal3, MOTION.stats.clear);
    
    // Manage hidden state for map interactions if needed
    var isCleared = progress >= MOTION.stats.clear.end;
    if (isCleared !== storyStatDeck.classList.contains('is-hidden-for-map')) {
      storyStatDeck.classList.toggle('is-hidden-for-map', isCleared);
    }
  }

  // CLOSING TEXT
  applyClosingLine(beatFinalFirst, progress, MOTION.closing.finalLine1);
  applyClosingLine(beatFinalSecond, progress, MOTION.closing.finalLine2);

  // FURTHER WORD (Trail effect)
  var furtherP = smoothstep(MOTION.closing.furtherWord.start, MOTION.closing.furtherWord.end, progress);
  if (furtherWord) {
    furtherWord.style.setProperty('--further-progress', furtherP.toFixed(3));
    furtherWord.style.setProperty('--further-trail', (furtherP * 58).toFixed(1) + 'px');
  }

  // FLIGHT PATHS
  var pathProgress = smootherstep(MOTION.flightPaths.start, MOTION.flightPaths.end, progress);
  flightArcs.forEach(function(arc) {
    var len = parseFloat(arc.getAttribute('data-len'));
    if (!isNaN(len)) {
      arc.style.strokeDashoffset = (len * (1 - pathProgress)).toFixed(1);
    }
  });

  // MAP TRANSFORMATION
  // Stage 1: Hero -> Narrative
  var mapHeroP = smoothstep(MOTION.map.hero.start, MOTION.map.hero.end, progress);
  // Stage 2: Narrative -> Destination
  var mapDestP = smoothstep(MOTION.map.destination.start, MOTION.map.destination.end, progress);
  
  var baseScale = isShortLandscape ? 0.64 : (isCompactPortrait ? 0.64 : (isMobile ? 0.72 : 0.76));
  var destScale = isShortLandscape ? 0.82 : (isMobile ? 0.90 : 1.02);
  var currentScale = lerp(baseScale, destScale, mapDestP);
  
  var baseY = isShortLandscape ? 16 : (isCompactPortrait ? 20 : (isMobile ? 16 : 10));
  var destY = isShortLandscape ? 12 : (isMobile ? 4 : 0);
  var currentY = lerp(baseY, destY, mapDestP);
  
  var storyMapOpacity = isMobile ? 0.11 : 0.16;
  var currentOpacity = lerp(1.0, storyMapOpacity, mapHeroP) + lerp(0, (1 - storyMapOpacity), mapDestP);
  
  var currentSaturation = lerp(1.0, 0.78, mapHeroP) + lerp(0, 0.22, mapDestP);

  mapStageWrapper.style.opacity = currentOpacity.toFixed(3);
  mapStageWrapper.style.filter = 'saturate(' + currentSaturation.toFixed(3) + ')';
  mapStageWrapper.style.transform = 'translate3d(0,' + currentY.toFixed(2) + 'vh,0) scale(' + currentScale.toFixed(3) + ')';

  // DESTINATION INTERACTIVE ELEMENTS
  if (progress >= 0.95) {
    finalBanner.classList.add('visible');
    if (sectionStructureNote) sectionStructureNote.classList.add('visible');
    if (progress >= 0.98) {
      statesLayer.classList.add('map-interactive');
    }
  } else {
    finalBanner.classList.remove('visible');
    if (sectionStructureNote) sectionStructureNote.classList.remove('visible');
    statesLayer.classList.remove('map-interactive');
  }

  // SPINE PIPS (Continuous Interpolation)
  var stops = MOTION.spine.stops;
  var spinePipsList = [
    document.getElementById('spine0'),
    document.getElementById('spine1'),
    document.getElementById('spine2'),
    document.getElementById('spine3'),
    document.getElementById('spine4')
  ];
  
  var activePipIndex = 0;
  for (var i = stops.length - 1; i >= 0; i--) {
    if (progress >= stops[i]) {
      activePipIndex = i;
      break;
    }
  }
  
  spinePipsList.forEach(function(el, idx) {
    if (!el) return;
    if (idx === activePipIndex) {
      el.style.height = '34px';
      el.style.background = 'var(--rfds-red)';
    } else {
      el.style.height = '14px';
      el.style.background = 'var(--ink-faint)';
    }
  });
}

`;

html = html.substring(0, startIndex) + newOnScroll + html.substring(endIndex);

// 3. Remove old setStoryStats and scrubBeat if they're still lying around.
// We just replaced them if they were inside the replaced block?
// No, scrubBeat was inside onScroll, setStoryStats was outside.
// Let's remove setStoryStats and setSpine functions.

const removeFunc = (funcName, htmlStr) => {
  const funcStart = 'function ' + funcName;
  const sIdx = htmlStr.indexOf(funcStart);
  if (sIdx !== -1) {
    let eIdx = htmlStr.indexOf('}', sIdx);
    // basic brace matching
    let openCount = 0;
    let i = sIdx;
    while(i < htmlStr.length) {
      if (htmlStr[i] === '{') openCount++;
      if (htmlStr[i] === '}') {
        openCount--;
        if (openCount === 0) {
          eIdx = i;
          break;
        }
      }
      i++;
    }
    if (eIdx !== -1) {
      return htmlStr.substring(0, sIdx) + htmlStr.substring(eIdx + 1);
    }
  }
  return htmlStr;
};

html = removeFunc('setStoryStats', html);
html = removeFunc('setSpine', html);

// Also remove `var spinePips = [` array declaration since we do it inside onScroll now.
const spinePipsStart = html.indexOf('var spinePips = [');
if (spinePipsStart !== -1) {
  const spinePipsEnd = html.indexOf('];', spinePipsStart);
  if (spinePipsEnd !== -1) {
    html = html.substring(0, spinePipsStart) + html.substring(spinePipsEnd + 2);
  }
}

fs.writeFileSync('index.html', html, 'utf8');
console.log("Patch complete!");
