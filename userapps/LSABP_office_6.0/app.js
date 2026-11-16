
'use strict';

/* ==========================================
   LSaBP OFFICE – SPOJENÁ VERZIA
   Writer 5.0 + Calc 5.0 + Impress 1.0
   ========================================== */

const $ = id => document.getElementById(id);
const STORE = 'lsabp-office-combined-v1';

let currentView = 'home';
let activeFileType = 'writer';
let dirty = false;
let toastTimer = null;

/* ==========================================
   ZÁKLADNÉ FUNKCIE
   ========================================== */

function toast(message) {
    const el = $('toast');
    if (!el) return;

    el.textContent = message;
    el.classList.add('show');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        el.classList.remove('show');
    }, 2400);
}

function safeName(name) {
    return (name || 'Untitled')
        .trim()
        .replace(/[\\/:*?"<>|]+/g, '_') || 'Untitled';
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[char]);
}

function download(name, content, type = 'application/octet-stream') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = name;

    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function saveFile(name, content, mime) {
    if (window.lsabpOS?.saveFile) {
        try {
            await window.lsabpOS.saveFile({
                name,
                content,
                mime
            });

            toast('Uložené cez LSaBP OS');
            return;
        } catch (error) {
            console.warn(error);
        }
    }

    download(name, content, mime);
    toast('Súbor pripravený na stiahnutie');
}

function markDirty() {
    dirty = true;

    const state = $('saveState');
    if (state) {
        state.textContent = 'Neuložené zmeny';
    }
}

function markSaved() {
    dirty = false;

    const state = $('saveState');
    if (state) {
        state.textContent = 'Všetky zmeny uložené';
    }
}

function parseStore(key, fallback = null) {
    try {
        return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
    } catch {
        return fallback;
    }
}

function persistRecovery(type, data) {
    try {
        localStorage.setItem(
            STORE + '_' + type,
            JSON.stringify(data)
        );
    } catch {
        toast('Nedostatok miesta v úložisku.');
    }
}

/* ==========================================
   NAVIGÁCIA
   ========================================== */

function showView(view) {
    const target = $(view + 'View');
    if (!target) return;

    document.querySelectorAll('.view').forEach(el => {
        el.classList.remove('active');
    });

    document.querySelectorAll('.nav[data-view]').forEach(el => {
        el.classList.toggle('active', el.dataset.view === view);
    });

    target.classList.add('active');

    currentView = view;

    if (view === 'impress') renderSlides();
    if (view === 'calc') renderGrid();
}

function initNavigation() {
    document.querySelectorAll(
        '.nav[data-view], [data-open], [data-view].back-btn'
    ).forEach(button => {
        button.addEventListener('click', () => {
            showView(button.dataset.view || button.dataset.open);
        });
    });

    if ($('themeBtn')) {
        $('themeBtn').onclick = () => {
            document.body.classList.toggle('dark');
            document.body.classList.toggle('light');
        };
    }

    if ($('helpBtn')) {
        $('helpBtn').onclick = () => {
            $('helpModal')?.classList.add('show');
            $('helpModal')?.classList.remove('hidden');
        };
    }

    if ($('closeHelp')) {
        $('closeHelp').onclick = () => {
            $('helpModal')?.classList.remove('show');
            $('helpModal')?.classList.add('hidden');
        };
    }

    if ($('closeHelp2')) {
        $('closeHelp2').onclick = () => {
            $('helpModal')?.classList.remove('show');
        };
    }

    if ($('newFile')) {
        $('newFile').onclick = () => {
            if (currentView === 'home') showView('writer');
            else if (currentView === 'writer') newWriter();
            else if (currentView === 'calc') newCalc();
            else if (currentView === 'impress') newPres();
        };
    }

    if ($('openFile')) {
        $('openFile').onclick = () => {
            openPicker(currentView === 'home' ? 'writer' : currentView);
        };
    }
}

/* ==========================================
   OTVÁRANIE SÚBOROV
   ========================================== */

function openPicker(type) {
    activeFileType = type;

    const picker = $('filePicker') || $('docFile') || $('bookFile');

    if (picker) {
        picker.value = '';
        picker.click();
    }
}

function readFile(file, callback) {
    const reader = new FileReader();

    reader.onload = () => callback(String(reader.result));
    reader.onerror = () => toast('Súbor sa nepodarilo načítať.');

    reader.readAsText(file);
}

function sanitizeHTML(html) {
    const doc = new DOMParser().parseFromString(
        String(html),
        'text/html'
    );

    doc.querySelectorAll(
        'script,style,iframe,object,embed,form,link,meta'
    ).forEach(el => el.remove());

    const allowed = new Set([
        'P', 'BR', 'DIV', 'SPAN',
        'H1', 'H2', 'H3', 'H4',
        'B', 'STRONG', 'I', 'EM',
        'U', 'S', 'UL', 'OL', 'LI',
        'BLOCKQUOTE', 'PRE', 'CODE',
        'TABLE', 'TBODY', 'THEAD',
        'TR', 'TD', 'TH', 'A', 'IMG', 'HR'
    ]);

    const walk = node => {
        [...node.childNodes].forEach(child => {
            if (child.nodeType !== 1) return;

            if (!allowed.has(child.tagName)) {
                child.replaceWith(...child.childNodes);
                return;
            }

            for (const attr of [...child.attributes]) {
                const name = attr.name.toLowerCase();
                const value = attr.value.trim();

                if (name.startsWith('on')) {
                    child.removeAttribute(attr.name);
                    continue;
                }

                if (name === 'href' || name === 'src') {
                    if (!/^(https?:|mailto:|data:image\/(?:png|jpeg|gif|webp);base64,)/i.test(value)) {
                        child.removeAttribute(attr.name);
                    }
                    continue;
                }

                if (
                    name !== 'style' &&
                    name !== 'colspan' &&
                    name !== 'rowspan' &&
                    name !== 'alt' &&
                    name !== 'title'
                ) {
                    child.removeAttribute(attr.name);
                }
            }

            walk(child);
        });
    };

    walk(doc.body);
    return doc.body.innerHTML;
}

/* ==========================================
   WRITER – VERZIA 5.0
   ========================================== */

const editor = $('editor') || $('writerEditor');

let writerName = $('docName') || $('writerName');

function getWriterName() {
    return writerName?.value || 'Nový dokument';
}

function setWriterName(value) {
    if (writerName) writerName.value = value;
}

function getWriterHTML() {
    return editor?.innerHTML || '';
}

function writerSnapshot() {
    return {
        name: getWriterName(),
        html: getWriterHTML()
    };
}

function wordCount() {
    if (!editor || !$('wordCount')) return;

    const text = editor.innerText.trim();
    const count = (text.match(/\S+/g) || []).length;

    $('wordCount').textContent = count + ' slov';
}

function writerChanged() {
    markDirty();
    wordCount();
    persistRecovery('writer', writerSnapshot());
}

function persist() {
    writerChanged();
}

if (editor) {
    editor.addEventListener('input', writerChanged);

    editor.addEventListener('paste', event => {
        const items = [...(event.clipboardData?.items || [])];
        const image = items.find(item => item.type.startsWith('image/'));

        if (image) {
            event.preventDefault();

            const file = image.getAsFile();
            const reader = new FileReader();

            reader.onload = () => {
                editor.focus();
                document.execCommand('insertImage', false, reader.result);
                writerChanged();
            };

            reader.readAsDataURL(file);
        } else {
            setTimeout(writerChanged, 50);
        }
    });
}

if (writerName) {
    writerName.addEventListener('input', writerChanged);
}

document.querySelectorAll('[data-cmd]').forEach(button => {
    button.onclick = () => {
        if (!editor) return;

        editor.focus();
        document.execCommand(button.dataset.cmd, false, null);
        writerChanged();
    };
});

function changeFont(name, size) {
    if (!editor) return;

    editor.focus();

    if (name) document.execCommand('fontName', false, name);
    if (size) document.execCommand('fontSize', false, size);

    writerChanged();
}

const fontName = $('fontName') || $('wFont');
const fontSize = $('fontSize') || $('wSize');

if (fontName) {
    fontName.onchange = event => changeFont(event.target.value, null);
}

if (fontSize) {
    fontSize.onchange = event => changeFont(null, event.target.value);
}

const imageButton = $('imageBtn') || $('wImage');
const imageInput = $('imageInput') || $('imagePicker');

if (imageButton && imageInput) {
    imageButton.onclick = () => imageInput.click();

    imageInput.onchange = event => {
        const file = event.target.files?.[0];
        if (!file || !editor) return;

        if (!file.type.startsWith('image/')) {
            toast('Vyber obrázok.');
            return;
        }

        const reader = new FileReader();

        reader.onload = () => {
            editor.focus();
            document.execCommand('insertImage', false, reader.result);
            writerChanged();
        };

        reader.readAsDataURL(file);
        event.target.value = '';
    };
}

function newWriter() {
    if (!confirm('Vytvoriť nový dokument?')) return;

    setWriterName('Nový dokument');

    if (editor) {
        editor.innerHTML = '<p><br></p>';
    }

    writerChanged();
    showView('writer');
}

function saveWriter() {
    if (!editor) return;

    const data = {
        format: 'LSaBP-Office',
        version: 1,
        type: 'word',
        kind: 'lsaw',
        name: getWriterName(),
        html: sanitizeHTML(getWriterHTML())
    };

    saveFile(
        safeName(data.name) + '.lsabp',
        JSON.stringify(data, null, 2),
        'application/json'
    );

    markSaved();
}

function exportWriter() {
    if (!editor) return;

    const html = '<!doctype html><html><head><meta charset="utf-8">' +
        '<title>' + escapeHtml(getWriterName()) + '</title>' +
        '</head><body>' + sanitizeHTML(getWriterHTML()) +
        '</body></html>';

    download(
        safeName(getWriterName()) + '.html',
        html,
        'text/html'
    );
}

if ($('saveDoc')) $('saveDoc').onclick = saveWriter;
if ($('writerSave')) $('writerSave').onclick = saveWriter;

if ($('exportDoc')) $('exportDoc').onclick = exportWriter;
if ($('writerExport')) $('writerExport').onclick = exportWriter;

if ($('newDoc')) $('newDoc').onclick = newWriter;
if ($('writerOpen')) $('writerOpen').onclick = () => openPicker('writer');

if ($('importDoc')) $('importDoc').onclick = () => $('docFile')?.click();

if ($('docFile')) {
    $('docFile').onchange = event => {
        const file = event.target.files?.[0];
        if (!file) return;

        readFile(file, text => {
            try {
                const data = JSON.parse(text);

                if (data.type === 'word' || data.kind === 'lsaw') {
                    setWriterName(data.name || file.name);
                    editor.innerHTML = sanitizeHTML(data.html || '');
                } else {
                    editor.innerHTML = sanitizeHTML(text);
                }
            } catch {
                editor.innerHTML = sanitizeHTML(text);
            }

            writerChanged();
            markSaved();
            toast('Dokument otvorený');
        });

        event.target.value = '';
    };
}

/* ==========================================
   OBRÁZKY VO WRITERI
   ========================================== */

let activeImage = null;
let imageHandles = null;

function clearImageHandles() {
    if (imageHandles) {
        imageHandles.remove();
        imageHandles = null;
    }

    if (activeImage) {
        activeImage.classList.remove('selected-image');
    }

    activeImage = null;
}

function positionImageHandles() {
    if (!activeImage || !imageHandles || !editor) return;

    const a = activeImage.getBoundingClientRect();
    const b = editor.getBoundingClientRect();

    imageHandles.style.left =
        (a.left - b.left + editor.scrollLeft) + 'px';

    imageHandles.style.top =
        (a.top - b.top + editor.scrollTop) + 'px';

    imageHandles.style.width = a.width + 'px';
    imageHandles.style.height = a.height + 'px';
}

function showImageHandles(img) {
    if (!editor) return;

    clearImageHandles();

    activeImage = img;
    img.classList.add('selected-image');

    imageHandles = document.createElement('div');
    imageHandles.className = 'image-handles';

    [
        'nw', 'n', 'ne', 'e',
        'se', 's', 'sw', 'w', 'move'
    ].forEach(position => {
        const handle = document.createElement('i');
        handle.dataset.handle = position;
        handle.className = 'handle ' + position;
        imageHandles.appendChild(handle);
    });

    editor.appendChild(imageHandles);
    positionImageHandles();
}

if (editor) {
    editor.addEventListener('click', event => {
        const img = event.target.closest('img');

        if (img) {
            showImageHandles(img);
        } else if (!event.target.closest('.image-handles')) {
            clearImageHandles();
        }
    });

    editor.addEventListener('scroll', positionImageHandles);
}

window.addEventListener('resize', positionImageHandles);

function scaleImage(factor) {
    if (!activeImage) {
        toast('Najprv vyber obrázok.');
        return;
    }

    const width = activeImage.getBoundingClientRect().width;

    activeImage.style.width = Math.max(60, width * factor) + 'px';
    activeImage.style.height = 'auto';
    activeImage.style.maxWidth = 'none';

    positionImageHandles();
    writerChanged();
}

if ($('imgBigger')) $('imgBigger').onclick = () => scaleImage(1.5);
if ($('imgSmaller')) $('imgSmaller').onclick = () => scaleImage(0.67);

if ($('imgReset')) {
    $('imgReset').onclick = () => {
        if (!activeImage) {
            toast('Najprv vyber obrázok.');
            return;
        }

        activeImage.style.width = '';
        activeImage.style.height = '';
        activeImage.style.left = '';
        activeImage.style.top = '';
        activeImage.style.position = '';
        activeImage.style.maxWidth = '100%';

        positionImageHandles();
        writerChanged();
    };
}

if ($('imgFree')) {
    $('imgFree').onclick = () => {
        if (!activeImage) {
            toast('Najprv vyber obrázok.');
            return;
        }

        activeImage.style.position = 'relative';
        toast('Obrázok môžeš voľne presúvať.');
    };
}

if (editor) {
    editor.addEventListener('pointerdown', event => {
        const handle = event.target.closest('.image-handles .handle');

        if (!handle || !activeImage) return;

        event.preventDefault();
        event.stopPropagation();

        const kind = handle.dataset.handle;
        const sx = event.clientX;
        const sy = event.clientY;
        const rect = activeImage.getBoundingClientRect();

        const startWidth = rect.width;
        const startHeight = rect.height;

        const move = ev => {
            if (kind === 'move') {
                const left = parseFloat(activeImage.style.left) || 0;
                const top = parseFloat(activeImage.style.top) || 0;

                activeImage.style.position = 'relative';
                activeImage.style.left = left + ev.clientX - sx + 'px';
                activeImage.style.top = top + ev.clientY - sy + 'px';
            } else {
                let width = startWidth;
                let height = startHeight;

                const dx = ev.clientX - sx;
                const dy = ev.clientY - sy;

                if (kind.includes('e')) width += dx;
                if (kind.includes('w')) width -= dx;
                if (kind.includes('s')) height += dy;
                if (kind.includes('n')) height -= dy;

                const ratio = startWidth / startHeight;

                if (ev.shiftKey) {
                    if (Math.abs(dx) > Math.abs(dy)) {
                        height = width / ratio;
                    } else {
                        width = height * ratio;
                    }
                }

                activeImage.style.width = Math.max(60, width) + 'px';
                activeImage.style.height = Math.max(40, height) + 'px';
                activeImage.style.maxWidth = 'none';
            }

            positionImageHandles();
        };

        const up = () => {
            document.removeEventListener('pointermove', move);
            writerChanged();
        };

        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up, { once: true });
    });
}

