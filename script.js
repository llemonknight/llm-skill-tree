// === 全域變數 ===
let nodesData = [];
let unlockedNodes = new Set();

const nodesContainer = document.getElementById('nodes-container');
const edgesContainer = document.getElementById('edges-container');
const tooltip = document.getElementById('tooltip');

// === 初始化：從 data.json 載入星盤結構 ===
async function loadTreeData() {
    try {
        const response = await fetch('data.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        nodesData = await response.json();
    } catch (e) {
        console.error("無法載入星盤資料 (data.json)，請確認檔案存在。", e);
        // Fallback: 如果 fetch 失敗 (例如本地 file:// 開啟)，嘗試從 localStorage 讀取
        const saved = localStorage.getItem('llmSkillTreeNodes');
        if (saved) {
            try { nodesData = JSON.parse(saved); } catch (err) { nodesData = []; }
        }
    }

    // 載入使用者的學習進度 (已解鎖節點)
    const savedUnlocked = localStorage.getItem('llmSkillTreeUnlocked');
    if (savedUnlocked) {
        try {
            unlockedNodes = new Set(JSON.parse(savedUnlocked));
        } catch (e) {
            console.error("解析解鎖狀態失敗", e);
        }
    }

    // 啟動圖譜渲染
    initTree();
}

// 初始化圖譜
function initTree() {
    renderEdges();
    renderNodes();
    updateNodeStates();
}

// 渲染節點連線 (SVG)
function renderEdges() {
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
                line.setAttribute('class', 'edge');
                line.setAttribute('id', `edge-${reqNode.id}-${node.id}`);
                edgesContainer.appendChild(line);
            }
        });
    });
}

// 渲染節點 (HTML div)
function renderNodes() {
    nodesContainer.innerHTML = '';

    nodesData.forEach(node => {
        const div = document.createElement('div');
        div.className = 'node';
        div.id = `node-${node.id}`;
        div.innerText = node.label;

        div.style.left = `${node.x}%`;
        div.style.top = `${node.y}%`;

        // 事件監聽: 點擊解鎖
        div.addEventListener('click', () => handleNodeClick(node.id));

        // 事件監聽: Hover 顯示 Tooltip
        div.addEventListener('mouseenter', (e) => showTooltip(node, e));
        div.addEventListener('mouseleave', hideTooltip);

        nodesContainer.appendChild(div);
    });
}

// 處理點擊邏輯
function handleNodeClick(nodeId) {
    if (unlockedNodes.has(nodeId)) {
        // 再點一次 = 取消解鎖 (退回)，依賴它的後續節點也會一起被取消
        removeNodeAndDependents(nodeId);
        updateNodeStates();
        return;
    }

    const node = nodesData.find(n => n.id === nodeId);
    if (!node) return;

    let canUnlock = true;
    if (node.requires && node.requires.length > 0) {
        canUnlock = node.requires.every(reqId => unlockedNodes.has(reqId));
    }

    if (canUnlock) {
        unlockedNodes.add(nodeId);
        localStorage.setItem('llmSkillTreeUnlocked', JSON.stringify(Array.from(unlockedNodes)));
        updateNodeStates();
    } else {
        const el = document.getElementById(`node-${nodeId}`);
        el.style.transform = "translate(-50%, -50%) scale(0.95)";
        setTimeout(() => {
            el.style.transform = "translate(-50%, -50%) scale(1)";
        }, 150);
    }
}

// 遞迴移除自身以及所有依賴自己的節點
function removeNodeAndDependents(nodeId) {
    unlockedNodes.delete(nodeId);
    nodesData.forEach(node => {
        if (node.requires && node.requires.includes(nodeId) && unlockedNodes.has(node.id)) {
            removeNodeAndDependents(node.id);
        }
    });
    localStorage.setItem('llmSkillTreeUnlocked', JSON.stringify(Array.from(unlockedNodes)));
}

// 更新節點與連線的視覺狀態
function updateNodeStates() {
    nodesData.forEach(node => {
        const el = document.getElementById(`node-${node.id}`);
        if (!el) return;

        if (unlockedNodes.has(node.id)) {
            el.className = 'node active';
        } else {
            let canUnlock = true;
            if (node.requires && node.requires.length > 0) {
                canUnlock = node.requires.every(reqId => unlockedNodes.has(reqId));
            }
            el.className = canUnlock ? 'node unlockable' : 'node';
        }

        if (node.requires) {
            node.requires.forEach(reqId => {
                const edgeEl = document.getElementById(`edge-${reqId}-${node.id}`);
                if (edgeEl) {
                    edgeEl.setAttribute('class',
                        (unlockedNodes.has(node.id) && unlockedNodes.has(reqId)) ? 'edge active' : 'edge'
                    );
                }
            });
        }
    });
}

// === Tooltip 邏輯 ===
let tooltipTimeout;

