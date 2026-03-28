// 如果 localStorage 沒有資料，拿一下 script.js 裡的預設資料
let nodesData = [];

// 初始化：從 LocalStorage 讀取資料
function loadData() {
    const savedNodes = localStorage.getItem('llmSkillTreeNodes');
    if (savedNodes) {
        try {
            nodesData = JSON.parse(savedNodes);
        } catch (e) {
            console.error("解析錯誤", e);
            nodesData = [];
        }
    } else {
        // 沒有的話自己塞一個基礎點
        nodesData = [
            { id: "start", label: "START", x: 50, y: 80, requires: [], description: "起點" }
        ];
    }
}

// 寫入 LocalStorage 
function saveData() {
    localStorage.setItem('llmSkillTreeNodes', JSON.stringify(nodesData));
    showMessage("資料已儲存到瀏覽器！");
}

let selectedNodeId = null;

// DOM 元素
const form = document.getElementById('node-form');
const nodesContainer = document.getElementById('nodes-container');
const edgesContainer = document.getElementById('edges-container');

// === 渲染預覽區 ===
function renderPreview() {
    edgesContainer.innerHTML = '';
    nodesContainer.innerHTML = '';

    // 渲染線條
    nodesData.forEach(node => {
        if (!node.requires) return;
        node.requires.forEach(reqId => {
            const reqNode = nodesData.find(n => n.id === reqId);
            if (reqNode) {
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', `${reqNode.x}%`);
                line.setAttribute('y1', `${reqNode.y}%`);
                line.setAttribute('x2', `${node.x}%`);
                line.setAttribute('y2', `${node.y}%`);

                // 在編輯器預設線全都是亮的，方便看
                line.setAttribute('class', 'edge active');
                edgesContainer.appendChild(line);
            }
        });
    });

    // 渲染節點
    nodesData.forEach(node => {
        const div = document.createElement('div');
        // 在編輯器預設節點全亮
        div.className = node.id === selectedNodeId ? 'node active selected' : 'node active';
        div.id = `node-${node.id}`;
        div.innerText = node.label;
        div.style.left = `${node.x}%`;
        div.style.top = `${node.y}%`;

        // 點擊事件
        div.addEventListener('mousedown', (e) => {
            // 重要修復：不能在這裡呼叫 selectNode()，因為它會觸發 renderPreview()
            // 銷毀所有 DOM 元素，導致 draggedElement 指向一個已不存在的幽靈元素。
            // 改為：手動更新表單 + 手動切換 selected 樣式
            selectNodeWithoutRerender(node.id);
            startDragging(node, e, div);
        });

        nodesContainer.appendChild(div);
    });
}

// === 拖曳 (Drag & Drop) 邏輯 ===
let isDragging = false;
let draggedNode = null;
let draggedElement = null;
let dragStartX = 0;
let dragStartY = 0;
let initialNodeLeft = 0;
let initialNodeTop = 0;

function startDragging(node, e, element) {
    if (e.target.tagName.toLowerCase() === 'input' || e.target.tagName.toLowerCase() === 'textarea') return;

    isDragging = true;
    draggedNode = node;
    draggedElement = element;

    // 記錄按下的瞬間的滑鼠全域座標
    dragStartX = e.clientX;
    dragStartY = e.clientY;

    // 記錄節點原本在畫布中的 % 數
    initialNodeLeft = node.x;
    initialNodeTop = node.y;

    e.preventDefault();
    element.classList.add('dragging');
}

// 監聽畫布/Global 的滑鼠移動
document.addEventListener('mousemove', (e) => {
    if (!isDragging || !draggedNode || !draggedElement) return;

    // 計算滑鼠移動的像素差值
    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;

    const container = document.getElementById('tree-container');
    const containerRect = container.getBoundingClientRect();

    // 將像素差值轉換成畫布的百分比差值
    const deltaPercentX = (deltaX / containerRect.width) * 100;
    const deltaPercentY = (deltaY / containerRect.height) * 100;

    // 算出新的百分比座標並限制邊界
    let percentX = initialNodeLeft + deltaPercentX;
    let percentY = initialNodeTop + deltaPercentY;

    percentX = Math.max(0, Math.min(100, percentX));
    percentY = Math.max(0, Math.min(100, percentY));

    // 即時更新節點數據
    draggedNode.x = percentX;
    draggedNode.y = percentY;

    // 更新 DOM
    draggedElement.style.left = `${percentX}%`;
    draggedElement.style.top = `${percentY}%`;

    // 即時修改左側表單
    if (selectedNodeId === draggedNode.id) {
        document.getElementById('f-x').value = Math.round(percentX);
        document.getElementById('f-y').value = Math.round(percentY);
    }

    // 即時重繪連線
    renderEdgesForEditor();
});

