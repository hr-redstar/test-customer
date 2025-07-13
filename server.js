const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const moment = require('moment');
const path = require('path');
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
require('dotenv').config();

// プロセスレベルのエラーハンドリング
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    console.error('Stack:', error.stack);
    // アプリケーションを安全にシャットダウン
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // アプリケーションを安全にシャットダウン
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
        process.exit(0);
    });
});

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    // Cloud Runでの動作を考慮してポーリングを有効化
    transports: ['polling', 'websocket']
});

// Discord Bot初期化
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

let discordChannel = null;
let discordReady = false;

// Discord Bot エラーハンドリング
client.on('error', (error) => {
    console.error('Discord client error:', error);
});

client.on('warn', (warning) => {
    console.warn('Discord client warning:', warning);
});

client.on('shardError', (error) => {
    console.error('Discord shard error:', error);
});

client.on('disconnect', () => {
    console.warn('Discord client disconnected');
    discordReady = false;
});

client.on('reconnecting', () => {
    console.log('Discord client reconnecting...');
});

client.on('resume', () => {
    console.log('Discord client resumed');
    discordReady = true;
});

// ミドルウェア設定
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// 接客ログを保存するデータ構造
let serviceLogs = [];
let activeServices = new Map(); // アクティブな接客サービス

// 静的ファイルの提供
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Discord設定をメモリに保存する変数
let discordConfig = {
    webhook: process.env.DISCORD_WEBHOOK || '',
    channelId: process.env.DISCORD_CHANNEL_ID || '',
    botToken: process.env.DISCORD_BOT_TOKEN || ''
};

// Discord設定保存API
app.post('/api/discord/config', (req, res) => {
    const { webhook, channelId, botToken } = req.body;
    if (!webhook || !channelId || !botToken) {
        return res.status(400).json({ success: false, error: '全ての項目が必須です' });
    }
    discordConfig = { webhook, channelId, botToken };
    console.log('Discord設定を更新:', discordConfig);
    // 必要に応じてBot再起動やWebhook再設定処理をここに追加
    res.json({ success: true });
});

// 接客ログ入力エンドポイント
app.post('/api/service/start', (req, res) => {
    try {
        const { customerCount, service, estimatedAmount, duration } = req.body;
        
        // バリデーション
        if (!customerCount || !service || !estimatedAmount || !duration) {
            return res.status(400).json({
                success: false,
                error: '必須フィールドが不足しています'
            });
        }
        
        if (typeof customerCount !== 'number' || customerCount < 1 || customerCount > 10) {
            return res.status(400).json({
                success: false,
                error: '人数は1-10の数値で入力してください'
            });
        }
        
        if (typeof estimatedAmount !== 'number' || estimatedAmount < 0) {
            return res.status(400).json({
                success: false,
                error: '金額は0以上の数値で入力してください'
            });
        }
        
        if (typeof duration !== 'number' || duration < 10 || duration > 600) {
            return res.status(400).json({
                success: false,
                error: '時間は10-600分の範囲で入力してください'
            });
        }
        
        const serviceId = Date.now().toString();
        const startTime = moment();
        const endTime = moment().add(duration, 'minutes');
        
        const serviceLog = {
            id: serviceId,
            customerCount,
            service,
            estimatedAmount,
            duration,
            startTime: startTime.format(),
            endTime: endTime.format(),
            status: 'active',
            reminderSent: false
        };
        
        serviceLogs.push(serviceLog);
        activeServices.set(serviceId, serviceLog);
        
        // リアルタイムでクライアントに通知
        io.emit('serviceStarted', serviceLog);
        
        console.log(`新しい接客開始: ${service} - ${customerCount}名 - ${duration}分`);
        
        res.json({ success: true, serviceId, serviceLog });
    } catch (error) {
        console.error('Service start error:', error);
        res.status(500).json({
            success: false,
            error: 'サービス開始処理でエラーが発生しました'
        });
    }
});