/* ==========================================
   CALC – VERZIA 5.0
   ========================================== */

let rows = 100;
let cols = 26;
let selected = { r: 0, c: 0 };

let data = Array.from(
    { length: rows },
    () => Array(cols).fill('')
);

let colWidths = Array(cols).fill(110);
let rowHeights = Array(rows).fill(34);

const grid = $('grid') || $('sheet');

function colName(n) {
    let result = '';

    while (n > 0) {
        result = String.fromCharCode(65 + (n - 1) % 26) + result;
        n = Math.floor((n - 1) / 26);
    }

    return result;
}

function colNum(name) {
    return [...name.toUpperCase()].reduce(
        (number, char) => number * 26 + char.charCodeAt(0) - 64,
        0
    ) - 1;
}

function cellName(r, c) {
    return colName(c + 1) + (r + 1);
}

function esc(value) {
    return escapeHtml(value);
}

function selectCell(r, c) {
    selected = { r, c };

    const reference = cellName(r, c);
    const value = data[r]?.[c] ?? '';

    if ($('cellRef')) $('cellRef').textContent = reference;
    if ($('cellName')) $('cellName').textContent = reference;
    if ($('cellCount')) $('cellCount').textContent = 'Bunka ' + reference;

    if ($('formula')) $('formula').value = value;
    if ($('formulaBar')) $('formulaBar').value = value;
}

