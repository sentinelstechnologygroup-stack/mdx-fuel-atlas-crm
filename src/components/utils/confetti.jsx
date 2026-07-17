export function triggerConfetti() {
  const count = 200;
  const defaults = {
    origin: { y: 0.7 }
  };

  function fire(particleRatio, opts) {
    if (typeof window.confetti !== 'function') return;
    
    window.confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio)
    });
  }

  if (typeof window.confetti === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js';
      script.onload = () => fireConfetti();
      document.body.appendChild(script);
  } else {
      fireConfetti();
  }

  function fireConfetti() {
      if (typeof window.confetti !== 'function') return;
      
      window.confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
      });
      
      setTimeout(() => {
          if (typeof window.confetti !== 'function') return;
          window.confetti({
              particleCount: 50,
              angle: 60,
              spread: 55,
              origin: { x: 0 }
          });
          window.confetti({
              particleCount: 50,
              angle: 120,
              spread: 55,
              origin: { x: 1 }
          });
      }, 250);
  }
}