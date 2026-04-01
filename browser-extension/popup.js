// AIFlow Companion — Popup Script

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function showStatus(msg, isError = false) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className = 'status' + (isError ? ' error' : '');
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}

document.addEventListener('DOMContentLoaded', async () => {
  const tab = await getCurrentTab();
  document.getElementById('page-title').textContent = tab?.title || tab?.url || '알 수 없음';

  // 이 페이지 전체 전송
  document.getElementById('btn-send-page').addEventListener('click', async () => {
    let fullText = null;
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.body?.innerText?.slice(0, 50000) || '',
      });
      fullText = result?.result || null;
    } catch (e) {
      // 일부 페이지에서는 scripting이 허용되지 않음
    }

    const context = {
      url: tab.url,
      title: tab.title,
      selected_text: null,
      full_text: fullText,
    };

    chrome.runtime.sendMessage({ type: 'send-to-aiflow', context }, (resp) => {
      if (resp?.ok) {
        showStatus('✅ AIFlow로 전송했습니다!');
      } else {
        showStatus('❌ 전송 실패. AIFlow가 실행 중인지 확인하세요.', true);
      }
    });
  });

  // 선택된 텍스트 전송
  document.getElementById('btn-send-selection').addEventListener('click', async () => {
    let selectedText = null;
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.getSelection()?.toString() || '',
      });
      selectedText = result?.result || null;
    } catch (e) {}

    if (!selectedText) {
      showStatus('❗ 선택된 텍스트가 없습니다.', true);
      return;
    }

    const context = {
      url: tab.url,
      title: tab.title,
      selected_text: selectedText,
      full_text: null,
    };

    chrome.runtime.sendMessage({ type: 'send-to-aiflow', context }, (resp) => {
      if (resp?.ok) {
        showStatus(`✅ "${selectedText.slice(0, 30)}..." 전송 완료`);
      } else {
        showStatus('❌ 전송 실패. AIFlow가 실행 중인지 확인하세요.', true);
      }
    });
  });
});