function computed(value) {
    if (!String(value).startsWith('=')) return value;

    const expression = String(value).slice(1).toUpperCase();

    const match = expression.match(
        /^(SUM|AVERAGE|MIN|MAX|COUNT)\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)$/
    );

    if (!match) return '#ERROR';

    const [, fn, c1, r1, c2, r2] = match;

    const values = [];

    for (let r = +r1 - 1; r <= +r2 - 1; r++) {
        for (let c = colNum(c1); c <= colNum(c2); c++) {
            const raw = data[r]?.[c] ?? '';

            if (raw.trim() !== '' && Number.isFinite(Number(raw))) {
                values.push(Number(raw));
            }
        }
    }

    if (fn === 'COUNT') return values.length;
    if (!values.length) return 0;

    if (fn === 'SUM') {
        return values.reduce((a, b) => a + b, 0);
    }

    if (fn === 'AVERAGE') {
        return values.reduce((a, b) => a + b, 0) / values.length;
    }

    if (fn === 'MIN') return Math.min(...values);
    if (fn === 'MAX') return Math.max(...values);

    return '#ERROR';
}

function renderGrid() {
    if (!grid) return;

    let html = '<thead><tr><th></th>';

    for (let c = 0; c < cols; c++) {
        html += `
            <th data-col="${c}" style="width:${colWidths[c] || 110}px">
                ${colName(c + 1)}
                <i class="col-grip"></i>
            </th>
        `;
    }

    html += '</tr></thead><tbody>';

    for (let r = 0; r < rows; r++) {
        html += `<tr style="height:${rowHeights[r] || 34}px">`;
        html += `<td data-row="${r}">${r + 1}<i class="row-grip"></i></td>`;

        for (let c = 0; c < cols; c++) {
            html += `
                <td>
                    <input
                        data-r="${r}"
                        data-c="${c}"
                        value="${esc(data[r]?.[c] ?? '')}"
                        aria-label="${cellName(r, c)}"
                    >
                </td>
            `;
        }

        html += '</tr>';
    }

    html += '</tbody>';
    grid.innerHTML = html;

    grid.querySelectorAll('input').forEach(input => {
        input.onfocus = () => {
            selectCell(+input.dataset.r, +input.dataset.c);
        };

        input.oninput = () => {
            const r = +input.dataset.r;
            const c = +input.dataset.c;

            data[r][c] = input.value;

            markDirty();
            persistRecovery('calc', calcSnapshot());
        };

        input.onkeydown = event => {
            const r = +input.dataset.r;
            const c = +input.dataset.c;

            if (event.key === 'Enter') {
                event.preventDefault();

                grid.querySelector(
                    `input[data-r="${Math.min(rows - 1, r + 1)}"][data-c="${c}"]`
                )?.focus();
            }

            if (event.key === 'Tab') {
                event.preventDefault();

                grid.querySelector(
                    `input[data-r="${r}"][data-c="${Math.min(cols - 1, c + 1)}"]`
                )?.focus();
            }
        };
    });

    addResizeHandlers();
    selectCell(selected.r, selected.c);
}

