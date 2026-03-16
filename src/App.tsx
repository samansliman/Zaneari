/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { Trophy, User, RotateCcw, CheckCircle2, XCircle, Play, X, Search, HelpCircle, BookOpen, Clock, Brain, RefreshCw, Sparkles, Lightbulb, Lock, MessageSquare, ShieldAlert, UserCheck, Home, Timer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Modality } from "@google/genai";
import confetti from 'canvas-confetti';
import { Question, Player, DetectiveStory, Riddle, GameMode } from './types';
import { ALL_QUESTIONS } from './data/questions';
import { DETECTIVE_STORIES } from './data/detectiveStories';
import { RIDDLES } from './data/riddles';

const CATEGORIES_WITH_IMAGES = [
  { name: "هەمووی", image: "https://picsum.photos/seed/all/400/300" },
  { name: "جوگرافیا", image: "https://picsum.photos/seed/geo/400/300" },
  { name: "مێژوو و کەلتوور", image: "https://picsum.photos/seed/history/400/300" },
  { name: "ئەدەبیات", image: "https://picsum.photos/seed/lit/400/300" },
  { name: "سەخت", image: "https://picsum.photos/seed/hard/400/300" }
];

export default function App() {
  const [gameState, setGameState] = useState<'start' | 'modeSelect' | 'categorySelect' | 'playing' | 'gameOver'>('start');
  const [gameMode, setGameMode] = useState<GameMode>('zanyar');
  const [showIntro, setShowIntro] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("هەمووی");
  const [players, setPlayers] = useState<Player[]>([
    { id: 1, name: "یاریزان ١", score: 0 },
    { id: 2, name: "یاریزان ٢", score: 0 },
    { id: 3, name: "یاریزان ٣", score: 0 },
    { id: 4, name: "یاریزان ٤", score: 0 },
  ]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | 'timeout' | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [detectiveStories, setDetectiveStories] = useState<DetectiveStory[]>([]);
  const [riddles, setRiddles] = useState<Riddle[]>([]);
  const [timeLeft, setTimeLeft] = useState(15);
  const volume = 100;
  const [showClue, setShowClue] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [isGettingHint, setIsGettingHint] = useState(false);
  const [dailyFact, setDailyFact] = useState<string | null>(null);
  const [timeLimits, setTimeLimits] = useState({
    zanyar: 15,
    detective: 300,
    riddles: 30
  });

  const [spyWord, setSpyWord] = useState<{word: string, category: string}>({word: "", category: ""});
  const [spyPlayerId, setSpyPlayerId] = useState<number | null>(null);
  const [playersWhoSawWord, setPlayersWhoSawWord] = useState<number[]>([]);
  const [spyGameState, setSpyGameState] = useState<'showingRoles' | 'playing' | 'voting' | 'result'>('showingRoles');
  const [votes, setVotes] = useState<Record<number, number>>({});
  const [votedPlayers, setVotedPlayers] = useState<number[]>([]);
  const [showRole, setShowRole] = useState(false);

  const currentData = gameMode === 'zanyar' ? questions[currentQuestionIndex] 
                   : gameMode === 'detective' ? detectiveStories[currentQuestionIndex]
                   : gameMode === 'riddles' ? riddles[currentQuestionIndex]
                   : spyWord;
  
  const standardData = (gameMode !== 'spy' ? currentData : null) as (Question | DetectiveStory | Riddle | null);
  
  const currentPlayer = players[currentPlayerIndex];

  const SPY_WORDS = [
    { word: "سەیارە", category: "گواستنەوە" },
    { word: "مۆبایل", category: "تەکنەلۆژیا" },
    { word: "نان", category: "خواردن" },
    { word: "کتێب", category: "خوێندن" },
    { word: "دار", category: "سروشت" },
    { word: "ماسی", category: "ئاژەڵ" },
    { word: "قەڵەم", category: "نوسین" },
    { word: "کورسی", category: "کەلوپەل" },
    { word: "تەلەفزیۆن", category: "تەکنەلۆژیا" },
    { word: "پێڵاو", category: "جلوبەرگ" },
    { word: "فڕۆکە", category: "گواستنەوە" },
    { word: "کۆمپیوتەر", category: "تەکنەلۆژیا" },
    { word: "پیتزا", category: "خواردن" },
    { word: "قوتابخانە", category: "شوێن" },
    { word: "باخچە", category: "سروشت" },
    { word: "شێر", category: "ئاژەڵ" },
    { word: "ماڵ", category: "شوێن" },
    { word: "مانگ", category: "گەردوون" },
    { word: "خۆر", category: "گەردوون" },
    { word: "ئاو", category: "سروشت" },
  ];

  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    const handleGlobalClick = async () => {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  useEffect(() => {
    const fetchDailyFact = async () => {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview",
          contents: "بە کوردی زانیارییەکی کورت و سەرنجڕاکێش دەربارەی مێژوو یان کەلتووری کورد بڵێ (تەنها یەک ڕستە).",
        });
        setDailyFact(response.text || "زانیارییەک بەردەست نییە");
      } catch (e) {
        console.error("Failed to fetch fact", e);
      }
    };
    fetchDailyFact();
  }, []);

  const getHint = async () => {
    if (isGettingHint || hint) return;
    setIsGettingHint(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const currentItem = currentData;
      let prompt = "";
      
      if (gameMode === 'riddles') {
        prompt = `ئەم مەتەڵە وەڵامەکەی چییە؟: "${(currentItem as Riddle).question}". وەڵامەکەی بریتییە لە "${(currentItem as Riddle).answer}". تکایە تەنها یەک ئاماژەی کورت (Hint) بدە بەبێ ئەوەی وەڵامەکە ئاشکرا بکەیت. بە کوردی وەڵام بدەوە.`;
      } else if (gameMode === 'detective') {
        const story = currentItem as DetectiveStory;
        const solution = story.options[story.correctAnswer];
        prompt = `ئەم چیرۆکە لێکۆڵینەوەیە: "${story.story}". وەڵامەکەی بریتییە لە "${solution}". تکایە تەنها یەک ئاماژەی کورت (Hint) بدە بەبێ ئەوەی وەڵامەکە ئاشکرا بکەیت. بە کوردی وەڵام بدەوە.`;
      }

      if (prompt) {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview",
          contents: prompt,
        });
        setHint(response.text || "ئاماژەیەک بەردەست نییە");
      }
    } catch (e) {
      console.error("Hint failed", e);
    } finally {
      setIsGettingHint(false);
    }
  };

  const playSoundEffect = (type: 'correct' | 'wrong' | 'click') => {
    if (!audioContextRef.current || !gainNodeRef.current) return;
    
    const ctx = audioContextRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(gainNodeRef.current);
    
    const now = ctx.currentTime;
    
    if (type === 'correct') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.1);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
      gain.gain.linearRampToValueAtTime(0, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'wrong') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(110, now + 0.2);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
      gain.gain.linearRampToValueAtTime(0, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.1, now + 0.01);
      gain.gain.linearRampToValueAtTime(0, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    }
  };

  const playVoice = async (text: string, type: 'feedback' | 'applause' = 'feedback') => {
    try {
      // Ensure AudioContext is initialized and resumed
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioContextRef.current && AudioContextClass) {
        audioContextRef.current = new AudioContextClass();
        gainNodeRef.current = audioContextRef.current.createGain();
        gainNodeRef.current.connect(audioContextRef.current.destination);
      }

      const ctx = audioContextRef.current;
      if (ctx) {
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        // Force resume again just in case
        await ctx.resume();
      }

      if (type === 'applause') {
        const applauseAudio = new Audio("https://www.soundjay.com/human/applause-01.mp3");
        applauseAudio.volume = (volume / 100) * 0.5;
        await applauseAudio.play().catch(async () => {
          if (ctx) await ctx.resume();
          await applauseAudio.play();
        });
        return;
      }

      setIsSpeaking(true);
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `بە کوردی بیڵێ: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio && ctx && gainNodeRef.current) {
        gainNodeRef.current.gain.setValueAtTime(volume / 100, ctx.currentTime);
        const audioData = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0)).buffer;
        const audioBuffer = await ctx.decodeAudioData(audioData);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(gainNodeRef.current);
        source.onended = () => setIsSpeaking(false);
        source.start(0);
      } else {
        throw new Error("No audio data");
      }
    } catch (error) {
      console.error("Voice failed:", error);
      setIsSpeaking(false);
      
      // Fallback to browser TTS with better voice selection
      if (text && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
          
          const utterance = new SpeechSynthesisUtterance(text);
          
          const speak = () => {
            const voices = window.speechSynthesis.getVoices();
            const preferredVoice = voices.find(v => 
              v.lang.toLowerCase().includes('ku') || 
              v.lang.toLowerCase().includes('ar')
            ) || voices.find(v => v.lang.toLowerCase().includes('en'));
            
            if (preferredVoice) utterance.voice = preferredVoice;
            utterance.lang = preferredVoice?.lang || 'ar-SA';
            utterance.volume = volume / 100;
            utterance.rate = 0.85;
            utterance.pitch = 1.0;
            
            utterance.onstart = () => setIsSpeaking(true);
            utterance.onend = () => setIsSpeaking(false);
            utterance.onerror = () => setIsSpeaking(false);
            
            window.speechSynthesis.speak(utterance);
          };

          if (window.speechSynthesis.getVoices().length === 0) {
            window.speechSynthesis.onvoiceschanged = speak;
            // Some browsers need a kick
            setTimeout(speak, 100);
          } else {
            speak();
          }
        } catch (e) {
          console.error("Browser TTS failed:", e);
        }
      }
    }
  };

  const initAudio = async () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass && !audioContextRef.current) {
        audioContextRef.current = new AudioContextClass();
        gainNodeRef.current = audioContextRef.current.createGain();
        gainNodeRef.current.gain.setValueAtTime(volume / 100, audioContextRef.current.currentTime);
        gainNodeRef.current.connect(audioContextRef.current.destination);
      }
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
    } catch (e) {
      console.error("Audio init failed:", e);
    }
  };

  const startModeSelection = async () => {
    await initAudio();
    setGameState('modeSelect');
    playVoice("تکایە جۆری یارییەکە هەڵبژێرە");
  };

  const selectMode = (mode: GameMode) => {
    setGameMode(mode);
    if (mode === 'zanyar') {
      setGameState('categorySelect');
      playVoice("بەشێک هەڵبژێرە بۆ یاری زانیار");
    } else if (mode === 'detective') {
      startDetectiveGame();
    } else if (mode === 'riddles') {
      startRiddlesGame();
    } else if (mode === 'spy') {
      startSpyGame();
    }
  };

  const startSpyGame = () => {
    const randomWord = SPY_WORDS[Math.floor(Math.random() * SPY_WORDS.length)];
    const randomSpy = players[Math.floor(Math.random() * players.length)].id;
    setSpyWord(randomWord);
    setSpyPlayerId(randomSpy);
    setPlayersWhoSawWord([]);
    setSpyGameState('showingRoles');
    setVotes({});
    setVotedPlayers([]);
    setShowRole(false);
    setGameState('playing');
    setCurrentPlayerIndex(0);
    playVoice("یاری وشەی شاراوە دەستی پێکرد. هەر یاریزانێک بە تەنها سەیری وشەکە بکات.");
  };

  const startDetectiveGame = () => {
    const shuffledStories = [...DETECTIVE_STORIES].sort(() => Math.random() - 0.5);
    setDetectiveStories(shuffledStories);
    setGameState('playing');
    setCurrentQuestionIndex(0);
    setTimeLeft(timeLimits.detective);
    playVoice("بەخێربێیت بۆ بەشی لێکۆڵەر، تۆ لێکۆڵەری ئەم تاوانانەیت");
  };

  const startRiddlesGame = () => {
    const shuffledRiddles = [...RIDDLES].sort(() => Math.random() - 0.5);
    setRiddles(shuffledRiddles);
    setGameState('playing');
    setCurrentQuestionIndex(0);
    setTimeLeft(timeLimits.riddles);
    playVoice("بەخێربێیت بۆ بەشی مەتەڵ، بزانم چەند زیرەکیت");
  };

  const startGame = async (category: string) => {
    // Ensure AudioContext is resumed on this user interaction
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    
    setSelectedCategory(category);
    const filteredQuestions = category === "هەمووی" 
      ? [...ALL_QUESTIONS].sort(() => Math.random() - 0.5)
      : ALL_QUESTIONS.filter(q => q.category === category).sort(() => Math.random() - 0.5);
    
    setQuestions(filteredQuestions.slice(0, 12));
    setGameState('playing');
    setCurrentQuestionIndex(0);
    setTimeLeft(timeLimits.zanyar);
  };

  useEffect(() => {
    if (gameState === 'playing' && feedback === null) {
      const player = players[currentPlayerIndex];
      if (gameMode === 'zanyar' && questions[currentQuestionIndex]) {
        playVoice(`${player.name}، پرسیارەکە ئەمەیە: ${questions[currentQuestionIndex].question}`);
      } else if (gameMode === 'detective' && detectiveStories[currentQuestionIndex]) {
        playVoice(`${player.name}، چیرۆکەکە بخوێنەرەوە و تاوانبارەکە بدۆزەرەوە`);
      } else if (gameMode === 'riddles' && riddles[currentQuestionIndex]) {
        playVoice(`${player.name}، مەتەڵەکە ئەمەیە: ${riddles[currentQuestionIndex].question}`);
      }
    }
  }, [gameState, currentQuestionIndex, feedback]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (gameState === 'playing' && feedback === null && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev > 1 && gameMode !== 'detective') {
            // Play a subtle tick sound
            const tick = new Audio("https://www.soundjay.com/buttons/button-20.mp3");
            tick.volume = (volume / 100) * 0.2;
            tick.play().catch(() => {});
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timeLeft === 0 && feedback === null) {
      handleTimeout();
    }
    return () => clearInterval(timer);
  }, [gameState, feedback, timeLeft, gameMode]);

  const handleTimeout = () => {
    setFeedback('timeout');
    if (gameMode === 'detective') {
      playVoice("کات تەواو بوو، وەڵامی ڕاست ئەمەیە");
    } else {
      playVoice("بەداخەوە، کاتەکەت تەواو بوو");
    }
    moveToNextTurn();
  };

  const moveToNextTurn = () => {
    setTimeout(() => {
      setFeedback(null);
      setHint(null);
      setShowClue(false);
      
      const nextIndex = currentQuestionIndex + 1;
      let hasMore = false;
      
      if (gameMode === 'zanyar') {
        hasMore = nextIndex < questions.length;
        setTimeLeft(timeLimits.zanyar);
      } else if (gameMode === 'detective') {
        hasMore = nextIndex < detectiveStories.length;
        setTimeLeft(timeLimits.detective);
      } else if (gameMode === 'riddles') {
        hasMore = nextIndex < riddles.length;
        setTimeLeft(timeLimits.riddles);
      }

      if (hasMore) {
        setCurrentQuestionIndex(nextIndex);
        // In detective mode, players collaborate so we don't necessarily need to switch turns
        // but we can keep it for score tracking if they want to take turns answering
        setCurrentPlayerIndex(prev => (prev + 1) % 4);
      } else {
        setGameState('gameOver');
      }
    }, 3000);
  };

  const CORRECT_FEEDBACKS = [
    "ئەی دەست خۆش، زۆر زیرەکی ماشەڵڵا",
    "ئەی دەست خۆش، مێشکت وەک کۆمپیوتەرە!",
    "هەڵت بڕی! ئەی دەست خۆش",
    "ئافەرم، وەڵامەکەت ڕێک وەک خۆت جوانە",
    "تۆ بلیمەتی یان چی؟ ئەی دەست خۆش",
    "وەڵڵا تۆ جادووت کرد، دەستت خۆش بێت",
    "ئەی دەست خۆش، هەر بژی بۆ ئەو زیرەکییە",
    "ئەی دەست خۆش، وەڵڵا تۆ بێ وێنەی"
  ];

  const WRONG_FEEDBACKS = [
    "خۆت سوک کرد، ئەمە چی بوو؟",
    "خۆت سوک کرد، مێشکت لە کوێیە؟",
    "بەخوا تڕت لێ بڕا، خۆت سوک کرد",
    "ئەمە وەڵامە یان گاڵتە؟ خۆت سوک کرد",
    "بڕۆ بخوێنە ئینجا وەرە یاری بکە، خۆت سوک کرد",
    "وەڵڵا مێشکت ژەنگی هێناوە، خۆت سوک کرد",
    "خۆت سوک کرد، وەڵامەکە هەڵەیە",
    "خۆت سوک کرد، وەڵڵا شەرمەزارییە ئەم وەڵامە",
    "خۆت سوک کرد، مێشکت تێک چووە؟"
  ];

  const handleAnswer = async (optionIndex: number) => {
    if (feedback) return;

    // Aggressively resume audio context on answer click
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    let isCorrect = false;
    if (gameMode === 'zanyar') {
      isCorrect = optionIndex === questions[currentQuestionIndex].correctAnswer;
    } else if (gameMode === 'detective') {
      isCorrect = optionIndex === detectiveStories[currentQuestionIndex].correctAnswer;
    } else if (gameMode === 'riddles') {
      isCorrect = optionIndex === riddles[currentQuestionIndex].correctAnswer;
    }
    
    if (isCorrect) {
      setFeedback('correct');
      playSoundEffect('correct');
      const randomFeedback = CORRECT_FEEDBACKS[Math.floor(Math.random() * CORRECT_FEEDBACKS.length)];
      playVoice(randomFeedback);
      playVoice("", "applause");
      setPlayers(prev => prev.map((p, i) => 
        i === currentPlayerIndex ? { ...p, score: p.score + 1 } : p
      ));
    } else {
      setFeedback('wrong');
      playSoundEffect('wrong');
      const randomFeedback = WRONG_FEEDBACKS[Math.floor(Math.random() * WRONG_FEEDBACKS.length)];
      playVoice(randomFeedback);
    }

    moveToNextTurn();
  };

  const goBack = () => {
    if (gameState === 'modeSelect') setGameState('start');
    else if (gameState === 'categorySelect') setGameState('modeSelect');
    else if (gameState === 'playing') {
      if (window.confirm("ئایا دڵنیایت دەتەوێت لە یارییەکە بڕۆیتە دەرەوە؟")) {
        setGameState('modeSelect');
      }
    }
  };

  const handleSpyVote = (votedId: number) => {
    if (votedPlayers.includes(currentPlayer.id)) return;
    
    setVotes(prev => ({
      ...prev,
      [votedId]: (prev[votedId] || 0) + 1
    }));
    setVotedPlayers(prev => [...prev, currentPlayer.id]);

    if (votedPlayers.length + 1 === players.length) {
      setSpyGameState('result');
      playVoice("ئەنجامەکان دەرکەوتن. کێ سیخوڕەکە بوو؟");
    } else {
      setCurrentPlayerIndex((currentPlayerIndex + 1) % players.length);
      playVoice(`نۆرەی ${players[(currentPlayerIndex + 1) % players.length].name}ە بۆ دەنگدان`);
    }
  };

  const nextSpyPlayer = () => {
    if (playersWhoSawWord.length === players.length) {
      setSpyGameState('playing');
      setCurrentPlayerIndex(0);
      playVoice("هەمووان وشەکەیان بینی. ئێستا کاتی گفتوگۆیە. دوای گفتوگۆ دەست بکەن بە دەنگدان.");
    } else {
      setShowRole(false);
      setCurrentPlayerIndex((currentPlayerIndex + 1) % players.length);
    }
  };

  const markSawWord = () => {
    setPlayersWhoSawWord(prev => [...prev, currentPlayer.id]);
    setShowRole(true);
  };

  const startSpyVoting = () => {
    setSpyGameState('voting');
    setCurrentPlayerIndex(0);
    playVoice("کاتی دەنگدانە. کێ بە سیخوڕ دەزانیت؟");
  };

  const resetGame = async () => {
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    setPlayers(prev => prev.map(p => ({ ...p, score: 0 })));
    setCurrentPlayerIndex(0);
    setCurrentQuestionIndex(0);
    setGameState('start');
    setFeedback(null);
    setTimeLeft(15);
  };

  useEffect(() => {
    if (gameState === 'playing' && currentData && !feedback && gameMode !== 'spy') {
      const text = gameMode === 'zanyar' ? (currentData as Question).question :
                   gameMode === 'detective' ? (currentData as DetectiveStory).story :
                   (currentData as Riddle).question;
      playVoice(text);
    }
  }, [currentQuestionIndex, gameState, gameMode]);

  useEffect(() => {
    if (gameState === 'categorySelect') {
      playVoice("تکایە بەشێک هەڵبژێرە بۆ دەستپێکردنی یارییەکە");
    }
    if (gameState === 'gameOver') {
      const winner = getWinner();
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ef4444', '#ffffff', '#000000']
      });
      playVoice(`یاری کۆتایی هات. پیرۆزە بۆ ${winner.name}، تۆ بوویتە براوە بە ${winner.score} خاڵ`);
    }
  }, [gameState]);

  const getWinner = () => {
    return [...players].sort((a, b) => b.score - a.score)[0];
  };

  const updatePlayerName = (id: number, name: string) => {
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, name } : p));
  };

  const Background = () => (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[#050505]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(220,38,38,0.15),transparent_50%)] animate-pulse" />
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-600/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-900/10 blur-[120px] rounded-full" />
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/carbon-fibre.png")' }} />

      {/* Signature in background */}
      <div className="absolute bottom-12 right-12 opacity-5 pointer-events-none select-none">
        <div className="font-['Dancing_Script',_cursive] text-9xl text-red-600/30 transform -rotate-12">
          Sliman
        </div>
        <div className="font-['Dancing_Script',_cursive] text-8xl text-white/20 transform -rotate-12 -mt-12 ml-24">
          Saman
        </div>
      </div>
    </div>
  );

  const Signature = ({ className = "" }: { className?: string }) => (
    <div className={`flex flex-col items-center justify-center gap-1 ${className}`}>
      <div className="font-['Dancing_Script',_cursive] text-2xl select-none leading-none flex gap-2">
        <span className="text-red-600">Sliman</span>
        <span className="text-white">Saman</span>
      </div>
      <div className="text-[11px] text-slate-400 font-bold tracking-wide">دروستکەری یاری</div>
    </div>
  );

  if (showIntro) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-white font-sans relative overflow-hidden" dir="rtl">
        <Background />
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-md space-y-6 bg-black/60 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl relative text-right"
        >
          <div className="bg-red-600 w-16 h-16 rounded-2xl flex items-center justify-center mr-0 shadow-lg shadow-red-500/20 text-white mb-6">
            <User size={32} />
          </div>
          
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">بەخێربێن</h2>
          </div>

          <button
            onClick={async () => {
              await initAudio();
              setShowIntro(false);
            }}
            className="w-full py-4 bg-red-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-red-700 transition-all active:scale-95 shadow-lg shadow-red-500/20 mt-8"
          >
            <Play size={20} />
            دەستپێکردن
          </button>

          <div className="pt-4 border-t border-slate-100">
            <Signature />
          </div>
        </motion.div>
      </div>
    );
  }

  if (gameState === 'start') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-white font-sans relative overflow-hidden" dir="rtl">
        <Background />
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-md space-y-6 bg-black/60 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl relative"
        >
          {/* Logo Section */}
          <div className="absolute -top-10 left-1/2 -translate-x-1/2">
            <div className="bg-black/40 backdrop-blur-md p-2 rounded-2xl shadow-xl border border-white/10">
              <Signature />
            </div>
          </div>

          <div className="text-right space-y-4 pt-4">
            <div className="bg-red-600 w-16 h-16 rounded-2xl flex items-center justify-center mr-0 shadow-lg shadow-red-500/20 text-white">
              <Trophy size={32} />
            </div>
            <div className="space-y-1">
              <h1 className="text-3xl font-black tracking-tight text-red-600">زانیار</h1>
              <p className="text-slate-400 text-xs">کێبڕکێی زانیاری گشتی</p>
            </div>
          </div>

          <div className="space-y-4">
            {players.map((player) => (
              <div key={player.id} className="relative">
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  value={player.name}
                  onChange={(e) => updatePlayerName(player.id, e.target.value)}
                  placeholder={`ناوی یاریزانی ${player.id}`}
                  className="w-full bg-white/5 border-2 border-white/10 rounded-xl py-3 pr-12 pl-4 focus:border-red-500 focus:outline-none transition-colors text-right text-white font-bold placeholder:text-slate-600"
                />
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            {dailyFact && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-white/5 border border-white/10 rounded-2xl mb-2"
              >
                <div className="flex items-center gap-2 text-red-500 mb-1">
                  <Sparkles size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">ئایا دەزانی؟</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{dailyFact}</p>
              </motion.div>
            )}
            <button
              onClick={startModeSelection}
              className="w-full py-4 bg-red-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-red-700 transition-all active:scale-95 shadow-lg shadow-red-500/20"
            >
              <Play size={20} />
              دەستپێکردنی یاری
            </button>
            <p className="text-[10px] text-slate-400 text-center">ئاستی دەنگی یاری: {volume}%</p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (gameState === 'modeSelect') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-white font-sans relative overflow-hidden" dir="rtl">
        <Background />
        
        <button 
          onClick={goBack}
          className="fixed top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all z-50"
        >
          <RotateCcw className="rotate-180" size={24} />
        </button>

        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-3xl space-y-6 bg-black/60 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl"
        >
          <div className="text-right space-y-4">
            <h1 className="text-2xl font-bold tracking-tight text-red-600">هەڵبژاردنی جۆری یاری</h1>
            <p className="text-slate-400 text-xs">یەکێک لەم جۆرانە هەڵبژێرە بۆ دەستپێکردن</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <button
              onClick={() => selectMode('zanyar')}
              className="group relative overflow-hidden rounded-2xl border-2 border-white/10 hover:border-red-500 transition-all active:scale-95 h-40 sm:h-48"
            >
              <img 
                src="https://upload.wikimedia.org/wikipedia/commons/d/d3/Albert_Einstein_Head.jpg" 
                alt="Zanyar" 
                className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col items-center justify-end p-3">
                <Brain size={24} className="text-red-500 mb-1" />
                <span className="font-bold text-sm sm:text-lg">زانیار</span>
                <span className="text-[8px] sm:text-[10px] text-slate-400">پرسیار و وەڵام</span>
              </div>
            </button>

            <button
              onClick={() => selectMode('detective')}
              className="group relative overflow-hidden rounded-2xl border-2 border-white/10 hover:border-red-500 transition-all active:scale-95 h-40 sm:h-48"
            >
              <img 
                src="https://upload.wikimedia.org/wikipedia/commons/c/cd/Sherlock_Holmes_Portrait_Paget.jpg" 
                alt="Detective" 
                className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col items-center justify-end p-3">
                <Search size={24} className="text-red-500 mb-1" />
                <span className="font-bold text-sm sm:text-lg">لێکۆڵەر</span>
                <span className="text-[8px] sm:text-[10px] text-slate-400">چیرۆکی تاوان</span>
              </div>
            </button>

            <button
              onClick={() => selectMode('riddles')}
              className="group relative overflow-hidden rounded-2xl border-2 border-white/10 hover:border-red-500 transition-all active:scale-95 h-40 sm:h-48"
            >
              <div className="absolute inset-0 z-0">
                <img 
                  src="https://upload.wikimedia.org/wikipedia/commons/3/35/Flag_of_Kurdistan.svg" 
                  alt="Riddles" 
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col items-center justify-end p-3 z-20">
                <HelpCircle size={24} className="text-red-500 mb-1" />
                <span className="font-bold text-sm sm:text-lg">مەتەڵ</span>
                <span className="text-[8px] sm:text-[10px] text-slate-400">مەتەڵی کوردی</span>
              </div>
            </button>

            <button
              onClick={() => selectMode('spy')}
              className="group relative overflow-hidden rounded-2xl border-2 border-white/10 hover:border-red-500 transition-all active:scale-95 h-40 sm:h-48"
            >
              <div className="absolute inset-0 z-0 bg-slate-900">
                <UserCheck size={48} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/10" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col items-center justify-end p-3 z-20">
                <ShieldAlert size={24} className="text-red-500 mb-1" />
                <span className="font-bold text-sm sm:text-lg">وشەی شاراوە</span>
                <span className="text-[8px] sm:text-[10px] text-slate-400">کێ سیخوڕەکەیە؟</span>
              </div>
            </button>
          </div>

          <div className="pt-4 border-t border-white/10">
            <Signature />
          </div>
        </motion.div>
      </div>
    );
  }

  if (gameState === 'categorySelect') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-white font-sans relative overflow-hidden" dir="rtl">
        <Background />

        <button 
          onClick={goBack}
          className="fixed top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all z-50"
        >
          <RotateCcw className="rotate-180" size={24} />
        </button>

        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-2xl space-y-6 bg-black/60 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl"
        >
          <div className="text-right space-y-4">
            <h1 className="text-2xl font-bold tracking-tight text-red-600">هەڵبژاردنی بەش</h1>
            <p className="text-slate-400 text-xs">بەشێک هەڵبژێرە بۆ دەستپێکردنی یارییەکە</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {CATEGORIES_WITH_IMAGES.map((cat) => (
              <button
                key={cat.name}
                onClick={() => startGame(cat.name)}
                className="group relative overflow-hidden rounded-2xl border-2 border-white/10 hover:border-red-500 transition-all active:scale-95"
              >
                <img 
                  src={cat.image} 
                  alt={cat.name} 
                  className="w-full h-32 object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-3">
                  <span className="font-bold text-sm">{cat.name}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="pt-4 border-t border-white/10">
            <Signature />
          </div>
        </motion.div>
      </div>
    );
  }

  if (gameState === 'gameOver') {
    const winner = getWinner();
    if (!winner) return null;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-white font-sans relative overflow-hidden" dir="rtl">
        <Background />
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="w-full max-w-md bg-black/60 backdrop-blur-xl rounded-3xl p-6 border border-white/10 text-right space-y-6 shadow-2xl"
        >
          <div className="bg-yellow-500/20 w-16 h-16 rounded-full flex items-center justify-center mr-0 text-yellow-600">
            <Trophy size={32} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">یاری کۆتایی هات!</h2>
            <p className="text-slate-400 text-sm">براوەی یارییەکە:</p>
            <div className="text-3xl font-black text-red-600 mt-4">{winner.name}</div>
            <p className="text-lg font-medium">بە کۆی {winner.score} خاڵ</p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4">
            {players.map(p => (
              <div key={p.id} className="bg-white/5 p-4 rounded-2xl border border-white/10 text-right">
                <div className="text-sm text-slate-400">{p.name}</div>
                <div className="text-xl font-bold text-red-600">{p.score} خاڵ</div>
              </div>
            ))}
          </div>

          <button
            onClick={resetGame}
            className="w-full py-4 bg-red-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-red-700 transition-colors"
          >
            <RotateCcw size={20} />
            دووبارە دەستپێکردنەوە
          </button>

          <div className="pt-4 border-t border-slate-100">
            <Signature />
          </div>
        </motion.div>
      </div>
    );
  }

  if (!currentData && gameMode !== 'spy') return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const totalItems = gameMode === 'zanyar' ? questions.length 
                   : gameMode === 'detective' ? detectiveStories.length 
                   : gameMode === 'riddles' ? riddles.length
                   : 1;

  return (
    <div className="min-h-screen flex flex-col text-white font-sans relative overflow-hidden" dir="rtl">
      <Background />
      
      {/* Watermark Logo */}
      <div className="fixed bottom-4 left-4 opacity-40 pointer-events-none z-50">
        <Signature className="scale-75 origin-bottom-left" />
      </div>

      {/* Header with Scores */}
      <div className="flex flex-col bg-black/40 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <button 
              onClick={goBack}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-all"
            >
              <RotateCcw className="rotate-180" size={16} />
            </button>
            <div className="text-xs text-slate-400 font-medium">
              {gameMode === 'zanyar' ? 'زانیار' : gameMode === 'detective' ? 'لێکۆڵەر' : gameMode === 'riddles' ? 'مەتەڵ' : 'سیخوڕ'}
            </div>
            {isSpeaking && (
              <motion.div 
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 0.5 }}
                className="w-2 h-2 bg-red-500 rounded-full"
              />
            )}
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={resetGame}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-all text-slate-400 hover:text-white"
              title="سەرەتا"
            >
              <Home size={16} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 p-4">
          {players.map((p, i) => (
            <div 
              key={p.id} 
              className={`p-2 rounded-xl text-right transition-all ${
                i === currentPlayerIndex 
                  ? 'bg-red-600 ring-2 ring-red-400 scale-105 text-white' 
                  : 'bg-white/5 opacity-60'
              }`}
            >
              <div className="text-[10px] truncate font-bold text-white">{p.name}</div>
              <div className="text-lg font-bold">{p.score}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Feedback Overlay */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: -20 }}
            className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
          >
            <div className={`px-8 py-4 rounded-3xl shadow-2xl backdrop-blur-xl border-2 flex flex-col items-center gap-2 ${
              feedback === 'correct' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 
              feedback === 'wrong' ? 'bg-rose-500/20 border-rose-500 text-rose-400' :
              'bg-amber-500/20 border-amber-500 text-amber-400'
            }`}>
              {feedback === 'correct' ? <CheckCircle2 size={48} /> : 
               feedback === 'wrong' ? <XCircle size={48} /> : <Timer size={48} />}
              <span className="text-2xl font-black">
                {feedback === 'correct' ? 'ڕاستە!' : 
                 feedback === 'wrong' ? 'هەڵەیە!' : 'کات تەواو بوو!'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Game Area */}
      <main className="flex-1 flex flex-col items-center p-6 space-y-6 overflow-y-auto">
        {gameMode === 'spy' ? (
          <div className="w-full max-w-md space-y-6">
            {spyGameState === 'showingRoles' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/5 border border-white/10 p-8 rounded-3xl text-center space-y-6"
              >
                <h2 className="text-2xl font-bold text-red-500">نۆرەی {currentPlayer.name}</h2>
                <p className="text-slate-400">تکایە بە تەنها سەیری وشەکە بکە</p>
                
                <div className="h-32 flex items-center justify-center">
                  <AnimatePresence mode="wait">
                    {showRole ? (
                      <motion.div
                        key="role"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="space-y-2"
                      >
                        <div className="text-sm text-slate-500">وشەکە بریتییە لە:</div>
                        <div className="text-4xl font-black text-white">
                          {currentPlayer.id === spyPlayerId ? "تۆ سیخوڕیت!" : spyWord.word}
                        </div>
                        <div className="text-xs text-red-400">جۆر: {spyWord.category}</div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="hidden"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="w-24 h-24 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20"
                      >
                        <Lock size={32} className="text-slate-500" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex flex-col gap-3">
                  {!showRole ? (
                    <button
                      onClick={markSawWord}
                      className="w-full py-4 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 transition-all"
                    >
                      بینینی وشەکە
                    </button>
                  ) : (
                    <button
                      onClick={nextSpyPlayer}
                      className="w-full py-4 bg-white/10 text-white font-bold rounded-2xl hover:bg-white/20 transition-all"
                    >
                      تەواو، شاردمەوە
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {spyGameState === 'playing' && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white/5 border border-white/10 p-8 rounded-3xl text-center space-y-8"
              >
                <div className="w-20 h-20 bg-red-600/20 rounded-full flex items-center justify-center mx-auto border border-red-500/30">
                  <MessageSquare size={32} className="text-red-500" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-white">کاتی گفتوگۆ</h2>
                  <p className="text-slate-400 text-sm">هەمووان باسی وشەکە بکەن بەبێ ئەوەی ئاشکرای بکەن. سیخوڕەکەش هەوڵ بدات خۆی بشارێتەوە.</p>
                </div>
                <button
                  onClick={startSpyVoting}
                  className="w-full py-4 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 transition-all shadow-lg shadow-red-500/20"
                >
                  دەستپێکردنی دەنگدان
                </button>
              </motion.div>
            )}

            {spyGameState === 'voting' && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                <div className="text-center space-y-2">
                  <h2 className="text-xl font-bold text-white">نۆرەی {currentPlayer.name} بۆ دەنگدان</h2>
                  <p className="text-slate-400 text-sm">کێ بە سیخوڕ دەزانیت؟</p>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {players.map(p => (
                    <button
                      key={p.id}
                      disabled={p.id === currentPlayer.id}
                      onClick={() => handleSpyVote(p.id)}
                      className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${
                        p.id === currentPlayer.id ? 'opacity-30 grayscale cursor-not-allowed' : 'bg-white/5 border-white/10 hover:border-red-500'
                      }`}
                    >
                      <span className="font-bold text-white">{p.name}</span>
                      <User size={18} className="text-slate-500" />
                    </button>
                  ))}
                </div>
                <div className="text-center text-xs text-slate-500">
                  {votedPlayers.length} لە {players.length} یاریزان دەنگیان داوە
                </div>
              </motion.div>
            )}

            {spyGameState === 'result' && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white/5 border border-white/10 p-8 rounded-3xl text-center space-y-8"
              >
                <div className="w-24 h-24 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto border border-yellow-500/30">
                  <Search size={48} className="text-yellow-500" />
                </div>
                
                <div className="space-y-4">
                  <h2 className="text-3xl font-black text-white">ئەنجام</h2>
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                    <div className="text-sm text-slate-400 mb-1">سیخوڕەکە بریتی بوو لە:</div>
                    <div className="text-2xl font-bold text-red-500">
                      {players.find(p => p.id === spyPlayerId)?.name}
                    </div>
                  </div>
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                    <div className="text-sm text-slate-400 mb-1">وشەکە بریتی بوو لە:</div>
                    <div className="text-2xl font-bold text-emerald-500">{spyWord.word}</div>
                  </div>
                </div>

                <button
                  onClick={resetGame}
                  className="w-full py-4 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 transition-all"
                >
                  دووبارە دەستپێکردنەوە
                </button>
              </motion.div>
            )}
          </div>
        ) : (
          <>
            <div className="w-full max-w-md space-y-4">
          <div className="flex flex-row-reverse items-center justify-between gap-4">
            <div className="inline-block px-3 py-1 bg-red-600/20 text-white rounded-full text-xs font-bold">
              نۆرەی {currentPlayer.name}
            </div>
            
            {/* Timer Circle */}
            <div className="relative w-16 h-16 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="transparent"
                  className="text-white/10"
                />
                <motion.circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="transparent"
                  strokeDasharray="175.8"
                  animate={{ strokeDashoffset: 175.8 - (175.8 * timeLeft) / (gameMode === 'detective' ? timeLimits.detective : gameMode === 'riddles' ? timeLimits.riddles : timeLimits.zanyar) }}
                  className={`${timeLeft <= 5 ? 'text-rose-500' : 'text-red-600'}`}
                />
              </svg>
              <div className="absolute flex flex-col items-center leading-none">
                <Clock size={12} className="mb-1 opacity-50" />
                <span className={`text-sm font-bold ${timeLeft <= 10 ? 'text-rose-500 animate-pulse' : 'text-white'}`}>
                  {formatTime(timeLeft)}
                </span>
              </div>
            </div>
          </div>
          
          {gameMode === 'detective' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 border border-white/10 p-4 rounded-2xl space-y-3"
            >
              <img 
                src={(currentData as DetectiveStory).image} 
                alt={(currentData as DetectiveStory).title}
                className="w-full h-48 object-cover rounded-xl border border-white/10 mb-2"
                referrerPolicy="no-referrer"
              />
              <div className="flex items-center justify-between">
                <h3 className="text-red-500 font-bold text-lg">{(currentData as DetectiveStory).title}</h3>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                  (currentData as DetectiveStory).type === 'horror' ? 'border-purple-500 text-purple-400 bg-purple-500/10' :
                  (currentData as DetectiveStory).type === 'tragedy' ? 'border-blue-500 text-blue-400 bg-blue-500/10' :
                  'border-red-500 text-red-400 bg-red-500/10'
                }`}>
                  {(currentData as DetectiveStory).type === 'horror' ? 'ترسناک' : 
                   (currentData as DetectiveStory).type === 'tragedy' ? 'تراژیدی' : 'نهێنی'}
                </span>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed text-right">
                {(currentData as DetectiveStory).story}
              </p>
              
              <div className="flex items-center justify-between pt-2">
                <button 
                  onClick={() => setShowClue(!showClue)}
                  className="text-xs text-red-400 underline flex items-center gap-1"
                >
                  <HelpCircle size={12} />
                  {showClue ? 'شاردنەوەی سەرەداو' : 'بینینی سەرەداو'}
                </button>

                <button 
                  onClick={getHint}
                  disabled={isGettingHint || !!hint}
                  className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                    hint ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  <Lightbulb size={12} />
                  {isGettingHint ? 'چاوەڕوانبە...' : hint ? 'ئاماژە درا' : 'ئاماژەی ژیری دەستکرد'}
                </button>
              </div>

              <AnimatePresence>
                {hint && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                      <p className="text-xs text-yellow-200 leading-relaxed text-right italic">
                        " {hint} "
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence>
                {showClue && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="bg-red-600/10 p-3 rounded-xl border border-red-500/20"
                  >
                    <ul className="text-[11px] text-red-300 list-disc list-inside space-y-1">
                      {(currentData as DetectiveStory).clues.map((clue, i) => (
                        <li key={i}>{clue}</li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {gameMode === 'riddles' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white/5 border border-white/10 p-6 rounded-2xl space-y-6"
            >
              <img 
                src={`https://picsum.photos/seed/riddle-${currentQuestionIndex}/400/300`} 
                alt="Riddle" 
                className="w-full h-40 object-cover rounded-xl border border-white/10 mb-4"
                referrerPolicy="no-referrer"
              />
              <div className="flex items-center justify-center gap-3 mb-4">
                <HelpCircle className="text-red-500" size={32} />
                <h3 className="text-xl font-bold text-white">مەتەڵ</h3>
              </div>
            </motion.div>
          )}

          <h2 className="text-xl font-bold leading-tight text-white text-right">
            {standardData?.question}
          </h2>

          {(gameMode === 'riddles' || gameMode === 'detective') && (
            <div className="flex justify-center pt-2">
              <button 
                onClick={getHint}
                disabled={isGettingHint || !!hint}
                className={`flex items-center gap-2 text-sm px-4 py-2 rounded-xl border transition-all ${
                  hint ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                }`}
              >
                <Lightbulb size={16} />
                {isGettingHint ? 'چاوەڕوانبە...' : hint ? 'ئاماژە درا' : 'ئاماژەی ژیری دەستکرد (AI Hint)'}
              </button>
            </div>
          )}

          <AnimatePresence>
            {hint && gameMode === 'riddles' && (
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl w-full"
              >
                <p className="text-sm text-yellow-200 leading-relaxed italic text-center">
                  " {hint} "
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="grid grid-cols-1 gap-3 w-full max-w-md">
          {standardData?.options.map((option, index) => (
            <button
              key={index}
              onClick={() => handleAnswer(index)}
              disabled={!!feedback}
              className={`w-full p-4 text-right rounded-2xl font-bold text-base transition-all border-2 ${
                feedback === null
                  ? 'bg-white/5 border-white/10 text-white hover:border-red-500 active:scale-95 shadow-sm'
                  : index === standardData.correctAnswer
                  ? 'bg-emerald-600 border-emerald-400 text-white scale-105'
                  : feedback === 'wrong' && index !== standardData.correctAnswer
                  ? 'bg-rose-900/20 border-rose-800/30 text-rose-300 opacity-50'
                  : 'bg-white/5 border-white/5 opacity-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>{option}</span>
                {feedback && index === standardData.correctAnswer && <CheckCircle2 size={20} />}
              </div>
            </button>
          ))}
          </div>
          </>
        )}
      </main>

      {/* Progress */}
      {gameMode !== 'spy' && (
        <div className="p-6 bg-black/40 backdrop-blur-md border-t border-white/10">
          <div className="flex justify-between text-sm text-slate-400 mb-2">
            <span>پرسیاری {currentQuestionIndex + 1} لە {totalItems}</span>
          </div>
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-red-600 transition-all duration-500"
              style={{ width: `${((currentQuestionIndex + 1) / totalItems) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Feedback Overlay */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
          >
            <div className={`p-8 rounded-full shadow-2xl flex flex-col items-center gap-4 ${
              feedback === 'correct' ? 'bg-emerald-500' : 'bg-rose-500'
            }`}>
              {feedback === 'correct' ? <CheckCircle2 size={80} /> : <XCircle size={80} />}
              {feedback === 'timeout' && <span className="text-xl font-bold">کات تەواو بوو!</span>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


