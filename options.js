const textarea = document.getElementById('names');
const status = document.getElementById('status');

chrome.storage.sync.get(['athleteNames'], ({ athleteNames }) => {
    textarea.value = (athleteNames || []).join('\n');
});

document.getElementById('save').addEventListener('click', () => {
    const names = textarea.value.split('\n').map(n => n.trim()).filter(Boolean);
    chrome.storage.sync.set({ athleteNames: names }, () => {
        status.textContent = 'Gespeichert!';
        setTimeout(() => status.textContent = '', 1500);
    });
});
