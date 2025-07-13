// Socket.io接続
const socket = io();

// グローバルエラーハンドリング
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    showAlert('予期しないエラーが発生しました', 'danger');
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    showAlert('通信エラーが発生しました', 'danger');
    event.preventDefault();
});

// Socket.io エラーハンドリング
socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
    showAlert('サーバーとの接続に失敗しました', 'danger');
});

socket.on('disconnect', (reason) => {
    console.warn('Socket disconnected:', reason);
    if (reason === 'io server disconnect') {
        showAlert('サーバーとの接続が切断されました。再接続を試行中...', 'warning');
    }
});

socket.on('reconnect', (attemptNumber) => {
    console.log('Socket reconnected after', attemptNumber, 'attempts');
    showAlert('サーバーとの接続が復旧しました', 'success');
});

// DOM要素
const serviceForm = document.getElementById('serviceForm');
const activeServicesDiv = document.getElementById('activeServices');
const reminderArea = document.getElementById('reminderArea');
const reminderMessage = document.getElementById('reminderMessage');
const boardMessages = document.getElementById('boardMessages');

// モーダル要素
const endModal = document.getElementById('endModal');
const extendModal = document.getElementById('extendModal');

// リマインダー用の変数
let currentReminderService = null;

// フォーム送信処理
serviceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    
    try {
    try {
        // バリデーション
        const customerCount = parseInt(document.getElementById('customerCount').value);
        const service = document.getElementById('service').value;
        const estimatedAmount = parseInt(document.getElementById('estimatedAmount').value);
        const duration = parseInt(document.getElementById('duration').value);
        const tableNumber = document.getElementById('tableNumber').value.trim();
        const remarks = document.getElementById('remarks').value.trim();
        if (!customerCount || !service || !estimatedAmount || !duration || !tableNumber) {
            showAlert('全ての項目を入力してください', 'warning');
            return;
        }
        if (estimatedAmount < 0) {
            showAlert('金額は0円以上で入力してください', 'warning');
            return;
        }
        // サーバーへ送信
        socket.emit('startService', {
            customerCount,
            service,
            estimatedAmount,
            duration,
            tableNumber,
            remarks
        });
        submitButton.textContent = '送信中...';
        submitButton.disabled = true;
        await new Promise(resolve => setTimeout(resolve, 500));
        showAlert('接客を開始しました', 'success');
        serviceForm.reset();
    } catch (err) {
        showAlert('送信エラー: ' + err.message, 'danger');
    } finally {
        submitButton.textContent = originalText;
        submitButton.disabled = false;
    }
});

// Discord設定フォームの保存処理
const discordConfigForm = document.getElementById('discordConfigForm');
if (discordConfigForm) {
    discordConfigForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const webhook = document.getElementById('discordWebhook').value.trim();
        const channelId = document.getElementById('discordChannelId').value.trim();
        const botToken = document.getElementById('discordBotToken').value.trim();
        if (!webhook || !channelId || !botToken) {
            showAlert('全てのDiscord設定項目を入力してください', 'warning');
            return;
        }
        // ローカルストレージにも保存
        localStorage.setItem('discordWebhook', webhook);
        localStorage.setItem('discordChannelId', channelId);
        localStorage.setItem('discordBotToken', botToken);

        // サーバーにも送信
        try {
            const res = await fetch('/api/discord/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ webhook, channelId, botToken })
            });
            const result = await res.json();
            if (result.success) {
                showAlert('Discord設定を保存しました', 'success');
            } else {
                showAlert(result.error || 'サーバー保存エラー', 'danger');
            }
        } catch (err) {
            showAlert('サーバー通信エラー: ' + err.message, 'danger');
        }
    });
}

// （不要な重複処理を削除）

// Socket.ioイベントハンドラー
socket.on('serviceStarted', (service) => {
    updateActiveServices();
    addBoardMessage({
        timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
        message: `${service.service} ${service.customerCount}名 開始 (${service.duration}分予定)`,
        type: 'started'
    });
});

socket.on('activeServices', (services) => {
    displayActiveServices(services);
});

socket.on('serviceReminder', (reminderData) => {
    showReminder(reminderData);
});

socket.on('serviceExtended', (data) => {
    updateActiveServices();
    addBoardMessage({
        timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
        message: `接客延長: ${data.extensionTime}分`,
        type: 'extended'
    });
});

socket.on('serviceOvertime', (data) => {
    addBoardMessage({
        timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
        message: `⚠️ ${data.service} 時間超過 (+${data.overtimeMinutes}分)`,
        type: 'overtime'
    });
});

socket.on('boardUpdate', (message) => {
    addBoardMessage(message);
    updateActiveServices();
});

// アクティブサービス表示更新
async function updateActiveServices() {
    try {
        const response = await fetch('/api/services/active');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            displayActiveServices(result.services || []);
        } else {
            console.error('Failed to fetch active services:', result.error);
            showAlert('サービス一覧の取得に失敗しました', 'warning');
        }
    } catch (error) {
        console.error('Error fetching active services:', error);
        // ネットワークエラーの場合は静かに失敗（ユーザーには通知しない）
        // 定期的な更新なので、次回の更新で復旧する可能性が高い
    }
}