function showTooltip(node, event) {
    clearTimeout(tooltipTimeout);

    let html = `<h3>${node.label}</h3>`;
    html += node.description ? `<p>${node.description}</p>` : `<p>暫無說明。</p>`;

    if (node.resources && node.resources.length > 0) {
        html += `<div class="tooltip-resources"><h4>學習資源</h4><ul>`;
        node.resources.forEach(res => {
            html += `<li><a href="${res.url}" target="_blank" rel="noopener noreferrer">${res.name}</a></li>`;
        });
        html += `</ul></div>`;
    }

    tooltip.innerHTML = html;

    const rect = event.target.getBoundingClientRect();
    const container = document.getElementById('tree-container');
    const containerRect = container.getBoundingClientRect();
    const tooltipWidth = 280;

    let left = (rect.right - containerRect.left) + 20;
    let top = (rect.top - containerRect.top);

    if (left + tooltipWidth > containerRect.width) {
        left = (rect.left - containerRect.left) - tooltipWidth - 20;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.classList.remove('hidden');
}

function hideTooltip() {
    tooltipTimeout = setTimeout(() => {
        tooltip.classList.add('hidden');
    }, 200);
}

tooltip.addEventListener('mouseenter', () => clearTimeout(tooltipTimeout));
tooltip.addEventListener('mouseleave', hideTooltip);

// === 畫布平移 (Canvas Panning) ===
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let currentPanX = 0;
let currentPanY = 0;

const treeContainer = document.getElementById('tree-container');

function startPan(x, y) {
    isPanning = true;
    panStartX = x;
    panStartY = y;
    treeContainer.classList.add('panning');
}

function doPan(x, y) {
    const deltaX = x - panStartX;
    const deltaY = y - panStartY;
    treeContainer.style.transform = `translate(${currentPanX + deltaX}px, ${currentPanY + deltaY}px)`;
}

function endPan(x, y) {
    currentPanX += x - panStartX;
    currentPanY += y - panStartY;
    isPanning = false;
    treeContainer.classList.remove('panning');
}

// === 滑鼠支援 (DeskTop) ===
treeContainer.addEventListener('mousedown', (e) => {
    if (e.target.closest('.node') || e.target.closest('.tooltip')) return;
    startPan(e.clientX, e.clientY);
    e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    doPan(e.clientX, e.clientY);
});

document.addEventListener('mouseup', (e) => {
    if (!isPanning) return;
    endPan(e.clientX, e.clientY);
});

// === 觸控支援 (Mobile) ===
treeContainer.addEventListener('touchstart', (e) => {
    // 只有單指觸控且沒有點在節點上時觸發畫面平移
    if (e.target.closest('.node') || e.target.closest('.tooltip') || e.touches.length !== 1) return;
    startPan(e.touches[0].clientX, e.touches[0].clientY);
});

document.addEventListener('touchmove', (e) => {
    if (!isPanning || e.touches.length !== 1) return;
    doPan(e.touches[0].clientX, e.touches[0].clientY);
    e.preventDefault(); // 防止發動手機原生的下拉重新整理或頁面捲動效應
}, { passive: false });

document.addEventListener('touchend', (e) => {
    if (!isPanning) return;
    if (e.changedTouches.length > 0) {
        endPan(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    }
});

// === 使用者學習進度匯出 / 匯入 ===
function exportProgress() {
    const data = {
        version: 1,
        unlockedNodes: Array.from(unlockedNodes),
        exportDate: new Date().toISOString()
    };
    const jsonStr = JSON.stringify(data, null, 2);

    // 建立 Blob 產生 JSON 檔案
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    // 建立隱藏的下載連結
    const a = document.createElement('a');
    a.href = url;
    
    // 動態命名下載檔名加上日期
    const dateStr = new Date().toISOString().split('T')[0];
    a.download = `llm-progress-${dateStr}.json`;
    
    // 觸發下載
    document.body.appendChild(a);
    a.click();
    
    // 清理
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert('✅ 學習進度存檔已成功下載！\n\n下次需要還原時，只要用「記事本」打開這個 .json 檔案，把裡面的文字全選並複製，然後貼到「匯入進度」中即可。');
}

function importProgress() {
    const useFile = confirm('您想要用上傳 .json 檔案的方式匯入嗎？\n\n- 按【確定】：選擇剛剛下載的 .json 檔案\n- 按【取消】：用手動貼上文字代碼的方式');
    
    if (useFile) {
        // 1. 上傳檔案方式
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.style.display = 'none';
        
        fileInput.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = function(event) {
                processImportData(event.target.result);
            };
            reader.readAsText(file);
        };
        
        document.body.appendChild(fileInput);
        fileInput.click();
        document.body.removeChild(fileInput);
    } else {
        // 2. 貼上文字方式
        const input = prompt('請貼上您之前匯出的學習進度 JSON 代碼：');
        if (input) {
            processImportData(input);
        }
    }
}

// 實際處理 JSON 解析的核心邏輯
function processImportData(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        if (data.unlockedNodes && Array.isArray(data.unlockedNodes)) {
            unlockedNodes = new Set(data.unlockedNodes);
            localStorage.setItem('llmSkillTreeUnlocked', JSON.stringify(data.unlockedNodes));
            updateNodeStates();
            alert('✅ 學習進度已成功還原！');
        } else {
            alert('❌ 格式不正確，請確認上傳/貼上的選項是有效的進度資料。');
        }
    } catch (e) {
        alert('❌ JSON 解析失敗，請確認檔案沒有損壞或格式錯誤。');
    }
}

function resetProgress() {
    if (confirm('確定要重置所有學習進度嗎？這會清除您已點亮的所有天賦點。')) {
        unlockedNodes = new Set();
        localStorage.removeItem('llmSkillTreeUnlocked');
        updateNodeStates();
    }
}

// 啟動
loadTreeData();
