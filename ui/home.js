const timeFormat = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' });

export function initHome(refreshResume) {
  const tabList = document.querySelector('.home-nav');
  const tabs = [...tabList.querySelectorAll('[role="tab"]')];
  const clock = document.getElementById('widget-clock');
  const dateLabel = document.getElementById('widget-date');
  let timer;

  function updateClock() {
    const now = new Date();
    const time = timeFormat.format(now);
    clock.dateTime = time;
    clock.textContent = time;
    dateLabel.textContent = dateFormat.format(now);
    timer = setTimeout(updateClock, 60_000 - now.getTime() % 60_000);
  }

  function selectTab(selected) {
    for (const tab of tabs) {
      const active = tab === selected;
      tab.tabIndex = active ? 0 : -1;
      tab.setAttribute('aria-selected', String(active));
      document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
    }
    clearTimeout(timer);
    if (selected.id === 'home-widgets-tab') updateClock();
    if (selected.id === 'home-resume-tab') refreshResume();
  }

  tabs.forEach(tab => tab.addEventListener('click', () => selectTab(tab)));
  tabList.addEventListener('keydown', (event) => {
    const index = tabs.indexOf(event.target);
    if (index === -1 || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;

    let nextIndex;
    switch (event.key) {
      case 'ArrowLeft': nextIndex = (index + tabs.length - 1) % tabs.length; break;
      case 'ArrowRight': nextIndex = (index + 1) % tabs.length; break;
      case 'Home': nextIndex = 0; break;
      case 'End': nextIndex = tabs.length - 1; break;
      default: return;
    }
    event.preventDefault();
    selectTab(tabs[nextIndex]);
    tabs[nextIndex].focus();
  });

  return () => selectTab(tabs[0]);
}
