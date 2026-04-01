// AIFlow Companion — Background Service Worker
// Chrome Native Messaging 방식으로 AIFlow 데스크톱 앱과 통신

const NATIVE_HOST = 'com.aiflow.companion';
let nativePort = null;

// Native Messaging 연결
function connectNative() {
  if (nativePort) return;
  try {
    nativePort = chrome.runtime.connectNative(NATIVE_HOST);
    nativePort.onMessage.addListener((msg) => {
      // AIFlow에서 응답이 오면 popup에 중계
      chrome.runtime.sendMessage({ type: 'native-response', data: msg });
    });
    nativePort.onDisconnect.addListener(() => {
      nativePort = null;
      if (chrome.runtime.lastError) {
        console.warn('Native host disconnected:', chrome.runtime.lastError.message);
      }
    });
  } catch (e) {
    console.warn('Native host not available:', e);
    nativePort = null;
  }
}

// 컨텍스트 메뉴 생성
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'aiflow-send',
    title: '선택한 텍스트를 AIFlow로 전송',
    contexts: ['selection'],
  });
  chrome.contextMenus.create({
    id: 'aiflow-send-page',
    title: '이 페이지를 AIFlow로 전송',
    contexts: ['page'],
  });
});

// 컨텍스트 메뉴 클릭
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const ctx = {
    url: tab?.url || '',
    title: tab?.title || '',
    selected_text: info.selectionText || null,
    full_text: null,
  };

  if (info.menuItemId === 'aiflow-send-page') {
    // 페이지 전체 텍스트 수집
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.body.innerText?.slice(0, 50000) || '',
      });
      ctx.full_text = result?.result || null;
    } catch (e) {
      console.warn('Failed to extract page text:', e);
    }
  }

  sendToAIFlow(ctx);
});

// popup에서 전송 요청 수신
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'send-to-aiflow') {
    sendToAIFlow(msg.context);
    sendResponse({ ok: true });
  }
  return true;
});

// AIFlow로 전송 (Native Messaging)
function sendToAIFlow(context) {
  connectNative();
  if (nativePort) {
    nativePort.postMessage({
      action: 'send-context',
      data: context,
    });
  } else {
    // Native host 없으면 알림 표시
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'AIFlow',
      message: 'AIFlow 앱이 실행 중이지 않거나 확장 프로그램이 등록되지 않았습니다.',
    });
  }
}
