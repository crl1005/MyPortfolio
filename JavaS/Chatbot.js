(function () {
  // ⚠️ Update this if your API is hosted on a different domain than your site.
  // Same-domain example (site deployed on Vercel): '/api/chat'
  // Cross-domain example (site on GitHub Pages, API on Vercel):
  //   'https://your-project-name.vercel.app/api/chat'
  const API_URL = '/api/chat';

  const WELCOME_MESSAGE =
    "Hi! I'm Carlos's portfolio assistant 👋 Ask me about his projects, skills, or how to get in touch.";

  let history = []; // { role: 'user' | 'assistant', content: string }
  let isSending = false;

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

  function buildWidget() {
    const root = el('div', { id: 'chatbot-root' });

    const bubble = el(
      'button',
      { id: 'chatbot-bubble', 'aria-label': 'Open chat' },
      el('div', { class: 'chatbot-dot' }),
      el('span', {
        html: `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.02 2 11c0 2.4 1.06 4.57 2.8 6.19L4 22l5.06-1.68C10.02 20.76 11 21 12 21c5.52 0 10-4.02 10-9s-4.48-10-10-10zm0 16c-.9 0-1.76-.15-2.55-.42l-.4-.14-2.85.95.9-2.7-.26-.42C6.15 14.5 5.5 12.83 5.5 11c0-3.86 3.36-7 7-7s7 3.14 7 7-3.36 7-7 7z"/></svg>`,
      })
    );

    const panel = el(
      'div',
      { id: 'chatbot-panel' },
      el(
        'div',
        { id: 'chatbot-header' },
        el(
          'div',
          {},
          el('h4', {}, 'Ask Carlos'),
          el('span', {}, "AI assistant · usually replies instantly")
        ),
        el('button', { id: 'chatbot-close', 'aria-label': 'Close chat', html: '&times;' })
      ),
      el('div', { id: 'chatbot-messages' }),
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
      )
    );

    root.appendChild(bubble);
    root.appendChild(panel);
    document.body.appendChild(root);

    return { bubble, panel };
  }

  function appendMessage(role, text) {
    const messages = document.getElementById('chatbot-messages');
    const msg = el('div', { class: `chatbot-msg ${role}` }, text);
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
    return msg;
  }

  function showTyping() {
    const messages = document.getElementById('chatbot-messages');
    const typing = el(
      'div',
      { class: 'chatbot-msg typing', id: 'chatbot-typing' },
      el('span'),
      el('span'),
      el('span')
    );
    messages.appendChild(typing);
    messages.scrollTop = messages.scrollHeight;
  }

  function hideTyping() {
    const typing = document.getElementById('chatbot-typing');
    if (typing) typing.remove();
  }

  async function sendMessage(text) {
    if (!text.trim() || isSending) return;
    isSending = true;

    const sendBtn = document.getElementById('chatbot-send');
    const input = document.getElementById('chatbot-input');
    sendBtn.disabled = true;

    appendMessage('user', text);
    history.push({ role: 'user', content: text });
    input.value = '';
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
      } else {
        appendMessage('bot', data.reply);
        history.push({ role: 'assistant', content: data.reply });
      }
    } catch (err) {
      hideTyping();
      appendMessage('bot', "I couldn't connect just now. Please check your connection and try again.");
    } finally {
      isSending = false;
      sendBtn.disabled = false;
    }
  }

  function init() {
    const { bubble, panel } = buildWidget();
    const closeBtn = document.getElementById('chatbot-close');
    const input = document.getElementById('chatbot-input');
    const sendBtn = document.getElementById('chatbot-send');

    let welcomed = false;

    bubble.addEventListener('click', () => {
      panel.classList.toggle('chatbot-open');
      if (panel.classList.contains('chatbot-open')) {
        bubble.querySelector('.chatbot-dot').style.display = 'none';
        if (!welcomed) {
          appendMessage('bot', WELCOME_MESSAGE);
          welcomed = true;
        }
        input.focus();
      }
    });

    closeBtn.addEventListener('click', () => {
      panel.classList.remove('chatbot-open');
    });

    sendBtn.addEventListener('click', () => sendMessage(input.value));

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(input.value);
      }
    });

    // auto-grow textarea up to 4 lines
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