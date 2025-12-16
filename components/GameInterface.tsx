import React, { useRef, useEffect, useState } from 'react';
import { StoryTurn, GameContext } from '../types';
import { TypewriterText } from './TypewriterText';
import { getTranslation } from '../utils/translations';

interface GameInterfaceProps {
  currentTurn: StoryTurn | null;
  currentImage: string | null;
  currentAudio: string | null;
  gameContext: GameContext;
  onChoice: (choiceText: string) => void;
  onSave: () => void;
  onDownloadBook: () => void;
  isProcessing: boolean;
  