document.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        if (draggedElement) {
            draggedElement.classList.remove('dragging');
            // 放開滑鼠時將小數點坐標四捨五入收整
            if (draggedNode) {
                draggedNode.x = Math.round(draggedNode.x);
                draggedNode.y = Math.round(draggedNode.y);
                draggedElement.style.left = `${draggedNode.x}%`;
                draggedElement.style.top = `${draggedNode.y}%`;
            }
        }
        draggedElement = null;

        // 拖曳結束後自動觸發儲存
        saveData();
    }
});

// 為了讓拖曳時可以只要更新連線而不要重繪整個節點 (避免閃爍)
function renderEdgesForEditor() {
    edgesContainer.innerHTML = '';
    nodesData.forEach(node => {
        if (!node.requires) return;
        node.requires.forEach(reqId => {
            const reqNode = nodesData.find(n => n.id === reqId);
            if (reqNode) {
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', `${reqNode.x}%`);
                line.setAttribute('y1', `${reqNode.y}%`);
                line.setAttribute('x2', `${node.x}%`);
                line.setAttribute('y2', `${node.y}%`);
                line.setAttribute('class', 'edge active');
                edgesContainer.appendChild(line);
            }
        });
    });
}

// === 表單與互動邏輯 ===

// 選取節點但不重新渲染 (用於拖曳時，避免銷毀 DOM 導致 draggedElement 失效)
function selectNodeWithoutRerender(id) {
    selectedNodeId = id;
    const node = nodesData.find(n => n.id === id);
    if (!node) return;

    // 將資料填寫進表單
    document.getElementById('f-id').value = node.id;
    document.getElementById('f-id').readOnly = false;
    document.getElementById('f-label').value = node.label;
    document.getElementById('f-x').value = node.x;
    document.getElementById('f-y').value = node.y;
    document.getElementById('f-req').value = node.requires ? node.requires.join(', ') : '';
    document.getElementById('f-desc').value = node.description || '';
    renderResourceRows(node.resources || []);
    document.getElementById('btn-delete').style.display = 'inline-block';

    // 手動切換 selected 樣式 (不呼叫 renderPreview)
    document.querySelectorAll('#nodes-container .node').forEach(el => {
        el.classList.remove('selected');
    });
    const el = document.getElementById(`node-${id}`);
    if (el) el.classList.add('selected');
}

// 選取節點並重新渲染 (用於非拖曳情境)
function selectNode(id) {
    selectedNodeId = id;
    const node = nodesData.find(n => n.id === id);
    if (!node) return;

    // 將資料填寫進表單
    document.getElementById('f-id').value = node.id;
    // 現在允許修改 ID，會自動連動修改其他節點的 requires
    document.getElementById('f-id').readOnly = false;

    document.getElementById('f-label').value = node.label;
    document.getElementById('f-x').value = node.x;
    document.getElementById('f-y').value = node.y;

    document.getElementById('f-req').value = node.requires ? node.requires.join(', ') : '';
    document.getElementById('f-desc').value = node.description || '';
    renderResourceRows(node.resources || []);

    document.getElementById('btn-delete').style.display = 'inline-block';

    // 重新渲染套用 selected css
    renderPreview();
}

document.getElementById('btn-add-node').addEventListener('click', () => {
    selectedNodeId = null;
    form.reset();
    
    // 預設帶入初始值
    const newId = 'new-node-' + Math.floor(Math.random() * 1000);
    document.getElementById('f-id').value = newId;
    document.getElementById('f-id').readOnly = false;
    document.getElementById('f-label').value = '新節點名稱';
    document.getElementById('f-x').value = 50;
    document.getElementById('f-y').value = 50;
    document.getElementById('f-req').value = '';
    document.getElementById('f-desc').value = '';
    
    document.getElementById('btn-delete').style.display = 'none';
    renderResourceRows([]);
    renderPreview();
    
    showMessage("✅ 已帶入新增節點的初始值，請編輯後按下上方的 '修改節點'");
});

