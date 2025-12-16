import { Language } from "../types";

export const TRANSLATIONS = {
  en: {
    title: "DreamQuest",
    subtitle: "Where AI weaves your destiny.",
    charName: "Character Name",
    enterName: "Enter hero's name...",
    selectTheme: "Select Theme",
    customTheme: "Or type a custom theme...",
    begin: "BEGIN ADVENTURE",
    creating: "Creating World...",
    resume: "RESUME SAVED GAME",
    voiceOn: "Voice On",
    mute: "Voice Off",
    bgmOn: "Music On",
    bgmOff: "Music Off",
    option: "Option",
    save: "Save",
    saved: "Saved!",
    download: "Download Storybook",
    painting: "Painting the scene...",
    consulting: "Consulting the oracle...",
    readAloud: "🔊 Read Story Aloud",
    langName: "English",
    themes: {
        "Cyberpunk Detective": "Cyberpunk Detective",
        "High Fantasy Quest": "High Fantasy Quest",
        "Cosmic Horror": "Cosmic Horror",
        "Post-Apocalyptic Survival": "Post-Apocalyptic Survival",
        "Victorian Mystery": "Victorian Mystery",
        "Wacky Cartoon Physics": "Wacky Cartoon Physics"
    }
  },
  zh: {
    title: "梦境探险",
    subtitle: "AI 编织你的命运",
    charName: "角色姓名",
    enterName: "输入英雄大名...",
    selectTheme: "选择主题",
    customTheme: "或者输入自定义主题...",
    begin: "开始冒险",
    creating: "正在生成世界...",
    resume: "继续游戏",
    voiceOn: "语音开启",
    mute: "语音关闭",
    bgmOn: "音乐开启",
    bgmOff: "音乐关闭",
    option: "选项",
    save: "保存",
    saved: "已保存!",
    download: "下载话本",
    painting: "正在绘制场景...",
    consulting: "正在询问神谕...",
    readAloud: "🔊 朗读故事",
    langName: "中文",
    themes: {
        "Cyberpunk Detective": "赛博朋克侦探",
        "High Fantasy Quest": "奇幻史诗",
        "Cosmic Horror": "克苏鲁神话",
        "Post-Apocalyptic Survival": "废土生存",
        "Victorian Mystery": "维多利亚悬疑",
        "Wacky Cartoon Physics": "荒诞卡通物理"
    }
  },
  ja: {
    title: "ドリームクエスト",
    subtitle: "AIが織りなすあなたの運命",
    charName: "キャラクター名",
    enterName: "英雄の名前を入力...",
    selectTheme: "テーマを選択",
    customTheme: "またはカスタムテーマを入力...",
    begin: "冒険を始める",
    creating: "世界を生成中...",
    resume: "ゲームを再開",
    voiceOn: "音声オン",
    mute: "音声オフ",
    bgmOn: "音楽オン",
    bgmOff: "音楽オフ",
    option: "選択肢",
    save: "保存",
    saved: "保存しました!",
    download: "物語をダウンロード",
    painting: "シーンを描画中...",
    consulting: "神託を伺っています...",
    readAloud: "🔊 物語を読み上げる",
    langName: "日本語",
    themes: {
        "Cyberpunk Detective": "サイバーパンク探偵",
        "High Fantasy Quest": "ハイファンタジーの冒険",
        "Cosmic Horror": "コズミックホラー",
        "Post-Apocalyptic Survival": "ポストアポカリプス・サバイバル",
        "Victorian Mystery": "ヴィクトリア朝のミステリー",
        "Wacky Cartoon Physics": "ハチャメチャなカートゥーン物理"
    }
  }
};

export const getTranslation = (lang: Language) => TRANSLATIONS[lang];