# Eve integration notes

This ZIP is an edited copy of the original. Existing chat, memory, Supabase schema and screens are retained.

## Supabase Edge Function secrets (server-side only)

Configure these names in the Supabase project that Eve already uses:
- `GROQ_API_KEY` for existing chat (if not already configured).
- `FAL_KEY` for image generation (fal.ai).
- `ELEVENLABS_API_KEY` for spoken responses.
- `ELEVENLABS_VOICE_ID` for the voice you want ElevenLabs to use. A key alone does not select a voice.

Do **not** put these private keys in `EXPO_PUBLIC_*` variables, source control, or a client-side settings field.

Deploy the updated `ai-image` Edge Function and the new `ai-voice` Edge Function to the **same** existing Supabase project. The client still requires `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` from the original project configuration. No original environment file was included in the uploaded ZIP.

## Scope and limitations

- Image generation now calls fal.ai's `fal-ai/flux/schnell` endpoint.
- Voice call responses try ElevenLabs first and fall back to the browser's speech synthesis when the ElevenLabs service is not configured or fails.
- Speech input still uses browser speech recognition. It has not been switched to ElevenLabs speech-to-text.
- Video generation is **not yet integrated**: there is no video-generation user interface or backend in the original ZIP, and a specific fal.ai video model needs to be selected.
- This code has **not** been deployed to Supabase or Bolt, and the real API keys have not been entered or tested.
- Using cloud image or voice APIs may incur fees or consume trial credits.