function addResizeHandlers() {
    if (!grid) return;

    grid.querySelectorAll('.col-grip').forEach(grip => {
        grip.onpointerdown = event => {
            event.preventDefault();

            const th = grip.parentElement;
            const column = +th.dataset.col;
            const start = event.clientX;
            const width = th.getBoundingClientRect().width;

            const move = ev => {
                colWidths[column] = Math.max(55, width + ev.clientX - start);
                th.style.width = colWidths[column] + 'px';
            };

            const up = () => {
                document.removeEventListener('pointermove', move);
                persistRecovery('calc', calcSnapshot());
            };

            document.addEventListener('pointermove', move);
            document.addEventListener('pointerup', up, { once: true });
        };
    });

    grid.querySelectorAll('.row-grip').forEach(grip => {
        grip.onpointerdown = event => {
            event.preventDefault();

            const td = grip.parentElement;
            const row = +td.dataset.row;
            const start = event.clientY;
            const height = td.getBoundingClientRect().height;

            const move = ev => {
                rowHeights[row] = Math.max(24, height + ev.clientY - start);
                td.parentElement.style.height = rowHeights[row] + 'px';
            };

            const up = () => {
                document.removeEventListener('pointermove', move);
                persistRecovery('calc', calcSnapshot());
            };

            document.addEventListener('pointermove', move);
            document.addEventListener('pointerup', up, { once: true });
        };
    });
}