// 接客終了エンドポイント
app.post('/api/service/end', (req, res) => {
    try {
        const { serviceId, actualAmount, status } = req.body;
        
        // バリデーション
        if (!serviceId) {
            return res.status(400).json({
                success: false,
                error: 'サービスIDが必要です'
            });
        }
        
        const service = activeServices.get(serviceId);
        if (!service) {
            return res.status(404).json({
                success: false,
                error: 'サービスが見つかりません'
            });
        }
        
        if (actualAmount !== undefined && (typeof actualAmount !== 'number' || actualAmount < 0)) {
            return res.status(400).json({
                success: false,
                error: '実際金額は0以上の数値で入力してください'
            });
        }
        
        service.actualAmount = actualAmount || service.estimatedAmount;
        service.status = status || 'completed';
        service.endedAt = moment().format();
        
        activeServices.delete(serviceId);
        
        // 店況・掲示板への転送
        const boardMessage = createBoardMessage(service);
        io.emit('boardUpdate', boardMessage);
        
        console.log(`接客終了: ${service.service} - 実際金額: ${service.actualAmount}円`);
        
        res.json({ success: true, boardMessage });
    } catch (error) {
        console.error('Service end error:', error);
        res.status(500).json({
            success: false,
            error: 'サービス終了処理でエラーが発生しました'
        });
    }
});

// 延長エンドポイント
app.post('/api/service/extend', (req, res) => {
    try {
        const { serviceId, extensionTime } = req.body;
        
        // バリデーション
        if (!serviceId) {
            return res.status(400).json({
                success: false,
                error: 'サービスIDが必要です'
            });
        }
        
        if (!extensionTime || typeof extensionTime !== 'number' || extensionTime < 5 || extensionTime > 300) {
            return res.status(400).json({
                success: false,
                error: '延長時間は5-300分の範囲で入力してください'
            });
        }
        
        const service = activeServices.get(serviceId);
        if (!service) {
            return res.status(404).json({
                success: false,
                error: 'サービスが見つかりません'
            });
        }
        
        const newEndTime = moment(service.endTime).add(extensionTime, 'minutes');
        service.endTime = newEndTime.format();
        service.duration += extensionTime;
        service.reminderSent = false; // リマインダーをリセット
        
        // 延長情報をクライアントに通知
        io.emit('serviceExtended', { serviceId, newEndTime: service.endTime, extensionTime });
        
        console.log(`接客延長: ${service.service} - ${extensionTime}分延長`);
        
        res.json({ success: true, newEndTime: service.endTime });
    } catch (error) {
        console.error('Service extend error:', error);
        res.status(500).json({
            success: false,
            error: 'サービス延長処理でエラーが発生しました'
        });
    }
});

// アクティブなサービス一覧取得
app.get('/api/services/active', (req, res) => {
    try {
        const activeServicesList = Array.from(activeServices.values());
        res.json({
            success: true,
            services: activeServicesList,
            count: activeServicesList.length
        });
    } catch (error) {
        console.error('Get active services error:', error);
        res.status(500).json({
            success: false,
            error: 'アクティブサービス取得でエラーが発生しました'
        });
    }
});

// 店況・掲示板メッセージ作成
function createBoardMessage(service) {
    const duration = moment(service.endedAt).diff(moment(service.startTime), 'minutes');
    return {
        timestamp: moment().format('HH:mm'),
        message: `${service.service} ${service.customerCount}名 ${duration}分 ${service.actualAmount || service.estimatedAmount}円 終了`,
        type: service.status
    };
}

// 10分前リマインダーのスケジュール処理
cron.schedule('* * * * *', () => { // 1分ごとにチェック
    try {
        const now = moment();
        
        activeServices.forEach((service, serviceId) => {
            try {
                const endTime = moment(service.endTime);
                const timeDiff = endTime.diff(now, 'minutes');
                
                // 10分前にリマインダー送信（まだ送信していない場合）
                if (timeDiff <= 10 && timeDiff > 9 && !service.reminderSent) {
                    service.reminderSent = true;
                    
                    const reminderData = {
                        serviceId,
                        service: service.service,
                        customerCount: service.customerCount,
                        remainingTime: timeDiff,
                        endTime: endTime.format('HH:mm')
                    };
                    
                    io.emit('serviceReminder', reminderData);
                    sendDiscordReminder(reminderData); // Discord通知も送信
                    console.log(`リマインダー送信: ${service.service} - 残り${timeDiff}分`);
                }
                
                // 時間超過チェック
                if (timeDiff < 0 && service.status === 'active') {
                    io.emit('serviceOvertime', {
                        serviceId,
                        service: service.service,
                        overtimeMinutes: Math.abs(timeDiff)
                    });
                }
            } catch (serviceError) {
                console.error(`Service ${serviceId} processing error:`, serviceError);
                // 個別のサービス処理エラーでもcronは継続
            }
        });
    } catch (error) {
        console.error('Cron job error:', error);
        // cronジョブのエラーでもアプリケーションは継続
    }
});

