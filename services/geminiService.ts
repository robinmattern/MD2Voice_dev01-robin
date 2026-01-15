
import { GoogleGenAI, Modality } from "@google/genai";
import { DialogueLine, SpeakerConfig } from "../types";
import { GEMINI_TTS_MODEL } from "../constants";

export const generateTTS = async (
  lines: DialogueLine[],
  userConfig: SpeakerConfig,
  assistantConfig: SpeakerConfig
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: (process as any).env.API_KEY });
  
  // Format the dialogue for the model
  const dialogueText = lines
    .map((line) => `${line.speaker === 'User' ? userConfig.name : assistantConfig.name}: ${line.text}`)
    .join('\n');

  const prompt = `Convert the following conversation into audio with high naturalness. Ensure the emotional tone matches the context:
${dialogueText}`;

  const response = await ai.models.generateContent({
    model: GEMINI_TTS_MODEL,
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: [
            {
              speaker: userConfig.name,
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: userConfig.voice },
              },
            },
            {
              speaker: assistantConfig.name,
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: assistantConfig.voice },
              },
            },
          ],
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error('No audio data received from Gemini API');
  }

  return base64Audio;
};