// アクティブサービス表示
function displayActiveServices(services) {
    if (services.length === 0) {
        activeServicesDiv.innerHTML = '<p>現在アクティブな接客はありません</p>';
        return;
    }
    
    activeServicesDiv.innerHTML = services.map(service => {
        const startTime = new Date(service.startTime);
        const endTime = new Date(service.endTime);
        const now = new Date();
        const remainingMinutes = Math.ceil((endTime - now) / (1000 * 60));
        
        let timeDisplay;
        let timeClass = '';
        
        if (remainingMinutes > 0) {
            timeDisplay = `残り${remainingMinutes}分`;
            if (remainingMinutes <= 10) {
                timeClass = 'urgent';
            }
        } else {
            timeDisplay = `超過${Math.abs(remainingMinutes)}分`;
            timeClass = 'overtime';
        }
        
        return `
            <div class="service-item" data-service-id="${service.id}">
                <div class="service-info">
                    <div class="service-title">${service.service} - ${service.customerCount}名</div>
                    <div class="service-details">
                        開始: ${startTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} | 
                        予定終了: ${endTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} | 
                        金額: ${service.estimatedAmount}円
                    </div>
                </div>
                <div class="service-time ${timeClass}">${timeDisplay}</div>
                <button class="btn btn-end" onclick="showEndModal('${service.id}')">終了</button>
            </div>
        `;
    }).join('');
}

// リマインダー表示
function showReminder(reminderData) {
    currentReminderService = reminderData;
    reminderMessage.innerHTML = `
        <h4>${reminderData.service} - ${reminderData.customerCount}名</h4>
        <p>残り時間: ${reminderData.remainingTime}分</p>
        <p>予定終了: ${reminderData.endTime}</p>
        <p>どうしますか？</p>
    `;
    reminderArea.style.display = 'flex';
}

// リマインダーボタンイベント
document.getElementById('extendBtn').addEventListener('click', () => {
    hideReminder();
    showExtendModal(currentReminderService.serviceId);
});

document.getElementById('halfBtn').addEventListener('click', async () => {
    hideReminder();
    await extendService(currentReminderService.serviceId, 30);
});

document.getElementById('endBtn').addEventListener('click', () => {
    hideReminder();
    showEndModal(currentReminderService.serviceId);
});

// リマインダー非表示
function hideReminder() {
    reminderArea.style.display = 'none';
    currentReminderService = null;
}

// 終了モーダル表示
function showEndModal(serviceId) {
    endModal.style.display = 'flex';
    endModal.dataset.serviceId = serviceId;
}

// 延長モーダル表示
function showExtendModal(serviceId) {
    extendModal.style.display = 'flex';
    extendModal.dataset.serviceId = serviceId;
}

// 終了確定
document.getElementById('confirmEndBtn').addEventListener('click', async () => {
    const serviceId = endModal.dataset.serviceId;
    const actualAmount = document.getElementById('actualAmount').value;
    
    try {
        const response = await fetch('/api/service/end', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                serviceId,
                actualAmount: parseInt(actualAmount) || 0,
                status: 'completed'
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('接客が終了しました', 'success');
            endModal.style.display = 'none';
            document.getElementById('actualAmount').value = '';
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('エラーが発生しました', 'danger');
    }
});

// 延長確定
document.getElementById('confirmExtendBtn').addEventListener('click', async () => {
    const serviceId = extendModal.dataset.serviceId;
    const extensionTime = parseInt(document.getElementById('extensionTime').value);
    
    await extendService(serviceId, extensionTime);
    extendModal.style.display = 'none';
});

// 延長処理
async function extendService(serviceId, extensionTime) {
    try {
        const response = await fetch('/api/service/extend', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                serviceId,
                extensionTime
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert(`${extensionTime}分延長しました`, 'success');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('エラーが発生しました', 'danger');
    }
}

// モーダルキャンセル
document.getElementById('cancelEndBtn').addEventListener('click', () => {
    endModal.style.display = 'none';
});

document.getElementById('cancelExtendBtn').addEventListener('click', () => {
    extendModal.style.display = 'none';
});

// 掲示板メッセージ追加
function addBoardMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `board-message ${message.type}`;
    messageDiv.innerHTML = `
        <span>${message.message}</span>
        <span class="message-time">${message.timestamp}</span>
    `;
    
    boardMessages.insertBefore(messageDiv, boardMessages.firstChild);
    
    // 最大20件まで表示
    const messages = boardMessages.children;
    if (messages.length > 20) {
        boardMessages.removeChild(messages[messages.length - 1]);
    }
}

// アラート表示
function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    
    document.querySelector('.container').insertBefore(alertDiv, document.querySelector('.section'));
    
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.parentNode.removeChild(alertDiv);
        }
    }, 3000);
}

// 初期化：アクティブサービス取得
updateActiveServices();

// 1分ごとにアクティブサービスを更新
setInterval(updateActiveServices, 60000);