form.addEventListener('submit', (e) => {
    e.preventDefault();

    const id = document.getElementById('f-id').value.trim();
    const label = document.getElementById('f-label').value.trim();
    const x = parseFloat(document.getElementById('f-x').value);
    const y = parseFloat(document.getElementById('f-y').value);

    const reqStr = document.getElementById('f-req').value;
    const requires = reqStr ? reqStr.split(',').map(s => s.trim()).filter(s => s) : [];

    const description = document.getElementById('f-desc').value.trim();

    // 從結構化輸入欄位讀取學習資源
    const resources = getResourcesFromForm();

    const newNode = { id, label, x, y, requires, description, resources };

    if (selectedNodeId) { // 我們正在編輯一個「已存在」的節點
        if (id !== selectedNodeId) {
            // 如果用戶修改了 ID，確保新 ID 不會跟別人重複
            if (nodesData.some(n => n.id === id)) {
                alert("錯誤：這個 ID 已經被別人使用了！請使用不重複的 ID。");
                return;
            }
            // 自動連動更新所有相依此節點(舊ID)的其他節點的 requires
            nodesData.forEach(node => {
                if (node.requires && node.requires.includes(selectedNodeId)) {
                    node.requires = node.requires.map(req => req === selectedNodeId ? id : req);
                }
            });
        }
        
        // 抓出原本的那筆資料並覆蓋
        const existingIndex = nodesData.findIndex(n => n.id === selectedNodeId);
        if (existingIndex >= 0) {
            nodesData[existingIndex] = newNode;
        }
    } else {
        // 全新的節點
        if (nodesData.some(n => n.id === id)) {
            alert("錯誤：這個 ID 已經存在！請使用不重複的 ID。");
            return;
        }
        nodesData.push(newNode);
    }

    selectedNodeId = id; // 維持選中狀態
    document.getElementById('btn-delete').style.display = 'inline-block';

    saveData();
    renderPreview();
});

document.getElementById('btn-delete').addEventListener('click', () => {
    if (!selectedNodeId) return;
    if (confirm(`確定要刪除節點 ${selectedNodeId} 嗎？這不會自動刪除其他節點對它的依賴！`)) {
        nodesData = nodesData.filter(n => n.id !== selectedNodeId);

        // 選擇性功能：自動把其他節點依賴此節點的項目移除
        nodesData.forEach(node => {
            if (node.requires) {
                node.requires = node.requires.filter(req => req !== selectedNodeId);
            }
        });

        document.getElementById('btn-add-node').click();
        saveData();
        renderPreview();
    }
});

function showMessage(msg) {
    const el = document.getElementById('action-msg');
    el.innerText = msg;
    setTimeout(() => { el.innerText = ''; }, 3000);
}

// === IO ===
document.getElementById('btn-export').addEventListener('click', () => {
    document.getElementById('io-area').value = JSON.stringify(nodesData, null, 2);
    showMessage("✅ 已將星盤資料帶入下方文字框！請複製內容後存為 data.json 並 commit 到 repo。");
});

document.getElementById('btn-import').addEventListener('click', () => {
    const str = document.getElementById('io-area').value.trim();
    if (!str) return;
    try {
        const parsed = JSON.parse(str);
        if (Array.isArray(parsed)) {
            nodesData = parsed;
            saveData();
            document.getElementById('btn-add-node').click();
            renderPreview();
            showMessage("匯入成功！");
        } else {
            alert("匯入失敗：JSON 最外層必須是陣列。");
        }
    } catch (e) {
        alert("匯入失敗：格式不正確的 JSON。");
    }
});

document.getElementById('btn-reset').addEventListener('click', () => {
    if (confirm("這會清除你的所有設定並還原為初期 4 個預設節點的狀態，確定嗎？")) {
        localStorage.removeItem('llmSkillTreeNodes');
        localStorage.removeItem('llmSkillTreeUnlocked');
        window.location.reload(); // 重整頁面讓 script 重新抓預設值
    }
});

// 啟動
loadData();
renderPreview();

// === 學習資源結構化輸入 ===
function renderResourceRows(resources) {
    const container = document.getElementById('resources-list');
    container.innerHTML = '';
    if (resources && resources.length > 0) {
        resources.forEach((res, index) => {
            addResourceRow(res.name || '', res.url || '');
        });
    }
}

function addResourceRow(name, url) {
    const container = document.getElementById('resources-list');
    const row = document.createElement('div');
    row.className = 'resource-row';
    row.innerHTML = `
        <input type="text" placeholder="資源名稱" value="${escapeHtml(name)}" class="res-name">
        <input type="text" placeholder="連結 URL" value="${escapeHtml(url)}" class="res-url">
        <button type="button" class="btn-remove-res" title="刪除">×</button>
    `;
    row.querySelector('.btn-remove-res').addEventListener('click', () => row.remove());
    container.appendChild(row);
}

function getResourcesFromForm() {
    const rows = document.querySelectorAll('#resources-list .resource-row');
    const resources = [];
    rows.forEach(row => {
        const name = row.querySelector('.res-name').value.trim();
        const url = row.querySelector('.res-url').value.trim();
        if (name || url) {
            resources.push({ name, url });
        }
    });
    return resources;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

document.getElementById('btn-add-res').addEventListener('click', () => {
    addResourceRow('', '');
});

document.getElementById('btn-download-json').addEventListener('click', () => {
    saveData();
    const dataStr = JSON.stringify(nodesData, null, 2);
    
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data.json';
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showMessage("✅ 已自動產出並下載 data.json！可以直接拖曳到 GitHub 覆蓋舊檔。");
});
