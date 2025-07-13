const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const commands = [
    new SlashCommandBuilder()
        .setName('service')
        .setDescription('接客ログBot操作')
        .addSubcommand(subcommand =>
            subcommand
                .setName('start')
                .setDescription('新規接客を開始')
                .addIntegerOption(option =>
                    option.setName('人数')
                        .setDescription('お客様の人数')
                        .setRequired(true)
                        .addChoices(
                            { name: '1名', value: 1 },
                            { name: '2名', value: 2 },
                            { name: '3名', value: 3 },
                            { name: '4名', value: 4 },
                            { name: '5名以上', value: 5 }
                        ))
                .addStringOption(option =>
                    option.setName('サービス')
                        .setDescription('サービス種類')
                        .setRequired(true)
                        .addChoices(
                            { name: '飲み放題', value: '飲み放題' },
                            { name: 'セット', value: 'セット' },
                            { name: '延長', value: '延長' },
                            { name: 'ハーフ', value: 'ハーフ' },
                            { name: 'その他', value: 'その他' }
                        ))
                .addIntegerOption(option =>
                    option.setName('金額')
                        .setDescription('予想金額（円）')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('時間')
                        .setDescription('予定時間（分）')
                        .setRequired(true)
                        .addChoices(
                            { name: '30分', value: 30 },
                            { name: '60分', value: 60 },
                            { name: '90分', value: 90 },
                            { name: '120分', value: 120 },
                            { name: '150分', value: 150 },
                            { name: '180分', value: 180 }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('現在のアクティブな接客一覧を表示'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('end')
                .setDescription('接客を終了')
                .addStringOption(option =>
                    option.setName('service_id')
                        .setDescription('サービスID')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('実際金額')
                        .setDescription('実際の金額（円）')
                        .setRequired(true)))
];

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('Discord スラッシュコマンドの登録を開始します...');

        // ギルド（サーバー）固有のコマンドとして登録（即座に反映）
        if (process.env.DISCORD_GUILD_ID) {
            const data = await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.DISCORD_GUILD_ID),
                { body: commands }
            );
            console.log(`${data.length}個のスラッシュコマンドをギルドに登録しました。`);
        } else {
            // グローバルコマンドとして登録（反映に時間がかかる）
            const data = await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands }
            );
            console.log(`${data.length}個のスラッシュコマンドをグローバルに登録しました。`);
        }
    } catch (error) {
        console.error('スラッシュコマンドの登録に失敗しました:', error);
    }
})();
