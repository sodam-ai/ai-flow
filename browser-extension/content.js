// AIFlow Companion — Content Script
// 페이지에서 컨텍스트 정보를 수집하여 background로 전달

// 우클릭 시 선택된 텍스트 캐싱
document.addEventListener('mouseup', () => {
  const selected = window.getSelection()?.toString() || '';
  if (selected) {
    chrome.runtime.sendMessage({ type: 'selection-updated', text: selected });
  }
});

// AIFlow에서 응답 메시지 수신 시 알림 표시 (선택적)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'aiflow-ready') {
    // AIFlow가 컨텍스트를 수신했음을 알림 (향후 확장)
    console.log('[AIFlow] Context received by desktop app');
  }
});