function calcSnapshot() {
    return {
        name: ($('sheetName') || $('calcName'))?.value || 'Nový hárok',
        rows,
        cols,
        data,
        colWidths,
        rowHeights
    };
}

function newCalc() {
    if (!confirm('Vytvoriť nový hárok?')) return;

    rows = 100;
    cols = 26;

    data = Array.from(
        { length: rows },
        () => Array(cols).fill('')
    );

    colWidths = Array(cols).fill(110);
    rowHeights = Array(rows).fill(34);

    if ($('sheetName')) $('sheetName').value = 'Nový hárok';
    if ($('calcName')) $('calcName').value = 'Nový hárok';

    selected = { r: 0, c: 0 };

    renderGrid();
    showView('calc');
    markDirty();
}

function addCalcRow() {
    data.push(Array(cols).fill(''));
    rowHeights.push(34);
    rows++;

    renderGrid();
    markDirty();
    persistRecovery('calc', calcSnapshot());
}

function addCalcColumn() {
    data.forEach(row => row.push(''));
    colWidths.push(110);
    cols++;

    renderGrid();
    markDirty();
    persistRecovery('calc', calcSnapshot());
}

if ($('addRow')) $('addRow').onclick = addCalcRow;
if ($('addCol')) $('addCol').onclick = addCalcColumn;

if ($('clearSheet')) {
    $('clearSheet').onclick = () => {
        if (!confirm('Vymazať celý hárok?')) return;

        data = Array.from(
            { length: rows },
            () => Array(cols).fill('')
        );

        renderGrid();
        markDirty();
        persistRecovery('calc', calcSnapshot());
    };
}

if ($('newSheet')) $('newSheet').onclick = newCalc;

function saveCalc() {
    const snapshot = calcSnapshot();

    const payload = {
        format: 'LSaBP-Office',
        version: 1,
        type: 'excel',
        kind: 'lsac',
        ...snapshot
    };

    saveFile(
        safeName(snapshot.name) + '.lsabp',
        JSON.stringify(payload, null, 2),
        'application/json'
    );

    markSaved();
}

