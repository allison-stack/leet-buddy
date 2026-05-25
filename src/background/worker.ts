console.log('[leet-buddy] background worker booted');
chrome.runtime.onInstalled.addListener(() => {
  console.log('[leet-buddy] installed');
});
