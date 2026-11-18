'use client';

import type {
  ExcelState,
  FileState,
  QuestionAsset,
  QuestionType,
  SimulatorState,
  WebState,
  WordState,
} from '@/lib/types';
import WordSimulator from './WordSimulator';
import ExcelSimulator from './ExcelSimulator';
import WebSimulator from './WebSimulator';
import FileManagerSimulator from './FileManagerSimulator';

interface SimulatorRendererProps {
  type: QuestionType;
  value: SimulatorState;
  onChange?: (next: SimulatorState) => void;
  assets?: QuestionAsset[];
  readOnly?: boolean;
}

export default function SimulatorRenderer({
  type,
  value,
  onChange,
  assets,
  readOnly = false,
}: SimulatorRendererProps) {
  const noop = () => {};

  if (type === 'word') {
    return (
      <WordSimulator
        value={value as WordState}
        onChange={(next) => (onChange || noop)(next)}
        assets={assets}
        readOnly={readOnly}
      />
    );
  }
  if (type === 'excel') {
    return (
      <ExcelSimulator
        value={value as ExcelState}
        onChange={(next) => (onChange || noop)(next)}
        readOnly={readOnly}
      />
    );
  }
  if (type === 'web') {
    return (
      <WebSimulator
        value={value as WebState}
        onChange={(next) => (onChange || noop)(next)}
        assets={assets}
        readOnly={readOnly}
      />
    );
  }
  return (
    <FileManagerSimulator
      value={value as FileState}
      onChange={(next) => (onChange || noop)(next)}
      readOnly={readOnly}
    />
  );
}