function exportCalc() {
    const lines = [];

    for (let r = 0; r < rows; r++) {
        const row = [];

        for (let c = 0; c < cols; c++) {
            row.push(
                '"' + String(computed(data[r]?.[c] ?? ''))
                    .replace(/"/g, '""') + '"'
            );
        }

        lines.push(row.join(','));
    }

    const name = ($('sheetName') || $('calcName'))?.value || 'Hárok';

    download(
        safeName(name) + '.csv',
        '\ufeff' + lines.join('\r\n'),
        'text/csv;charset=utf-8'
    );

    toast('CSV exportované');
}

if ($('saveSheet')) $('saveSheet').onclick = saveCalc;
if ($('calcSave')) $('calcSave').onclick = saveCalc;
if ($('exportSheet')) $('exportSheet').onclick = exportCalc;
if ($('calcExport')) $('calcExport').onclick = exportCalc;

if ($('exportBook')) {
    $('exportBook').onclick = () => {
        const snapshot = calcSnapshot();

        download(
            safeName(snapshot.name) + '.lsabp',
            JSON.stringify({
                format: 'LSaBP-Office',
                version: 1,
                type: 'excel',
                ...snapshot
            }, null, 2),
            'application/json'
        );
    };
}

const formulaInput = $('formula') || $('formulaBar');

if (formulaInput) {
    formulaInput.onchange = event => {
        data[selected.r][selected.c] = event.target.value;
        renderGrid();
        markDirty();
        persistRecovery('calc', calcSnapshot());
    };
}

/* Automatické rozširovanie tabuľky */

const sheetScroll = document.querySelector('.sheet-scroll');

let expanding = false;

if (sheetScroll) {
    sheetScroll.addEventListener('scroll', () => {
        if (expanding) return;

        const nearBottom =
            sheetScroll.scrollTop + sheetScroll.clientHeight >
            sheetScroll.scrollHeight - 650;

        const nearRight =
            sheetScroll.scrollLeft + sheetScroll.clientWidth >
            sheetScroll.scrollWidth - 500;

        if (!nearBottom && !nearRight) return;

        expanding = true;

        if (nearBottom) {
            for (let i = 0; i < 50; i++) {
                data.push(Array(cols).fill(''));
                rowHeights.push(34);
            }

            rows += 50;
        }

        if (nearRight) {
            data.forEach(row => {
                for (let i = 0; i < 10; i++) row.push('');
            });

            for (let i = 0; i < 10; i++) colWidths.push(110);

            cols += 10;
        }

        renderGrid();
        persistRecovery('calc', calcSnapshot());

        expanding = false;
    });
}

/* ==========================================
   IMPRESS – VERZIA 1.0
   ========================================== */

let slides = [];
let activeSlide = 0;

function defaultSlide() {
    return {
        title: 'Nová snímka',
        subtitle: 'Klikni a pridaj svoj text.',
        texts: []
    };
}

function ensureSlides() {
    if (!slides.length) {
        slides = [{
            title: 'Vitaj v LSaBP Impress',
            subtitle: 'Tvoja prezentácia sa začína.',
            texts: []
        }];
    }
}

function presSnapshot() {
    return {
        name: $('presName')?.value || 'Nová prezentácia',
        slides
    };
}

function renderSlides() {
    ensureSlides();

    if (!$('slideList') || !$('slideCanvas')) return;

    activeSlide = Math.max(
        0,
        Math.min(activeSlide, slides.length - 1)
    );

    const list = $('slideList');

    list.innerHTML = slides.map((slide, index) => `
        <button
            class="slide-thumb ${index === activeSlide ? 'active' : ''}"
            data-slide="${index}"
        >
            <div class="thumb-canvas">
                <b>${escapeHtml(slide.title || 'Bez názvu')}</b>
                <small>${escapeHtml(slide.subtitle || '')}</small>
            </div>
            <small>Snímka ${index + 1}</small>
        </button>
    `).join('');

    list.querySelectorAll('[data-slide]').forEach(button => {
        button.onclick = () => {
            activeSlide = +button.dataset.slide;
            renderSlides();
        };
    });

    const slide = slides[activeSlide];

    $('slideCanvas').innerHTML = `
        <div class="slide-title" contenteditable="true">
            ${escapeHtml(slide.title || '')}
        </div>

        <div class="slide-subtitle" contenteditable="true">
            ${escapeHtml(slide.subtitle || '')}
        </div>

        ${(slide.texts || []).map((text, index) => `
            <div class="slide-text" contenteditable="true" data-text="${index}">
                ${escapeHtml(text)}
            </div>
        `).join('')}
    `;

    const title = $('slideCanvas').querySelector('.slide-title');
    const subtitle = $('slideCanvas').querySelector('.slide-subtitle');

    title.oninput = event => {
        slide.title = event.target.innerText;
        slideChanged();
    };

    subtitle.oninput = event => {
        slide.subtitle = event.target.innerText;
        slideChanged();
    };

    $('slideCanvas').querySelectorAll('[data-text]').forEach(element => {
        element.oninput = () => {
            slide.texts[+element.dataset.text] = element.innerText;
            slideChanged();
        };
    });

    if ($('slideCount')) {
        $('slideCount').textContent =
            `Snímka ${activeSlide + 1} z ${slides.length}`;
    }
}

function slideChanged() {
    markDirty();
    updateThumbs();
    persistRecovery('impress', presSnapshot());
}

function updateThumbs() {
    const active = document.querySelector(
        '.slide-thumb.active .thumb-canvas'
    );

    if (!active) return;

    const slide = slides[activeSlide];

    active.innerHTML =
        '<b>' + escapeHtml(slide.title || 'Bez názvu') + '</b>' +
        '<small>' + escapeHtml(slide.subtitle || '') + '</small>';
}

if ($('addSlide')) {
    $('addSlide').onclick = () => {
        slides.splice(activeSlide + 1, 0, defaultSlide());
        activeSlide++;
        renderSlides();
        slideChanged();
    };
}

if ($('duplicateSlide')) {
    $('duplicateSlide').onclick = () => {
        slides.splice(
            activeSlide + 1,
            0,
            JSON.parse(JSON.stringify(slides[activeSlide]))
        );

        activeSlide++;
        renderSlides();
        slideChanged();
    };
}

if ($('deleteSlide')) {
    $('deleteSlide').onclick = () => {
        if (slides.length === 1) {
            toast('Prezentácia musí mať aspoň jednu snímku.');
            return;
        }

        slides.splice(activeSlide, 1);
        activeSlide = Math.max(0, activeSlide - 1);

        renderSlides();
        slideChanged();
    };
}

if ($('addText')) {
    $('addText').onclick = () => {
        slides[activeSlide].texts.push('Nový text');
        renderSlides();
        slideChanged();
    };
}

function newPres() {
    if (!confirm('Vytvoriť novú prezentáciu?')) return;

    if ($('presName')) $('presName').value = 'Nová prezentácia';

    slides = [defaultSlide()];
    activeSlide = 0;

    renderSlides();
    showView('impress');
    markDirty();
    persistRecovery('impress', presSnapshot());
}

function presentationHTML() {
    return '<!doctype html><html><head><meta charset="utf-8">' +
        '<title>' + escapeHtml($('presName')?.value) + '</title>' +
        '<style>' +
        'body{margin:0;background:#15182a;font-family:Arial}' +
        '.slide{display:none;width:100vw;height:100vh;background:white;' +
        'box-sizing:border-box;padding:9%;flex-direction:column;' +
        'justify-content:center;color:#292d59}' +
        '.slide.active{display:flex}' +
        'h1{font-size:5vw;margin:0 0 3%}' +
        'p{font-size:2vw;color:#737b91}' +
        '.extra{font-size:1.7vw;margin-top:2%}' +
        '</style></head><body>' +

        slides.map((slide, index) => `
            <section class="slide ${index === 0 ? 'active' : ''}">
                <h1>${escapeHtml(slide.title)}</h1>
                <p>${escapeHtml(slide.subtitle)}</p>
                ${(slide.texts || []).map(text =>
                    '<div class="extra">' + escapeHtml(text) + '</div>'
                ).join('')}
            </section>
        `).join('') +

        '<script>' +
        'let n=0,ss=[...document.querySelectorAll(".slide")];' +
        'function go(d){ss[n].classList.remove("active");' +
        'n=(n+d+ss.length)%ss.length;ss[n].classList.add("active")}' +
        'document.addEventListener("keydown",e=>{' +
        'if(e.key==="ArrowRight"||e.key===" ")go(1);' +
        'if(e.key==="ArrowLeft")go(-1);' +
        'if(e.key==="Escape")window.close()});' +
        'document.body.onclick=()=>go(1);' +
        '<\/script></body></html>';
}

if ($('presentBtn')) {
    $('presentBtn').onclick = () => {
        const win = window.open('', '_blank');

        if (!win) {
            toast('Povoľ vyskakovacie okná.');
            return;
        }

        win.document.open();
        win.document.write(presentationHTML());
        win.document.close();
    };
}

function savePres() {
    const snapshot = presSnapshot();

    const payload = {
        kind: 'lsapres',
        version: 2,
        ...snapshot
    };

    saveFile(
        safeName(snapshot.name) + '.lsapres',
        JSON.stringify(payload, null, 2),
        'application/json'
    );

    markSaved();
}

if ($('presSave')) $('presSave').onclick = savePres;
if ($('presOpen')) $('presOpen').onclick = () => openPicker('impress');

if ($('presName')) {
    $('presName').oninput = () => {
        markDirty();
        persistRecovery('impress', presSnapshot());
    };
}

if ($('presExport')) {
    $('presExport').onclick = () => {
        const html = presentationHTML();
        download(
            safeName($('presName')?.value) + '.html',
            html,
            'text/html'
        );
    };
}

/* ==========================================
   SPOLOČNÉ OTVÁRANIE DOKUMENTOV
   ========================================== */

function openDocumentFile(file, text) {
    const extension = file.name.split('.').pop().toLowerCase();

    let payload = null;

    try {
        payload = JSON.parse(text);
    } catch {
        // Bežný textový súbor.
    }

    if (payload && (payload.kind === 'lsaw' || payload.type === 'word')) {
        showView('writer');

        setWriterName(payload.name || 'Dokument');
        if (editor) editor.innerHTML = sanitizeHTML(payload.html || '');

        writerChanged();
        markSaved();
        return;
    }

    if (payload && (payload.kind === 'lsac' || payload.type === 'excel')) {
        showView('calc');

        rows = Math.max(1, Number(payload.rows) || 100);
        cols = Math.max(1, Number(payload.cols) || 26);

        if (payload.data && Array.isArray(payload.data)) {
            data = payload.data;
        } else if (payload.data && typeof payload.data === 'object') {
            data = Array.from(
                { length: rows },
                (_, r) => Array.from(
                    { length: cols },
                    (_, c) => payload.data[colName(c + 1) + (r + 1)] ?? ''
                )
            );
        }

        while (data.length < rows) data.push(Array(cols).fill(''));
        data = data.slice(0, rows).map(row => {
            const result = Array.from({ length: cols }, (_, c) => row[c] ?? '');
            return result;
        });

        colWidths = payload.colWidths || Array(cols).fill(110);
        rowHeights = payload.rowHeights || Array(rows).fill(34);

        if ($('sheetName')) $('sheetName').value = payload.name || 'Hárok';
        if ($('calcName')) $('calcName').value = payload.name || 'Hárok';

        renderGrid();
        markSaved();
        return;
    }

    if (payload && payload.kind === 'lsapres') {
        showView('impress');

        if ($('presName')) $('presName').value = payload.name || 'Prezentácia';

        slides = Array.isArray(payload.slides) ? payload.slides : [];
        activeSlide = 0;

        renderSlides();
        markSaved();
        return;
    }

    if (extension === 'txt' || extension === 'html' || extension === 'htm') {
        showView('writer');

        setWriterName(file.name.replace(/\.[^.]+$/, ''));

        if (editor) {
            editor.innerHTML = extension === 'txt'
                ? '<pre>' + escapeHtml(text) + '</pre>'
                : sanitizeHTML(text);
        }

        writerChanged();
        return;
    }

    if (extension === 'csv') {
        showView('calc');
        importCSV(text, file.name.replace(/\.[^.]+$/, ''));
        return;
    }

    toast('Tento formát súboru nie je podporovaný.');
}

function importCSV(text, name = 'Importovaný hárok') {
    const lines = text.replace(/\r/g, '').split('\n');

    const parsed = lines
        .filter((line, index) => line.length || index < lines.length - 1)
        .map(line => {
            const result = [];
            let current = '';
            let quoted = false;

            for (let i = 0; i < line.length; i++) {
                const char = line[i];

                if (char === '"' && quoted && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else if (char === '"') {
                    quoted = !quoted;
                } else if (char === ',' && !quoted) {
                    result.push(current);
                    current = '';
                } else {
                    current += char;
                }
            }

            result.push(current);
            return result;
        });

    rows = Math.max(100, parsed.length);
    cols = Math.max(26, ...parsed.map(row => row.length));

    data = Array.from(
        { length: rows },
        (_, r) => Array.from(
            { length: cols },
            (_, c) => parsed[r]?.[c] ?? ''
        )
    );

    colWidths = Array(cols).fill(110);
    rowHeights = Array(rows).fill(34);

    if ($('sheetName')) $('sheetName').value = name;
    if ($('calcName')) $('calcName').value = name;

    renderGrid();
    markSaved();
}

const globalPicker = $('filePicker');

if (globalPicker) {
    globalPicker.onchange = event => {
        const file = event.target.files?.[0];
        if (!file) return;

        readFile(file, text => {
            try {
                openDocumentFile(file, text);
            } catch (error) {
                console.error(error);
                toast('Súbor sa nepodarilo otvoriť.');
            }
        });

        event.target.value = '';
    };
}

/* ==========================================
   OBNOVA A AUTOMATICKÉ UKLADANIE
   ========================================== */

function restoreDraft(type) {
    const draft = parseStore(STORE + '_' + type);
    if (!draft) return false;

    if (type === 'writer' && editor && draft.html !== undefined) {
        setWriterName(draft.name || 'Obnovený dokument');
        editor.innerHTML = sanitizeHTML(draft.html);
        wordCount();
        return true;
    }

    if (type === 'calc' && draft.data) {
        rows = draft.rows || 100;
        cols = draft.cols || 26;

        data = draft.data;
        colWidths = draft.colWidths || Array(cols).fill(110);
        rowHeights = draft.rowHeights || Array(rows).fill(34);

        if ($('sheetName')) $('sheetName').value = draft.name || 'Obnovený hárok';
        if ($('calcName')) $('calcName').value = draft.name || 'Obnovený hárok';

        renderGrid();
        return true;
    }

    if (type === 'impress' && Array.isArray(draft.slides)) {
        slides = draft.slides;
        activeSlide = 0;

        if ($('presName')) $('presName').value = draft.name || 'Obnovená prezentácia';

        renderSlides();
        return true;
    }

    return false;
}

function startAutosave() {
    setInterval(() => {
        if (currentView === 'writer' && editor) {
            persistRecovery('writer', writerSnapshot());
        }

        if (currentView === 'calc') {
            persistRecovery('calc', calcSnapshot());
        }

        if (currentView === 'impress') {
            persistRecovery('impress', presSnapshot());
        }
    }, 4000);
}

/* ==========================================
   ŠTART APLIKÁCIE
   ========================================== */

function init() {
    initNavigation();

    renderGrid();
    ensureSlides();
    renderSlides();

    restoreDraft('writer');
    restoreDraft('calc');
    restoreDraft('impress');

    wordCount();
    markSaved();

    startAutosave();
}

window.addEventListener('beforeunload', event => {
    if (dirty) {
        event.preventDefault();
        event.returnValue = '';
    }
});

init();