// Socket.io接続処理
io.on('connection', (socket) => {
    try {
        console.log('クライアント接続:', socket.id);
        
        // 接続時にアクティブなサービス一覧を送信
        const activeServicesList = Array.from(activeServices.values());
        socket.emit('activeServices', activeServicesList);
        
        socket.on('disconnect', (reason) => {
            console.log('クライアント切断:', socket.id, 'reason:', reason);
        });
        
        socket.on('error', (error) => {
            console.error('Socket error:', socket.id, error);
        });
    } catch (error) {
        console.error('Socket connection error:', error);
    }
});

// Discord Bot機能
client.once('ready', async () => {
    try {
        console.log(`Discord Bot ready! Logged in as ${client.user.tag}`);
        discordReady = true;
        
        // 指定されたチャンネルを取得
        if (process.env.DISCORD_CHANNEL_ID) {
            discordChannel = await client.channels.fetch(process.env.DISCORD_CHANNEL_ID);
            console.log(`Discord channel connected: ${discordChannel.name}`);
        }
    } catch (error) {
        console.error('Discord ready error:', error);
        discordReady = false;
    }
});

// Discordスラッシュコマンド処理
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'service') {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'start') {
            await handleDiscordServiceStart(interaction);
        } else if (subcommand === 'list') {
            await handleDiscordServiceList(interaction);
        } else if (subcommand === 'end') {
            await handleDiscordServiceEnd(interaction);
        }
    }
});

// Discord Botボタンインタラクション処理
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    const [action, serviceId, option] = interaction.customId.split('_');

    if (action === 'reminder') {
        await handleDiscordReminderAction(interaction, serviceId, option);
    }
});

// Discord用の接客開始処理
async function handleDiscordServiceStart(interaction) {
    try {
        const customerCount = interaction.options.getInteger('人数');
        const service = interaction.options.getString('サービス');
        const estimatedAmount = interaction.options.getInteger('金額');
        const duration = interaction.options.getInteger('時間');

        // バリデーション
        if (!customerCount || !service || !estimatedAmount || !duration) {
            await interaction.reply({
                content: '❌ 必須項目が不足しています。',
                ephemeral: true
            });
            return;
        }

        const serviceId = Date.now().toString();
        const startTime = moment();
        const endTime = moment().add(duration, 'minutes');

        const serviceLog = {
            id: serviceId,
            customerCount,
            service,
            estimatedAmount,
            duration,
            startTime: startTime.format(),
            endTime: endTime.format(),
            status: 'active',
            reminderSent: false,
            discordUserId: interaction.user.id,
            channelId: interaction.channelId // コマンドを実行したチャンネルID
        };

        serviceLogs.push(serviceLog);
        activeServices.set(serviceId, serviceLog);

        const embed = new EmbedBuilder()
            .setColor(0x00AE86)
            .setTitle('🎯 接客開始')
            .addFields(
                { name: '👥 人数', value: `${customerCount}名`, inline: true },
                { name: '🍸 サービス', value: service, inline: true },
                { name: '💰 予想金額', value: `${estimatedAmount}円`, inline: true },
                { name: '⏰ 予定時間', value: `${duration}分`, inline: true },
                { name: '🕐 開始時刻', value: startTime.format('HH:mm'), inline: true },
                { name: '🕐 終了予定', value: endTime.format('HH:mm'), inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `Service ID: ${serviceId}` });

        await interaction.reply({ embeds: [embed] });

        // 指定されたチャンネルにも通知を送信
        if (discordChannel && discordChannel.id !== interaction.channelId) {
            try {
                const notificationEmbed = new EmbedBuilder()
                    .setColor(0x00AE86)
                    .setTitle('🆕 新規接客開始')
                    .setDescription(`${interaction.user.tag} が接客を開始しました`)
                    .addFields(
                        { name: '🍸 サービス', value: `${service} - ${customerCount}名`, inline: true },
                        { name: '💰 予想金額', value: `${estimatedAmount}円`, inline: true },
                        { name: '⏰ 予定時間', value: `${duration}分`, inline: true },
                        { name: '📍 チャンネル', value: `<#${interaction.channelId}>`, inline: true }
                    )
                    .setTimestamp()
                    .setFooter({ text: `Service ID: ${serviceId}` });

                await discordChannel.send({ embeds: [notificationEmbed] });
            } catch (error) {
                console.error('Failed to send notification to specified channel:', error);
            }
        }

        // Webクライアントにも通知
        io.emit('serviceStarted', serviceLog);

        console.log(`Discord経由で接客開始: ${service} - ${customerCount}名 - ${duration}分`);
    } catch (error) {
        console.error('Discord service start error:', error);
        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: '❌ 接客開始処理でエラーが発生しました。',
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: '❌ 接客開始処理でエラーが発生しました。',
                    ephemeral: true
                });
            }
        } catch (replyError) {
            console.error('Failed to send error message:', replyError);
        }
    }
}

