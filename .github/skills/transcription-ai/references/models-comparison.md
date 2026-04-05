# OpenAI Audio Models — Comparison

Decision matrix for choosing the right transcription model in different scenarios.

---

## Model Comparison Table

| Model                       | Speed     | Cost     | Accuracy | Diarization | Context | Best For                         |
| --------------------------- | --------- | -------- | -------- | ----------- | ------- | -------------------------------- |
| `gpt-4o-mini-transcribe`    | Fast      | Low      | High     | No          | GPT-4o  | ✅ Default — production use      |
| `gpt-4o-transcribe`         | Medium    | Medium   | Highest  | No          | GPT-4o  | Noisy audio, heavy accents       |
| `gpt-4o-transcribe-diarize` | Slow      | High     | Highest  | ✅ Yes      | GPT-4o  | Multi-speaker call analysis      |
| `whisper-1`                 | Very Fast | Very Low | Medium   | No          | None    | Word timestamps, bulk processing |

---

## When to Use Each Model

### gpt-4o-mini-transcribe (DEFAULT)

- Standard sales calls in clear English
- Single speaker or clean audio
- Cost-sensitive production deployments
- Suitable for 95% of Convoflow AI use cases

### gpt-4o-transcribe

- Heavy background noise (client in a car, café)
- Non-native speaker accents
- Technical jargon (medical, legal, engineering sales)
- Audio quality below 44.1 kHz

### gpt-4o-transcribe-diarize

- Conference calls with 3+ participants
- Need to attribute quotes: "Agent said X, Client said Y"
- CRM notes requiring speaker identification
- Combine with `known_speaker_names` for accuracy

### whisper-1

- Need word-level timestamps (e.g., auto-scroll transcript)
- Local/on-prem deployment preference
- Files already chunked (video processing pipelines)
- Batch processing many short clips

---

## API Parameters Reference

```python
# Common parameters
client.audio.transcriptions.create(
    model  = "gpt-4o-mini-transcribe",  # or any model above
    file   = audio_file,
    language     = "en",           # ISO 639-1 code, omit to auto-detect
    prompt       = "context text", # Improves proper noun recognition
    response_format = "text",      # "text" | "json" | "verbose_json" | "srt" | "vtt"
    temperature  = 0,              # 0 = most deterministic
)

# whisper-1 only — word timestamps
client.audio.transcriptions.create(
    model           = "whisper-1",
    file            = audio_file,
    response_format = "verbose_json",
    timestamp_granularities = ["word"],
)

# gpt-4o-transcribe-diarize only
client.audio.transcriptions.create(
    model = "gpt-4o-transcribe-diarize",
    file  = audio_file,
    extra_body = {
        "known_speaker_names": ["Jane Smith", "John Doe"]
    }
)
```

---

## File Format Support

| Format | Extension | MIME Type    | Max Size | Notes                      |
| ------ | --------- | ------------ | -------- | -------------------------- |
| M4A    | `.m4a`    | `audio/m4a`  | 25 MB    | ✅ Default from expo-av    |
| MP3    | `.mp3`    | `audio/mpeg` | 25 MB    | Wide support               |
| MP4    | `.mp4`    | `audio/mp4`  | 25 MB    | Video container with audio |
| WAV    | `.wav`    | `audio/wav`  | 25 MB    | Uncompressed, large files  |
| WebM   | `.webm`   | `audio/webm` | 25 MB    | Web audio API output       |
| OGG    | `.ogg`    | `audio/ogg`  | 25 MB    | Linux/Android recordings   |

> Files >25 MB must be chunked with `pydub` before submission. See `transcription-ai` SKILL.md for chunking code.

---

## Supported Languages (ISO 639-1)

Top sales-relevant languages with quality notes:

| Code | Language   | Quality | Notes                                    |
| ---- | ---------- | ------- | ---------------------------------------- |
| `en` | English    | ★★★★★   | Default — all accents                    |
| `es` | Spanish    | ★★★★★   | Include Latin American accents           |
| `fr` | French     | ★★★★☆   |                                          |
| `de` | German     | ★★★★☆   |                                          |
| `pt` | Portuguese | ★★★★☆   | BR and PT both supported                 |
| `hi` | Hindi      | ★★★☆☆   | Use `gpt-4o-transcribe` for best results |
| `ja` | Japanese   | ★★★★☆   |                                          |
| `zh` | Chinese    | ★★★★☆   | Mandarin; add `language="zh"`            |
| `ar` | Arabic     | ★★★☆☆   | MSA recommended                          |

Pass `language="en"` explicitly to skip auto-detection and reduce latency. Full 90+ language list: https://platform.openai.com/docs/guides/speech-to-text/supported-languages

---

## Cost Estimates (per minute of audio)

| Model                       | ~Cost/min |
| --------------------------- | --------- |
| `whisper-1`                 | $0.006    |
| `gpt-4o-mini-transcribe`    | $0.003    |
| `gpt-4o-transcribe`         | $0.006    |
| `gpt-4o-transcribe-diarize` | $0.010    |

Cost for 30-min call: whisper-1 = $0.18, gpt-4o-mini-transcribe = $0.09
