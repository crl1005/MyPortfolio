(function () {
  // ⚠️ Same-domain deploy on Vercel: leave as '/api/chat'.
  // Cross-domain (site elsewhere, API on Vercel): use full URL,
  // e.g. 'https://your-project-name.vercel.app/api/chat'
  const API_URL = '/api/chat';

  const WELCOME_MESSAGE =
    "Hi! I'm Carlos's portfolio assistant 👋 Ask me about his projects, skills, pricing, or how to get in touch.";

  const QUICK_REPLIES = [
    { label: '🗂️ Projects', prompt: 'What projects has Carlos built?' },
    { label: '🛠️ Skills', prompt: "What are Carlos's technical skills?" },
    { label: '💰 Pricing', prompt: 'How much does Carlos charge for a project?' },
    { label: '⏱️ Timeline', prompt: 'How long does a typical project take?' },
    { label: '📅 Availability', prompt: 'Is Carlos available for new projects right now?' },
    { label: '📩 Contact', prompt: 'How can I contact Carlos for freelance work?' },
  ];

  let history = []; // { role: 'user' | 'assistant', content: string }
  let isSending = false;
  let welcomed = false;

  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k === 'html') node.innerHTML = v;
      else node.setAttribute(k, v);
    });
    children.forEach((c) => {
      if (typeof c === 'string') node.appendChild(document.createTextNode(c));
      else if (c) node.appendChild(c);
    });
    return node;
  }

  // ---------------------------------------------------------------------
  // Cute cursor-following face with a few emotion states
  // ---------------------------------------------------------------------
  const SVG_NS = 'http://www.w3.org/2000/svg';

  const EMOTIONS = {
    idle: { mouth: 'M 36 66 Q 50 78 64 66', eyeRy: 13 },
    thinking: { mouth: 'M 40 70 Q 50 65 60 70', eyeRy: 8 },
    happy: { mouth: 'M 30 60 Q 50 86 70 60', eyeRy: 15 },
    sad: { mouth: 'M 36 74 Q 50 63 64 74', eyeRy: 10 },
  };

  function createFaceSVG(extraClass) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('class', `chatbot-face ${extraClass || ''}`);
    svg.innerHTML = `
      <circle class="chatbot-face-blush" cx="18" cy="63" r="7"></circle>
      <circle class="chatbot-face-blush" cx="82" cy="63" r="7"></circle>
      <g class="chatbot-eye chatbot-eye-left">
        <ellipse cx="32" cy="46" rx="11" ry="13"></ellipse>
        <circle class="chatbot-pupil" cx="32" cy="46" r="5"></circle>
      </g>
      <g class="chatbot-eye chatbot-eye-right">
        <ellipse cx="68" cy="46" rx="11" ry="13"></ellipse>
        <circle class="chatbot-pupil" cx="68" cy="46" r="5"></circle>
      </g>
      <path class="chatbot-face-mouth" d="M 36 66 Q 50 78 64 66"></path>
    `;
    return svg;
  }

  // Only the two persistent, larger faces (bubble + header avatar) get live
  // cursor tracking and emotion changes. Per-message mini avatars stay static.
  const trackedFaces = []; // { svg, left, right, wrap }
  let mouseX = typeof window !== 'undefined' ? window.innerWidth / 2 : 0;
  let mouseY = typeof window !== 'undefined' ? window.innerHeight / 2 : 0;
  const PUPIL_MAX_OFFSET = 3.2;
  let emotionResetTimer = null;

  function registerTrackedFace(svg, wrap) {
    trackedFaces.push({
      svg,
      wrap,
      left: svg.querySelector('.chatbot-eye-left .chatbot-pupil'),
      right: svg.querySelector('.chatbot-eye-right .chatbot-pupil'),
    });
  }

  function setEmotion(name) {
    const shape = EMOTIONS[name] || EMOTIONS.idle;
    trackedFaces.forEach(({ svg }) => {
      const mouth = svg.querySelector('.chatbot-face-mouth');
      if (mouth) mouth.setAttribute('d', shape.mouth);
      svg.querySelectorAll('.chatbot-eye ellipse').forEach((e) => e.setAttribute('ry', shape.eyeRy));
    });
  }

  function setEmotionTemporarily(name, holdMs) {
    if (emotionResetTimer) clearTimeout(emotionResetTimer);
    setEmotion(name);
    emotionResetTimer = setTimeout(() => setEmotion('idle'), holdMs);
  }

  function bounceAndSparkle() {
    trackedFaces.forEach(({ wrap }) => {
      if (!wrap) return;
      wrap.classList.remove('chatbot-bounce');
      // force reflow so the animation can retrigger if already present
      void wrap.offsetWidth;
      wrap.classList.add('chatbot-bounce');
      setTimeout(() => wrap.classList.remove('chatbot-bounce'), 500);

      const sparkle = el('span', { class: 'chatbot-sparkle' }, '✨');
      wrap.appendChild(sparkle);
      setTimeout(() => sparkle.remove(), 800);
    });
  }

  function updateEyes() {
    trackedFaces.forEach(({ svg, left, right }) => {
      const rect = svg.getBoundingClientRect();
      if (!rect.width) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = mouseX - cx;
      const dy = mouseY - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const offX = (dx / dist) * PUPIL_MAX_OFFSET;
      const offY = (dy / dist) * PUPIL_MAX_OFFSET;
      if (left) left.setAttribute('transform', `translate(${offX}, ${offY})`);
      if (right) right.setAttribute('transform', `translate(${offX}, ${offY})`);
    });
    requestAnimationFrame(updateEyes);
  }

  function blinkLoop() {
    document.querySelectorAll('.chatbot-eye').forEach((eye) => eye.classList.add('chatbot-blinking'));
    setTimeout(() => {
      document.querySelectorAll('.chatbot-eye').forEach((eye) => eye.classList.remove('chatbot-blinking'));
    }, 140);
    setTimeout(blinkLoop, 3000 + Math.random() * 3000);
  }

  function initFaceSystem() {
    document.addEventListener('pointermove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });
    requestAnimationFrame(updateEyes);
    setTimeout(blinkLoop, 2200);
  }

  // Small static face used inside per-message avatars (no tracking).
  function miniAvatarNode() {
    return el('div', { class: 'chatbot-mini-avatar' }, createFaceSVG('chatbot-face-mini'));
  }

  function buildWidget() {
    const root = el('div', { id: 'chatbot-root' });

    const bubbleFace = createFaceSVG('chatbot-face-bubble');
    const bubble = el(
      'button',
      { id: 'chatbot-bubble', 'aria-label': 'Open chat' },
      el('div', { class: 'chatbot-dot' }),
      bubbleFace
    );
    registerTrackedFace(bubbleFace, bubble);

    const avatarFace = createFaceSVG('chatbot-face-avatar');
    const avatarWrap = el('div', { id: 'chatbot-avatar' }, avatarFace, el('div', { class: 'chatbot-status' }));
    const panel = el(
      'div',
      { id: 'chatbot-panel' },
      el(
        'div',
        { id: 'chatbot-header' },
        avatarWrap,
        el(
          'div',
          { id: 'chatbot-header-text' },
          el('h4', {}, 'Ask Carlos'),
          el('span', {}, '● Online now')
        ),
        el('button', { id: 'chatbot-close', 'aria-label': 'Close chat', html: '&times;' })
      ),
      el('div', { id: 'chatbot-messages' }),
      el('div', { id: 'chatbot-quick-replies' }),
      el(
        'div',
        { id: 'chatbot-input-row' },
        el('textarea', {
          id: 'chatbot-input',
          rows: '1',
          placeholder: 'Type a message…',
        }),
        el('button', {
          id: 'chatbot-send',
          'aria-label': 'Send',
          html: `<svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>`,
        })
      ),
      el('div', { id: 'chatbot-footer-note' }, 'Powered by Gemini')
    );
    registerTrackedFace(avatarFace, avatarWrap);

    root.appendChild(bubble);
    appendChild(panel);
    document.documentElement.appendChild(root);

    return { bubble, panel };
  }

  function appendMessage(role, text) {
    const messages = document.getElementById('chatbot-messages');
    const row = el('div', { class: `chatbot-row ${role}` });

    if (role === 'bot') {
      row.appendChild(miniAvatarNode());
    }

    const bubble = el('div', { class: `chatbot-msg ${role}` });
    text.split('\n').forEach((line, i) => {
      if (i > 0) bubble.appendChild(el('br'));
      bubble.appendChild(document.createTextNode(line));
    });

    row.appendChild(bubble);
    messages.appendChild(row);
    messages.scrollTop = messages.scrollHeight;
    return row;
  }

  function showTyping() {
    const messages = document.getElementById('chatbot-messages');
    const row = el(
      'div',
      { class: 'chatbot-row bot', id: 'chatbot-typing-row' },
      miniAvatarNode(),
      el(
        'div',
        { class: 'chatbot-msg bot typing' },
        el('span'),
        el('span'),
        el('span')
      )
    );
    messages.appendChild(row);
    messages.scrollTop = messages.scrollHeight;
  }

  function hideTyping() {
    const row = document.getElementById('chatbot-typing-row');
    if (row) row.remove();
  }

  function clearQuickReplies() {
    document.getElementById('chatbot-quick-replies').innerHTML = '';
  }

  // Renders the quick-reply chips with a staggered pop-in, one after another.
  function showQuickReplies() {
    const container = document.getElementById('chatbot-quick-replies');
    container.innerHTML = '';
    QUICK_REPLIES.forEach((qr, i) => {
      const chip = el('button', { class: 'chatbot-chip' }, qr.label);
      chip.style.animationDelay = `${i * 0.06}s`;
      chip.addEventListener('click', () => {
        clearQuickReplies();
        sendMessage(qr.prompt);
      });
      container.appendChild(chip);
    });
  }

  async function sendMessage(text) {
    if (!text.trim() || isSending) return;
    isSending = true;

    const sendBtn = document.getElementById('chatbot-send');
    const input = document.getElementById('chatbot-input');
    sendBtn.disabled = true;
    clearQuickReplies();
    setEmotion('thinking');

    appendMessage('user', text);
    history.push({ role: 'user', content: text });
    input.value = '';
    input.style.height = 'auto';
    showTyping();

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });

      const data = await res.json();
      hideTyping();

      if (!res.ok || !data.reply) {
        appendMessage('bot', "Sorry, something went wrong on my end. Try emailing Carlos directly instead!");
        setEmotionTemporarily('sad', 1800);
      } else {
        appendMessage('bot', data.reply);
        history.push({ role: 'assistant', content: data.reply });
        setEmotionTemporarily('happy', 1600);
        bounceAndSparkle();
      }

      // Bring the prepared questions back so the visitor can keep browsing.
      showQuickReplies();
    } catch (err) {
      hideTyping();
      appendMessage('bot', "I couldn't connect just now. Please check your connection and try again.");
      setEmotionTemporarily('sad', 1800);
      showQuickReplies();
    } finally {
      isSending = false;
      sendBtn.disabled = false;
    }
  }

  function init() {
    initFaceSystem();
    const { bubble, panel } = buildWidget();
    const closeBtn = document.getElementById('chatbot-close');
    const input = document.getElementById('chatbot-input');
    const sendBtn = document.getElementById('chatbot-send');

    bubble.addEventListener('click', () => {
      panel.classList.toggle('chatbot-open');
      bubble.classList.toggle('chatbot-active');

      if (panel.classList.contains('chatbot-open')) {
        bubble.querySelector('.chatbot-dot').style.display = 'none';
        if (!welcomed) {
          appendMessage('bot', WELCOME_MESSAGE);
          showQuickReplies();
          welcomed = true;
        }
        input.focus();
      }
    });

    closeBtn.addEventListener('click', () => {
      panel.classList.remove('chatbot-open');
      bubble.classList.remove('chatbot-active');
    });

    sendBtn.addEventListener('click', () => sendMessage(input.value));

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(input.value);
      }
    });

    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 96) + 'px';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();