// Discord用のサービス一覧表示
async function handleDiscordServiceList(interaction) {
    const activeServicesList = Array.from(activeServices.values());

    if (activeServicesList.length === 0) {
        await interaction.reply('現在アクティブな接客はありません。');
        return;
    }

    const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('📋 現在の接客状況');

    activeServicesList.forEach((service, index) => {
        const endTime = moment(service.endTime);
        const now = moment();
        const remainingMinutes = Math.ceil(endTime.diff(now, 'minutes'));
        
        let status = remainingMinutes > 0 ? `残り${remainingMinutes}分` : `超過${Math.abs(remainingMinutes)}分`;
        
        embed.addFields({
            name: `${index + 1}. ${service.service} - ${service.customerCount}名`,
            value: `💰 ${service.estimatedAmount}円 | ⏰ ${status} | 🕐 ${moment(service.startTime).format('HH:mm')}〜${moment(service.endTime).format('HH:mm')}`,
            inline: false
        });
    });

    await interaction.reply({ embeds: [embed] });
}

// Discord用の接客終了処理
async function handleDiscordServiceEnd(interaction) {
    const serviceId = interaction.options.getString('service_id');
    const actualAmount = interaction.options.getInteger('実際金額');

    const service = activeServices.get(serviceId);
    if (!service) {
        await interaction.reply('❌ 指定されたサービスが見つかりません。');
        return;
    }

    service.actualAmount = actualAmount;
    service.status = 'completed';
    service.endedAt = moment().format();

    activeServices.delete(serviceId);

    const duration = moment(service.endedAt).diff(moment(service.startTime), 'minutes');

    const embed = new EmbedBuilder()
        .setColor(0x28A745)
        .setTitle('✅ 接客終了')
        .addFields(
            { name: '🍸 サービス', value: service.service, inline: true },
            { name: '👥 人数', value: `${service.customerCount}名`, inline: true },
            { name: '⏱️ 実際時間', value: `${duration}分`, inline: true },
            { name: '💰 実際金額', value: `${actualAmount}円`, inline: true },
            { name: '💵 差額', value: `${actualAmount - service.estimatedAmount}円`, inline: true }
        )
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    // 店況・掲示板への転送
    const boardMessage = createBoardMessage(service);
    io.emit('boardUpdate', boardMessage);

    console.log(`Discord経由で接客終了: ${service.service} - 実際金額: ${actualAmount}円`);
}

// Discord用のリマインダーアクション処理
async function handleDiscordReminderAction(interaction, serviceId, option) {
    const service = activeServices.get(serviceId);
    if (!service) {
        await interaction.reply({ content: '❌ サービスが見つかりません。', ephemeral: true });
        return;
    }

    if (option === 'extend') {
        // 延長処理（60分延長）
        const extensionTime = 60;
        const newEndTime = moment(service.endTime).add(extensionTime, 'minutes');
        service.endTime = newEndTime.format();
        service.duration += extensionTime;
        service.reminderSent = false;

        const embed = new EmbedBuilder()
            .setColor(0xFFC107)
            .setTitle('⏰ 接客延長')
            .addFields(
                { name: '🍸 サービス', value: service.service, inline: true },
                { name: '⏱️ 延長時間', value: `${extensionTime}分`, inline: true },
                { name: '🕐 新終了予定', value: newEndTime.format('HH:mm'), inline: true }
            )
            .setTimestamp();

        await interaction.update({ embeds: [embed], components: [] });

        // クライアントに通知
        io.emit('serviceExtended', { serviceId, newEndTime: service.endTime, extensionTime });

    } else if (option === 'half') {
        // ハーフ延長（30分）
        const extensionTime = 30;
        const newEndTime = moment(service.endTime).add(extensionTime, 'minutes');
        service.endTime = newEndTime.format();
        service.duration += extensionTime;
        service.reminderSent = false;

        const embed = new EmbedBuilder()
            .setColor(0xFFC107)
            .setTitle('⏰ ハーフ延長')
            .addFields(
                { name: '🍸 サービス', value: service.service, inline: true },
                { name: '⏱️ 延長時間', value: `${extensionTime}分`, inline: true },
                { name: '🕐 新終了予定', value: newEndTime.format('HH:mm'), inline: true }
            )
            .setTimestamp();

        await interaction.update({ embeds: [embed], components: [] });

        // クライアントに通知
        io.emit('serviceExtended', { serviceId, newEndTime: service.endTime, extensionTime });

    } else if (option === 'end') {
        // 終了処理
        service.actualAmount = service.estimatedAmount; // デフォルトで予想金額を設定
        service.status = 'completed';
        service.endedAt = moment().format();

        activeServices.delete(serviceId);

        const duration = moment(service.endedAt).diff(moment(service.startTime), 'minutes');

        const embed = new EmbedBuilder()
            .setColor(0xDC3545)
            .setTitle('✅ 接客終了')
            .addFields(
                { name: '🍸 サービス', value: service.service, inline: true },
                { name: '👥 人数', value: `${service.customerCount}名`, inline: true },
                { name: '⏱️ 実際時間', value: `${duration}分`, inline: true },
                { name: '💰 金額', value: `${service.estimatedAmount}円`, inline: true }
            )
            .setTimestamp();

        await interaction.update({ embeds: [embed], components: [] });

        // 店況・掲示板への転送
        const boardMessage = createBoardMessage(service);
        io.emit('boardUpdate', boardMessage);
    }
}

