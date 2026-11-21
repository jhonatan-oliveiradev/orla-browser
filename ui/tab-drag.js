export function initTabDrag(list, { canDrag, canDrop, move, onStart }) {
  let source;
  let indicator;

  function highlight(row, edge) {
    if (indicator !== row) indicator?.removeAttribute('data-drop-edge');
    indicator = row;
    if (row) row.dataset.dropEdge = edge;
  }

  function end() {
    highlight();
    list.querySelector('[data-dragging]')?.removeAttribute('data-dragging');
    source = undefined;
  }

  function target(event) {
    const row = event.target.closest('li[data-tab-row]');
    const id = Number(row?.dataset.tabRow);
    if (source === undefined || !row || !canDrop(source, id)) return null;
    const rect = row.getBoundingClientRect();
    return { id, row, after: event.clientY >= rect.top + rect.height / 2 };
  }

  list.addEventListener('dragstart', (event) => {
    const button = event.target.closest('.tab-select');
    const id = Number(button?.dataset.tabId);
    if (!button || !canDrag(id) || !event.dataTransfer) {
      event.preventDefault();
      return;
    }
    end();
    source = id;
    button.closest('li').dataset.dragging = '';
    event.dataTransfer.setData('application/x-orla-tab', String(id));
    event.dataTransfer.effectAllowed = 'move';
    onStart();
  });
  list.addEventListener('dragover', (event) => {
    const destination = target(event);
    if (!destination) {
      highlight();
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    highlight(destination.row, destination.after ? 'after' : 'before');
  });
  list.addEventListener('dragleave', (event) => {
    if (!event.relatedTarget || !list.contains(event.relatedTarget)) highlight();
  });
  list.addEventListener('drop', (event) => {
    const destination = target(event);
    if (destination) {
      event.preventDefault();
      move(source, destination.id, destination.after);
    }
    end();
  });
  list.addEventListener('dragend', end);
  return { end };
}
