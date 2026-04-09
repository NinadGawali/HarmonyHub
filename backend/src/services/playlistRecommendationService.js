const parseJsonPayload = (responseText) => {
  if (!responseText || typeof responseText !== 'string') {
    return null;
  }

  const trimmed = responseText.trim();

  try {
    return JSON.parse(trimmed);
  } catch (_error) {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');

    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch (_nestedError) {
        return null;
      }
    }

    return null;
  }
};

const fallbackSongs = (artist, mood, count = 8) => {
  const baseArtists = artist
    ? [artist, 'The Weeknd', 'Atif Aslam', 'Jal', 'Arijit Singh', 'Bad Bunny']
    : ['The Weeknd', 'Atif Aslam', 'Jal', 'Arijit Singh', 'Bad Bunny', 'Burna Boy'];

  return Array.from({ length: count }).map((_, index) => ({
    title: `${mood || 'Vibe'} Track ${index + 1}`,
    artist: baseArtists[index % baseArtists.length],
    reason: 'Generated using fallback mode when AI provider is unavailable.'
  }));
};

const getWorkflowModules = async () => {
  const [{ ChatGoogleGenerativeAI }, { StateGraph, START, END }] = await Promise.all([
    import('@langchain/google-genai'),
    import('@langchain/langgraph')
  ]);

  return {
    ChatGoogleGenerativeAI,
    StateGraph,
    START,
    END
  };
};

const buildModel = (ChatGoogleGenerativeAI) => {
  return new ChatGoogleGenerativeAI({
    model: 'gemini-2.5-flash',
    temperature: 0.6,
    apiKey: process.env.GOOGLE_API_KEY
  });
};

const generateWithModel = async (model, prompt, expectedCount) => {
  const response = await model.invoke(prompt);
  const payload = parseJsonPayload(response.content);

  if (!payload || !Array.isArray(payload.songs)) {
    return [];
  }

  return payload.songs
    .filter((song) => song && song.title && song.artist)
    .slice(0, expectedCount)
    .map((song) => ({
      title: String(song.title).trim(),
      artist: String(song.artist).trim(),
      reason: song.reason ? String(song.reason).trim() : 'Matches your requested mood.'
    }));
};

const runRecommendationGraph = async ({ moodPrompt, artist, location, count }) => {
  const { ChatGoogleGenerativeAI, StateGraph, START, END } = await getWorkflowModules();
  const model = buildModel(ChatGoogleGenerativeAI);

  const workflow = new StateGraph({
    channels: {
      moodPrompt: { value: (x, y) => y ?? x, default: () => '' },
      artist: { value: (x, y) => y ?? x, default: () => '' },
      location: { value: (x, y) => y ?? x, default: () => null },
      count: { value: (x, y) => y ?? x, default: () => 8 },
      aiSongs: { value: (x, y) => y ?? x, default: () => [] },
      regionSongs: { value: (x, y) => y ?? x, default: () => [] },
      regionName: { value: (x, y) => y ?? x, default: () => '' }
    }
  });

  workflow.addNode('generateAiSongs', async (state) => {
    const prompt = [
      'You are a music curator assistant.',
      `Create ${state.count} playlist recommendations for this description: ${state.moodPrompt}.`,
      `Preferred artist: ${state.artist || 'none provided'}.`,
      'Return strict JSON only in this format:',
      '{"songs":[{"title":"...","artist":"...","reason":"..."}]}'
    ].join('\n');

    const aiSongs = await generateWithModel(model, prompt, state.count);
    return { aiSongs };
  });

  workflow.addNode('generateRegionalSongs', async (state) => {
    if (!state.location || typeof state.location.latitude !== 'number' || typeof state.location.longitude !== 'number') {
      return { regionSongs: [], regionName: '' };
    }

    const regionalPrompt = [
      'You are a regional music expert.',
      `Given coordinates latitude=${state.location.latitude}, longitude=${state.location.longitude}, infer a likely country or region and suggest ${Math.max(4, Math.floor(state.count / 2))} songs popular in that region.`,
      'Return strict JSON only in this format:',
      '{"regionName":"...","songs":[{"title":"...","artist":"...","reason":"..."}]}'
    ].join('\n');

    const response = await model.invoke(regionalPrompt);
    const payload = parseJsonPayload(response.content);

    if (!payload || !Array.isArray(payload.songs)) {
      return { regionSongs: [], regionName: '' };
    }

    const regionSongs = payload.songs
      .filter((song) => song && song.title && song.artist)
      .slice(0, Math.max(4, Math.floor(state.count / 2)))
      .map((song) => ({
        title: String(song.title).trim(),
        artist: String(song.artist).trim(),
        reason: song.reason ? String(song.reason).trim() : 'Popular in your region.'
      }));

    return {
      regionSongs,
      regionName: payload.regionName ? String(payload.regionName).trim() : ''
    };
  });

  workflow.addEdge(START, 'generateAiSongs');
  workflow.addEdge('generateAiSongs', 'generateRegionalSongs');
  workflow.addEdge('generateRegionalSongs', END);

  const app = workflow.compile();

  return app.invoke({
    moodPrompt,
    artist,
    location,
    count
  });
};

const generatePlaylistRecommendations = async ({ moodPrompt, artist, location, count = 8 }) => {
  const normalizedCount = Number.isFinite(Number(count)) ? Math.max(4, Math.min(15, Number(count))) : 8;

  if (!process.env.GOOGLE_API_KEY) {
    return {
      aiSongs: fallbackSongs(artist, moodPrompt, normalizedCount),
      regionSongs: location ? fallbackSongs(artist, 'Regional', Math.max(4, Math.floor(normalizedCount / 2))) : [],
      regionName: location ? 'Your Region' : '',
      usedFallback: true
    };
  }

  try {
    const state = await runRecommendationGraph({
      moodPrompt,
      artist,
      location,
      count: normalizedCount
    });

    return {
      aiSongs: state.aiSongs?.length ? state.aiSongs : fallbackSongs(artist, moodPrompt, normalizedCount),
      regionSongs: state.regionSongs || [],
      regionName: state.regionName || '',
      usedFallback: !state.aiSongs?.length
    };
  } catch (error) {
    console.error('AI recommendation workflow failed:', error.message);
    return {
      aiSongs: fallbackSongs(artist, moodPrompt, normalizedCount),
      regionSongs: location ? fallbackSongs(artist, 'Regional', Math.max(4, Math.floor(normalizedCount / 2))) : [],
      regionName: location ? 'Your Region' : '',
      usedFallback: true
    };
  }
};

module.exports = {
  generatePlaylistRecommendations
};