// Discord Botでリマインダーを送信
async function sendDiscordReminder(reminderData) {
    try {
        if (!discordReady) {
            console.warn('Discord bot not ready for reminder');
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(0xFF6B35)
            .setTitle('⏰ 接客リマインダー')
            .setDescription(`**${reminderData.service}** - **${reminderData.customerCount}名**`)
            .addFields(
                { name: '⏱️ 残り時間', value: `${reminderData.remainingTime}分`, inline: true },
                { name: '🕐 終了予定', value: reminderData.endTime, inline: true }
            )
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`reminder_${reminderData.serviceId}_extend`)
                    .setLabel('延長 (60分)')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('⏰'),
                new ButtonBuilder()
                    .setCustomId(`reminder_${reminderData.serviceId}_half`)
                    .setLabel('ハーフ (30分)')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🕐'),
                new ButtonBuilder()
                    .setCustomId(`reminder_${reminderData.serviceId}_end`)
                    .setLabel('終了')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('✅')
            );

        // 指定されたチャンネルに送信
        if (discordChannel) {
            try {
                await discordChannel.send({ embeds: [embed], components: [row] });
                console.log(`Discord reminder sent to channel ${discordChannel.name}`);
            } catch (error) {
                console.error('Failed to send reminder to specified channel:', error);
            }
        }

        // コマンドを実行したチャンネルにも送信
        const service = activeServices.get(reminderData.serviceId);
        if (service && service.channelId && service.channelId !== discordChannel?.id) {
            try {
                const commandChannel = await client.channels.fetch(service.channelId);
                await commandChannel.send({ 
                    content: `<@${service.discordUserId}> 接客リマインダーです！`,
                    embeds: [embed], 
                    components: [row] 
                });
                console.log(`Discord reminder sent to command channel ${commandChannel.name}`);
            } catch (error) {
                console.error('Failed to send reminder to command channel:', error);
            }
        }

    } catch (error) {
        console.error('Discordへのリマインダー送信に失敗:', error);
        // Discord送信に失敗してもアプリケーションは継続
    }
}

// エラーハンドリングミドルウェア
app.use((err, req, res, next) => {
    console.error('Express error:', err.stack);
    
    if (res.headersSent) {
        return next(err);
    }
    
    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' 
            ? 'Internal Server Error' 
            : err.message
    });
});

// 404ハンドラー
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Not Found'
    });
});

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
    const health = {
        timestamp: new Date().toISOString(),
        status: 'OK',
        uptime: process.uptime(),
        discord: discordReady ? 'connected' : 'disconnected',
        activeServices: activeServices.size
    };
    
    res.status(200).json(health);
});

const PORT = process.env.PORT || 8080;

server.listen(PORT, '0.0.0.0', () => {
    console.log(`接客ログBotサーバーが起動しました: http://localhost:${PORT}`);
    console.log(`環境: ${process.env.NODE_ENV || 'development'}`);
    console.log(`プロセスID: ${process.pid}`);
}).on('error', (error) => {
    console.error('Server startup error:', error);
    process.exit(1);
});

// Discord Botログイン
if (process.env.DISCORD_TOKEN) {
    client.login(process.env.DISCORD_TOKEN).catch((error) => {
        console.error('Discord Bot login failed:', error);
        console.log('アプリケーションはWebモードのみで続行します');
    });
} else {
    console.log('DISCORD_TOKENが設定されていないため、Discord Bot機能は無効です。');
}
