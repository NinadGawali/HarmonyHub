import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button, TextInput } from './ui';
import styles from './AiFillPanel.module.css';

const MAX_PROMPT_LENGTH = 300;
const COUNTS = [5, 10, 15];
const EXAMPLES = ['90s party anthems', 'chill sunset rooftop', 'Bollywood dance hits', 'indie road trip'];

// Host tool: describe a vibe and the AI adds matching songs to the room for guests to vote on.
export default function AiFillPanel({ state, onFill, disabled }) {
  const [prompt, setPrompt] = useState('');
  const [count, setCount] = useState(10);

  const submit = (event) => {
    event.preventDefault();
    if (prompt.trim()) onFill(prompt.trim(), count);
  };

  return (
    <form className={styles.panel} onSubmit={submit}>
      <p className={styles.intro}>Describe the vibe. The AI adds real Spotify songs to the room for guests to vote on.</p>
      <TextInput
        label="Vibe"
        hideLabel
        placeholder="e.g. 2000s pop throwbacks"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        maxLength={MAX_PROMPT_LENGTH}
        disabled={state.sending}
      />
      <div className={styles.examples}>
        {EXAMPLES.map((example) => (
          <button key={example} type="button" className={styles.chip} onClick={() => setPrompt(example)} disabled={state.sending}>
            {example}
          </button>
        ))}
      </div>
      <div className={styles.row}>
        <div className={styles.counts} role="radiogroup" aria-label="Number of songs">
          {COUNTS.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={count === value}
              className={styles.count}
              onClick={() => setCount(value)}
              disabled={state.sending}
            >
              {value}
            </button>
          ))}
        </div>
        <Button type="submit" icon={Sparkles} loading={state.sending} disabled={disabled || !prompt.trim()}>
          {state.sending ? 'Finding songs' : 'Add songs'}
        </Button>
      </div>
      {state.message && <p className={styles.status} role="status">{state.message}</p>}
    </form>
  );
}
