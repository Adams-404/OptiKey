export class AutocompleteService {
  // Tailored bigram maps for common speech, presentation, and general phrases
  private static NEXT_WORD_MAP: Record<string, string[]> = {
    'HELLO': ['EVERYONE', 'THERE', 'WORLD', 'FRIENDS', 'HOW'],
    'HOW': ['ARE', 'DO', 'CAN', 'IS', 'ABOUT'],
    'ARE': ['YOU', 'WE', 'THEY', 'THERE', 'GOING'],
    'YOU': ['DO', 'CAN', 'ARE', 'WANT', 'HAVE'],
    'THIS': ['IS', 'PROJECT', 'KEYBOARD', 'SYSTEM', 'WORK'],
    'IS': ['AN', 'A', 'AWESOME', 'VERY', 'REALLY', 'EASY'],
    'AN': ['AMAZING', 'EYE-TRACKING', 'ELEGANT', 'INNOVATIVE', 'ACCURATE'],
    'EYE-TRACKING': ['KEYBOARD', 'TECHNOLOGY', 'SYSTEM', 'PROJECT', 'INTERFACE'],
    'I': ['AM', 'WANT', 'WOULD', 'CAN', 'HAVE', 'THINK'],
    'AM': ['PRESENTING', 'USING', 'HAPPY', 'HERE', 'SO'],
    'PRESENTING': ['A', 'THIS', 'MY', 'TO', 'TODAY'],
    'TODAY': ['FOR', 'TO', 'I', 'WE', 'WITH'],
    'THANK': ['YOU', 'EVERYONE', 'YOUR', 'FOR'],
    'MY': ['PRESENTATION', 'PROJECT', 'NAME', 'FRIENDS', 'EYES'],
    'THE': ['KEYBOARD', 'SYSTEM', 'ACCURACY', 'CAMERA', 'TRACKING'],
    'TO': ['TYPE', 'PRESENT', 'SHOW', 'MAKE', 'USE'],
    'A': ['GREAT', 'NEW', 'LIVE', 'DEMO', 'PRESENTATION'],
    'LIVE': ['DEMO', 'PRESENTATION', 'SYSTEM', 'TRACKING', 'SHOW'],
    'DEMO': ['IS', 'WORKS', 'TODAY', 'FOR'],
    'GREAT': ['PROJECT', 'DEMO', 'WAY', 'IDEA', 'JOB'],
    'WE': ['CAN', 'ARE', 'HAVE', 'WANT', 'NEED'],
    'CAN': ['TYPE', 'SEE', 'USE', 'DO', 'MAKE'],
    'WANT': ['TO', 'A', 'THE', 'YOU'],
    'NEED': ['TO', 'MORE', 'A', 'THIS'],
    'PLEASE': ['HELP', 'SHOW', 'LET', 'MAKE'],
    'SO': ['THAT', 'MUCH', 'GOOD', 'EASY'],
    'VERY': ['ACCURATE', 'SMOOTH', 'EASY', 'FAST', 'GOOD'],
    'REALLY': ['COOL', 'GOOD', 'FAST', 'SMOOTH', 'EASY'],
    'AWESOME': ['KEYBOARD', 'PROJECT', 'DEMO', 'WORK'],
    'SMOOTH': ['CURSOR', 'TRACKING', 'MOVEMENT', 'SYSTEM'],
    'ACCURATE': ['CALIBRATION', 'TRACKING', 'SYSTEM', 'CURSOR'],
  };

  // Top 150 most common English words for prefix matches
  private static COMMON_WORDS = [
    'THE', 'BE', 'TO', 'OF', 'AND', 'A', 'IN', 'THAT', 'HAVE', 'I', 
    'IT', 'FOR', 'NOT', 'ON', 'WITH', 'HE', 'AS', 'YOU', 'DO', 'AT',
    'THIS', 'BUT', 'HIS', 'BY', 'FROM', 'THEY', 'WE', 'SAY', 'HER', 'SHE',
    'OR', 'AN', 'WILL', 'MY', 'ONE', 'ALL', 'WOULD', 'THERE', 'THEIR', 'WHAT',
    'SO', 'UP', 'OUT', 'IF', 'ABOUT', 'WHO', 'GET', 'WHICH', 'GO', 'ME',
    'WHEN', 'MAKE', 'CAN', 'LIKE', 'TIME', 'NO', 'JUST', 'HIM', 'KNOW', 'TAKE',
    'PEOPLE', 'INTO', 'YEAR', 'YOUR', 'GOOD', 'SOME', 'COULD', 'THEM', 'SEE', 'OTHER',
    'THAN', 'THEN', 'NOW', 'LOOK', 'ONLY', 'COME', 'ITS', 'OVER', 'THINK', 'ALSO',
    'BACK', 'AFTER', 'USE', 'TWO', 'HOW', 'OUR', 'WORK', 'FIRST', 'WELL', 'WAY',
    'EVEN', 'NEW', 'WANT', 'BECAUSE', 'ANY', 'THESE', 'GIVE', 'DAY', 'MOST', 'US',
    'PRESENTATION', 'PRESENT', 'PROJECT', 'EYE-TRACKING', 'AMAZING', 'AWESOME', 'ACCURATE',
    'SMOOTH', 'STABLE', 'HELLO', 'THANK', 'VERY', 'REALLY', 'EASY', 'FAST', 'LIVE',
    'DEMO', 'SYSTEM', 'CAMERA', 'KEYBOARD', 'CALIBRATION', 'TRACKING', 'CURSOR',
    'PLEASE', 'TODAY', 'EVERYONE', 'FRIENDS', 'WORLD', 'GLAD', 'HAPPY', 'WELCOME'
  ];

  // User adaptive vocabulary learned during runtime
  private static learnedTransitions: Record<string, string[]> = {};

  /**
   * Tracks and learns typing transitions to customize local predictive memory
   */
  public static learnTransition(word1: string, word2: string) {
    const w1 = word1.toUpperCase().replace(/[^A-Z]/g, '');
    const w2 = word2.toUpperCase().replace(/[^A-Z]/g, '');
    if (!w1 || !w2 || w1 === w2) return;

    if (!this.learnedTransitions[w1]) {
      this.learnedTransitions[w1] = [];
    }

    // Shift the newly typed transition to the front (limit to 5)
    this.learnedTransitions[w1] = [w2, ...this.learnedTransitions[w1].filter(w => w !== w2)].slice(0, 5);
  }

  /**
   * Generates highly relevant autocomplete options in real-time
   */
  public static getPredictions(currentText: string): string[] {
    const trimmed = currentText.trimEnd();
    const words = trimmed.split(/\s+/);
    const endsWithSpace = currentText.endsWith(' ');
    
    // CASE A: Finished typing a word -> Predict NEXT word
    if (endsWithSpace && words.length > 0) {
      const lastWord = words[words.length - 1].toUpperCase().replace(/[^A-Z-]/g, '');
      
      const learned = this.learnedTransitions[lastWord] || [];
      const predefined = this.NEXT_WORD_MAP[lastWord] || [];
      const combined = [...new Set([...learned, ...predefined])];

      if (combined.length > 0) {
        return combined.slice(0, 5);
      }
      
      // Default predictions based on popular sentence starters
      return ['IS', 'THE', 'TO', 'AND', 'I'].slice(0, 5);
    }
    
    // CASE B: In middle of typing a word -> Prefix match autocomplete
    if (words.length > 0) {
      const activeWord = words[words.length - 1].toUpperCase();
      if (!activeWord) return this.COMMON_WORDS.slice(0, 5);

      const matches = this.COMMON_WORDS.filter(
        w => w.startsWith(activeWord) && w !== activeWord
      );

      if (matches.length > 0) {
        return matches.slice(0, 5);
      }
    }

    // Default starting list
    return ['THE', 'BE', 'TO', 'OF', 'AND'].slice(0, 5);
  }

  /**
   * Sub-100ms LLM completion querying Groq Llama-3 API
   */
  public static async queryGroqPrediction(currentText: string, apiKey: string): Promise<string[]> {
    try {
      const cleanKey = apiKey.replace(/^"|"$/g, '').trim();
      const response = await fetch('/api/groq/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cleanKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content: 'You are an eye-tracking text-prediction assistant. Given the user\'s text, suggest exactly 5 highly logical options for the next single word (or immediate completion), in UPPERCASE, separated by commas. Return ONLY the 5 comma-separated uppercase words. No markdown, no punctuation except commas. Example: FOR, TO, IN, A, THE'
            },
            {
              role: 'user',
              content: `Text: "${currentText}"`
            }
          ],
          temperature: 0.2,
          max_tokens: 15
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Groq API Error Response:', errorText);
        return [];
      }
      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      if (!content) return [];

      return content
        .split(',')
        .map((w: string) => w.trim().toUpperCase().replace(/[^A-Z-]/g, ''))
        .filter((w: string) => w.length > 0)
        .slice(0, 5);
    } catch (e) {
      console.error('Groq autocomplete prediction failed', e);
      return [];
    }
  }
}
